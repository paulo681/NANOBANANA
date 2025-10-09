import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getPublicUrl, uploadToBucket } from '@/lib/storage';
import { runImageGeneration } from '@/lib/replicate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';
const OUTPUT_BUCKET = process.env.SUPABASE_OUTPUT_BUCKET ?? 'output-images';

export async function POST(request: NextRequest) {
  try {
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

    const base64Image = `data:${file.type || 'image/png'};base64,${fileBuffer.toString('base64')}`;

    const outputImageUrl = await runImageGeneration({
      imageBase64: base64Image,
      prompt,
      fallbackImageUrl: inputPublicUrl,
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

    const supabase = getSupabaseAdmin();
    const { error: insertError } = await supabase.from('projects').insert({
      input_image_url: inputPublicUrl,
      output_image_url: outputPublicUrl,
      prompt,
      status: 'completed',
    });

    if (insertError) {
      console.error(insertError);
    }

    return NextResponse.json({ url: outputPublicUrl });
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
