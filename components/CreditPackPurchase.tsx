'use client';

import { useState } from 'react';

type Pack = {
  id: string;
  name: string;
  credits: number;
  amountCents: number;
};

type Props = {
  packs: ReadonlyArray<Pack>;
};

export function CreditPackPurchase({ packs }: Props) {
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePurchase = async (packId: string) => {
    setLoadingPack(packId);
    setError(null);

    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Impossible de créer le paiement des crédits.');
      }

      const payload = (await response.json()) as { url: string };

      if (!payload.url) {
        throw new Error('URL de paiement introuvable.');
      }

      window.location.href = payload.url;
    } catch (purchaseError) {
      setError(purchaseError instanceof Error ? purchaseError.message : 'Erreur inattendue.');
    } finally {
      setLoadingPack(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white">Acheter des crédits</h2>
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {packs.map((pack) => (
          <div key={pack.id} className="space-y-3 rounded-2xl border border-white/5 bg-slate-900/50 p-5">
            <p className="text-sm font-semibold text-white">{pack.name}</p>
            <p className="text-xs text-slate-300">{pack.credits} crédits</p>
            <button
              type="button"
              onClick={() => handlePurchase(pack.id)}
              disabled={loadingPack === pack.id}
              className="w-full rounded-xl bg-accent px-4 py-2 text-xs font-semibold text-slate-900 shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingPack === pack.id ? 'Redirection…' : `${(pack.amountCents / 100).toFixed(2)}€`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
