import { createFileRoute } from "@tanstack/react-router";
import { Download, Loader2, Pencil, UserPlus, Users } from "lucide-react";
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
import { InviteCodeDialog } from "@/components/app/InviteCodeDialog";
import { DeleteRecordButton, DeletedLabel, deletedRowClass } from "@/components/app/DeleteRecord";
import { useApp } from "@/lib/app-store";
import { currency, downloadCsv, formatDate } from "@/lib/format";
import type { Owner } from "@/lib/types";

export const Route = createFileRoute("/_app/owners")({
  head: () => ({
    meta: [
      { title: "Owners & Landlords — Estora" },
      { name: "description", content: "Landlord register with KYC status, portfolio size and approval thresholds." },
      { property: "og:title", content: "Owners & Landlords — Estora" },
      { property: "og:description", content: "Manage owner records, verification status and portfolio exposure." },
    ],
  }),
  component: OwnersPage,
});

type OwnerForm = Omit<Owner, "id" | "created_at">;

const emptyForm = (): OwnerForm => ({
  full_name: "",
  email: "",
  phone: "",
  country: "",
  address: "",
  kyc_status: "Pending",
  bank_details_status: "Missing",
  approval_threshold: 0,
  status: "Active",
  bank_name: "",
  bank_account_name: "",
  bank_account_number: "",
  bank_branch: "",
});

