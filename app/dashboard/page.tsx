import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

import { DashboardClient } from '@/components/DashboardClient';
import { ensureCreditsRow, getCreditsBalance } from '@/lib/billing';
import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';
import Stripe from 'stripe';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

type AdminAnalytics = {
  revenueEuros: number;
  paymentsCount: number;
  activeSubscriptions: number;
  conversionRate: number;
};

async function fetchAdminAnalytics(): Promise<AdminAnalytics> {
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
  const createdFilter = { gte: Math.floor(startOfMonth.getTime() / 1000) } as const;

  const balanceTransactions: Stripe.BalanceTransaction[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const response = await stripe.balanceTransactions.list({
      limit: 100,
      created: createdFilter,
      type: 'charge',
      starting_after: startingAfter,
    });

    balanceTransactions.push(...response.data);

    if (!response.has_more) {
      break;
    }

    startingAfter = response.data.at(-1)?.id;
    if (!startingAfter) {
      break;
    }
  }

  const totalRevenueCents = balanceTransactions.reduce((acc, tx) => acc + tx.amount, 0);
  const paymentsCount = balanceTransactions.length;

  const subscriptions = await stripe.subscriptions.list({ status: 'active', limit: 100 });
  const activeSubscriptions = subscriptions.data.length;

  const sessions = await stripe.checkout.sessions.list({ limit: 100, created: createdFilter });
  const totalSessions = sessions.data.length;
  const paidSessions = sessions.data.filter((session) => session.payment_status === 'paid').length;
  const conversionRate = totalSessions > 0 ? paidSessions / totalSessions : 0;

  return {
    revenueEuros: totalRevenueCents / 100,
    paymentsCount,
    activeSubscriptions,
    conversionRate,
  };
}

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

  await ensureCreditsRow(session.user.id);
  const creditsBalance = await getCreditsBalance(session.user.id);

  const isAdmin = ADMIN_EMAILS.includes((session.user.email ?? '').toLowerCase());
  const adminAnalytics = isAdmin ? await fetchAdminAnalytics() : null;

  return (
    <>
      <DashboardClient
        initialProjects={projects ?? []}
        hadCheckoutSession={Boolean(checkoutSessionId)}
        initialCredits={creditsBalance}
      />

      {isAdmin && adminAnalytics && (
        <section className="mt-12 space-y-4 rounded-3xl border border-white/5 bg-slate-900/50 p-8">
          <h2 className="text-2xl font-semibold text-white">Analytics du mois</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Revenu</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {adminAnalytics.revenueEuros.toFixed(2)} €
              </p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Paiements</p>
              <p className="mt-2 text-xl font-semibold text-white">{adminAnalytics.paymentsCount}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Abonnements actifs</p>
              <p className="mt-2 text-xl font-semibold text-white">{adminAnalytics.activeSubscriptions}</p>
            </div>
            <div className="rounded-2xl border border-white/5 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Conversion</p>
              <p className="mt-2 text-xl font-semibold text-white">
                {(adminAnalytics.conversionRate * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
