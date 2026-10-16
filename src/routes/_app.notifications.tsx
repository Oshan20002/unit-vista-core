import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Estora" },
      { name: "description", content: "Rent, maintenance, approval and lease alerts tailored to your role." },
      { property: "og:title", content: "Notifications — Estora" },
      { property: "og:description", content: "Stay across rent, maintenance and approval activity in real time." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { scoped, markNotificationRead, markAllNotificationsRead } = useApp();
  const navigate = useNavigate();
  const unread = scoped.notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread updates` : "You're all caught up."}
        actions={
          unread ? (
            <Button variant="outline" onClick={markAllNotificationsRead}>
              <CheckCheck className="size-4" /> Mark all read
            </Button>
          ) : null
        }
      />

      <SectionCard padded={false}>
        {scoped.notifications.length ? (
          <ul className="divide-y divide-border">
            {[...scoped.notifications]
              .sort((a, b) => b.created_at.localeCompare(a.created_at))
              .map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      if (n.href) void navigate({ href: n.href });
                    }}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-secondary/60 sm:px-5",
                      !n.read && "bg-primary/[0.04]",
                    )}
                  >
                    <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                      <Bell className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{n.title}</p>
                        <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">{n.type}</span>
                        {!n.read ? <span className="size-2 rounded-full bg-primary" /> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(n.created_at)}</p>
                    </div>
                    {n.href ? <ChevronRight className="mt-2 size-4 shrink-0 text-muted-foreground" /> : null}
                  </button>
                </li>
              ))}
          </ul>
        ) : (
          <div className="p-5">
            <EmptyState icon={Bell} title="No notifications" description="Alerts about rent, maintenance and approvals will appear here." />
          </div>
        )}
      </SectionCard>
    </div>
  );
}
