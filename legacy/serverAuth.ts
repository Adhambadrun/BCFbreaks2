/**
 * BCFbreaks — Auth0 zero-trust gate and backend-for-frontend (BFF).
 * ===========================================================================
 * THIS IS THE `src/middleware.ts` OF THIS PROJECT
 * The requested implementation is Next.js middleware + `@auth0/nextjs-auth0`
 * (`Auth0Client`, `auth0.getSession(request)`, `/auth/login`). This repo is a Vite
 * SPA behind an Express server (`server.ts`); there is no Next.js runtime for that
 * middleware to execute in. Express middleware mounted ahead of every route is the
 * functional equivalent — and for a deployed app the *stronger* place to enforce it,
 * because the check runs before a single byte of page or API response is returned.
 *
 * GUARANTEES
 *   1. No guest access. Every request — including `/` — without a valid session is
 *      refused: navigations are 302'd to the Auth0 hosted login, API/asset requests
 *      get 401 JSON, the voice WebSocket is closed with policy code 4401.
 *   2. Tokens never reach the browser. Auth0's code-for-token exchange happens
 *      server-to-server; the browser receives only an httpOnly, HMAC-signed session
 *      cookie, so injected script cannot read a token.
 *   3. Fail closed. Missing credentials or an unreachable tenant yields 503/401 —
 *      never a bypass, never a demo account.
 *   4. Access tier is derived from the *verified ID token* on every request, so the
 *      client cannot influence it.
 *
 * WHY A CONFIDENTIAL CLIENT (and therefore a secret)
 * Server-side `getSession()` plus per-environment client secrets implies exactly this
 * shape. The `AUTH0_*_SECRET` values in the spec were shared in plaintext and must be
 * rotated before any real use; they are read from the environment only and are never
 * defaulted in source, so no secret can be committed.
 */
import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { determineRoleForEmail, getUserAccessLevel, resolveSessionRole, type AccessLevel } from './accessLevels';
import type { UserRole } from './types';

/* ------------------------------------------------------------------ config -- */

export type EnvName = 'development' | 'staging' | 'production';

/**
 * Public per-environment identifiers. These two fields are not secrets (the client
 * ID appears in the Auth0-hosted login URL regardless). Secrets must come from env.
 */
const TENANT_PRESETS: Record<EnvName, { domain: string; clientId: string }> = {
  development: {
    domain: 'icfg-5qgdjxyskxeyawhf3smwvjne-development.us.auth0.com',
    clientId: 'Si6fy5STWPGIdgIICvOr4LPUhpbHQ6qr',
  },
  staging: {
    domain: 'icfg-5qgdjxyskxeyawhf3smwvjne-staging.us.auth0.com',
    clientId: 'Zlgbg8OQNIreLxDr8TQUslqsvNPIeGtF',
  },
  production: {
    domain: 'icfg-5qgdjxyskxeyawhf3smwvjne.us.auth0.com',
    clientId: 'XJS0prsHuy59Gxp15wG3sByvv8sYnyGv',
  },
};

export interface Auth0Config {
  envName: EnvName;
  domain: string;
  clientId: string;
  clientSecret: string;
  sessionSecret: string;
  /** Auth0's `iss` claim always carries a trailing slash; compare it exactly. */
  issuer: string;
  /** True when the local-dev escape hatch supplied an ephemeral signing key. */
  devMode?: boolean;
}

export interface Auth0ConfigResult {
  config: Auth0Config | null;
  /** Why the config is unusable. Safe to show operators — it never contains values. */
  reason?: string;
  envName: EnvName;
}

const MIN_SECRET_LENGTH = 32;

function looksPlaceholder(value: string): boolean {
  return /(^|[^a-z])(your|changeme|replace|placeholder|xxx|todo)([^a-z]|$)/i.test(value);
}

function validSecret(value: string): boolean {
  return value.length >= MIN_SECRET_LENGTH && !looksPlaceholder(value);
}

/**
 * Resolves the tenant for this deployment.
 *
 * Environment selection: `AUTH0_ENV` → `VERCEL_ENV` (`preview` → staging) →
 * `NODE_ENV`. Flat names (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
 * `AUTH0_SECRET`) win; otherwise the scoped names
 * (`AUTH0_DEVELOPMENT_*`, `AUTH0_STAGING_*`, `AUTH0_PRODUCTION_*`) let one secret
 * store hold all three environments.
 */
