// Generates db/seed.sql from the in-app demo dataset so the SQL exactly
// matches what demo mode shows. Run: bun scripts/gen-seed.ts
import * as seed from "../src/lib/demo-data";
import { writeFileSync } from "node:fs";

const esc = (s: string | number | boolean | null | undefined) => {
  if (s === null || s === undefined) return "null";
  if (typeof s === "number") return String(s);
  if (typeof s === "boolean") return s ? "true" : "false";
  return `'${String(s).replace(/'/g, "''")}'`;
};
const iso = (s?: string) => (s ? `'${s}'` : "null");
const obj = (o: Record<string, unknown>) => `'${JSON.stringify(o).replace(/'/g, "''")}'` + "::jsonb";

function table(name: string, cols: string[], rows: (string|number|boolean)[][]) {
  if (!rows.length) return `-- (no rows for ${name})\n`;
  const lines = rows.map(
    (r) => `  (${r.join(", ")})`,
  );
  return `INSERT INTO public.${name} (${cols.join(", ")}) VALUES\n${lines.join(",\n")}\nON CONFLICT (id) DO NOTHING;\n\n`;
}

const out: string[] = [];
out.push(`-- Estora — seed data for your own Supabase project.
-- Run AFTER db/schema.sql AND after creating the demo auth users in
-- Supabase Dashboard -> Authentication -> Users (emails below, password
-- "demo1234", tick "Auto Confirm User"):
--   admin@estora.app   (admin)
--   manager@estora.app (property_manager)
--   owner@estora.app   (landlord, owns own-1)
--   owner2@estora.app  (landlord, owns own-2)
--   tenant@estora.app  (tenant, ten-1)
-- Idempotent (ON CONFLICT DO NOTHING). Safe to re-run.

BEGIN;

`);

// owners
out.push(table("owners",
  ["id","full_name","email","phone","country","address","kyc_status","bank_details_status","approval_threshold","status","created_at"],
  seed.owners.map((o) => [esc(o.id),esc(o.full_name),esc(o.email),esc(o.phone),esc(o.country),esc(o.address),esc(o.kyc_status),esc(o.bank_details_status),o.approval_threshold,esc(o.status),iso(o.created_at)])));

// properties
out.push(table("properties",
  ["id","name","type","address","city","country","owner_id","manager_id","status","created_at"],
  seed.properties.map((p) => [esc(p.id),esc(p.name),esc(p.type),esc(p.address),esc(p.city),esc(p.country),esc(p.owner_id),esc(p.manager_id),esc(p.status),iso(p.created_at)])));

// buildings
out.push(table("buildings",
  ["id","property_id","name","floors","created_at"],
  seed.buildings.map((b) => [esc(b.id),esc(b.property_id),esc(b.name),b.floors,iso(b.created_at)])));

// units (tenant_id set in a later UPDATE to satisfy circular FK)
out.push(table("units",
  ["id","property_id","building_id","unit_number","floor","unit_type","bedrooms","bathrooms","furnished","area_sqft","owner_id","tenant_id","monthly_rent","status"],
  seed.units.map((u) => [esc(u.id),esc(u.property_id),esc(u.building_id),esc(u.unit_number),u.floor,esc(u.unit_type),u.bedrooms,u.bathrooms,esc(u.furnished),u.area_sqft,esc(u.owner_id),"null",u.monthly_rent,esc(u.status)])));

// tenants
out.push(table("tenants",
  ["id","full_name","email","phone","nationality","unit_id","property_id","status","created_at"],
  seed.tenants.map((t) => [esc(t.id),esc(t.full_name),esc(t.email),esc(t.phone),esc(t.nationality),esc(t.unit_id),esc(t.property_id),esc(t.status),iso(t.created_at)])));

// link unit.tenant_id for occupied units
out.push("-- link units to their tenants (circular FK resolved)\n");
for (const u of seed.units) {
  if (u.tenant_id) {
    out.push(`UPDATE public.units SET tenant_id = ${esc(u.tenant_id)} WHERE id = ${esc(u.id)};\n`);
  }
}
out.push("\n");

// leases
out.push(table("leases",
  ["id","lease_number","property_id","unit_id","owner_id","tenant_id","start_date","end_date","monthly_rent","security_deposit","payment_frequency","status"],
  seed.leases.map((l) => [esc(l.id),esc(l.lease_number),esc(l.property_id),esc(l.unit_id),esc(l.owner_id),esc(l.tenant_id),iso(l.start_date),iso(l.end_date),l.monthly_rent,l.security_deposit,esc(l.payment_frequency),esc(l.status)])));

// rent_schedules
out.push(table("rent_schedules",
  ["id","lease_id","tenant_id","property_id","unit_id","due_date","amount","paid_amount","status","paid_on","method"],
  seed.rentSchedules.map((r) => [esc(r.id),esc(r.lease_id),esc(r.tenant_id),esc(r.property_id),esc(r.unit_id),iso(r.due_date),r.amount,r.paid_amount,esc(r.status),iso(r.paid_on),esc(r.method ?? null)])));

