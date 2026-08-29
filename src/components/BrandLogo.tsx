import Image from "next/image";

/**
 * The official BCFbreaks brand mark — /public/logo.png.
 * Used on the browser tab (root layout metadata icons), the navigation bar
 * and every access-verification / login modal (never a generic warning
 * shield icon).
 */
export default function BrandLogo({
  size = 48,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="BCFBreaks Logo"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-full ${className}`}
    />
  );
}
