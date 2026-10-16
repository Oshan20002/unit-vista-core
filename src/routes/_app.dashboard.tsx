import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CircleDollarSign,
  DoorOpen,
  ScrollText,
  Wallet,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { currency, formatDate, percent } from "@/lib/format";
import { expiringLeases, occupancyOf, openTickets, rentTotals } from "@/lib/selectors";
import type { Lease, MaintenanceTicket } from "@/lib/types";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — Estora" },
      { name: "description", content: "Occupancy, rent collection, maintenance queue and lease expiries across the managed portfolio." },
      { property: "og:title", content: "Operations Dashboard — Estora" },
      { property: "og:description", content: "Live operational overview for property managers and administrators." },
    ],
  }),
  component: OperationsDashboard,
});

function OperationsDashboard() {
  const { scoped, user } = useApp();
  const navigate = useNavigate();
  const occ = occupancyOf(scoped.units);
  const rent = rentTotals(scoped.rentSchedules);
  const open = openTickets(scoped.maintenanceTickets);
  const overdueTickets = open.filter(
    (t) => t.sla_due_at && new Date(t.sla_due_at).getTime() < Date.now(),
  );
  const expiring = expiringLeases(scoped.leases);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Operations overview`}
        description={`${user?.full_name.split(" ")[0]} — here is what needs attention across ${scoped.properties.length} managed properties.`}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/maintenance">Maintenance queue</Link>
            </Button>
            <Button asChild>
              <Link to="/properties">Manage properties</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Properties" value={scoped.properties.length} hint={`${scoped.units.length} units`} icon={Building2} />
        <KpiCard label="Occupied units" value={occ.occupied} hint={percent(occ.rate)} icon={DoorOpen} />
        <KpiCard label="Vacant units" value={occ.vacant} hint="Available to lease" icon={DoorOpen} />
        <KpiCard label="Rent collected" value={currency(rent.collected)} hint={`${percent(rent.rate)} collection rate`} icon={Wallet} />
        <KpiCard label="Outstanding rent" value={currency(rent.outstanding)} hint={`${rent.overdue} overdue instalments`} icon={CircleDollarSign} />
        <KpiCard label="Open maintenance" value={open.length} hint="Tickets in progress" icon={Wrench} />
        <KpiCard label="SLA breached" value={overdueTickets.length} hint="Past target resolution" icon={AlertTriangle} />
        <KpiCard label="Expiring leases" value={expiring.length} hint="Within 60 days" icon={CalendarClock} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SectionCard
            title="Maintenance queue"
            description="Highest priority tickets first"
            padded={false}
            actions={
              <Button variant="ghost" size="sm" asChild>
                <Link to="/maintenance">View all</Link>
              </Button>
            }
          >
            <div className="px-4 pb-4 pt-2 sm:px-5">
              <DataTable<MaintenanceTicket>
                rows={open.slice(0, 6)}
                onRowClick={(t) => void navigate({ to: "/maintenance/$ticketId", params: { ticketId: t.id } })}
                empty={<EmptyState icon={Wrench} title="No open tickets" description="The maintenance queue is clear." />}
                columns={[
                  {
                    key: "ticket",
                    header: "Ticket",
                    primary: true,
                    render: (t) => (
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.reference} · {scoped.properties.find((p) => p.id === t.property_id)?.name}
                        </p>
                      </div>
                    ),
                  },
                  { key: "category", header: "Category", render: (t) => t.category },
                  { key: "priority", header: "Priority", render: (t) => <StatusBadge value={t.priority} /> },
                  { key: "status", header: "Status", render: (t) => <StatusBadge value={t.status} /> },
                  { key: "created", header: "Created", render: (t) => formatDate(t.created_at) },
                ]}
              />
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Rent collection" description="Current cycle">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Expected</dt>
                <dd className="tabular font-medium">{currency(rent.expected)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Collected</dt>
                <dd className="tabular font-medium text-success">{currency(rent.collected)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Outstanding</dt>
                <dd className="tabular font-medium text-destructive">{currency(rent.outstanding)}</dd>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success" style={{ width: `${rent.rate}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{percent(rent.rate)} of expected rent collected</p>
            </dl>
          </SectionCard>

          <SectionCard title="Lease expiries" description="Action needed soon" padded={false}>
            <div className="divide-y divide-border">
              {expiring.length ? (
                expiring.slice(0, 5).map((l: Lease) => (
                  <Link key={l.id} to="/leases" className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-secondary/60 sm:px-5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{l.lease_number}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {scoped.units.find((u) => u.id === l.unit_id)?.unit_number} ·{" "}
                        {scoped.tenants.find((t) => t.id === l.tenant_id)?.full_name}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge value={l.status} />
                      <p className="mt-1 text-xs text-muted-foreground">{formatDate(l.end_date)}</p>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="p-5">
                  <EmptyState icon={CalendarClock} title="No expiring leases" />
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard
        title="Recent activity"
        description="Latest recorded platform events"
        padded={false}
        actions={
          user?.role === "ADMIN" ? (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/audit-logs">Audit logs</Link>
            </Button>
          ) : null
        }
      >
        <ul className="divide-y divide-border">
          {scoped.auditLogs.slice(0, 6).map((log) => (
            <li key={log.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <ScrollText className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium">{log.action}</p>
                <p className="text-xs text-muted-foreground">
                  {log.user_name} · {log.entity} · {formatDate(log.at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}
