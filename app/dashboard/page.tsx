import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

import { DashboardClient } from '@/components/DashboardClient';
import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export const metadata: Metadata = {
  title: 'Tableau de bord – NanoBanana',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: {
    session_id?: string;
  };
}) {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const checkoutSessionId = searchParams?.session_id;

  if (checkoutSessionId) {
    try {
      const checkoutSession = await stripe.checkout.sessions.retrieve(checkoutSessionId);
      const projectId = checkoutSession.metadata?.project_id;

      if (projectId) {
        const { data: ownedProject } = await supabase
          .from('projects')
          .select('id')
          .eq('id', projectId)
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (ownedProject) {
          const updates: Database['public']['Tables']['projects']['Update'] = {
            payment_status: 'paid',
            stripe_checkout_session_id: checkoutSession.id,
            stripe_payment_intent_id:
              typeof checkoutSession.payment_intent === 'string'
                ? checkoutSession.payment_intent
                : checkoutSession.payment_intent?.id ?? null,
          };

          await getSupabaseAdmin().from('projects').update(updates).eq('id', projectId);
        }
      }
    } catch (error) {
      console.error('Impossible de finaliser le paiement après redirection Stripe', error);
    }
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  const generationPriceCents = 200;

  return (
    <DashboardClient
      initialProjects={projects ?? []}
      generationPriceCents={generationPriceCents}
      hadCheckoutSession={Boolean(checkoutSessionId)}
    />
  );
}
