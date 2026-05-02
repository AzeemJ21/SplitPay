import { cn } from "@/lib/utils";

type BadgeKind =
  | "pending"
  | "completed"
  | "failed"
  | "active"
  | "under_review"
  | "open"
  | "resolved"
  | "submitted"
  | "funded"
  | "in_progress"
  | "released";

const VARIANTS: Record<string, string> = {
  pending: "border-yellow-500/20 bg-yellow-500/10 text-yellow-400",
  completed: "border-green-500/20 bg-green-500/10 text-green-400",
  released: "border-green-500/20 bg-green-500/10 text-green-400",
  resolved: "border-green-500/20 bg-green-500/10 text-green-400",
  failed: "border-red-500/20 bg-red-500/10 text-red-400",
  open: "border-red-500/20 bg-red-500/10 text-red-400",
  active: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  funded: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  in_progress: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  under_review: "border-blue-500/20 bg-blue-500/10 text-blue-400",
  submitted: "border-blue-500/20 bg-blue-500/10 text-blue-400",
};

function normalizeStatus(status: string): string {
  const s = status.toLowerCase().replace(/\s+/g, "_");
  if (s === "under review") return "under_review";
  return s;
}

export function StatusBadge({
  status,
  className,
}: {
  status: string;
  type?: string;
  className?: string;
}) {
  const key = normalizeStatus(status);
  const styles = VARIANTS[key] ?? "border-border-default bg-bg-card text-text-secondary";
  const label =
    key === "under_review"
      ? "Under Review"
      : key === "in_progress"
        ? "In Progress"
        : status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors duration-200",
        styles,
        className,
      )}
    >
      {label}
    </span>
  );
}
