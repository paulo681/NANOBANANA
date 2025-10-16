'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { useAuth } from '@/context/AuthContext';

export function AppHeader() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await signOut();
      await fetch('/api/auth/signout', { method: 'POST' });
    } catch (error) {
      console.error('Impossible de se déconnecter', error);
    } finally {
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="text-xl font-semibold text-white">
        NanoBanana
      </Link>

      <nav className="flex items-center gap-4 text-sm text-slate-200">
        <Link href="/" className="hover:text-white">
          Accueil
        </Link>
        <Link href="/dashboard" className="hover:text-white">
          Tableau de bord
        </Link>
        {user && (
          <Link href="/billing" className="hover:text-white">
            Facturation
          </Link>
        )}
        {loading ? (
          <span className="text-xs text-slate-400">Chargement…</span>
        ) : user ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-300">{user.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 transition hover:border-white/40 hover:text-white"
            >
              Déconnexion
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-xs text-slate-200 underline-offset-4 hover:underline">
              Connexion
            </Link>
            <Link
              href="/signup"
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-slate-950 shadow hover:opacity-90"
            >
              Inscription
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
