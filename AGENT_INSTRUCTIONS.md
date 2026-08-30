# AGENT_INSTRUCTIONS.md

Build / stability / module rules for this repository. **Every automated agent must
follow these before opening or merging a PR.** The deployment target is Vercel
(Node 22.x, npm + `package-lock.json`).

---

## 0. Absolute Code Stability Mandate

- **Zero instability tolerated.** Never open a PR or merge until the change is
  100% stable, fully tested, and production-ready.
- Before any push/PR:
  1. `npm run build` must complete with **zero** errors and **zero** warnings.
  2. `npm run typecheck` must pass.
  3. No unhandled warnings in `npm install` (especially `npm warn allow-scripts`)
     or in `next build` (especially `MODULE_TYPELESS_PACKAGE_JSON`).
- If a build, typecheck, or lifecycle-script warning appears, fix it — do not
  push "flaky" code.

---

## 1. Module system (`"type": "module"`)

- `package.json` declares **`"type": "module"`**. The project is ESM throughout
  (`import` / `export`). Do not add CommonJS `.js` files at the repo root or in
  `src/` / `scripts/` without a deliberate reason.
- Config files that must stay ESM:
  - `next.config.mjs` — Next.js config. Kept as `.mjs` so it is unambiguously
    ESM (this also silences the `MODULE_TYPELESS_PACKAGE_JSON` warning).
  - `postcss.config.mjs` — PostCSS/Tailwind v4 config.
  - `prisma.config.ts` — Prisma 7 config (loaded by the Prisma CLI).
- `scripts/*.mjs` use ESM `import`/`export` and run via `node` / `tsx`.
- `legacy/` is a **separate** package (it has its own `package.json` with
  `"type": "module"` and its own `tsconfig.json` / `bun.lock`). It is NOT built
  by Vercel and is excluded from the Next.js / Prisma toolchain. Leave it alone
  unless explicitly asked.

> Why `next.config.mjs` and not `next.config.js`? With `"type": "module"` set,
> either name works, but `.mjs` is explicit and avoids the
> `MODULE_TYPELESS_PACKAGE_JSON` Node warning entirely.

---

## 2. Lifecycle / install scripts — must be explicitly allowed

