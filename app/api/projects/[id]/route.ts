import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import type { Database } from '@/lib/supabase-server';
import { deleteFromBucket, resolvePathFromPublicUrl } from '@/lib/storage';

const INPUT_BUCKET = process.env.SUPABASE_INPUT_BUCKET ?? 'input-images';
const OUTPUT_BUCKET = process.env.SUPABASE_OUTPUT_BUCKET ?? 'output-images';

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createRouteHandlerClient<Database>({ cookies });
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
    }

    const projectId = params.id;

    const { data, error: fetchError } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .eq('user_id', session.user.id)
      .single();

    const project = data as Database['public']['Tables']['projects']['Row'] | null;

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 });
      }
      throw fetchError;
    }

    if (!project) {
      return NextResponse.json({ error: 'Projet introuvable.' }, { status: 404 });
    }

    const storageDeletes: Array<Promise<void>> = [];
    const inputPath = resolvePathFromPublicUrl(INPUT_BUCKET, project.input_image_url);
    const outputPath = resolvePathFromPublicUrl(OUTPUT_BUCKET, project.output_image_url);

    if (inputPath) {
      storageDeletes.push(
        deleteFromBucket(INPUT_BUCKET, inputPath).catch((error) => {
          console.error('Unable to delete input image', error);
        }),
      );
    }

    if (outputPath) {
      storageDeletes.push(
        deleteFromBucket(OUTPUT_BUCKET, outputPath).catch((error) => {
          console.error('Unable to delete output image', error);
        }),
      );
    }

    await Promise.all(storageDeletes);

    const { error: deleteError } = await supabase.from('projects').delete().eq('id', projectId).eq('user_id', session.user.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Suppression impossible.',
      },
      { status: 500 },
    );
  }
}
