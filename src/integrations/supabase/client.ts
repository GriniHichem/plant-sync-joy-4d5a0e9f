import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Support pour la configuration dynamique en self-hosting via window.__APP_CONFIG__
// @ts-ignore
const config = window.__APP_CONFIG__ || {};

const SUPABASE_URL = config.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = config.VITE_SUPABASE_ANON_KEY || config.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Log initialization in production to help debugging self-hosting issues
if (import.meta.env.PROD) {
  console.log("Supabase Client Initializing...", { 
    hasUrl: !!SUPABASE_URL, 
    hasKey: !!SUPABASE_PUBLISHABLE_KEY,
    urlSource: config.VITE_SUPABASE_URL ? 'runtime-config' : 'env'
  });
}

function isNewSupabaseApiKey(value: string): boolean {
  if (!value) return false;
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  global: {
    fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
  },
  auth: {
    storage: typeof window !== 'undefined' ? localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
  }
});
