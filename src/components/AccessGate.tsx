import Link from "next/link";
import BrandLogo from "./BrandLogo";

/**
 * Access verification gate — the branded login/verification modal shown when a
 * surface requires an authenticated or authorized session. Carries the
 * official BCFbreaks logo (never a generic warning shield icon) and the
 * company's time-management motto.
 */
export default function AccessGate({
  title,
  message,
  showLoginCta = false,
}: {
  title: string;
  message: React.ReactNode;
  showLoginCta?: boolean;
}) {
  return (
    <div className="liquid-glass--thick w-full max-w-md p-8 text-center shadow-[0_0_80px_rgba(0,0,0,0.85)]">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo
          size={56}
          className="glow-gold ring-1 ring-gold/40"
        />
        <h1 className="bg-gradient-to-r from-gold via-amber-200 to-gold bg-clip-text font-display text-xl font-black tracking-wide text-transparent">
          {title}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-zinc-400">{message}</p>
        {showLoginCta && (
          <a
            href="/api/auth/login"
            className="mt-2 inline-block rounded-2xl bg-gradient-to-r from-gold to-amber-500 px-6 py-3 font-display text-[13px] font-bold uppercase tracking-widest text-black shadow-[0_0_25px_rgba(217,167,73,0.4)] transition-all duration-200 hover:shadow-[0_0_40px_rgba(217,167,73,0.6)] hover:brightness-110"
          >
            Sign in with Auth0
          </a>
        )}
        {!showLoginCta && (
          <Link
            href="/"
            className="mt-2 font-display text-[11px] font-semibold uppercase tracking-widest text-cyan-300 transition hover:text-cyan-200"
          >
            ← Back to console
          </Link>
        )}

        <blockquote className="mt-4 w-full max-w-md rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/[0.08] to-transparent p-4 shadow-[0_0_30px_rgba(217,167,73,0.14)]">
          <p className="text-[13px] italic leading-relaxed text-amber-100/90">
            &ldquo;Time is more valuable than money. You can get more money, but you cannot get
            more time.&rdquo;
          </p>
          <footer className="mt-2 font-display text-[10px] font-semibold uppercase tracking-widest text-gold/80">
            — Jim Rohn
          </footer>
        </blockquote>
      </div>
    </div>
  );
}
