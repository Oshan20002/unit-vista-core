-- Company bank accounts, landlord bank details, and payments (tenant rent slips + payouts).
-- Run once in the Supabase SQL Editor (after db/work-orders.sql). Safe to run again.

ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS bank_account_name text;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS bank_account_number text;
ALTER TABLE public.owners ADD COLUMN IF NOT EXISTS bank_branch text;

CREATE TABLE IF NOT EXISTS public.company_banks (
  id text PRIMARY KEY,
  bank_name text NOT NULL,
  account_number text NOT NULL,
  branch text,
  account_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_banks TO authenticated;
GRANT ALL ON public.company_banks TO service_role;
ALTER TABLE public.company_banks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS cb_read ON public.company_banks;
CREATE POLICY cb_read ON public.company_banks FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS cb_staff ON public.company_banks;
CREATE POLICY cb_staff ON public.company_banks FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());

CREATE TABLE IF NOT EXISTS public.payments (
  id text PRIMARY KEY,
  kind text NOT NULL,          -- TENANT_RENT | LANDLORD | VENDOR | TECHNICIAN
  amount numeric NOT NULL,
  method text,
  status text NOT NULL DEFAULT 'Submitted',  -- Submitted | Confirmed
  rent_id text,
  tenant_id text,
  owner_id text,
  vendor_id text,
  technician_id text,
  slip jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Staff see everything; each party sees and confirms only their own payments.
DROP POLICY IF EXISTS pay_all ON public.payments;
CREATE POLICY pay_all ON public.payments FOR ALL TO authenticated
  USING (
    public.is_staff()
    OR (kind = 'TENANT_RENT' AND tenant_id = COALESCE(public.current_tenant_id()::text, ''))
    OR (kind = 'LANDLORD' AND owner_id IN (SELECT public.my_owner_ids()))
    OR (kind = 'VENDOR' AND vendor_id = COALESCE(public.current_vendor_id()::text, ''))
    OR (kind = 'TECHNICIAN' AND technician_id = COALESCE(public.current_technician_id()::text, ''))
  )
  WITH CHECK (
    public.is_staff()
    OR (kind = 'TENANT_RENT' AND tenant_id = COALESCE(public.current_tenant_id()::text, ''))
    OR (kind = 'LANDLORD' AND owner_id IN (SELECT public.my_owner_ids()))
    OR (kind = 'VENDOR' AND vendor_id = COALESCE(public.current_vendor_id()::text, ''))
    OR (kind = 'TECHNICIAN' AND technician_id = COALESCE(public.current_technician_id()::text, ''))
  );
-- Slips are stored in the existing "quotation-files" bucket (see db/quotations.sql).
