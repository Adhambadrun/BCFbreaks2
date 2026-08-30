# 🚨 PERMANENT AGENT INSTRUCTIONS & SYSTEM ARCHITECTURE DIRECTIVE 🚨

This document defines the non-negotiable standards, UI contracts, and structural guidelines for the Time Management system. Any AI agent, LLM assistant, or developer working on this codebase MUST strictly follow these rules.

---

## 1. VISUAL DESIGN & INTERFACE BASELINE (STRICT)
- **Source of Truth:** Refer directly to `Design.html` and `break-dashboard-template.html` in the repository root for all UI, layout, typography, glassmorphism tokens, and visual standards.
- **Design Protection:** NEVER replace the existing high-end UI with generic boilerplate, basic Tailwind components, or standard templates. 
- **Polishing Standard:** Every feature MUST be seamlessly integrated into the original premium aesthetic. Keep the UI ultra-polished, responsive, and enterprise-grade ("Super Pro").

---

## 2. BRANDING & LOGO RULES
- **Logo File:** Use the official asset located at `BCF Logo.png` in the repository root.
- **File System:** Copy/move `BCF Logo.png` directly to `/public/logo.png`.
- **Zero Placeholder Policy:** DO NOT generate code/SVG placeholder logos under any circumstances. `/public/logo.png` is the single source of truth for app headers, navigation bars, login modals, and favicons.

---

## 3. METADATA, BROWSER TAB & LOGIN QUOTE
- **Brand Wordmark:** The only text beside the logo (navbar) MUST be `"Time Management"` — no "BCFBreaks", "CONSOLE", or extra taglines.
- **Browser Tab Title:** The web app tab title MUST always display `"Time Management"`. Set this as the default title in `src/app/layout.tsx` or `index.html`.
- **Logo Color Plate:** The app palette follows the official BCF logo (black + metallic gold ≈ `#d9a749`). Brand accents (wordmark, glows, light leaks, shader) use this gold — never regress to crimson/cyan brand gradients.
- **Login Page Quote:** The Login / Access Verification UI component MUST display the following quote:
  > *"Time is more valuable than money. You can get more money, but you cannot get more time."* — **Jim Rohn**

---

## 4. MANDATORY REPOSITORY FILE MATRIX & ARCHITECTURE
All existing files uploaded to the repository root represent the visual and structural truth of the application and MUST be used/preserved:

- **UI & Dashboard Core:** `AdminDashboard.tsx`, `SupervisorDashboard.tsx`, `AgentPod.tsx`, `PodGrid.tsx`, `GlassPanel.tsx`, `GodModePanel.tsx`, `FloorAlertOverlays.tsx`, `TopHeader.tsx`
- **Entry & App Shell:** `App.tsx`, `index.html`, `index.css`, `main.tsx`, `LoginCard.tsx`, `ShaderBackground.tsx`, `SNNTicker.tsx`
- **State & Core Services:** `AppContext.tsx`, `authService.ts`, `firebase.ts`, `firestoreDb.ts`, `storage.ts`, `server.ts`
- **Widgets & Interactive Modules:** `BreakEfficiencyChart.tsx`, `MessagesPanel.tsx`, `ModalManager.tsx`, `NewsPanel.tsx`, `RoleGuard.tsx`, `SearchGroundingWidget.tsx`, `SettingsPanel.tsx`, `VoiceFloorAssistant.tsx`
- **Utilities & Config:** `firestore.rules`, `motion-presets.ts`, `sound.ts`, `firebase-applet-config.json`, `firebase-blueprint.json`, `metadata.json`, `package.json`, `bun.lock`, `tsconfig.json`, `vite.config.ts`, `index.ts`
- **Design & Brand Assets:** `Design.html`, `break-dashboard-template.html`, `BCF Logo.png`

---

## 5. FEATURE MERGE STANDARD
When introducing new functionality:
1. Preserve 100% of existing logic in state contexts and backend scripts.
2. Adapt new UI elements to match the visual architecture of `Design.html` and existing components.
3. NEVER remove core features (shift logic, developer override panels, in-app dispatchers, etc.) during updates.

---
