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
  Tenant,
  Unit,
  UnitStatus,
  Vendor,
} from "./types";

const iso = (y: number, m: number, d: number) =>
  new Date(Date.UTC(y, m - 1, d, 9, 0, 0)).toISOString();

export const owners: Owner[] = [
  {
    id: "own-1",
    full_name: "Rashid Al Mansoori",
    email: "rashid.almansoori@mansoorigroup.ae",
    phone: "+971 50 224 8891",
    country: "United Arab Emirates",
    address: "Villa 32, Emirates Hills, Dubai",
    kyc_status: "Verified",
    bank_details_status: "Complete",
    approval_threshold: 400,
    status: "Active",
    created_at: iso(2023, 4, 18),
  },
  {
    id: "own-2",
    full_name: "Priya Nair",
    email: "priya.nair@nairholdings.sg",
    phone: "+65 8123 4477",
    country: "Singapore",
    address: "18 Marina Boulevard, Level 27, Singapore",
    kyc_status: "Pending",
    bank_details_status: "Complete",
    approval_threshold: 250,
    status: "Active",
    created_at: iso(2024, 1, 9),
  },
];

export const properties: Property[] = [
  {
    id: "prop-1",
    name: "Marina Crest Residences",
    type: "Apartment",
    address: "Al Marsa Street, Plot 41",
    city: "Dubai",
    country: "United Arab Emirates",
    owner_id: "own-1",
    manager_id: "usr-pm",
    status: "Under Management",
    created_at: iso(2023, 5, 2),
  },
  {
    id: "prop-2",
    name: "Al Barsha Garden Villas",
    type: "Villa",
    address: "Al Barsha South 3, Community 12",
    city: "Dubai",
    country: "United Arab Emirates",
    owner_id: "own-1",
    manager_id: "usr-pm",
    status: "Active",
    created_at: iso(2023, 11, 14),
  },
  {
    id: "prop-3",
    name: "Jumeirah Bay Tower",
    type: "Building",
    address: "Marasi Drive, Business Bay",
    city: "Dubai",
    country: "United Arab Emirates",
    owner_id: "own-2",
    manager_id: "usr-pm",
    status: "Under Management",
    created_at: iso(2024, 2, 27),
  },
];

export const buildings: Building[] = [
  { id: "bld-1", property_id: "prop-1", name: "Crest Tower A", floors: 12, created_at: iso(2023, 5, 2) },
  { id: "bld-2", property_id: "prop-1", name: "Crest Tower B", floors: 10, created_at: iso(2023, 5, 2) },
  { id: "bld-3", property_id: "prop-2", name: "Garden Block One", floors: 2, created_at: iso(2023, 11, 14) },
  { id: "bld-4", property_id: "prop-2", name: "Garden Block Two", floors: 2, created_at: iso(2023, 11, 14) },
  { id: "bld-5", property_id: "prop-3", name: "Bay Podium Wing", floors: 6, created_at: iso(2024, 2, 27) },
  { id: "bld-6", property_id: "prop-3", name: "Bay Sky Wing", floors: 14, created_at: iso(2024, 2, 27) },
];

type UnitSeed = [string, string, string, number, string, number, number, number, number, UnitStatus];
// [id, propertyId, buildingId(short), floor, unitNumber, beds, baths, area, rent, status]
const unitSeed: UnitSeed[] = [
  ["unit-1", "prop-1", "bld-1", 3, "A-302", 1, 1, 780, 6800, "Occupied"],
  ["unit-2", "prop-1", "bld-1", 4, "A-405", 2, 2, 1180, 9500, "Occupied"],
  ["unit-3", "prop-1", "bld-1", 6, "A-611", 2, 2, 1240, 9800, "Vacant"],
  ["unit-4", "prop-1", "bld-1", 9, "A-902", 3, 3, 1680, 14200, "Occupied"],
  ["unit-5", "prop-1", "bld-2", 2, "B-208", 1, 1, 720, 6300, "Under Maintenance"],
  ["unit-6", "prop-1", "bld-2", 5, "B-506", 2, 2, 1150, 9200, "Occupied"],
  ["unit-7", "prop-1", "bld-2", 7, "B-704", 2, 2, 1160, 9400, "Reserved"],
  ["unit-8", "prop-1", "bld-2", 10, "B-1001", 3, 4, 1980, 16500, "Occupied"],
  ["unit-9", "prop-2", "bld-3", 1, "V-01", 4, 5, 3400, 22000, "Occupied"],
  ["unit-10", "prop-2", "bld-3", 1, "V-02", 4, 5, 3400, 21500, "Vacant"],
  ["unit-11", "prop-2", "bld-3", 1, "V-03", 5, 6, 4100, 26000, "Occupied"],
  ["unit-12", "prop-2", "bld-4", 1, "V-04", 4, 4, 3200, 20500, "Occupied"],
  ["unit-13", "prop-2", "bld-4", 1, "V-05", 5, 6, 4250, 27000, "Vacant"],
  ["unit-14", "prop-2", "bld-4", 1, "V-06", 4, 5, 3300, 21000, "Inactive"],
  ["unit-15", "prop-3", "bld-5", 2, "P-204", 1, 1, 690, 5900, "Occupied"],
  ["unit-16", "prop-3", "bld-5", 3, "P-311", 2, 2, 1100, 8700, "Vacant"],
  ["unit-17", "prop-3", "bld-5", 5, "P-508", 2, 2, 1120, 8900, "Occupied"],
  ["unit-18", "prop-3", "bld-6", 8, "S-806", 2, 3, 1450, 12400, "Reserved"],
  ["unit-19", "prop-3", "bld-6", 11, "S-1103", 3, 4, 1890, 16800, "Occupied"],
  ["unit-20", "prop-3", "bld-6", 13, "S-1302", 3, 4, 1920, 17400, "Vacant"],
];

