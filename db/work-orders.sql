-- Bank details for technicians/vendors + work order (delivery, booking, done, feedback).
-- Run once in the Supabase SQL Editor (after db/fix-quote-choice.sql). Safe to run again.

ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS bank_account_name text;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.technicians ADD COLUMN IF NOT EXISTS bank_iban text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_account_name text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS bank_iban text;

ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS work_order jsonb;

-- Staff can edit technician / vendor details.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
DROP POLICY IF EXISTS technicians_staff_update ON public.technicians;
CREATE POLICY technicians_staff_update ON public.technicians FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS vendors_staff_update ON public.vendors;
CREATE POLICY vendors_staff_update ON public.vendors FOR UPDATE TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Technicians/vendors can read & update the ticket they work on (delivery date, dates, done).
-- (Policies tickets_partner_sel / tickets_partner_upd come from db/fix-maintenance.sql.)
-- Tenants already update their own tickets (booking, feedback) via tickets_tenant_upd.
