import { Pencil, Plus, type LucideIcon } from "lucide-react";
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
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { DeleteRecordButton, DeletedLabel, deletedRowClass } from "@/components/app/DeleteRecord";
import { InviteCodeDialog } from "@/components/app/InviteCodeDialog";
import { useApp } from "@/lib/app-store";

interface Row {
  id: string;
  name: string;
  email: string;
  phone: string;
  trade: string;
  invite_code?: string | undefined;
  invite_claimed_at?: string | undefined;
  deleted_at?: string | undefined;
  bank_name?: string | undefined;
  bank_account_name?: string | undefined;
  bank_account_number?: string | undefined;
  bank_iban?: string | undefined;
}

const blank = { name: "", email: "", phone: "", trade: "", bank_name: "", bank_account_name: "", bank_account_number: "", bank_iban: "" };

export function PartnerDirectory({ kind, icon: Icon }: { kind: "technician" | "vendor"; icon: LucideIcon }) {
  const { technicians, vendors, addTechnician, addVendor, updatePartner, softDelete, user } = useApp();
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<{ name: string; email: string; code: string } | null>(null);
  const [form, setForm] = useState(blank);
  const [editId, setEditId] = useState<string | null>(null);
  const openAdd = () => {
    setEditId(null);
    setForm(blank);
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setEditId(r.id);
    setForm({
      name: r.name,
      email: r.email,
      phone: r.phone ?? "",
      trade: r.trade ?? "",
      bank_name: r.bank_name ?? "",
      bank_account_name: r.bank_account_name ?? "",
      bank_account_number: r.bank_account_number ?? "",
      bank_iban: r.bank_iban ?? "",
    });
    setOpen(true);
  };
  const title = kind === "technician" ? "Technicians" : "Vendors";

  const rows: Row[] = useMemo(() => {
    const list: Row[] =
      kind === "technician"
        ? technicians.map((t) => ({ ...t, name: t.full_name }))
        : vendors.map((v) => ({ ...v }));
    const q = query.trim().toLowerCase();
    return list.filter((r) => (q ? `${r.name} ${r.email} ${r.trade}`.toLowerCase().includes(q) : true));
  }, [kind, technicians, vendors, query]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.includes("@")) {
      toast.error("Enter a valid name and email address.");
      return;
    }
    setBusy(true);
    try {
      const email = form.email.trim().toLowerCase();
      const bank = {
        bank_name: form.bank_name.trim(),
        bank_account_name: form.bank_account_name.trim(),
        bank_account_number: form.bank_account_number.trim(),
        bank_iban: form.bank_iban.trim(),
      };
      const nameField = kind === "technician" ? { full_name: form.name.trim() } : { name: form.name.trim() };
      if (editId) {
        await updatePartner(kind, editId, { ...nameField, email, phone: form.phone, trade: form.trade, ...bank });
        setOpen(false);
        toast.success("Details updated.");
        return;
      }
      const rec =
        kind === "technician"
          ? await addTechnician({ full_name: form.name.trim(), email, phone: form.phone, trade: form.trade, ...bank })
          : await addVendor({ name: form.name.trim(), email, phone: form.phone, trade: form.trade, ...bank });
      setOpen(false);
      setForm(blank);
      setInvite({ name: form.name.trim(), email, code: rec.invite_code ?? "" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={title}
        description={
          kind === "technician"
            ? "Technicians you can assign to maintenance requests for quotations."
            : "Suppliers who price the materials on technician quotations."
        }
        actions={
          canManage ? (
            <Button onClick={openAdd}>
              <Plus className="size-4" /> Add {kind}
            </Button>
          ) : null
        }
      />
      <Input placeholder="Search by name, email or trade" value={query} onChange={(e) => setQuery(e.target.value)} />
      <SectionCard>
        <DataTable
          rows={rows}
          rowClassName={deletedRowClass}
          empty={<EmptyState icon={Icon} title={`No ${kind}s yet`} description={`Add a ${kind} to get started.`} />}
          columns={[
            {
              key: "name",
              header: kind === "technician" ? "Technician" : "Vendor",
              primary: true,
              render: (r) => (
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.email}</p>
                </div>
              ),
            },
            { key: "trade", header: kind === "technician" ? "Trade" : "Supplies", render: (r) => r.trade || "—" },
            { key: "phone", header: "Phone", render: (r) => r.phone || "—" },
            ...(canManage
              ? [
                  {
                    key: "bank",
                    header: "Bank account",
                    render: (r: Row) =>
                      r.bank_account_number || r.bank_iban ? (
                        <div className="text-xs">
                          <p className="font-medium">{r.bank_name || "—"}</p>
                          <p className="text-muted-foreground">{r.bank_account_name} · {r.bank_account_number || r.bank_iban}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Missing</span>
                      ),
                  },
                ]
              : []),
            {
              key: "status",
              header: "Status",
              render: (r) =>
                r.deleted_at ? (
                  <DeletedLabel deletedAt={r.deleted_at} />
                ) : (
                  <StatusBadge value={r.invite_claimed_at ? "Active" : "Pending"} />
                ),
            },
            ...(canManage
              ? [
                  {
                    key: "code",
                    header: "One-time code",
                    render: (r: Row) =>
                      r.invite_code ? (
                        <span className="font-mono text-xs tracking-widest">
                          {r.invite_code}
                          {r.invite_claimed_at ? (
                            <span className="ml-2 font-sans tracking-normal text-muted-foreground">(registered)</span>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      ),
                  },
                  {
                    key: "del",
                    header: "",
                    render: (r: Row) =>
                      r.deleted_at ? null : (
                        <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}>
                          <Pencil className="size-4" /> Edit
                        </Button>
                        <DeleteRecordButton
                          label={kind}
                          name={r.name}
                          onConfirm={() => softDelete(kind === "technician" ? "technicians" : "vendors", r.id)}
                        />
                        </div>
                      ),
                  },
                ]
              : []),
          ]}
        />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? `Edit ${kind}` : `Add ${kind}`}</DialogTitle>
            <DialogDescription>
              {editId ? "Update contact and bank details." : "A one-time code is created so they can register their own login."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="p-name">{kind === "technician" ? "Full name" : "Company name"}</Label>
              <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-phone">Phone</Label>
                <Input id="p-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-trade">{kind === "technician" ? "Trade (e.g. Plumbing, HVAC)" : "What they supply"}</Label>
              <Input id="p-trade" value={form.trade} onChange={(e) => setForm({ ...form, trade: e.target.value })} />
            </div>
            <p className="pt-2 text-sm font-medium">Bank account</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="p-bank">Bank name</Label>
                <Input id="p-bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-acname">Account holder name</Label>
                <Input id="p-acname" value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-acno">Account number</Label>
                <Input id="p-acno" value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="p-iban">IBAN</Label>
                <Input id="p-iban" value={form.bank_iban} onChange={(e) => setForm({ ...form, bank_iban: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={busy}>
              {editId ? "Save changes" : `Add ${kind}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <InviteCodeDialog invite={invite} onClose={() => setInvite(null)} kind={kind} />
    </div>
  );
}