function OwnersPage() {
  const { scoped, addOwner, updateOwner, user, softDelete } = useApp();
  const [query, setQuery] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<OwnerForm>(emptyForm);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; code: string } | null>(null);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.owners
      .filter((o) => (q ? `${o.full_name} ${o.email} ${o.country}`.toLowerCase().includes(q) : true))
      .map((o) => {
        const props = scoped.properties.filter((p) => p.owner_id === o.id);
        const units = scoped.units.filter((u) => u.owner_id === o.id);
        return {
          ...o,
          properties: props.length,
          units: units.length,
          rentRoll: units.filter((u) => u.status === "Occupied").reduce((s, u) => s + u.monthly_rent, 0),
        };
      });
  }, [scoped, query]);

  const submitAdd = async () => {
    if (form.full_name.trim().length < 3) {
      toast.error("Enter the landlord's full name.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (!form.country.trim()) {
      toast.error("Enter the landlord's country.");
      return;
    }
    if (form.approval_threshold < 0) {
      toast.error("The approval limit cannot be negative.");
      return;
    }
    setBusy(true);
    try {
      const input = {
        ...form,
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        country: form.country.trim(),
        address: form.address.trim(),
        bank_details_status: (form.bank_account_number?.trim() ? "Complete" : form.bank_details_status) as Owner["bank_details_status"],
      };
      if (editing) {
        const { invite_code: _c, invite_claimed_at: _i, deleted_at: _d, ...patch } = input;
        await updateOwner(editing.id, patch);
        toast.success("Landlord details updated.");
        setAddOpen(false);
        setEditing(null);
      } else {
        const owner = await addOwner(input);
        toast.success("Landlord added.");
        setForm(emptyForm());
        setAddOpen(false);
        setInvite({ name: owner.full_name, email: owner.email, code: owner.invite_code ?? "" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the landlord.");
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (o: Owner) => {
    setEditing(o);
    setForm({
      full_name: o.full_name,
      email: o.email,
      phone: o.phone ?? "",
      country: o.country ?? "",
      address: o.address ?? "",
      kyc_status: o.kyc_status,
      bank_details_status: o.bank_details_status,
      approval_threshold: o.approval_threshold ?? 0,
      status: o.status,
      bank_name: o.bank_name ?? "",
      bank_account_name: o.bank_account_name ?? "",
      bank_account_number: o.bank_account_number ?? "",
      bank_branch: o.bank_branch ?? "",
    });
    setAddOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Owners & landlords"
        description="Every owner whose assets you manage, with verification and payout readiness."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "owners",
                  rows.map((o) => ({
                    Name: o.full_name,
                    Email: o.email,
                    Country: o.country,
                    Properties: o.properties,
                    Units: o.units,
                    "Monthly rent roll": o.rentRoll,
                    KYC: o.kyc_status,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export CSV
            </Button>
            {canManage ? (
              <Button onClick={() => { setEditing(null); setForm(emptyForm()); setAddOpen(true); }}>
                <UserPlus className="size-4" /> Add landlord
              </Button>
            ) : null}
          </>
        }
      />

      <Input placeholder="Search owners" value={query} onChange={(e) => setQuery(e.target.value)} />

      <SectionCard>
        <DataTable
          rows={rows}
          rowClassName={deletedRowClass}
          empty={<EmptyState icon={Users} title="No owners found" description="Add a landlord or adjust your search." />}
          columns={[
            {
              key: "name",
              header: "Owner",
              primary: true,
              render: (o) => (
                <div>
                  <p className="font-medium">{o.full_name}</p>
                  <p className="text-xs text-muted-foreground">{o.email}</p>
                </div>
              ),
            },
            { key: "country", header: "Country", render: (o) => o.country },
            { key: "props", header: "Properties", render: (o) => o.properties },
            { key: "units", header: "Units", render: (o) => o.units },
            { key: "roll", header: "Rent roll", render: (o) => currency(o.rentRoll) },
            { key: "threshold", header: "Approval limit", hideOnMobile: true, render: (o) => currency(o.approval_threshold) },
            { key: "kyc", header: "KYC", render: (o) => (o.deleted_at ? <DeletedLabel deletedAt={o.deleted_at} /> : <StatusBadge value={o.kyc_status} />) },
            { key: "bank", header: "Bank details", hideOnMobile: true, render: (o) => <StatusBadge value={o.bank_details_status} /> },
            ...(canManage
              ? [
                  {
                    key: "code",
                    header: "One-time code",
                    render: (o: (typeof rows)[number]) =>
                      o.invite_code ? (
                        <span className="font-mono text-xs tracking-widest">
                          {o.invite_code}
                          {o.invite_claimed_at ? <span className="ml-2 font-sans tracking-normal text-muted-foreground">(registered)</span> : null}
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                ]
              : []),
            { key: "since", header: "Since", hideOnMobile: true, render: (o) => formatDate(o.created_at) },
            ...(canManage
              ? [
                  {
                    key: "edit",
                    header: "",
                    render: (o: (typeof rows)[number]) =>
                      o.deleted_at ? null : (
                        <Button variant="ghost" size="sm" title="Edit landlord details" onClick={() => openEdit(o)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                      ),
                  },
                  {
                    key: "del",
                    header: "",
                    render: (o: (typeof rows)[number]) =>
                      o.deleted_at ? null : (
                        <DeleteRecordButton label="landlord" name={o.full_name} warning="Their properties, units and leases will be removed too after 7 days." onConfirm={() => softDelete("owners", o.id)} />
                      ),
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit landlord" : "Add landlord"}</DialogTitle>
            <DialogDescription>
              {editing ? "Update this landlord's details." : "Create an owner record for a landlord whose assets you manage."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="o-name">Full name</Label>
                <Input id="o-name" value={form.full_name} placeholder="Nadia Kaur" onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-email">Email</Label>
                <Input id="o-email" type="email" value={form.email} placeholder="nadia@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="o-phone">Phone</Label>
                <Input id="o-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="o-country">Country</Label>
                <Input id="o-country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="o-address">Address</Label>
              <Input id="o-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>KYC status</Label>
                <Select value={form.kyc_status} onValueChange={(v) => setForm({ ...form, kyc_status: v as Owner["kyc_status"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Verified", "Pending", "Rejected"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bank details</Label>
                <Select value={form.bank_details_status} onValueChange={(v) => setForm({ ...form, bank_details_status: v as Owner["bank_details_status"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Complete", "Missing"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="o-threshold">Approval limit</Label>
                <Input
                  id="o-threshold"
                  type="number"
                  min={0}
                  value={form.approval_threshold}
                  onChange={(e) => setForm({ ...form, approval_threshold: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Owner["status"] })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Active", "Inactive"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="pt-2 text-sm font-medium">Bank account</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {([
                ["bank_name", "Bank name"],
                ["bank_account_name", "Account holder name"],
                ["bank_account_number", "Account number"],
                ["bank_branch", "Branch"],
              ] as const).map(([k, l]) => (
                <div key={k} className="space-y-2">
                  <Label htmlFor={`o-${k}`}>{l}</Label>
                  <Input id={`o-${k}`} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitAdd()} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null} {editing ? "Save changes" : "Add landlord"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InviteCodeDialog invite={invite} onClose={() => setInvite(null)} kind="landlord" />
    </div>
  );
}
