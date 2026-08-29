/**
 * Pre-auth screen. Renders nothing of substance by design: the server has already
 * 302'd a real navigation to Auth0, so this only covers the brief window while the
 * client is confirming the session, or an error state. There is no sign-in button
 * and no demo entry point here — that is the "zero demo mode" requirement.
 */
import React from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';

export const LockedGate: React.FC<{
  state: 'verifying' | 'redirecting' | 'unavailable';
  detail?: string;
}> = ({ state, detail }) => {
  const isError = state === 'unavailable';

  return (
    <div className="min-h-screen w-full bg-black flex items-center justify-center p-6 relative z-10">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-zinc-900/70 backdrop-blur-xl p-8 text-center space-y-5 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        <div className="w-14 h-14 mx-auto rounded-full border border-white/15 bg-black/60 flex items-center justify-center">
          {isError ? (
            <ShieldAlert className="w-6 h-6 text-red-400" />
          ) : (
            <Loader2 className="w-6 h-6 animate-spin text-cyan" />
          )}
        </div>

        <div>
          <h1 className="font-orbitron font-bold text-lg text-white tracking-wider">
            {isError ? 'Access verification failed' : 'Verifying session'}
          </h1>
          <p className="mt-2 text-xs text-zinc-400 font-inter leading-relaxed">
            {isError
              ? 'No Auth0 session could be verified for this browser, and BCFBreaks serves no content without one.'
              : 'BCFBreaks requires a verified Auth0 session. Unauthenticated visitors are redirected to the login page automatically.'}
          </p>
        </div>

        {detail && (
          <p className="text-[11px] text-amber-200/80 bg-amber-950/40 border border-amber-800/50 rounded-lg px-3 py-2 font-inter break-words">
            {detail}
          </p>
        )}

        {isError && (
          <button
            onClick={() => window.location.assign('/auth/login')}
            className="w-full py-2.5 rounded-xl bg-white text-zinc-900 font-inter font-semibold text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            Sign in
          </button>
        )}
      </div>
    </div>
  );
};
