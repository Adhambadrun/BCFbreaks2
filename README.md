# BCF Breaks — Team Breaks & Shift Management System

Live, production-ready team breaks & shift management web app for BCF Flights.
Built with **Next.js 15 (App Router) + Auth0 (nextjs-auth0 v4) + Prisma 7 (PostgreSQL) + Tailwind CSS v4**.

> **Mode: LIVE.** No demo mode, no mock pages, no guest browsing. Every request without an
> Auth0 session is intercepted at the middleware and redirected straight into the Auth0
> Universal Login at **`/api/auth/login`** (never `/auth/login` — that path does not exist in
> this app and is what caused the Vercel `404: NOT_FOUND`).

---

## Core capabilities

| Capability | Implementation |
|---|---|
| Zero-trust gate | `src/middleware.ts` — every unauthenticated request is redirected to `/api/auth/login` with a `returnTo` param. Static assets, `/api/auth/*`, `/auth/*` (legacy forwarder) and `/api/public/*` pass through. |
| **Edge-safe Auth0 (Vercel fix)** | The middleware never imports the Node-only SDK. `src/lib/edge-session.ts` re-implements the SDK's `getSession` with pure WebCrypto/`jose` (same HKDF KDF, same JWE `dir`+`A256GCM`, same `__session`/`appSession` chunked cookies), so the Edge bundle compiles with **zero CompressionStream/DecompressionStream failures**. The full SDK runs only in the Node-runtime mount `src/app/api/auth/[auth0]/route.ts`. |
| Automatic clock-in | The first authenticated render of a session opens an `Attendance` row — the official **Clocked-In / Attended** timestamp, stored in Postgres (survives reloads/redeploys), latency-stamped against the team's scheduled shift start. |
| Clock-out on sign-out | The Sign Out button first records the official **Shift End / Clock-Out** timestamp via `POST /api/attendance/clock-out`, then hits `/api/auth/logout`. Flagged-late shifts with an unsubmitted clarification automatically log a System Warning at clock-out. |
| **15-minute latency engine** | `src/lib/policy.ts` — 0–15 min late = company leeway, **no indicator rendered at all**; >15 min = automatic `LATE` flag (+1h shift penalty; 1h late requires 2h coverage) with a written clarification prompt. APPROVED → flag clears without penalty; DECLINED or never submitted → automatic official **System Warning** on the profile. |
| Pending Approvals (`/approvals`) | Clarifications route to a live queue for Admins, Supervisors and the Developer, with reviewer notes and a decision ledger (recent decisions + system warnings). |
| **In-App Email Engine** | `src/components/EmailTemplateDispatcher.tsx` → `POST /api/email/dispatch` delivers structured request emails (Swap Day, Annual/Sick Leave, WFH, Shift Change) to **attendance.cai@bcflights.com**, with the policy rules surfaced in-app and every dispatch persisted to a `RequestRecord` ledger. Uses the Resend HTTP API when `RESEND_API_KEY` is set; otherwise stores on the ledger. |
| Role engine | `src/lib/permissions.ts` — deterministic email → role resolution (see matrix below). New `@bcflights.com` users are provisioned as `AGENT` automatically; other domains become `PREVIEWER`. |
| Developer Control Panel | `adhambadraan@gmail.com` gets an in-app impersonation engine (select any user/supervisor/agent → the whole app re-renders from their point of view). Enforced server-side via an HMAC-signed cookie that is only honored for the real developer session. |
| Persistent avatars & team logos | Uploaded images are stored **in the database** (`Asset` table, `Bytes`) and served from `/api/assets/[id]` with immutable caching. `avatarUrl` / `logoUrl` are stable URLs — nothing relies on volatile local state or ephemeral disks. |
| Branding | Official uploaded `/public/logo.png` on the browser tab (`metadata.icons`: icon/shortcut/apple), the nav bar and every access-verification gate (`AccessGate` — never a generic warning shield). Tab title: **“BCF Time Management”** on all routes. Login/access gates carry the Jim Rohn quote: *“Time is more valuable than money. You can get more money, but you cannot get more time.”* |
| Admin console (`/admin`) | DEV + ADMIN manage roles, team assignments (resolves “N/A — pending assignment” for supervisors), team creation and supervision links. |
| Team views (`/team`) | Supervisors see live “on shift since” status for every member they supervise; admins/dev see all teams; agents see their own team; previewers are restricted. |

