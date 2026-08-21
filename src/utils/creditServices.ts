import { supabase, getSafeChannel } from './supabaseClient';
import { CreditAccount } from '../types';
import { sanitizeTextInput } from './securityValidation';

export function subscribeToCreditProfiles(
  businessId: string,
  onUpdate: (accounts: CreditAccount[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchAccounts = () => {
    supabase
      .from('credit_profiles')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (data) {
          const accounts: CreditAccount[] = data.map(d => ({
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
            dateOfCrediting: d.created_at ? d.created_at.split('T')[0] : new Date().toISOString().split('T')[0]
          }));
          onUpdate(accounts);
        }
      });
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

  try {
    let receiptUrl = '';
    if (payload.receiptFile) {
      const fileExt = payload.receiptFile.name.split('.').pop();
      const filePath = `${businessId}/${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(filePath, payload.receiptFile, { upsert: true });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage
          .from('receipts')
          .getPublicUrl(filePath);
        receiptUrl = publicUrl;
      }
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
      if (receiptUrl) updateData.receipt_url = receiptUrl;

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
      return { success: true, id: data };
    }
  } catch (err: any) {
    console.error('saveCreditProfile Error:', err);
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