// vendors
out.push(table("vendors",
  ["id","name","trade","phone","email"],
  seed.vendors.map((v) => [esc(v.id),esc(v.name),esc(v.trade),esc(v.phone),esc(v.email)])));

// maintenance_tickets
out.push(table("maintenance_tickets",
  ["id","reference","property_id","unit_id","tenant_id","owner_id","category","title","description","priority","status","vendor_id","assigned_to","estimated_cost","actual_cost","sla_due_at","created_at","updated_at","timeline","notes","attachments"],
  seed.maintenanceTickets.map((t) => [esc(t.id),esc(t.reference),esc(t.property_id),esc(t.unit_id),esc(t.tenant_id ?? null),esc(t.owner_id),esc(t.category),esc(t.title),esc(t.description),esc(t.priority),esc(t.status),esc(t.vendor_id ?? null),esc(t.assigned_to ?? null),t.estimated_cost ?? "null",t.actual_cost ?? "null",iso(t.sla_due_at),iso(t.created_at),iso(t.updated_at),obj(t.timeline),obj(t.notes),obj(t.attachments)])));

// approvals
out.push(table("approvals",
  ["id","reference","ticket_id","property_id","unit_id","owner_id","vendor_id","title","description","amount","status","requested_at","decided_at","decided_by","rejection_reason"],
  seed.approvals.map((a) => [esc(a.id),esc(a.reference),esc(a.ticket_id ?? null),esc(a.property_id),esc(a.unit_id),esc(a.owner_id),esc(a.vendor_id ?? null),esc(a.title),esc(a.description),a.amount,esc(a.status),iso(a.requested_at),iso(a.decided_at),esc(a.decided_by ?? null),esc(a.rejection_reason ?? null)])));

// documents
out.push(table("documents",
  ["id","name","category","property_id","unit_id","owner_id","tenant_id","uploaded_by","uploaded_at","expires_at","file_type","file_size"],
  seed.documents.map((d) => [esc(d.id),esc(d.name),esc(d.category),esc(d.property_id ?? null),esc(d.unit_id ?? null),esc(d.owner_id ?? null),esc(d.tenant_id ?? null),esc(d.uploaded_by),iso(d.uploaded_at),iso(d.expires_at),esc(d.file_type),esc(d.file_size)])));

// notifications
out.push(table("notifications",
  ["id","user_role","owner_id","tenant_id","title","message","type","read","created_at","href"],
  seed.notifications.map((n) => [esc(n.id),esc(n.user_role),esc(n.owner_id ?? null),esc(n.tenant_id ?? null),esc(n.title),esc(n.message),esc(n.type),n.read,iso(n.created_at),esc(n.href ?? null)])));

// expenses
out.push(table("expenses",
  ["id","property_id","owner_id","category","amount","incurred_on","description"],
  seed.expenses.map((e) => [esc(e.id),esc(e.property_id),esc(e.owner_id),esc(e.category),e.amount,iso(e.incurred_on),esc(e.description)])));

// audit_logs
out.push(table("audit_logs",
  ["id","user_name","role","action","entity","entity_id","at","ip","device"],
  seed.auditLogs.map((l) => [esc(l.id),esc(l.user_name),esc(l.role),esc(l.action),esc(l.entity),esc(l.entity_id),iso(l.at),esc(l.ip),esc(l.device)])));

// profiles + user_roles (linked by email lookup against auth.users)
out.push(`-- Link demo auth users (created in the Supabase Auth dashboard) to
-- their app role + owner/tenant. Looked up by email so no hardcoded UUIDs.
`);
const roleMap: Record<string, string> = {
  ADMIN: "admin",
  PROPERTY_MANAGER: "property_manager",
  LANDLORD: "landlord",
  TENANT: "tenant",
};
for (const u of seed.demoUsers) {
  const dbRole = roleMap[u.role] ?? "tenant";
  const ownerPart = u.owner_id ? `, ${esc(u.owner_id)}` : `, null`;
  const tenantPart = u.tenant_id ? `, ${esc(u.tenant_id)}` : `, null`;
  out.push(`INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
SELECT id, ${esc(u.full_name)}${ownerPart}${tenantPart} FROM auth.users WHERE email = ${esc(u.email)}
ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name, owner_id = EXCLUDED.owner_id, tenant_id = EXCLUDED.tenant_id;
`);
  out.push(`INSERT INTO public.user_roles (user_id, role)
SELECT id, ${esc(dbRole)}::public.app_role FROM auth.users WHERE email = ${esc(u.email)}
ON CONFLICT (user_id, role) DO NOTHING;
`);
}

out.push("\nCOMMIT;\n");

writeFileSync(new URL("../db/seed.sql", import.meta.url), out.join(""));
console.log("Wrote db/seed.sql");