## Role matrix (verified by `npm run audit:roles`)

The canonical company roster lives in `src/lib/roster.ts` (47 people) and is the
single source of truth for the role engine, the database seed and the audits.

| Email | Role | Team |
|---|---|---|
| `adhambadraan@gmail.com` | DEV (full access + impersonation) | — |
| `meredith@bcflights.com` | ADMIN | — |
| `atlas@bcflights.com` | ADMIN | — |
| `dominick@bcflights.com` | INDEPENDENT (Independent Agent) | **CAI 1** |
| `jay@bcflights.com` | SUPERVISOR | **CAI 2** |
| `albert@bcflights.com` | SUPERVISOR | **CAI 3** |
| `watkins@bcflights.com` | SUPERVISOR | **CAI 4** |
| `amir@bcflights.com` | SUPERVISOR | **CAI 5** |
| any other `*@bcflights.com` | AGENT (automatic domain rule) | assigned by admins |
| any non-`@bcflights.com` | PREVIEWER (restricted) | — |

Team members are seeded onto their CAI teams (CAI 2–5), each led by its
supervisor; CAI 1 holds the single Independent Agent with no supervisor.

---

## Getting started (local)

```bash
npm install            # installs deps and generates the Prisma client
cp .env.example .env.local   # then fill in your tenant's values (see below)
npm run db:up          # start the embedded dev PostgreSQL (port 5432)
npm run db:init        # apply the schema (sandbox offline path)
npm run db:seed        # seed the production roster (idempotent)
npm run dev            # http://localhost:3000
```

Auth0 callback requirements — add these to the Auth0 application's **Allowed Callback URLs** /
**Allowed Logout URLs** (per environment):

```
# local
http://localhost:3000/api/auth/callback   http://localhost:3000

# production
https://bcflights.vercel.app/api/auth/callback   https://bcflights.vercel.app
```

### Environment variables (`.env.local`, gitignored — never commit credentials)

| Variable | Purpose |
|---|---|
| `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` | Tenant application credentials (development / staging / production sets are supplied by the platform secret store). |
| `AUTH0_SECRET` | 32-byte hex secret that signs/encrypts the session cookie **and** the developer impersonation cookie. Rotate per environment. |
| `APP_BASE_URL` | Absolute public origin (e.g. `http://localhost:3000` locally, or `https://bcflights.vercel.app` in production). Must match an Allowed Callback/Logout URL. |
| `DATABASE_URL` | PostgreSQL connection string. |
| `RESEND_API_KEY` (optional) | When set, `/api/email/dispatch` delivers request emails via the Resend HTTP API. When unset, dispatches are recorded on the persistent `RequestRecord` ledger. |
| `RESEND_FROM` (optional) | From-address for delivered mail (default `BCFBreaks <onboarding@resend.dev>`); the agent's address is set as `reply_to`. |

Production deploys set these in Vercel (or equivalent) encrypted environment variables per
environment — the repo never contains real credentials.

Root `vercel.json` pins **`framework: "nextjs"`** and clears `outputDirectory`. The Vercel
project was originally a Vite app (`legacy/`), so dashboard settings still looked for a
`dist/` folder after `next build` and failed with *No Output Directory named "dist"*. Do
not change that file — Next.js is served by `@vercel/next`, not as a static `dist` site.

---

## Prisma notes (why `scripts/prisma.mjs` exists)

This project uses **Prisma 7 in Rust-free mode**: the query compiler runs as WASM and all
runtime database I/O flows through the `@prisma/adapter-pg` driver adapter — **no native
engine binaries are needed at runtime**.

The Prisma CLI normally downloads a native `schema-engine` from `binaries.prisma.sh` for
schema tooling; in network-restricted environments (like this sandbox) that CDN is
unreachable. `scripts/prisma.mjs` transparently sets `PRISMA_SCHEMA_ENGINE_BINARY` so
`prisma generate` (postinstall/build) resolves locally without downloading.

