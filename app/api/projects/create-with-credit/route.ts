import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { adjustCredits, ensureCreditsRow } from '@/lib/billing';
import { MODEL_PRICING, type ModelKey } from '@/lib/pricing';
import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { getPublicUrl, uploadToBucket } from '@/lib/storage';
import { runImageGeneration } from '@/lib/replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';
const OUTPUT_BUCKET = process.env.SUPABASE_OUTPUT_BUCKET ?? 'output-images';

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

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Aucune image reçue.' }, { status: 400 });
    }

    if (!prompt.trim()) {
      return NextResponse.json({ error: 'Le prompt est requis.' }, { status: 400 });
    }

    await ensureCreditsRow(session.user.id);

    let creditsRemaining: number;
    try {
      creditsRemaining = await adjustCredits(session.user.id, -1);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Crédits insuffisants.' }, { status: 402 });
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
        status: 'processing',
        payment_status: 'paid',
        payment_amount: 0,
        prompt,
        model_key: modelKey,
      })
      .select('*')
      .single();

    const createdProject = project as Database['public']['Tables']['projects']['Row'] | null;

    if (insertError || !createdProject) {
      await adjustCredits(session.user.id, +1);
      throw insertError ?? new Error('Impossible de créer le projet.');
    }

    try {
      const base64Image = `data:${file.type || 'image/png'};base64,${fileBuffer.toString('base64')}`;
      const outputImageUrl = await runImageGeneration({
        imageBase64: base64Image,
        prompt,
        fallbackImageUrl: inputPublicUrl,
        model: modelKey,
      });

      const generatedResponse = await fetch(outputImageUrl);
      if (!generatedResponse.ok) {
        throw new Error(`Impossible de télécharger l'image générée: ${generatedResponse.statusText}`);
      }

      const generatedArrayBuffer = await generatedResponse.arrayBuffer();
      const generatedBuffer = Buffer.from(generatedArrayBuffer);
      const generatedContentType = generatedResponse.headers.get('content-type') ?? 'image/png';
      const generatedExtension = generatedContentType.split('/')?.[1] || 'png';
      const outputPath = `generated/${new Date().toISOString()}-${crypto.randomUUID()}.${generatedExtension}`;

      await uploadToBucket(OUTPUT_BUCKET, outputPath, generatedBuffer, generatedContentType);
      const outputPublicUrl = await getPublicUrl(OUTPUT_BUCKET, outputPath);

      const { data: updatedProject, error: updateError } = await supabaseAdmin
        .from('projects')
        .update({
          output_image_url: outputPublicUrl,
          status: 'completed',
        })
        .eq('id', createdProject.id)
        .select('*')
        .single();

      if (updateError || !updatedProject) {
        throw updateError ?? new Error('Erreur lors de la mise à jour du projet.');
      }

      return NextResponse.json({ project: updatedProject, creditsRemaining });
    } catch (generationError) {
      await adjustCredits(session.user.id, +1);
      await supabaseAdmin.from('projects').delete().eq('id', createdProject.id);
      throw generationError;
    }
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la génération avec crédits.',
      },
      { status: 500 },
    );
  }
}
