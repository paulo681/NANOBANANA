import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseAdmin, type Database } from '@/lib/supabase-server';
import { getPublicUrl, uploadToBucket } from '@/lib/storage';
import { runImageGeneration } from '@/lib/replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';
const OUTPUT_BUCKET = process.env.SUPABASE_OUTPUT_BUCKET ?? 'output-images';

export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const projectId = body?.projectId as string | undefined;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId est requis.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data: project, error: fetchError } = await supabaseAdmin
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const projectRow = project as Database['public']['Tables']['projects']['Row'] | null;

    if (fetchError || !projectRow) {
      return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 });
    }

    if (projectRow.user_id !== session.user.id) {
      return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
    }

    if (projectRow.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Le paiement est requis avant de lancer la génération.' }, { status: 402 });
    }

    if (!projectRow.input_image_url) {
      return NextResponse.json({ error: "L'image source est introuvable." }, { status: 400 });
    }

    await supabaseAdmin
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId)
      .eq('user_id', session.user.id);

    const inputResponse = await fetch(projectRow.input_image_url);
    if (!inputResponse.ok) {
      throw new Error("Impossible de télécharger l'image source.");
    }

    const inputArrayBuffer = await inputResponse.arrayBuffer();
    const inputBuffer = Buffer.from(inputArrayBuffer);
    const contentType = inputResponse.headers.get('content-type') ?? 'image/png';

    const base64Image = `data:${contentType};base64,${inputBuffer.toString('base64')}`;

    const outputImageUrl = await runImageGeneration({
      imageBase64: base64Image,
      prompt: projectRow.prompt,
      fallbackImageUrl: projectRow.input_image_url,
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
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .select('*')
      .single();

    if (updateError || !updatedProject) {
      throw updateError ?? new Error('Erreur lors de la mise à jour du projet.');
    }

    return NextResponse.json({ project: updatedProject });
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message === 'INPUT_FLAGGED_SENSITIVE') {
      return NextResponse.json(
        {
          error:
            "Le modèle Replicate a détecté un contenu sensible dans l'image ou le prompt. Merci d'essayer avec d'autres éléments.",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Erreur lors de la génération.',
      },
      { status: 500 },
    );
  }
}