Recent npm tooling (and this repo's security setup via `@lavamoat/allow-scripts`)
blocks package lifecycle scripts (`preinstall` / `postinstall`) by default. Any
native / binary dependency that needs an install script **must** be explicitly
approved, or the Vercel build fails.

### 2a. npm path — `@lavamoat/allow-scripts` (the mechanism this repo actually uses)

- `package.json` declares `@lavamoat/allow-scripts` as a `devDependency`.
- Approval lives in `package.json` under `lavamoat.allowScripts`. **Every**
  package that ships an install script must have an entry; the ones we need are
  set to `true`:
  - `@embedded-postgres/linux-x64`
  - `@prisma/engines`
  - `esbuild` (transitive via `tsx`)
  - `prisma`
- The `build` script begins with `allow-scripts run` so the approved scripts
  (esbuild / prisma engine binaries) actually execute even when install-time
  scripts are blocked (`ignore-scripts`):
  ```json
  "build": "allow-scripts run && node scripts/prisma.mjs generate && next build"
  ```
- **Rule:** `allow-scripts run` exits with code 1 if ANY package with an install
  script is missing from `lavamoat.allowScripts`. If you add a dependency that
  has a `postinstall`/`preinstall`, run `npx allow-scripts auto` to refresh the
  allowlist, then set the new entry to `true`. Do not leave the allowlist
  incomplete — an empty/missing entry is what previously failed the Vercel deploy.

### 2b. pnpm path — `pnpm.onlyBuiltDependencies`

- For completeness (and in case the project is ever built with pnpm), the same
  four packages are listed in `package.json` under `pnpm.onlyBuiltDependencies`.
  This field is a no-op under npm but is the pnpm equivalent of §2a.
  ```json
  "pnpm": {
    "onlyBuiltDependencies": [
      "@embedded-postgres/linux-x64",
      "@prisma/engines",
      "esbuild",
      "prisma"
    ]
  }
  ```

> When adding a new native/binary package, update **both** §2a and §2b before
> committing.

### 2c. npm v12 `allowScripts` (top-level, `pkg@version` keys)

npm ≥11.16 warns (and npm v12 **blocks by default**) any dependency install
script not covered by a **top-level `allowScripts` field in `package.json`**.
This is a *different* allowlist from lavamoat's (§2a): npm reads a top-level
`"allowScripts"` object keyed as `"package-name@version"`, not the
`lavamoat.allowScripts` map keyed as `parent>child#version`.

The Vercel build log surfaces it as:

```
npm warn allow-scripts 4 packages have install scripts not yet covered by allowScripts:
npm warn allow-scripts   @prisma/engines@7.10.0 (postinstall: node scripts/postinstall.js)
...
npm warn allow-scripts Run `npm approve-scripts --allow-scripts-pending` to review, ...
```

**Enforcement:** keep the top-level `allowScripts` map in sync with §2a. When a
package's version bumps (or a new scripted dep is added), update its
`pkg@version` entry here too — otherwise npm v12 silently skips the script and
the build/deploy breaks later at runtime. Do **not** delete the field.

---

## 3. Workflow protocol for dependency / build-script changes

1. After changing dependencies, confirm `package-lock.json` is regenerated and
   in sync (`npm install` updates it; Vercel runs `npm ci` from it).
2. Validate a production build locally: `npm run build`. Treat any
   `npm warn allow-scripts` or `MODULE_TYPELESS_PACKAGE_JSON` output as a
   **failure** — it must not be pushed.
3. Run `npm run typecheck`.
4. Only then open/merge the PR.

---

## 4. Environment variables (build-time)

- **The build must succeed with ZERO environment variables set.** `next build`
  runs in an environment where runtime secrets are not guaranteed to exist
  (Vercel preview without env, CI, a fresh clone with no `.env.local`), so a
  missing var may never be a *build-time* failure. Verify with:
  ```bash
  env -u DATABASE_URL -u AUTH0_DOMAIN -u AUTH0_CLIENT_ID \
      -u AUTH0_CLIENT_SECRET -u AUTH0_SECRET -u APP_BASE_URL npm run build
  ```
- `npm run build` runs `prisma generate` (no live DB needed), then
  `scripts/migrate-if-set.mjs`, then `next build`. Pages and API routes are
  all `force-dynamic` / server-rendered (§5), so build-time DB connectivity is
  **not** required.
- `scripts/migrate-if-set.mjs` runs `npx prisma migrate deploy` **only when
  `DATABASE_URL` is set** (deployed envs), so pending migrations are applied
  automatically on every deploy and the generated client can never outrun the
  live schema. With `DATABASE_URL` unset it skips cleanly (zero-env rule
  above). If `DATABASE_URL` IS set, a `migrate deploy` failure fails the build
  by design — do not weaken that; otherwise the deploy silently ships a
  mismatched schema (same crash class as the 2026-08-30 `fullName` outage).
- These are **runtime** variables, required for real requests, and are supplied
  by the platform per environment — set in the Vercel project env (Production
  *and* Preview), never in git:
  `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
  `AUTH0_SECRET`, `APP_BASE_URL`.
- See `.env.example` for the full template. Never commit real secrets.

---

## 5. Module-scope side effects — infra clients must be LAZY

This is the rule that keeps `Collecting page data` from failing a deploy.

### 5a. Never construct `prisma` / `auth0` at module scope

`next build` imports **every** page and route module to collect its route-segment
config. An eager client in a module body runs during that import, so a runtime
concern (`DATABASE_URL` missing) becomes a build failure:

```
   Collecting page data ...
Error: DATABASE_URL is not set. ...
> Build error occurred
[Error: Failed to collect page data for /api/admin/teams]
```

**Enforcement:** `src/lib/db.ts` and `src/lib/auth0.ts` export their clients via
`createLazyClient()` (`src/lib/lazy.ts`), which defers construction to the first
real property access. Do not "simplify" either file back to a module-scope
`new PrismaClient()` / `new Auth0Client()`, and do not add a new module-scope
client, `fetch`, `fs` read, or env assertion to any file under `src/lib/` that is
imported by a route or page. Keep it lazy, or move the work inside a handler.

The proxy is a drop-in stand-in, so call sites stay unchanged
(`prisma.user.findUnique(…)` still works), and the client is memoized per
container — a new `pg` pool is never spawned per request.

### 5b. Every API route must be `force-dynamic`

**All 12 `src/app/api/**/route.ts` files carry:**
```ts
export const dynamic = "force-dynamic";
```
Server-rendered pages under `src/app/**/page.tsx` carry the same export.

Two reasons:
1. Any route handler that reads session/DB state must never be prerendered or
   statically cached — a snapshot would leak one user's state to everyone.
2. It keeps the route out of the static-generation worker entirely.

**Enforcement:** when adding a new API route, add the export in the same commit.
Check with:
```bash
test "$(find src/app/api -name route.ts | wc -l)" -eq \
     "$(grep -rl 'force-dynamic' src/app/api --include=route.ts | wc -l)" \
  && echo "all API routes are force-dynamic"
```

> Note: `force-dynamic` alone does **not** fix the build — Next still *imports*
> the module to read the config, which is what runs the eager constructor. §5a
> and §5b are both required; §5a is the load-bearing one.

---

## 6. Vercel project config (`vercel.json`) — this is a Next.js app, not Vite

This repo used to be a Vite + bun prototype (`legacy/`). The Vercel project
was created against that stack, so dashboard Build & Development Settings
still defaulted to **Framework: Vite** and **Output Directory: `dist`**.

`next build` can succeed 100% and the deploy still fails with:

```
Error: No Output Directory named "dist" found after the Build completed.
Configure the Output Directory in your Project Settings.
Alternatively, configure vercel.json#outputDirectory.
```

That error is **not** a Next.js build failure. Next.js does not emit `dist`;
the `@vercel/next` builder consumes `.next`. Looking for `dist` means Vercel
is running the static/Vite collector instead of the Next.js builder.

**Enforcement:** root `vercel.json` MUST pin the framework and clear the
leftover Vite output-dir override:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "outputDirectory": null
}
```

- `framework: "nextjs"` overrides the dashboard Framework Preset so Vercel
  uses `@vercel/next` (SSR, App Router, middleware, API routes).
- `outputDirectory: null` unsets the dashboard `dist` override. Do **not**
  set this to `".next"` — that would publish `.next` as a static site and
  break every server route.
- Do **not** set `buildCommand`. `package.json#scripts.build` already runs
  `allow-scripts run && node scripts/prisma.mjs generate && next build`;
  overriding it to bare `next build` would skip Prisma generate.
- Leave `legacy/` alone. It still has `vite.config.ts` / `bun.lock` and is
  not part of the Vercel build.

Never delete `vercel.json`. Never change `framework` away from `nextjs`.

