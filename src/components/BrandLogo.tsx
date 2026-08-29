import Image from "next/image";

/**
 * The official BCF brand mark — /public/logo.png (single source of truth).
 * The asset itself is the uploaded squircle app icon; it is rendered unclipped
 * (rounded-xl just softens the already-rounded corners) and is used on the
 * browser tab (root layout metadata icons), the navigation bar and every
 * access-verification / login modal — never a generic warning shield icon.
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
      alt="BCF Logo"
      width={size}
      height={size}
      priority={priority}
      className={`rounded-xl ${className}`}
    />
  );
}
