import { supabase, getSafeChannel, isSupabaseConfigured } from './supabaseClient';
import { CreditAccount } from '../types';
import { sanitizeTextInput } from './securityValidation';

const inferReceiptName = (storedValue: string) => {
  const lastSegment = storedValue.split('/').pop() || 'credit-receipt';
  return decodeURIComponent(lastSegment).replace(/^\d+-/, '') || 'credit-receipt';
};

const inferReceiptType = (storedValue: string) => {
  const extension = storedValue.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
};

const resolveReceiptDataUrl = async (storedValue: string) => {
  if (!storedValue || /^https?:\/\//i.test(storedValue)) return storedValue;

  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storedValue, 60 * 60);

  return error || !data?.signedUrl ? storedValue : data.signedUrl;
};

export function subscribeToCreditProfiles(
  businessId: string,
  onUpdate: (accounts: CreditAccount[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchAccounts = async () => {
    const { data, error } = await supabase
      .from('credit_profiles')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      if (onError) onError(error);
      return;
    }

    if (data) {
      const accounts: CreditAccount[] = await Promise.all(data.map(async d => {
        const storedReceipt = typeof d.receipt_url === 'string' ? d.receipt_url : '';
        const receiptDataUrl = storedReceipt ? await resolveReceiptDataUrl(storedReceipt) : '';

        return {
          id: d.id,
          name: d.contact_name || '',
          type: d.type === 'customer_receivable' ? 'receivable' : 'payable',
          phone: d.contact_phone || '',
          email: d.contact_email || '',
          totalAmount: Number(d.initial_amount) || 0,
          remainingAmount: Number(d.remaining_balance) || 0,
          dueDate: d.due_date || new Date().toISOString().split('T')[0],
          status: d.status || 'active',
          notes: d.notes || '',
          lastUpdated: d.last_payment_at || d.created_at || new Date().toISOString(),
          paymentDate: d.last_payment_at || undefined,
          dateOfCrediting: d.created_at ? d.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
          ...(storedReceipt ? {
            receipt: {
              name: inferReceiptName(storedReceipt),
              dataUrl: receiptDataUrl,
              type: inferReceiptType(storedReceipt)
            }
          } : {})
        };
      }));
      onUpdate(accounts);
    }
  };

  fetchAccounts();

  const channel = getSafeChannel(`credit_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'credit_profiles', filter: `business_id=eq.${businessId}` },
      () => fetchAccounts()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function saveCreditProfile(
  businessId: string,
  userUid: string,
  payload: {
    name: string;
    type: 'receivable' | 'payable';
    phone?: string;
    email?: string;
    totalAmount: number;
    dueDate: string;
    notes?: string;
    receiptFile?: File;
  },
  existingId?: string | null
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId) return { success: false, error: 'Business ID is required.' };

  const cleanName = sanitizeTextInput(payload.name, 200);
  const cleanPhone = sanitizeTextInput(payload.phone || '', 50);
  const cleanEmail = sanitizeTextInput(payload.email || '', 150);
  const cleanNotes = sanitizeTextInput(payload.notes || '', 1000);
  const requestedDueDate = String(payload.dueDate || '').trim();
  const cleanDueDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDueDate)
    ? requestedDueDate
    : new Date().toISOString().slice(0, 10);
  const dbType = payload.type === 'receivable' ? 'customer_receivable' : 'supplier_payable';

  if (!cleanName) return { success: false, error: 'Contact name is required.' };
  if (payload.totalAmount < 0) return { success: false, error: 'Credit amount cannot be negative.' };

  let uploadedReceiptPath = '';

  try {
    if (payload.receiptFile) {
      const originalName = payload.receiptFile.name || 'credit-receipt';
      const fileExt = originalName.includes('.') ? originalName.split('.').pop() : 'bin';
      const safeBaseName = originalName
        .replace(/\.[^/.]+$/, '')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .slice(0, 80) || 'credit-receipt';
      uploadedReceiptPath = `${businessId}/credit-profiles/${Date.now()}-${safeBaseName}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(uploadedReceiptPath, payload.receiptFile, {
          upsert: false,
          contentType: payload.receiptFile.type || undefined,
          cacheControl: '3600'
        });

      if (uploadErr) throw uploadErr;
    }

    if (existingId) {
      const updateData: any = {
        contact_name: cleanName,
        type: dbType,
        contact_phone: cleanPhone,
        contact_email: cleanEmail,
        initial_amount: payload.totalAmount,
        due_date: cleanDueDate,
        notes: cleanNotes
      };
      if (uploadedReceiptPath) updateData.receipt_url = uploadedReceiptPath;

      const { error } = await supabase
        .from('credit_profiles')
        .update(updateData)
        .eq('id', existingId)
        .eq('business_id', businessId);

      if (error) throw error;
      return { success: true, id: existingId };
    } else {
      const { data, error } = await supabase.rpc('record_credit', {
        p_business_id: businessId,
        p_type: dbType,
        p_contact_name: cleanName,
        p_contact_phone: cleanPhone,
        p_contact_email: cleanEmail,
        p_amount: payload.totalAmount,
        p_due_date: cleanDueDate,
        p_notes: cleanNotes,
        p_performed_by: userUid,
        p_source: 'manual'
      });

      if (error) throw error;

      if (uploadedReceiptPath) {
        const { error: receiptLinkError } = await supabase
          .from('credit_profiles')
          .update({ receipt_url: uploadedReceiptPath })
          .eq('id', data)
          .eq('business_id', businessId);
        if (receiptLinkError) throw receiptLinkError;
      }

      return { success: true, id: data };
    }
  } catch (err: any) {
    console.error('saveCreditProfile Error:', err);
    if (uploadedReceiptPath) {
      await supabase.storage.from('receipts').remove([uploadedReceiptPath]).catch(() => undefined);
    }
    return { success: false, error: err?.message || 'Failed to save credit profile.' };
  }
}

