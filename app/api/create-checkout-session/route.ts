import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { getPublicUrl, uploadToBucket } from '@/lib/storage';
import { ensureBillingProfile, ensureCreditsRow } from '@/lib/billing';
import { MODEL_PRICING, type ModelKey } from '@/lib/pricing';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';

export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('image');
    const prompt = (formData.get('prompt') ?? '') as string;
    const modelKey = (formData.get('modelKey') ?? 'google/nano-banana') as string;

    if (!(modelKey in MODEL_PRICING)) {
      return NextResponse.json({ error: 'Modèle non supporté.' }, { status: 400 });
    }

    const { amountCents } = MODEL_PRICING[modelKey as ModelKey];

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucune image reçue.' }, { status: 400 });
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'Le prompt est requis.' }, { status: 400 });
    }

    const fileArrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(fileArrayBuffer);
    const extension = file.type?.split('/')?.[1] || 'png';
    const inputPath = `uploads/${new Date().toISOString()}-${crypto.randomUUID()}.${extension}`;

    await uploadToBucket(INPUT_BUCKET, inputPath, fileBuffer, file.type || 'application/octet-stream');
    const inputPublicUrl = await getPublicUrl(INPUT_BUCKET, inputPath);

    const supabaseAdmin = getSupabaseAdmin();

    await ensureCreditsRow(session.user.id);

    const stripeCustomerId = await ensureBillingProfile({
      supabase,
      userId: session.user.id,
      email: session.user.email ?? '',
    });

    const { data: project, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: session.user.id,
        input_image_url: inputPublicUrl,
        status: 'pending',
        payment_status: 'pending',
        payment_amount: amountCents / 100,
        prompt,
        model_key: modelKey,
      })
      .select('*')
      .single();

    const createdProject = project as Database['public']['Tables']['projects']['Row'] | null;

    if (insertError || !createdProject) {
      throw insertError ?? new Error('Impossible de créer le projet.');
    }

    const baseUrl = process.env.NEXT_PUBLIC_URL ?? request.headers.get('origin') ?? '';
    const successUrl = `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard`;

    const sessionCheckout = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer: stripeCustomerId,
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        project_id: createdProject.id,
        model_key: modelKey,
        price_cents: String(amountCents),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: amountCents,
            product_data: {
              name: `Génération IA – ${modelKey}`,
            },
          },
        },
      ],
    });

    await supabaseAdmin
      .from('projects')
      .update({
        stripe_checkout_session_id: sessionCheckout.id ?? null,
      })
      .eq('id', createdProject.id)
      .eq('user_id', session.user.id);

    return NextResponse.json({ url: sessionCheckout.url });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la création de la session de paiement.',
      },
      { status: 500 },
    );
  }
}
