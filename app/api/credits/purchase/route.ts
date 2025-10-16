import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { ensureBillingProfile, ensureCreditsRow } from '@/lib/billing';
import { CREDIT_PACKS } from '@/lib/pricing';
import type { Database } from '@/lib/supabase-server';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }

    const { packId } = (await request.json().catch(() => ({}))) as { packId?: string };

    const pack = CREDIT_PACKS.find((item) => item.id === packId);

    if (!pack) {
      return NextResponse.json({ error: 'Pack inconnu.' }, { status: 400 });
    }

    await ensureCreditsRow(session.user.id);
    const stripeCustomerId = await ensureBillingProfile({
      supabase,
      userId: session.user.id,
      email: session.user.email ?? '',
    });

    const baseUrl = process.env.NEXT_PUBLIC_URL ?? request.headers.get('origin') ?? '';
    const successUrl = `${baseUrl}/billing?pack_session={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/billing`;

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        credits_pack_size: String(pack.credits),
        pack_id: pack.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: pack.amountCents,
            product_data: {
              name: pack.name,
            },
          },
        },
      ],
    });

    return NextResponse.json({ url: sessionCheckout.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la création du paiement des crédits.',
      },
      { status: 500 },
    );
  }
}
