# Auth0 zero-trust integration — BCFbreaks

Sign-in, session, and access-tier enforcement for the sales-floor app.

## Why this is not the Next.js quickstart

The requested implementation is `@auth0/nextjs-auth0` + `src/middleware.ts` +
`src/app/*`. **This repository is not a Next.js app** — it is a Vite 6 / React 19 SPA
served by an Express server (`server.ts`), with a flat file layout. `Auth0Client`,
`auth0.getSession(request)` in middleware, and the `src/app` route files have no
runtime to execute in here, and creating them would add dead files while step 11 of
that quickstart would overwrite the real UI.

The equivalent, and for a deployed app the stronger, placement is Express middleware
mounted ahead of every route. Same protocol (OIDC authorization code + PKCE), same
hosted Universal Login, same claim validation — and the tokens stay on the server.

| Requested (Next.js) | Here |
| --- | --- |
| `src/lib/auth0.ts` — `new Auth0Client()` | `serverAuth.ts` — `createAuth()` |
| `src/middleware.ts` + `auth0.getSession(req)` | `auth.guard` + `readSession(req, config)` |
| `/auth/login`, `/auth/callback`, `/auth/logout` | identical routes, implemented in `serverAuth.ts` |
| `getUserAccessLevel(email)` | `accessLevels.ts` (shared by server and browser) |
| `useUser()` from `@auth0/nextjs-auth0/client` | `GET /api/session` → `sessionApi.ts` |
| `LoginButton` / `LoginCard` | **none on purpose** — see "Zero demo mode" |

`npx skills add auth0/agent-skills` was skipped: that skill installs the Next.js SDK,
which this project cannot load.

## Files

| File | Role |
| --- | --- |
| `serverAuth.ts` | Auth0 config resolution, `/auth/*` routes, OIDC validation, session cookie, the gate |
| `accessLevels.ts` | Policy: tiers, role mapping, tier clamp, ID sanitization. Zero deps, shared by server + client |
| `sessionApi.ts` | Browser read of `/api/session`, `beginLogin`, `beginLogout` |
| `authService.ts` | Verified session → application `User`, merged with Firestore |
| `firebase.ts` | Firestore data layer only. Firebase Auth removed |
| `LockedGate.tsx` | Pre-auth screen: no content, no sign-in card, no demo entry |
| `Profile.tsx`, `LogoutButton.tsx` | Identity card with granted tier; sign-out |
| `authcheck.ts` | `npm run check:auth` — offline crypto/policy harness (24 assertions) |
| `authlivecheck.ts` | `npm run check:auth:live` — end-to-end gate checks against a running server (21 assertions) |
| `auth0-actions/bcf-domain-tier-guard.js` | Optional Auth0 Login Action; see below |

## Access policy

| Condition | Tier | Effect |
| --- | --- | --- |
| `*@bcflights.com` | production | full floor, privileged decks |
| `adhambadraan@gmail.com` | production | developer |
| any other verified email | preview | `agent` only; admin/supervisor/developer are clamped |

The clamp is not cosmetic. `determineRoleForEmail()` assigns **admin** to any address
containing the substring `admin`, so once non-corporate domains are admitted at
preview tier, `someone-admin@gmail.com` would otherwise sign straight into the admin
deck. `resolveSessionRole()` demotes that to `agent`, and `readSession()` recomputes
role and tier from policy on **every** request, so a stale or edited cookie cannot
retain a privilege that policy no longer grants.

## Tenant configuration you must still do

Each environment uses its own tenant. For every tenant, Auth0 Dashboard →
Applications → your application → Settings → Application URIs:

| Tenant | `Allowed Callback URLs` | `Allowed Logout URLs` |
| --- | --- | --- |
| development | `http://localhost:3000/auth/callback` + your public dev origin | same hosts with `/` |
| staging | `https://<staging-host>/auth/callback` | `https://<staging-host>/` |
| production | `https://breaks.bcflights.com/auth/callback` | `https://breaks.bcflights.com/` |

Also required on each application:

- **Application type: Regular Web Application** (this is a confidential client — it
  uses the client secret server-side).
- **Allowed Origins (CORS)** is *not* needed: no browser ever calls Auth0's token
  endpoint. Add only the callback/logout URLs.
- `Auth0 → Applications → Advanced Settings → Grant Types`: Authorization Code.
  Refresh Token only if you set `AUTH0_AUDIENCE`.