export function resolveAuth0Config(env: NodeJS.ProcessEnv = process.env): Auth0ConfigResult {
  const requested = String(env.AUTH0_ENV || env.VERCEL_ENV || (env.NODE_ENV === 'production' ? 'production' : 'development'))
    .trim()
    .toLowerCase();
  const envName: EnvName =
    requested.startsWith('prod')
      ? 'production'
      : requested === 'staging' || requested === 'preview' || requested.startsWith('stage')
        ? 'staging'
        : 'development';

  const scoped = (name: string): string => (env[`AUTH0_${envName.toUpperCase()}_${name}`] || '').trim();
  const preset = TENANT_PRESETS[envName];

  const domain = (env.AUTH0_DOMAIN || '').trim() || preset.domain;
  const clientId = (env.AUTH0_CLIENT_ID || '').trim() || preset.clientId;
  const clientSecret = (env.AUTH0_CLIENT_SECRET || '').trim() || scoped('CLIENT_SECRET');
  const sessionSecret = (env.AUTH0_SECRET || '').trim() || scoped('SECRET');

  if (!clientSecret) {
    return { config: null, envName, reason: `AUTH0_CLIENT_SECRET (or AUTH0_${envName.toUpperCase()}_CLIENT_SECRET) is not set` };
  }
  if (!validSecret(clientSecret)) {
    return {
      config: null,
      envName,
      reason: `AUTH0_CLIENT_SECRET is shorter than ${MIN_SECRET_LENGTH} characters or still holds a placeholder value`,
    };
  }
  if (!sessionSecret) {
    return { config: null, envName, reason: `AUTH0_SECRET (or AUTH0_${envName.toUpperCase()}_SECRET) is not set` };
  }
  if (!validSecret(sessionSecret)) {
    return {
      config: null,
      envName,
      reason: `AUTH0_SECRET is shorter than ${MIN_SECRET_LENGTH} characters or still holds a placeholder value`,
    };
  }

  return {
    envName,
    config: { envName, domain, clientId, clientSecret, sessionSecret, issuer: `https://${domain}/` },
  };
}

/* ---------------------------------------------------------------- session -- */

export interface FloorSession {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  role: UserRole;
  teamId: string;
  accessLevel: AccessLevel;
  /** Unix seconds. */
  iat: number;
  exp: number;
}

export const SESSION_COOKIE = '__bcf_session';
export const OAUTH_COOKIE = '__bcf_oauth';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const b64url = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unB64url = (input: string): Buffer => Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sign = (payload: string, secret: string): string =>
  b64url(crypto.createHmac('sha256', secret).update(payload).digest());

/**
 * `base64url(json).hmac` — a stateless, tamper-evident token, the same shape
 * `@auth0/nextjs-auth0` uses for its session cookie. No Redis required, survives
 * restarts, and works across serverless instances. Integrity is the HMAC keyed with
 * AUTH0_SECRET, compared with `timingSafeEqual` to avoid a timing oracle.
 */
export function sealToken(value: unknown, secret: string): string {
  const payload = b64url(JSON.stringify(value));
  return `${payload}.${sign(payload, secret)}`;
}

export function openToken<T = any>(token: string | undefined, secret: string): T | null {
  if (!token) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = Buffer.from(sign(payload, secret));
  const provided = Buffer.from(mac);
  if (provided.length !== expected.length || !crypto.timingSafeEqual(provided, expected)) return null;
  try {
    return JSON.parse(unB64url(payload).toString('utf8')) as T;
  } catch {
    return null;
  }
}

/** Anything that carries request headers — an Express Request or a raw upgrade request. */
export interface HeaderCarrier {
  headers: Record<string, string | string[] | undefined>;
}

function readCookie(req: HeaderCarrier, name: string): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== 'string' || !header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

/** True when the browser-facing scheme is https (proxy-aware) — i.e. Secure applies. */
export function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  if (forwardedProto) return forwardedProto === 'https';
  return (req as any).secured === true || req.protocol === 'https';
}

/**
 * Public origin the browser sees. `AUTH0_BASE_URL` wins; otherwise it is rebuilt
 * from proxy headers so `redirect_uri` matches what Auth0 expects — which is what
 * makes the flow work behind the sandbox/dev proxy at all.
 */