const unitTypeFor = (beds: number, propertyId: string) =>
  propertyId === "prop-2" ? `${beds} Bedroom Villa` : `${beds} Bedroom Apartment`;

export const units: Unit[] = unitSeed.map(
  ([id, property_id, building_id, floor, unit_number, bedrooms, bathrooms, area_sqft, monthly_rent, status]) => ({
    id,
    property_id,
    building_id,
    unit_number,
    floor,
    unit_type: unitTypeFor(bedrooms, property_id),
    bedrooms,
    bathrooms,
    furnished: bedrooms >= 3 ? "Semi-Furnished" : "Furnished",
    area_sqft,
    owner_id: property_id === "prop-3" ? "own-2" : "own-1",
    monthly_rent,
    status,
  }),
);

const tenantSeed: [string, string, string, string, string][] = [
  ["ten-1", "Layla Haddad", "layla.haddad@gmail.com", "+971 55 774 2213", "Lebanese"],
  ["ten-2", "James Okoro", "james.okoro@outlook.com", "+971 52 118 9043", "Nigerian"],
  ["ten-3", "Marta Kowalski", "marta.kowalski@proton.me", "+971 56 330 7781", "Polish"],
  ["ten-4", "Hiroshi Tanaka", "hiroshi.tanaka@icloud.com", "+971 50 662 1190", "Japanese"],
  ["ten-5", "Sofia Marchetti", "sofia.marchetti@gmail.com", "+971 54 909 3320", "Italian"],
  ["ten-6", "Daniel Weber", "daniel.weber@web.de", "+971 58 224 6612", "German"],
  ["ten-7", "Aisha Rahman", "aisha.rahman@gmail.com", "+971 55 481 7702", "Pakistani"],
  ["ten-8", "Chen Wei", "chen.wei@qq.com", "+971 52 776 5514", "Chinese"],
  ["ten-9", "Emily Brooks", "emily.brooks@gmail.com", "+971 50 337 2298", "British"],
  ["ten-10", "Omar Farouk", "omar.farouk@gmail.com", "+971 56 990 1123", "Egyptian"],
];

const occupiedUnits = units.filter((u) => u.status === "Occupied");

export const tenants: Tenant[] = tenantSeed.map(([id, full_name, email, phone, nationality], i) => {
  const unit = occupiedUnits[i]!;
  return {
    id,
    full_name,
    email,
    phone,
    nationality,
    unit_id: unit.id,
    property_id: unit.property_id,
    status: i === 9 ? "Notice Period" : "Active",
    created_at: iso(2024, ((i % 12) + 1) as number, 6 + i),
  };
});

for (const t of tenants) {
  const unit = units.find((u) => u.id === t.unit_id);
  if (unit) unit.tenant_id = t.id;
}

const leaseWindows: [number, number, number, number][] = [
  // startYear, startMonth, endYear, endMonth
  [2025, 9, 2026, 9],
  [2025, 11, 2026, 11],
  [2025, 10, 2026, 10],
  [2024, 12, 2026, 9],
  [2026, 1, 2027, 1],
  [2025, 8, 2026, 8],
  [2026, 3, 2027, 3],
  [2025, 6, 2026, 6],
  [2026, 2, 2027, 2],
  [2025, 12, 2026, 12],
];

