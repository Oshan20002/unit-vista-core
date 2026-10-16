-- =============================================================================
-- Estora — Property Asset & Management Platform
-- Schema for your OWN Supabase project (not Lovable Cloud).
--
-- How to use:
--   1. Create a project at https://supabase.com (Dashboard → New Project).
--   2. Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   3. Then run db/seed.sql the same way.
--   4. Supabase Dashboard → Authentication → Users → Add user for each demo
--      email (admin@estora.app, manager@estora.app, owner@estora.app,
--      owner2@estora.app, tenant@estora.app), password "demo1234",
--      and tick "Auto Confirm User". seed.sql links them to roles by email.
--   5. Project Settings → API → copy Project URL + anon/publishable key into
--      VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY env vars in the Lovable editor.
--
-- Re-running: this file is idempotent (CREATE TABLE IF NOT EXISTS, etc.).
-- =============================================================================

-- ---------- Enums ----------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'property_manager', 'landlord', 'tenant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- Role helpers (SECURITY DEFINER, stable) ----------
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create profiles before helper functions reference it. Portfolio foreign keys
-- are added after owners and tenants exist.
CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  owner_id text,
  tenant_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Current user's linked owner / tenant (from profiles). NULL when not linked.
CREATE OR REPLACE FUNCTION public.current_owner_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.profiles WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- Admins and property managers see/manage everything.
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR public.has_role(auth.uid(), 'property_manager');
$$;

