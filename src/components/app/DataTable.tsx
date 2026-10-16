import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** shown as the card title on mobile */
  primary?: boolean;
  hideOnMobile?: boolean;
  align?: "left" | "right";
}

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onRowClick,
  empty,
  rowClassName,
}: {
  rows: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  /** extra classes per row (e.g. deleted rows) */
  rowClassName?: (row: T) => string | undefined;
}) {
  if (!rows.length && empty) return <>{empty}</>;

  const primary = columns.find((c) => c.primary) ?? columns[0]!;
  const rest = columns.filter((c) => c !== primary && !c.hideOnMobile);

  return (
    <>
      {/* Desktop / tablet */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "whitespace-nowrap px-3 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground",
                    c.align === "right" && "text-right",
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  "border-b border-border/70 last:border-0 transition-colors",
                  onRowClick && "cursor-pointer hover:bg-secondary/60",
                  rowClassName?.(row),
                )}
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      "px-3 py-3 align-middle text-foreground",
                      c.align === "right" && "text-right",
                      c.className,
                    )}
                  >
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            role={onRowClick ? "button" : undefined}
            tabIndex={onRowClick ? 0 : undefined}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            onKeyDown={
              onRowClick
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick(row);
                    }
                  }
                : undefined
            }
            className={cn(
              "w-full rounded-lg border border-border bg-card p-3.5 text-left",
              onRowClick && "cursor-pointer active:bg-secondary/70",
              rowClassName?.(row),
            )}
          >

            <div className="text-sm font-medium text-foreground">{primary.render(row)}</div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {rest.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.header}</dt>
                  <dd className="truncate text-sm text-foreground">{c.render(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