export function getBaseUrl(req: Request): string {
  const configured = (process.env.AUTH0_BASE_URL || process.env.VERCEL_URL || '').trim();
  if (configured) return configured.startsWith('http') ? configured.replace(/\/$/, '') : `https://${configured.replace(/\/$/, '')}`;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  if (!host) return '';
  return `${isHttpsRequest(req) ? 'https' : 'http'}://${host}`;
}

export const callbackUriFor = (req: Request): string => `${getBaseUrl(req)}/auth/callback`;

export interface SessionRead {
  session: FloorSession | null;
  status: 'ok' | 'anonymous' | 'expired' | 'tampered' | 'unconfigured';
}

/**
 * Verifies the session cookie and re-derives the access tier on every read.
 *
 * Re-deriving rather than trusting the stored `accessLevel` means a hand-edited or
 * replayed cookie cannot widen access: role and tier are always recomputed from the
 * email that was verified at sign-in.
 */
export function readSession(req: HeaderCarrier, config: Auth0Config | null): SessionRead {
  if (!config) return { session: null, status: 'unconfigured' };
  const raw = readCookie(req, SESSION_COOKIE);
  if (!raw) return { session: null, status: 'anonymous' };
  const payload = openToken<FloorSession>(raw, config.sessionSecret);
  if (!payload || typeof payload.sub !== 'string' || !payload.email) return { session: null, status: 'tampered' };
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= Date.now()) return { session: null, status: 'expired' };

  const accessLevel = getUserAccessLevel(payload.email);
  // Authorization is recomputed from policy on every request; the cookie's own
  // `role`/`accessLevel` fields are treated as informational only. A (validly
  // signed) cookie from before a demotion therefore cannot keep exercising the
  // old privilege, and a hand-edited one could not either.
  const resolved = resolveSessionRole(payload.email, accessLevel, undefined);
  return {
    status: 'ok',
    session: {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      // A Preview-tier user holding an admin/supervisor mapping is clamped to agent.
      role: resolved.role,
      teamId: payload.teamId || resolved.teamId,
      accessLevel,
      iat: payload.iat,
      exp: payload.exp,
    },
  };
}

/* ------------------------------------------------------------ oidc helpers -- */

interface Jwk {
  kid?: string;
  [key: string]: unknown;
}

const JWKS_TTL_MS = 10 * 60 * 1000;
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

export type JwksFetcher = (url: string) => Promise<Jwk[]>;

const defaultJwksFetcher: JwksFetcher = async url => {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`JWKS fetch failed with HTTP ${res.status}`);
  const body = (await res.json()) as { keys?: Jwk[] };
  if (!Array.isArray(body?.keys) || body.keys.length === 0) throw new Error('JWKS response contained no keys');
  return body.keys;
};

/**
 * Full ID-token validation. Checking the signature alone is not enough: these are
 * the assertions that stop a token minted for a *different* Auth0 application from
 * being replayed against this one.
 */
