import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  ClipboardCheck,
  DoorOpen,
  Layers,
  PiggyBank,
  Receipt,
  TrendingUp,
  Wrench,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { compactCurrency, currency, formatDate, percent } from "@/lib/format";
import {
  monthlyTrend,
  occupancyOf,
  occupancyTrend,
  openTickets,
  pendingApprovals,
  propertyPerformance,
  rentTotals,
} from "@/lib/selectors";
import type { MaintenanceTicket } from "@/lib/types";

export const Route = createFileRoute("/_app/investor")({
  head: () => ({
    meta: [
      { title: "Investor Dashboard — Estora" },
      { name: "description", content: "Portfolio performance for landlords: occupancy, rental income, expenses, net income and pending approvals." },
      { property: "og:title", content: "Investor Dashboard — Estora" },
      { property: "og:description", content: "Track your rental portfolio income, expenses and maintenance in real time." },
    ],
  }),
  component: InvestorDashboard,
});

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

function InvestorDashboard() {
  const { scoped, user, decideApproval } = useApp();
  const navigate = useNavigate();
  const occ = occupancyOf(scoped.units);
  const rent = rentTotals(scoped.rentSchedules);
  const expenseTotal = scoped.expenses.reduce((s, e) => s + e.amount, 0);
  const net = rent.collected - expenseTotal;
  const approvals = pendingApprovals(scoped.approvals);
  const open = openTickets(scoped.maintenanceTickets);
  const performance = propertyPerformance(scoped.properties, scoped.units, scoped.rentSchedules, scoped.expenses);
  const trend = monthlyTrend(rent.collected, expenseTotal);
  const occTrend = occupancyTrend(occ.rate);

  const chartTooltip = {
    contentStyle: {
      borderRadius: 12,
      border: "1px solid var(--border)",
      background: "var(--popover)",
      color: "var(--popover-foreground)",
      fontSize: 12,
    },
  } as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greeting()}, ${user?.full_name.split(" ")[0]}`}
        description="Your portfolio at a glance — income, costs and everything awaiting your decision."
        actions={
          <Button asChild>
            <Link to="/approvals">Review approvals</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Portfolio" value={scoped.properties.length} hint="Properties owned" icon={Building2} />
        <KpiCard label="Total units" value={scoped.units.length} hint={`${occ.occupied} let`} icon={Layers} />
        <KpiCard label="Occupancy" value={percent(occ.rate)} hint={`${occ.occupied} occupied · ${occ.vacant} vacant`} icon={DoorOpen} />
        <KpiCard label="Monthly rent" value={currency(rent.collected)} hint="Collected this cycle" icon={PiggyBank} />
        <KpiCard label="Expenses" value={currency(expenseTotal)} hint="Maintenance, fees, insurance" icon={Receipt} />
        <KpiCard label="Net income" value={currency(net)} hint="Rent minus expenses" icon={TrendingUp} />
        <KpiCard label="Pending approvals" value={approvals.length} hint="Awaiting your decision" icon={ClipboardCheck} />
        <KpiCard label="Open maintenance" value={open.length} hint="Active tickets" icon={Wrench} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Rental income vs expenses" description="Last six months">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickFormatter={(v: number) => compactCurrency(v)} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => currency(v)} {...chartTooltip} />
                <Bar dataKey="income" name="Income" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expense" name="Expenses" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Net income trend" description="Rent collected minus operating costs">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: -12, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <YAxis tickFormatter={(v: number) => compactCurrency(v)} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
                <Tooltip formatter={(v: number) => currency(v)} {...chartTooltip} />
                <Area dataKey="net" name="Net income" stroke="var(--chart-2)" strokeWidth={2} fill="url(#netFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Occupancy trend" description="Portfolio-wide occupancy rate">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={occTrend} margin={{ left: -20, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} fontSize={12} stroke="var(--muted-foreground)" />
              <Tooltip formatter={(v: number) => `${v}%`} {...chartTooltip} />
              <Line dataKey="occupancy" name="Occupancy" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title="My properties" description="Performance by asset" padded={false}>
        <div className="px-4 py-4 sm:px-5">
          <DataTable
            rows={performance}
            onRowClick={(row) => void navigate({ to: "/properties/$propertyId", params: { propertyId: row.id } })}
            empty={<EmptyState icon={Building2} title="No properties yet" description="Properties assigned to you will appear here." />}
            columns={[
              {
                key: "property",
                header: "Property",
                primary: true,
                render: (r) => (
                  <div>
                    <p className="font-medium">{r.property.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.property.type} · {r.property.city}
                    </p>
                  </div>
                ),
              },
              { key: "units", header: "Units", render: (r) => r.units },
              { key: "occupancy", header: "Occupancy", render: (r) => percent(r.occupancy) },
              { key: "rent", header: "Monthly rent", align: "right", render: (r) => <span className="tabular">{currency(r.rent)}</span> },
              { key: "expenses", header: "Expenses", align: "right", render: (r) => <span className="tabular">{currency(r.expenses)}</span> },
              { key: "net", header: "Net income", align: "right", render: (r) => <span className="tabular font-medium">{currency(r.net)}</span> },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.property.status} /> },
            ]}
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Pending approvals" description="Maintenance spend above your threshold" padded={false}>
          <div className="divide-y divide-border">
            {approvals.length ? (
              approvals.map((a) => (
                <div key={a.id} className="p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {scoped.properties.find((p) => p.id === a.property_id)?.name} ·{" "}
                        {scoped.units.find((u) => u.id === a.unit_id)?.unit_number} · {formatDate(a.requested_at)}
                      </p>
                    </div>
                    <p className="tabular text-sm font-semibold">{currency(a.amount)}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        decideApproval(a.id, "Approved");
                        toast.success(`Approved ${a.reference}`);
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        decideApproval(a.id, "Rejected", "Rejected from dashboard");
                        toast.message(`Rejected ${a.reference}`);
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-5">
                <EmptyState icon={ClipboardCheck} title="Nothing to approve" description="You're all caught up on maintenance spend requests." />
              </div>
            )}
          </div>
        </SectionCard>

        <SectionCard title="Recent maintenance" description="Across your portfolio" padded={false}>
          <div className="px-4 py-4 sm:px-5">
            <DataTable<MaintenanceTicket>
              rows={scoped.maintenanceTickets.slice(0, 5)}
              onRowClick={(t) => void navigate({ to: "/maintenance/$ticketId", params: { ticketId: t.id } })}
              empty={<EmptyState icon={Wrench} title="No maintenance activity" />}
              columns={[
                {
                  key: "ticket",
                  header: "Ticket",
                  primary: true,
                  render: (t) => (
                    <div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.reference}</p>
                    </div>
                  ),
                },
                { key: "category", header: "Category", render: (t) => t.category },
                { key: "priority", header: "Priority", render: (t) => <StatusBadge value={t.priority} /> },
                { key: "status", header: "Status", render: (t) => <StatusBadge value={t.status} /> },
                { key: "date", header: "Date", render: (t) => formatDate(t.created_at) },
              ]}
            />
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
