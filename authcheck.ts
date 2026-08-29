/**
 * Verification harness for the zero-trust gate — `npm run check:auth`.
 *
 * Covers what a curl cannot express: ID-token validation against a locally minted
 * RSA key (so it needs no network at all), session cookie sealing and re-derivation,
 * access-tier clamping, and the algorithm-confusion cases (`alg:none`, HS256,
 * foreign-key signatures). Every assertion here is a *negative* test on purpose:
 * the gate is only worth having if the rejects hold.
 */
import crypto from 'node:crypto';
import { openToken, sealToken, readSession, verifyIdToken, type Auth0Config, type HeaderCarrier } from './serverAuth';
import { getUserAccessLevel, resolveSessionRole } from './accessLevels';

const results: string[] = [];
const check = (label: string, cond: boolean) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);

const SECRET = 'a'.repeat(64);
const config: Auth0Config = {
  envName: 'development',
  domain: 'tenant.us.auth0.com',
  clientId: 'CLIENTID',
  clientSecret: 's'.repeat(40),
  sessionSecret: SECRET,
  issuer: 'https://tenant.us.auth0.com/',
};

/* ---- 1. session cookie sealing ---- */
const session = {
  sub: 'google-oauth2|1',
  email: 'tarek.zaki@bcflights.com',
  name: 'Tarek',
  role: 'supervisor' as const,
  teamId: 'team_strikers',
  accessLevel: 'production' as const,
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};
const sealed = sealToken(session, SECRET);
check('sealed session round-trips', openToken(sealed, SECRET)?.email === session.email);
check('tampered payload rejected', openToken(sealed.replace('ey', 'ez'), SECRET) === null);
check('wrong key rejected', openToken(sealed, 'b'.repeat(64)) === null);

const asReq = (cookie?: string): HeaderCarrier => ({ headers: cookie ? { cookie } : {} });
check('readSession ok', readSession(asReq(`${'x'}=1; ${'__bcf_session'}=${sealed}`), config).status === 'ok');
check('readSession anonymous without cookie', readSession(asReq(), config).status === 'anonymous');
check('readSession tampered on bad mac', readSession(asReq(`__bcf_session=${sealed.slice(0, -2)}zz`), config).status === 'tampered');
const expired = sealToken({ ...session, exp: Math.floor(Date.now() / 1000) - 10 }, SECRET);
check('readSession expired', readSession(asReq(`__bcf_session=${expired}`), config).status === 'expired');

// A cookie hand-edited to claim developer must not survive re-derivation.
const escalated = sealToken({ ...session, role: 'developer', accessLevel: 'production' }, SECRET);
const escalatedRead = readSession(asReq(`__bcf_session=${escalated}`), config);
check('role re-derived from email, not from cookie', escalatedRead.session?.role === 'supervisor');
const outsider = sealToken({ ...session, email: 'l33t-admin@gmail.com', role: 'admin' }, SECRET);
const outsiderRead = readSession(asReq(`__bcf_session=${outsider}`), config);
check(
  'preview-tier admin clamped to agent',
  outsiderRead.session?.role === 'agent' && outsiderRead.session?.accessLevel === 'preview'
);

/* ---- 2. access tiers ---- */
check('@bcflights.com -> production', getUserAccessLevel('AnyOne@bcflights.com') === 'production');
check('dev override -> production', getUserAccessLevel('adhambadraan@gmail.com') === 'production');
check('other domain -> preview', getUserAccessLevel('someone@acme.io') === 'preview');
check('no email -> preview', getUserAccessLevel(undefined) === 'preview');
check('lookalike suffix -> preview', getUserAccessLevel('me@bcflights.com.evil.tld') === 'preview');
check('lookalike prefix -> preview', getUserAccessLevel('me@notbcflights.com') === 'preview');
check(
  'preview admin demoted (demoted flag)',
  resolveSessionRole('root-admin@gmail.com', 'preview').demoted === true &&
    resolveSessionRole('root-admin@bcflights.com', 'production').demoted === false
);

/* ---- 3. ID token validation, with a locally minted RSA keypair ---- */
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = publicKey.export({ format: 'jwk' }) as any;
jwk.kid = 'testkey';
jwk.use = 'sig';
jwk.alg = 'RS256';

const b64u = (buf: Buffer) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const mint = (claims: Record<string, any>, header: Record<string, any> = { alg: 'RS256', typ: 'JWT', kid: 'testkey' }) => {
  const p0 = b64u(Buffer.from(JSON.stringify(header)));
  const p1 = b64u(Buffer.from(JSON.stringify(claims)));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${p0}.${p1}`), privateKey);
  return `${p0}.${p1}.${b64u(sig)}`;
};
const nowSec = Math.floor(Date.now() / 1000);
const goodClaims = {
  iss: 'https://tenant.us.auth0.com/',
  aud: 'CLIENTID',
  sub: 'google-oauth2|1',
  exp: nowSec + 3600,
  iat: nowSec,
  nonce: 'NONCE123',
  email: 'tarek.zaki@bcflights.com',
};
const fetcher = async () => [jwk];

(async () => {
  const ok = await verifyIdToken(config, mint(goodClaims), 'NONCE123', undefined, fetcher);
  check('valid RS256 token accepted', ok.email === 'tarek.zaki@bcflights.com');

  const rejecting = async (label: string, token: string, nonce = 'NONCE123') => {
    try {
      await verifyIdToken(config, token, nonce, undefined, fetcher);
      check(label, false);
    } catch (err: any) {
      check(`${label} (${err.message.slice(0, 46)})`, true);
    }
  };
  await rejecting('wrong issuer rejected', mint({ ...goodClaims, iss: 'https://evil.example/' }));
  await rejecting('wrong audience rejected', mint({ ...goodClaims, aud: 'OTHERAPP' }));
  await rejecting('expired rejected', mint({ ...goodClaims, exp: nowSec - 7200 }));
  await rejecting('nonce mismatch rejected', mint(goodClaims), 'DIFFERENT');
  await rejecting('alg none rejected', mint(goodClaims, { alg: 'none', typ: 'JWT' }));
  await rejecting('alg confusion (HS256 header) rejected', mint(goodClaims, { alg: 'HS256', typ: 'JWT', kid: 'testkey' }));
  // Signed by a *different* key with the same kid: must fail on signature.
  const other = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const forged = (() => {
    const p0 = b64u(Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'testkey' })));
    const p1 = b64u(Buffer.from(JSON.stringify({ ...goodClaims, email: 'admin@bcflights.com', sub: 'attacker' })));
    return `${p0}.${p1}.${b64u(crypto.sign('RSA-SHA256', Buffer.from(`${p0}.${p1}`), other.privateKey))}`;
  })();
  await rejecting('signature from foreign key rejected', forged);

  /* ---- 4. unauthenticated /live WebSocket must be refused ----
     Exercised against the real dev server by `npm run check:auth:live` — an inline
     stub server here could not reproduce the Express + ws wiring that matters. */

  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(err => {
  console.error('HARNESS ERROR', err);
  process.exit(2);
});