-- ---------- owners ----------
CREATE TABLE IF NOT EXISTS public.owners (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  country text NOT NULL,
  address text NOT NULL,
  kyc_status text NOT NULL CHECK (kyc_status IN ('Verified','Pending','Rejected')),
  bank_details_status text NOT NULL CHECK (bank_details_status IN ('Complete','Missing')),
  approval_threshold numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
GRANT ALL ON public.owners TO service_role;
ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

-- ---------- properties ----------
CREATE TABLE IF NOT EXISTS public.properties (
  id text PRIMARY KEY,
  name text NOT NULL,
  type text NOT NULL,
  address text NOT NULL,
  city text NOT NULL,
  country text NOT NULL,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  manager_id text,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Inactive','Under Management')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- ---------- buildings ----------
CREATE TABLE IF NOT EXISTS public.buildings (
  id text PRIMARY KEY,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name text NOT NULL,
  floors integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT ALL ON public.buildings TO service_role;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;

-- ---------- tenants ----------
CREATE TABLE IF NOT EXISTS public.tenants (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  nationality text NOT NULL,
  unit_id text,
  property_id text REFERENCES public.properties(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Notice Period','Former')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ---------- units ----------
CREATE TABLE IF NOT EXISTS public.units (
  id text PRIMARY KEY,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  building_id text REFERENCES public.buildings(id) ON DELETE SET NULL,
  unit_number text NOT NULL,
  floor integer NOT NULL DEFAULT 0,
  unit_type text NOT NULL,
  bedrooms integer NOT NULL DEFAULT 0,
  bathrooms integer NOT NULL DEFAULT 0,
  furnished text NOT NULL DEFAULT 'Unfurnished' CHECK (furnished IN ('Furnished','Semi-Furnished','Unfurnished')),
  area_sqft numeric NOT NULL DEFAULT 0,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  tenant_id text REFERENCES public.tenants(id) ON DELETE SET NULL,
  monthly_rent numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Vacant' CHECK (status IN ('Occupied','Vacant','Reserved','Under Maintenance','Inactive'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.units TO authenticated;
GRANT ALL ON public.units TO service_role;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Add the deferred foreign keys after both sides of the relationships exist.
DO $$ BEGIN
  ALTER TABLE public.tenants ADD CONSTRAINT tenants_unit_id_fkey
    FOREIGN KEY (unit_id) REFERENCES public.units(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_owner_id_fkey
    FOREIGN KEY (owner_id) REFERENCES public.owners(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------- leases ----------
CREATE TABLE IF NOT EXISTS public.leases (
  id text PRIMARY KEY,
  lease_number text NOT NULL,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  monthly_rent numeric NOT NULL DEFAULT 0,
  security_deposit numeric NOT NULL DEFAULT 0,
  payment_frequency text NOT NULL DEFAULT 'Monthly' CHECK (payment_frequency IN ('Monthly','Quarterly','Annually')),
  status text NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Active','Expiring Soon','Expired','Terminated'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leases TO authenticated;
GRANT ALL ON public.leases TO service_role;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

-- ---------- rent_schedules ----------
CREATE TABLE IF NOT EXISTS public.rent_schedules (
  id text PRIMARY KEY,
  lease_id text NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
  tenant_id text NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Due' CHECK (status IN ('Upcoming','Due','Paid','Partially Paid','Overdue')),
  paid_on date,
  method text CHECK (method IS NULL OR method IN ('Bank Transfer','Cheque','Cash','Card'))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_schedules TO authenticated;
GRANT ALL ON public.rent_schedules TO service_role;
ALTER TABLE public.rent_schedules ENABLE ROW LEVEL SECURITY;

-- ---------- vendors ----------
CREATE TABLE IF NOT EXISTS public.vendors (
  id text PRIMARY KEY,
  name text NOT NULL,
  trade text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- ---------- maintenance_tickets ----------
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id text PRIMARY KEY,
  reference text NOT NULL,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  tenant_id text REFERENCES public.tenants(id) ON DELETE SET NULL,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('Low','Medium','High','Emergency')),
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','UNDER REVIEW','ASSIGNED','IN PROGRESS','COMPLETED','CLOSED')),
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  assigned_to text,
  estimated_cost numeric,
  actual_cost numeric,
  sla_due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  timeline jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.maintenance_tickets TO service_role;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- ---------- approvals ----------
CREATE TABLE IF NOT EXISTS public.approvals (
  id text PRIMARY KEY,
  reference text NOT NULL,
  ticket_id text REFERENCES public.maintenance_tickets(id) ON DELETE SET NULL,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id text NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  vendor_id text REFERENCES public.vendors(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by text,
  rejection_reason text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;

-- ---------- documents ----------
CREATE TABLE IF NOT EXISTS public.documents (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  property_id text REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id text REFERENCES public.units(id) ON DELETE SET NULL,
  owner_id text REFERENCES public.owners(id) ON DELETE SET NULL,
  tenant_id text REFERENCES public.tenants(id) ON DELETE SET NULL,
  uploaded_by text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  file_type text NOT NULL,
  file_size text NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- ---------- notifications ----------
CREATE TABLE IF NOT EXISTS public.notifications (
  id text PRIMARY KEY,
  user_role text NOT NULL CHECK (user_role IN ('ADMIN','PROPERTY_MANAGER','LANDLORD','TENANT','ALL')),
  owner_id text REFERENCES public.owners(id) ON DELETE CASCADE,
  tenant_id text REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL CHECK (type IN ('Rent','Maintenance','Approval','Lease','Document','System')),
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  href text
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---------- expenses ----------
CREATE TABLE IF NOT EXISTS public.expenses (
  id text PRIMARY KEY,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  owner_id text NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  incurred_on date NOT NULL,
  description text NOT NULL
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- ---------- audit_logs ----------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY,
  user_name text NOT NULL,
  role text NOT NULL,
  action text NOT NULL,
  entity text NOT NULL,
  entity_id text NOT NULL,
  at timestamptz NOT NULL DEFAULT now(),
  ip text NOT NULL DEFAULT '—',
  device text NOT NULL DEFAULT 'Web'
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Row Level Security policies
-- =============================================================================

-- owners: landlord sees own row; staff see all
CREATE POLICY owners_sel ON public.owners FOR SELECT TO authenticated
  USING (public.is_staff() OR id = public.current_owner_id());
CREATE POLICY owners_iu ON public.owners FOR ALL TO authenticated
  USING (public.is_staff() OR id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR id = public.current_owner_id());

-- properties
CREATE POLICY properties_sel ON public.properties FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id());
CREATE POLICY properties_iu ON public.properties FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id());

-- buildings (scoped via parent property owner)
CREATE POLICY buildings_sel ON public.buildings FOR SELECT TO authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = buildings.property_id AND p.owner_id = public.current_owner_id()));
CREATE POLICY buildings_iu ON public.buildings FOR ALL TO authenticated
  USING (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = buildings.property_id AND p.owner_id = public.current_owner_id()))
  WITH CHECK (public.is_staff() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = buildings.property_id AND p.owner_id = public.current_owner_id()));

-- tenants: landlord sees tenants in their properties; tenant sees self; staff all
CREATE POLICY tenants_sel ON public.tenants FOR SELECT TO authenticated
  USING (public.is_staff() OR id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = tenants.property_id AND p.owner_id = public.current_owner_id()));
CREATE POLICY tenants_iu ON public.tenants FOR ALL TO authenticated
  USING (public.is_staff() OR id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = tenants.property_id AND p.owner_id = public.current_owner_id()))
  WITH CHECK (public.is_staff() OR id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = tenants.property_id AND p.owner_id = public.current_owner_id()));

-- units: landlord sees their units; tenant sees their unit; staff all
CREATE POLICY units_sel ON public.units FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());
CREATE POLICY units_iu ON public.units FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());

-- leases
CREATE POLICY leases_sel ON public.leases FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());
CREATE POLICY leases_iu ON public.leases FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());

-- rent_schedules (no owner_id; scope via property owner or tenant)
CREATE POLICY rent_sel ON public.rent_schedules FOR SELECT TO authenticated
  USING (public.is_staff() OR tenant_id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = rent_schedules.property_id AND p.owner_id = public.current_owner_id()));
CREATE POLICY rent_iu ON public.rent_schedules FOR ALL TO authenticated
  USING (public.is_staff() OR tenant_id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = rent_schedules.property_id AND p.owner_id = public.current_owner_id()))
  WITH CHECK (public.is_staff() OR tenant_id = public.current_tenant_id() OR EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = rent_schedules.property_id AND p.owner_id = public.current_owner_id()));