export async function deleteCreditProfile(businessId: string, id: string): Promise<boolean> {
  if (!businessId || !id) return false;
  try {
    const { error } = await supabase
      .from('credit_profiles')
      .delete()
      .eq('id', id)
      .eq('business_id', businessId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('deleteCreditProfile Error:', err);
    return false;
  }
}

/**
 * Update only the saved phone number for an existing credit profile.
 * Keeping this mutation narrow prevents phone edits from changing balances,
 * due dates, profile type, or the credit ledger.
 */
export async function updateCreditProfilePhone(
  businessId: string,
  profileId: string,
  phone: string
): Promise<{ success: boolean; error?: string }> {
  if (!businessId || !profileId) {
    return { success: false, error: 'Business and creditor profile are required.' };
  }
  if (!isSupabaseConfigured) {
    return {
      success: false,
      error: 'Supabase is not configured for this deployment. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to the Vercel Production environment, then redeploy.'
    };
  }

  const cleanPhone = sanitizeTextInput(phone || '', 50);

  try {
    const { data, error } = await supabase
      .from('credit_profiles')
      .update({ contact_phone: cleanPhone })
      .eq('id', profileId)
      .eq('business_id', businessId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return {
        success: false,
        error: 'The creditor number was not updated. The profile may not belong to this business or your account may not have update permission.'
      };
    }
    return { success: true };
  } catch (err: any) {
    console.error('updateCreditProfilePhone Error:', err);
    const rawMessage = String(err?.message || '');
    const isFetchFailure = err instanceof TypeError || rawMessage.toLowerCase().includes('failed to fetch');
    return {
      success: false,
      error: isFetchFailure
        ? 'Unable to reach Supabase. Check the Vercel Production Supabase environment variables and network connection, then try again.'
        : rawMessage || 'Failed to update creditor phone number.'
    };
  }
}
