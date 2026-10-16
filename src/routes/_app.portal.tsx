import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Bell, CalendarClock, FileText, Home, Plus, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { currency, formatDate } from "@/lib/format";
import { openTickets } from "@/lib/selectors";

export const Route = createFileRoute("/_app/portal")({
  head: () => ({
    meta: [
      { title: "My Home — Estora Tenant Portal" },
      { name: "description", content: "View your tenancy, rent schedule, documents and maintenance requests in the Estora tenant portal." },
      { property: "og:title", content: "My Home — Estora Tenant Portal" },
      { property: "og:description", content: "Your unit, lease, next rent payment and maintenance requests in one place." },
    ],
  }),
  component: TenantDashboard,
});

function TenantDashboard() {
  const { scoped, user } = useApp();
  const navigate = useNavigate();
  const unit = scoped.units[0];
  const property = scoped.properties[0];
  const lease = scoped.leases[0];
  const nextRent =
    scoped.rentSchedules.filter((r) => r.status !== "Paid").sort((a, b) => a.due_date.localeCompare(b.due_date))[0] ??
    scoped.rentSchedules[0];
  const open = openTickets(scoped.maintenanceTickets);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${user?.full_name.split(" ")[0]}`}
        description="Everything about your tenancy in one place."
        actions={
          <Button onClick={() => void navigate({ to: "/maintenance" })}>
            <Plus className="size-4" /> New maintenance request
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Current home" value={unit?.unit_number ?? "—"} hint={property?.name ?? "No unit assigned"} icon={Home} />
        <KpiCard
          label="Next rent"
          value={nextRent ? currency(nextRent.amount - nextRent.paid_amount) : "—"}
          hint={nextRent ? `Due ${formatDate(nextRent.due_date)}` : "No upcoming payment"}
          icon={CalendarClock}
        />
        <KpiCard label="Open requests" value={open.length} hint="Maintenance in progress" icon={Wrench} />
        <KpiCard label="Documents" value={scoped.documents.length} hint="Lease and personal files" icon={FileText} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="My tenancy" description="Current lease details" >
          {lease && unit ? (
            <dl className="space-y-3 text-sm">
              <Row label="Property" value={property?.name ?? "—"} />
              <Row label="Unit" value={`${unit.unit_number} · ${unit.unit_type}`} />
              <Row label="Lease" value={lease.lease_number} />
              <Row label="Term" value={`${formatDate(lease.start_date)} → ${formatDate(lease.end_date)}`} />
              <Row label="Monthly rent" value={currency(lease.monthly_rent)} />
              <Row label="Deposit" value={currency(lease.security_deposit)} />
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Status</dt>
                <dd>
                  <StatusBadge value={lease.status} />
                </dd>
              </div>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/leases">View full lease</Link>
              </Button>
            </dl>
          ) : (
            <EmptyState icon={Home} title="No active tenancy" description="Once your lease is activated it will appear here." />
          )}
        </SectionCard>

        <SectionCard title="Rent schedule" description="Your upcoming and past payments" padded={false}>
          <ul className="divide-y divide-border">
            {scoped.rentSchedules.length ? (
              scoped.rentSchedules.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-sm font-medium">{formatDate(r.due_date)}</p>
                    <p className="text-xs text-muted-foreground">
                      {currency(r.paid_amount)} paid of {currency(r.amount)}
                    </p>
                  </div>
                  <StatusBadge value={r.status} />
                </li>
              ))
            ) : (
              <li className="p-5">
                <EmptyState icon={CalendarClock} title="No rent records" />
              </li>
            )}
          </ul>
        </SectionCard>

        <SectionCard title="Notifications" description="Recent updates" padded={false}>
          <ul className="divide-y divide-border">
            {scoped.notifications.length ? (
              scoped.notifications.slice(0, 5).map((n) => (
                <li key={n.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                    <Bell className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{n.message}</p>
                  </div>
                </li>
              ))
            ) : (
              <li className="p-5">
                <EmptyState icon={Bell} title="No notifications" />
              </li>
            )}
          </ul>
        </SectionCard>
      </div>

      <SectionCard
        title="My maintenance requests"
        description="Track progress on reported issues"
        padded={false}
        actions={
          <Button size="sm" variant="ghost" asChild>
            <Link to="/maintenance">View all</Link>
          </Button>
        }
      >
        <ul className="divide-y divide-border">
          {scoped.maintenanceTickets.length ? (
            scoped.maintenanceTickets.map((t) => (
              <li key={t.id}>
                <Link
                  to="/maintenance/$ticketId"
                  params={{ ticketId: t.id }}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-secondary/60 sm:px-5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.reference} · {t.category} · {formatDate(t.created_at)}
                    </p>
                  </div>
                  <StatusBadge value={t.status} />
                </Link>
              </li>
            ))
          ) : (
            <li className="p-5">
              <EmptyState
                icon={Wrench}
                title="No maintenance requests"
                description="Report an issue and the property team will pick it up."
                action={
                  <Button asChild>
                    <Link to="/maintenance">New request</Link>
                  </Button>
                }
              />
            </li>
          )}
        </ul>
      </SectionCard>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
