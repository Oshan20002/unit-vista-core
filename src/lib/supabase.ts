import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Bring-your-own Supabase project.
 *
 * Add these to your .env file (see .env.example):
 *   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon/publishable key>
 *
 * Run the SQL in supabase/migrations/ and supabase/seed.sql inside your project.
 * Until the env vars are present the app runs in demo mode against the local
 * seed dataset, so every screen is fully explorable without a backend.
 */
const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
