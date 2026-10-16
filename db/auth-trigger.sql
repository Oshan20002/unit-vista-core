-- Run this ONCE in your Supabase SQL Editor (after db/schema.sql).
--
-- Why: when a user registers, the browser cannot reliably insert into
-- public.profiles / public.user_roles — with email confirmation enabled there
-- is no session yet, so RLS blocks the write and the account ends up with no
-- profile or role. This trigger creates both rows server-side, always.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role public.app_role;
BEGIN
  BEGIN
    meta_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'landlord')::public.app_role;
  EXCEPTION WHEN others THEN
    meta_role := 'landlord';
  END;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, meta_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
