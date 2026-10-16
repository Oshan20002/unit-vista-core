import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CreditCard, Download, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { FileLink } from "@/components/app/FileLink";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { PaySlipDialog, StatementView, type BankInfo } from "@/components/app/PaymentWidgets";
import { useApp } from "@/lib/app-store";
import { currency, downloadCsv, formatDate, percent } from "@/lib/format";
import { landlordStatement, technicianStatement, vendorStatement, type Statement } from "@/lib/payouts";
import { rentTotals } from "@/lib/selectors";
import type { CompanyBank, Payment, RentSchedule } from "@/lib/types";

export const Route = createFileRoute("/_app/rent")({
  head: () => ({
    meta: [
      { title: "Rent & Payments — Estora" },
      { name: "description", content: "Rent collection by month, and payments to landlords, vendors and technicians." },
      { property: "og:title", content: "Rent & Payments — Estora" },
      { property: "og:description", content: "Collect rent, confirm bank slips and pay landlords, vendors and technicians." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RentPage,
});

const METHODS = ["Cash", "Card", "Bank Transfer"] as const;
type Method = (typeof METHODS)[number];

const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const shiftMonth = (key: string, by: number) => {
  const [y = 2026, m = 1] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + by, 1));
};
const monthLabel = (key: string) => {
  const [y = 2026, m = 1] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
};
const companyBankInfo = (b: CompanyBank): BankInfo => ({
  title: b.bank_name,
  lines: [
    ["Account name", b.account_name],
    ["Account no.", b.account_number],
    ["Branch", b.branch],
  ],
});

function RentPage() {
  const { user } = useApp();
  if (user?.role === "TENANT") return <TenantRent />;
  if (user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER") return <StaffPayments />;
  return <RentTable title="Rent & income" />;
}

// ---------------- Staff ----------------
function StaffPayments() {
  return (
    <div className="space-y-5">
      <PageHeader title="Rent & payments" description="Collect rent and pay landlords, vendors and technicians." />
      <Tabs defaultValue="tenants">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="tenants">Rent from tenants</TabsTrigger>
          <TabsTrigger value="landlords">Pay to landlords</TabsTrigger>
          <TabsTrigger value="vendors">Pay to vendors</TabsTrigger>
          <TabsTrigger value="technicians">Pay to technicians</TabsTrigger>
        </TabsList>
        <TabsContent value="tenants" className="mt-4">
          <TenantCollections />
        </TabsContent>
        <TabsContent value="landlords" className="mt-4">
          <PartnerPayouts kind="LANDLORD" />
        </TabsContent>
        <TabsContent value="vendors" className="mt-4">
          <PartnerPayouts kind="VENDOR" />
        </TabsContent>
        <TabsContent value="technicians" className="mt-4">
          <PartnerPayouts kind="TECHNICIAN" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MonthPicker({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}>
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium">{monthLabel(month)}</span>
      <Button variant="outline" size="icon" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}>
        <ChevronRight className="size-4" />
      </Button>
      {month !== monthKey() ? (
        <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey())}>
          This month
        </Button>
      ) : null}
    </div>
  );
}

function TenantCollections() {
  const { scoped, payments, recordPayment, confirmRentPayment } = useApp();
  const [month, setMonth] = useState(monthKey());
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<RentSchedule | null>(null);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<Method>("Cash");
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.rentSchedules
      .filter((r) => r.due_date.slice(0, 7) === month)
      .map((r) => {
        const unit = scoped.units.find((u) => u.id === r.unit_id);
        return {
          ...r,
          tenantName: scoped.tenants.find((t) => t.id === r.tenant_id)?.full_name ?? "—",
          unitNumber: unit?.unit_number ?? "—",
          propertyName: scoped.properties.find((p) => p.id === r.property_id)?.name ?? "—",
          submitted: payments.find((p) => p.kind === "TENANT_RENT" && p.rent_id === r.id && p.status === "Submitted"),
        };
      })
      .filter((r) => (q ? `${r.tenantName} ${r.propertyName} ${r.unitNumber}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.tenantName.localeCompare(b.tenantName));
  }, [scoped, payments, month, query]);
  const totals = rentTotals(rows);

  const save = async () => {
    if (!active) return;
    const outstanding = active.amount - active.paid_amount;
    if (amount <= 0 || amount > outstanding) {
      toast.error(`Enter an amount between 1 and ${currency(outstanding)}.`);
      return;
    }
    setBusy(true);
    try {
      await recordPayment(active.id, amount, method);
      toast.success(`${currency(amount)} recorded.`);
      setActive(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save payment.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!confirming || !received) {
      toast.error("Tick that the payment was received first.");
      return;
    }
    setBusy(true);
    try {
      await confirmRentPayment(confirming.id);
      toast.success("Payment confirmed.");
      setConfirming(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not confirm.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthPicker month={month} setMonth={setMonth} />
        <Button
          variant="outline"
          onClick={() =>
            downloadCsv(
              `rent-${month}`,
              rows.map((r) => ({ Due: r.due_date, Property: r.propertyName, Unit: r.unitNumber, Tenant: r.tenantName, Amount: r.amount, Paid: r.paid_amount, Status: r.status })),
            )
          }
        >
          <Download className="size-4" /> Export
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Billed" value={currency(totals.expected)} icon={CreditCard} />
        <KpiCard label="Collected" value={currency(totals.collected)} icon={Wallet} />
        <KpiCard label="Outstanding" value={currency(totals.outstanding)} icon={CreditCard} />
        <KpiCard label="Collection rate" value={percent(totals.rate)} icon={Wallet} />
      </div>
      <Input placeholder="Search by tenant, property or unit" value={query} onChange={(e) => setQuery(e.target.value)} />
      <SectionCard>
        <DataTable
          rows={rows}
          empty={<EmptyState icon={CreditCard} title={`No rent for ${monthLabel(month)}`} description="Rent appears once leases are active." />}
          columns={[
            {
              key: "tenant",
              header: "Tenant",
              primary: true,
              render: (r) => (
                <div>
                  <p className="font-medium">{r.tenantName}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.propertyName} · Unit {r.unitNumber}
                  </p>
                </div>
              ),
            },
            { key: "due", header: "Due", render: (r) => formatDate(r.due_date) },
            { key: "amount", header: "Amount", render: (r) => currency(r.amount) },
            { key: "paid", header: "Paid", render: (r) => currency(r.paid_amount) },
            { key: "method", header: "Method", hideOnMobile: true, render: (r) => r.method ?? "—" },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            {
              key: "action",
              header: "",
              align: "right",
              render: (r) => (
                <div className="flex justify-end gap-2">
                  {r.submitted ? (
                    <Button
                      size="sm"
                      onClick={() => {
                        setReceived(false);
                        setConfirming(r.submitted ?? null);
                      }}
                    >
                      Confirm payment
                    </Button>
                  ) : null}
                  {r.status !== "Paid" && !r.submitted ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setActive(r);
                        setAmount(r.amount - r.paid_amount);
                      }}
                    >
                      Get payment
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ]}
        />
      </SectionCard>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Get payment</DialogTitle>
            <DialogDescription>
              {active ? `Balance ${currency(active.amount - active.paid_amount)} due ${formatDate(active.due_date)}.` : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount</Label>
              <Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={busy}>Save payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm tenant payment</DialogTitle>
            <DialogDescription>
              {confirming ? `Bank transfer of ${currency(confirming.amount)} submitted ${formatDate(confirming.created_at)}.` : null}
            </DialogDescription>
          </DialogHeader>
          {confirming?.slip ? <FileLink file={confirming.slip} /> : <p className="text-sm text-muted-foreground">No slip attached.</p>}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={received} onCheckedChange={(v) => setReceived(v === true)} />
            Payment received successfully
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
            <Button onClick={confirm} disabled={!received || busy}>
              Confirm payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PartnerPayouts({ kind }: { kind: "LANDLORD" | "VENDOR" | "TECHNICIAN" }) {
  const app = useApp();
  const { scoped, payments, payPartner } = app;
  const data = { ...scoped, payments };
  const [detail, setDetail] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  const rows = useMemo(() => {
    type R = { id: string; name: string; sub: string; bank: BankInfo; statement: Statement };
    const bank = (title: string, x: { bank_name?: string | undefined; bank_account_name?: string | undefined; bank_account_number?: string | undefined; bank_iban?: string | undefined; bank_branch?: string | undefined }): BankInfo => ({
      title: x.bank_name || title,
      lines: [
        ["Account name", x.bank_account_name],
        ["Account no.", x.bank_account_number],
        ...(x.bank_branch !== undefined ? ([["Branch", x.bank_branch]] as [string, string | undefined][]) : []),
        ...(x.bank_iban ? ([["IBAN", x.bank_iban]] as [string, string | undefined][]) : []),
      ],
    });
    const list: R[] =
      kind === "LANDLORD"
        ? scoped.owners.filter((o) => !o.deleted_at).map((o) => ({ id: o.id, name: o.full_name, sub: o.email, bank: bank("Bank", { ...o, bank_branch: o.bank_branch ?? "" }), statement: landlordStatement(o.id, data) }))
        : kind === "VENDOR"
          ? scoped.vendors.filter((v) => !v.deleted_at).map((v) => ({ id: v.id, name: v.name, sub: v.trade, bank: bank("Bank", v), statement: vendorStatement(v.id, data) }))
          : scoped.technicians.filter((t) => !t.deleted_at).map((t) => ({ id: t.id, name: t.full_name, sub: t.trade, bank: bank("Bank", t), statement: technicianStatement(t.id, data) }));
    return list
      .filter((r) => r.statement.earned.length || r.statement.deductions.length || r.statement.payments.length || r.statement.uncollected > 0)
      .sort((a, b) => b.statement.due - a.statement.due);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, scoped, payments]);

  const totalDue = rows.reduce((s, r) => s + r.statement.due, 0);
  const totalPending = rows.reduce((s, r) => s + r.statement.pending, 0);
  const totalPaid = rows.reduce((s, r) => s + r.statement.paid, 0);
  const label = kind === "LANDLORD" ? "landlord" : kind === "VENDOR" ? "vendor" : "technician";
  const det = rows.find((r) => r.id === detail);
  const pay = rows.find((r) => r.id === paying);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Not paid" value={currency(totalDue)} icon={Wallet} />
        <KpiCard label="Waiting confirmation" value={currency(totalPending)} icon={CreditCard} />
        <KpiCard label="Paid" value={currency(totalPaid)} icon={Wallet} />
      </div>
      <SectionCard>
        <DataTable
          rows={rows}
          empty={<EmptyState icon={Wallet} title={`Nothing to pay ${label}s yet`} description={kind === "LANDLORD" ? "Collected rent shows here." : "Chosen maintenance orders show here."} />}
          columns={[
            {
              key: "name",
              header: label.charAt(0).toUpperCase() + label.slice(1),
              primary: true,
              render: (r) => (
                <button type="button" className="text-left hover:underline" onClick={() => setDetail(r.id)}>
                  <p className="font-medium text-primary">{r.name}</p>
                  <p className="text-xs text-muted-foreground">{r.sub}</p>
                </button>
              ),
            },
            ...(kind === "LANDLORD"
              ? [
                  { key: "unc", header: "Rent not yet paid", hideOnMobile: true, render: (r: (typeof rows)[number]) => currency(r.statement.uncollected) },
                  { key: "exp", header: "Expenses", hideOnMobile: true, render: (r: (typeof rows)[number]) => currency(-r.statement.deductions.reduce((s, d) => s + d.amount, 0)) },
                ]
              : []),
            { key: "payable", header: kind === "LANDLORD" ? "Payable" : "Total earned", render: (r) => currency(r.statement.payable) },
            { key: "paid", header: "Paid", render: (r) => currency(r.statement.paid + r.statement.pending) },
            { key: "due", header: "Due", render: (r) => <span className="font-semibold">{currency(r.statement.due)}</span> },
            {
              key: "st",
              header: "Status",
              render: (r) => <StatusBadge value={r.statement.due > 0 ? "Due" : r.statement.pending > 0 ? "Pending" : "Paid"} />,
            },
            {
              key: "pay",
              header: "",
              align: "right",
              render: (r) => (
                <Button size="sm" disabled={r.statement.due <= 0} onClick={() => setPaying(r.id)}>
                  Pay
                </Button>
              ),
            },
          ]}
        />
      </SectionCard>

      <Dialog open={!!det} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{det?.name}</DialogTitle>
            <DialogDescription>Transaction history and balance.</DialogDescription>
          </DialogHeader>
          {det ? (
            <StatementView
              statement={det.statement}
              earnedTitle={kind === "LANDLORD" ? "Rent and deductions" : "Orders"}
              showDeductions={kind === "LANDLORD"}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <PaySlipDialog
        open={!!pay}
        onOpenChange={(o) => { if (!o) setPaying(null); }}
        title={`Pay ${pay?.name ?? ""}`}
        description={pay ? `Balance due ${currency(pay.statement.due)}.` : undefined}
        banks={pay && (pay.bank.lines.some(([, v]) => v) || pay.bank.title !== "Bank") ? [pay.bank] : []}
        defaultAmount={pay?.statement.due ?? 0}
        onSubmit={(amount, slip) => payPartner({ kind, partyId: pay!.id, amount, slip })}
      />
    </div>
  );
}

// ---------------- Tenant ----------------
function TenantRent() {
  const { scoped, payments, companyBanks, submitRentPayment } = useApp();
  const [paying, setPaying] = useState<RentSchedule | null>(null);
  const thisMonth = monthKey();
  const rows = scoped.rentSchedules
    .filter((r) => r.due_date.slice(0, 7) <= thisMonth)
    .map((r) => ({ ...r, pending: payments.filter((p) => p.rent_id === r.id && p.status === "Submitted").reduce((s, p) => s + p.amount, 0) }))
    .sort((a, b) => b.due_date.localeCompare(a.due_date));

  return (
    <div className="space-y-5">
      <PageHeader title="My rent" description="This month's rent and your past payments." />
      <SectionCard>
        <DataTable
          rows={rows}
          empty={<EmptyState icon={CreditCard} title="No rent yet" description="Your rent appears once your lease is active." />}
          columns={[
            {
              key: "due",
              header: "Month",
              primary: true,
              render: (r) => (
                <div>
                  <p className="font-medium">{monthLabel(r.due_date.slice(0, 7))}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(r.due_date)}</p>
                </div>
              ),
            },
            { key: "amount", header: "Amount", render: (r) => currency(r.amount) },
            { key: "paid", header: "Paid", render: (r) => currency(r.paid_amount) },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.pending > 0 && r.status !== "Paid" ? "Pending" : r.status} /> },
            {
              key: "pay",
              header: "",
              align: "right",
              render: (r) =>
                r.status === "Paid" ? null : r.pending > 0 ? (
                  <span className="text-xs text-muted-foreground">{currency(r.pending)} waiting confirmation</span>
                ) : (
                  <Button size="sm" onClick={() => setPaying(r)}>
                    Pay
                  </Button>
                ),
            },
          ]}
        />
      </SectionCard>
      <PaySlipDialog
        open={!!paying}
        onOpenChange={(o) => { if (!o) setPaying(null); }}
        title="Pay rent by bank transfer"
        description="Transfer the money to one of these accounts, then upload your bank slip."
        banks={companyBanks.map(companyBankInfo)}
        defaultAmount={paying ? paying.amount - paying.paid_amount : 0}
        onSubmit={(amount, slip) => submitRentPayment(paying!.id, amount, slip)}
      />
    </div>
  );
}

// ---------------- Landlord (read only) ----------------
function RentTable({ title }: { title: string }) {
  const { scoped } = useApp();
  const [month, setMonth] = useState(monthKey());
  const rows = scoped.rentSchedules
    .filter((r) => r.due_date.slice(0, 7) === month)
    .map((r) => ({
      ...r,
      tenantName: scoped.tenants.find((t) => t.id === r.tenant_id)?.full_name ?? "—",
      unitNumber: scoped.units.find((u) => u.id === r.unit_id)?.unit_number ?? "—",
      propertyName: scoped.properties.find((p) => p.id === r.property_id)?.name ?? "—",
    }));
  const totals = rentTotals(rows);
  return (
    <div className="space-y-5">
      <PageHeader title={title} description="Rent billed and collected on your properties." />
      <MonthPicker month={month} setMonth={setMonth} />
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Billed" value={currency(totals.expected)} icon={CreditCard} />
        <KpiCard label="Collected" value={currency(totals.collected)} icon={Wallet} />
        <KpiCard label="Outstanding" value={currency(totals.outstanding)} icon={CreditCard} />
      </div>
      <SectionCard>
        <DataTable
          rows={rows}
          empty={<EmptyState icon={CreditCard} title={`No rent for ${monthLabel(month)}`} description="" />}
          columns={[
            { key: "t", header: "Tenant", primary: true, render: (r) => <div><p className="font-medium">{r.tenantName}</p><p className="text-xs text-muted-foreground">{r.propertyName} · Unit {r.unitNumber}</p></div> },
            { key: "a", header: "Amount", render: (r) => currency(r.amount) },
            { key: "p", header: "Paid", render: (r) => currency(r.paid_amount) },
            { key: "s", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
          ]}
        />
      </SectionCard>
    </div>
  );
}
