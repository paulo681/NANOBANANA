export const MODEL_PRICING = {
  'google/nano-banana': {
    label: 'google/nano-banana (2€)',
    amountCents: 200,
  },
  'batouresearch/magic-image-refiner': {
    label: 'batouresearch/magic-image-refiner (3€)',
    amountCents: 300,
  },
  'zsxkib/qwen2-vl': {
    label: 'zsxkib/qwen2-vl (5€)',
    amountCents: 500,
  },
} as const;

export type ModelKey = keyof typeof MODEL_PRICING;

export const CREDIT_PACKS = [
  {
    id: 'pack_10',
    credits: 10,
    amountCents: 1500,
    name: 'Pack 10 générations',
  },
  {
    id: 'pack_25',
    credits: 25,
    amountCents: 3200,
    name: 'Pack 25 générations',
  },
] as const;
