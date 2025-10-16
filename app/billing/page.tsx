import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import Stripe from 'stripe';

import { CreditPackPurchase } from '@/components/CreditPackPurchase';
import { ensureBillingProfile, ensureCreditsRow, getCreditsBalance } from '@/lib/billing';
import { CREDIT_PACKS } from '@/lib/pricing';
import type { Database } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export const metadata: Metadata = {
  title: 'Facturation – NanoBanana',
};

export const dynamic = 'force-dynamic';

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: {
    pack_session?: string;
  };
}) {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const email = session.user.email ?? '';
  const userId = session.user.id;

  await ensureCreditsRow(userId);
  const stripeCustomerId = await ensureBillingProfile({ supabase, userId, email });

  const packSessionId = searchParams?.pack_session;

  if (packSessionId) {
    try {
      await stripe.checkout.sessions.retrieve(packSessionId);
    } catch (error) {
      console.error('Impossible de récupérer la session de pack de crédits', error);
    }
  }

  const [paymentIntents, creditsBalance] = await Promise.all([
    stripe.paymentIntents.list({
      customer: stripeCustomerId,
      limit: 20,
      expand: ['data.latest_charge'],
    }),
    getCreditsBalance(userId),
  ]);

  const payments = paymentIntents.data.map((intent) => {
    const charge = intent.latest_charge as Stripe.Charge | null | undefined;

    return {
      id: intent.id,
      amount: intent.amount_received || intent.amount,
      currency: intent.currency,
      status: intent.status,
      created: intent.created,
      receiptUrl: charge?.receipt_url ?? null,
    };
  });

  return (
    <main className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">Facturation</h1>
        <p className="text-sm text-slate-300">
          Consulte tes paiements récents et récupère les justificatifs. Tu disposes actuellement de{' '}
          <span className="font-medium text-white">{creditsBalance}</span> crédits.
        </p>
      </header>

      <CreditPackPurchase packs={CREDIT_PACKS} />

      <section className="overflow-hidden rounded-3xl border border-white/5 bg-slate-900/40">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-slate-900/60 text-left text-xs uppercase tracking-[0.3em] text-slate-400">
            <tr>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Montant</th>
              <th className="px-6 py-3">Statut</th>
              <th className="px-6 py-3">Reçu</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {payments.length === 0 ? (
              <tr>
                <td className="px-6 py-6 text-center text-slate-400" colSpan={4}>
                  Aucun paiement enregistré pour le moment.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-white/5">
                  <td className="px-6 py-4 text-slate-200">
                    {new Date(payment.created * 1000).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-slate-200">
                    {(payment.amount / 100).toFixed(2)} {payment.currency.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 capitalize text-slate-300">{payment.status.replaceAll('_', ' ')}</td>
                  <td className="px-6 py-4">
                    {payment.receiptUrl ? (
                      <a
                        href={payment.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent underline-offset-4 hover:underline"
                      >
                        Télécharger
                      </a>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}