export async function verifyIdToken(
  config: Auth0Config,
  idToken: string,
  expectedNonce: string,
  expectedAccessToken?: string,
  fetcher: JwksFetcher = defaultJwksFetcher
): Promise<Record<string, any>> {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed ID token');

  const header = JSON.parse(unB64url(parts[0]).toString('utf8'));
  // Pin the algorithm. Accepting `none`, or letting the header choose HS256 so our
  // public key becomes an HMAC secret, are both classic JWT pitfalls.
  if (header.alg !== 'RS256') throw new Error(`Unsupported ID token alg "${header.alg}" (expected RS256)`);
  if (typeof header.kid !== 'string' || !header.kid) throw new Error('ID token header has no kid');

  const loadKeys = async (): Promise<Jwk[]> => {
    const cached = jwksCache.get(config.issuer);
    if (cached && Date.now() - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
    const fresh = { keys: await fetcher(`https://${config.domain}/.well-known/jwks.json`), fetchedAt: Date.now() };
    jwksCache.set(config.issuer, fresh);
    return fresh.keys;
  };

  let keys = await loadKeys();
  let jwk = keys.find(k => k.kid === header.kid);
  if (!jwk) {
    // Key rotation: bypass the cache once, else a rotation mid-shift locks everyone
    // out until the TTL expires.
    jwksCache.delete(config.issuer);
    keys = await loadKeys();
    jwk = keys.find(k => k.kid === header.kid);
  }
  if (!jwk) throw new Error(`No JWKS key matches kid "${header.kid}"`);

  const publicKey = crypto.createPublicKey({ key: jwk as any, format: 'jwk' });
  const signatureValid = crypto.verify(
    'RSA-SHA256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    publicKey,
    Buffer.from(unB64url(parts[2]))
  );
  if (!signatureValid) throw new Error('ID token signature is invalid');

  const claims = JSON.parse(unB64url(parts[1]).toString('utf8'));
  const nowSec = Math.floor(Date.now() / 1000);
  const clockSkew = 60;

  if (claims.iss !== config.issuer) throw new Error(`ID token issuer "${claims.iss}" does not match "${config.issuer}"`);
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(config.clientId)) throw new Error('ID token audience does not include this application client ID');
  if (typeof claims.exp !== 'number' || nowSec > claims.exp + clockSkew) throw new Error('ID token is expired');
  if (typeof claims.iat !== 'number') throw new Error('ID token is missing iat');
  if (!expectedNonce || claims.nonce !== expectedNonce) throw new Error('ID token nonce mismatch (possible CSRF/replay)');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new Error('ID token is missing sub');

  // at_hash binds this ID token to the access token delivered alongside it.
  if (expectedAccessToken && claims.at_hash) {
    const digest = crypto.createHash('sha256').update(expectedAccessToken).digest();
    if (b64url(digest.subarray(0, 16)) !== claims.at_hash) throw new Error('ID token at_hash mismatch');
  }
  return claims;
}

