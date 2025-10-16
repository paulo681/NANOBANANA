import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type Database = {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string;
          created_at: string;
          input_image_url: string | null;
          output_image_url: string | null;
          prompt: string;
          status: string;
          user_id: string;
          payment_status: string | null;
          payment_amount: number | null;
          stripe_payment_intent_id: string | null;
          stripe_checkout_session_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          input_image_url?: string | null;
          output_image_url?: string | null;
          prompt?: string;
          status?: string;
          user_id?: string;
          payment_status?: string | null;
          payment_amount?: number | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          input_image_url?: string | null;
          output_image_url?: string | null;
          prompt?: string;
          status?: string;
          user_id?: string;
          payment_status?: string | null;
          payment_amount?: number | null;
          stripe_payment_intent_id?: string | null;
          stripe_checkout_session_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

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
