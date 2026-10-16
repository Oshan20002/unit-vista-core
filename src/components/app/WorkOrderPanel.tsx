import { CalendarCheck, CheckCircle2, Plus, Star, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SectionCard } from "@/components/app/PageHeader";
import { earliestWorkDate, useApp } from "@/lib/app-store";
import type { MaintenanceTicket, WorkSlot } from "@/lib/types";
import { cn } from "@/lib/utils";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function useRun() {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

/** Delivery → booking → work done → feedback, after an option was chosen. */
export function WorkOrderPanel({ ticket }: { ticket: MaintenanceTicket }) {
  const { user, vendorQuotes, technicianJobs } = useApp();
  if (!ticket.selected_option) return null;
  const quote = vendorQuotes.find((q) => q.id === ticket.selected_option);
  const job =
    technicianJobs.find((j) => j.id === (quote ? quote.technician_job_id : ticket.selected_option)) ??
    technicianJobs.find((j) => j.ticket_id === ticket.id && j.status === "Selected");
  const wo = ticket.work_order ?? {};
  const role = user?.role;
  const isVendor = role === "VENDOR" && quote && quote.vendor_id === user?.vendor_id;
  const isTech = role === "TECHNICIAN" && job && job.technician_id === user?.technician_id;
  const isTenant = role === "TENANT";
  const needsDelivery = Boolean(quote);
  const deliveryDone = !needsDelivery || Boolean(wo.vendor_confirmed_at);
  const booked = wo.slots?.find((s) => s.id === wo.booked_slot_id);

  const steps = [
    { label: "Vendor order & delivery", done: deliveryDone, show: needsDelivery, detail: wo.delivery_date ? `Delivery ${wo.delivery_date}` : "Waiting for vendor" },
    { label: "Technician suggests dates", done: Boolean(wo.slots?.length), show: true, detail: wo.slots?.length ? `${wo.slots.length} dates` : "Waiting" },
    { label: "Tenant books a visit", done: Boolean(booked), show: true, detail: booked ? fmt(booked.start) : "Waiting" },
    { label: "Work done", done: Boolean(wo.completed_at), show: true, detail: wo.completed_at ? fmt(wo.completed_at) : "Waiting" },
    { label: "Tenant feedback", done: Boolean(wo.feedback_at), show: true, detail: wo.rating ? `${wo.rating}/5` : "Waiting" },
  ].filter((s) => s.show);

  return (
    <SectionCard title="Work order" description="Delivery, visit booking, completion and feedback.">
      <ol className="mb-5 grid gap-2 sm:grid-cols-5">
        {steps.map((s) => (
          <li key={s.label} className={cn("rounded-lg border p-3 text-sm", s.done ? "border-primary/40 bg-primary/5" : "border-border")}>
            <p className="flex items-center gap-1 font-medium">
              {s.done ? <CheckCircle2 className="size-4 text-primary" /> : null}
              {s.label}
            </p>
            <p className="text-xs text-muted-foreground">{s.detail}</p>
          </li>
        ))}
      </ol>

      {isVendor && !wo.vendor_confirmed_at ? <VendorConfirm ticketId={ticket.id} /> : null}
      {isTech && deliveryDone && !booked ? <TechSlots ticketId={ticket.id} deliveryDate={wo.delivery_date} existing={wo.slots} /> : null}
      {isTech && needsDelivery && !deliveryDone ? (
        <p className="text-sm text-muted-foreground">Waiting for the vendor to confirm the delivery date before you can suggest dates.</p>
      ) : null}

      {wo.slots?.length && !booked ? (
        <SlotList ticketId={ticket.id} slots={wo.slots} canBook={isTenant} />
      ) : null}
      {booked ? (
        <p className="mb-3 flex items-center gap-2 text-sm">
          <CalendarCheck className="size-4 text-primary" /> Visit booked: <strong>{fmt(booked.start)}</strong> · about {booked.duration_hours}h
        </p>
      ) : null}
      {isTech && booked && !wo.completed_at ? <CompleteButton ticketId={ticket.id} /> : null}
      {isTenant && wo.completed_at && !wo.feedback_at ? <FeedbackForm ticketId={ticket.id} /> : null}
      {wo.feedback_at ? (
        <div className="rounded-lg border border-border p-3 text-sm">
          <Stars value={wo.rating ?? 0} />
          {wo.feedback ? <p className="mt-1">{wo.feedback}</p> : null}
        </div>
      ) : null}
    </SectionCard>
  );
}

function VendorConfirm({ ticketId }: { ticketId: string }) {
  const { confirmVendorOrder } = useApp();
  const { busy, run } = useRun();
  const today = earliestWorkDate(undefined);
  const [date, setDate] = useState("");
  return (
    <div className="mb-4 space-y-2 rounded-lg border border-border p-4">
      <p className="flex items-center gap-2 text-sm font-medium"><Truck className="size-4" /> Confirm the order</p>
      <Label htmlFor={`dd-${ticketId}`}>Estimated delivery date</Label>
      <div className="flex flex-wrap gap-2">
        <Input id={`dd-${ticketId}`} type="date" min={today} className="w-48" value={date} onChange={(e) => setDate(e.target.value)} />
        <Button
          disabled={busy || !date}
          onClick={() => run(() => confirmVendorOrder(ticketId, date), "Order confirmed. The property manager was notified.")}
        >
          Confirm order
        </Button>
      </div>
    </div>
  );
}

const blankSlot = (): WorkSlot => ({ id: crypto.randomUUID(), start: "", duration_hours: 2, preferred: false });

function TechSlots({ ticketId, deliveryDate, existing }: { ticketId: string; deliveryDate?: string | undefined; existing?: WorkSlot[] | undefined }) {
  const { proposeSlots } = useApp();
  const { busy, run } = useRun();
  const earliest = earliestWorkDate(deliveryDate);
  const [slots, setSlots] = useState<WorkSlot[]>(
    existing?.length ? existing.map((s) => ({ ...s, start: s.start.slice(0, 16) })) : [blankSlot(), blankSlot(), blankSlot()],
  );
  const set = (id: string, patch: Partial<WorkSlot>) => setSlots(slots.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const send = () => {
    const filled = slots.filter((s) => s.start);
    if (filled.length < 3) return void toast.error("Enter at least 3 dates & times.");
    if (filled.some((s) => !(s.duration_hours > 0))) return void toast.error("Enter the estimated duration for each date.");
    void run(
      () => proposeSlots(ticketId, filled.map((s) => ({ ...s, start: new Date(s.start).toISOString() }))),
      "Dates sent to the tenant and property manager.",
    );
  };

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">Suggest at least 3 free dates & times</p>
      <p className="text-xs text-muted-foreground">Available from {earliest}{deliveryDate ? ` (day after delivery on ${deliveryDate})` : ""}. Tick ★ for the one you think is best.</p>
      {slots.map((s, i) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2">
          <Input
            type="datetime-local"
            aria-label={`Date ${i + 1}`}
            min={`${earliest}T00:00`}
            className="w-56"
            value={s.start}
            onChange={(e) => set(s.id, { start: e.target.value })}
          />
          <Input
            type="number"
            min={0.5}
            step={0.5}
            aria-label="Estimated hours"
            className="w-24"
            value={s.duration_hours}
            onChange={(e) => set(s.id, { duration_hours: Number(e.target.value) })}
          />
          <span className="text-xs text-muted-foreground">hours</span>
          <Button
            type="button"
            variant={s.preferred ? "default" : "outline"}
            size="sm"
            onClick={() => setSlots(slots.map((x) => ({ ...x, preferred: x.id === s.id ? !x.preferred : false })))}
          >
            <Star className="size-4" /> Best
          </Button>
          {slots.length > 3 ? (
            <Button variant="ghost" size="icon" aria-label="Remove date" onClick={() => setSlots(slots.filter((x) => x.id !== s.id))}>
              <Trash2 className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setSlots([...slots, blankSlot()])}>
          <Plus className="size-4" /> Add date
        </Button>
        <Button size="sm" disabled={busy} onClick={send}>
          {existing?.length ? "Update dates" : "Send dates"}
        </Button>
      </div>
    </div>
  );
}

function SlotList({ ticketId, slots, canBook }: { ticketId: string; slots: WorkSlot[]; canBook: boolean }) {
  const { bookSlot } = useApp();
  const { busy, run } = useRun();
  return (
    <div className="mb-4 space-y-2">
      <p className="text-sm font-medium">{canBook ? "Choose a visit date & time" : "Suggested dates"}</p>
      {[...slots].sort((a, b) => a.start.localeCompare(b.start)).map((s) => (
        <div key={s.id} className={cn("flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm", s.preferred ? "border-primary/50 bg-primary/5" : "border-border")}>
          <span>
            {fmt(s.start)} · about {s.duration_hours}h
            {s.preferred ? <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-xs text-primary-foreground">Technician's pick</span> : null}
          </span>
          {canBook ? (
            <Button size="sm" disabled={busy} onClick={() => run(() => bookSlot(ticketId, s.id), "Visit booked.")}>
              Choose
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function CompleteButton({ ticketId }: { ticketId: string }) {
  const { completeWork } = useApp();
  const { busy, run } = useRun();
  return (
    <Button className="mb-3" disabled={busy} onClick={() => run(() => completeWork(ticketId), "Marked as done.")}>
      <CheckCircle2 className="size-4" /> Mark work as done
    </Button>
  );
}

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          onClick={() => onChange?.(n)}
          className={cn(n <= value ? "text-primary" : "text-muted-foreground/40")}
        >
          <Star className="size-6" fill={n <= value ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function FeedbackForm({ ticketId }: { ticketId: string }) {
  const { submitFeedback } = useApp();
  const { busy, run } = useRun();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <p className="text-sm font-medium">How was the work?</p>
      <Stars value={rating} onChange={setRating} />
      <Textarea rows={3} placeholder="Your comment (optional)" value={comment} onChange={(e) => setComment(e.target.value)} />
      <Button disabled={busy || !rating} onClick={() => run(() => submitFeedback(ticketId, rating, comment.trim()), "Thanks for your feedback!")}>
        Send feedback
      </Button>
    </div>
  );
}
