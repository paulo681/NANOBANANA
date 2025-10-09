import { getSupabaseAdmin } from './supabase-server';

const ensuredBuckets = new Set<string>();

async function ensureBucketExists(bucket: string) {
  if (ensuredBuckets.has(bucket)) {
    return;
  }

  const supabase = getSupabaseAdmin();
  const { data: existingBucket } = await supabase.storage.getBucket(bucket);

  if (!existingBucket) {
    const { error: createError } = await supabase.storage.createBucket(bucket, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
    });

    if (createError && !createError.message.includes('already exists')) {
      throw new Error(`Impossible de créer le bucket ${bucket}: ${createError.message}`);
    }
  }

  ensuredBuckets.add(bucket);
}

export async function uploadToBucket(
  bucket: string,
  path: string,
  data: Buffer,
  contentType: string,
): Promise<string> {
  const supabase = getSupabaseAdmin();
  await ensureBucketExists(bucket);

  const { error } = await supabase.storage.from(bucket).upload(path, data, {
    contentType,
    cacheControl: '3600',
    upsert: false,
  });

  if (error) {
    throw new Error(`Failed to upload file to ${bucket}: ${error.message}`);
  }

  return path;
}

export async function getPublicUrl(bucket: string, path: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  await ensureBucketExists(bucket);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error(`Unable to resolve public URL for ${bucket}/${path}`);
  }
  return data.publicUrl;
}

export async function deleteFromBucket(bucket: string, path: string): Promise<void> {
  const supabase = getSupabaseAdmin();
  await ensureBucketExists(bucket);

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) {
    throw new Error(`Failed to delete file from ${bucket}: ${error.message}`);
  }
}

export function resolvePathFromPublicUrl(bucket: string, publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;

  try {
    const url = new URL(publicUrl);
    const segments = url.pathname.split('/');
    const bucketIndex = segments.findIndex((segment) => segment === bucket);

    if (bucketIndex === -1) {
      return null;
    }

    const path = segments.slice(bucketIndex + 1).join('/');
    return decodeURIComponent(path);
  } catch (error) {
    console.error('Failed to resolve storage path from URL', error);
    return null;
  }
}