const monthsUntil = (endIso: string) =>
  (new Date(endIso).getTime() - Date.UTC(2026, 7, 27)) / (1000 * 60 * 60 * 24 * 30);

export const leases: Lease[] = tenants.map((t, i) => {
  const unit = units.find((u) => u.id === t.unit_id)!;
  const [sy, sm, ey, em] = leaseWindows[i]!;
  const end = iso(ey, em, 1);
  const remaining = monthsUntil(end);
  const status: Lease["status"] =
    remaining < 0 ? "Expired" : remaining <= 2 ? "Expiring Soon" : "Active";
  return {
    id: `lease-${i + 1}`,
    lease_number: `LSE-2026-${String(1000 + i + 1)}`,
    property_id: unit.property_id,
    unit_id: unit.id,
    owner_id: unit.owner_id,
    tenant_id: t.id,
    start_date: iso(sy, sm, 1),
    end_date: end,
    monthly_rent: unit.monthly_rent,
    security_deposit: Math.round(unit.monthly_rent * 1.5),
    payment_frequency: i % 3 === 0 ? "Quarterly" : "Monthly",
    status,
  };
});

const rentSeed: [number, number, number, number, RentSchedule["status"]][] = [
  // leaseIndex, month, dueDay, paidRatio, status
  [0, 6, 1, 1, "Paid"],
  [0, 7, 1, 1, "Paid"],
  [0, 8, 1, 0, "Due"],
  [1, 7, 5, 1, "Paid"],
  [1, 8, 5, 0.5, "Partially Paid"],
  [2, 7, 1, 1, "Paid"],
  [2, 8, 1, 0, "Overdue"],
  [3, 8, 3, 1, "Paid"],
  [3, 9, 3, 0, "Upcoming"],
  [4, 8, 1, 1, "Paid"],
  [5, 7, 10, 0, "Overdue"],
  [6, 8, 1, 1, "Paid"],
  [7, 8, 15, 0, "Due"],
  [8, 9, 1, 0, "Upcoming"],
  [9, 8, 1, 1, "Paid"],
];

export const rentSchedules: RentSchedule[] = rentSeed.map(([li, month, day, ratio, status], i) => {
  const lease = leases[li]!;
  const amount = lease.monthly_rent;
  return {
    id: `rent-${i + 1}`,
    lease_id: lease.id,
    tenant_id: lease.tenant_id,
    property_id: lease.property_id,
    unit_id: lease.unit_id,
    due_date: iso(2026, month, day),
    amount,
    paid_amount: Math.round(amount * ratio),
    status,
    paid_on: ratio > 0 ? iso(2026, month, Math.min(day + 2, 28)) : undefined,
    method: ratio > 0 ? "Bank Transfer" : undefined,
  };
});

export const vendors: Vendor[] = [
  { id: "ven-1", name: "CoolAir Technical Services", trade: "HVAC", phone: "+971 4 553 8890", email: "ops@coolair.ae" },
  { id: "ven-2", name: "AquaFix Plumbing LLC", trade: "Plumbing", phone: "+971 4 442 7712", email: "dispatch@aquafix.ae" },
  { id: "ven-3", name: "Voltra Electrical Works", trade: "Electrical", phone: "+971 4 331 2204", email: "service@voltra.ae" },
  { id: "ven-4", name: "PureSpace Facility Care", trade: "Cleaning & Pest", phone: "+971 4 220 6611", email: "hello@purespace.ae" },
];

const ticketSeed: [
  string,
  string,
  MaintenanceTicket["category"],
  string,
  MaintenanceTicket["priority"],
  MaintenanceTicket["status"],
  number,
  number,
  string | undefined,
][] = [
  ["tkt-1", "unit-1", "HVAC", "Bedroom AC not cooling after service", "High", "IN PROGRESS", 8, 620, "ven-1"],
  ["tkt-2", "unit-2", "Plumbing", "Kitchen sink draining slowly", "Medium", "ASSIGNED", 20, 240, "ven-2"],
  ["tkt-3", "unit-4", "Electrical", "Living room sockets tripping the breaker", "Emergency", "UNDER REVIEW", 24, 900, undefined],
  ["tkt-4", "unit-6", "Appliance Repair", "Washing machine leaking during spin cycle", "Medium", "NEW", 25, 380, undefined],
  ["tkt-5", "unit-9", "Pest Control", "Ants in the pantry and utility room", "Low", "COMPLETED", 21, 150, "ven-4"],
  ["tkt-6", "unit-11", "Painting", "Water stain repair on hallway ceiling", "Low", "CLOSED", 22, 520, "ven-4"],
  ["tkt-7", "unit-15", "Plumbing", "Bathroom water heater producing no hot water", "High", "ASSIGNED", 23, 470, "ven-2"],
  ["tkt-8", "unit-19", "HVAC", "Annual AC coil cleaning and filter change", "Medium", "IN PROGRESS", 24, 310, "ven-1"],
];

