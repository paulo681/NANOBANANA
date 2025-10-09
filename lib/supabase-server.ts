import { createClient, SupabaseClient } from '@supabase/supabase-js';

type Database = Record<string, never>;

let supabaseAdmin: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase environment variables are missing. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  if (!supabaseAdmin) {
    supabaseAdmin = createClient<Database>(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return supabaseAdmin;
}
