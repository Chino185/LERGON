import { supabase } from './supabaseClient';
import { sanitizeTextInput } from './securityValidation';
import { SavedInvoice } from '../types';

export interface SaveInvoicePayload {
  invoiceNumber: string;
  billTo: string;
  lineItems: any[];
  grandTotal: number;
  metadata?: Record<string, unknown>;
}

/**
 * Persists every printed/generated invoice to the Supabase `invoices` table.
 * Stores line_items as JSONB matching the PostgreSQL schema.
 */
export async function saveInvoice(
  businessId: string,
  userUid: string,
  payload: SaveInvoicePayload
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId) {
    return { success: false, error: 'Business identifier is required.' };
  }
  if (!payload.invoiceNumber || !payload.invoiceNumber.trim()) {
    return { success: false, error: 'Invoice number is required.' };
  }

  const cleanInvoiceNumber = sanitizeTextInput(payload.invoiceNumber, 100);
  const cleanBillTo = sanitizeTextInput(payload.billTo?.trim() || 'Walk-in Customer', 200);
  const grandTotal = Number.isFinite(payload.grandTotal) ? Math.max(0, payload.grandTotal) : 0;
  const lineItems = Array.isArray(payload.lineItems) ? payload.lineItems : [];

  try {
    const { data, error } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        invoice_number: cleanInvoiceNumber,
        bill_to: cleanBillTo,
        line_items: lineItems,
        grand_total: grandTotal,
        generated_by: userUid || null
      })
      .select('id, invoice_number, created_at')
      .single();

    if (error) {
      throw error;
    }

    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('saveInvoice Error:', err);
    return { success: false, error: err?.message || 'Failed to save invoice to database.' };
  }
}

/**
 * Retrieves all saved invoices for the current business.
 */
export async function fetchInvoicesFromSupabase(businessId: string): Promise<SavedInvoice[]> {
  if (!businessId) return [];

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (data || []) as SavedInvoice[];
  } catch (err) {
    console.error('fetchInvoicesFromSupabase Error:', err);
    return [];
  }
}

/**
 * Deletes a saved invoice from Supabase.
 */
export async function deleteInvoiceFromSupabase(
  invoiceId: string,
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  if (!invoiceId || !businessId) {
    return { success: false, error: 'Invoice ID and Business ID are required.' };
  }

  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('business_id', businessId);

    if (error) {
      throw error;
    }

    return { success: true };
  } catch (err: any) {
    console.error('deleteInvoiceFromSupabase Error:', err);
    return { success: false, error: err?.message || 'Failed to delete invoice.' };
  }
}

/**
 * Subscribes to real-time invoice table changes for the business.
 */
export function subscribeToInvoices(
  businessId: string,
  onUpdate: (invoices: SavedInvoice[]) => void
) {
  if (!businessId) return () => {};

  const channel = supabase
    .channel(`invoices_changes_${businessId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'invoices',
        filter: `business_id=eq.${businessId}`
      },
      async () => {
        const refreshed = await fetchInvoicesFromSupabase(businessId);
        onUpdate(refreshed);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