async function exchangeCodeForTokens(
  config: Auth0Config,
  params: { code: string; codeVerifier: string; redirectUri: string }
): Promise<{ access_token?: string; id_token?: string }> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
    code_verifier: params.codeVerifier,
  });
  const res = await fetch(`https://${config.domain}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    throw new Error(`Auth0 token exchange failed (${payload.error || res.status}): ${payload.error_description || 'no details'}`);
  }
  if (!payload.id_token) throw new Error('Auth0 token response contained no id_token');
  // `payload` is intentionally not returned wholesale: any refresh_token stays on
  // the server and is never attached to the session or sent to the client.
  return { access_token: payload.access_token, id_token: payload.id_token };
}

/* ------------------------------------------------------------------ guard -- */

/**
 * Paths reachable without a session. Note what is absent: no page, no data route,
 * no preview. Static bundles are allowed because they are inert code — gating the
 * document and every API is what protects the data.
 */
export function isPublicPath(path: string): boolean {
  if (path === '/auth/login' || path === '/auth/callback' || path === '/auth/logout' || path === '/api/health') return true;
  if (path.startsWith('/auth/')) return true;
  if (path.startsWith('/assets/') || path.startsWith('/@') || path.startsWith('/__vite') || path.startsWith('/node_modules/')) return true;
  if (path.startsWith('/favicon') || path.startsWith('/robots.txt') || path.startsWith('/sitemap')) return true;
  return /\.(?:js|css|map|svg|png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|manifest|hot|ping)$/i.test(path);
}

/** Same-origin absolute paths only, so `?returnTo=` can never become an open redirect. */
export function safeReturnTo(raw: unknown): string {
  const value = typeof raw === 'string' ? raw : '';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.includes('\n') || value.includes('\r')) return '/';
  try {
    const url = new URL(value, 'http://localhost.local');
    if (url.origin !== 'http://localhost.local') return '/';
    return `${url.pathname}${url.search}${url.hash}` || '/';
  } catch {
    return '/';
  }
}

export function buildLoginRedirect(returnTo: string): string {
  return `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}`;
}

/**
 * Builds a developer session for the local escape hatch. Even this is a *session*:
 * the gate still runs, so "no session, no app" is never weakened.
 */
export function localDevSession(email = 'adhambadraan@gmail.com'): FloorSession {
  const nowSec = Math.floor(Date.now() / 1000);
  const meta = determineRoleForEmail(email);
  return {
    sub: `dev|${email}`,
    email,
    name: meta.name || 'Local Developer',
    role: 'developer',
    teamId: meta.teamId,
    accessLevel: 'production',
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };
}

function setCookie(res: Response, name: string, value: string, attrs: { maxAge: number; secure: boolean; path: string }): void {
  const segments = [`${name}=${encodeURIComponent(value)}`, `Path=${attrs.path}`, `Max-Age=${attrs.maxAge}`, 'HttpOnly', 'SameSite=lax'];
  if (attrs.secure) segments.push('Secure');
  const existing = res.getHeader('Set-Cookie');
  const list = Array.isArray(existing) ? (existing as string[]) : existing ? [String(existing)] : [];
  res.setHeader('Set-Cookie', [...list, segments.join('; ')]);
}

function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

function errorPage(title: string, detail: string): string {
  return [
    '<!doctype html><meta charset="utf-8"><title>BCFBreaks — sign-in</title>',
    '<body style="font:14px/1.6 ui-sans-serif,system-ui;background:#060812;color:#e2e8f0;padding:40px;max-width:44rem">',
    `<h1 style="font-size:18px">${escapeHtml(title)}</h1>`,
    `<p style="color:#94a3b8">${escapeHtml(detail)}</p>`,
    '<p><a href="/auth/login" style="color:#38bdf8">Return to sign-in</a></p>',
    '</body>',
  ].join('');
}

/* ------------------------------------------------------------- auth routes -- */

export interface AuthBundle {
  /** Mounted first: handles /auth/* and /api/session, then falls through. */
  middleware: RequestHandler;
  /** The zero-trust gate. Mounted ahead of every other route. */
  guard: RequestHandler;
  config: Auth0Config | null;
  envName: EnvName;
  configReason?: string;
  devMode: boolean;
}

export interface AuthOptions {
  env?: NodeJS.ProcessEnv;
  /**
   * Set false to remove the local escape hatch entirely. When enabled it requires
   * `AUTH0_UNAUTHENTICATED_DEV_SESSION=1` and a non-production NODE_ENV; it mints a
   * real developer session rather than skipping the gate.
   */
  allowLocalDevSession?: boolean;
}

export function createAuth({ env = process.env, allowLocalDevSession = true }: AuthOptions = {}): AuthBundle {
  const resolved = resolveAuth0Config(env);
  // Local-only escape hatch. Note the belt-and-braces: Vercel sets NODE_ENV at
  // *build* time but does not guarantee it in the Node.js runtime, so keying only on
  // NODE_ENV would let a stray `AUTH0_UNAUTHENTICATED_DEV_SESSION=1` in Vercel's
  // Production environment variables open a developer bypass on the live floor.
  // VERCEL_ENV and an explicitly production tenant are treated as equally fatal.
  const productionSignal =
    env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' || env.AUTH0_ENV === 'production';
  const devBypass =
    allowLocalDevSession !== false &&
    !productionSignal &&
    env.AUTH0_UNAUTHENTICATED_DEV_SESSION === '1';
  if (env.AUTH0_UNAUTHENTICATED_DEV_SESSION === '1' && productionSignal) {
    console.error(
      '[auth0] AUTH0_UNAUTHENTICATED_DEV_SESSION=1 is IGNORED on a production deployment ' +
        `(NODE_ENV=${env.NODE_ENV || 'unset'}, VERCEL_ENV=${env.VERCEL_ENV || 'unset'}, AUTH0_ENV=${env.AUTH0_ENV || 'unset'}). Remove it from the platform's environment variables.`
    );
  }

  let config = resolved.config;
  if (!config && devBypass) {
    // Sign cookies with a per-process ephemeral key: no committed secret, and the
    // sessions cannot survive a restart or be forged from outside the process.
    const preset = TENANT_PRESETS[resolved.envName];
    config = {
      envName: resolved.envName,
      domain: preset.domain,
      clientId: preset.clientId,
      clientSecret: '',
      sessionSecret: crypto.randomBytes(32).toString('hex'),
      issuer: `https://${preset.domain}/`,
      devMode: true,
    };
    console.warn('[auth0] AUTH0_UNAUTHENTICATED_DEV_SESSION=1 — local developer session bypass is ACTIVE. Never enable in production.');
  }

  const middleware: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    if (!config) {
      res.status(503).json({ error: 'auth_unconfigured', reason: resolved.reason });
      return;
    }

    /* ---- /auth/login → Auth0 Universal Login (state + nonce + PKCE) ---- */
    if (path === '/auth/login') {
      if (config.devMode) {
        // No tenant credentials to redirect to; mint the local session instead.
        const session = localDevSession();
        setCookie(res, SESSION_COOKIE, sealToken(session, config.sessionSecret), {
          maxAge: SESSION_TTL_SECONDS,
          secure: isHttpsRequest(req),
          path: '/',
        });
        res.writeHead(302, { Location: safeReturnTo(req.query.returnTo), 'Cache-Control': 'no-store' });
        res.end();
        return;
      }
      const state = b64url(crypto.randomBytes(24));
      const nonce = b64url(crypto.randomBytes(24));
      const codeVerifier = b64url(crypto.randomBytes(48));
      // S256, and the verifier never leaves the server-side cookie.
      const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
      const returnTo = safeReturnTo(req.query.returnTo);

      const params = new URLSearchParams({
        client_id: config.clientId,
        response_type: 'code',
        redirect_uri: callbackUriFor(req),
        scope: env.AUTH0_SCOPE || 'openid profile email',
        state,
        nonce,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      if (env.AUTH0_AUDIENCE) params.set('audience', env.AUTH0_AUDIENCE);

      setCookie(res, OAUTH_COOKIE, sealToken({ state, nonce, codeVerifier, returnTo, exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS }, config.sessionSecret), {
        maxAge: OAUTH_STATE_TTL_SECONDS,
        secure: isHttpsRequest(req),
        path: '/auth',
      });

      res.writeHead(302, { Location: `https://${config.domain}/authorize?${params.toString()}`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    /* ---- /auth/callback → validate, then establish the session ---- */
    if (path === '/auth/callback') {
      void handleCallback(req, res, config).catch(err => {
        console.error('[auth0] callback failed:', err);
        if (!res.headersSent) {
          // 502, not a redirect back to login: an unreachable IdP must be loud,
          // and silently looping users into the login page hides the real fault.
          res.status(502).type('html').send(errorPage('Sign-in could not be completed', String(err?.message || err)));
        }
      });
      return;
    }

    /* ---- /auth/logout ---- */
    if (path === '/auth/logout') {
      setCookie(res, SESSION_COOKIE, '', { maxAge: 0, secure: isHttpsRequest(req), path: '/' });
      const params = new URLSearchParams({ client_id: config.clientId, returnTo: `${getBaseUrl(req)}/` });
      // Deliberately without `federated`: that would end the user's Google session
      // everywhere, not just here.
      res.writeHead(302, { Location: `https://${config.domain}/v2/logout?${params.toString()}`, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    /* ---- /api/session → what the browser may know. Never a token. ---- */
    if (path === '/api/session') {
      const read = readSession(req, config);
      if (read.status !== 'ok' || !read.session) {
        res.setHeader('Cache-Control', 'no-store');
        res.status(401).json({ authenticated: false, reason: read.status, login: buildLoginRedirect('/') });
        return;
      }
      const s = read.session;
      res.setHeader('Cache-Control', 'no-store');
      res.json({
        authenticated: true,
        env: config.envName,
        accessLevel: s.accessLevel,
        user: { sub: s.sub, email: s.email, name: s.name, picture: s.picture, role: s.role, teamId: s.teamId },
        expiresAt: s.exp * 1000,
      });
      return;
    }

    next();
  };

  const guard: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
    if (isPublicPath(req.path)) return next();
    if (!config) {
      res
        .status(503)
        .type('html')
        .send(
          errorPage(
            'Authentication is not configured',
            `${resolved.reason || 'No usable Auth0 credentials'}. BCFBreaks refuses all access without a verified session. Set AUTH0_CLIENT_SECRET and AUTH0_SECRET (see .env.example) and restart.`
          )
        );
      return;
    }

    const read = readSession(req, config);
    if (read.status === 'ok' && read.session) {
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    if (config.devMode) {
      // Re-mint the local session so every downstream reader (APIs, the voice
      // WebSocket, /api/session) sees one uniform, verified session.
      setCookie(res, SESSION_COOKIE, sealToken(localDevSession(), config.sessionSecret), {
        maxAge: SESSION_TTL_SECONDS,
        secure: isHttpsRequest(req),
        path: '/',
      });
      res.setHeader('Cache-Control', 'no-store');
      return next();
    }

    const isNavigation = (req.method === 'GET' || req.method === 'HEAD') && !req.path.startsWith('/api/');
    if (isNavigation) {
      res.writeHead(302, { Location: buildLoginRedirect(req.originalUrl), 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
    res.status(401).type('json').send({ error: 'unauthorized', reason: read.status, login: buildLoginRedirect(req.originalUrl) });
  };

  return { middleware, guard, config, envName: resolved.envName, configReason: resolved.reason, devMode: Boolean(config?.devMode) };
}

/* -------------------------------------------------------------- callback -- */

async function handleCallback(req: Request, res: Response, config: Auth0Config): Promise<void> {
  const query = req.query as Record<string, string | undefined>;

  // Single use: the state/nonce cookie is consumed before anything is validated, so
  // a callback URL cannot be replayed from history, a shared link, or a log.
  const statePayload = openToken<{ state: string; nonce: string; codeVerifier: string; returnTo: string; exp: number }>(
    readCookie(req, OAUTH_COOKIE),
    config.sessionSecret
  );
  setCookie(res, OAUTH_COOKIE, '', { maxAge: 0, secure: isHttpsRequest(req), path: '/auth' });

  if (query.error) {
    // Render the reason instead of bouncing back to /auth/login: redirecting there
    // would silently drop it, and an Auth0 Action rejection (`access_denied` for a
    // disallowed domain) would look like nothing happened — the user would sign in,
    // land on the login page, sign in again, and loop.
    const description = String(query.error_description || query.error || '').slice(0, 300);
    res.status(403).type('html').send(errorPage('Sign-in declined by Auth0', description));
    return;
  }
  if (!statePayload || statePayload.exp * 1000 <= Date.now()) {
    res.status(400).type('html').send(errorPage('Sign-in attempt expired', 'This login flow was not started by this browser, or it waited too long. Start again.'));
    return;
  }
  if (!query.code || query.state !== statePayload.state) {
    // A state mismatch is the CSRF signal. Refuse without explaining which half failed.
    res.status(400).type('html').send(errorPage('Sign-in rejected', 'State mismatch. No session was created.'));
    return;
  }

  const tokens = await exchangeCodeForTokens(config, {
    code: query.code,
    codeVerifier: statePayload.codeVerifier,
    redirectUri: callbackUriFor(req),
  });

  const claims = await verifyIdToken(config, tokens.id_token!, statePayload.nonce, tokens.access_token);

  const email = String(claims.email || '').toLowerCase().trim();
  if (!email) {
    // No email ⇒ no tier ⇒ refuse. Inventing one (the old `${uid}@google.auth`
    // fallback) would hand an unclassifiable identity a session.
    res
      .status(403)
      .type('html')
      .send(
        errorPage(
          'No email on this identity',
          'Your Auth0 connection did not return an email claim, so an access tier cannot be assigned. Grant the email scope and enable "Always Send Email" on the connection.'
        )
      );
    return;
  }

  const accessLevel: AccessLevel = getUserAccessLevel(email);
  const resolved = resolveSessionRole(email, accessLevel, undefined);
  if (resolved.demoted) {
    console.warn(`[auth0] ${email} maps to a privileged role by email pattern but is Preview tier — clamped to agent.`);
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const session: FloorSession = {
    sub: String(claims.sub),
    email,
    name: String(claims.name || claims.nickname || email.split('@')[0]),
    picture: claims.picture ? String(claims.picture) : undefined,
    role: resolved.role,
    teamId: resolved.teamId,
    accessLevel,
    iat: nowSec,
    exp: nowSec + SESSION_TTL_SECONDS,
  };

  setCookie(res, SESSION_COOKIE, sealToken(session, config.sessionSecret), {
    maxAge: SESSION_TTL_SECONDS,
    secure: isHttpsRequest(req),
    path: '/',
  });

  console.log(`[auth0] signed in ${email} (tier=${accessLevel}, role=${session.role})`);
  res.writeHead(302, { Location: safeReturnTo(statePayload.returnTo), 'Cache-Control': 'no-store' });
  res.end();
}
