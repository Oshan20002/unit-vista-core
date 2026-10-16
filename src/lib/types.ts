export type Role = "ADMIN" | "PROPERTY_MANAGER" | "LANDLORD" | "TENANT" | "TECHNICIAN" | "VENDOR";

export type PropertyType = "Apartment" | "Villa" | "House" | "Building" | "Commercial" | "Other";
export type PropertyStatus = "Active" | "Inactive" | "Under Management";
export type UnitStatus = "Occupied" | "Vacant" | "Reserved" | "Under Maintenance" | "Inactive";
export type LeaseStatus = "Draft" | "Active" | "Expiring Soon" | "Expired" | "Terminated";
export type RentStatus = "Upcoming" | "Due" | "Paid" | "Partially Paid" | "Overdue";
export type TicketStatus =
  | "NEW"
  | "UNDER REVIEW"
  | "ASSIGNED"
  | "IN PROGRESS"
  | "COMPLETED"
  | "CLOSED";
export type Priority = "Low" | "Medium" | "High" | "Emergency";
export type TicketCategory =
  | "HVAC"
  | "Plumbing"
  | "Electrical"
  | "Pest Control"
  | "Painting"
  | "Cleaning"
  | "Appliance Repair"
  | "Emergency"
  | "Other";
export type DocumentCategory =
  | "Lease Agreement"
  | "Passport / ID"
  | "Property Document"
  | "Inspection Report"
  | "Invoice"
  | "Quotation"
  | "Management Agreement"
  | "Other";
export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

export interface AppUser {
  id: string;
  full_name: string;
  email: string;
  role: Role;
  phone?: string | undefined;
  avatar_initials: string;
  /** owners.id when role = LANDLORD */
  owner_id?: string | undefined;
  /** tenants.id when role = TENANT */
  tenant_id?: string | undefined;
  technician_id?: string | undefined;
  vendor_id?: string | undefined;
}

export interface Owner {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  kyc_status: "Verified" | "Pending" | "Rejected";
  bank_details_status: "Complete" | "Missing";
  bank_name?: string | undefined;
  bank_account_name?: string | undefined;
  bank_account_number?: string | undefined;
  bank_branch?: string | undefined;
  approval_threshold: number;
  status: "Active" | "Inactive";
  created_at: string;
  invite_code?: string | undefined;
  invite_claimed_at?: string | undefined;
  /** set when staff delete the record; purged after 7 days */
  deleted_at?: string | undefined;
}

export interface Property {
  id: string;
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  country: string;
  owner_id: string;
  manager_id: string;
  status: PropertyStatus;
  created_at: string;
}

export interface Building {
  id: string;
  property_id: string;
  name: string;
  floors: number;
  created_at: string;
}

export interface Unit {
  id: string;
  property_id: string;
  building_id: string;
  unit_number: string;
  floor: number;
  unit_type: string;
  bedrooms: number;
  bathrooms: number;
  furnished: "Furnished" | "Semi-Furnished" | "Unfurnished";
  area_sqft: number;
  owner_id: string;
  tenant_id?: string | undefined;
  monthly_rent: number;
  status: UnitStatus;
}

export interface Tenant {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  nationality: string;
  unit_id: string;
  property_id: string;
  status: "Active" | "Notice Period" | "Former";
  created_at: string;
  invite_code?: string | undefined;
  invite_claimed_at?: string | undefined;
  /** set when staff delete the record; purged after 7 days */
  deleted_at?: string | undefined;
}

export interface Lease {
  id: string;
  lease_number: string;
  property_id: string;
  unit_id: string;
  owner_id: string;
  tenant_id: string;
  start_date: string;
  end_date: string;
  monthly_rent: number;
  security_deposit: number;
  payment_frequency: "Monthly" | "Quarterly" | "Annually";
  status: LeaseStatus;
  deleted_at?: string | undefined;
}

export interface RentSchedule {
  id: string;
  lease_id: string;
  tenant_id: string;
  property_id: string;
  unit_id: string;
  due_date: string;
  amount: number;
  paid_amount: number;
  status: RentStatus;
  paid_on?: string | undefined;
  method?: "Bank Transfer" | "Cheque" | "Cash" | "Card" | undefined;
}

export interface Vendor {
  id: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
  created_at?: string | undefined;
  bank_name?: string | undefined;
  bank_account_name?: string | undefined;
  bank_account_number?: string | undefined;
  bank_iban?: string | undefined;
  invite_code?: string | undefined;
  invite_claimed_at?: string | undefined;
  deleted_at?: string | undefined;
}

export interface Technician {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  trade: string;
  created_at: string;
  bank_name?: string | undefined;
  bank_account_name?: string | undefined;
  bank_account_number?: string | undefined;
  bank_iban?: string | undefined;
  invite_code?: string | undefined;
  invite_claimed_at?: string | undefined;
  deleted_at?: string | undefined;
}

export interface FileRef {
  name: string;
  size: string;
  path?: string | undefined;
}

export interface JobItem {
  id: string;
  name: string;
  qty: number;
}

export interface QuoteItem extends JobItem {
  unit_price: number;
}

export type JobStatus = "Assigned" | "Quoted" | "Selected" | "Rejected";
export type VendorQuoteStatus = "Requested" | "Quoted" | "Selected" | "Rejected";

