-- Run this ONCE in your Supabase SQL Editor (after db/schema.sql).
-- Safe to run again. It REPLACES the trigger from db/auth-trigger.sql.
--
-- Invite-only registration:
--   * A property manager adds a landlord or tenant -> a 6-character one-time
--     code is saved on that owners / tenants row.
--   * On the Register tab the person enters their email + that code, then a password.
--   * The signup trigger below links the new login to the owner/tenant record
--     and marks the code as used. Nobody can pick their own role any more.
--
-- Also: Supabase Dashboard -> Authentication -> Sign In / Providers -> Email ->
-- turn OFF "Confirm email" so people can sign in right after setting a password
-- (the one-time code already proves they own the email).

ALTER TABLE public.owners  ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.owners  ADD COLUMN IF NOT EXISTS invite_claimed_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS invite_code text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS invite_claimed_at timestamptz;

-- Step 1 of Register: is this email assigned by a property manager?
-- Returns 'invited', 'registered' (code already used) or 'not_found'.
CREATE OR REPLACE FUNCTION public.check_invite_email(p_email text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(email) = v_email) THEN
    RETURN 'registered';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL)
     OR EXISTS (SELECT 1 FROM public.owners WHERE lower(email) = v_email AND invite_code IS NOT NULL AND invite_claimed_at IS NULL) THEN
    RETURN 'invited';
  END IF;
  RETURN 'not_found';
END;
$$;

-- Step 2 of Register: is the one-time code correct?
CREATE OR REPLACE FUNCTION public.verify_invite_code(p_email text, p_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenants
    WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL
  ) OR EXISTS (
    SELECT 1 FROM public.owners
    WHERE lower(email) = lower(trim(p_email)) AND upper(invite_code) = upper(trim(p_code)) AND invite_claimed_at IS NULL
  );
$$;

REVOKE ALL ON FUNCTION public.check_invite_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_invite_code(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_invite_email(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_invite_code(text, text) TO anon, authenticated;

-- Signup trigger: link the login using the invite code. The role is decided
-- here, never by the browser. Users created from the Supabase dashboard
-- (no code) get a plain unlinked 'tenant' role that sees no data; promote
-- admins / property managers manually in public.user_roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text := upper(trim(COALESCE(NEW.raw_user_meta_data ->> 'invite_code', '')));
  v_email text := lower(NEW.email);
  v_tenant public.tenants%ROWTYPE;
  v_owner public.owners%ROWTYPE;
  v_role public.app_role := 'tenant';
  v_name text := split_part(NEW.email, '@', 1);
  v_owner_id text;
  v_tenant_id text;
  v_owner_type text;
  v_tenant_type text;
BEGIN
  IF v_code <> '' THEN
    SELECT * INTO v_tenant FROM public.tenants
      WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
    IF FOUND THEN
      v_role := 'tenant'; v_name := v_tenant.full_name; v_tenant_id := v_tenant.id;
      UPDATE public.tenants SET invite_claimed_at = now() WHERE id = v_tenant.id;
    ELSE
      SELECT * INTO v_owner FROM public.owners
        WHERE lower(email) = v_email AND upper(invite_code) = v_code AND invite_claimed_at IS NULL LIMIT 1;
      IF FOUND THEN
        v_role := 'landlord'; v_name := v_owner.full_name; v_owner_id := v_owner.id;
        UPDATE public.owners SET invite_claimed_at = now() WHERE id = v_owner.id;
      ELSE
        RAISE EXCEPTION 'Invalid or already used one-time code';
      END IF;
    END IF;
  END IF;

  -- profiles.owner_id / tenant_id may be text or uuid depending on schema age.
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_owner_type FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'owner_id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_tenant_type FROM pg_attribute a
    WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'tenant_id' AND NOT a.attisdropped;

  EXECUTE format(
    'INSERT INTO public.profiles (user_id, full_name, owner_id, tenant_id)
     VALUES ($1, $2, $3::%s, $4::%s)
     ON CONFLICT (user_id) DO UPDATE SET
       owner_id = COALESCE(EXCLUDED.owner_id, public.profiles.owner_id),
       tenant_id = COALESCE(EXCLUDED.tenant_id, public.profiles.tenant_id)',
    v_owner_type, v_tenant_type
  ) USING NEW.id, v_name, v_owner_id, v_tenant_id;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
