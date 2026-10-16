-- Fixes: "new row violates row-level security policy for table maintenance_tickets"
-- Run once in the Supabase SQL Editor. Safe to run again.
--
-- Tenants are now recognised by their sign-in email (matching the tenant record
-- the property manager created), so saving a maintenance request no longer
-- depends on the profile link being filled in. Works whether ids are text or uuid.

-- 1. Tenant records that belong to the signed-in user (by profile link OR email).
CREATE OR REPLACE FUNCTION public.my_tenant_ids()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.id::text FROM public.tenants t
   WHERE lower(t.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  UNION
  SELECT p.tenant_id::text FROM public.profiles p
   WHERE p.user_id = auth.uid() AND p.tenant_id IS NOT NULL;
$$;

-- 2. Owner records that belong to the signed-in user (by profile link OR email).
CREATE OR REPLACE FUNCTION public.my_owner_ids()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id::text FROM public.owners o
   WHERE lower(o.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  UNION
  SELECT p.owner_id::text FROM public.profiles p
   WHERE p.user_id = auth.uid() AND p.owner_id IS NOT NULL;
$$;

-- 3. Technicians / vendors working on a ticket can read it.
CREATE OR REPLACE FUNCTION public.partner_can_see_ticket(p_ticket_id text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean := false;
BEGIN
  IF to_regclass('public.technician_jobs') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.technician_jobs j JOIN public.profiles p
               ON p.user_id = auth.uid() AND p.technician_id::text = j.technician_id::text
               WHERE j.ticket_id::text = $1)' INTO ok USING p_ticket_id;
    IF ok THEN RETURN true; END IF;
  END IF;
  IF to_regclass('public.vendor_quotes') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.vendor_quotes q JOIN public.profiles p
               ON p.user_id = auth.uid() AND p.vendor_id::text = q.vendor_id::text
               WHERE q.ticket_id::text = $1)' INTO ok USING p_ticket_id;
  END IF;
  RETURN COALESCE(ok, false);
EXCEPTION WHEN undefined_column THEN
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_tenant_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_owner_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_can_see_ticket(text) TO authenticated;

-- 4. Make sure the app can reach the table.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tickets TO authenticated;
GRANT ALL ON public.maintenance_tickets TO service_role;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;

-- 5. Remove every old policy on maintenance_tickets (whatever its name).
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'maintenance_tickets'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.maintenance_tickets', pol.policyname);
  END LOOP;
END $$;

-- 6. New policies.
-- Staff: everything.
CREATE POLICY tickets_staff ON public.maintenance_tickets FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Tenants: read, create and update their own requests.
CREATE POLICY tickets_tenant_sel ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (tenant_id::text IN (SELECT public.my_tenant_ids()));
CREATE POLICY tickets_tenant_ins ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (tenant_id::text IN (SELECT public.my_tenant_ids()));
CREATE POLICY tickets_tenant_upd ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (tenant_id::text IN (SELECT public.my_tenant_ids()))
  WITH CHECK (tenant_id::text IN (SELECT public.my_tenant_ids()));

-- Landlords: read and update (approve) requests on their properties.
CREATE POLICY tickets_owner_sel ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (owner_id::text IN (SELECT public.my_owner_ids()));
CREATE POLICY tickets_owner_upd ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (owner_id::text IN (SELECT public.my_owner_ids()))
  WITH CHECK (owner_id::text IN (SELECT public.my_owner_ids()));

-- Technicians / vendors: read and update tickets they are working on.
CREATE POLICY tickets_partner_sel ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (public.partner_can_see_ticket(id::text));
CREATE POLICY tickets_partner_upd ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (public.partner_can_see_ticket(id::text))
  WITH CHECK (public.partner_can_see_ticket(id::text));

-- 7. Fill in the landlord and tenant automatically when a request is saved,
--    so a tenant does not need to be able to read the landlord record.
CREATE OR REPLACE FUNCTION public.fill_ticket_links()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner text; v_tenant text;
BEGIN
  IF NEW.owner_id IS NULL OR NEW.owner_id::text = '' THEN
    SELECT u.owner_id::text INTO v_owner FROM public.units u WHERE u.id::text = NEW.unit_id::text;
    IF v_owner IS NULL THEN
      SELECT p.owner_id::text INTO v_owner FROM public.properties p WHERE p.id::text = NEW.property_id::text;
    END IF;
    NEW.owner_id := v_owner;
  END IF;
  IF NEW.tenant_id IS NULL AND NOT public.is_staff() THEN
    SELECT id INTO v_tenant FROM public.my_tenant_ids() AS id LIMIT 1;
    NEW.tenant_id := v_tenant;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_fill_ticket_links ON public.maintenance_tickets;
CREATE TRIGGER trg_fill_ticket_links BEFORE INSERT ON public.maintenance_tickets
FOR EACH ROW EXECUTE FUNCTION public.fill_ticket_links();

-- 8. Repair profile links for tenant accounts that were never linked.
DO $$
DECLARE v_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_type FROM pg_attribute a
   WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'tenant_id' AND NOT a.attisdropped;
  EXECUTE format(
    'UPDATE public.profiles p SET tenant_id = t.id::text::%s
       FROM auth.users u JOIN public.tenants t ON lower(t.email) = lower(u.email)
      WHERE p.user_id = u.id AND p.tenant_id IS NULL', v_type);
END $$;