export interface TechnicianJob {
  id: string;
  reference: string;
  ticket_id: string;
  technician_id: string;
  owner_id?: string | undefined;
  details: { reference: string; title: string; description: string; category: string; priority: string; location: string };
  status: JobStatus;
  labour_price: number;
  items: JobItem[];
  note?: string | undefined;
  attachment?: FileRef | null | undefined;
  quoted_at?: string | undefined;
  created_at: string;
}

export interface VendorQuote {
  id: string;
  reference: string;
  ticket_id: string;
  technician_job_id: string;
  vendor_id: string;
  owner_id?: string | undefined;
  delivery_location: string;
  status: VendorQuoteStatus;
  items: QuoteItem[];
  delivery_charge: number;
  note?: string | undefined;
  attachment?: FileRef | null | undefined;
  quoted_at?: string | undefined;
  created_at: string;
}

export interface TicketEvent {
  at: string;
  actor: string;
  message: string;
}

export interface MaintenanceTicket {
  id: string;
  reference: string;
  property_id: string;
  unit_id: string;
  tenant_id?: string | undefined;
  owner_id: string;
  category: TicketCategory;
  title: string;
  description: string;
  priority: Priority;
  status: TicketStatus;
  vendor_id?: string | undefined;
  assigned_to?: string | undefined;
  estimated_cost?: number | undefined;
  actual_cost?: number | undefined;
  sla_due_at?: string | undefined;
  created_at: string;
  updated_at: string;
  timeline: TicketEvent[];
  notes: { at: string; author: string; body: string; internal: boolean }[];
  attachments: { name: string; size: string }[];
  /** quotation stage: Collecting -> Awaiting landlord -> Approved */
  quote_stage?: "Collecting" | "Awaiting landlord" | "Approved" | null | undefined;
  /** chosen option: vendor quote id, or technician job id when no materials */
  selected_option?: string | null | undefined;
  /** after a choice: vendor delivery -> technician booking -> work done -> tenant feedback */
  work_order?: WorkOrder | null | undefined;
}

export interface WorkSlot {
  id: string;
  /** ISO date-time */
  start: string;
  duration_hours: number;
  preferred: boolean;
}

export interface WorkOrder {
  vendor_confirmed_at?: string | undefined;
  /** yyyy-mm-dd */
  delivery_date?: string | undefined;
  slots?: WorkSlot[] | undefined;
  slots_sent_at?: string | undefined;
  booked_slot_id?: string | undefined;
  booked_at?: string | undefined;
  completed_at?: string | undefined;
  rating?: number | undefined;
  feedback?: string | undefined;
  feedback_at?: string | undefined;
}

export interface Approval {
  id: string;
  reference: string;
  ticket_id?: string | undefined;
  property_id: string;
  unit_id: string;
  owner_id: string;
  vendor_id?: string | undefined;
  title: string;
  description: string;
  amount: number;
  status: ApprovalStatus;
  requested_at: string;
  decided_at?: string | undefined;
  decided_by?: string | undefined;
  rejection_reason?: string | undefined;
}

export interface DocumentRecord {
  id: string;
  name: string;
  category: DocumentCategory;
  property_id?: string | undefined;
  unit_id?: string | undefined;
  owner_id?: string | undefined;
  tenant_id?: string | undefined;
  uploaded_by: string;
  uploaded_at: string;
  expires_at?: string | undefined;
  file_type: string;
  file_size: string;
}

export interface Notification {
  id: string;
  user_role: Role | "ALL";
  owner_id?: string | undefined;
  tenant_id?: string | undefined;
  technician_id?: string | undefined;
  vendor_id?: string | undefined;
  title: string;
  message: string;
  type: "Rent" | "Maintenance" | "Approval" | "Lease" | "Document" | "System";
  read: boolean;
  created_at: string;
  href?: string | undefined;
}

export interface Expense {
  id: string;
  property_id: string;
  owner_id: string;
  category: string;
  amount: number;
  incurred_on: string;
  description: string;
}

export interface AuditLog {
  id: string;
  user_name: string;
  role: Role;
  action: string;
  entity: string;
  entity_id: string;
  at: string;
  ip: string;
  device: string;
}

/** Bank accounts of the property management company (tenants pay rent into these). */
export interface CompanyBank {
  id: string;
  bank_name: string;
  account_number: string;
  branch: string;
  account_name: string;
  created_at: string;
}

export type PaymentKind = "TENANT_RENT" | "LANDLORD" | "VENDOR" | "TECHNICIAN";

/** A money transfer with a slip: tenant -> company, or company -> landlord / vendor / technician. */
export interface Payment {
  id: string;
  kind: PaymentKind;
  amount: number;
  method: "Bank Transfer" | "Cash" | "Card" | "Cheque";
  status: "Submitted" | "Confirmed";
  rent_id?: string | undefined;
  tenant_id?: string | undefined;
  owner_id?: string | undefined;
  vendor_id?: string | undefined;
  technician_id?: string | undefined;
  slip?: FileRef | null | undefined;
  note?: string | undefined;
  created_at: string;
  confirmed_at?: string | undefined;
}
