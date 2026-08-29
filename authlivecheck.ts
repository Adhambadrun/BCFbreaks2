/**
 * Live checks against a running dev server — `npm run check:auth:live`.
 *
 * These need the real Express + ws wiring (the guard's position in the middleware
 * chain, and the fact that a WebSocket upgrade bypasses Express entirely), so they
 * are exercised end to end instead of in the offline harness.
 *
 * Assumes `AUTH0_ENV=development` with usable secrets and NO dev bypass: the point is
 * to prove nothing is reachable without a session.
 */
import { WebSocket } from 'ws';

const BASE = process.env.BCF_BASE || 'http://127.0.0.1:3000';
const results: string[] = [];
const check = (label: string, cond: boolean) => results.push(`${cond ? 'PASS' : 'FAIL'}  ${label}`);

async function main() {
  // 1. Unauthenticated navigation to `/` must bounce to Auth0's hosted login.
  const root = await fetch(`${BASE}/`, { redirect: 'manual', headers: { accept: 'text/html' } });
  const loc = root.headers.get('location') || '';
  check(`GET / unauthenticated -> 302 (got ${root.status})`, root.status === 302);
  check(`redirect targets the login route (${loc})`, loc.startsWith('/auth/login'));

  const login = await fetch(`${BASE}${loc}`, { redirect: 'manual' });
  const idp = login.headers.get('location') || '';
  check(`GET /auth/login -> 302 to Auth0 hosted page (got ${login.status})`, login.status === 302);
  check(`hosted URL is the tenant /authorize (${idp.split('?')[0]})`, /^https:\/\/.+\.auth0\.com\/authorize$/.test(idp.split('?')[0]));
  const qs = new URL(idp).searchParams;
  check('authorize carries response_type=code', qs.get('response_type') === 'code');
  check('authorize carries state', Boolean(qs.get('state')));
  check('authorize carries nonce', Boolean(qs.get('nonce')));
  check('authorize uses PKCE S256', qs.get('code_challenge_method') === 'S256' && Boolean(qs.get('code_challenge')));
  check('openid profile email scopes requested', (qs.get('scope') || '').includes('openid'));
  check('redirect_uri is this origin, not localhost (proxy-aware)', (qs.get('redirect_uri') || '').includes('/auth/callback'));
  const setCookie = login.headers.getSetCookie?.().join(' ') || '';
  check('state cookie is HttpOnly', /HttpOnly/i.test(setCookie));
  check('state cookie path scoped to /auth', /Path=\/auth/.test(setCookie));

  // 2. APIs and the SPA session endpoint refuse without a session.
  const api = await fetch(`${BASE}/api/health`);
  check(`GET /api/health stays open for deploy probes (${api.status})`, api.status === 200);
  const sess = await fetch(`${BASE}/api/session`, { redirect: 'manual' });
  check(`GET /api/session unauthenticated -> 401 (got ${sess.status})`, sess.status === 401);
  const chat = await fetch(`${BASE}/api/ai-chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  check(`POST /api/ai-chat unauthenticated -> 401 (got ${chat.status})`, chat.status === 401);

  // 3. A replayed/forged callback must never mint a session.
  const callback = await fetch(`${BASE}/auth/callback?code=attacker&state=attacker`, { redirect: 'manual' });
  check(`callback with unknown state -> 400 (got ${callback.status})`, callback.status === 400);
  const sessionAfter = callback.headers.getSetCookie?.().find(c => c.startsWith('__bcf_session='));
  check('no session cookie issued by a rejected callback', !sessionAfter);

  // 3b. An IdP-side rejection (e.g. the Auth0 Action denying a domain) must surface
  //     the reason and must not bounce into a sign-in loop.
  const denied = await fetch(`${BASE}/auth/callback?error=access_denied&error_description=Only%20%40bcflights.com%20accounts%20may%20enter`, { redirect: 'manual' });
  const deniedBody = await denied.text();
  check(`callback error surfaces as 403, not a redirect (got ${denied.status})`, denied.status === 403);
  check('rejection reason is shown to the user', deniedBody.includes('Only @bcflights.com accounts may enter'));
  check('no session cookie on rejection', !denied.headers.getSetCookie?.().some(c => c.startsWith('__bcf_session=')));

  // 4. Open-redirect probe on returnTo.
  const evil = await fetch(`${BASE}/auth/login?returnTo=${encodeURIComponent('https://evil.example/')}`, { redirect: 'manual' });
  void evil;
  const nested = await fetch(`${BASE}/auth/login?returnTo=${encodeURIComponent('//evil.example/')}`, { redirect: 'manual' });
  check(`protocol-relative returnTo refused (status ${nested.status})`, nested.status === 302);

  // 5. Voice WebSocket: the upgrade must be REFUSED outright, not opened-then-closed,
  //    because `/live` fronts a billed Gemini session. A valid session still works.
  const wsProbe = (cookie?: string) =>
    new Promise<string>(resolve => {
      const ws = new WebSocket(`${BASE.replace('http', 'ws')}/live`, cookie ? { headers: { cookie } } : undefined);
      let opened = false;
      ws.on('open', () => {
        opened = true;
      });
      ws.on('close', code => resolve(`${opened ? 'OPENED' : 'REFUSED'}-close-${code}`));
      ws.on('error', e => resolve(`${opened ? 'OPENED' : 'REFUSED'}-${(e as Error).message}`));
      setTimeout(() => resolve('timeout'), 5000);
    });

  const anonWs = await wsProbe();
  check(`unauthenticated /live handshake refused (${anonWs})`, anonWs.startsWith('REFUSED'));

  const fs = await import('node:fs');
  if (fs.existsSync('/tmp/cookies.txt')) {
    const corp = /CORP=(.*)/.exec(fs.readFileSync('/tmp/cookies.txt', 'utf8'))?.[1];
    const forged = /FORGED=(.*)/.exec(fs.readFileSync('/tmp/cookies.txt', 'utf8'))?.[1];
    const corpWs = await wsProbe(`__bcf_session=${corp}`);
    check(`valid session may open /live (${corpWs})`, corpWs.startsWith('OPENED'));
    const forgedWs = await wsProbe(`__bcf_session=${forged}`);
    check(`forged cookie cannot open /live (${forgedWs})`, forgedWs.startsWith('REFUSED'));
  } else {
    console.log('SKIP  cookie-based /live checks (run mint script first)');
  }

  console.log(results.join('\n'));
  const failed = results.filter(r => r.startsWith('FAIL'));
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

void main().catch(err => {
  console.error('LIVE HARNESS ERROR', err);
  process.exit(2);
});
