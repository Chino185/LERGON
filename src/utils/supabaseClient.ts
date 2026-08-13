import { createClient } from '@supabase/supabase-js';

const configuredSupabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || '';
const configuredSupabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '';

export const isSupabaseConfigured = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn('[Supabase Client Notice] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables are missing. Backend operations will remain unavailable until configured.');
}

// Supabase's constructor throws on an empty URL/key, which previously prevented
// React from mounting at all. A valid, non-routable placeholder keeps the UI
// bootable and lets each service return its normal request error until deploy
// configuration is supplied.
const supabaseUrl = configuredSupabaseUrl || 'https://missing-project.supabase.co';
const supabaseAnonKey = configuredSupabaseAnonKey || 'missing-supabase-anon-key';
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