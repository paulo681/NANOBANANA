import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';

import { DashboardClient } from '@/components/DashboardClient';
import type { Database } from '@/lib/supabase-server';

export const metadata: Metadata = {
  title: 'Tableau de bord – NanoBanana',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createServerComponentClient<Database>({ cookies });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
  const generationPriceCents = 200;

  return (
    <DashboardClient
      initialProjects={projects ?? []}
      stripePublishableKey={stripePublishableKey}
      generationPriceCents={generationPriceCents}
    />
  );
}
