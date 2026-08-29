import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { GlassPanel } from '../shared/GlassPanel';
import { Loader2, ShieldCheck, AlertCircle } from 'lucide-react';
import { initGoogleOneTap } from '../../lib/authService';

export const LoginCard: React.FC = () => {
  const { loginWithGoogle, setUserDirectly } = useApp();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Automatically trigger Google One Tap on mount
    initGoogleOneTap(
      (authenticatedUser) => {
        setIsAuthenticating(false);
        setUserDirectly(authenticatedUser);
      },
      (err) => {
        console.warn('Google One Tap suppressed or unavailable:', err);
      }
    );
  }, [setUserDirectly]);

  const handleGoogleClick = async () => {
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setAuthError(err?.message || 'Google Sign-in failed. Please ensure you are using an authorized @bcflights.com email.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative z-10">
      <GlassPanel
        material="thick"
        concentricRadius="xl"
        className="w-full max-w-sm p-8 border border-white/20 shadow-[0_0_80px_rgba(0,0,0,0.85)] text-center space-y-6"
      >
        {/* Animated Brand Header */}
        <div>
          <div className="w-20 h-20 mx-auto rounded-full overflow-hidden border-2 border-crimson/80 shadow-[0_0_30px_rgba(255,0,60,0.6)] mb-4">
            <img
              src="https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80"
              alt="BCFBreaks"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>

          <h1 className="font-orbitron font-black text-3xl text-transparent bg-clip-text bg-gradient-to-r from-crimson via-orange-400 to-yellow-400 tracking-wider">
            BCFBreaks
          </h1>

          {/* Domain Restriction Badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan/10 border border-cyan/30 text-cyan text-[11px] font-orbitron font-medium tracking-wide">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan shrink-0" />
            <span>Domain: @bcflights.com</span>
          </div>

          <p className="text-xs text-zinc-400 font-inter mt-2">
            Sign in with your organization <span className="text-white font-medium">name@bcflights.com</span> Google account.
          </p>
        </div>

        {/* Primary Direct Google Sign-In Trigger */}
        <div className="space-y-3 pt-2">
          {/* Target for Google Identity Services GSI button if rendered */}
          <div id="google-signin-button" className="min-h-[44px] flex justify-center w-full empty:hidden" />

          <button
            onClick={handleGoogleClick}
            disabled={isAuthenticating}
            className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-xl bg-white text-zinc-900 hover:bg-zinc-100 font-inter font-semibold text-sm shadow-[0_0_25px_rgba(255,255,255,0.25)] transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
          >
            {isAuthenticating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-zinc-700" />
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                {/* Official Google 'G' Logo */}
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Sign in with @bcflights.com</span>
              </>
            )}
          </button>

          {authError && (
            <div className="w-full text-xs text-red-300 bg-red-950/60 border border-red-800/80 p-3 rounded-xl text-left flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
};


