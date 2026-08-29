import { ROLE_BADGE_CLASSES, ROLE_LABELS, type AppRole } from "@/lib/permissions";

export default function RoleBadge({ role }: { role: AppRole }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ROLE_BADGE_CLASSES[role]}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}