- Connection settings: **Always Send Email** must be on. No email claim ⇒ no tier ⇒
  the callback refuses with 403.

When the app is reached through a proxy or a preview URL whose `Host` header is
rewritten, set `AUTH0_BASE_URL` so `redirect_uri` matches the allowlist exactly.
Without it the origin is derived from `X-Forwarded-Host`/`Host` (that is how the
sandbox preview produces `https://<preview-host>/auth/callback`).

## Secrets

`AUTH0_CLIENT_SECRET` and `AUTH0_SECRET` are read from the environment only, and
neither is ever defaulted in source or prefixed `VITE_` — a Vite variable is inlined
into the public bundle. `resolveAuth0Config()` refuses to start with a secret shorter
than 32 characters or containing `your`/`changeme`/`placeholder`/`xxx`, and the
server then answers 503 for everything rather than serving unauthenticated.

> **Rotate all six secrets supplied during setup.** Three client secrets and three
> cookie-signing keys were pasted into chat in plaintext. A leaked `AUTH0_SECRET` is
> total: it forges valid session cookies for any email, including
> `admin@bcflights.com`. Rotating it invalidates every live session, which is the
> intended effect.

## Zero demo mode

- The gate runs before `express.json()`, the AI routes, Vite's middleware and the
  static handler, so `/` and every page route are refused without a session.
- `currentUser` is **no longer restored from localStorage**. It used to be, which let
  anyone become any user by editing one key.
- The dev-only "Simulate Access" bypass in the login screen is deleted, and `LoginCard`
  is gone entirely; `LockedGate` replaces it.
- GodMode's user switcher (`loginAs`, `setUserDirectly`) now requires a *confirmed*
  production-tier admin/developer session, and logs the impersonation to the SNN ticker.
- `/live` (the billed Gemini voice stream) is refused at the HTTP upgrade, so an
  unauthenticated socket is never created.
- Deliberate exception, opt-in and off by default: `AUTH0_UNAUTHENTICATED_DEV_SESSION=1`
  mints a real developer session so the UI can be developed without a tenant. It is
  not a guest path — the gate still runs — and the branch in `createAuth()` can be
  deleted to remove it permanently.
- That bypass is refused when **any** production signal is present: `NODE_ENV`,
  `VERCEL_ENV`, or `AUTH0_ENV=production`. Vercel sets `NODE_ENV` at build time but
  does not guarantee it inside the Node.js runtime, so a stray
  `AUTH0_UNAUTHENTICATED_DEV_SESSION=1` in Vercel's Production environment variables
  could otherwise open a developer bypass on the live floor. Verified: with
  `VERCEL_ENV=production` the request 503s, no session cookie is minted, and the
  server logs that the flag is being ignored.

## Verification

```bash
npm run lint              # tsc: no new errors (vite.config.ts allowedHosts predates this work)
npm run check:auth        # 24/24 — cookie sealing, tier clamping, ID-token validation
npm run check:auth:live   # 21/21 — needs a running server; see below
npm run build
```

`check:auth` mints its own RSA keypair, so it proves the ID-token validator rejects a
wrong issuer, wrong audience, expired token, nonce mismatch, `alg:none`, HS256
algorithm confusion, and a foreign-key signature **with no network at all**.

`check:auth:live` asserts the redirect chain, the `state`/`nonce`/`S256` parameters,
cookie flags, 401s on every API, a rejected callback minting no session, and the
`/live` handshake refusal.

## Residual risk you should know about

**Gating the HTTP app does not protect the Firestore database.** `firestore.rules`
still says `allow read, write: if true` for every collection, and the browser talks to
Firestore directly with the key in `firebase-applet-config.json`. Anyone who has that
public web config can read and write breaks, warnings, messages, users and audit logs
without ever touching this gate — which means the zero-trust work above secures
*sessions and the UI*, not the data. Two fixes, pick one:

1. Move reads/writes behind the gated Express routes (`/api/*`), with the server
   enforcing tier and role — this is the real fix.
2. At minimum, tighten `firestore.rules` so writes require authentication, and accept
   that reads remain open until the client authenticates through the server.

Also open: sessions are stateless (8h TTL) with no revocation list, so a signed-out-on
*another* device stays valid here until expiry; and the `@bcflights.com`/substring
role heuristics should be replaced by the `https://bcfbreaks.com/` claims the included
Action writes.
