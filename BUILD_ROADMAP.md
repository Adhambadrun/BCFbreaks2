# BUILD ROADMAP — BREAK Master Prompt → BCFbreaks (Auth0 + Prisma)

Tracking the **30-part master prompt + 26 extra features (A–Z)** as it is ported
onto the production stack. Status legend:

- ✅ Done · 🔶 Partial/in-progress · ⬜ Not started · ➖ N/A (already covered by the existing app)

## Stack mapping (decided 2026-08-30)

The master prompt specifies **Firebase**; per user decision we stay on the
existing production stack and port the *features + design* on top:

| Master prompt | This repo |
|---|---|
| Firebase Auth + Google One Tap | Auth0 (`@auth0/nextjs-auth0`) |
| Firestore | Prisma + PostgreSQL |
| Firebase Storage | DB-backed `Asset` table (`/api/assets/[id]`) |
| Firebase Cloud Messaging | In-app toasts + (future) web push |
| 4 teams "STRIKERS" / ~40 agents | **CAI 1–5 roster (47 people)** — authoritative (`src/lib/roster.ts`) |
| `framer-motion` | added (`^11`) — `src/lib/motion-presets.ts` |

## Part status

| # | Part | Status | Notes |
|---|---|---|---|
| 1 | Project Vision & Philosophy | ➖ | Product direction; no code |
| 2 | Technology Stack | ✅ | Stack fixed by repo (Next 15 + Auth0 + Prisma); framer-motion added |
| 3 | File Structure | 🔶 | Follows existing `src/` convention, not the Firebase tree |
| 4 | Org Structure & Access Hierarchy | ✅ | Role engine (`src/lib/permissions.ts`) + CAI 1–5 roster |
| 5 | Authentication (Google One Tap) | ➖ | Auth0 flow replaces Firebase/One Tap; `/auth/login` exists |
| 6 | Visual Design System — Liquid Glass | 🔶 | Tokens + 5 tiers + specular + glow in `globals.css`; `GlassPanel` + `motion-presets` + `useReducedTransparency` added |
| 7 | Header (pixel-perfect) | ⬜ | |
| 8 | SNN Live Ticker | ⬜ | Marquee CSS exists in `globals.css` |
| 9 | Circular Agent Pod | ⬜ | |
| 10 | Hover-to-Select Break Reason Menu | ⬜ | |
| 11 | Break Start/End Animations | ⬜ | Coin-flip preset ready |
| 12 | Warning System | 🔶 | Latency engine + System Warnings exist (`policy.ts`, `Warning` model); L1/L2/L3 tiers + manual + appeal + expiry ⬜ |
| 13 | WC Punch System | ⬜ | |
| 14 | Privacy Matrix | 🔶 | Agent/self + team scoping exists; ticker copy ⬜ |
| 15 | Core Break Logic | 🔶 | Clock-in/out + 15-min leeway exists; slots/budget/capacity/bonus ⬜ |
| 16 | Supervisor/Admin Controls | 🔶 | Admin console + team mgmt exists; agent side panel + analytics ⬜ |
| 17 | Developer God Mode | 🔶 | Impersonation engine + `/admin` exist; full command deck ⬜ |
| 18 | Settings Panel | ⬜ | |
| 19 | 26 Extra Features (A–Z) | ⬜ | see matrix below |
| 20 | Firestore Schemas | ➖ | Replaced by Prisma schema (`prisma/schema.prisma`) |
| 21 | Firestore Security Rules | ➖ | Replaced by server-side role checks + `src/middleware.ts` |
| 22 | Storage Rules | ➖ | Replaced by role-gated `/api/*` routes |
| 23 | Motion & Animation System | 🔶 | Presets ported (`src/lib/motion-presets.ts`); usage across components ⬜ |
| 24 | Responsive Design | 🔶 | Existing pages are responsive; pod-grid breakpoints ⬜ |
| 25 | Profile Picture Management | ✅ | `/api/me/avatar` + `AvatarUpload` (DB-backed) |
| 26 | Deployment | ➖ | Vercel (`vercel.json` already pinned to Next.js) |
| 27 | Testing Requirements | 🔶 | `audit:roles` + `audit:e2e`; Vitest/Playwright ⬜ |
| 28 | Final Completion Checklist | ⬜ | track at end |
| 29 | RBAC Hierarchy | 🔶 | Role engine + middleware + RoleGuard exist; audit log ⬜ |
| 30 | Final Directive | ⬜ | — |

## Extra features (Part 19, A–Z)

| Feature | Status | Feature | Status |
|---|---|---|---|
| A) Multi-language (EN/AR RTL) | ⬜ | N) Daily Goal Tracker | ⬜ |
| B) Smart Push Notifications | ⬜ | O) Cairo Weather Widget | ⬜ |
| C) Shift Handover Notes | ⬜ | P) Birthday & Anniversary | ⬜ |
| D) Late Arrival / Early Departure | 🔶 | Q) Offline Mode Indicator | ⬜ |
| E) Break Request Queue | ⬜ | R) Session Recording (audit) | ⬜ |
| F) Health & Wellness | ⬜ | S) Keyboard Shortcuts | ⬜ |
| G) Leaderboards | ⬜ | T) PWA | ⬜ |
| H) Shift Replay | ⬜ | U) Analytics Export | ⬜ |
| I) Team Competitions | ⬜ | V) Dark/Light Mode | 🔶 |
| J) Private Messaging | ⬜ | W) Accessibility (WCAG AA) | 🔶 |
| K) Emergency Broadcast | ⬜ | X) Time-Based Themes | ⬜ |
| L) Break Patterns Insights | ⬜ | Y) Custom Warning Templates | ⬜ |
| M) Profile Customization | ⬜ | Z) GDPR Data Retention | ⬜ |

> Next up (document order): **Part 7 — Header**.
