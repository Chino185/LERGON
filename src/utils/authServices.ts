import { supabase, getSafeChannel } from './supabaseClient';
import { fetchLiveExchangeRates, getCachedExchangeRates, getRateForCurrency } from './currencyUtils';
import { LergonUser, ActivityLog } from '../types';

export { supabase };

// --- Auth Functions ---

export async function sendVerificationEmail(email?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const targetEmail = email || (await supabase.auth.getUser()).data.user?.email;
    if (!targetEmail) {
      return { success: false, error: 'No email address specified for verification.' };
    }
    const { error } = await supabase.auth.resend({ type: 'signup', email: targetEmail });
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('sendVerificationEmail Error:', err);
    return { success: false, error: err?.message || 'Failed to send verification email.' };
  }
}

export async function resetPasswordForEmail(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('resetPasswordForEmail Error:', err);
    return { success: false, error: err?.message || 'Failed to send password reset link.' };
  }
}

export async function updatePasswordAfterReset(
  newPassword: string,
  userEmail?: string,
  tempPassword?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. If active user session exists in Supabase Auth, update directly
    const { data: userData } = await supabase.auth.getUser();
    if (userData?.user) {
      const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
      if (!updateErr) return { success: true };
    }

    // 2. If no active session or re-auth needed, and email + temp password are provided
    if (userEmail && tempPassword) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userEmail.trim().toLowerCase(),
        password: tempPassword
      });
      if (!signInError) {
        const { error: updateErr } = await supabase.auth.updateUser({ password: newPassword });
        if (!updateErr) return { success: true };
      }
    }

    // 3. Fallback: try direct updateUser
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      console.warn('Backend password update note:', error.message);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    console.error('updatePasswordAfterReset error:', err);
    return { success: false, error: err?.message || 'Failed to update password in backend.' };
  }
}

export async function registerUser(
  email: string,
  password: string,
  metadata?: { name?: string; role?: 'admin' | 'attendant'; businessName?: string; inviteCode?: string; termsAccepted?: boolean; termsAcceptedAt?: string }
): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const role = metadata?.role || 'admin';
    const displayUsername = metadata && Object.prototype.hasOwnProperty.call(metadata, 'name')
      ? (metadata.name || '')
      : cleanEmail.split('@')[0];
    const businessName = metadata?.businessName || `${displayUsername || cleanEmail.split('@')[0]}'s Shop`;
    const termsAccepted = metadata?.termsAccepted !== false;
    const termsAcceptedAt = metadata?.termsAcceptedAt || new Date().toISOString();

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          display_username: displayUsername,
          role: role,
          business_name: businessName,
          invite_code: metadata?.inviteCode || '',
          terms_accepted: termsAccepted,
          terms_accepted_at: termsAcceptedAt
        }
      }
    });

    if (authError) throw authError;

    const user = authData.user;
    if (!user) {
      return { success: false, error: 'User registration failed.' };
    }

    // Safely register consent timestamp in profiles table
    try {
      await supabase
        .from('profiles')
        .update({
          terms_accepted: termsAccepted,
          terms_accepted_at: termsAcceptedAt
        })
        .eq('id', user.id);
    } catch (profileErr) {
      console.warn('Profile terms update note:', profileErr);
    }

    return { success: true, user: authData.user, session: authData.session };
  } catch (err: any) {
    console.error('registerUser Error:', err);
    return { success: false, error: err?.message || 'Registration failed.' };
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password
    });

    if (error) throw error;

    // Update last_login timestamp
    if (data.user) {
      await supabase
        .from('profiles')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user.id);
    }

    return { success: true, user: data.user, session: data.session };
  } catch (err: any) {
    console.error('loginUser Error:', err);
    return { success: false, error: err?.message || 'Login failed.' };
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (err) {
    console.error('logoutUser error:', err);
  }
}

