import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { toast } from "sonner";
import * as seed from "./demo-data";
import { isSupabaseConfigured, supabase } from "./supabase";
import type {
  Approval,
  AppUser,
  AuditLog,
  Building,
  DocumentRecord,
  Expense,
  Lease,
  MaintenanceTicket,
  Notification,
  Owner,
  Property,
  RentSchedule,
  Role,
  Technician,
  TechnicianJob,
  WorkSlot,
  Tenant,
  Unit,
  Vendor,
  VendorQuote,
  FileRef,
  JobItem,
  CompanyBank,
  Payment,
} from "./types";

const STORAGE_KEY = "estora.session";
const reportSaveError =
  (what: string) =>
  ({ error }: { error: { message: string } | null }) => {
    if (error) {
      console.error(`Failed to save ${what}:`, error);
      toast.error(`Could not save ${what} to the database: ${error.message}`);
    }
  };

const uid = () => globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;

interface Dataset {
  owners: Owner[];
  properties: Property[];
  buildings: Building[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  rentSchedules: RentSchedule[];
  vendors: Vendor[];
  maintenanceTickets: MaintenanceTicket[];
  approvals: Approval[];
  documents: DocumentRecord[];
  notifications: Notification[];
  expenses: Expense[];
  auditLogs: AuditLog[];
  technicians: Technician[];
  technicianJobs: TechnicianJob[];
  vendorQuotes: VendorQuote[];
  companyBanks: CompanyBank[];
  payments: Payment[];
}

const emptyDataset = (): Dataset => ({
  owners: [],
  properties: [],
  buildings: [],
  units: [],
  tenants: [],
  leases: [],
  rentSchedules: [],
  vendors: [],
  maintenanceTickets: [],
  approvals: [],
  documents: [],
  notifications: [],
  expenses: [],
  auditLogs: [],
  technicians: [],
  technicianJobs: [],
  vendorQuotes: [],
  companyBanks: [],
  payments: [],
});

const initialData = (): Dataset => ({
  owners: seed.owners,
  properties: seed.properties,
  buildings: seed.buildings,
  units: seed.units,
  tenants: seed.tenants,
  leases: seed.leases,
  rentSchedules: seed.rentSchedules,
  vendors: seed.vendors,
  maintenanceTickets: seed.maintenanceTickets,
  approvals: seed.approvals,
  documents: seed.documents,
  notifications: seed.notifications,
  expenses: seed.expenses,
  auditLogs: seed.auditLogs,
  technicians: [],
  technicianJobs: [],
  vendorQuotes: [],
  companyBanks: [],
  payments: [],
});

/** 6-character one-time registration code (no look-alike characters). */
export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

// ---- Supabase <-> app role mapping ----
const toAppRole = (r: string): Role =>
  r === "admin"
    ? "ADMIN"
    : r === "property_manager"
      ? "PROPERTY_MANAGER"
      : r === "landlord"
        ? "LANDLORD"
        : r === "technician"
          ? "TECHNICIAN"
          : r === "vendor"
            ? "VENDOR"
            : "TENANT";

// ---- Load every business table for the signed-in user (RLS scopes rows) ----
async function fetchDataset(client: SupabaseClient): Promise<Dataset> {
  // Permanently remove records that were marked deleted more than 7 days ago.
  // (Database permissions only let staff do this; errors are ignored.)
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  for (const table of ["leases", "tenants", "owners", "technicians", "vendors"]) {
    try {
      await client.from(table).delete().lt("deleted_at", cutoff);
    } catch {
      /* ignore */
    }
  }
  const [o, p, b, u, t, l, r, v, m, a, d, n, e, al, tc, tj, vq, cb, py] = await Promise.all([
    client.from("owners").select("*"),
    client.from("properties").select("*"),
    client.from("buildings").select("*"),
    client.from("units").select("*"),
    client.from("tenants").select("*"),
    client.from("leases").select("*"),
    client.from("rent_schedules").select("*"),
    client.from("vendors").select("*"),
    client.from("maintenance_tickets").select("*"),
    client.from("approvals").select("*"),
    client.from("documents").select("*"),
    client.from("notifications").select("*"),
    client.from("expenses").select("*"),
    client.from("audit_logs").select("*"),
    client.from("technicians").select("*"),
    client.from("technician_jobs").select("*"),
    client.from("vendor_quotes").select("*"),
    client.from("company_banks").select("*"),
    client.from("payments").select("*"),
  ]);
  return {
    owners: (o.data ?? []) as Owner[],
    properties: (p.data ?? []) as Property[],
    buildings: (b.data ?? []) as Building[],
    units: (u.data ?? []) as Unit[],
    tenants: (t.data ?? []) as Tenant[],
    leases: (l.data ?? []) as Lease[],
    rentSchedules: (r.data ?? []) as RentSchedule[],
    vendors: (v.data ?? []) as Vendor[],
    maintenanceTickets: (m.data ?? []) as MaintenanceTicket[],
    approvals: (a.data ?? []) as Approval[],
    documents: (d.data ?? []) as DocumentRecord[],
    notifications: (n.data ?? []) as Notification[],
    expenses: (e.data ?? []) as Expense[],
    auditLogs: (al.data ?? []) as AuditLog[],
    technicians: (tc.data ?? []) as Technician[],
    technicianJobs: (tj.data ?? []) as TechnicianJob[],
    vendorQuotes: (vq.data ?? []) as VendorQuote[],
    companyBanks: (cb.data ?? []) as CompanyBank[],
    payments: ((py.data ?? []) as Payment[]).sort((a, b) => b.created_at.localeCompare(a.created_at)),
  };
}

// ---- Build the app user from a Supabase auth user (profiles + user_roles) ----
async function buildAppUserFromSession(client: SupabaseClient, su: User): Promise<AppUser> {
  const [{ data: prof }, { data: roles }] = await Promise.all([
    client
      .from("profiles")
      .select("*")
      .eq("user_id", su.id)
      .maybeSingle(),
    client.from("user_roles").select("role").eq("user_id", su.id),
  ]);
  const roleList = (roles ?? []).map((r) => r.role as string);
  const dbRole =
    ["admin", "property_manager", "technician", "vendor", "landlord", "tenant"].find((r) => roleList.includes(r)) ??
    "tenant";
  let role = toAppRole(dbRole);
  let full_name = (prof?.full_name as string | undefined) ?? su.email ?? "User";
  // Safety net: if the login is linked to a tenant / owner record, that record
  // decides the role and display name (the name the property manager entered),
  // even if the database trigger is outdated.
  // A tenant record assigned to this email always wins.
  let tenantId = prof?.tenant_id as string | undefined;
  let tenantName: string | undefined;
  const techId = prof?.technician_id as string | undefined;
  const vendorId = prof?.vendor_id as string | undefined;
  if ((techId || vendorId) && dbRole !== "admin" && dbRole !== "property_manager") {
    const table = techId ? "technicians" : "vendors";
    const { data: rec } = await client
      .from(table)
      .select("*")
      .eq("id", (techId ?? vendorId) as string)
      .maybeSingle();
    const name = (rec?.full_name ?? rec?.name) as string | undefined;
    const fn = name ?? full_name;
    return {
      id: su.id,
      email: su.email ?? "",
      full_name: fn,
      role: techId ? "TECHNICIAN" : "VENDOR",
      avatar_initials: fn.slice(0, 2).toUpperCase(),
      technician_id: techId,
      vendor_id: vendorId,
    };
  }
  if (su.email && dbRole !== "admin" && dbRole !== "property_manager") {
    const { data: tByEmail } = await client
      .from("tenants")
      .select("id, full_name")
      .ilike("email", su.email)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (tByEmail?.id) {
      tenantId = tByEmail.id as string;
      tenantName = tByEmail.full_name as string;
    }
  }
  const ownerId = tenantId ? undefined : (prof?.owner_id as string | undefined);
  if (tenantId) {
    role = "TENANT";
    if (!tenantName) {
      const { data: t } = await client
        .from("tenants")
        .select("full_name")
        .eq("id", tenantId)
        .maybeSingle();
      tenantName = t?.full_name as string | undefined;
    }
    if (tenantName) full_name = tenantName;
    if (prof?.tenant_id !== tenantId || prof?.owner_id) {
      await client
        .from("profiles")
        .update({ tenant_id: tenantId, owner_id: null, full_name })
        .eq("user_id", su.id);
    }
  } else if (ownerId) {
    role = "LANDLORD";
    const { data: o } = await client
      .from("owners")
      .select("full_name")
      .eq("id", ownerId)
      .maybeSingle();
    if (o?.full_name) full_name = o.full_name as string;
  }
  const next: AppUser = {
    id: su.id,
    email: su.email ?? "",
    full_name,
    role,
    avatar_initials: full_name.slice(0, 2).toUpperCase(),
  };
  if (ownerId) next.owner_id = ownerId;
  if (tenantId) next.tenant_id = tenantId;
  return next;
}

interface AppContextValue extends Dataset {
  user: AppUser | null;
  loading: boolean;
  backend: "supabase" | "demo";
  signIn: (email: string, password: string) => Promise<AppUser>;
  /** Invite-only registration (codes are issued when staff add a tenant / landlord). */
  checkInviteEmail: (email: string) => Promise<"invited" | "registered" | "not_found">;
  verifyInviteCode: (email: string, code: string) => Promise<boolean>;
  registerWithInvite: (input: { email: string; code: string; password: string }) => Promise<{
    requiresEmailConfirmation: boolean;
  }>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** role-scoped views */
  scoped: Dataset;
  addProperty: (input: Omit<Property, "id" | "created_at">) => Property;
  addUnit: (input: Omit<Unit, "id">) => Unit;
  addBuilding: (input: Omit<Building, "id" | "created_at">) => Promise<Building>;
  addTenant: (input: Omit<Tenant, "id" | "created_at">) => Tenant;
  addLease: (input: Omit<Lease, "id" | "lease_number">) => Lease;
  addOwner: (input: Omit<Owner, "id" | "created_at">) => Promise<Owner>;
  updateOwner: (id: string, patch: Partial<Omit<Owner, "id" | "created_at">>) => Promise<void>;
  /** Links an existing landlord login (by email) to an owner record. False when no login exists. */
  linkLandlordByEmail: (email: string, ownerId: string) => Promise<boolean>;
  recordPayment: (rentId: string, amount: number, method: RentSchedule["method"]) => void;
  createTicket: (input: {
    property_id: string;
    unit_id: string;
    category: MaintenanceTicket["category"];
    title: string;
    description: string;
    priority: MaintenanceTicket["priority"];
    attachments?: { name: string; size: string }[];
  }) => MaintenanceTicket;
  updateTicket: (id: string, patch: Partial<MaintenanceTicket>, event?: string) => void;
  addTicketNote: (id: string, body: string, internal: boolean) => void;
  decideApproval: (id: string, decision: "Approved" | "Rejected", reason?: string) => void;
  addDocument: (input: Omit<DocumentRecord, "id" | "uploaded_at" | "uploaded_by">) => void;
  deleteDocument: (id: string) => void;
  /** Marks a landlord / tenant / lease as deleted; it is permanently removed after 7 days. */
  softDelete: (
    entity: "owners" | "tenants" | "leases" | "technicians" | "vendors",
    id: string,
  ) => Promise<void>;
  addTechnician: (input: Omit<Technician, "id" | "created_at">) => Promise<Technician>;
  addVendor: (input: Omit<Vendor, "id" | "created_at">) => Promise<Vendor>;
  /** PM assigns one or more technicians to a maintenance ticket for quotations. */
  assignTechnicians: (ticketId: string, technicianIds: string[]) => Promise<void>;
  submitTechnicianQuote: (
    jobId: string,
    input: { labour_price: number; items: JobItem[]; note?: string; file?: File | null },
  ) => Promise<void>;
  /** PM sends a technician's item list to one or more vendors. */
  requestVendorQuotes: (jobId: string, vendorIds: string[]) => Promise<void>;
  submitVendorQuote: (
    quoteId: string,
    input: { unit_prices: Record<string, number>; delivery_charge: number; note?: string; file?: File | null },
  ) => Promise<void>;
  /** Sends all quoted options to the landlord (above approval limit). */
  sendOptionsToLandlord: (ticketId: string) => Promise<void>;
  /** Picks one option (vendor quote id or technician job id); others are rejected. */
  chooseOption: (ticketId: string, optionKey: string) => Promise<void>;
  getFileUrl: (file: FileRef) => Promise<string | null>;
  addCompanyBank: (input: Omit<CompanyBank, "id" | "created_at">) => Promise<void>;
  deleteCompanyBank: (id: string) => Promise<void>;
  /** Tenant pays rent by bank transfer with a slip; staff confirm later. */
  submitRentPayment: (rentId: string, amount: number, slip: File | null) => Promise<void>;
  /** Staff confirm a tenant's submitted payment (adds it to the rent record). */
  confirmRentPayment: (paymentId: string) => Promise<void>;
  /** Staff pay a landlord / vendor / technician with a slip. */
  payPartner: (input: {
    kind: "LANDLORD" | "VENDOR" | "TECHNICIAN";
    partyId: string;
    amount: number;
    slip: File | null;
    note?: string;
  }) => Promise<void>;
  /** Landlord / vendor / technician confirms they received a payment. */
  confirmPayoutReceived: (paymentId: string) => Promise<void>;
  updatePartner: (kind: "technician" | "vendor", id: string, patch: Partial<Technician & Vendor>) => Promise<void>;
  /** Work order after a choice. */
  confirmVendorOrder: (ticketId: string, deliveryDate: string) => Promise<void>;
  proposeSlots: (ticketId: string, slots: WorkSlot[]) => Promise<void>;
  bookSlot: (ticketId: string, slotId: string) => Promise<void>;
  completeWork: (ticketId: string) => Promise<void>;
  submitFeedback: (ticketId: string, rating: number, comment: string) => Promise<void>;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  logAction: (action: string, entity: string, entityId: string) => void;
}

// Keep a single context instance even if this module gets duplicated across
// route-split chunks during dev HMR (otherwise useApp sees a different, empty
// context than the one AppProvider filled in and throws).
const globalForApp = globalThis as unknown as {
  __estoraAppContext?: React.Context<AppContextValue | null>;
};
const AppContext =
  globalForApp.__estoraAppContext ??
  (globalForApp.__estoraAppContext = createContext<AppContextValue | null>(null));


function scopeFor(user: AppUser | null, rawData: Dataset): Dataset {
  if (!user) return { ...rawData, properties: [], units: [] };
  if (user.role === "ADMIN" || user.role === "PROPERTY_MANAGER")
    return {
      ...rawData,
      notifications: rawData.notifications.filter(
        (n) => !n.technician_id && !n.vendor_id && n.user_role !== "TECHNICIAN" && n.user_role !== "VENDOR",
      ),
    };
  if (user.role === "TECHNICIAN" || user.role === "VENDOR") {
    const empty = emptyDataset();
    const isTech = user.role === "TECHNICIAN";
    return {
      ...empty,
      technicians: isTech ? rawData.technicians.filter((t) => t.id === user.technician_id) : [],
      vendors: isTech ? [] : rawData.vendors.filter((v) => v.id === user.vendor_id),
      technicianJobs: isTech ? rawData.technicianJobs.filter((j) => j.technician_id === user.technician_id) : [],
      vendorQuotes: isTech ? [] : rawData.vendorQuotes.filter((q) => q.vendor_id === user.vendor_id),
      payments: rawData.payments.filter((p) =>
        isTech ? p.kind === "TECHNICIAN" && p.technician_id === user.technician_id : p.kind === "VENDOR" && p.vendor_id === user.vendor_id,
      ),
      maintenanceTickets: rawData.maintenanceTickets.filter((t) =>
        isTech
          ? rawData.technicianJobs.some((j) => j.ticket_id === t.id && j.technician_id === user.technician_id)
          : rawData.vendorQuotes.some((q) => q.ticket_id === t.id && q.vendor_id === user.vendor_id),
      ),
      notifications: rawData.notifications.filter((n) =>
        isTech ? n.technician_id === user.technician_id : n.vendor_id === user.vendor_id,
      ),
    };
  }

  // Landlords and tenants never see records staff have marked as deleted.
  const data: Dataset = {
    ...rawData,
    owners: rawData.owners.filter((o) => !o.deleted_at),
    tenants: rawData.tenants.filter((t) => !t.deleted_at),
    leases: rawData.leases.filter((l) => !l.deleted_at),
  };

  if (user.role === "LANDLORD") {
    const ownerId = user.owner_id;
    const properties = data.properties.filter((p) => p.owner_id === ownerId);
    const ids = new Set(properties.map((p) => p.id));
    const units = data.units.filter((u) => ids.has(u.property_id) || u.owner_id === ownerId);
    const unitIds = new Set(units.map((u) => u.id));
    const leases = data.leases.filter(
      (l) => l.owner_id === ownerId || ids.has(l.property_id) || unitIds.has(l.unit_id),
    );
    const leaseTenantIds = new Set(leases.map((l) => l.tenant_id));
    const tenants = data.tenants.filter((t) => unitIds.has(t.unit_id) || leaseTenantIds.has(t.id));
    return {
      ...data,
      owners: data.owners.filter((o) => o.id === ownerId),
      properties,
      buildings: data.buildings.filter((b) => ids.has(b.property_id)),
      units,
      tenants,
      leases,
      rentSchedules: data.rentSchedules.filter((r) => ids.has(r.property_id)),
      maintenanceTickets: data.maintenanceTickets.filter((t) => ids.has(t.property_id)),
      approvals: data.approvals.filter((a) => a.owner_id === ownerId),
      technicianJobs: data.technicianJobs.filter((j) => j.owner_id === ownerId),
      vendorQuotes: data.vendorQuotes.filter((q) => q.owner_id === ownerId),
      payments: data.payments.filter((p) => p.kind === "LANDLORD" && p.owner_id === ownerId),
      technicians: [],
      documents: data.documents.filter(
        (d) => d.owner_id === ownerId || (d.property_id && ids.has(d.property_id)),
      ),
      expenses: data.expenses.filter((e) => e.owner_id === ownerId),
      notifications: data.notifications.filter(
        (n) => n.owner_id === ownerId || (n.user_role === "ALL" && !n.tenant_id),
      ),
      auditLogs: [],
    };
  }

  // TENANT
  const tenant = data.tenants.find((t) => t.id === user.tenant_id);
  if (!tenant) return { ...data, properties: [], units: [], leases: [], tenants: [] };
  const leases = data.leases.filter((l) => l.tenant_id === tenant.id);
  const unitIds = new Set([tenant.unit_id, ...leases.map((l) => l.unit_id)].filter(Boolean));
  const units = data.units.filter((u) => unitIds.has(u.id) || u.tenant_id === tenant.id);
  const propIds = new Set(
    [tenant.property_id, ...leases.map((l) => l.property_id), ...units.map((u) => u.property_id)].filter(Boolean),
  );
  return {
    ...data,
    owners: [],
    properties: data.properties.filter((p) => propIds.has(p.id)),
    buildings: data.buildings.filter((b) => propIds.has(b.property_id)),
    units,
    tenants: [tenant],
    leases,
    rentSchedules: data.rentSchedules.filter((r) => r.tenant_id === tenant.id),
    maintenanceTickets: data.maintenanceTickets.filter((t) => t.tenant_id === tenant.id),
    approvals: [],
    technicians: [],
    technicianJobs: [],
    vendorQuotes: [],
    payments: data.payments.filter((p) => p.kind === "TENANT_RENT" && p.tenant_id === tenant.id),
    documents: data.documents.filter((d) => d.tenant_id === tenant.id),
    expenses: [],
    notifications: data.notifications.filter(
      (n) => n.tenant_id === tenant.id || (n.user_role === "ALL" && !n.owner_id),
    ),
    auditLogs: [],
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Dataset>(isSupabaseConfigured ? emptyDataset : initialData);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      if (isSupabaseConfigured && supabase) {
        const { data: sess } = await supabase.auth.getSession();
        const su = sess.session?.user;
        if (active && su) {
          setUser(await buildAppUserFromSession(supabase, su));
          setData(await fetchDataset(supabase));
        }
      } else {
        const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
        if (active && raw) {
          try {
            setUser(JSON.parse(raw) as AppUser);
          } catch {
            window.localStorage.removeItem(STORAGE_KEY);
          }
        }
      }
      if (active) setLoading(false);
    };
    void restore();
    const client = supabase;
    const authListener = client?.auth.onAuthStateChange((event, session) => {
      if (!active || !isSupabaseConfigured) return;
      if (event === "SIGNED_OUT") {
        setUser(null);
        setData(emptyDataset());
        return;
      }
      if ((event === "SIGNED_IN" || event === "USER_UPDATED") && session?.user) {
        void Promise.all([
          buildAppUserFromSession(client, session.user),
          fetchDataset(client),
        ]).then(([nextUser, nextData]) => {
          if (!active) return;
          setUser(nextUser);
          setData(nextData);
        });
      }
    });
    return () => {
      active = false;
      authListener?.data.subscription.unsubscribe();
    };
  }, []);

  const logAction = useCallback(
    (action: string, entity: string, entityId: string) => {
      const entry: AuditLog = {
        id: uid(),
        user_name: user?.full_name ?? "System",
        role: user?.role ?? "ADMIN",
        action,
        entity,
        entity_id: entityId,
        at: new Date().toISOString(),
        ip: "—",
        device: typeof navigator !== "undefined" ? navigator.platform || "Web" : "Web",
      };
      setData((d) => ({ ...d, auditLogs: [entry, ...d.auditLogs] }));
      if (isSupabaseConfigured && supabase) void supabase.from("audit_logs").insert(entry);
    },
    [user],
  );

  const notify = useCallback((n: Omit<Notification, "id" | "read" | "created_at">) => {
    const row: Notification = { ...n, id: uid(), read: false, created_at: new Date().toISOString() };
    setData((d) => ({ ...d, notifications: [row, ...d.notifications] }));
    if (isSupabaseConfigured && supabase)
      void supabase.from("notifications").insert(row).then(({ error }) => {
        if (error) console.error("Failed to save notification:", error);
      });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (isSupabaseConfigured && supabase) {
      const normalizedEmail = email.trim().toLowerCase();
      const { data: res, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        if (error.message.toLowerCase().includes("invalid login credentials")) {
          throw new Error(
            "Email or password is incorrect. If you just registered, confirm your email first.",
          );
        }
        if (error.message.toLowerCase().includes("email not confirmed")) {
          throw new Error("Confirm your email using the link in your inbox before signing in.");
        }
        throw new Error(error.message);
      }
      if (!res.user) throw new Error("Sign-in completed without a user session. Please try again.");
      const su = res.user;
      const next = await buildAppUserFromSession(supabase, su);
      setUser(next);
      setData(await fetchDataset(supabase));
      return next;
    }
    const match = seed.demoUsers.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password,
    );
    if (!match) throw new Error("Incorrect email or password.");
    const { password: _pw, ...rest } = match;
    setUser(rest);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
    return rest;
  }, []);

  const checkInviteEmail = useCallback<AppContextValue["checkInviteEmail"]>(
    async (email) => {
      const normalized = email.trim().toLowerCase();
      if (isSupabaseConfigured && supabase) {
        const { data: res, error } = await supabase.rpc("check_invite_email", { p_email: normalized });
        if (error) throw new Error(error.message);
        return (res as "invited" | "registered" | "not_found") ?? "not_found";
      }
      if (seed.demoUsers.some((u) => u.email.toLowerCase() === normalized)) return "registered";
      const match = [...data.tenants, ...data.owners, ...data.technicians, ...data.vendors].find(
        (r) => r.email.toLowerCase() === normalized && r.invite_code,
      );
      if (!match) return "not_found";
      return match.invite_claimed_at ? "registered" : "invited";
    },
    [data.tenants, data.owners, data.technicians, data.vendors],
  );

  const verifyInviteCode = useCallback<AppContextValue["verifyInviteCode"]>(
    async (email, code) => {
      const normalized = email.trim().toLowerCase();
      const c = code.trim().toUpperCase();
      if (isSupabaseConfigured && supabase) {
        const { data: ok, error } = await supabase.rpc("verify_invite_code", {
          p_email: normalized,
          p_code: c,
        });
        if (error) throw new Error(error.message);
        return Boolean(ok);
      }
      return [...data.tenants, ...data.owners, ...data.technicians, ...data.vendors].some(
        (r) => r.email.toLowerCase() === normalized && r.invite_code === c && !r.invite_claimed_at,
      );
    },
    [data.tenants, data.owners, data.technicians, data.vendors],
  );

  const registerWithInvite = useCallback<AppContextValue["registerWithInvite"]>(
    async ({ email, code, password }) => {
      const normalized = email.trim().toLowerCase();
      const c = code.trim().toUpperCase();
      if (isSupabaseConfigured && supabase) {
        const { data: res, error } = await supabase.auth.signUp({
          email: normalized,
          password,
          options: { data: { invite_code: c }, emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("already")) throw new Error("This email is already registered. Please sign in.");
          if (msg.includes("database error")) throw new Error("The one-time code is invalid or was already used.");
          throw new Error(error.message);
        }
        if (res.user && (res.user.identities?.length ?? 0) === 0) {
          throw new Error("This email is already registered. Please sign in.");
        }
        if (res.session) await supabase.auth.signOut();
        return { requiresEmailConfirmation: !res.session };
      }
      const now = new Date().toISOString();
      setData((d) => ({
        ...d,
        tenants: d.tenants.map((t) =>
          t.email.toLowerCase() === normalized && t.invite_code === c ? { ...t, invite_claimed_at: now } : t,
        ),
        owners: d.owners.map((o) =>
          o.email.toLowerCase() === normalized && o.invite_code === c ? { ...o, invite_claimed_at: now } : o,
        ),
      }));
      return { requiresEmailConfirmation: false };
    },
    [],
  );

  const requestPasswordReset = useCallback(async (email: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) throw new Error(error.message);
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured && supabase) await supabase.auth.signOut();
    window.localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    if (isSupabaseConfigured) setData(emptyDataset());
  }, []);

  const addProperty = useCallback<AppContextValue["addProperty"]>(
    (input) => {
      const property: Property = { ...input, id: uid(), created_at: new Date().toISOString() };
      setData((d) => ({ ...d, properties: [property, ...d.properties] }));
      if (isSupabaseConfigured && supabase) void supabase.from("properties").insert(property).then(reportSaveError("property"));
      logAction("Property created", "properties", property.id);
      return property;
    },
    [logAction],
  );

  const addBuilding = useCallback<AppContextValue["addBuilding"]>(
    async (input) => {
      const building: Building = { ...input, id: uid(), created_at: new Date().toISOString() };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("buildings").insert(building);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, buildings: [...d.buildings, building] }));
      logAction("Building created", "buildings", building.id);
      return building;
    },
    [logAction],
  );

  const addUnit = useCallback<AppContextValue["addUnit"]>(
    (input) => {
      const unit: Unit = { ...input, id: uid() };
      setData((d) => ({ ...d, units: [unit, ...d.units] }));
      if (isSupabaseConfigured && supabase) void supabase.from("units").insert(unit).then(reportSaveError("unit"));
      logAction("Unit created", "units", unit.id);
      return unit;
    },
    [logAction],
  );

  const addTenant = useCallback<AppContextValue["addTenant"]>(
    (input) => {
      const tenant: Tenant = { ...input, id: uid(), created_at: new Date().toISOString(), invite_code: generateInviteCode() };
      setData((d) => ({ ...d, tenants: [tenant, ...d.tenants] }));
      if (isSupabaseConfigured && supabase) void supabase.from("tenants").insert(tenant).then(reportSaveError("tenant"));
      logAction("Tenant added", "tenants", tenant.id);
      return tenant;
    },
    [logAction],
  );

  const addLease = useCallback<AppContextValue["addLease"]>(
    (input) => {
      const lease: Lease = {
        ...input,
        id: uid(),
        lease_number: `LSE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      };
      // Assigning a lease also moves the tenant into that unit and marks the unit occupied,
      // so the tenant's and landlord's accounts show the unit + lease.
      const occupy = lease.status === "Active" || lease.status === "Expiring Soon" || lease.status === "Draft";
      // Build the rent schedule for the lease term so tenant + landlord see rent due.
      const stepMonths = lease.payment_frequency === "Quarterly" ? 3 : lease.payment_frequency === "Annually" ? 12 : 1;
      const todayIso = new Date().toISOString().slice(0, 10);
      const schedules: RentSchedule[] = [];
      if (lease.status !== "Draft" && lease.status !== "Terminated") {
        const cursor = new Date(`${lease.start_date}T00:00:00Z`);
        for (let i = 0; i < 120 && cursor.toISOString().slice(0, 10) < lease.end_date; i++) {
          const due = cursor.toISOString().slice(0, 10);
          schedules.push({
            id: uid(),
            lease_id: lease.id,
            tenant_id: lease.tenant_id,
            property_id: lease.property_id,
            unit_id: lease.unit_id,
            due_date: due,
            amount: lease.monthly_rent * stepMonths,
            paid_amount: 0,
            status: due < todayIso ? "Overdue" : due === todayIso ? "Due" : "Upcoming",
          });
          cursor.setUTCMonth(cursor.getUTCMonth() + stepMonths);
        }
      }
      setData((d) => ({
        ...d,
        leases: [lease, ...d.leases],
        rentSchedules: [...schedules, ...d.rentSchedules],
        tenants: d.tenants.map((t) =>
          t.id === lease.tenant_id ? { ...t, unit_id: lease.unit_id, property_id: lease.property_id } : t,
        ),
        units: d.units.map((u) =>
          u.id === lease.unit_id
            ? { ...u, tenant_id: lease.tenant_id, status: occupy ? "Occupied" : u.status }
            : u,
        ),
      }));
      if (isSupabaseConfigured && supabase) {
        const client = supabase;
        void (async () => {
          const { error } = await client.from("leases").insert(lease);
          reportSaveError("lease")({ error });
          if (error) return;
          if (schedules.length) {
            const r = await client.from("rent_schedules").insert(schedules);
            reportSaveError("rent schedule")({ error: r.error });
          }
          const t = await client
            .from("tenants")
            .update({ unit_id: lease.unit_id, property_id: lease.property_id })
            .eq("id", lease.tenant_id);
          reportSaveError("tenant")({ error: t.error });
          let uErr = (await client
            .from("units")
            .update(occupy ? { tenant_id: lease.tenant_id, status: "Occupied" } : { tenant_id: lease.tenant_id })
            .eq("id", lease.unit_id)).error;
          // Older databases lack units.tenant_id — fall back to status only.
          if (uErr && /tenant_id/.test(uErr.message)) {
            uErr = occupy
              ? (await client.from("units").update({ status: "Occupied" }).eq("id", lease.unit_id)).error
              : null;
          }
          reportSaveError("unit")({ error: uErr });
        })();
      }
      logAction("Lease created", "leases", lease.id);
      return lease;
    },
    [logAction],
  );

  const addOwner = useCallback<AppContextValue["addOwner"]>(
    async (input) => {
      const owner: Owner = { ...input, id: uid(), created_at: new Date().toISOString(), invite_code: generateInviteCode() };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("owners").insert(owner);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, owners: [owner, ...d.owners] }));
      logAction("Owner added", "owners", owner.id);
      return owner;
    },
    [logAction],
  );

  const updateOwner = useCallback<AppContextValue["updateOwner"]>(
    async (id, patch) => {
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("owners").update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, owners: d.owners.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
      logAction("Owner updated", "owners", id);
    },
    [logAction],
  );


  const linkLandlordByEmail = useCallback<AppContextValue["linkLandlordByEmail"]>(
    async (email, ownerId) => {
      const normalized = email.trim().toLowerCase();
      if (isSupabaseConfigured && supabase) {
        const { data: linked, error } = await supabase.rpc("link_landlord_to_owner", {
          p_email: normalized,
          p_owner_id: ownerId,
        });
        if (error) throw new Error(error.message);
        return Boolean(linked);
      }
      // Demo mode: succeed when the email matches a demo account.
      return seed.demoUsers.some((u) => u.email.toLowerCase() === normalized);
    },
    [],
  );

  const recordPayment = useCallback<AppContextValue["recordPayment"]>(
    async (rentId, amount, method) => {
      const now = new Date().toISOString();
      const r = data.rentSchedules.find((x) => x.id === rentId);
      if (!r) throw new Error("Rent record not found.");
      const paid = Math.min(r.amount, r.paid_amount + amount);
      const updated: RentSchedule = {
        ...r,
        paid_amount: paid,
        status: paid >= r.amount ? "Paid" : "Partially Paid",
        paid_on: now.slice(0, 10),
        method,
      };
      if (isSupabaseConfigured && supabase) {
        // Upsert so the rent row is saved even if it was never stored before.
        const { data: saved, error } = await supabase
          .from("rent_schedules")
          .upsert({
            id: r.id,
            lease_id: r.lease_id,
            tenant_id: r.tenant_id,
            property_id: r.property_id,
            unit_id: r.unit_id,
            due_date: r.due_date,
            amount: r.amount,
            paid_amount: updated.paid_amount,
            status: updated.status,
            paid_on: updated.paid_on,
            method,
          })
          .select("id");
        if (error) throw new Error(`Could not save the rent payment: ${error.message}`);
        if (!saved?.length) throw new Error("Could not save the rent payment: no permission. Run db/fix-rent.sql.");
      }
      setData((d) => ({ ...d, rentSchedules: d.rentSchedules.map((x) => (x.id === rentId ? updated : x)) }));
      logAction("Payment recorded", "rent_schedules", rentId);
    },
    [data.rentSchedules, logAction],
  );

  const createTicket = useCallback<AppContextValue["createTicket"]>(
    (input) => {
      const now = new Date().toISOString();
      const unit = data.units.find((u) => u.id === input.unit_id);
      const property = data.properties.find((p) => p.id === input.property_id);
      const myEmail = user?.email?.toLowerCase();
      const tenantByEmail =
        user?.role === "TENANT" && myEmail
          ? data.tenants.find((t) => t.email?.toLowerCase() === myEmail)
          : undefined;
      const ticket: MaintenanceTicket = {
        id: uid(),
        reference: `MNT-${Math.floor(2700 + Math.random() * 300)}`,
        property_id: input.property_id,
        unit_id: input.unit_id,
        owner_id: unit?.owner_id ?? property?.owner_id ?? "",
        tenant_id: user?.tenant_id ?? tenantByEmail?.id ?? unit?.tenant_id,
        category: input.category,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: "NEW",
        created_at: now,
        updated_at: now,
        sla_due_at: new Date(
          Date.now() + (input.priority === "Emergency" ? 1 : 4) * 86_400_000,
        ).toISOString(),
        timeline: [{ at: now, actor: user?.full_name ?? "Resident", message: "Request submitted" }],
        notes: [],
        attachments: input.attachments ?? [],
      };
      setData((d) => ({ ...d, maintenanceTickets: [ticket, ...d.maintenanceTickets] }));
      if (isSupabaseConfigured && supabase) {
        const client = supabase;
        void client
          .from("maintenance_tickets")
          .insert({ ...ticket, owner_id: ticket.owner_id || null, tenant_id: ticket.tenant_id || null })
          .then((res) => {
            reportSaveError("ticket")(res);
            if (!res.error)
              notify({
                user_role: "PROPERTY_MANAGER",
                title: `New maintenance request ${ticket.reference}`,
                message: `${ticket.title} — assign a technician for quotations.`,
                type: "Maintenance",
                href: `/maintenance/${ticket.id}`,
              });
          });
      } else
        notify({
          user_role: "PROPERTY_MANAGER",
          title: `New maintenance request ${ticket.reference}`,
          message: `${ticket.title} — assign a technician for quotations.`,
          type: "Maintenance",
          href: `/maintenance/${ticket.id}`,
        });
      logAction("Maintenance created", "maintenance_tickets", ticket.id);
      return ticket;
    },
    [data.units, data.properties, data.tenants, logAction, user, notify],
  );

  const updateTicket = useCallback<AppContextValue["updateTicket"]>(
    (id, patch, event) => {
      const now = new Date().toISOString();
      setData((d) => ({
        ...d,
        maintenanceTickets: d.maintenanceTickets.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                updated_at: now,
                timeline: event
                  ? [...t.timeline, { at: now, actor: user?.full_name ?? "System", message: event }]
                  : t.timeline,
              }
            : t,
        ),
      }));
      if (isSupabaseConfigured && supabase) {
        const current = data.maintenanceTickets.find((t) => t.id === id);
        if (current) {
          const timeline = event
            ? [...current.timeline, { at: now, actor: user?.full_name ?? "System", message: event }]
            : current.timeline;
          void supabase
            .from("maintenance_tickets")
            .update({ ...patch, updated_at: now, timeline })
            .eq("id", id);
        }
      }
      logAction("Maintenance updated", "maintenance_tickets", id);
    },
    [data.maintenanceTickets, logAction, user],
  );

  const addTicketNote = useCallback<AppContextValue["addTicketNote"]>(
    (id, body, internal) => {
      const now = new Date().toISOString();
      const note = { at: now, author: user?.full_name ?? "System", body, internal };
      setData((d) => ({
        ...d,
        maintenanceTickets: d.maintenanceTickets.map((t) =>
          t.id === id ? { ...t, notes: [...t.notes, note] } : t,
        ),
      }));
      if (isSupabaseConfigured && supabase) {
        const current = data.maintenanceTickets.find((t) => t.id === id);
        if (current)
          void supabase
            .from("maintenance_tickets")
            .update({ notes: [...current.notes, note] })
            .eq("id", id);
      }
    },
    [data.maintenanceTickets, user],
  );

  const decideApproval = useCallback<AppContextValue["decideApproval"]>(
    (id, decision, reason) => {
      const now = new Date().toISOString();
      setData((d) => ({
        ...d,
        approvals: d.approvals.map((a) =>
          a.id === id
            ? {
                ...a,
                status: decision,
                decided_at: now,
                decided_by: user?.full_name ?? "Owner",
                rejection_reason: decision === "Rejected" ? reason : undefined,
              }
            : a,
        ),
      }));
      if (isSupabaseConfigured && supabase) {
        void supabase
          .from("approvals")
          .update({
            status: decision,
            decided_at: now,
            decided_by: user?.full_name ?? "Owner",
            rejection_reason: decision === "Rejected" ? (reason ?? null) : null,
          })
          .eq("id", id);
      }
      logAction(`Approval ${decision.toLowerCase()}`, "approvals", id);
    },
    [logAction, user],
  );

  const addDocument = useCallback<AppContextValue["addDocument"]>(
    (input) => {
      const doc: DocumentRecord = {
        ...input,
        id: uid(),
        uploaded_at: new Date().toISOString(),
        uploaded_by: user?.full_name ?? "System",
      };
      setData((d) => ({ ...d, documents: [doc, ...d.documents] }));
      if (isSupabaseConfigured && supabase) void supabase.from("documents").insert(doc).then(reportSaveError("document"));
      logAction("Document uploaded", "documents", doc.id);
    },
    [logAction, user],
  );

  const deleteDocument = useCallback(
    (id: string) => {
      setData((d) => ({ ...d, documents: d.documents.filter((doc) => doc.id !== id) }));
      if (isSupabaseConfigured && supabase) void supabase.from("documents").delete().eq("id", id);
      logAction("Document deleted", "documents", id);
    },
    [logAction],
  );

  const softDelete = useCallback<AppContextValue["softDelete"]>(
    async (entity, id) => {
      const deleted_at = new Date().toISOString();
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from(entity).update({ deleted_at }).eq("id", id);
        if (error) throw new Error(error.message);
      }
      setData((d) => {
        const mark = <T extends { id: string }>(rows: T[]) =>
          rows.map((r) => (r.id === id ? { ...r, deleted_at } : r));
        if (entity === "owners") return { ...d, owners: mark(d.owners) };
        if (entity === "tenants") return { ...d, tenants: mark(d.tenants) };
        if (entity === "technicians") return { ...d, technicians: mark(d.technicians) };
        if (entity === "vendors") return { ...d, vendors: mark(d.vendors) };
        return { ...d, leases: mark(d.leases) };
      });
      logAction("Marked as deleted (removed after 7 days)", entity, id);
    },
    [logAction],
  );

  const markNotificationRead = useCallback((id: string) => {
    setData((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
    }));
    if (isSupabaseConfigured && supabase)
      void supabase.from("notifications").update({ read: true }).eq("id", id);
  }, []);

  const markAllNotificationsRead = useCallback(() => {
    setData((d) => ({ ...d, notifications: d.notifications.map((n) => ({ ...n, read: true })) }));
    if (isSupabaseConfigured && supabase)
      void supabase.from("notifications").update({ read: true });
  }, []);

  const uploadFile = useCallback(async (file: File | null | undefined): Promise<FileRef | null> => {
    if (!file) return null;
    const ref: FileRef = { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` };
    if (isSupabaseConfigured && supabase) {
      const path = `${uid()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const { error } = await supabase.storage.from("quotation-files").upload(path, file);
      if (error) toast.error(`File not uploaded: ${error.message}`);
      else ref.path = path;
    }
    return ref;
  }, []);

  const getFileUrl = useCallback(async (file: FileRef) => {
    if (!file.path || !isSupabaseConfigured || !supabase) return null;
    const { data: res } = await supabase.storage.from("quotation-files").createSignedUrl(file.path, 3600);
    return res?.signedUrl ?? null;
  }, []);

  const addTechnician = useCallback<AppContextValue["addTechnician"]>(
    async (input) => {
      const t: Technician = { ...input, id: uid(), created_at: new Date().toISOString(), invite_code: generateInviteCode() };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("technicians").insert(t);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, technicians: [t, ...d.technicians] }));
      logAction("Technician added", "technicians", t.id);
      return t;
    },
    [logAction],
  );

  const addVendor = useCallback<AppContextValue["addVendor"]>(
    async (input) => {
      const v: Vendor = { ...input, id: uid(), created_at: new Date().toISOString(), invite_code: generateInviteCode() };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("vendors").insert(v);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, vendors: [v, ...d.vendors] }));
      logAction("Vendor added", "vendors", v.id);
      return v;
    },
    [logAction],
  );

  const nextRef = (prefix: string, existing: { reference: string }[]) => {
    const max = existing.reduce((m, r) => Math.max(m, Number(r.reference.replace(/\D/g, "")) || 0), 0);
    return `${prefix}-${String(max + 1).padStart(4, "0")}`;
  };

  /** Applies a ticket patch locally + in the database, with a timeline entry. */
  const patchTicket = useCallback(
    async (ticketId: string, patch: Partial<MaintenanceTicket>, event: string) => {
      const now = new Date().toISOString();
      const current = data.maintenanceTickets.find((t) => t.id === ticketId);
      const timeline = [...(current?.timeline ?? []), { at: now, actor: user?.full_name ?? "System", message: event }];
      setData((d) => ({
        ...d,
        maintenanceTickets: d.maintenanceTickets.map((t) =>
          t.id === ticketId ? { ...t, ...patch, updated_at: now, timeline } : t,
        ),
      }));
      if (isSupabaseConfigured && supabase) {
        // Older databases may miss some columns: drop the missing one and retry so the rest still saves.
        let row: Record<string, unknown> = { ...patch, updated_at: now, timeline };
        for (let attempt = 0; attempt < 6; attempt++) {
          const { error } = await supabase.from("maintenance_tickets").update(row).eq("id", ticketId);
          if (!error) break;
          const missing = /Could not find the '([^']+)' column/i.exec(error.message)?.[1];
          if (missing && missing in row) {
            console.warn(`maintenance_tickets.${missing} is missing in the database — run db/fix-quote-choice.sql`);
            const { [missing]: _omit, ...rest } = row;
            row = rest;
            continue;
          }
          reportSaveError("ticket")({ error });
          break;
        }
      }
    },
    [data.maintenanceTickets, user],
  );

  const assignTechnicians = useCallback<AppContextValue["assignTechnicians"]>(
    async (ticketId, technicianIds) => {
      const ticket = data.maintenanceTickets.find((t) => t.id === ticketId);
      if (!ticket) throw new Error("Ticket not found.");
      const property = data.properties.find((p) => p.id === ticket.property_id);
      const unit = data.units.find((u) => u.id === ticket.unit_id);
      const location = [property?.name, unit ? `Unit ${unit.unit_number}` : "", property?.address, property?.city]
        .filter(Boolean)
        .join(", ");
      const all = [...data.technicianJobs];
      const jobs: TechnicianJob[] = technicianIds.map((techId) => {
        const job: TechnicianJob = {
          id: uid(),
          reference: nextRef("TJ", all),
          ticket_id: ticketId,
          technician_id: techId,
          owner_id: ticket.owner_id,
          details: {
            reference: ticket.reference,
            title: ticket.title,
            description: ticket.description,
            category: ticket.category,
            priority: ticket.priority,
            location,
          },
          status: "Assigned",
          labour_price: 0,
          items: [],
          created_at: new Date().toISOString(),
        };
        all.push(job);
        return job;
      });
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("technician_jobs").insert(jobs);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, technicianJobs: [...jobs, ...d.technicianJobs] }));
      const names = jobs.map((j) => data.technicians.find((t) => t.id === j.technician_id)?.full_name ?? "technician");
      await patchTicket(
        ticketId,
        { status: ticket.status === "NEW" ? "UNDER REVIEW" : ticket.status, quote_stage: "Collecting" },
        `Technicians assigned for quotation: ${names.join(", ")}`,
      );
      jobs.forEach((j) =>
        notify({
          user_role: "TECHNICIAN",
          technician_id: j.technician_id,
          title: `New job ${j.reference}`,
          message: `${ticket.title} at ${location}. Please send your quotation.`,
          type: "Maintenance",
          href: "/jobs",
        }),
      );
      logAction("Technicians assigned", "maintenance_tickets", ticketId);
    },
    [data, logAction, notify, patchTicket],
  );

  const submitTechnicianQuote = useCallback<AppContextValue["submitTechnicianQuote"]>(
    async (jobId, input) => {
      const job = data.technicianJobs.find((j) => j.id === jobId);
      if (!job) throw new Error("Job not found.");
      const attachment = (await uploadFile(input.file)) ?? job.attachment ?? null;
      const patch = {
        labour_price: input.labour_price,
        items: input.items,
        note: input.note ?? "",
        attachment,
        status: "Quoted" as const,
        quoted_at: new Date().toISOString(),
      };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("technician_jobs").update(patch).eq("id", jobId);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({
        ...d,
        technicianJobs: d.technicianJobs.map((j) => (j.id === jobId ? { ...j, ...patch } : j)),
      }));
      notify({
        user_role: "PROPERTY_MANAGER",
        title: `Technician quotation ${job.reference}`,
        message: `${user?.full_name ?? "Technician"} quoted ${input.labour_price} labour + ${input.items.length} item(s) for ${job.details.reference}.`,
        type: "Maintenance",
        href: `/maintenance/${job.ticket_id}`,
      });
    },
    [data.technicianJobs, notify, uploadFile, user],
  );

  const requestVendorQuotes = useCallback<AppContextValue["requestVendorQuotes"]>(
    async (jobId, vendorIds) => {
      const job = data.technicianJobs.find((j) => j.id === jobId);
      if (!job) throw new Error("Job not found.");
      const all = [...data.vendorQuotes];
      const quotes: VendorQuote[] = vendorIds.map((vendorId) => {
        const q: VendorQuote = {
          id: uid(),
          reference: nextRef("VQ", all),
          ticket_id: job.ticket_id,
          technician_job_id: job.id,
          vendor_id: vendorId,
          owner_id: job.owner_id,
          delivery_location: job.details.location,
          status: "Requested",
          items: job.items.map((i) => ({ ...i, unit_price: 0 })),
          delivery_charge: 0,
          created_at: new Date().toISOString(),
        };
        all.push(q);
        return q;
      });
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("vendor_quotes").insert(quotes);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({ ...d, vendorQuotes: [...quotes, ...d.vendorQuotes] }));
      const names = quotes.map((q) => data.vendors.find((v) => v.id === q.vendor_id)?.name ?? "vendor");
      await patchTicket(job.ticket_id, {}, `Item list of ${job.reference} sent to vendors: ${names.join(", ")}`);
      quotes.forEach((q) =>
        notify({
          user_role: "VENDOR",
          vendor_id: q.vendor_id,
          title: `Quotation request ${q.reference}`,
          message: `Price ${q.items.length} item(s) for delivery to ${q.delivery_location}.`,
          type: "Maintenance",
          href: "/jobs",
        }),
      );
    },
    [data.technicianJobs, data.vendorQuotes, data.vendors, notify, patchTicket],
  );

  const submitVendorQuote = useCallback<AppContextValue["submitVendorQuote"]>(
    async (quoteId, input) => {
      const q = data.vendorQuotes.find((x) => x.id === quoteId);
      if (!q) throw new Error("Quotation not found.");
      const attachment = (await uploadFile(input.file)) ?? q.attachment ?? null;
      const items = q.items.map((i) => ({ ...i, unit_price: input.unit_prices[i.id] ?? 0 }));
      const patch = {
        items,
        delivery_charge: input.delivery_charge,
        note: input.note ?? "",
        attachment,
        status: "Quoted" as const,
        quoted_at: new Date().toISOString(),
      };
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from("vendor_quotes").update(patch).eq("id", quoteId);
        if (error) throw new Error(error.message);
      }
      setData((d) => ({
        ...d,
        vendorQuotes: d.vendorQuotes.map((x) => (x.id === quoteId ? { ...x, ...patch } : x)),
      }));
      notify({
        user_role: "PROPERTY_MANAGER",
        title: `Vendor quotation ${q.reference}`,
        message: `${user?.full_name ?? "Vendor"} sent prices for ${items.length} item(s).`,
        type: "Maintenance",
        href: `/maintenance/${q.ticket_id}`,
      });
    },
    [data.vendorQuotes, notify, uploadFile, user],
  );

  const sendOptionsToLandlord = useCallback<AppContextValue["sendOptionsToLandlord"]>(
    async (ticketId) => {
      const ticket = data.maintenanceTickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      await patchTicket(ticketId, { quote_stage: "Awaiting landlord" }, "Quotations sent to landlord for approval");
      notify({
        user_role: "LANDLORD",
        owner_id: ticket.owner_id,
        title: `Approval needed: ${ticket.reference}`,
        message: `Quotations for "${ticket.title}" are above your approval limit. Please choose one option.`,
        type: "Approval",
        href: `/maintenance/${ticketId}`,
      });
      logAction("Quotations sent to landlord", "maintenance_tickets", ticketId);
    },
    [data.maintenanceTickets, logAction, notify, patchTicket],
  );

  const chooseOption = useCallback<AppContextValue["chooseOption"]>(
    async (ticketId, optionKey) => {
      const ticket = data.maintenanceTickets.find((t) => t.id === ticketId);
      if (!ticket) return;
      const quotes = data.vendorQuotes.filter((q) => q.ticket_id === ticketId);
      const jobs = data.technicianJobs.filter((j) => j.ticket_id === ticketId);
      const chosenQuote = quotes.find((q) => q.id === optionKey);
      const chosenJobId = chosenQuote ? chosenQuote.technician_job_id : optionKey;
      const quoteStatus = (q: VendorQuote) =>
        q.id === optionKey ? "Selected" : q.status === "Requested" ? q.status : "Rejected";
      const jobStatus = (j: TechnicianJob) => (j.id === chosenJobId ? "Selected" : "Rejected");
      // Above the landlord's approval limit, only the landlord may choose.
      if (user?.role !== "LANDLORD") {
        const limit = data.owners.find((o) => o.id === ticket.owner_id)?.approval_threshold ?? 0;
        const anyAbove = limit > 0 && quoteOptionsFor(ticketId, jobs, quotes).some((o) => o.total > limit);
        if (anyAbove) throw new Error("An option is above the landlord's approval limit. Send it to the landlord for approval.");
      }
      if (isSupabaseConfigured && supabase) {
        const client = supabase;
        const results = await Promise.all([
          ...quotes.map((q) => client.from("vendor_quotes").update({ status: quoteStatus(q) }).eq("id", q.id)),
          ...jobs.map((j) => client.from("technician_jobs").update({ status: jobStatus(j) }).eq("id", j.id)),
        ]);
        const failed = results.find((r) => r.error);
        if (failed?.error) throw new Error(`Could not save your choice: ${failed.error.message}`);
      }
      setData((d) => ({
        ...d,
        vendorQuotes: d.vendorQuotes.map((q) => (q.ticket_id === ticketId ? { ...q, status: quoteStatus(q) } : q)),
        technicianJobs: d.technicianJobs.map((j) => (j.ticket_id === ticketId ? { ...j, status: jobStatus(j) } : j)),
      }));
      const job = jobs.find((j) => j.id === chosenJobId);
      const total = optionTotal(job, chosenQuote);
      const label = chosenQuote ? `${job?.reference} + ${chosenQuote.reference}` : (job?.reference ?? "");
      const byLandlord = user?.role === "LANDLORD";
      await patchTicket(
        ticketId,
        {
          quote_stage: "Approved",
          selected_option: optionKey,
          estimated_cost: total,
          status: "ASSIGNED",
          assigned_to: data.technicians.find((t) => t.id === job?.technician_id)?.full_name ?? ticket.assigned_to,
        },
        `${byLandlord ? "Landlord approved" : "Selected"} option ${label} (${total.toFixed(2)})`,
      );
      if (chosenQuote) {
        // Saved separately so an older vendor link setup can never block the choice itself.
        setData((d) => ({
          ...d,
          maintenanceTickets: d.maintenanceTickets.map((t) =>
            t.id === ticketId ? { ...t, vendor_id: chosenQuote.vendor_id } : t,
          ),
        }));
        if (isSupabaseConfigured && supabase)
          void supabase
            .from("maintenance_tickets")
            .update({ vendor_id: chosenQuote.vendor_id })
            .eq("id", ticketId)
            .then(({ error }) => {
              if (error) console.warn("Vendor link on ticket not saved:", error.message);
            });
      }
      if (byLandlord)
        notify({
          user_role: "PROPERTY_MANAGER",
          title: `Landlord approved ${ticket.reference}`,
          message: `Option ${label} was approved. Please proceed with the job.`,
          type: "Approval",
          href: `/maintenance/${ticketId}`,
        });
      if (job)
        notify({
          user_role: "TECHNICIAN",
          technician_id: job.technician_id,
          title: `Your quotation ${job.reference} was selected`,
          message: `Proceed with ${job.details.title}.`,
          type: "Maintenance",
          href: "/jobs",
        });
      if (chosenQuote)
        notify({
          user_role: "VENDOR",
          vendor_id: chosenQuote.vendor_id,
          title: `Order confirmation needed: ${chosenQuote.reference}`,
          message: `Your quotation was selected. Please confirm the order and enter an estimated delivery date to ${chosenQuote.delivery_location}.`,
          type: "Maintenance",
          href: "/jobs",
        });
      else if (job)
        notify({
          user_role: "TECHNICIAN",
          technician_id: job.technician_id,
          title: `Book a work date: ${job.reference}`,
          message: `Please suggest at least 3 free dates & times (from tomorrow) with the estimated duration.`,
          type: "Maintenance",
          href: "/jobs",
        });
      logAction("Quotation option chosen", "maintenance_tickets", ticketId);
    },
    [data, logAction, notify, patchTicket, user],
  );

  // ---- Work order (after a choice) ----
  const ticketCtx = useCallback(
    (ticketId: string) => {
      const ticket = data.maintenanceTickets.find((t) => t.id === ticketId);
      if (!ticket) throw new Error("Maintenance request not found.");
      const quote = data.vendorQuotes.find((q) => q.id === ticket.selected_option);
      const job =
        data.technicianJobs.find((j) => j.id === (quote ? quote.technician_job_id : ticket.selected_option)) ??
        data.technicianJobs.find((j) => j.ticket_id === ticketId && j.status === "Selected");
      return { ticket, quote, job, wo: ticket.work_order ?? {} };
    },
    [data.maintenanceTickets, data.vendorQuotes, data.technicianJobs],
  );

  const updatePartner = useCallback<AppContextValue["updatePartner"]>(
    async (kind, id, patch) => {
      const table = kind === "technician" ? "technicians" : "vendors";
      if (isSupabaseConfigured && supabase) {
        const { error } = await supabase.from(table).update(patch).eq("id", id);
        if (error) throw new Error(error.message);
      }
      setData((d) =>
        kind === "technician"
          ? { ...d, technicians: d.technicians.map((t) => (t.id === id ? { ...t, ...patch } : t)) }
          : { ...d, vendors: d.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)) },
      );
      logAction(`${kind === "technician" ? "Technician" : "Vendor"} updated`, table, id);
    },
    [logAction],
  );

  const confirmVendorOrder = useCallback<AppContextValue["confirmVendorOrder"]>(
    async (ticketId, deliveryDate) => {
      const { ticket, quote, job, wo } = ticketCtx(ticketId);
      await patchTicket(
        ticketId,
        { work_order: { ...wo, vendor_confirmed_at: new Date().toISOString(), delivery_date: deliveryDate } },
        `Vendor confirmed the order, estimated delivery ${deliveryDate}`,
      );
      notify({
        user_role: "PROPERTY_MANAGER",
        title: `Order confirmed: ${quote?.reference ?? ticket.reference}`,
        message: `Vendor confirmed the order for "${ticket.title}". Estimated delivery: ${deliveryDate}.`,
        type: "Maintenance",
        href: `/maintenance/${ticketId}`,
      });
      if (job)
        notify({
          user_role: "TECHNICIAN",
          technician_id: job.technician_id,
          title: `Book a work date: ${job.reference}`,
          message: `Materials arrive ${deliveryDate}. Suggest at least 3 free dates & times after that, with the estimated duration.`,
          type: "Maintenance",
          href: "/jobs",
        });
    },
    [notify, patchTicket, ticketCtx],
  );

  const proposeSlots = useCallback<AppContextValue["proposeSlots"]>(
    async (ticketId, slots) => {
      const { ticket, job, wo } = ticketCtx(ticketId);
      if (slots.length < 3) throw new Error("Suggest at least 3 dates & times.");
      const earliest = earliestWorkDate(wo.delivery_date);
      if (slots.some((s) => s.start.slice(0, 10) < earliest))
        throw new Error(`All dates must be on or after ${earliest}.`);
      await patchTicket(
        ticketId,
        { work_order: { ...wo, slots, slots_sent_at: new Date().toISOString(), booked_slot_id: undefined } },
        `${job?.reference ?? "Technician"} suggested ${slots.length} work dates`,
      );
      const msg = `The technician suggested ${slots.length} dates & times for "${ticket.title}".`;
      notify({ user_role: "PROPERTY_MANAGER", title: `Work dates suggested: ${ticket.reference}`, message: msg, type: "Maintenance", href: `/maintenance/${ticketId}` });
      if (ticket.tenant_id)
        notify({
          user_role: "TENANT",
          tenant_id: ticket.tenant_id,
          title: `Choose a visit date: ${ticket.reference}`,
          message: `${msg} Please choose the one that suits you.`,
          type: "Maintenance",
          href: `/maintenance/${ticketId}`,
        });
    },
    [notify, patchTicket, ticketCtx],
  );

  const bookSlot = useCallback<AppContextValue["bookSlot"]>(
    async (ticketId, slotId) => {
      const { ticket, job, wo } = ticketCtx(ticketId);
      const slot = wo.slots?.find((s) => s.id === slotId);
      if (!slot) throw new Error("Date not found.");
      const when = new Date(slot.start).toLocaleString();
      await patchTicket(
        ticketId,
        { work_order: { ...wo, booked_slot_id: slotId, booked_at: new Date().toISOString() } },
        `Visit booked for ${when}`,
      );
      const msg = `The tenant booked ${when} (about ${slot.duration_hours}h) for "${ticket.title}".`;
      notify({ user_role: "PROPERTY_MANAGER", title: `Visit booked: ${ticket.reference}`, message: msg, type: "Maintenance", href: `/maintenance/${ticketId}` });
      if (job)
        notify({ user_role: "TECHNICIAN", technician_id: job.technician_id, title: `Visit booked: ${job.reference}`, message: msg, type: "Maintenance", href: "/jobs" });
    },
    [notify, patchTicket, ticketCtx],
  );

  const completeWork = useCallback<AppContextValue["completeWork"]>(
    async (ticketId) => {
      const { ticket, wo } = ticketCtx(ticketId);
      await patchTicket(
        ticketId,
        { status: "COMPLETED", work_order: { ...wo, completed_at: new Date().toISOString() } },
        "Technician marked the work as done",
      );
      notify({ user_role: "PROPERTY_MANAGER", title: `Work done: ${ticket.reference}`, message: `The technician finished "${ticket.title}".`, type: "Maintenance", href: `/maintenance/${ticketId}` });
      if (ticket.tenant_id)
        notify({
          user_role: "TENANT",
          tenant_id: ticket.tenant_id,
          title: `Work done: ${ticket.reference}`,
          message: `"${ticket.title}" is finished. Please rate the work.`,
          type: "Maintenance",
          href: `/maintenance/${ticketId}`,
        });
    },
    [notify, patchTicket, ticketCtx],
  );

  const submitFeedback = useCallback<AppContextValue["submitFeedback"]>(
    async (ticketId, rating, comment) => {
      const { ticket, job, wo } = ticketCtx(ticketId);
      await patchTicket(
        ticketId,
        { work_order: { ...wo, rating, feedback: comment, feedback_at: new Date().toISOString() } },
        `Tenant rated the work ${rating}/5`,
      );
      const msg = `Tenant rated "${ticket.title}" ${rating}/5${comment ? `: "${comment}"` : ""}.`;
      notify({ user_role: "PROPERTY_MANAGER", title: `Feedback: ${ticket.reference}`, message: msg, type: "Maintenance", href: `/maintenance/${ticketId}` });
      if (job)
        notify({ user_role: "TECHNICIAN", technician_id: job.technician_id, title: `Feedback: ${job.reference}`, message: msg, type: "Maintenance", href: "/jobs" });
    },
    [notify, patchTicket, ticketCtx],
  );

  // ---- Payments ----
  const savePayment = useCallback(async (p: Payment, isNew: boolean) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = isNew
        ? await supabase.from("payments").insert(p)
        : await supabase.from("payments").update(p).eq("id", p.id);
      if (error) throw new Error(`Could not save the payment: ${error.message}`);
    }
    setData((d) => ({
      ...d,
      payments: isNew ? [p, ...d.payments] : d.payments.map((x) => (x.id === p.id ? p : x)),
    }));
  }, []);

  const addCompanyBank = useCallback<AppContextValue["addCompanyBank"]>(async (input) => {
    const b: CompanyBank = { ...input, id: uid(), created_at: new Date().toISOString() };
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("company_banks").insert(b);
      if (error) throw new Error(error.message);
    }
    setData((d) => ({ ...d, companyBanks: [...d.companyBanks, b] }));
  }, []);

  const deleteCompanyBank = useCallback<AppContextValue["deleteCompanyBank"]>(async (id) => {
    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from("company_banks").delete().eq("id", id);
      if (error) throw new Error(error.message);
    }
    setData((d) => ({ ...d, companyBanks: d.companyBanks.filter((b) => b.id !== id) }));
  }, []);

  const submitRentPayment = useCallback<AppContextValue["submitRentPayment"]>(
    async (rentId, amount, slip) => {
      const rent = data.rentSchedules.find((r) => r.id === rentId);
      if (!rent) throw new Error("Rent record not found.");
      const file = await uploadFile(slip);
      const p: Payment = {
        id: uid(),
        kind: "TENANT_RENT",
        amount,
        method: "Bank Transfer",
        status: "Submitted",
        rent_id: rentId,
        tenant_id: rent.tenant_id,
        slip: file,
        created_at: new Date().toISOString(),
      };
      await savePayment(p, true);
      const tenant = data.tenants.find((t) => t.id === rent.tenant_id);
      notify({
        user_role: "PROPERTY_MANAGER",
        title: "Rent payment submitted",
        message: `${tenant?.full_name ?? "A tenant"} paid AED ${amount.toLocaleString()} by bank transfer. Please confirm it.`,
        type: "Rent",
        href: "/rent",
      });
    },
    [data.rentSchedules, data.tenants, notify, savePayment, uploadFile],
  );

  const confirmRentPayment = useCallback<AppContextValue["confirmRentPayment"]>(
    async (paymentId) => {
      const p = data.payments.find((x) => x.id === paymentId);
      if (!p?.rent_id) throw new Error("Payment not found.");
      await savePayment({ ...p, status: "Confirmed", confirmed_at: new Date().toISOString() }, false);
      recordPayment(p.rent_id, p.amount, "Bank Transfer");
      notify({
        user_role: "TENANT",
        tenant_id: p.tenant_id,
        title: "Payment confirmed",
        message: `Your rent payment of AED ${p.amount.toLocaleString()} was received.`,
        type: "Rent",
        href: "/rent",
      });
    },
    [data.payments, notify, recordPayment, savePayment],
  );

  const payPartner = useCallback<AppContextValue["payPartner"]>(
    async ({ kind, partyId, amount, slip, note }) => {
      const file = await uploadFile(slip);
      const p: Payment = {
        id: uid(),
        kind,
        amount,
        method: "Bank Transfer",
        status: "Submitted",
        owner_id: kind === "LANDLORD" ? partyId : undefined,
        vendor_id: kind === "VENDOR" ? partyId : undefined,
        technician_id: kind === "TECHNICIAN" ? partyId : undefined,
        slip: file,
        note,
        created_at: new Date().toISOString(),
      };
      await savePayment(p, true);
      notify({
        user_role: kind === "LANDLORD" ? "LANDLORD" : kind,
        owner_id: p.owner_id,
        vendor_id: p.vendor_id,
        technician_id: p.technician_id,
        title: "Payment sent to you",
        message: `AED ${amount.toLocaleString()} was paid to your bank account. Please check and confirm it.`,
        type: "Rent",
        href: "/payouts",
      });
      logAction("Payment sent", "payments", p.id);
    },
    [logAction, notify, savePayment, uploadFile],
  );

  const confirmPayoutReceived = useCallback<AppContextValue["confirmPayoutReceived"]>(
    async (paymentId) => {
      const p = data.payments.find((x) => x.id === paymentId);
      if (!p) throw new Error("Payment not found.");
      await savePayment({ ...p, status: "Confirmed", confirmed_at: new Date().toISOString() }, false);
      notify({
        user_role: "PROPERTY_MANAGER",
        title: "Payment confirmed",
        message: `${user?.full_name ?? "The receiver"} confirmed receiving AED ${p.amount.toLocaleString()}.`,
        type: "Rent",
        href: "/rent",
      });
    },
    [data.payments, notify, savePayment, user],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      ...data,
      user,
      loading,
      backend: isSupabaseConfigured ? "supabase" : "demo",
      scoped: scopeFor(user, data),
      signIn,
      checkInviteEmail,
      verifyInviteCode,
      registerWithInvite,
      requestPasswordReset,
      updatePassword,
      signOut,
      addProperty,
      addUnit,
      addBuilding,
      addTenant,
      addLease,
      addOwner,
      updateOwner,
      linkLandlordByEmail,
      recordPayment,
      createTicket,
      updateTicket,
      addTicketNote,
      decideApproval,
      addDocument,
      deleteDocument,
      softDelete,
      markNotificationRead,
      markAllNotificationsRead,
      logAction,
      addTechnician,
      addVendor,
      assignTechnicians,
      submitTechnicianQuote,
      requestVendorQuotes,
      submitVendorQuote,
      sendOptionsToLandlord,
      chooseOption,
      getFileUrl,
      addCompanyBank,
      deleteCompanyBank,
      submitRentPayment,
      confirmRentPayment,
      payPartner,
      confirmPayoutReceived,
      updatePartner,
      confirmVendorOrder,
      proposeSlots,
      bookSlot,
      completeWork,
      submitFeedback,
    }),
    [
      data,
      user,
      loading,
      signIn,
      checkInviteEmail,
      verifyInviteCode,
      registerWithInvite,
      requestPasswordReset,
      updatePassword,
      signOut,
      addProperty,
      addUnit,
      addBuilding,
      addTenant,
      addLease,
      addOwner,
      updateOwner,
      linkLandlordByEmail,
      recordPayment,
      createTicket,
      updateTicket,
      addTicketNote,
      decideApproval,
      addDocument,
      deleteDocument,
      softDelete,
      markNotificationRead,
      markAllNotificationsRead,
      logAction,
      addTechnician,
      addVendor,
      assignTechnicians,
      submitTechnicianQuote,
      requestVendorQuotes,
      submitVendorQuote,
      sendOptionsToLandlord,
      chooseOption,
      getFileUrl,
      addCompanyBank,
      deleteCompanyBank,
      submitRentPayment,
      confirmRentPayment,
      payPartner,
      confirmPayoutReceived,
      updatePartner,
      confirmVendorOrder,
      proposeSlots,
      bookSlot,
      completeWork,
      submitFeedback,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export const homeRouteFor = (role: Role) =>
  role === "TENANT"
    ? "/portal"
    : role === "LANDLORD"
      ? "/investor"
      : role === "TECHNICIAN" || role === "VENDOR"
        ? "/jobs"
        : "/dashboard";

// ---- Quotation math ----
export const vendorQuoteTotal = (q: VendorQuote | undefined) =>
  q ? q.items.reduce((s, i) => s + i.qty * (i.unit_price || 0), 0) + (q.delivery_charge || 0) : 0;

/** Total job value = technician charges + vendor prices. */
export const optionTotal = (job: TechnicianJob | undefined, q: VendorQuote | undefined) =>
  (job?.labour_price ?? 0) + vendorQuoteTotal(q);

export interface QuoteOption {
  key: string;
  job: TechnicianJob;
  quote?: VendorQuote | undefined;
  total: number;
}

/** Every complete option for a ticket: each quoted vendor quote, or a quoted job without items. */
export function quoteOptionsFor(ticketId: string, jobs: TechnicianJob[], quotes: VendorQuote[]): QuoteOption[] {
  const out: QuoteOption[] = [];
  for (const job of jobs.filter((j) => j.ticket_id === ticketId && j.status !== "Assigned")) {
    if (!job.items.length) {
      out.push({ key: job.id, job, total: optionTotal(job, undefined) });
      continue;
    }
    for (const q of quotes.filter((x) => x.technician_job_id === job.id && x.status !== "Requested"))
      out.push({ key: q.id, job, quote: q, total: optionTotal(job, q) });
  }
  return out.sort((a, b) => a.total - b.total);
}

/** Technician work dates start the day after vendor delivery (or tomorrow without materials). yyyy-mm-dd */
export function earliestWorkDate(deliveryDate?: string): string {
  const base = deliveryDate ? new Date(`${deliveryDate}T00:00:00`) : new Date();
  base.setDate(base.getDate() + 1);
  const y = base.getFullYear(), m = String(base.getMonth() + 1).padStart(2, "0"), d = String(base.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