- `npm run build` / `postinstall` — go through the wrapper; work offline **and** on Vercel.
- Schema creation:
  - **Local sandbox:** `npm run db:init` (applies `prisma/migrations/*.sql` over plain `pg` and
    stamps `_prisma_migrations`, producing exactly the state `migrate deploy` would).
  - **CI / production:** `npx prisma migrate deploy` (real engine; the CDN is reachable there).
- Runtime never needs the engine: `src/lib/db.ts` wires `PrismaClient` to `PrismaPg`.

## Database schema

`prisma/schema.prisma` (PostgreSQL) — `Role` enum, `User`, `Team` (with `shiftStartDefault`
for the latency engine), `Attendance` (with `scheduledStart` / `lateMinutes` /
`latencyCleared`), `ClarificationRequest`, `Warning`, `RequestRecord`, plus the `Asset`
model that gives avatars & logos a permanent, database-backed home.

---

## Audit protocol

```bash
npm run audit:roles    # role matrix, spoof hardening, middleware/edge wiring, latency policy, branding, persistence
npm run audit:e2e      # authenticated end-to-end audit vs the running server + DB (82 checks)
npm run typecheck      # zero TypeScript errors
npm run build          # zero build errors/warnings; all routes compiled (incl. Edge middleware)
```

Latest run: **all checks passed** — role matrix, spoof hardening, middleware redirects to
`/api/auth/login`, per-role dashboards, team scoping, developer impersonation,
DB-backed clock-in/clock-out, the full 15-minute latency ladder (leeway → flag →
clarification → approve/decline/auto-warn), the email engine ledger, branding assets,
avatar/logo persistence, and admin management.

## Project layout

```
src/
  middleware.ts               zero-trust gate — edge-safe, redirects to /api/auth/login
  lib/       edge-session.ts  WebCrypto-native session decryption for the Edge runtime
             policy.ts        15-minute latency engine + request policy (pure functions)
             auth0.ts         Auth0Client with /api/auth/* routes (Node runtime mount)
             permissions.ts   role engine (single source of truth)
             session.ts       session → DB user provisioning + impersonation resolution
             impersonation.ts signed impersonation cookie (DEV only)
             attendance.ts    clock-in/clock-out + automatic warning enforcement
             db.ts            Prisma client (WASM compiler + pg adapter)
  app/       page.tsx         dashboard (attendance, latency review, warnings, dev panel)
             requests/page.tsx  In-App Email Dispatcher + policy rules + dispatch ledger
             approvals/page.tsx Pending Approvals queue (privileged roles)
             team/page.tsx    role-scoped team views
             admin/page.tsx   DEV+ADMIN management console
             auth/login/page.tsx  legacy /auth/login forwarder → /api/auth/login
             api/auth/[auth0] Node-runtime SDK mount (login/logout/callback/profile)
             api/email/dispatch   request email engine → attendance.cai@bcflights.com
             api/attendance/clarification      submit written clarification
             api/clarification/[id]/decision   approve (clear flag) / decline (warn)
             api/attendance/clock-out  official clock-out (+auto warning)
             api/public/health        public liveness (middleware pass-through)
             api/dev/impersonate  POST/DELETE impersonation (dev-only)
             api/me/avatar    profile picture upload → Asset table
             api/teams/[id]/logo  team logo upload (manager/own supervisor)
             api/assets/[id]  serves stored images (immutable cache)
  components/ EmailTemplateDispatcher · LatencyClarificationCard · ApprovalsPanel ·
              AccessGate · BrandLogo · DevSimulator · AttendanceCard · LogoutButton ·
              NavBar · Avatar · AvatarUpload · TeamLogoUpload · TeamCard ·
              AdminUsersTable · CreateTeamForm · RoleBadge
prisma/      schema.prisma · migrations/ · seed.ts
scripts/     dev-db.mjs (embedded PG) · db-init.mjs · prisma.mjs (CLI wrapper) ·
             audit-roles.ts · e2e-audit.mjs
legacy/      archived previous Vite/Firebase prototype (not part of the build)
```
