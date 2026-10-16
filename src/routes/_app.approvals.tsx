import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { QuotationPanel } from "@/components/app/QuotationPanel";
import { useApp } from "@/lib/app-store";
import { currency, formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/approvals")({
  head: () => ({
    meta: [
      { title: "Approvals — Estora" },
      { name: "description", content: "Owner approval requests for maintenance quotations and portfolio spend." },
      { property: "og:title", content: "Approvals — Estora" },
      { property: "og:description", content: "Review, approve or reject spend requests with a full audit trail." },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { scoped, decideApproval, user } = useApp();
  const [status, setStatus] = useState("all");
  const [reject, setReject] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const canDecide = user?.role === "LANDLORD" || user?.role === "ADMIN";

  const rows = useMemo(
    () =>
      scoped.approvals
        .filter((a) => (status === "all" ? true : a.status === status))
        .map((a) => ({
          ...a,
          propertyName: scoped.properties.find((p) => p.id === a.property_id)?.name ?? "—",
          unitNumber: scoped.units.find((u) => u.id === a.unit_id)?.unit_number ?? "—",
          vendorName: scoped.vendors.find((v) => v.id === a.vendor_id)?.name ?? "—",
        }))
        .sort((a, b) => b.requested_at.localeCompare(a.requested_at)),
    [scoped, status],
  );

  const pending = scoped.approvals.filter((a) => a.status === "Pending");
  const pendingValue = pending.reduce((s, a) => s + a.amount, 0);

  const confirmReject = () => {
    if (!reject) return;
    if (reason.trim().length < 4) {
      toast.error("Please give a short reason for rejecting.");
      return;
    }
    decideApproval(reject, "Rejected", reason.trim());
    toast.success("Request rejected.");
    setReject(null);
    setReason("");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Approvals" description="Spend requests waiting on an owner decision." />

      {scoped.maintenanceTickets.filter((t) => t.quote_stage === "Awaiting landlord").length ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Maintenance quotations waiting for approval</h2>
          {scoped.maintenanceTickets
            .filter((t) => t.quote_stage === "Awaiting landlord")
            .map((t) => (
              <div key={t.id} className="space-y-1">
                <p className="text-sm text-muted-foreground">
                  {t.reference} · {t.title}
                </p>
                <QuotationPanel ticket={t} />
              </div>
            ))}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Pending requests" value={pending.length} icon={ClipboardCheck} />
        <KpiCard label="Pending value" value={currency(pendingValue)} icon={ClipboardCheck} />
        <KpiCard
          label="Approved this period"
          value={scoped.approvals.filter((a) => a.status === "Approved").length}
          icon={ClipboardCheck}
        />
      </div>

      <Select value={status} onValueChange={setStatus}>
        <SelectTrigger className="sm:w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All requests</SelectItem>
          {["Pending", "Approved", "Rejected"].map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="Nothing to approve" description="New spend requests will show up here." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((a) => (
            <SectionCard key={a.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.reference} · {a.propertyName} · Unit {a.unitNumber}
                  </p>
                </div>
                <StatusBadge value={a.status} />
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{a.description}</p>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-muted-foreground">Amount</dt>
                  <dd className="font-semibold">{currency(a.amount)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Vendor</dt>
                  <dd className="font-medium">{a.vendorName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Requested</dt>
                  <dd className="font-medium">{formatDate(a.requested_at)}</dd>
                </div>
              </dl>
              {a.rejection_reason ? (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  Rejected: {a.rejection_reason}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                {a.ticket_id ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/maintenance/$ticketId" params={{ ticketId: a.ticket_id }}>
                      View ticket
                    </Link>
                  </Button>
                ) : null}
                {a.status === "Pending" && canDecide ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        decideApproval(a.id, "Approved");
                        toast.success("Request approved.");
                      }}
                    >
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setReject(a.id)}>
                      Reject
                    </Button>
                  </>
                ) : null}
              </div>
            </SectionCard>
          ))}
        </div>
      )}

      <Dialog open={!!reject} onOpenChange={(o) => !o && setReject(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject request</DialogTitle>
            <DialogDescription>The property manager will see your reason.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for rejection" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReject(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmReject}>
              Reject request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
