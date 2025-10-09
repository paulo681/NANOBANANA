'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [loading, user, router]);

  if (!loading && user) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-slate-300">
        Redirection vers votre tableau de bord…
      </main>
    );
  }

  return (
    <main className="space-y-16">
      <section className="space-y-8 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-1 text-xs uppercase tracking-[0.35em] text-accent/80">
          NanoBanana Studio
        </span>
        <h1 className="text-4xl font-semibold sm:text-5xl">
          Donne une autre vie à tes images avec l’IA
        </h1>
        <p className="mx-auto max-w-3xl text-base text-slate-300">
          Téléverse une photo, décris la transformation voulue et récupère en quelques secondes une nouvelle version
          stylisée. NanoBanana stocke automatiquement tes créations pour que tu puisses les retrouver depuis ton
          tableau de bord sécurisé.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/signup"
            className="rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-400/50"
          >
            Créer mon compte gratuit
          </Link>
          <Link href="/login" className="text-sm text-slate-200 underline-offset-4 hover:underline">
            Se connecter
          </Link>
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        {[
          {
            title: 'Import facile',
            description: 'Glisse-dépose tes images et récupère un rendu en haute résolution optimisé pour le web.',
          },
          {
            title: 'Stockage Supabase',
            description: 'Supabase garde une trace de chaque génération pour que tu ne perdes jamais tes résultats.',
          },
          {
            title: 'IA flexible',
            description: 'Personnalise le style à l’aide de prompts : illustration néon, peinture à l’huile, affiche minimaliste…',
          },
          {
            title: 'Sécurité intégrée',
            description: 'Ton compte est protégé par mot de passe et seules tes créations te sont accessibles.',
          },
        ].map((feature) => (
          <div key={feature.title} className="rounded-3xl border border-white/5 bg-slate-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">{feature.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{feature.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-white/5 bg-slate-900/40 p-8 text-center">
        <h2 className="text-2xl font-semibold text-white">Commence à transformer tes images dès maintenant</h2>
        <p className="mt-3 text-sm text-slate-300">
          En quelques minutes, configure ton compte et découvre la puissance de NanoBanana Studio pour booster tes visuels.
        </p>
        <Link
          href="/signup"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-semibold text-slate-900 shadow transition hover:opacity-90"
        >
          Je crée un compte
        </Link>
      </section>
    </main>
  );
}
