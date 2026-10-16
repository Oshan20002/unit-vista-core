import { createFileRoute } from "@tanstack/react-router";
import { Download, FileText } from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/app/DataTable";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { useApp } from "@/lib/app-store";
import { currency, downloadCsv, percent } from "@/lib/format";
import { occupancyOf, propertyPerformance, rentTotals } from "@/lib/selectors";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Estora" },
      { name: "description", content: "Portfolio reporting on occupancy, rent collection, maintenance spend and property performance." },
      { property: "og:title", content: "Reports — Estora" },
      { property: "og:description", content: "Export-ready reporting across occupancy, income and maintenance." },
    ],
  }),
  component: ReportsPage,
});

const PIE_COLORS = ["var(--color-chart-1)", "var(--color-chart-2)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

function ReportsPage() {
  const { scoped } = useApp();
  const totals = rentTotals(scoped.rentSchedules);
  const occ = occupancyOf(scoped.units);

  const performance = useMemo(
    () =>
      propertyPerformance(scoped.properties, scoped.units, scoped.rentSchedules, scoped.expenses).map((p) => ({
        ...p,
        name: p.property.name,
        income: p.rent,
      })),
    [scoped],
  );


  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    scoped.maintenanceTickets.forEach((t) => map.set(t.category, (map.get(t.category) ?? 0) + 1));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [scoped]);

  const expensesByCategory = useMemo(() => {
    const map = new Map<string, number>();
    scoped.expenses.forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + e.amount));
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [scoped]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Portfolio health across occupancy, collections and maintenance."
        actions={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                "property-performance",
                performance.map((p) => ({
                  Property: p.name,
                  Units: p.units,
                  Occupancy: `${Math.round(p.occupancy)}%`,
                  Income: p.income,
                  Expenses: p.expenses,
                  "Net income": p.net,
                })),
              )
            }
          >
            <Download className="size-4" /> Export performance
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Occupancy" value={percent(occ.rate)} hint={`${occ.occupied}/${occ.total} units`} icon={FileText} />
        <KpiCard label="Collection rate" value={percent(totals.rate)} icon={FileText} />
        <KpiCard label="Rent collected" value={currency(totals.collected)} icon={FileText} />
        <KpiCard label="Outstanding" value={currency(totals.outstanding)} icon={FileText} />
      </div>

      <SectionCard title="Income vs expenses by property" description="Current period">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={performance}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
              <Tooltip
                formatter={(v: number) => currency(v)}
                contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
              />
              <Legend />
              <Bar dataKey="income" name="Income" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expenses" name="Expenses" fill="var(--color-chart-4)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Maintenance by category" description="Ticket volume">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={3}>
                  {byCategory.map((entry, i) => (
                    <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        <SectionCard title="Expenses by category" description="Spend distribution">
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={expensesByCategory} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="var(--color-muted-foreground)" />
                <Tooltip
                  formatter={(v: number) => currency(v)}
                  contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 12 }}
                />
                <Bar dataKey="value" name="Spend" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Property performance" description="Income, expenses and net position">
        <DataTable
          rows={performance.map((p) => ({ ...p, id: p.id }))}
          columns={[
            { key: "name", header: "Property", primary: true, render: (p) => p.name },
            { key: "units", header: "Units", render: (p) => p.units },
            { key: "occ", header: "Occupancy", render: (p) => percent(p.occupancy) },
            { key: "income", header: "Income", render: (p) => currency(p.income) },
            { key: "exp", header: "Expenses", render: (p) => currency(p.expenses) },
            { key: "net", header: "Net", render: (p) => currency(p.net) },
          ]}
        />
      </SectionCard>
    </div>
  );
}
