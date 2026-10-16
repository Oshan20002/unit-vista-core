import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

const TONES: Record<string, Tone> = {
  // generic
  Active: "success",
  Paid: "success",
  Verified: "success",
  Complete: "success",
  Occupied: "success",
  Approved: "success",
  COMPLETED: "success",
  CLOSED: "neutral",
  Inactive: "neutral",
  Draft: "neutral",
  Vacant: "warning",
  Reserved: "info",
  Upcoming: "info",
  Due: "warning",
  Pending: "warning",
  "Partially Paid": "warning",
  "Expiring Soon": "warning",
  "Notice Period": "warning",
  Missing: "warning",
  Overdue: "danger",
  Expired: "danger",
  Terminated: "danger",
  Rejected: "danger",
  "Under Maintenance": "danger",
  Emergency: "danger",
  High: "danger",
  Medium: "warning",
  Low: "neutral",
  NEW: "info",
  "UNDER REVIEW": "info",
  ASSIGNED: "accent",
  "IN PROGRESS": "warning",
  "Under Management": "accent",
  Former: "neutral",
  Deleted: "danger",
  Assigned: "accent",
  Quoted: "info",
  Requested: "warning",
  Selected: "success",
  "Awaiting landlord": "warning",
  Collecting: "info",
};

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/15 text-warning-foreground ring-warning/30",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-info/10 text-info ring-info/20",
  accent: "bg-accent/12 text-accent ring-accent/25",
};

export function StatusBadge({
  value,
  tone,
  className,
}: {
  value: string;
  tone?: Tone;
  className?: string;
}) {
  const resolved = tone ?? TONES[value] ?? "neutral";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        toneClass[resolved],
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" />
      {value}
    </span>
  );
}
