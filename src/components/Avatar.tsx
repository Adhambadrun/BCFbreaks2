const PALETTE = [
  "bg-blue-500/20 text-blue-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-violet-500/20 text-violet-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

function initialsFor(name: string, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  const a = parts[0]?.charAt(0) ?? "?";
  const b = parts[1]?.charAt(0) ?? parts[0]?.charAt(1) ?? "";
  return (a + b).toUpperCase();
}

function paletteFor(email: string): string {
  let hash = 0;
  for (const ch of email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

export default function Avatar({
  name,
  email,
  avatarUrl,
  size = 40,
  className = "",
}: {
  name: string;
  email: string;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };

  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={avatarUrl}
        alt={`${name} avatar`}
        style={dimension}
        className={`rounded-full border border-white/10 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={dimension}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-bold ${paletteFor(
        email,
      )} ${className}`}
      aria-label={`${name} avatar`}
    >
      {initialsFor(name, email)}
    </span>
  );
}
