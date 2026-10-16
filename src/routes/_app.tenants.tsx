import { createFileRoute } from "@tanstack/react-router";
import { Download, Plus, UserSquare2 } from "lucide-react";
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
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DeleteRecordButton, DeletedLabel, deletedRowClass } from "@/components/app/DeleteRecord";
import { useApp } from "@/lib/app-store";
import { InviteCodeDialog } from "@/components/app/InviteCodeDialog";
import { downloadCsv, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/tenants")({
  head: () => ({
    meta: [
      { title: "Tenants — Estora" },
      { name: "description", content: "Tenant directory with unit assignment, contact details and tenancy status." },
      { property: "og:title", content: "Tenants — Estora" },
      { property: "og:description", content: "Search tenants, review tenancy status and onboard new residents." },
    ],
  }),
  component: TenantsPage,
});

function TenantsPage() {
  const { scoped, addTenant, user, softDelete } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const [invite, setInvite] = useState<{ name: string; email: string; code: string } | null>(null);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";

  const vacantUnits = scoped.units.filter((u) => u.status !== "Occupied");
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    nationality: "",
    unit_id: "",
    status: "Active" as "Active" | "Notice Period" | "Former",
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.tenants
      .filter((t) => (status === "all" ? true : t.status === status))
      .filter((t) => (q ? `${t.full_name} ${t.email} ${t.phone}`.toLowerCase().includes(q) : true))
      .map((t) => ({
        ...t,
        unit: scoped.units.find((u) => u.id === t.unit_id)?.unit_number ?? "—",
        property: scoped.properties.find((p) => p.id === t.property_id)?.name ?? "—",
        lease: scoped.leases.find((l) => l.tenant_id === t.id),
      }));
  }, [scoped, query, status]);

  const submit = () => {
    const unit = scoped.units.find((u) => u.id === form.unit_id);
    if (!form.full_name.trim() || !form.email.includes("@")) {
      toast.error("Enter a valid name and email address.");
      return;
    }
    if (!unit) {
      toast.error("Select a unit for this tenant.");
      return;
    }
    const tenant = addTenant({ ...form, email: form.email.trim().toLowerCase(), property_id: unit.property_id });
    setOpen(false);
    toast.success(`${form.full_name} added as a tenant.`);
    setInvite({ name: tenant.full_name, email: tenant.email, code: tenant.invite_code ?? "" });
    setForm({ full_name: "", email: "", phone: "", nationality: "", unit_id: "", status: "Active" });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tenants"
        description="Everyone living in the portfolio, with their unit and tenancy status."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "tenants",
                  rows.map((t) => ({
                    Name: t.full_name,
                    Email: t.email,
                    Phone: t.phone,
                    Property: t.property,
                    Unit: t.unit,
                    Status: t.status,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
            {canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> Add tenant
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Search by name, email or phone" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["Active", "Notice Period", "Former"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard>
        <DataTable
          rows={rows}
          rowClassName={deletedRowClass}
          empty={<EmptyState icon={UserSquare2} title="No tenants found" description="Try a different search or add a new tenant." />}
          columns={[
            {
              key: "name",
              header: "Tenant",
              primary: true,
              render: (t) => (
                <div>
                  <p className="font-medium">{t.full_name}</p>
                  <p className="text-xs text-muted-foreground">{t.email}</p>
                </div>
              ),
            },
            { key: "phone", header: "Phone", render: (t) => t.phone },
            { key: "property", header: "Property", render: (t) => t.property },
            { key: "unit", header: "Unit", render: (t) => t.unit },
            { key: "lease", header: "Lease ends", render: (t) => formatDate(t.lease?.end_date) },
            { key: "nat", header: "Nationality", hideOnMobile: true, render: (t) => t.nationality },
            { key: "status", header: "Status", render: (t) => (t.deleted_at ? <DeletedLabel deletedAt={t.deleted_at} /> : <StatusBadge value={t.status} />) },
            ...(canManage
              ? [
                  {
                    key: "code",
                    header: "One-time code",
                    render: (t: (typeof rows)[number]) =>
                      t.invite_code ? (
                        <span className="font-mono text-xs tracking-widest">
                          {t.invite_code}
                          {t.invite_claimed_at ? <span className="ml-2 font-sans tracking-normal text-muted-foreground">(registered)</span> : null}
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "del",
                    header: "",
                    render: (t: (typeof rows)[number]) =>
                      t.deleted_at ? null : (
                        <DeleteRecordButton label="tenant" name={t.full_name} warning="Their leases will be removed too." onConfirm={() => softDelete("tenants", t.id)} />
                      ),
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add tenant</DialogTitle>
            <DialogDescription>Onboard a new resident and assign them to a unit.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-name">Full name</Label>
              <Input id="t-name" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-email">Email</Label>
                <Input id="t-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-phone">Phone</Label>
                <Input id="t-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="t-nat">Nationality</Label>
                <Input id="t-nat" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {(vacantUnits.length ? vacantUnits : scoped.units).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {scoped.properties.find((p) => p.id === u.property_id)?.name} · {u.unit_number}
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
            <Button onClick={submit}>Add tenant</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InviteCodeDialog invite={invite} onClose={() => setInvite(null)} kind="tenant" />
    </div>
  );
}
