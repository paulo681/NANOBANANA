import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { getPublicUrl, uploadToBucket } from '@/lib/storage';
import { stripe } from '@/lib/stripe';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';
const GENERATION_PRICE_CENTS = 200;

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

    const { data: project, error: insertError } = await supabaseAdmin
      .from('projects')
      .insert({
        user_id: session.user.id,
        input_image_url: inputPublicUrl,
        status: 'pending',
        payment_status: 'pending',
        payment_amount: GENERATION_PRICE_CENTS / 100,
        prompt,
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
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        project_id: createdProject.id,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: GENERATION_PRICE_CENTS,
            product_data: {
              name: "Génération d'image IA",
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