export const maintenanceTickets: MaintenanceTicket[] = ticketSeed.map(
  ([id, unitId, category, title, priority, status, day, cost, vendor_id], i) => {
    const unit = units.find((u) => u.id === unitId)!;
    const tenant = tenants.find((t) => t.unit_id === unitId);
    const created = iso(2026, 8, day);
    return {
      id,
      reference: `MNT-${2600 + i + 1}`,
      property_id: unit.property_id,
      unit_id: unit.id,
      tenant_id: tenant?.id,
      owner_id: unit.owner_id,
      category,
      title,
      description: `${title}. Reported by the resident and verified by the on-site facilities coordinator during the initial inspection.`,
      priority,
      status,
      vendor_id,
      assigned_to: vendor_id ? vendors.find((v) => v.id === vendor_id)!.name : undefined,
      estimated_cost: cost,
      actual_cost: status === "COMPLETED" || status === "CLOSED" ? cost : undefined,
      sla_due_at: iso(2026, 8, Math.min(day + (priority === "Emergency" ? 1 : 4), 30)),
      created_at: created,
      updated_at: iso(2026, 8, Math.min(day + 1, 27)),
      timeline: [
        { at: created, actor: tenant?.full_name ?? "Facilities Coordinator", message: "Request submitted" },
        { at: iso(2026, 8, Math.min(day + 1, 27)), actor: "Nadia Kaur (Property Manager)", message: `Status moved to ${status}` },
      ],
      notes: [
        {
          at: iso(2026, 8, Math.min(day + 1, 27)),
          author: "Nadia Kaur",
          body: "Access arranged with the resident for the technician visit.",
          internal: true,
        },
      ],
      attachments: [{ name: "reported-issue.jpg", size: "1.4 MB" }],
    };
  },
);

export const approvals: Approval[] = [
  {
    id: "apr-1",
    reference: "APR-4101",
    ticket_id: "tkt-3",
    property_id: "prop-1",
    unit_id: "unit-4",
    owner_id: "own-1",
    vendor_id: "ven-3",
    title: "Distribution board replacement",
    description: "Replace faulty distribution board and re-terminate living room circuits.",
    amount: 900,
    status: "Pending",
    requested_at: iso(2026, 8, 25),
  },
  {
    id: "apr-2",
    reference: "APR-4102",
    ticket_id: "tkt-1",
    property_id: "prop-1",
    unit_id: "unit-1",
    owner_id: "own-1",
    vendor_id: "ven-1",
    title: "AC compressor replacement",
    description: "Compressor beyond economical repair; replacement quoted with 12-month warranty.",
    amount: 620,
    status: "Pending",
    requested_at: iso(2026, 8, 24),
  },
  {
    id: "apr-3",
    reference: "APR-4103",
    ticket_id: "tkt-7",
    property_id: "prop-3",
    unit_id: "unit-15",
    owner_id: "own-2",
    vendor_id: "ven-2",
    title: "Water heater unit replacement",
    description: "Existing 50L heater corroded; supply and install replacement unit.",
    amount: 470,
    status: "Pending",
    requested_at: iso(2026, 8, 23),
  },
  {
    id: "apr-4",
    reference: "APR-4098",
    ticket_id: "tkt-6",
    property_id: "prop-2",
    unit_id: "unit-11",
    owner_id: "own-1",
    vendor_id: "ven-4",
    title: "Ceiling repair and repaint",
    description: "Seal leak point, skim and repaint the hallway ceiling.",
    amount: 520,
    status: "Approved",
    requested_at: iso(2026, 8, 12),
    decided_at: iso(2026, 8, 13),
    decided_by: "Rashid Al Mansoori",
  },
];

