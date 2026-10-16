import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, LayoutGrid, List, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { currency, formatDate, percent } from "@/lib/format";
import { occupancyOf } from "@/lib/selectors";
import type { PropertyStatus, PropertyType } from "@/lib/types";

export const Route = createFileRoute("/_app/properties/")({
  head: () => ({
    meta: [
      { title: "Properties — Estora" },
      { name: "description", content: "Search, filter and manage every property, building and unit in the portfolio." },
      { property: "og:title", content: "Properties — Estora" },
      { property: "og:description", content: "Property register with occupancy, ownership and status at a glance." },
    ],
  }),
  component: PropertiesPage,
});

const TYPES: PropertyType[] = ["Apartment", "Villa", "House", "Building", "Commercial", "Other"];
const STATUSES: PropertyStatus[] = ["Active", "Inactive", "Under Management"];

function PropertiesPage() {
  const { scoped, owners, addProperty, user } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [view, setView] = useState<"table" | "cards">("table");
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";

  const [form, setForm] = useState({
    name: "",
    type: "Apartment" as PropertyType,
    address: "",
    city: "Dubai",
    country: "United Arab Emirates",
    owner_id: "",
    status: "Active" as PropertyStatus,
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.properties
      .filter((p) => (type === "all" ? true : p.type === type))
      .filter((p) => (status === "all" ? true : p.status === status))
      .filter((p) => (q ? `${p.name} ${p.city} ${p.address}`.toLowerCase().includes(q) : true))
      .map((p) => {
        const pUnits = scoped.units.filter((u) => u.property_id === p.id);
        const occ = occupancyOf(pUnits);
        return {
          ...p,
          buildings: scoped.buildings.filter((b) => b.property_id === p.id).length,
          unitCount: pUnits.length,
          occupancy: occ.rate,
          rent: pUnits.filter((u) => u.status === "Occupied").reduce((s, u) => s + u.monthly_rent, 0),
          ownerName: scoped.owners.find((o) => o.id === p.owner_id)?.full_name ?? "—",
        };
      });
  }, [scoped, query, type, status]);

  const submit = () => {
    if (form.name.trim().length < 3) {
      toast.error("Property name must be at least 3 characters.");
      return;
    }
    if (form.address.trim().length < 4) {
      toast.error("Please enter the property address.");
      return;
    }
    const ownerId = form.owner_id || owners[0]?.id;
    if (!ownerId || !owners.some((o) => o.id === ownerId)) {
      toast.error("Please choose an owner. Add a landlord on the Owners page first if the list is empty.");
      return;
    }
    const created = addProperty({ ...form, owner_id: ownerId, manager_id: user?.id ?? "" });
    setOpen(false);
    toast.success(`${created.name} added to the portfolio.`);
    void navigate({ to: "/properties/$propertyId", params: { propertyId: created.id } });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={user?.role === "LANDLORD" ? "My properties" : "Properties"}
        description="The register of every asset under management, with live occupancy."
        actions={
          <>
            <div className="flex rounded-lg border border-border bg-card p-0.5">
              <Button variant={view === "table" ? "secondary" : "ghost"} size="sm" onClick={() => setView("table")}>
                <List className="size-4" />
              </Button>
              <Button variant={view === "cards" ? "secondary" : "ghost"} size="sm" onClick={() => setView("cards")}>
                <LayoutGrid className="size-4" />
              </Button>
            </div>
            {canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add property
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Search by name, city or address" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No properties found"
          description="Try clearing the filters, or add the first property to this portfolio."
          action={
            canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add property
              </Button>
            ) : null
          }
        />
      ) : view === "cards" ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => void navigate({ to: "/properties/$propertyId", params: { propertyId: p.id } })}
              className="rounded-xl border border-border bg-card p-5 text-left shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-pop)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.type} · {p.city}, {p.country}
                  </p>
                </div>
                <StatusBadge value={p.status} />
              </div>
              <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Units</dt>
                  <dd className="tabular font-medium">{p.unitCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Occupancy</dt>
                  <dd className="tabular font-medium">{percent(p.occupancy)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Monthly rent</dt>
                  <dd className="tabular font-medium">{currency(p.rent)}</dd>
                </div>
              </dl>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-success" style={{ width: `${p.occupancy}%` }} />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)] sm:p-5">
          <DataTable
            rows={rows}
            onRowClick={(p) => void navigate({ to: "/properties/$propertyId", params: { propertyId: p.id } })}
            columns={[
              {
                key: "name",
                header: "Property",
                primary: true,
                render: (p) => (
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.address}, {p.city}
                    </p>
                  </div>
                ),
              },
              { key: "type", header: "Type", render: (p) => p.type },
              { key: "owner", header: "Owner", render: (p) => p.ownerName },
              { key: "buildings", header: "Buildings", render: (p) => p.buildings },
              { key: "units", header: "Units", render: (p) => p.unitCount },
              { key: "occupancy", header: "Occupancy", render: (p) => percent(p.occupancy) },
              { key: "status", header: "Status", render: (p) => <StatusBadge value={p.status} /> },
              { key: "created", header: "Created", hideOnMobile: true, render: (p) => formatDate(p.created_at) },
            ]}
          />
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add property</DialogTitle>
            <DialogDescription>Register a new asset and assign it to an owner.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">Property name</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Marina Crest Residences" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Property type</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as PropertyType })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as PropertyStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-address">Address</Label>
              <Input id="p-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Al Marsa Street, Plot 41" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-city">City</Label>
                <Input id="p-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-country">Country</Label>
                <Input id="p-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Select value={form.owner_id || owners[0]?.id || ""} onValueChange={(v) => setForm({ ...form, owner_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="No owners yet — add one on the Owners page" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Create property</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