export async function updateUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return { success: false, error: 'No active user session found.' };
    }

    // Verify current password by signing in
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (reauthError) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    // Update password
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw updateError;

    return { success: true };
  } catch (err: any) {
    console.error('updateUserPassword Error:', err);
    return { success: false, error: err?.message || 'Failed to update password.' };
  }
}

export async function joinAttendantWithInviteCode(
  inviteCode: string,
  username: string
): Promise<{ success: boolean; businessId?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return { success: false, error: 'User must be authenticated before joining with an invite code.' };
    }

    const { data, error } = await supabase.rpc('join_attendant_with_invite_code', {
      p_invite_code: inviteCode.trim(),
      p_user_id: user.id,
      p_email: user.email,
      p_display_username: username.trim()
    });

    if (error) throw error;
    return { success: true, businessId: data };
  } catch (err: any) {
    console.error('joinAttendantWithInviteCode Error:', err);
    return { success: false, error: err?.message || 'Failed to join business with invite code.' };
  }
}

export async function markNotificationsAsRead(userUid: string, notifIds: string[], businessId?: string): Promise<boolean> {
  if (!userUid || !businessId || !notifIds || notifIds.length === 0) return true;
  try {
    const inserts = notifIds.map(notificationKey => ({
      business_id: businessId,
      profile_id: userUid,
      notification_key: notificationKey,
      read_at: new Date().toISOString()
    }));
    const { error } = await supabase
      .from('notification_read_keys')
      .upsert(inserts, { onConflict: 'business_id,profile_id,notification_key' });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('markNotificationsAsRead error:', err);
    return false;
  }
}

export async function loadNotificationReadIds(userUid: string, businessId: string): Promise<string[]> {
  if (!userUid || !businessId) return [];
  try {
    const { data, error } = await supabase
      .from('notification_read_keys')
      .select('notification_key')
      .eq('profile_id', userUid)
      .eq('business_id', businessId);
    if (error) throw error;
    return (data || []).map(row => row.notification_key);
  } catch (err) {
    console.error('loadNotificationReadIds error:', err);
    return [];
  }
}

export async function uploadProfilePhoto(
  userUid: string,
  businessId: string,
  file: File
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${businessId}/${userUid}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(filePath);

    // Persist and verify the profile URL. Previously an RLS/update error was
    // ignored, so the UI could report success while profile_photo_url stayed
    // NULL in Supabase.
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .update({ profile_photo_url: publicUrl })
      .eq('id', userUid)
      .select('id, profile_photo_url')
      .single();

    if (profileError) throw profileError;
    if (!profileData || profileData.id !== userUid || profileData.profile_photo_url !== publicUrl) {
      throw new Error('The authenticated profile photo URL was not saved.');
    }

    return { success: true, url: publicUrl };
  } catch (err: any) {
    console.error('uploadProfilePhoto Error:', err);
    return { success: false, error: err?.message || 'Failed to upload profile photo.' };
  }
}

