import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { getSupabaseAdmin } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET manquant.');
    return NextResponse.json({ error: 'Webhook non configuré.' }, { status: 500 });
  }

  if (!signature) {
    return NextResponse.json({ error: 'Signature Stripe absente.' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    console.error('Signature webhook invalide', error);
    return NextResponse.json({ error: 'Signature invalide.' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const projectId = session.metadata?.project_id;

    if (!projectId) {
      console.error('Webhook Stripe sans project_id.');
      return NextResponse.json({ error: 'project_id manquant.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({
        payment_status: 'paid',
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
      })
      .eq('id', projectId);

    if (updateError) {
      console.error('Erreur lors de la mise à jour du projet après paiement', updateError);
      return NextResponse.json({ error: 'Mise à jour impossible.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
