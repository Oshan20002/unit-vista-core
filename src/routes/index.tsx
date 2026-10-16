import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Building2, ClipboardCheck, LineChart, ShieldCheck, Wrench } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { homeRouteFor, useApp } from "@/lib/app-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Estora — Property Asset & Management Platform" },
      {
        name: "description",
        content:
          "Estora is a PropTech platform for property managers, landlords and tenants: portfolios, leases, rent collection, maintenance and owner approvals in one place.",
      },
      { property: "og:title", content: "Estora — Property Asset & Management Platform" },
      {
        property: "og:description",
        content:
          "Manage properties, units, leases, rent and maintenance with role-based dashboards for managers, investors and tenants.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  { icon: Building2, title: "Portfolio control", body: "Properties, buildings and units with live occupancy across every asset." },
  { icon: LineChart, title: "Investor reporting", body: "Rent collected, expenses, management fees and net income per owner." },
  { icon: Wrench, title: "Maintenance workflow", body: "Tickets from NEW to CLOSED with vendors, SLA timers and timelines." },
  { icon: ClipboardCheck, title: "Owner approvals", body: "Spend above an owner's threshold routes for approval automatically." },
];

function Landing() {
  const { user, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) void navigate({ to: homeRouteFor(user.role), replace: true });
  }, [loading, user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Building2 className="size-4.5" />
          </span>
          <span className="text-base font-semibold">Estora</span>
        </div>
        <Button asChild size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-20">
        <section className="pt-12 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="size-3.5 text-accent" /> Phase 1 MVP · role-based access
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            The property asset platform for managers, landlords and residents.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            One system for the full journey — owner to property, unit, tenant, lease, rent, maintenance,
            expense, owner approval and reporting.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth">
                Enter the platform <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary text-secondary-foreground">
                <f.icon className="size-4.5" />
              </span>
              <h2 className="mt-4 text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
