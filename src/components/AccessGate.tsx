import Link from "next/link";
import BrandLogo from "./BrandLogo";

/**
 * Access verification gate — the branded modal shown when a surface requires
 * an authenticated/authorized session. Carries the official BCFbreaks logo
 * (never a generic warning shield icon).
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
    <div className="flex items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.04] p-8 text-center shadow-2xl backdrop-blur-2xl">
      <div className="flex flex-col items-center gap-3">
        <BrandLogo size={48} />
        <h1 className="text-xl font-bold text-white">{title}</h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-400">{message}</p>
        {showLoginCta && (
          <a
            href="/api/auth/login"
            className="mt-2 inline-block rounded-2xl bg-blue-600 px-6 py-3 text-[15px] font-medium text-white transition-all duration-200 hover:bg-blue-500"
          >
            Sign in with Auth0
          </a>
        )}
        {!showLoginCta && (
          <Link
            href="/"
            className="mt-2 text-xs font-medium text-sky-400 transition hover:text-sky-300"
          >
            ← Back to console
          </Link>
        )}
      </div>
    </div>
  );
}
