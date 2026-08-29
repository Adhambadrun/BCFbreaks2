import React from 'react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * App-wide crash guard. Without an error boundary, any render-phase exception
 * unmounts the entire React tree, and since <body> is bg-black the user sees a
 * fully black screen with no way to recover. This renders a styled fallback with
 * reload/reset options instead.
 */
// NOTE: this repo intentionally has no @types/react installed (React resolves to `any`),
// so `props` is declared explicitly to stay clean under tsc.
export class ErrorBoundary extends React.Component {
  declare props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[BCFBreaks] UI crash captured by ErrorBoundary:', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetAndReload = () => {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('bcf_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {
      // storage unavailable — reload anyway
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-black text-white flex items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full rounded-2xl border border-red-500/40 bg-red-950/30 p-8 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-500/15 border border-red-500/40 flex items-center justify-center">
              <span className="text-2xl">⚠️</span>
            </div>
            <h1 className="font-orbitron font-black text-2xl text-red-400 tracking-wider">SYSTEM GLITCH</h1>
            <p className="text-sm text-zinc-300 font-inter">
              The floor interface hit an unexpected error. Nothing was lost — shift data is synced.
            </p>
            {this.state.error?.message && (
              <pre className="text-left text-[10px] text-red-300/80 bg-black/60 border border-red-900/60 rounded-xl p-3 overflow-x-auto whitespace-pre-wrap max-h-36">
                {String(this.state.error.message)}
              </pre>
            )}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 rounded-xl bg-white text-zinc-900 font-inter font-semibold text-sm hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Reload App
              </button>
              <button
                onClick={this.handleResetAndReload}
                className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-200 font-inter text-xs transition-colors cursor-pointer"
              >
                Reset Local Data &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
