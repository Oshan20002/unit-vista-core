-- Fixes: chosen quotation option is not saved (Choose buttons come back after refresh),
-- and lets landlords approve options above their approval limit.
-- Run once in the Supabase SQL Editor (after db/fix-maintenance.sql). Safe to run again.

-- 1. Columns the app saves on a maintenance ticket.
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS quote_stage text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS selected_option text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS estimated_cost numeric;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS timeline jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 2. Landlord records that belong to the signed-in user (by profile link OR email).
CREATE OR REPLACE FUNCTION public.my_owner_ids()
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT o.id::text FROM public.owners o
   WHERE lower(o.email) = lower(COALESCE(auth.jwt() ->> 'email', ''))
  UNION
  SELECT p.owner_id::text FROM public.profiles p
   WHERE p.user_id = auth.uid() AND p.owner_id IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.my_owner_ids() TO authenticated;

-- 3. Technician jobs: staff, the technician, and the landlord of the property.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_jobs TO authenticated;
GRANT ALL ON public.technician_jobs TO service_role;
ALTER TABLE public.technician_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tj_all ON public.technician_jobs;
CREATE POLICY tj_all ON public.technician_jobs FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR technician_id::text = COALESCE(public.current_technician_id()::text, '')
    OR owner_id::text IN (SELECT public.my_owner_ids())
  )
  WITH CHECK (
    public.is_staff()
    OR technician_id::text = COALESCE(public.current_technician_id()::text, '')
    OR owner_id::text IN (SELECT public.my_owner_ids())
  );

-- 4. Vendor quotes: staff, the vendor, and the landlord of the property.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_quotes TO authenticated;
GRANT ALL ON public.vendor_quotes TO service_role;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vq_all ON public.vendor_quotes;
CREATE POLICY vq_all ON public.vendor_quotes FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR vendor_id::text = COALESCE(public.current_vendor_id()::text, '')
    OR owner_id::text IN (SELECT public.my_owner_ids())
  )
  WITH CHECK (
    public.is_staff()
    OR vendor_id::text = COALESCE(public.current_vendor_id()::text, '')
    OR owner_id::text IN (SELECT public.my_owner_ids())
  );

-- 5. Notifications: link column + landlords see their own (works for text or uuid ids).
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS href text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS technician_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS vendor_id text;
DROP POLICY IF EXISTS notif_sel ON public.notifications;
CREATE POLICY notif_sel ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR owner_id::text IN (SELECT public.my_owner_ids())
    OR tenant_id::text = COALESCE(public.current_tenant_id()::text, '')
    OR technician_id::text = COALESCE(public.current_technician_id()::text, '')
    OR vendor_id::text = COALESCE(public.current_vendor_id()::text, '')
    OR (user_role = 'ALL' AND owner_id IS NULL AND tenant_id IS NULL)
  );
DROP POLICY IF EXISTS notif_upd ON public.notifications;
CREATE POLICY notif_upd ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.is_staff()
    OR owner_id::text IN (SELECT public.my_owner_ids())
    OR tenant_id::text = COALESCE(public.current_tenant_id()::text, '')
    OR technician_id::text = COALESCE(public.current_technician_id()::text, '')
    OR vendor_id::text = COALESCE(public.current_vendor_id()::text, '')
  )
  WITH CHECK (true);
DROP POLICY IF EXISTS notif_ins ON public.notifications;
CREATE POLICY notif_ins ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Staff can edit landlord details.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owners TO authenticated;
DROP POLICY IF EXISTS owners_staff_update ON public.owners;
CREATE POLICY owners_staff_update ON public.owners FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- 7. Repair tickets where an option was chosen but the ticket itself was not updated.
UPDATE public.maintenance_tickets t
   SET quote_stage = 'Approved',
       selected_option = q.id::text
  FROM public.vendor_quotes q
 WHERE q.ticket_id::text = t.id::text AND q.status = 'Selected'
   AND (t.selected_option IS NULL OR t.quote_stage IS DISTINCT FROM 'Approved');
