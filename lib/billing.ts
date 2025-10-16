import { SupabaseClient } from '@supabase/supabase-js';

import { stripe } from './stripe';
import { getSupabaseAdmin, type Database } from './supabase-server';

type SupabaseServerClient = SupabaseClient<Database, 'public', any>;

export async function ensureBillingProfile({
  supabase,
  userId,
  email,
}: {
  supabase: SupabaseServerClient;
  userId: string;
  email: string;
}): Promise<string> {
  const { data: profile } = await supabase
    .from('billing_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      supabase_user_id: userId,
    },
  });

  const admin = getSupabaseAdmin();

  await admin.from('billing_profiles').upsert({
    user_id: userId,
    stripe_customer_id: customer.id,
  });

  return customer.id;
}

export async function ensureCreditsRow(userId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data } = await admin
    .from('credits')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) {
    await admin.from('credits').insert({
      user_id: userId,
      credits_remaining: 0,
    });
  }
}

export async function adjustCredits(userId: string, delta: number): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('credits')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    throw error;
  }

  const current = (data as Database['public']['Tables']['credits']['Row'] | null)?.credits_remaining ?? 0;
  const nextBalance = current + delta;

  if (nextBalance < 0) {
    throw new Error('Crédits insuffisants.');
  }

  const { error: updateError } = await admin
    .from('credits')
    .update({ credits_remaining: nextBalance })
    .eq('user_id', userId);

  if (updateError) {
    throw updateError;
  }

  return nextBalance;
}

export async function getCreditsBalance(userId: string): Promise<number> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('credits')
    .select('credits_remaining')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = data as Database['public']['Tables']['credits']['Row'] | null;
  return row?.credits_remaining ?? 0;
}
