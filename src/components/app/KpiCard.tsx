import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  trend?: { value: string; direction: "up" | "down" | "flat" };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-pop)] sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="grid size-8 place-items-center rounded-lg bg-secondary text-secondary-foreground">
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <p className="tabular mt-3 text-2xl font-semibold text-foreground sm:text-[1.75rem]">{value}</p>
      <div className="mt-1 flex items-center gap-2">
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
        {trend ? (
          <span
            className={cn(
              "text-xs font-medium",
              trend.direction === "up"
                ? "text-success"
                : trend.direction === "down"
                  ? "text-destructive"
                  : "text-muted-foreground",
            )}
          >
            {trend.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}
