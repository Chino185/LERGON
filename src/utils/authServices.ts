import { supabase } from './supabaseClient';
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

export async function registerUser(
  email: string,
  password: string,
  metadata?: { name?: string; role?: 'admin' | 'attendant'; businessName?: string }
): Promise<{ success: boolean; user?: any; session?: any; error?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const role = metadata?.role || 'admin';
    const displayUsername = metadata?.name || cleanEmail.split('@')[0];
    const businessName = metadata?.businessName || `${displayUsername}'s Shop`;

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: password,
      options: {
        data: {
          display_username: displayUsername,
          role: role,
          business_name: businessName
        }
      }
    });

    if (authError) throw authError;

    const user = authData.user;
    if (!user) {
      return { success: false, error: 'User registration failed.' };
    }

    // Business + profile creation now happens atomically inside the
    // handle_new_user() Postgres trigger — no separate client-side
    // business insert or profile update needed here anymore.

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

export async function markNotificationsAsRead(userUid: string, notifIds: string[]): Promise<boolean> {
  if (!userUid || !notifIds || notifIds.length === 0) return true;
  try {
    const inserts = notifIds.map(notifId => ({
      notification_id: notifId,
      profile_id: userUid,
      read_at: new Date().toISOString()
    }));

    const { error } = await supabase
      .from('notification_reads')
      .upsert(inserts, { onConflict: 'notification_id,profile_id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('markNotificationsAsRead error:', err);
    return false;
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

    // Update profile with photo URL
    await supabase
      .from('profiles')
      .update({ profile_photo_url: publicUrl })
      .eq('id', userUid);

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
  const channel = supabase
    .channel(`activity_logs_${businessId}`)
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