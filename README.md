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
| Zero-trust gate | `src/middleware.ts` — every unauthenticated request is redirected to `/api/auth/login` with a `returnTo` param. Auth routes are served by `auth0.middleware()` (SDK v4 architecture). |
| Automatic clock-in | The first authenticated render of a session opens an `Attendance` row — the official **Clocked-In / Attended** timestamp, stored in Postgres (survives reloads/redeploys). |
| Clock-out on sign-out | The Sign Out button first records the official **Shift End / Clock-Out** timestamp via `POST /api/attendance/clock-out`, then hits `/api/auth/logout`. |
| Role engine | `src/lib/permissions.ts` — deterministic email → role resolution (see matrix below). New `@bcflights.com` users are provisioned as `AGENT` automatically; other domains become `PREVIEWER`. |
| Developer Control Panel | `adhambadraan@gmail.com` gets an in-app impersonation engine (select any user/supervisor/agent → the whole app re-renders from their point of view). Enforced server-side via an HMAC-signed cookie that is only honored for the real developer session. |
| Persistent avatars & team logos | Uploaded images are stored **in the database** (`Asset` table, `Bytes`) and served from `/api/assets/[id]` with immutable caching. `avatarUrl` / `logoUrl` are stable URLs — nothing relies on volatile local state or ephemeral disks. |
| Admin console (`/admin`) | DEV + ADMIN manage roles, team assignments (resolves “N/A — pending assignment” for supervisors), team creation and supervision links. |
| Team views (`/team`) | Supervisors see live “on shift since” status for every member they supervise; admins/dev see all teams; agents see their own team; previewers are restricted. |

## Role matrix (verified by `npm run audit:roles`)

| Email | Role | Team |
|---|---|---|
| `adhambadraan@gmail.com` | DEV (full access + impersonation) | — |
| `meredith@bcflights.com` | ADMIN | — |
| `atlas@bcflights.com` | ADMIN | — |
| `jolene@bcflights.com` | ADMIN | — |
| `naomi@bcflights.com` | ADMIN | — |
| `jay@bcflights.com` | SUPERVISOR | **Strikers** |
| `watkins@bcflights.com` | SUPERVISOR | **Wizards** |
| `albert@bcflights.com` | SUPERVISOR | *N/A — pending assignment (assign in `/admin`)* |
| `amir@bcflights.com` | SUPERVISOR | *N/A — pending assignment (assign in `/admin`)* |
| any other `*@bcflights.com` | AGENT (automatic domain rule) | assigned by admins |
| any non-`@bcflights.com` | PREVIEWER (restricted) | — |

Seeded Strikers agents: solomon, zayn, leo, lamar, fabiola, shay, wesley, eric, thomas.

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
http://localhost:3000/api/auth/callback   http://localhost:3000
```

### Environment variables (`.env.local`, gitignored — never commit credentials)

| Variable | Purpose |
|---|---|
| `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` / `AUTH0_CLIENT_SECRET` | Tenant application credentials (development / staging / production sets are supplied by the platform secret store). |
| `AUTH0_SECRET` | 32-byte hex secret that signs/encrypts the session cookie **and** the developer impersonation cookie. Rotate per environment. |
| `APP_BASE_URL` | Absolute public origin (e.g. `http://localhost:3000`, or the Vercel URL). Must match an Allowed Callback/Logout URL. |
| `DATABASE_URL` | PostgreSQL connection string. |

Production deploys set these in Vercel (or equivalent) encrypted environment variables per
environment — the repo never contains real credentials.

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

`prisma/schema.prisma` (PostgreSQL) — `Role` enum, `User`, `Team`, `Attendance` exactly as
specified, plus the `Asset` model that gives avatars & logos a permanent, database-backed
home.

---

## Audit protocol

```bash
npm run audit:roles    # role matrix, spoof hardening, middleware wiring, persistence invariants
npm run audit:e2e      # authenticated end-to-end audit vs the running server + DB (48 checks)
npm run typecheck      # zero TypeScript errors
npm run build          # zero build errors; all routes compiled
```

Latest run: **all checks passed** — role matrix, spoof hardening, middleware redirects to
`/api/auth/login`, per-role dashboards, team scoping, developer impersonation,
DB-backed clock-in/clock-out, avatar/logo persistence, and admin management.

## Project layout

```
src/
  middleware.ts               zero-trust gate (redirects to /api/auth/login)
  lib/       auth0.ts         Auth0Client with /api/auth/* routes
             permissions.ts   role engine (single source of truth)
             session.ts       session → DB user provisioning + impersonation resolution
             impersonation.ts signed impersonation cookie (DEV only)
             attendance.ts    clock-in/clock-out helpers
             db.ts            Prisma client (WASM compiler + pg adapter)
  app/       page.tsx         dashboard (attendance card, dev panel, profile)
             team/page.tsx    role-scoped team views
             admin/page.tsx   DEV+ADMIN management console
             api/auth/[auth0] structural handler (SDK v4 serves routes via middleware)
             api/dev/impersonate  POST/DELETE impersonation (dev-only)
             api/attendance/clock-out  official clock-out
             api/me/avatar    profile picture upload → Asset table
             api/teams/[id]/logo  team logo upload (manager/own supervisor)
             api/assets/[id]  serves stored images (immutable cache)
  components/ DevSimulator · AttendanceCard · LogoutButton · NavBar · Avatar ·
              AvatarUpload · TeamLogoUpload · TeamCard · AdminUsersTable · CreateTeamForm
prisma/      schema.prisma · migrations/ · seed.ts
scripts/     dev-db.mjs (embedded PG) · db-init.mjs · prisma.mjs (CLI wrapper) · audit-roles.ts
legacy/      archived previous Vite/Firebase prototype (not part of the build)
```