export const documents: DocumentRecord[] = [
  {
    id: "doc-1",
    name: "Tenancy Contract — A-302 (Layla Haddad).pdf",
    category: "Lease Agreement",
    property_id: "prop-1",
    unit_id: "unit-1",
    owner_id: "own-1",
    tenant_id: "ten-1",
    uploaded_by: "Nadia Kaur",
    uploaded_at: iso(2025, 9, 2),
    expires_at: iso(2026, 9, 1),
    file_type: "PDF",
    file_size: "412 KB",
  },
  {
    id: "doc-2",
    name: "Emirates ID — James Okoro.pdf",
    category: "Passport / ID",
    property_id: "prop-1",
    unit_id: "unit-2",
    tenant_id: "ten-2",
    uploaded_by: "James Okoro",
    uploaded_at: iso(2025, 11, 4),
    expires_at: iso(2027, 3, 20),
    file_type: "PDF",
    file_size: "268 KB",
  },
  {
    id: "doc-3",
    name: "Title Deed — Marina Crest Residences.pdf",
    category: "Property Document",
    property_id: "prop-1",
    owner_id: "own-1",
    uploaded_by: "Nadia Kaur",
    uploaded_at: iso(2023, 5, 6),
    file_type: "PDF",
    file_size: "1.1 MB",
  },
  {
    id: "doc-4",
    name: "Management Agreement — Nair Holdings.pdf",
    category: "Management Agreement",
    property_id: "prop-3",
    owner_id: "own-2",
    uploaded_by: "Adrian Silva",
    uploaded_at: iso(2024, 3, 1),
    expires_at: iso(2026, 9, 30),
    file_type: "PDF",
    file_size: "760 KB",
  },
  {
    id: "doc-5",
    name: "Move-in Inspection — V-03.pdf",
    category: "Inspection Report",
    property_id: "prop-2",
    unit_id: "unit-11",
    owner_id: "own-1",
    tenant_id: "ten-6",
    uploaded_by: "Facilities Team",
    uploaded_at: iso(2025, 8, 3),
    file_type: "PDF",
    file_size: "3.4 MB",
  },
  {
    id: "doc-6",
    name: "Quotation — Voltra Electrical Works.pdf",
    category: "Quotation",
    property_id: "prop-1",
    unit_id: "unit-4",
    owner_id: "own-1",
    uploaded_by: "Nadia Kaur",
    uploaded_at: iso(2026, 8, 25),
    file_type: "PDF",
    file_size: "184 KB",
  },
  {
    id: "doc-7",
    name: "Invoice — PureSpace Facility Care (Aug 2026).pdf",
    category: "Invoice",
    property_id: "prop-2",
    owner_id: "own-1",
    uploaded_by: "Finance",
    uploaded_at: iso(2026, 8, 22),
    file_type: "PDF",
    file_size: "96 KB",
  },
  {
    id: "doc-8",
    name: "Tenancy Contract — P-204 (Aisha Rahman).pdf",
    category: "Lease Agreement",
    property_id: "prop-3",
    unit_id: "unit-15",
    owner_id: "own-2",
    tenant_id: "ten-7",
    uploaded_by: "Adrian Silva",
    uploaded_at: iso(2026, 3, 2),
    expires_at: iso(2027, 3, 1),
    file_type: "PDF",
    file_size: "398 KB",
  },
];

export const notifications: Notification[] = [
  {
    id: "ntf-1",
    user_role: "LANDLORD",
    owner_id: "own-1",
    title: "Approval required — AED 900",
    message: "Distribution board replacement at Marina Crest A-902 needs your approval.",
    type: "Approval",
    read: false,
    created_at: iso(2026, 8, 25),
    href: "/approvals",
  },
  {
    id: "ntf-2",
    user_role: "TENANT",
    tenant_id: "ten-1",
    title: "Rent due on 1 August",
    message: "Your monthly rent of AED 6,800 for unit A-302 is now due.",
    type: "Rent",
    read: false,
    created_at: iso(2026, 8, 20),
    href: "/rent",
  },
  {
    id: "ntf-3",
    user_role: "PROPERTY_MANAGER",
    title: "Rent overdue — B-506",
    message: "Daniel Weber is 18 days overdue on the July rent instalment.",
    type: "Rent",
    read: false,
    created_at: iso(2026, 8, 24),
    href: "/rent",
  },
  {
    id: "ntf-4",
    user_role: "ALL",
    title: "Lease expiring soon",
    message: "Lease LSE-2026-1001 for A-302 expires on 1 September 2026.",
    type: "Lease",
    read: true,
    created_at: iso(2026, 8, 18),
    href: "/leases",
  },
  {
    id: "ntf-5",
    user_role: "TENANT",
    tenant_id: "ten-1",
    title: "Maintenance update",
    message: "Ticket MNT-2601 moved to In Progress. CoolAir Technical Services assigned.",
    type: "Maintenance",
    read: true,
    created_at: iso(2026, 8, 22),
    href: "/maintenance",
  },
];

