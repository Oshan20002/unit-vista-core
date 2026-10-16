-- Run this ONCE in your Supabase SQL Editor (after db/schema.sql).
--
-- Why: linking a landlord's LOGIN to their OWNER record needs a lookup in
-- auth.users, which the browser client cannot read. This SECURITY DEFINER
-- function does it server-side and only for admins / property managers.
-- Safe to run again (idempotent).

CREATE OR REPLACE FUNCTION public.link_landlord_to_owner(p_email text, p_owner_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_col_type text;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'property_manager')
  ) THEN
    RAISE EXCEPTION 'Only admins and property managers can link landlord logins.';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  -- profiles.owner_id may be text or uuid depending on when the table was
  -- created, so cast the value to whatever type the column actually has.
  SELECT format_type(a.atttypid, a.atttypmod) INTO v_col_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.profiles'::regclass AND a.attname = 'owner_id' AND NOT a.attisdropped;

  EXECUTE format(
    'INSERT INTO public.profiles (user_id, full_name, owner_id)
     VALUES ($1, $2, $3::%s)
     ON CONFLICT (user_id) DO UPDATE SET owner_id = EXCLUDED.owner_id',
    v_col_type
  ) USING v_user_id, split_part(lower(p_email), '@', 1), p_owner_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.link_landlord_to_owner(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_landlord_to_owner(text, text) TO authenticated;
