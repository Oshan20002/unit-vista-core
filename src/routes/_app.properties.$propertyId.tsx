import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Building2, DoorOpen, Plus, Wrench } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { currency, formatDate, percent } from "@/lib/format";
import { occupancyOf } from "@/lib/selectors";
import type { UnitStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/properties/$propertyId")({
  head: () => ({
    meta: [
      { title: "Property details — Estora" },
      { name: "description", content: "Buildings, units, tenants, maintenance and documents for a single property." },
      { property: "og:title", content: "Property details — Estora" },
      { property: "og:description", content: "A complete operational view of one property in the portfolio." },
    ],
  }),
  component: PropertyDetail,
});

const UNIT_STATUSES: UnitStatus[] = ["Occupied", "Vacant", "Reserved", "Under Maintenance", "Inactive"];

function PropertyDetail() {
  const { propertyId } = useParams({ from: "/_app/properties/$propertyId" });
  const { scoped, addUnit, addBuilding, user } = useApp();
  const [bOpen, setBOpen] = useState(false);
  const [bForm, setBForm] = useState({ name: "", floors: 1 });
  const [bSaving, setBSaving] = useState(false);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";

  const property = scoped.properties.find((p) => p.id === propertyId);
  const buildings = useMemo(() => scoped.buildings.filter((b) => b.property_id === propertyId), [scoped, propertyId]);
  const units = useMemo(() => scoped.units.filter((u) => u.property_id === propertyId), [scoped, propertyId]);
  const tickets = scoped.maintenanceTickets.filter((t) => t.property_id === propertyId);
  const docs = scoped.documents.filter((d) => d.property_id === propertyId);
  const leases = scoped.leases.filter((l) => l.property_id === propertyId);

  const [form, setForm] = useState({
    building_id: "",
    unit_number: "",
    floor: 1,
    unit_type: "2BR Apartment",
    bedrooms: 2,
    bathrooms: 2,
    furnished: "Unfurnished" as "Furnished" | "Semi-Furnished" | "Unfurnished",
    area_sqft: 1100,
    monthly_rent: 8000,
    status: "Vacant" as UnitStatus,
  });

  if (!property) {
    return (
      <EmptyState
        icon={Building2}
        title="Property not found"
        description="It may have been removed, or you don't have access to it."
        action={
          <Button asChild>
            <Link to="/properties">Back to properties</Link>
          </Button>
        }
      />
    );
  }

  const occ = occupancyOf(units);
  const monthlyRent = units.filter((u) => u.status === "Occupied").reduce((s, u) => s + u.monthly_rent, 0);

  const submitBuilding = async () => {
    if (bForm.name.trim().length < 1) {
      toast.error("Building name is required.");
      return;
    }
    setBSaving(true);
    try {
      const b = await addBuilding({ property_id: property.id, name: bForm.name.trim(), floors: Math.max(1, Number(bForm.floors) || 1) });
      setForm((f) => ({ ...f, building_id: b.id }));
      setBForm({ name: "", floors: 1 });
      setBOpen(false);
      toast.success(`${b.name} added.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add building.");
    } finally {
      setBSaving(false);
    }
  };

  const submit = () => {
    const buildingId = form.building_id || buildings[0]?.id;
    if (!buildingId) {
      toast.error("Add a building first — use the \"New building\" button.");
      return;
    }
    if (!form.unit_number.trim()) {
      toast.error("Unit number is required.");
      return;
    }
    addUnit({
      ...form,
      building_id: buildingId,
      property_id: property.id,
      owner_id: property.owner_id,
    });
    setOpen(false);
    toast.success(`Unit ${form.unit_number} added.`);
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => void navigate({ to: "/properties" })}>
        <ArrowLeft className="size-4" /> Properties
      </Button>

      <PageHeader
        title={property.name}
        description={`${property.type} · ${property.address}, ${property.city}, ${property.country}`}
        actions={
          <>
            <StatusBadge value={property.status} />
            {canManage ? (
              <Button variant="outline" onClick={() => setBOpen(true)}>
                <Plus className="size-4" /> Add building
              </Button>
            ) : null}
            {canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add unit
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Buildings" value={buildings.length} icon={Building2} />
        <KpiCard label="Units" value={units.length} hint={`${occ.occupied} occupied · ${occ.vacant} vacant`} icon={DoorOpen} />
        <KpiCard label="Occupancy" value={percent(occ.rate)} icon={Building2} />
        <KpiCard label="Monthly rent roll" value={currency(monthlyRent)} icon={Wrench} />
      </div>

      <Tabs defaultValue="units">
        <TabsList className="w-full overflow-x-auto sm:w-auto">
          <TabsTrigger value="units">Units</TabsTrigger>
          <TabsTrigger value="buildings">Buildings</TabsTrigger>
          <TabsTrigger value="leases">Leases</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="units" className="mt-4">
          <SectionCard title="Units" description="Every unit in this property">
            <DataTable
              rows={units}
              empty={<EmptyState icon={DoorOpen} title="No units yet" description="Add the first unit to start tracking occupancy." />}
              columns={[
                {
                  key: "unit",
                  header: "Unit",
                  primary: true,
                  render: (u) => (
                    <div>
                      <p className="font-medium">{u.unit_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Floor {u.floor} · {buildings.find((b) => b.id === u.building_id)?.name ?? "—"}
                      </p>
                    </div>
                  ),
                },
                { key: "type", header: "Type", render: (u) => u.unit_type },
                { key: "beds", header: "Beds / Baths", render: (u) => `${u.bedrooms} / ${u.bathrooms}` },
                { key: "area", header: "Area", render: (u) => `${u.area_sqft} sqft` },
                { key: "furnished", header: "Furnishing", hideOnMobile: true, render: (u) => u.furnished },
                { key: "rent", header: "Rent", render: (u) => currency(u.monthly_rent) },
                {
                  key: "tenant",
                  header: "Tenant",
                  render: (u) => scoped.tenants.find((t) => t.id === u.tenant_id)?.full_name ?? "—",
                },
                { key: "status", header: "Status", render: (u) => <StatusBadge value={u.status} /> },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="buildings" className="mt-4">
          <SectionCard
            title="Buildings"
            actions={canManage ? (
              <Button size="sm" variant="outline" onClick={() => setBOpen(true)}>
                <Plus className="size-4" /> Add building
              </Button>
            ) : undefined}
          >
            <DataTable
              rows={buildings}
              empty={<EmptyState icon={Building2} title="No buildings" />}
              columns={[
                { key: "name", header: "Building", primary: true, render: (b) => b.name },
                { key: "floors", header: "Floors", render: (b) => b.floors },
                { key: "units", header: "Units", render: (b) => units.filter((u) => u.building_id === b.id).length },
                { key: "created", header: "Created", hideOnMobile: true, render: (b) => formatDate(b.created_at) },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="leases" className="mt-4">
          <SectionCard title="Leases">
            <DataTable
              rows={leases}
              empty={<EmptyState icon={DoorOpen} title="No leases" />}
              columns={[
                { key: "lease", header: "Lease", primary: true, render: (l) => l.lease_number },
                { key: "unit", header: "Unit", render: (l) => units.find((u) => u.id === l.unit_id)?.unit_number ?? "—" },
                {
                  key: "tenant",
                  header: "Tenant",
                  render: (l) => scoped.tenants.find((t) => t.id === l.tenant_id)?.full_name ?? "—",
                },
                { key: "term", header: "Term", render: (l) => `${formatDate(l.start_date)} → ${formatDate(l.end_date)}` },
                { key: "rent", header: "Rent", render: (l) => currency(l.monthly_rent) },
                { key: "status", header: "Status", render: (l) => <StatusBadge value={l.status} /> },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <SectionCard title="Maintenance tickets">
            <DataTable
              rows={tickets}
              onRowClick={(t) => void navigate({ to: "/maintenance/$ticketId", params: { ticketId: t.id } })}
              empty={<EmptyState icon={Wrench} title="No maintenance tickets" />}
              columns={[
                {
                  key: "title",
                  header: "Ticket",
                  primary: true,
                  render: (t) => (
                    <div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-muted-foreground">{t.reference}</p>
                    </div>
                  ),
                },
                { key: "cat", header: "Category", render: (t) => t.category },
                { key: "priority", header: "Priority", render: (t) => <StatusBadge value={t.priority} /> },
                { key: "status", header: "Status", render: (t) => <StatusBadge value={t.status} /> },
                { key: "created", header: "Raised", hideOnMobile: true, render: (t) => formatDate(t.created_at) },
              ]}
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <SectionCard title="Documents">
            <DataTable
              rows={docs}
              empty={<EmptyState icon={Building2} title="No documents" description="Upload property documents from the Documents module." />}
              columns={[
                { key: "name", header: "Document", primary: true, render: (d) => d.name },
                { key: "cat", header: "Category", render: (d) => d.category },
                { key: "type", header: "Type", render: (d) => `${d.file_type} · ${d.file_size}` },
                { key: "uploaded", header: "Uploaded", render: (d) => formatDate(d.uploaded_at) },
                { key: "expires", header: "Expires", hideOnMobile: true, render: (d) => formatDate(d.expires_at) },
              ]}
            />
          </SectionCard>
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add unit</DialogTitle>
            <DialogDescription>Create a new unit inside {property.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Building</Label>
                  <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={() => setBOpen(true)}>
                    + New building
                  </button>
                </div>
                <Select
                  value={form.building_id || buildings[0]?.id || ""}
                  onValueChange={(v) => setForm({ ...form, building_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No buildings yet</div>
                    ) : null}
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-num">Unit number</Label>
                <Input id="u-num" value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} placeholder="1204" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="u-floor">Floor</Label>
                <Input id="u-floor" type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-bed">Bedrooms</Label>
                <Input id="u-bed" type="number" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-bath">Bathrooms</Label>
                <Input id="u-bath" type="number" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="u-type">Unit type</Label>
                <Input id="u-type" value={form.unit_type} onChange={(e) => setForm({ ...form, unit_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="u-area">Area (sqft)</Label>
                <Input id="u-area" type="number" value={form.area_sqft} onChange={(e) => setForm({ ...form, area_sqft: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="u-rent">Monthly rent</Label>
                <Input id="u-rent" type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>Furnishing</Label>
                <Select value={form.furnished} onValueChange={(v) => setForm({ ...form, furnished: v as typeof form.furnished })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Furnished", "Semi-Furnished", "Unfurnished"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as UnitStatus })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Create unit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bOpen} onOpenChange={setBOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add building</DialogTitle>
            <DialogDescription>Add a building (tower, block or villa) to {property.name}.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="b-name">Building name</Label>
              <Input id="b-name" value={bForm.name} onChange={(e) => setBForm({ ...bForm, name: e.target.value })} placeholder="Tower A" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="b-floors">Floors</Label>
              <Input id="b-floors" type="number" min={1} value={bForm.floors} onChange={(e) => setBForm({ ...bForm, floors: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBOpen(false)}>Cancel</Button>
            <Button disabled={bSaving} onClick={() => void submitBuilding()}>{bSaving ? "Saving…" : "Create building"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
