-- Fixes: rent payments from tenants not saving. Run once in the Supabase SQL Editor. Safe to run again.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rent_schedules TO authenticated;
ALTER TABLE public.rent_schedules DROP CONSTRAINT IF EXISTS rent_schedules_method_check;
ALTER TABLE public.rent_schedules ADD CONSTRAINT rent_schedules_method_check
  CHECK (method IS NULL OR method IN ('Bank Transfer','Cheque','Cash','Card'));

DROP POLICY IF EXISTS rent_sel ON public.rent_schedules;
DROP POLICY IF EXISTS rent_iu ON public.rent_schedules;
CREATE POLICY rent_sel ON public.rent_schedules FOR SELECT TO authenticated
  USING (public.is_staff()
    OR tenant_id::text = COALESCE(public.current_tenant_id()::text, '')
    OR EXISTS (SELECT 1 FROM public.properties p
               WHERE p.id::text = rent_schedules.property_id::text
                 AND p.owner_id::text IN (SELECT public.my_owner_ids())));
-- Only staff change rent records (tenants submit slips via payments instead).
CREATE POLICY rent_iu ON public.rent_schedules FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
