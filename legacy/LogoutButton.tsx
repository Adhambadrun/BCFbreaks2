/**
 * Sign-out.
 *
 * Adapted from the requested `src/components/LogoutButton.tsx`. Same destination
 * (`/auth/logout`), but rendered as a button that posts the navigation rather than a
 * bare `<a>`: `/auth/logout` must not be reachable by a prefetch or a crawler, and a
 * click handler lets the floor clear local session state first (see `logout()` in
 * `AppContext.tsx`), which an anchor would skip.
 */
import React from 'react';
import { LogOut } from 'lucide-react';
import { useApp } from './AppContext';

export const LogoutButton: React.FC = () => {
  const { logout } = useApp();

  return (
    <button
      onClick={() => void logout()}
      className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-black/40 border border-white/10 text-zinc-300 hover:text-red-300 hover:border-red-500/40 hover:bg-red-950/30 font-inter text-xs font-medium transition-all cursor-pointer"
    >
      <LogOut className="w-3.5 h-3.5" />
      Sign out
    </button>
  );
};

export default LogoutButton;
