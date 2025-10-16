import { NextResponse } from 'next/server';
import Stripe from 'stripe';

import { adjustCredits, ensureCreditsRow } from '@/lib/billing';
import { sendEmail } from '@/lib/email';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function getUserFromStripeCustomer(customerId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: profile } = await supabaseAdmin
    .from('billing_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (!profile) {
    return null;
  }

  const { data: userResponse } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
  return userResponse?.user ?? null;
}

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

  const supabaseAdmin = getSupabaseAdmin();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const projectId = session.metadata?.project_id;
      const creditsPackSize = session.metadata?.credits_pack_size
        ? Number(session.metadata.credits_pack_size)
        : undefined;

      if (creditsPackSize) {
        const customerId = session.customer;
        if (typeof customerId === 'string') {
          const user = await getUserFromStripeCustomer(customerId);
          if (user) {
            await ensureCreditsRow(user.id);
            await adjustCredits(user.id, creditsPackSize);
          }
        }
      }

      if (projectId) {
        const { error: updateError } = await supabaseAdmin
          .from('projects')
          .update({
            payment_status: 'paid',
            stripe_checkout_session_id: session.id,
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : null,
          })
          .eq('id', projectId);

        if (updateError) {
          console.error('Erreur mise à jour projet après paiement', updateError);
        }
      }

      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const customerId = paymentIntent.customer;

      if (typeof customerId === 'string') {
        const user = await getUserFromStripeCustomer(customerId);

        if (user?.email) {
          await sendEmail({
            to: user.email,
            subject: 'Paiement échoué – NanoBanana',
            text: "Votre paiement n'a pas abouti. Merci de vérifier votre méthode de paiement.",
            html: "<p>Bonjour,</p><p>Votre dernier paiement n'a pas pu être traité. Merci de vérifier votre méthode de paiement ou de réessayer.</p>",
          });
        }
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer;

      if (typeof customerId === 'string') {
        const user = await getUserFromStripeCustomer(customerId);

        if (user?.email) {
          await sendEmail({
            to: user.email,
            subject: 'Abonnement annulé – NanoBanana',
            text: "Votre abonnement a bien été annulé. Merci d'avoir utilisé NanoBanana.",
            html: "<p>Bonjour,</p><p>Votre abonnement a été annulé. Nous espérons vous revoir bientôt !</p>",
          });
        }
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
