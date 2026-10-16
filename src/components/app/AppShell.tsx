import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Bell, Building2, LogOut, Menu, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useApp } from "@/lib/app-store";
import { navFor, roleLabel } from "@/lib/nav";
import { cn } from "@/lib/utils";

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { user } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = useMemo(() => (user ? navFor(user.role) : []), [user]);

  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
      {items.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-5 py-4">
      <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
        <Building2 className="size-4.5" />
      </span>
      <div className="leading-tight">
        <p className="text-sm font-semibold text-sidebar-accent-foreground">Estora</p>
        <p className="text-[11px] text-sidebar-foreground/60">Property Asset Platform</p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, scoped, signOut, backend } = useApp();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const unread = scoped.notifications.filter((n) => !n.read).length;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const hits: { label: string; sub: string; to: string }[] = [];
    for (const p of scoped.properties)
      if (p.name.toLowerCase().includes(q)) hits.push({ label: p.name, sub: "Property", to: `/properties/${p.id}` });
    for (const t of scoped.tenants)
      if (t.full_name.toLowerCase().includes(q)) hits.push({ label: t.full_name, sub: "Tenant", to: `/tenants` });
    for (const m of scoped.maintenanceTickets)
      if (`${m.reference} ${m.title}`.toLowerCase().includes(q))
        hits.push({ label: m.title, sub: m.reference, to: `/maintenance/${m.id}` });
    return hits.slice(0, 6);
  }, [query, scoped]);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    void navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-sidebar lg:flex">
        <Brand />
        <NavList />
        <div className="border-t border-sidebar-border px-4 py-3 text-[11px] text-sidebar-foreground/60">
          {backend === "supabase" ? "Connected to Supabase" : "Demo data mode"}
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-card/95 px-3 backdrop-blur sm:px-5">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <NavList onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties, tenants, tickets…"
              className="h-9 pl-9"
            />
            {results.length > 0 ? (
              <div className="absolute left-0 right-0 top-11 z-50 overflow-hidden rounded-lg border border-border bg-popover shadow-[var(--shadow-pop)]">
                {results.map((r) => (
                  <Link
                    key={`${r.to}-${r.label}`}
                    to={r.to}
                    onClick={() => setQuery("")}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-secondary"
                  >
                    <span className="truncate">{r.label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{r.sub}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <Link
              to="/notifications"
              className="relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Notifications"
            >
              <Bell className="size-4.5" />
              {unread > 0 ? (
                <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                  {unread}
                </span>
              ) : null}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-secondary">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {user.avatar_initials}
                  </span>
                  <span className="hidden text-left leading-tight sm:block">
                    <span className="block text-sm font-medium text-foreground">{user.full_name}</span>
                    <span className="block text-[11px] text-muted-foreground">{roleLabel[user.role]}</span>
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-medium">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/settings">Profile & settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => void handleSignOut()}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-3 pb-24 pt-5 sm:px-5 lg:pb-10">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileTabs />
    </div>
  );
}

function MobileTabs() {
  const { user } = useApp();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!user) return null;
  const items = navFor(user.role).slice(0, 5);
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card/95 backdrop-blur lg:hidden">
      {items.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
              active ? "text-accent" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" />
            <span className="truncate px-1">{item.label.split(" ")[0]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export { X };
