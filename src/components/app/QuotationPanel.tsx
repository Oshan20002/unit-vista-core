import { CheckCircle2, HardHat, Loader2, Send, ShieldAlert, Truck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { FileLink } from "@/components/app/FileLink";
import { quoteOptionsFor, useApp, vendorQuoteTotal } from "@/lib/app-store";
import { currency } from "@/lib/format";
import type { MaintenanceTicket } from "@/lib/types";
import { cn } from "@/lib/utils";

function PickDialog({
  open,
  onOpenChange,
  title,
  description,
  options,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  options: { id: string; label: string; sub: string; disabled?: boolean }[];
  onConfirm: (ids: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setPicked([]);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {options.length === 0 ? <li className="text-sm text-muted-foreground">Nobody to choose yet — add them first.</li> : null}
          {options.map((o) => (
            <li key={o.id}>
              <label className={cn("flex items-center gap-3 rounded-lg border border-border p-3", o.disabled && "opacity-50")}>
                <Checkbox
                  disabled={o.disabled}
                  checked={picked.includes(o.id)}
                  onCheckedChange={(c) => setPicked(c ? [...picked, o.id] : picked.filter((x) => x !== o.id))}
                />
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.sub}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!picked.length || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(picked);
                setPicked([]);
                onOpenChange(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <Send className="size-4" /> Send ({picked.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuotationPanel({ ticket }: { ticket: MaintenanceTicket }) {
  const {
    scoped,
    technicians,
    vendors,
    owners,
    user,
    assignTechnicians,
    requestVendorQuotes,
    sendOptionsToLandlord,
    chooseOption,
  } = useApp();
  const isStaff = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";
  const isLandlord = user?.role === "LANDLORD";
  const [techOpen, setTechOpen] = useState(false);
  const [vendorJob, setVendorJob] = useState<string | null>(null);

  const jobs = scoped.technicianJobs.filter((j) => j.ticket_id === ticket.id);
  const quotes = scoped.vendorQuotes.filter((q) => q.ticket_id === ticket.id);
  const options = quoteOptionsFor(ticket.id, jobs, quotes);
  const owner = owners.find((o) => o.id === ticket.owner_id);
  const limit = owner?.approval_threshold ?? 0;
  // The choice is read from the saved quote/job statuses too, so it survives a refresh.
  const selectedKey =
    ticket.selected_option ??
    quotes.find((q) => q.status === "Selected")?.id ??
    jobs.find((j) => j.status === "Selected" && !j.items.length)?.id ??
    null;
  const decided = ticket.quote_stage === "Approved" || Boolean(selectedKey);
  const awaiting = !decided && ticket.quote_stage === "Awaiting landlord";
  const needsLandlord = (total: number) => limit > 0 && total > limit;
  const anyAbove = options.some((o) => needsLandlord(o.total));
  const techName = (id: string) => technicians.find((t) => t.id === id)?.full_name ?? "Technician";
  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? "Vendor";
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const autoShown = useRef(false);
  const mustAskLandlord = isStaff && !decided && !awaiting && anyAbove;

  useEffect(() => {
    if (mustAskLandlord && !autoShown.current) {
      autoShown.current = true;
      setLandlordOpen(true);
    }
  }, [mustAskLandlord]);

  const pick = async (key: string) => {
    if (mustAskLandlord) {
      setLandlordOpen(true);
      return;
    }
    setBusyKey(key);
    try {
      await chooseOption(ticket.id, key);
      toast.success(isLandlord ? "Approved. The property manager has been notified." : "Option selected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusyKey(null);
    }
  };

  const sendToLandlord = async () => {
    setSending(true);
    try {
      await sendOptionsToLandlord(ticket.id);
      toast.success("Sent to the landlord for approval.");
      setLandlordOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <SectionCard
      title="Quotations"
      description={`Approval limit: ${limit > 0 ? currency(limit) : "not set"}${ticket.quote_stage ? ` · ${ticket.quote_stage}` : ""}`}
    >
      {isStaff && !decided ? (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setTechOpen(true)}>
            <HardHat className="size-4" /> Assign technicians
          </Button>
        </div>
      ) : null}

      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No technicians assigned yet.</p>
      ) : (
        <ul className="space-y-3">
          {jobs.map((j) => {
            const jq = quotes.filter((q) => q.technician_job_id === j.id);
            return (
              <li key={j.id} className="rounded-lg border border-border p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {j.reference} · {techName(j.technician_id)}
                  </p>
                  <StatusBadge value={j.status} />
                </div>
                {j.status === "Assigned" ? (
                  <p className="mt-1 text-xs text-muted-foreground">Waiting for the technician's quotation.</p>
                ) : (
                  <div className="mt-2 space-y-2 text-sm">
                    <p>Labour: <strong>{currency(j.labour_price, 2)}</strong></p>
                    {j.items.length ? (
                      <ul className="list-inside list-disc text-muted-foreground">
                        {j.items.map((i) => (
                          <li key={i.id}>{i.name} × {i.qty}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">No materials needed.</p>
                    )}
                    {j.note ? <p className="text-xs text-muted-foreground">Note: {j.note}</p> : null}
                    {j.attachment ? <FileLink file={j.attachment} /> : null}
                    {isStaff && !decided && j.items.length ? (
                      <Button size="sm" variant="outline" onClick={() => setVendorJob(j.id)}>
                        <Truck className="size-4" /> Send item list to vendors
                      </Button>
                    ) : null}
                  </div>
                )}
                {jq.length ? (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3">
                    {jq.map((q) => (
                      <li key={q.id} className="rounded-md bg-secondary/50 p-2.5 text-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-medium">{q.reference} · {vendorName(q.vendor_id)}</span>
                          <StatusBadge value={q.status} />
                        </div>
                        {q.status !== "Requested" ? (
                          <>
                            <ul className="mt-1 text-xs text-muted-foreground">
                              {q.items.map((i) => (
                                <li key={i.id}>
                                  {i.name}: {i.qty} × {currency(i.unit_price, 2)} = {currency(i.qty * i.unit_price, 2)}
                                </li>
                              ))}
                              <li>Delivery: {currency(q.delivery_charge, 2)}</li>
                            </ul>
                            <p className="mt-1 text-xs">Vendor total: <strong>{currency(vendorQuoteTotal(q), 2)}</strong></p>
                            {q.attachment ? <div className="mt-1"><FileLink file={q.attachment} /></div> : null}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Waiting for vendor prices.</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {options.length ? (
        <div className="mt-5 space-y-2">
          <p className="text-sm font-semibold">Total job value per option (technician + vendor)</p>
          <ul className="space-y-2">
            {options.map((o, idx) => {
              const above = needsLandlord(o.total);
              const selected = selectedKey === o.key;
              const canPick = !decided && ((isLandlord && awaiting) || (isStaff && !awaiting));
              return (
                <li
                  key={o.key}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3",
                    selected ? "border-success bg-success/5" : idx === 0 ? "border-accent" : "border-border",
                    decided && !selected && "opacity-60",
                  )}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {o.job.reference} {techName(o.job.technician_id)}
                      {o.quote ? ` + ${o.quote.reference} ${vendorName(o.quote.vendor_id)}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {currency(o.job.labour_price, 2)} labour
                      {o.quote ? ` + ${currency(vendorQuoteTotal(o.quote), 2)} materials` : ""}
                      {idx === 0 ? " · lowest" : ""}
                      {above ? " · above approval limit" : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{currency(o.total, 2)}</span>
                    {selected ? <StatusBadge value="Selected" /> : decided ? <StatusBadge value="Rejected" /> : null}
                    {canPick ? (
                      <Button size="sm" disabled={busyKey !== null} onClick={() => void pick(o.key)}>
                        {busyKey === o.key ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                        {isLandlord ? "Approve" : "Choose"}
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {mustAskLandlord ? (
            <div className="rounded-lg bg-warning/10 p-3 text-sm">
              <p>
                One or more options are above the landlord's approval limit ({currency(limit, 2)}). The landlord must choose.
              </p>
              <Button size="sm" className="mt-2" onClick={() => setLandlordOpen(true)}>
                <Send className="size-4" /> Send to landlord
              </Button>
            </div>
          ) : null}
          {awaiting && isStaff ? (
            <p className="text-sm text-muted-foreground">Sent to the landlord. Waiting for them to choose one option.</p>
          ) : null}
          {awaiting && isLandlord ? (
            <p className="text-sm text-muted-foreground">Choose one option. The others will be rejected automatically.</p>
          ) : null}
        </div>
      ) : null}

      <Dialog open={landlordOpen} onOpenChange={setLandlordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="size-5 text-warning" /> Landlord approval needed
            </DialogTitle>
            <DialogDescription>
              {owner?.full_name ?? "The landlord"} has an approval limit of {currency(limit, 2)}. At least one option is above it, so you
              can't choose yet. Send all options to the landlord — they will be notified and choose one.
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1.5 text-sm">
            {options.map((o) => (
              <li key={o.key} className="flex justify-between gap-3">
                <span>
                  {o.job.reference}
                  {o.quote ? ` + ${o.quote.reference}` : ""}
                </span>
                <span className={cn("font-medium", needsLandlord(o.total) && "text-warning")}>{currency(o.total, 2)}</span>
              </li>
            ))}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLandlordOpen(false)}>
              Not now
            </Button>
            <Button disabled={sending} onClick={() => void sendToLandlord()}>
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send to landlord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PickDialog
        open={techOpen}
        onOpenChange={setTechOpen}
        title="Assign technicians"
        description="Each technician gets their own job ID and is asked for a quotation."
        options={technicians
          .filter((t) => !t.deleted_at)
          .map((t) => ({
            id: t.id,
            label: t.full_name,
            sub: t.trade || t.email,
            disabled: jobs.some((j) => j.technician_id === t.id),
          }))}
        onConfirm={async (ids) => {
          await assignTechnicians(ticket.id, ids);
          toast.success("Technicians notified.");
        }}
      />
      <PickDialog
        open={Boolean(vendorJob)}
        onOpenChange={(o) => (!o ? setVendorJob(null) : undefined)}
        title="Send item list to vendors"
        description="Each vendor gets their own quotation ID and prices every item."
        options={vendors
          .filter((v) => !v.deleted_at)
          .map((v) => ({
            id: v.id,
            label: v.name,
            sub: v.trade || v.email,
            disabled: quotes.some((q) => q.technician_job_id === vendorJob && q.vendor_id === v.id),
          }))}
        onConfirm={async (ids) => {
          if (vendorJob) await requestVendorQuotes(vendorJob, ids);
          toast.success("Vendors notified.");
        }}
      />
    </SectionCard>
  );
}
