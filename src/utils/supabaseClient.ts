import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[Supabase Client Notice] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Safely creates a fresh Realtime channel with the given topic name.
 * If a channel with that name already exists (e.g. from a prior effect
 * mount that hasn't finished cleaning up yet — a common occurrence in
 * React 18 development due to Strict Mode double-invoking effects),
 * remove it first. This prevents "cannot add postgres_changes callbacks
 * ... after subscribe()" errors caused by trying to add listeners to a
 * channel object that's already in a subscribed state.
 */
export function getSafeChannel(name: string) {
  const existing = supabase.getChannels().find((ch) => ch.topic === `realtime:${name}` || ch.topic === name);
  if (existing) {
    supabase.removeChannel(existing);
  }
  return supabase.channel(name);
}