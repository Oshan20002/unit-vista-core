import { vendorQuoteTotal } from "./app-store";
import type { MaintenanceTicket, Payment, PaymentKind, Property, RentSchedule, TechnicianJob, VendorQuote } from "./types";

export interface StatementLine {
  id: string;
  date: string;
  label: string;
  detail: string;
  /** positive = owed to the party, negative = deducted */
  amount: number;
}

export interface Statement {
  earned: StatementLine[];
  deductions: StatementLine[];
  payable: number;
  paid: number;
  pending: number;
  due: number;
  /** Rent billed but not yet paid by tenants (landlord only, info). */
  uncollected: number;
  payments: Payment[];
}

/** Property management company fee (to be defined later). */
export const managementFee = (_ownerId: string, _rentCollected: number) => 0;

const sum = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);
const ref = (tickets: MaintenanceTicket[], id: string) => tickets.find((t) => t.id === id);

function finish(earned: StatementLine[], deductions: StatementLine[], payments: Payment[], uncollected = 0): Statement {
  const payable = sum(earned) + sum(deductions);
  const paid = sum(payments.filter((p) => p.status === "Confirmed"));
  const pending = sum(payments.filter((p) => p.status === "Submitted"));
  return { earned, deductions, payable, paid, pending, due: Math.max(0, payable - paid - pending), uncollected, payments };
}

const paymentsFor = (payments: Payment[], kind: PaymentKind, key: keyof Payment, id: string) =>
  payments.filter((p) => p.kind === kind && p[key] === id);

export function vendorStatement(
  vendorId: string,
  d: { vendorQuotes: VendorQuote[]; maintenanceTickets: MaintenanceTicket[]; payments: Payment[] },
): Statement {
  const earned = d.vendorQuotes
    .filter((q) => q.vendor_id === vendorId && q.status === "Selected")
    .map((q) => {
      const t = ref(d.maintenanceTickets, q.ticket_id);
      return {
        id: q.id,
        date: q.quoted_at ?? q.created_at,
        label: `${q.reference}${t ? ` · ${t.reference}` : ""}`,
        detail: `${t?.title ?? "Materials order"} — ${q.items.length} item(s) + delivery`,
        amount: vendorQuoteTotal(q),
      };
    });
  return finish(earned, [], paymentsFor(d.payments, "VENDOR", "vendor_id", vendorId));
}

export function technicianStatement(
  technicianId: string,
  d: { technicianJobs: TechnicianJob[]; maintenanceTickets: MaintenanceTicket[]; payments: Payment[] },
): Statement {
  const earned = d.technicianJobs
    .filter((j) => j.technician_id === technicianId && j.status === "Selected")
    .map((j) => ({
      id: j.id,
      date: j.quoted_at ?? j.created_at,
      label: j.reference,
      detail: `${j.details?.title ?? "Maintenance job"} — labour`,
      amount: j.labour_price || 0,
    }));
  return finish(earned, [], paymentsFor(d.payments, "TECHNICIAN", "technician_id", technicianId));
}

/** Payable = rent collected − (vendor payments + technician payments + management fee). */
export function landlordStatement(
  ownerId: string,
  d: {
    properties: Property[];
    rentSchedules: RentSchedule[];
    technicianJobs: TechnicianJob[];
    vendorQuotes: VendorQuote[];
    maintenanceTickets: MaintenanceTicket[];
    payments: Payment[];
  },
): Statement {
  const propIds = new Set(d.properties.filter((p) => p.owner_id === ownerId).map((p) => p.id));
  const earned: StatementLine[] = d.rentSchedules
    .filter((r) => propIds.has(r.property_id) && r.paid_amount > 0)
    .map((r) => ({
      id: r.id,
      date: r.paid_on ?? r.due_date,
      label: "Rent collected",
      detail: `${d.properties.find((p) => p.id === r.property_id)?.name ?? ""} · due ${r.due_date}`,
      amount: r.paid_amount,
    }));
  const ownerTickets = d.maintenanceTickets.filter((t) => t.owner_id === ownerId || propIds.has(t.property_id));
  const ticketIds = new Set(ownerTickets.map((t) => t.id));
  const deductions: StatementLine[] = [];
  for (const q of d.vendorQuotes.filter((q) => q.status === "Selected" && (ticketIds.has(q.ticket_id) || q.owner_id === ownerId))) {
    const t = ref(d.maintenanceTickets, q.ticket_id);
    deductions.push({
      id: q.id,
      date: q.quoted_at ?? q.created_at,
      label: "Vendor",
      detail: `${q.reference} · ${t?.reference ?? ""} ${t?.title ?? ""}`,
      amount: -vendorQuoteTotal(q),
    });
  }
  for (const j of d.technicianJobs.filter((j) => j.status === "Selected" && (ticketIds.has(j.ticket_id) || j.owner_id === ownerId))) {
    deductions.push({
      id: j.id,
      date: j.quoted_at ?? j.created_at,
      label: "Technician",
      detail: `${j.reference} · ${j.details?.title ?? ""}`,
      amount: -(j.labour_price || 0),
    });
  }
  const fee = managementFee(ownerId, sum(earned));
  if (fee) deductions.push({ id: "fee", date: new Date().toISOString(), label: "Management fee", detail: "Property management company fee", amount: -fee });
  deductions.sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date().toISOString().slice(0, 10);
  const uncollected = d.rentSchedules
    .filter((r) => propIds.has(r.property_id) && r.due_date <= today)
    .reduce((s, r) => s + Math.max(0, r.amount - r.paid_amount), 0);
  return finish(earned, deductions, paymentsFor(d.payments, "LANDLORD", "owner_id", ownerId), uncollected);
}
