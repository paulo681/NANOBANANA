'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

import { MODEL_PRICING, type ModelKey } from '@/lib/pricing';
import type { Database } from '@/lib/supabase-server';

type Project = Database['public']['Tables']['projects']['Row'];

type DashboardClientProps = {
  initialProjects: Project[];
  hadCheckoutSession?: boolean;
  initialCredits: number;
};

export function DashboardClient({ initialProjects, hadCheckoutSession = false, initialCredits }: DashboardClientProps) {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [modelKey, setModelKey] = useState<ModelKey>('google/nano-banana');
  const [useCredits, setUseCredits] = useState(initialCredits > 0);
  const [credits, setCredits] = useState(initialCredits);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [generatingProjectId, setGeneratingProjectId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();

  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setCredits(initialCredits);
    if (initialCredits === 0) {
      setUseCredits(false);
    }
  }, [initialCredits]);

  useEffect(() => {
    if (hadCheckoutSession) {
      router.replace('/dashboard');
    }
  }, [hadCheckoutSession, router]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const selectedModel = MODEL_PRICING[modelKey];

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    setErrorMessage(null);
    setStatus('idle');
  };

  const resetForm = () => {
    setFile(null);
    setPrompt('');
    setStatus('idle');
    setErrorMessage(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file || !prompt.trim()) {
      setErrorMessage('Ajoute une image et un prompt avant de générer.');
      return;
    }

    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('image', file);
    formData.append('modelKey', modelKey);

    setStatus('loading');
    setErrorMessage(null);

    try {
      if (useCredits && credits > 0) {
        const response = await fetch('/api/projects/create-with-credit', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Impossible de créer le projet avec crédits.');
        }

        const payload = (await response.json()) as { project: Project; creditsRemaining: number };

        setCredits(payload.creditsRemaining);
        setProjects((current) => [payload.project, ...current]);
        resetForm();
        setStatus('success');
      } else {
        const response = await fetch('/api/create-checkout-session', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          if (response.status === 401) {
            window.location.href = '/login';
            return;
          }
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.error ?? 'Impossible de créer la session de paiement.');
        }

        const payload = (await response.json()) as { url: string };

        if (!payload.url) {
          throw new Error('URL de redirection Stripe manquante.');
        }

        window.location.href = payload.url;
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erreur inattendue. Réessaie.');
    }
  };

  const handleLaunchGeneration = async (projectId: string) => {
    setGeneratingProjectId(projectId);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          window.location.href = '/login';
          return;
        }
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Impossible de lancer la génération.');
      }

      const payload = (await response.json()) as { project: Project };
      setProjects((current) => current.map((project) => (project.id === projectId ? payload.project : project)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Erreur inattendue. Réessaie.');
    } finally {
      setGeneratingProjectId(null);
    }
  };

  const handleDelete = async (projectId: string) => {
    const previousProjects = [...projects];
    setProjects((current) => current.filter((project) => project.id !== projectId));

    const response = await fetch(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 401) {
        window.location.href = '/login';
        return;
      }
      const payload = await response.json().catch(() => ({}));
      const message = payload.error ?? 'Suppression impossible.';
      setErrorMessage(message);
      setProjects(previousProjects);
    }
  };

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-white">Créer un nouveau projet</h1>
          <p className="text-sm text-slate-300">
            Crédits restants&nbsp;:
            <span className="ml-2 font-semibold text-white">{credits}</span>
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-3xl border border-white/5 bg-slate-900/50 p-8 shadow-soft backdrop-blur">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="model" className="text-sm font-semibold text-white">
                Modèle IA
              </label>
              <select
                id="model"
                value={modelKey}
                onChange={(event) => setModelKey(event.target.value as ModelKey)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white focus:border-accent"
              >
                {Object.entries(MODEL_PRICING).map(([key, pricing]) => (
                  <option key={key} value={key}>
                    {pricing.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <span className="text-sm font-semibold text-white">Méthode de paiement</span>
              <div className="flex flex-col gap-2 text-sm text-slate-200">
                <label className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${useCredits ? 'border-accent bg-accent/10' : 'border-white/10 bg-slate-950/40'}`}>
                  <input
                    type="radio"
                    name="payment-mode"
                    value="credits"
                    checked={useCredits && credits > 0}
                    onChange={() => credits > 0 && setUseCredits(true)}
                    disabled={credits <= 0}
                  />
                  Utiliser 1 crédit
                  {credits <= 0 && <span className="text-xs text-slate-400">(crédits épuisés)</span>}
                </label>
                <label className={`flex items-center gap-2 rounded-xl border px-4 py-3 ${!useCredits ? 'border-accent bg-accent/10' : 'border-white/10 bg-slate-950/40'}`}>
                  <input
                    type="radio"
                    name="payment-mode"
                    value="checkout"
                    checked={!useCredits}
                    onChange={() => setUseCredits(false)}
                  />
                  Paiement unique – {(selectedModel.amountCents / 100).toFixed(2)}€
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label
              htmlFor="image"
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-white/20 bg-slate-950/60 p-10 text-center transition hover:border-white/40"
            >
              <input
                ref={inputRef}
                id="image"
                name="image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="flex size-16 items-center justify-center rounded-full bg-white/5">
                <span className="text-3xl">📁</span>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">Glisse ton image ici ou clique pour parcourir</p>
                <p className="text-xs text-slate-400">Formats acceptés : JPG, PNG, WebP, max 10&nbsp;Mo</p>
              </div>
            </label>

            {previewUrl && (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Aperçu</p>
                <img src={previewUrl} alt="Prévisualisation" className="max-h-72 w-full rounded-xl object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                  }}
                  className="mt-4 text-xs text-slate-300 underline-offset-4 hover:underline"
                >
                  Retirer cette image
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="prompt" className="text-sm font-semibold text-white">
              Prompt de transformation
            </label>
            <textarea
              id="prompt"
              name="prompt"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Décris la transformation souhaitée..."
              className="min-h-[140px] w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white shadow-inner shadow-black/40 focus:border-accent/60"
            />
          </div>

          {errorMessage && <p className="text-sm text-rose-400">{errorMessage}</p>}
          {status === 'success' && !errorMessage && (
            <p className="text-sm text-emerald-400">Projet créé avec succès.</p>
          )}

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'loading'
              ? useCredits
                ? 'Utilisation des crédits…'
                : 'Redirection vers Stripe…'
              : useCredits
              ? 'Générer avec 1 crédit'
              : `Générer (${(selectedModel.amountCents / 100).toFixed(2)}€)`}
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <header>
          <h2 className="text-2xl font-semibold text-white">Mes projets</h2>
          <p className="text-sm text-slate-400">Historique des images générées avec NanoBanana.</p>
        </header>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-white/5 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
            Aucune génération pour le moment. Lance un premier projet juste au-dessus !
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article key={project.id} className="space-y-3 rounded-3xl border border-white/5 bg-slate-900/40 p-5">
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Prompt</p>
                  <p className="text-sm text-slate-200">{project.prompt}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <span>Statut&nbsp;: {project.status}</span>
                  <span>Paiement&nbsp;: {project.payment_status ?? 'inconnu'}</span>
                  {project.model_key && <span>Modèle&nbsp;: {project.model_key}</span>}
                </div>

                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Résultat</p>
                  <img
                    src={project.output_image_url ?? ''}
                    alt="Image générée"
                    className="aspect-square w-full rounded-2xl object-cover"
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>{new Date(project.created_at).toLocaleString()}</span>
                  <div className="flex items-center gap-3">
                    {project.payment_status === 'paid' && project.status !== 'completed' && (
                      <button
                        type="button"
                        onClick={() => handleLaunchGeneration(project.id)}
                        disabled={generatingProjectId === project.id}
                        className="rounded-full bg-accent px-3 py-1 text-[11px] font-semibold text-slate-900 shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {generatingProjectId === project.id ? 'Génération…' : 'Lancer la génération'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(project.id)}
                      className="text-rose-300 underline-offset-4 hover:underline"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
