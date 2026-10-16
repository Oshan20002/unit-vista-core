import type {
  Approval,
  Expense,
  Lease,
  MaintenanceTicket,
  Property,
  RentSchedule,
  Unit,
} from "./types";

export const occupancyOf = (units: Unit[]) => {
  const total = units.length;
  const occupied = units.filter((u) => u.status === "Occupied").length;
  const vacant = units.filter((u) => u.status === "Vacant").length;
  return { total, occupied, vacant, rate: total ? (occupied / total) * 100 : 0 };
};

export const rentTotals = (rows: RentSchedule[]) => {
  const expected = rows.reduce((s, r) => s + r.amount, 0);
  const collected = rows.reduce((s, r) => s + r.paid_amount, 0);
  const outstanding = expected - collected;
  return {
    expected,
    collected,
    outstanding,
    rate: expected ? (collected / expected) * 100 : 0,
    overdue: rows.filter((r) => r.status === "Overdue").length,
  };
};

export const propertyPerformance = (
  properties: Property[],
  units: Unit[],
  rent: RentSchedule[],
  expenses: Expense[],
) =>
  properties.map((p) => {
    const pUnits = units.filter((u) => u.property_id === p.id);
    const occ = occupancyOf(pUnits);
    const collected = rent.filter((r) => r.property_id === p.id).reduce((s, r) => s + r.paid_amount, 0);
    const spend = expenses.filter((e) => e.property_id === p.id).reduce((s, e) => s + e.amount, 0);
    return {
      id: p.id,
      property: p,
      units: pUnits.length,
      occupancy: occ.rate,
      occupied: occ.occupied,
      rent: collected,
      expenses: spend,
      net: collected - spend,
    };
  });

export const openTickets = (tickets: MaintenanceTicket[]) =>
  tickets.filter((t) => t.status !== "CLOSED" && t.status !== "COMPLETED");

export const pendingApprovals = (approvals: Approval[]) => approvals.filter((a) => a.status === "Pending");

export const expiringLeases = (leases: Lease[]) =>
  leases.filter((l) => l.status === "Expiring Soon" || l.status === "Expired");

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"];

/** Deterministic 6-month trend derived from current totals (Phase 1 analytics). */
export const monthlyTrend = (rentTotal: number, expenseTotal: number) =>
  MONTHS.map((month, i) => {
    const factor = 0.82 + i * 0.036;
    const income = Math.round(rentTotal * factor);
    const expense = Math.round(expenseTotal * (0.95 + (i % 3) * 0.06));
    return { month, income, expense, net: income - expense };
  });

export const occupancyTrend = (rate: number) =>
  MONTHS.map((month, i) => ({
    month,
    occupancy: Math.max(0, Math.min(100, Math.round(rate - (5 - i) * 2.2))),
  }));
