import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import type { Database } from './supabase-server';

type BrowserClient = ReturnType<typeof createClientComponentClient<Database>>;

let browserClient: BrowserClient | null = null;

export function getSupabaseBrowserClient(): BrowserClient {
  if (!browserClient) {
    browserClient = createClientComponentClient<Database>();
  }

  return browserClient;
}