-- vendors: reference data — all authenticated can read; staff manage
CREATE POLICY vendors_sel ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY vendors_iu ON public.vendors FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- maintenance_tickets
CREATE POLICY tickets_sel ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());
CREATE POLICY tickets_iu ON public.maintenance_tickets FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());

-- approvals: owner-facing
CREATE POLICY approvals_sel ON public.approvals FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id());
CREATE POLICY approvals_iu ON public.approvals FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id());

-- documents
CREATE POLICY docs_sel ON public.documents FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());
CREATE POLICY docs_iu ON public.documents FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id() OR tenant_id = public.current_tenant_id());

-- notifications: targeted by role + owner/tenant; "ALL" broadcasts to everyone
CREATE POLICY notif_sel ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR owner_id = public.current_owner_id()
    OR tenant_id = public.current_tenant_id()
    OR (user_role = 'ALL' AND owner_id IS NULL AND tenant_id IS NULL)
  );
CREATE POLICY notif_upd ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.is_staff()
    OR owner_id = public.current_owner_id()
    OR tenant_id = public.current_tenant_id()
    OR (user_role = 'ALL' AND owner_id IS NULL AND tenant_id IS NULL)
  )
  WITH CHECK (true);

-- expenses
CREATE POLICY exp_sel ON public.expenses FOR SELECT TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id());
CREATE POLICY exp_iu ON public.expenses FOR ALL TO authenticated
  USING (public.is_staff() OR owner_id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR owner_id = public.current_owner_id());

-- audit_logs: staff only
CREATE POLICY audit_sel ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_staff());
CREATE POLICY audit_iu ON public.audit_logs FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- profiles: self or staff
CREATE POLICY profiles_sel ON public.profiles FOR SELECT TO authenticated
  USING (public.is_staff() OR user_id = auth.uid());
CREATE POLICY profiles_iu ON public.profiles FOR ALL TO authenticated
  USING (public.is_staff() OR user_id = auth.uid())
  WITH CHECK (public.is_staff() OR user_id = auth.uid());

-- user_roles: self can read + insert (signup); staff manage all.
-- NOTE: self-INSERT lets a new user pick their role at signup. For a hardened
-- production deployment, restrict INSERT to staff and assign roles via admin.
CREATE POLICY roles_sel ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_staff() OR user_id = auth.uid());
CREATE POLICY roles_ins ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY roles_upd ON public.user_roles FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
CREATE POLICY roles_del ON public.user_roles FOR DELETE TO authenticated
  USING (public.is_staff());

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_properties_owner ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_units_property ON public.units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_owner ON public.units(owner_id);
CREATE INDEX IF NOT EXISTS idx_units_tenant ON public.units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_property ON public.tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_leases_owner ON public.leases(owner_id);
CREATE INDEX IF NOT EXISTS idx_leases_tenant ON public.leases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_tenant ON public.rent_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rent_property ON public.rent_schedules(property_id);
CREATE INDEX IF NOT EXISTS idx_tickets_owner ON public.maintenance_tickets(owner_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON public.maintenance_tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_owner ON public.approvals(owner_id);
CREATE INDEX IF NOT EXISTS idx_docs_owner ON public.documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_docs_tenant ON public.documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_expenses_owner ON public.expenses(owner_id);
CREATE INDEX IF NOT EXISTS idx_notif_owner ON public.notifications(owner_id);
CREATE INDEX IF NOT EXISTS idx_notif_tenant ON public.notifications(tenant_id);
