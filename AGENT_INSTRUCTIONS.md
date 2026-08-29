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

- `npm run build` runs `prisma generate` (no live DB needed) and then `next build`.
  Pages are `force-dynamic` / server-rendered, so build-time DB connectivity is
  not required, but the following must exist for the Prisma/Auth0 client to load
  cleanly: `DATABASE_URL`, `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`,
  `AUTH0_SECRET`, `APP_BASE_URL`. Set them in the Vercel project env, not in git.
- See `.env.example` for the full template. Never commit real secrets.
