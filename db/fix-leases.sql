-- Run once in Supabase SQL Editor.
-- 1) Adds the missing units.tenant_id column (fixes "Could not find the 'tenant_id' column of 'units'").
-- 2) Lets landlords see leases, units and rent for every property they own.

ALTER TABLE public.units ADD COLUMN IF NOT EXISTS tenant_id text REFERENCES public.tenants(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_units_tenant ON public.units(tenant_id);

-- Units
DROP POLICY IF EXISTS units_sel ON public.units;
CREATE POLICY units_sel ON public.units FOR SELECT TO authenticated
  USING (public.is_staff()
    OR owner_id::text = public.current_owner_id()::text
    OR tenant_id::text = public.current_tenant_id()::text
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = units.property_id AND p.owner_id::text = public.current_owner_id()::text));

-- Leases
DROP POLICY IF EXISTS leases_sel ON public.leases;
CREATE POLICY leases_sel ON public.leases FOR SELECT TO authenticated
  USING (public.is_staff()
    OR owner_id::text = public.current_owner_id()::text
    OR tenant_id::text = public.current_tenant_id()::text
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = leases.property_id AND p.owner_id::text = public.current_owner_id()::text));

-- Rent schedules
DROP POLICY IF EXISTS rent_sel ON public.rent_schedules;
CREATE POLICY rent_sel ON public.rent_schedules FOR SELECT TO authenticated
  USING (public.is_staff()
    OR tenant_id::text = public.current_tenant_id()::text
    OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = rent_schedules.property_id AND p.owner_id::text = public.current_owner_id()::text));

-- Tenants on the landlord's properties
DROP POLICY IF EXISTS tenants_owner_sel ON public.tenants;
CREATE POLICY tenants_owner_sel ON public.tenants FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.leases l JOIN public.properties p ON p.id = l.property_id
                 WHERE l.tenant_id = tenants.id AND p.owner_id::text = public.current_owner_id()::text));

-- Link existing leased units to their tenants
UPDATE public.units u SET tenant_id = l.tenant_id, status = 'Occupied'
FROM public.leases l
WHERE l.unit_id = u.id AND l.status IN ('Active','Expiring Soon') AND u.tenant_id IS NULL;

NOTIFY pgrst, 'reload schema';
