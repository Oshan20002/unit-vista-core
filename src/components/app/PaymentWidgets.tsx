import { useEffect, useState } from "react";
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
import { FileLink } from "@/components/app/FileLink";
import { KpiCard } from "@/components/app/KpiCard";
import { SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { currency, formatDate } from "@/lib/format";
import type { Statement } from "@/lib/payouts";
import { CheckCircle2, Clock, Wallet } from "lucide-react";

export interface BankInfo {
  title: string;
  lines: [string, string | undefined][];
}

export function BankCard({ bank }: { bank: BankInfo }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-3 text-sm">
      <p className="font-medium">{bank.title}</p>
      <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {bank.lines.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono">{v || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Shows the receiver's bank details, then asks for an amount and a slip. */
export function PaySlipDialog({
  open,
  onOpenChange,
  title,
  description,
  banks,
  defaultAmount,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string | undefined;
  banks: BankInfo[];
  defaultAmount: number;
  onSubmit: (amount: number, slip: File | null) => Promise<void>;
}) {
  const [amount, setAmount] = useState(defaultAmount);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setAmount(defaultAmount);
      setFile(null);
    }
  }, [open, defaultAmount]);

  const submit = async () => {
    if (!(amount > 0)) {
      toast.error("Enter the amount you paid.");
      return;
    }
    if (!file) {
      toast.error("Upload the bank slip / receipt.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit(amount, file);
      toast.success("Payment submitted.");
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not submit the payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <Label>Pay to this bank account</Label>
            {banks.length ? (
              <div className="grid gap-2">
                {banks.map((b, i) => (
                  <BankCard key={i} bank={b} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-destructive">No bank details have been added yet.</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-amt">Amount paid (AED)</Label>
            <Input id="pay-amt" type="number" min={0} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-slip">Bank slip / receipt</Label>
            <Input id="pay-slip" type="file" accept="image/*,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy}>
            Submit as paid
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Earnings, deductions, how the final amount is calculated, and payment history. */
export function StatementView({
  statement,
  earnedTitle,
  showDeductions,
  onConfirm,
}: {
  statement: Statement;
  earnedTitle: string;
  showDeductions?: boolean;
  onConfirm?: (paymentId: string) => Promise<void>;
}) {
  const s = statement;
  const earnedTotal = s.earned.reduce((a, b) => a + b.amount, 0);
  const lines = [...s.earned, ...(showDeductions ? s.deductions : [])].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Due (not paid)" value={currency(s.due)} icon={Wallet} />
        <KpiCard label="Waiting confirmation" value={currency(s.pending)} icon={Clock} />
        <KpiCard label="Paid & confirmed" value={currency(s.paid)} icon={CheckCircle2} />
      </div>
      {showDeductions ? (
        <SectionCard title="How the payable amount is calculated">
          <div className="grid gap-1 p-4 text-sm">
            <Row label="Rent collected" value={earnedTotal} />
            {(["Vendor", "Technician", "Management fee"] as const).map((k) => (
              <Row key={k} label={`− ${k} payments`} value={s.deductions.filter((d) => d.label === k).reduce((a, b) => a + b.amount, 0)} />
            ))}
            <Row label="= Payable to landlord" value={s.payable} strong />
            <Row label="− Already paid" value={-(s.paid + s.pending)} />
            <Row label="= Balance due" value={s.due} strong />
          </div>
        </SectionCard>
      ) : null}
      <SectionCard title={earnedTitle}>
        <DataTable
          rows={lines}
          empty={<p className="p-6 text-center text-sm text-muted-foreground">No transactions yet.</p>}
          columns={[
            { key: "date", header: "Date", primary: true, render: (r) => formatDate(r.date) },
            { key: "label", header: "Type", render: (r) => r.label },
            { key: "detail", header: "Details", render: (r) => <span className="text-xs">{r.detail}</span> },
            {
              key: "amt",
              header: "Amount",
              align: "right",
              render: (r) => <span className={r.amount < 0 ? "text-destructive" : ""}>{currency(r.amount)}</span>,
            },
          ]}
        />
      </SectionCard>
      <SectionCard title="Payments">
        <DataTable
          rows={s.payments}
          empty={<p className="p-6 text-center text-sm text-muted-foreground">No payments yet.</p>}
          columns={[
            { key: "date", header: "Date", primary: true, render: (p) => formatDate(p.created_at) },
            { key: "amt", header: "Amount", render: (p) => currency(p.amount) },
            { key: "slip", header: "Slip", render: (p) => (p.slip ? <FileLink file={p.slip} /> : "—") },
            {
              key: "st",
              header: "Status",
              render: (p) => <StatusBadge value={p.status === "Confirmed" ? "Paid" : "Pending"} />,
            },
            {
              key: "act",
              header: "",
              align: "right",
              render: (p) =>
                onConfirm && p.status === "Submitted" ? (
                  <ConfirmButton onConfirm={() => onConfirm(p.id)} />
                ) : null,
            },
          ]}
        />
      </SectionCard>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "border-t border-border pt-1 font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{currency(value)}</span>
    </div>
  );
}

function ConfirmButton({ onConfirm }: { onConfirm: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onConfirm();
          toast.success("Payment confirmed.");
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not confirm.");
        } finally {
          setBusy(false);
        }
      }}
    >
      Confirm received
    </Button>
  );
}