export function subscribeToActivityLogs(
  businessId: string,
  onUpdate: (logs: ActivityLog[]) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  // Fetch initial logs
  supabase
    .from('activity_logs')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)
    .then(({ data, error }) => {
      if (!error && data) {
        onUpdate(data.map(d => ({
          id: d.id,
          action: d.action,
          details: d.details,
          performedBy: d.performed_by || 'System',
          timestamp: d.created_at
        })));
      }
    });

  // Subscribe to Realtime inserts
  const channel = getSafeChannel(`activity_logs_${businessId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_logs', filter: `business_id=eq.${businessId}` },
      () => {
        // Refetch logs on new insert
        supabase
          .from('activity_logs')
          .select('*')
          .eq('business_id', businessId)
          .order('created_at', { ascending: false })
          .limit(50)
          .then(({ data, error }) => {
            if (!error && data) {
              onUpdate(data.map(d => ({
                id: d.id,
                action: d.action,
                details: d.details,
                performedBy: d.performed_by || 'System',
                timestamp: d.created_at
              })));
            }
          });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function logActivity(
  businessId: string,
  action: string,
  details: string,
  performedByUid?: string,
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<boolean> {
  if (!businessId) return false;
  try {
    const { error } = await supabase.from('activity_logs').insert({
      business_id: businessId,
      action: action,
      details: details,
      performed_by: performedByUid || null,
      source: source
    });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('logActivity error:', err);
    return false;
  }
}

/**
 * Persist the business's base currency to Supabase so it's shared
 * across all devices/sessions for the organization, not just the
 * browser that changed it. Only Admins (role 2) may update it, since
 * this is an org-wide setting that all stored USD amounts are
 * converted from.
 */
export async function updateBusinessCurrency(
  businessId: string,
  userRole: number | string | undefined,
  currencyCode: string,
  currencySymbol: string,
  country?: string,
  businessName?: string
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Only Administrators can change the business currency.' };
  }

  if (!businessId) {
    return { success: false, error: 'Business ID is required.' };
  }

  try {
    const { error } = await supabase
      .from('businesses')
      .update({
        base_currency_code: currencyCode,
        base_currency_symbol: currencySymbol,
        ...(country ? { base_country: country } : {}),
        ...(businessName ? { trade_name: businessName } : {})
      })
      .eq('id', businessId);

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('updateBusinessCurrency Error:', err);
    return { success: false, error: err?.message || 'Failed to update business currency.' };
  }
}

/**
 * Convert persisted monetary values exactly once when an administrator
 * changes the business currency. Ordinary reads and edits never convert.
 */
export async function migrateBusinessCurrencyAmounts(
  businessId: string,
  userRole: number | string | undefined,
  fromCurrency: string,
  toCurrency: string
): Promise<{ success: boolean; factor?: number; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) return { success: false, error: 'Unauthorized currency migration.' };
  if (!businessId || !fromCurrency || !toCurrency || fromCurrency === toCurrency) return { success: true, factor: 1 };

  try {
    const rateData = await fetchLiveExchangeRates();
    const rates = rateData?.rates || getCachedExchangeRates().rates;
    const fromRate = getRateForCurrency(rates, fromCurrency);
    const toRate = getRateForCurrency(rates, toCurrency);
    const factor = toRate / fromRate;
    if (!Number.isFinite(factor) || factor <= 0) throw new Error('No valid exchange rate is available for this currency change.');
    const money = (value: unknown) => {
      const amount = Number(value);
      return Number.isFinite(amount) ? Number((amount * factor).toFixed(6)) : value;
    };

    const { data: inventoryRows, error: inventoryError } = await supabase.from('inventory_items')
      .select('id, cost_price, selling_price').eq('business_id', businessId);
    if (inventoryError) throw inventoryError;
    for (const row of inventoryRows || []) {
      const { error } = await supabase.from('inventory_items').update({
        cost_price: money(row.cost_price), selling_price: money(row.selling_price)
      }).eq('id', row.id).eq('business_id', businessId);
      if (error) throw error;
    }

    const { data: creditRows, error: creditError } = await supabase.from('credit_profiles')
      .select('id, initial_amount, remaining_balance').eq('business_id', businessId);
    if (creditError) throw creditError;
    for (const row of creditRows || []) {
      const { error } = await supabase.from('credit_profiles').update({
        initial_amount: money(row.initial_amount), remaining_balance: money(row.remaining_balance)
      }).eq('id', row.id).eq('business_id', businessId);
      if (error) throw error;
    }

    const { data: transactionRows, error: transactionError } = await supabase.from('transactions')
      .select('id, total_amount, original_total_amount, items').eq('business_id', businessId);
    if (transactionError) throw transactionError;
    const moneyKeys = new Set(['unit_price', 'unit_cost', 'selling_price', 'cost_price', 'amount', 'total_amount', 'remaining_amount', 'original_amount']);
    const scaleItems = (items: unknown) => Array.isArray(items) ? items.map(item => {
      if (!item || typeof item !== 'object') return item;
      return Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([key, value]) => [key, moneyKeys.has(key) ? money(value) : value]));
    }) : items;
    for (const row of transactionRows || []) {
      const { error } = await supabase.from('transactions').update({
        total_amount: money(row.total_amount),
        original_total_amount: row.original_total_amount == null ? row.original_total_amount : money(row.original_total_amount),
        items: scaleItems(row.items)
      }).eq('id', row.id).eq('business_id', businessId);
      if (error) throw error;
    }
    return { success: true, factor };
  } catch (err: any) {
    console.error('migrateBusinessCurrencyAmounts Error:', err);
    return { success: false, error: err?.message || 'Failed to convert stored business amounts.' };
  }
}

/**
 * Subscribe to Realtime changes on the business's base currency so that
 * every logged-in device (Admin or Attendant) picks up a currency change
 * immediately, instead of only on next login/refresh. Fires once
 * immediately with the current value, then again on every future update.
 */
export function subscribeToBusinessCurrency(
  businessId: string,
  onUpdate: (currency: { businessName?: string; currencyCode: string; currencySymbol: string; country?: string }) => void
): () => void {
  if (!businessId) {
    return () => { };
  }

  const fetchCurrency = () => {
    supabase
      .from('businesses')
      .select('trade_name, base_country, base_currency_code, base_currency_symbol')
      .eq('id', businessId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        onUpdate({
          businessName: data.trade_name,
          country: data.base_country,
          currencyCode: data.base_currency_code,
          currencySymbol: data.base_currency_symbol
        });
      });
  };

  fetchCurrency();

  const channel = getSafeChannel(`business_currency_${businessId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'businesses', filter: `id=eq.${businessId}` },
      () => fetchCurrency()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
/**
 * Persists the current user's own contact phone number on their profiles
 * row. Unlike currency (org-wide, Admin-only), this is a personal field --
 * both Admin and Attendant can update their own number, mirroring the RLS
 * policy which already only allows a user to update their own row.
 */
export async function updateUserPhone(
  userUid: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!userUid) {
    return { success: false, error: 'User ID is required.' };
  }

  try {
    const cleanPhone = String(phone || '').trim().slice(0, 50);
    const { data, error } = await supabase
      .from('profiles')
      .update({ phone: cleanPhone || null })
      .eq('id', userUid)
      .select('id, phone')
      .single();

    if (error) throw error;
    if (!data || data.id !== userUid) {
      return { success: false, error: 'The authenticated profile was not updated.' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('updateUserPhone Error:', err);
    return { success: false, error: err?.message || 'Failed to update contact number.' };
  }
}

/**
 * Clear a user's profile photo in the profiles table. Each user owns only
 * their own profile_photo_url row (enforced by the "Users can update own
 * profile" RLS policy), so this can only ever clear the caller's own
 * photo -- never a colleague's.
 */
export async function clearProfilePhoto(
  userUid: string,
  currentPhotoUrl?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Clear the profile row first. This is the source of truth used during
    // refresh; Storage cleanup must not prevent the URL from being cleared.
    const { data, error } = await supabase
      .from('profiles')
      .update({ profile_photo_url: null })
      .eq('id', userUid)
      .select('id, profile_photo_url')
      .single();

    if (error) throw error;
    if (!data || data.id !== userUid || data.profile_photo_url !== null) {
      throw new Error('The authenticated profile photo was not cleared.');
    }

    // Remove the object from Storage when the current value is a Supabase
    // public URL. Data-URL previews are local-only. A Storage cleanup failure
    // is logged but does not restore the deleted database URL.
    const marker = currentPhotoUrl?.includes('/storage/v1/object/public/profile-photos/')
      ? '/storage/v1/object/public/profile-photos/'
      : '/profile-photos/';
    if (currentPhotoUrl?.includes(marker)) {
      const rawPath = currentPhotoUrl.split(marker)[1]?.split('?')[0] || '';
      const filePath = decodeURIComponent(rawPath);
      if (filePath) {
        const { error: storageError } = await supabase.storage
          .from('profile-photos')
          .remove([filePath]);
        if (storageError) console.warn('Profile photo database URL cleared, but Storage cleanup failed:', storageError);
      }
    }
    return { success: true };
  } catch (err: any) {
    console.error('clearProfilePhoto Error:', err);
    return { success: false, error: err?.message || 'Failed to remove profile photo.' };
  }
}


export function subscribeToActiveAttendantInvite(
  businessId: string,
  onUpdate: (invite: { code: string; createdAt: number; expiresAt: number; isUsed: boolean } | null) => void
): () => void {
  if (!businessId) {
    onUpdate(null);
    return () => { };
  }

  const fetchActiveInvite = async () => {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('code, created_at, expires_at, used')
      .eq('business_id', businessId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      if (error) console.warn('Could not load active attendant invite:', error.message);
      onUpdate(null);
      return;
    }

    onUpdate({
      code: data.code,
      createdAt: new Date(data.created_at).getTime(),
      expiresAt: new Date(data.expires_at).getTime(),
      isUsed: Boolean(data.used)
    });
  };

  void fetchActiveInvite();

  const refreshWhenVisible = () => {
    if (document.visibilityState === 'visible') {
      void fetchActiveInvite();
    }
  };
  window.addEventListener('focus', refreshWhenVisible);
  document.addEventListener('visibilitychange', refreshWhenVisible);

  const channel = supabase
    .channel(`invite_codes_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'invite_codes', filter: `business_id=eq.${businessId}` },
      () => { void fetchActiveInvite(); }
    )
    .subscribe();

  return () => {
    window.removeEventListener('focus', refreshWhenVisible);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    supabase.removeChannel(channel);
  };
}
export async function validateAttendantInvite(
  inviteCode: string
): Promise<{ success: boolean; businessId?: string; businessName?: string; expiresAt?: string; error?: string }> {
  if (!inviteCode?.trim()) return { success: false, error: 'Invite code is required.' };
  try {
    const { data, error } = await supabase.rpc('validate_attendant_invite', {
      p_invite_code: inviteCode.trim()
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return { success: false, error: 'Invalid or expired invite PIN.' };
    return { success: true, businessId: row.business_id, businessName: row.business_name, expiresAt: row.expires_at };
  } catch (err: any) {
    console.error('validateAttendantInvite Error:', err);
    return { success: false, error: err?.message || 'Unable to validate invite code.' };
  }
}


/** Persist the authenticated user's operator name. */
export async function updateUserDisplayName(
  userUid: string,
  displayUsername: string
): Promise<{ success: boolean; error?: string }> {
  if (!userUid) return { success: false, error: 'User ID is required.' };
  try {
    const cleanName = String(displayUsername || '').trim().slice(0, 120);
    const { data, error } = await supabase
      .from('profiles')
      .update({ display_username: cleanName || null })
      .eq('id', userUid)
      .select('id, display_username')
      .single();
    if (error) throw error;
    if (!data || data.id !== userUid || (data.display_username || '') !== cleanName) {
      return { success: false, error: 'The authenticated profile name was not updated.' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('updateUserDisplayName Error:', err);
    return { success: false, error: err?.message || 'Failed to update operator name.' };
  }
}

/** Persist the authenticated user's personal theme preference. */
export async function updateUserTheme(
  userUid: string,
  theme: 'light' | 'dark'
): Promise<{ success: boolean; error?: string }> {
  if (!userUid) return { success: false, error: 'User ID is required.' };
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update({ theme_preference: theme })
      .eq('id', userUid)
      .select('id, theme_preference')
      .single();
    if (error) throw error;
    if (!data || data.id !== userUid || data.theme_preference !== theme) {
      return { success: false, error: 'The authenticated profile theme was not updated.' };
    }
    return { success: true };
  } catch (err: any) {
    console.error('updateUserTheme Error:', err);
    return { success: false, error: err?.message || 'Failed to update theme preference.' };
  }
}
