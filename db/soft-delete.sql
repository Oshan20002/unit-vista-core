-- Run this ONCE in your Supabase SQL Editor (safe to run again).
-- Adds "deleted" status for landlords, tenants and leases.
-- Deleted records stay for 7 days (shown red / crossed out to staff), then are removed.

ALTER TABLE public.owners  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.leases  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Permanently removes records deleted more than 7 days ago.
CREATE OR REPLACE FUNCTION public.purge_deleted_records()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.leases  WHERE deleted_at < now() - interval '7 days';
  DELETE FROM public.tenants WHERE deleted_at < now() - interval '7 days';
  DELETE FROM public.owners  WHERE deleted_at < now() - interval '7 days';
$$;
REVOKE ALL ON FUNCTION public.purge_deleted_records() FROM PUBLIC, anon, authenticated;

-- Optional: run the clean-up automatically every night (needs the pg_cron extension:
-- Dashboard -> Database -> Extensions -> enable "pg_cron"). The app also cleans up
-- whenever a property manager signs in, so this is only a backup.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('purge-deleted-records', '0 3 * * *', 'SELECT public.purge_deleted_records()');
  END IF;
END $$;
