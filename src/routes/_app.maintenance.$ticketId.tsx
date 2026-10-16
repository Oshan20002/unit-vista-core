import { createFileRoute, Link, useNavigate, useParams } from "@tanstack/react-router";
import { ArrowLeft, Paperclip, Send, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/app/EmptyState";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { QuotationPanel } from "@/components/app/QuotationPanel";
import { WorkOrderPanel } from "@/components/app/WorkOrderPanel";
import { useApp } from "@/lib/app-store";
import { currency, formatDate, formatDateTime } from "@/lib/format";
import type { TicketStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/maintenance/$ticketId")({
  head: () => ({
    meta: [
      { title: "Maintenance ticket — Estora" },
      { name: "description", content: "Ticket timeline, vendor assignment, costs and communication history." },
      { property: "og:title", content: "Maintenance ticket — Estora" },
      { property: "og:description", content: "Follow a maintenance request from report to resolution." },
    ],
  }),
  component: TicketDetail,
});

const STATUSES: TicketStatus[] = ["NEW", "UNDER REVIEW", "ASSIGNED", "IN PROGRESS", "COMPLETED", "CLOSED"];

function TicketDetail() {
  const { ticketId } = useParams({ from: "/_app/maintenance/$ticketId" });
  const { scoped, updateTicket, addTicketNote, user } = useApp();
  const navigate = useNavigate();
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);

  const ticket = scoped.maintenanceTickets.find((t) => t.id === ticketId);
  const canManage = user?.role === "ADMIN" || user?.role === "PROPERTY_MANAGER";

  if (!ticket) {
    return (
      <EmptyState
        icon={Wrench}
        title="Ticket not found"
        description="This ticket may have been closed or you don't have access to it."
        action={
          <Button asChild>
            <Link to="/maintenance">Back to maintenance</Link>
          </Button>
        }
      />
    );
  }

  const property = scoped.properties.find((p) => p.id === ticket.property_id);
  const unit = scoped.units.find((u) => u.id === ticket.unit_id);
  const tenant = scoped.tenants.find((t) => t.id === ticket.tenant_id);
  const visibleNotes = ticket.notes.filter((n) => (user?.role === "TENANT" ? !n.internal : true));

  const postNote = () => {
    if (note.trim().length < 2) {
      toast.error("Write a message before sending.");
      return;
    }
    addTicketNote(ticket.id, note.trim(), internal);
    setNote("");
    toast.success("Update posted.");
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" onClick={() => void navigate({ to: "/maintenance" })}>
        <ArrowLeft className="size-4" /> Maintenance
      </Button>

      <PageHeader
        title={ticket.title}
        description={`${ticket.reference} · ${property?.name ?? "—"} · Unit ${unit?.unit_number ?? "—"}`}
        actions={
          <>
            <StatusBadge value={ticket.priority} />
            <StatusBadge value={ticket.status} />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <SectionCard title="Issue details">
            <p className="text-sm text-foreground">{ticket.description}</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Category" value={ticket.category} />
              <Field label="Reported" value={formatDateTime(ticket.created_at)} />
              <Field label="SLA due" value={formatDate(ticket.sla_due_at)} />
              <Field label="Tenant" value={tenant?.full_name ?? "—"} />
              <Field label="Estimated cost" value={ticket.estimated_cost ? currency(ticket.estimated_cost) : "—"} />
              <Field label="Actual cost" value={ticket.actual_cost ? currency(ticket.actual_cost) : "—"} />
            </dl>
            {ticket.attachments.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {ticket.attachments.map((a) => (
                  <li key={a.name} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    {a.name} <span className="text-muted-foreground">{a.size}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </SectionCard>

          {user?.role !== "TENANT" ? <QuotationPanel ticket={ticket} /> : null}
          <WorkOrderPanel ticket={ticket} />

          <SectionCard title="Activity timeline" description="Every status change and action" padded={false}>
            <ol className="space-y-0 divide-y divide-border">
              {ticket.timeline.map((e, i) => (
                <li key={`${e.at}-${i}`} className="flex gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm">{e.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {e.actor} · {formatDateTime(e.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Communication" description="Updates shared on this ticket">
            <ul className="space-y-3">
              {visibleNotes.length ? (
                visibleNotes.map((n, i) => (
                  <li key={`${n.at}-${i}`} className="rounded-lg border border-border bg-surface p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{n.author}</p>
                      <span className="text-xs text-muted-foreground">{formatDateTime(n.at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                    {n.internal ? (
                      <span className="mt-2 inline-block rounded-md bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-warning">
                        Internal note
                      </span>
                    ) : null}
                  </li>
                ))
              ) : (
                <li className="text-sm text-muted-foreground">No messages yet.</li>
              )}
            </ul>

            <div className="mt-4 space-y-3">
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Write an update…" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                {canManage ? (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Switch checked={internal} onCheckedChange={setInternal} /> Internal only
                  </label>
                ) : (
                  <span />
                )}
                <Button onClick={postNote}>
                  <Send className="size-4" /> Post update
                </Button>
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4">
          <SectionCard title="Manage ticket" description={canManage ? "Update status, vendor and costs" : "Read-only for your role"}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={ticket.status}
                  disabled={!canManage}
                  onValueChange={(v) => {
                    updateTicket(ticket.id, { status: v as TicketStatus }, `Status changed to ${v}`);
                    toast.success(`Ticket moved to ${v}.`);
                  }}
                >
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
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select
                  value={ticket.vendor_id ?? ""}
                  disabled={!canManage}
                  onValueChange={(v) => {
                    const vendor = scoped.vendors.find((x) => x.id === v);
                    updateTicket(ticket.id, { vendor_id: v, status: "ASSIGNED" }, `Assigned to ${vendor?.name ?? "vendor"}`);
                    toast.success(`Assigned to ${vendor?.name}.`);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Assign a vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {scoped.vendors.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} · {v.trade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="t-cost">Actual cost</Label>
                <Input
                  id="t-cost"
                  type="number"
                  disabled={!canManage}
                  defaultValue={ticket.actual_cost ?? 0}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== (ticket.actual_cost ?? 0)) {
                      updateTicket(ticket.id, { actual_cost: value }, `Actual cost set to ${currency(value)}`);
                      toast.success("Cost updated.");
                    }
                  }}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Location">
            <dl className="space-y-3 text-sm">
              <Field label="Property" value={property?.name ?? "—"} />
              <Field label="Address" value={property ? `${property.address}, ${property.city}` : "—"} />
              <Field label="Unit" value={unit ? `${unit.unit_number} · ${unit.unit_type}` : "—"} />
            </dl>
            {property ? (
              <Button variant="outline" className="mt-4 w-full" asChild>
                <Link to="/properties/$propertyId" params={{ propertyId: property.id }}>
                  View property
                </Link>
              </Button>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}
