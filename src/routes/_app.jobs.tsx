import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, MapPin, Paperclip, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { FileLink } from "@/components/app/FileLink";
import { WorkOrderPanel } from "@/components/app/WorkOrderPanel";
import { useApp, vendorQuoteTotal } from "@/lib/app-store";
import { currency, formatDateTime } from "@/lib/format";
import type { JobItem, TechnicianJob, VendorQuote } from "@/lib/types";

export const Route = createFileRoute("/_app/jobs")({
  head: () => ({
    meta: [
      { title: "My jobs — Estora" },
      { name: "description", content: "Maintenance jobs and quotation requests assigned to you." },
      { property: "og:title", content: "My jobs — Estora" },
      { property: "og:description", content: "Review job details and send your quotation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JobsPage,
});

function JobsPage() {
  const { scoped, user } = useApp();
  const isTech = user?.role === "TECHNICIAN";
  const list = isTech
    ? [...scoped.technicianJobs].sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [...scoped.vendorQuotes].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="space-y-5">
      <PageHeader
        title={isTech ? "My jobs" : "Quotation requests"}
        description={isTech ? "Review each request and send your price and item list." : "Price each item and add your delivery charge."}
      />
      {list.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing assigned yet" description="You'll get a notification when the property manager sends you work." />
      ) : isTech ? (
        (list as TechnicianJob[]).map((j) => <TechJobCard key={j.id} job={j} />)
      ) : (
        (list as VendorQuote[]).map((q) => <VendorQuoteCard key={q.id} quote={q} />)
      )}
    </div>
  );
}

const newItem = (): JobItem => ({ id: crypto.randomUUID(), name: "", qty: 1 });

function TechJobCard({ job }: { job: TechnicianJob }) {
  const { submitTechnicianQuote, scoped } = useApp();
  const ticket = scoped.maintenanceTickets.find((t) => t.id === job.ticket_id);
  const editable = job.status === "Assigned" || job.status === "Quoted";
  const [labour, setLabour] = useState(String(job.labour_price || ""));
  const [items, setItems] = useState<JobItem[]>(job.items.length ? job.items : [newItem()]);
  const [note, setNote] = useState(job.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const price = Number(labour);
    if (!(price >= 0) || labour === "") return void toast.error("Enter your labour price.");
    const clean = items.filter((i) => i.name.trim());
    if (clean.some((i) => !(i.qty > 0))) return void toast.error("Each item needs a quantity of at least 1.");
    setBusy(true);
    try {
      await submitTechnicianQuote(job.id, { labour_price: price, items: clean.map((i) => ({ ...i, name: i.name.trim() })), note, file });
      toast.success("Quotation sent to the property manager.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard
      title={`${job.reference} · ${job.details.title}`}
      description={`${job.details.reference} · ${job.details.category} · ${job.details.priority} priority`}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={job.status} />
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" /> {job.details.location}
        </span>
      </div>
      <p className="mb-4 text-sm">{job.details.description}</p>
      <div className="space-y-4">
        <div className="space-y-2 sm:max-w-xs">
          <Label>Your labour price (AED)</Label>
          <Input type="number" min={0} disabled={!editable} value={labour} onChange={(e) => setLabour(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Required items (one item per line)</Label>
          {items.map((it, idx) => (
            <div key={it.id} className="flex gap-2">
              <Input
                placeholder={`Item ${idx + 1} name`}
                disabled={!editable}
                value={it.name}
                onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, name: e.target.value } : x)))}
              />
              <Input
                type="number"
                min={1}
                className="w-24"
                aria-label="Quantity"
                disabled={!editable}
                value={it.qty}
                onChange={(e) => setItems(items.map((x) => (x.id === it.id ? { ...x, qty: Number(e.target.value) } : x)))}
              />
              {editable ? (
                <Button variant="ghost" size="icon" aria-label="Remove item" onClick={() => setItems(items.filter((x) => x.id !== it.id))}>
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
          {editable ? (
            <Button variant="outline" size="sm" onClick={() => setItems([...items, newItem()])}>
              <Plus className="size-4" /> Add item
            </Button>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea rows={2} disabled={!editable} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Attach a file (optional)</Label>
          {job.attachment ? <FileLink file={job.attachment} /> : null}
          {editable ? <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /> : null}
        </div>
        {editable ? (
          <Button onClick={send} disabled={busy}>
            <Send className="size-4" /> {job.status === "Quoted" ? "Update quotation" : "Send quotation"}
          </Button>
        ) : null}
        {job.quoted_at ? <p className="text-xs text-muted-foreground">Last sent {formatDateTime(job.quoted_at)}</p> : null}
      </div>
      {job.status === "Selected" && ticket ? <div className="mt-5"><WorkOrderPanel ticket={ticket} /></div> : null}
    </SectionCard>
  );
}

function VendorQuoteCard({ quote }: { quote: VendorQuote }) {
  const { submitVendorQuote, scoped } = useApp();
  const ticket = scoped.maintenanceTickets.find((t) => t.id === quote.ticket_id);
  const editable = quote.status === "Requested" || quote.status === "Quoted";
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries(quote.items.map((i) => [i.id, i.unit_price ? String(i.unit_price) : ""])),
  );
  const [delivery, setDelivery] = useState(quote.delivery_charge ? String(quote.delivery_charge) : "");
  const [note, setNote] = useState(quote.note ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const live: VendorQuote = {
    ...quote,
    items: quote.items.map((i) => ({ ...i, unit_price: Number(prices[i.id]) || 0 })),
    delivery_charge: Number(delivery) || 0,
  };
  const total = vendorQuoteTotal(live);

  const send = async () => {
    if (quote.items.some((i) => prices[i.id] === "" || !(Number(prices[i.id]) >= 0)))
      return void toast.error("Enter a unit price for every item.");
    setBusy(true);
    try {
      await submitVendorQuote(quote.id, {
        unit_prices: Object.fromEntries(quote.items.map((i) => [i.id, Number(prices[i.id])])),
        delivery_charge: Number(delivery) || 0,
        note,
        file,
      });
      toast.success("Quotation sent to the property manager.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard title={quote.reference} description={`Requested ${formatDateTime(quote.created_at)}`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StatusBadge value={quote.status} />
        <span className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" /> Delivery: {quote.delivery_location}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Item</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Unit price</th>
              <th className="py-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {live.items.map((i) => (
              <tr key={i.id}>
                <td className="py-2 pr-2 font-medium">{i.name}</td>
                <td className="py-2 pr-2">{i.qty}</td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    min={0}
                    className="w-28"
                    disabled={!editable}
                    value={prices[i.id] ?? ""}
                    onChange={(e) => setPrices({ ...prices, [i.id]: e.target.value })}
                  />
                </td>
                <td className="py-2 text-right">{currency(i.qty * i.unit_price, 2)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2 font-medium" colSpan={2}>Delivery charge</td>
              <td className="py-2">
                <Input type="number" min={0} className="w-28" disabled={!editable} value={delivery} onChange={(e) => setDelivery(e.target.value)} />
              </td>
              <td className="py-2 text-right">{currency(Number(delivery) || 0, 2)}</td>
            </tr>
            <tr>
              <td className="py-3 font-semibold" colSpan={3}>Total</td>
              <td className="py-3 text-right font-semibold">{currency(total, 2)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea rows={2} disabled={!editable} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="flex items-center gap-1"><Paperclip className="size-4" /> Attach a document (optional)</Label>
          {quote.attachment ? <FileLink file={quote.attachment} /> : null}
          {editable ? <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /> : null}
        </div>
        {editable ? (
          <Button onClick={send} disabled={busy}>
            <Send className="size-4" /> {quote.status === "Quoted" ? "Update quotation" : "Send quotation"}
          </Button>
        ) : null}
      </div>
      {quote.status === "Selected" && ticket ? <div className="mt-5"><WorkOrderPanel ticket={ticket} /></div> : null}
    </SectionCard>
  );
}
