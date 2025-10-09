'use client';

import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';

const samplePrompts = [
  'Transforme cette image en illustration néon futuriste',
  'Ajoute un style peinture à l’huile impressionniste',
  'Convertis-la en affiche minimaliste monochrome',
];

type GenerationState = 'idle' | 'loading' | 'success' | 'error';

export default function HomePage() {
  const [file, setFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHovering, setIsHovering] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    setGeneratedUrl(null);
    setErrorMessage(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsHovering(false);
    const droppedFile = event.dataTransfer.files?.[0];
    if (!droppedFile) return;
    setFile(droppedFile);
    setGeneratedUrl(null);
    setErrorMessage(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file || !prompt.trim()) {
      setErrorMessage('Ajoute une image et un prompt avant de générer.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setGeneratedUrl(null);

    const formData = new FormData();
    formData.append('image', file);
    formData.append('prompt', prompt);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Impossible de générer cette image.');
      }

      const payload = (await response.json()) as { url: string };
      setGeneratedUrl(payload.url);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erreur inattendue. Réessaie.');
    }
  };

  return (
    <main className="space-y-10">
      <header className="space-y-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-900/70 px-4 py-1 text-xs uppercase tracking-[0.35em] text-accent/80">
          NanoBanana Studio
        </span>
        <h1 className="text-4xl font-semibold sm:text-5xl">Éditeur d’images assisté par l’IA</h1>
        <p className="mx-auto max-w-2xl text-base text-slate-300">
          Téléverse une image, écris un prompt créatif et laisse l’intelligence artificielle transformer ton visuel.
          Chaque génération est stockée sur Supabase pour que tu puisses la retrouver plus tard.
        </p>
      </header>

      <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <form
          onSubmit={handleSubmit}
          className="space-y-8 rounded-3xl border border-white/5 bg-slate-900/50 p-8 shadow-soft backdrop-blur"
        >
          <div className="space-y-4">
            <label
              htmlFor="image"
              onDragOver={(event) => {
                event.preventDefault();
                setIsHovering(true);
              }}
              onDragLeave={() => setIsHovering(false)}
              onDrop={handleDrop}
              className={`relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
                isHovering
                  ? 'border-accent bg-accent/10'
                  : 'border-white/20 bg-slate-950/60 hover:border-white/40'
              }`}
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
              <div className="fade-in overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <p className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-400">Aperçu original</p>
                <img
                  src={previewUrl}
                  alt="Prévisualisation de l'upload"
                  className="max-h-72 w-full rounded-xl object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    setGeneratedUrl(null);
                    setErrorMessage(null);
                    inputRef.current?.value && (inputRef.current.value = '');
                  }}
                  className="mt-4 text-xs text-slate-300 underline-offset-4 hover:underline"
                >
                  Retirer cette image
                </button>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label htmlFor="prompt" className="text-sm font-semibold text-white">
                Prompt de transformation
              </label>
              <button
                type="button"
                className="text-xs text-accent underline-offset-4 hover:underline"
                onClick={() => setPrompt(samplePrompts[Math.floor(Math.random() * samplePrompts.length)])}
              >
                Inspire-moi
              </button>
            </div>
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

          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full rounded-2xl bg-gradient-to-r from-primary to-accent px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-indigo-500/30 transition hover:shadow-indigo-400/50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {status === 'loading' ? 'Génération en cours…' : 'Générer'}
          </button>
        </form>

        <aside className="space-y-6 rounded-3xl border border-white/5 bg-slate-900/40 p-8 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-white">Résultat</h2>
            <p className="mt-2 text-sm text-slate-300">
              Une fois la génération terminée, ton image augmentée apparaîtra ci-dessous. Les fichiers sont sauvegardés dans Supabase.
            </p>
          </div>

          <div className="min-h-[320px] rounded-2xl border border-white/10 bg-slate-950/50 p-4">
            {status === 'idle' && (
              <p className="flex h-full items-center justify-center text-sm text-slate-500">
                Lance ta première génération pour voir le résultat ici.
              </p>
            )}
            {status === 'loading' && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-accent">
                <div className="size-10 animate-spin rounded-full border-2 border-accent/40 border-t-accent" />
                <p>Génération de la magie NanoBanana…</p>
              </div>
            )}
            {status === 'error' && errorMessage && (
              <p className="flex h-full items-center justify-center text-center text-sm text-rose-400">
                {errorMessage}
              </p>
            )}
            {status === 'success' && generatedUrl && (
              <figure className="fade-in space-y-4">
                <img
                  src={generatedUrl}
                  alt="Image générée"
                  className="max-h-96 w-full rounded-xl object-contain"
                />
                <a
                  href={generatedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-accent"
                >
                  Télécharger l’image générée ↗
                </a>
              </figure>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-5 text-xs text-slate-400">
            <p className="font-semibold text-slate-300">Bon à savoir</p>
            <ul className="mt-3 space-y-2">
              <li>• Les images originales et générées sont stockées dans les buckets Supabase configurés.</li>
              <li>• Chaque projet est consigné dans la table <span className="font-mono">projects</span> avec le statut « completed ».</li>
              <li>• Mets à jour tes clés dans <span className="font-mono">.env.local</span> avant de lancer le projet.</li>
            </ul>
          </div>
        </aside>
      </section>
    </main>
  );
}
