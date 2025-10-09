import { setTimeout as delay } from 'node:timers/promises';

type ReplicatePrediction = {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string | string[];
  error?: string;
};

const REPLICATE_API_BASE = 'https://api.replicate.com/v1';

function parseImageUrl(output: string | string[] | undefined): string {
  if (!output) {
    throw new Error('La réponse Replicate ne contient pas d’URL d’image.');
  }

  if (typeof output === 'string') {
    return output;
  }

  if (Array.isArray(output) && typeof output[0] === 'string') {
    return output[0];
  }

  throw new Error('Impossible de lire l’URL de l’image générée.');
}

function handleSensitiveError(message: string) {
  if (message.toLowerCase().includes('sensitive')) {
    throw new Error('INPUT_FLAGGED_SENSITIVE');
  }
}

async function createPrediction(
  modelVersion: string,
  input: Record<string, unknown>,
  token: string,
) {
  const response = await fetch(`${REPLICATE_API_BASE}/predictions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${token}`,
    },
    body: JSON.stringify({
      version: modelVersion,
      input,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message =
      typeof payload?.error === 'string'
        ? payload.error
        : typeof payload?.detail === 'string'
          ? payload.detail
          : await response.text();

    handleSensitiveError(message);

    throw new Error(`Échec de la création de la prédiction Replicate: ${message}`);
  }

  return (await response.json()) as ReplicatePrediction;
}

async function pollPrediction(id: string, token: string): Promise<ReplicatePrediction> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = await fetch(`${REPLICATE_API_BASE}/predictions/${id}`, {
      headers: {
        Authorization: `Token ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(`Échec du suivi de la prédiction Replicate: ${message}`);
    }

    const prediction = (await response.json()) as ReplicatePrediction;

    if (prediction.status === 'succeeded') {
      return prediction;
    }

    if (prediction.status === 'failed' || prediction.status === 'canceled') {
      if (prediction.error) {
        handleSensitiveError(prediction.error);
      }
      throw new Error(prediction.error ?? `La prédiction a ${prediction.status}.`);
    }

    await delay(2000);
  }

  throw new Error('La génération Replicate est trop longue.');
}

export async function runImageGeneration({
  imageBase64,
  prompt,
  model,
  fallbackImageUrl,
  outputFormat = 'jpg',
}: {
  imageBase64?: string;
  prompt: string;
  model?: string;
  fallbackImageUrl?: string;
  outputFormat?: string;
}): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new Error('REPLICATE_API_TOKEN est manquant.');
  }

  const modelVersion = model ?? process.env.REPLICATE_MODEL;
  if (!modelVersion) {
    throw new Error('REPLICATE_MODEL est manquant.');
  }

  const inputPayload: Record<string, unknown> = {
    prompt,
    output_format: outputFormat,
  };

  const imageSources: string[] = [];

  if (imageBase64) {
    imageSources.push(imageBase64);
  }

  if (fallbackImageUrl) {
    imageSources.push(fallbackImageUrl);
  }

  if (imageSources.length > 0) {
    inputPayload.image_input = imageSources;
  }

  const prediction = await createPrediction(modelVersion, inputPayload, token);
  const completed = await pollPrediction(prediction.id, token);

  return parseImageUrl(completed.output);
}
