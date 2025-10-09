import type { Metadata } from 'next';

import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = {
  title: 'Inscription – NanoBanana',
};

export default function SignupPage() {
  return (
    <section className="mx-auto mt-10 max-w-2xl space-y-8 text-center">
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold text-white">Crée ton compte</h1>
        <p className="text-sm text-slate-300">
          Rejoins NanoBanana pour transformer tes images et conserver toutes tes créations au même endroit.
        </p>
      </div>
      <AuthForm defaultMode="signup" />
    </section>
  );
}

