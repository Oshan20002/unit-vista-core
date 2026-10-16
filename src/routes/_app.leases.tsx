import { createFileRoute } from "@tanstack/react-router";
import { Download, KeyRound, Plus } from "lucide-react";
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
import { currency, daysBetween, downloadCsv, formatDate } from "@/lib/format";
import type { LeaseStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/leases")({
  head: () => ({
    meta: [
      { title: "Leases — Estora" },
      { name: "description", content: "Track lease terms, renewals and expiries across the managed portfolio." },
      { property: "og:title", content: "Leases — Estora" },
      { property: "og:description", content: "Lease register with terms, rent, deposits and expiry alerts." },
    ],
  }),
  component: LeasesPage,
});

const STATUSES: LeaseStatus[] = ["Draft", "Active", "Expiring Soon", "Expired", "Terminated"];

function LeasesPage() {
  const { scoped, addLease, user, softDelete } = useApp();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [open, setOpen] = useState(false);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";
  const today = new Date().toISOString().slice(0, 10);

  const [form, setForm] = useState({
    unit_id: "",
    tenant_id: "",
    start_date: today,
    end_date: today,
    monthly_rent: 0,
    security_deposit: 0,
    payment_frequency: "Monthly" as "Monthly" | "Quarterly" | "Annually",
    status: "Draft" as LeaseStatus,
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.leases
      .filter((l) => (status === "all" ? true : l.status === status))
      .map((l) => ({
        ...l,
        tenantName: scoped.tenants.find((t) => t.id === l.tenant_id)?.full_name ?? "—",
        unitNumber: scoped.units.find((u) => u.id === l.unit_id)?.unit_number ?? "—",
        propertyName: scoped.properties.find((p) => p.id === l.property_id)?.name ?? "—",
        daysLeft: daysBetween(today, l.end_date),
      }))
      .filter((l) => (q ? `${l.lease_number} ${l.tenantName} ${l.propertyName} ${l.unitNumber}`.toLowerCase().includes(q) : true));
  }, [scoped, query, status, today]);

  const submit = () => {
    const unit = scoped.units.find((u) => u.id === form.unit_id);
    const tenant = scoped.tenants.find((t) => t.id === form.tenant_id);
    if (!unit || !tenant) {
      toast.error("Select both a unit and a tenant.");
      return;
    }
    if (form.end_date <= form.start_date) {
      toast.error("The end date must be after the start date.");
      return;
    }
    if (form.monthly_rent <= 0) {
      toast.error("Monthly rent must be greater than zero.");
      return;
    }
    addLease({
      ...form,
      property_id: unit.property_id,
      owner_id: unit.owner_id,
    });
    setOpen(false);
    toast.success("Lease created.");
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={user?.role === "TENANT" ? "My lease" : "Leases"}
        description="Contract terms, renewal windows and deposits."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "leases",
                  rows.map((l) => ({
                    Lease: l.lease_number,
                    Property: l.propertyName,
                    Unit: l.unitNumber,
                    Tenant: l.tenantName,
                    Start: l.start_date,
                    End: l.end_date,
                    Rent: l.monthly_rent,
                    Status: l.status,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
            {canManage ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" /> New lease
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Input placeholder="Search leases" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-52">
            <SelectValue />
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

      <SectionCard>
        <DataTable
          rows={rows}
          rowClassName={deletedRowClass}
          empty={<EmptyState icon={KeyRound} title="No leases found" description="Create a lease to start tracking a tenancy." />}
          columns={[
            {
              key: "lease",
              header: "Lease",
              primary: true,
              render: (l) => (
                <div>
                  <p className="font-medium">{l.lease_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.propertyName} · {l.unitNumber}
                  </p>
                </div>
              ),
            },
            { key: "tenant", header: "Tenant", render: (l) => l.tenantName },
            { key: "term", header: "Term", render: (l) => `${formatDate(l.start_date)} → ${formatDate(l.end_date)}` },
            { key: "rent", header: "Rent", render: (l) => currency(l.monthly_rent) },
            { key: "deposit", header: "Deposit", hideOnMobile: true, render: (l) => currency(l.security_deposit) },
            { key: "freq", header: "Frequency", hideOnMobile: true, render: (l) => l.payment_frequency },
            {
              key: "days",
              header: "Days left",
              render: (l) => (l.daysLeft > 0 ? `${l.daysLeft} days` : "Expired"),
            },
            { key: "status", header: "Status", render: (l) => (l.deleted_at ? <DeletedLabel deletedAt={l.deleted_at} /> : <StatusBadge value={l.status} />) },
            ...(canManage
              ? [
                  {
                    key: "del",
                    header: "",
                    render: (l: (typeof rows)[number]) =>
                      l.deleted_at ? null : (
                        <DeleteRecordButton label="lease" name={l.lease_number} onConfirm={() => softDelete("leases", l.id)} />
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
            <DialogTitle>New lease</DialogTitle>
            <DialogDescription>Link a tenant to a unit and set the contract terms.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select
                  value={form.unit_id}
                  onValueChange={(v) => {
                    const u = scoped.units.find((x) => x.id === v);
                    setForm({ ...form, unit_id: v, monthly_rent: u?.monthly_rent ?? form.monthly_rent });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {scoped.units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {scoped.properties.find((p) => p.id === u.property_id)?.name} · {u.unit_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tenant</Label>
                <Select value={form.tenant_id} onValueChange={(v) => setForm({ ...form, tenant_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {scoped.tenants.filter((t) => !t.deleted_at).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-start">Start date</Label>
                <Input id="l-start" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-end">End date</Label>
                <Input id="l-end" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="l-rent">Monthly rent</Label>
                <Input id="l-rent" type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="l-dep">Security deposit</Label>
                <Input id="l-dep" type="number" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: Number(e.target.value) })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Payment frequency</Label>
                <Select value={form.payment_frequency} onValueChange={(v) => setForm({ ...form, payment_frequency: v as typeof form.payment_frequency })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Monthly", "Quarterly", "Annually"].map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeaseStatus })}>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Create lease</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
