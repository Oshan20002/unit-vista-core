import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Plus, Wrench } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/app/DataTable";
import { EmptyState } from "@/components/app/EmptyState";
import { KpiCard } from "@/components/app/KpiCard";
import { PageHeader, SectionCard } from "@/components/app/PageHeader";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useApp } from "@/lib/app-store";
import { currency, downloadCsv, formatDate } from "@/lib/format";
import type { Priority, TicketCategory, TicketStatus } from "@/lib/types";

export const Route = createFileRoute("/_app/maintenance/")({
  head: () => ({
    meta: [
      { title: "Maintenance — Estora" },
      { name: "description", content: "Log, triage and track maintenance tickets with SLA timers and vendor assignment." },
      { property: "og:title", content: "Maintenance — Estora" },
      { property: "og:description", content: "The maintenance workflow from report to closure, in one queue." },
    ],
  }),
  component: MaintenancePage,
});

const CATEGORIES: TicketCategory[] = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Pest Control",
  "Painting",
  "Cleaning",
  "Appliance Repair",
  "Emergency",
  "Other",
];
const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Emergency"];
const STATUSES: TicketStatus[] = ["NEW", "UNDER REVIEW", "ASSIGNED", "IN PROGRESS", "COMPLETED", "CLOSED"];

function MaintenancePage() {
  const { scoped, createTicket, user } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [open, setOpen] = useState(false);

  const tenantUnit = scoped.units[0];
  const [form, setForm] = useState({
    property_id: "",
    unit_id: "",
    category: "Plumbing" as TicketCategory,
    title: "",
    description: "",
    priority: "Medium" as Priority,
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scoped.maintenanceTickets
      .filter((t) => (status === "all" ? true : t.status === status))
      .filter((t) => (priority === "all" ? true : t.priority === priority))
      .map((t) => ({
        ...t,
        propertyName: scoped.properties.find((p) => p.id === t.property_id)?.name ?? "—",
        unitNumber: scoped.units.find((u) => u.id === t.unit_id)?.unit_number ?? "—",
        vendorName: scoped.vendors.find((v) => v.id === t.vendor_id)?.name ?? "Unassigned",
      }))
      .filter((t) => (q ? `${t.reference} ${t.title} ${t.propertyName} ${t.unitNumber}`.toLowerCase().includes(q) : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [scoped, query, status, priority]);

  const openCount = scoped.maintenanceTickets.filter((t) => t.status !== "CLOSED" && t.status !== "COMPLETED").length;
  const emergency = scoped.maintenanceTickets.filter((t) => t.priority === "Emergency" && t.status !== "CLOSED").length;
  const spend = scoped.maintenanceTickets.reduce((s, t) => s + (t.actual_cost ?? 0), 0);

  const submit = () => {
    const unitId = form.unit_id || tenantUnit?.id;
    const unit = scoped.units.find((u) => u.id === unitId);
    if (!unit) {
      toast.error("Select the unit this request relates to.");
      return;
    }
    if (form.title.trim().length < 4) {
      toast.error("Give the request a short descriptive title.");
      return;
    }
    if (form.description.trim().length < 10) {
      toast.error("Please describe the issue in a little more detail.");
      return;
    }
    const ticket = createTicket({
      property_id: unit.property_id,
      unit_id: unit.id,
      category: form.category,
      title: form.title,
      description: form.description,
      priority: form.priority,
    });
    setOpen(false);
    toast.success(`Ticket ${ticket.reference} created.`);
    void navigate({ to: "/maintenance/$ticketId", params: { ticketId: ticket.id } });
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Maintenance"
        description="Every reported issue, from first report through to closure."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "maintenance",
                  rows.map((t) => ({
                    Reference: t.reference,
                    Title: t.title,
                    Property: t.propertyName,
                    Unit: t.unitNumber,
                    Category: t.category,
                    Priority: t.priority,
                    Status: t.status,
                    Cost: t.actual_cost ?? 0,
                  })),
                )
              }
            >
              <Download className="size-4" /> Export
            </Button>
            <Button onClick={() => setOpen(true)}>
              <Plus className="size-4" /> New request
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open tickets" value={openCount} icon={Wrench} />
        <KpiCard label="Emergencies" value={emergency} hint="Requires immediate attention" icon={Wrench} />
        <KpiCard label="Total tickets" value={scoped.maintenanceTickets.length} icon={Wrench} />
        <KpiCard label="Maintenance spend" value={currency(spend)} icon={Wrench} />
      </div>

      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Input placeholder="Search tickets" value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-48">
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
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SectionCard>
        <DataTable
          rows={rows}
          onRowClick={(t) => void navigate({ to: "/maintenance/$ticketId", params: { ticketId: t.id } })}
          empty={
            <EmptyState
              icon={Wrench}
              title="No maintenance tickets"
              description="Raise a request and it will appear in the queue."
              action={<Button onClick={() => setOpen(true)}>New request</Button>}
            />
          }
          columns={[
            {
              key: "title",
              header: "Ticket",
              primary: true,
              render: (t) => (
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.reference} · {t.propertyName} · {t.unitNumber}
                  </p>
                </div>
              ),
            },
            { key: "cat", header: "Category", render: (t) => t.category },
            { key: "priority", header: "Priority", render: (t) => <StatusBadge value={t.priority} /> },
            { key: "vendor", header: "Vendor", hideOnMobile: true, render: (t) => t.vendorName },
            { key: "created", header: "Raised", render: (t) => formatDate(t.created_at) },
            { key: "sla", header: "SLA due", hideOnMobile: true, render: (t) => formatDate(t.sla_due_at) },
            { key: "status", header: "Status", render: (t) => <StatusBadge value={t.status} /> },
          ]}
        />
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New maintenance request</DialogTitle>
            <DialogDescription>Describe the issue so the team can triage it quickly.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {user?.role !== "TENANT" ? (
              <div className="space-y-2">
                <Label>Unit</Label>
                <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
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
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="m-title">Title</Label>
              <Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Air conditioning not cooling" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as TicketCategory })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as Priority })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-desc">Description</Label>
              <Textarea
                id="m-desc"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Tell us what's happening, when it started and any access notes."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submit}>Submit request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