export const expenses: Expense[] = [
  { id: "exp-1", property_id: "prop-1", owner_id: "own-1", category: "Maintenance", amount: 2140, incurred_on: iso(2026, 8, 12), description: "HVAC and plumbing callouts" },
  { id: "exp-2", property_id: "prop-1", owner_id: "own-1", category: "Management Fee", amount: 2460, incurred_on: iso(2026, 8, 1), description: "5% management fee" },
  { id: "exp-3", property_id: "prop-2", owner_id: "own-1", category: "Maintenance", amount: 1180, incurred_on: iso(2026, 8, 15), description: "Landscaping and pest control" },
  { id: "exp-4", property_id: "prop-2", owner_id: "own-1", category: "Insurance", amount: 890, incurred_on: iso(2026, 8, 5), description: "Annual buildings insurance instalment" },
  { id: "exp-5", property_id: "prop-3", owner_id: "own-2", category: "Maintenance", amount: 1620, incurred_on: iso(2026, 8, 18), description: "Water heater and AC servicing" },
  { id: "exp-6", property_id: "prop-3", owner_id: "own-2", category: "Management Fee", amount: 1740, incurred_on: iso(2026, 8, 1), description: "5% management fee" },
];

export const auditLogs: AuditLog[] = [
  { id: "log-1", user_name: "Nadia Kaur", role: "PROPERTY_MANAGER", action: "Payment recorded", entity: "rent_schedules", entity_id: "rent-15", at: iso(2026, 8, 26), ip: "94.204.11.72", device: "Chrome · macOS" },
  { id: "log-2", user_name: "Rashid Al Mansoori", role: "LANDLORD", action: "Approval approved", entity: "approvals", entity_id: "apr-4", at: iso(2026, 8, 25), ip: "2.50.183.9", device: "Safari · iOS" },
  { id: "log-3", user_name: "Nadia Kaur", role: "PROPERTY_MANAGER", action: "Maintenance updated", entity: "maintenance_tickets", entity_id: "tkt-1", at: iso(2026, 8, 25), ip: "94.204.11.72", device: "Chrome · macOS" },
  { id: "log-4", user_name: "Layla Haddad", role: "TENANT", action: "Login", entity: "users", entity_id: "usr-tenant", at: iso(2026, 8, 24), ip: "5.107.44.13", device: "Chrome · Android" },
  { id: "log-5", user_name: "Adrian Silva", role: "ADMIN", action: "Document uploaded", entity: "documents", entity_id: "doc-8", at: iso(2026, 8, 23), ip: "185.93.2.41", device: "Firefox · Windows" },
  { id: "log-6", user_name: "Nadia Kaur", role: "PROPERTY_MANAGER", action: "Lease created", entity: "leases", entity_id: "lease-9", at: iso(2026, 8, 20), ip: "94.204.11.72", device: "Chrome · macOS" },
  { id: "log-7", user_name: "Adrian Silva", role: "ADMIN", action: "Property updated", entity: "properties", entity_id: "prop-3", at: iso(2026, 8, 19), ip: "185.93.2.41", device: "Firefox · Windows" },
];

export const demoUsers: (AppUser & { password: string })[] = [
  { id: "usr-admin", full_name: "Adrian Silva", email: "admin@estora.app", role: "ADMIN", phone: "+971 4 220 0011", avatar_initials: "AS", password: "demo1234" },
  { id: "usr-pm", full_name: "Nadia Kaur", email: "manager@estora.app", role: "PROPERTY_MANAGER", phone: "+971 55 118 4422", avatar_initials: "NK", password: "demo1234" },
  { id: "usr-owner", full_name: "Rashid Al Mansoori", email: "owner@estora.app", role: "LANDLORD", owner_id: "own-1", phone: "+971 50 224 8891", avatar_initials: "RA", password: "demo1234" },
  { id: "usr-owner-2", full_name: "Priya Nair", email: "owner2@estora.app", role: "LANDLORD", owner_id: "own-2", phone: "+65 8123 4477", avatar_initials: "PN", password: "demo1234" },
  { id: "usr-tenant", full_name: "Layla Haddad", email: "tenant@estora.app", role: "TENANT", tenant_id: "ten-1", phone: "+971 55 774 2213", avatar_initials: "LH", password: "demo1234" },
];
