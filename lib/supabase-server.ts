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
          model_key: string | null;
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
          model_key?: string | null;
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
          model_key?: string | null;
        };
        Relationships: [];
      };
      credits: {
        Row: {
          user_id: string;
          credits_remaining: number;
          updated_at: string | null;
          created_at: string | null;
        };
        Insert: {
          user_id: string;
          credits_remaining?: number;
          updated_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          user_id?: string;
          credits_remaining?: number;
          updated_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'credits_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      billing_profiles: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          user_id: string;
          stripe_customer_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          user_id?: string;
          stripe_customer_id?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'billing_profiles_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
