-- Run this in your Supabase SQL Editor (after db/schema.sql and db/invite-codes.sql).
-- Safe to run again. It adds:
--   * Technician + Vendor accounts (invite-code registration, like landlords/tenants)
--   * Technician jobs and vendor quotes for maintenance requests
--   * Notifications for technicians / vendors
--   * A storage bucket "quotation-files" for attached files
-- It also REPLACES the signup trigger and invite functions from db/invite-codes.sql.

-- ---------- roles ----------
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'technician';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'vendor';

-- ---------- profiles links ----------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS technician_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vendor_id text;

CREATE OR REPLACE FUNCTION public.current_technician_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT technician_id FROM public.profiles WHERE user_id = auth.uid();
$$;
CREATE OR REPLACE FUNCTION public.current_vendor_id()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT vendor_id FROM public.profiles WHERE user_id = auth.uid();
$$;

-- ---------- technicians ----------
CREATE TABLE IF NOT EXISTS public.technicians (
  id text PRIMARY KEY,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  trade text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  invite_code text,
  invite_claimed_at timestamptz,
  deleted_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technicians TO authenticated;
GRANT ALL ON public.technicians TO service_role;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tech_staff ON public.technicians;
CREATE POLICY tech_staff ON public.technicians FOR ALL TO authenticated
  USING (public.is_staff()) WITH CHECK (public.is_staff());
DROP POLICY IF EXISTS tech_self ON public.technicians;
CREATE POLICY tech_self ON public.technicians FOR SELECT TO authenticated
  USING (id = public.current_technician_id());

-- ---------- vendors: invite + soft delete ----------
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS invite_claimed_at timestamptz;
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------- technician jobs (one per technician assigned to a ticket) ----------
CREATE TABLE IF NOT EXISTS public.technician_jobs (
  id text PRIMARY KEY,
  reference text NOT NULL,
  ticket_id text NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  technician_id text NOT NULL REFERENCES public.technicians(id) ON DELETE CASCADE,
  owner_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'Assigned',
  labour_price numeric NOT NULL DEFAULT 0,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  attachment jsonb,
  quoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_jobs TO authenticated;
GRANT ALL ON public.technician_jobs TO service_role;
ALTER TABLE public.technician_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tj_all ON public.technician_jobs;
CREATE POLICY tj_all ON public.technician_jobs FOR ALL TO authenticated
  USING (public.is_staff() OR technician_id = public.current_technician_id() OR owner_id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR technician_id = public.current_technician_id() OR owner_id = public.current_owner_id());

-- ---------- vendor quotes (one per vendor asked to price a technician's item list) ----------
CREATE TABLE IF NOT EXISTS public.vendor_quotes (
  id text PRIMARY KEY,
  reference text NOT NULL,
  ticket_id text NOT NULL REFERENCES public.maintenance_tickets(id) ON DELETE CASCADE,
  technician_job_id text NOT NULL REFERENCES public.technician_jobs(id) ON DELETE CASCADE,
  vendor_id text NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  owner_id text,
  delivery_location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Requested',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  delivery_charge numeric NOT NULL DEFAULT 0,
  note text,
  attachment jsonb,
  quoted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_quotes TO authenticated;
GRANT ALL ON public.vendor_quotes TO service_role;
ALTER TABLE public.vendor_quotes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vq_all ON public.vendor_quotes;
CREATE POLICY vq_all ON public.vendor_quotes FOR ALL TO authenticated
  USING (public.is_staff() OR vendor_id = public.current_vendor_id() OR owner_id = public.current_owner_id())
  WITH CHECK (public.is_staff() OR vendor_id = public.current_vendor_id() OR owner_id = public.current_owner_id());

-- ---------- maintenance ticket quotation stage ----------
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS quote_stage text;
ALTER TABLE public.maintenance_tickets ADD COLUMN IF NOT EXISTS selected_option text;

-- ---------- notifications for technicians / vendors ----------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS technician_id text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS vendor_id text;
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_user_role_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_user_role_check
  CHECK (user_role IN ('ADMIN','PROPERTY_MANAGER','LANDLORD','TENANT','TECHNICIAN','VENDOR','ALL'));

DROP POLICY IF EXISTS notif_sel ON public.notifications;
CREATE POLICY notif_sel ON public.notifications FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR owner_id = public.current_owner_id()
    OR tenant_id = public.current_tenant_id()
    OR technician_id = public.current_technician_id()
    OR vendor_id = public.current_vendor_id()
    OR (user_role = 'ALL' AND owner_id IS NULL AND tenant_id IS NULL)
  );
DROP POLICY IF EXISTS notif_upd ON public.notifications;
CREATE POLICY notif_upd ON public.notifications FOR UPDATE TO authenticated
  USING (
    public.is_staff()
    OR owner_id = public.current_owner_id()
    OR tenant_id = public.current_tenant_id()
    OR technician_id = public.current_technician_id()
    OR vendor_id = public.current_vendor_id()
  )
  WITH CHECK (true);
-- Anyone signed in can send a notification (e.g. technician -> property manager).
DROP POLICY IF EXISTS notif_ins ON public.notifications;
CREATE POLICY notif_ins ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ---------- file storage ----------
INSERT INTO storage.buckets (id, name, public) VALUES ('quotation-files', 'quotation-files', false)
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS qf_read ON storage.objects;
CREATE POLICY qf_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'quotation-files');
DROP POLICY IF EXISTS qf_write ON storage.objects;
CREATE POLICY qf_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'quotation-files');

-- ---------- invite functions (now include technicians + vendors) ----------
CREATE OR REPLACE FUNCTION public.check_invite_email(p_email text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email text := lower(trim(p_email));
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN RETURN 'registered'; END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.owners WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.technicians WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL AND deleted_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.vendors WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL AND deleted_at IS NULL) THEN
    RETURN 'invited';
  END IF;
  RETURN 'not_found';
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_invite_code(p_email text, p_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenants WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.owners WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.technicians WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.vendors WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL);
$$;
GRANT EXECUTE ON FUNCTION public.check_invite_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_invite_code(text, text) TO anon, authenticated;

-- ---------- signup trigger ----------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text := upper(trim(COALESCE(NEW.raw_user_meta_data ->> 'invite_code', '')));
  v_email text := lower(NEW.email);
  v_role text := 'tenant';
  v_name text := split_part(NEW.email, '@', 1);
  v_owner_id text; v_tenant_id text; v_tech_id text; v_vendor_id text;
  v_rec record;
  v_owner_type text; v_tenant_type text;
BEGIN
  IF v_code <> '' THEN
    SELECT id, full_name INTO v_rec FROM public.tenants
      WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
    IF FOUND THEN
      v_role := 'tenant'; v_name := v_rec.full_name; v_tenant_id := v_rec.id;
      UPDATE public.tenants SET invite_claimed_at = now() WHERE id = v_rec.id;
    ELSE
      SELECT id, full_name INTO v_rec FROM public.owners
        WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
      IF FOUND THEN
        v_role := 'landlord'; v_name := v_rec.full_name; v_owner_id := v_rec.id;
        UPDATE public.owners SET invite_claimed_at = now() WHERE id = v_rec.id;
      ELSE
        SELECT id, full_name INTO v_rec FROM public.technicians
          WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
        IF FOUND THEN
          v_role := 'technician'; v_name := v_rec.full_name; v_tech_id := v_rec.id;
          UPDATE public.technicians SET invite_claimed_at = now() WHERE id = v_rec.id;
        ELSE
          SELECT id, name AS full_name INTO v_rec FROM public.vendors
            WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
          IF FOUND THEN
            v_role := 'vendor'; v_name := v_rec.full_name; v_vendor_id := v_rec.id;
            UPDATE public.vendors SET invite_claimed_at = now() WHERE id = v_rec.id;
          ELSE
            RAISE EXCEPTION 'Invalid or already used one-time code';
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod) INTO v_owner_type FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'owner_id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_tenant_type FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'tenant_id' AND NOT a.attisdropped;

  EXECUTE format(
    'INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id, technician_id, vendor_id)
     VALUES ($1, $2, $3::%s, $4::%s, $5, $6)
     ON CONFLICT (user_id) DO UPDATE SET
       owner_id = COALESCE(EXCLUDED.owner_id, public.profiles.owner_id),
       tenant_id = COALESCE(EXCLUDED.tenant_id, public.profiles.tenant_id),
       technician_id = COALESCE(EXCLUDED.technician_id, public.profiles.technician_id),
       vendor_id = COALESCE(EXCLUDED.vendor_id, public.profiles.vendor_id)',
    v_owner_type, v_tenant_type
  ) USING NEW.id, v_name, v_owner_id, v_tenant_id, v_tech_id, v_vendor_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
