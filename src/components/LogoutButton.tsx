"use client";

import { useState } from "react";

/**
 * Sign out flow: record the official "Shift End / Clock-Out" timestamp in the
 * database FIRST, then hit the Auth0 logout endpoint (handled by
 * auth0.middleware at /api/auth/logout) to end the session.
 */
export default function LogoutButton({ disabled = false }: { disabled?: boolean }) {
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      // Best-effort clock-out; the Auth0 sign-out proceeds either way.
      await fetch("/api/attendance/clock-out", { method: "POST" }).catch(() => {});
      window.location.href = "/api/auth/logout";
    } finally {
      // Keep the busy state — the page is navigating away.
    }
  }

  return (
    <button
      onClick={onSignOut}
      disabled={busy || disabled}
      className="inline-block w-full rounded-2xl border border-red-500/20 bg-red-500/10 px-6 py-3 text-center text-[15px] font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy ? "Clocking out..." : "Sign Out & End Shift (Clock Out)"}
    </button>
  );
}
