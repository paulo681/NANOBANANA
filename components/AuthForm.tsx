'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

type AuthMode = 'login' | 'signup';

export function AuthForm({ defaultMode = 'login' }: { defaultMode?: AuthMode }) {
  const router = useRouter();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email.trim()) {
      setError('Renseigne ton adresse e-mail.');
      return;
    }

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        router.push('/dashboard');
      } else {
        const session = await signUp(email, password);

        if (session) {
          router.push('/dashboard');
          return;
        }

        setSuccessMessage(
          'Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi avec tes identifiants.',
        );
        setMode('login');
        setPassword('');
      }
    } catch (authError) {
      const message = authError instanceof Error ? authError.message : 'Impossible de finaliser la requête.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-white/5 bg-slate-900/60 p-8 shadow-lg shadow-black/40">
      <div className="mb-6 flex rounded-full border border-white/10 bg-slate-950/70 p-1 text-xs font-medium text-slate-400">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            mode === 'login' ? 'bg-accent text-slate-900 shadow' : 'hover:text-white'
          }`}
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setError(null);
            setSuccessMessage(null);
          }}
          className={`flex-1 rounded-full px-4 py-2 transition ${
            mode === 'signup' ? 'bg-accent text-slate-900 shadow' : 'hover:text-white'
          }`}
        >
          Inscription
        </button>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-semibold text-slate-200">
            Adresse e-mail
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-accent"
            placeholder="ton.email@example.com"
            required
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-semibold text-slate-200">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white focus:border-accent"
            placeholder="Au moins 6 caractères"
            required
          />
        </div>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        {successMessage && <p className="text-sm text-emerald-400">{successMessage}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-slate-900 shadow transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'En cours…' : mode === 'login' ? 'Se connecter' : "Créer mon compte"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        {mode === 'login' ? (
          <>
            Pas encore inscrit ?{' '}
            <Link href="/signup" className="text-accent underline-offset-4 hover:underline">
              Créer un compte
            </Link>
          </>
        ) : (
          <>
            Déjà un compte ?{' '}
            <Link href="/login" className="text-accent underline-offset-4 hover:underline">
              Se connecter
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
