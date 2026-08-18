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

export interface InvoicePdfResult {
  success: boolean;
  id?: string;
  pdfUrl?: string;
  sizeBytes?: number;
  error?: string;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

/**
 * Persists invoice metadata to the Supabase `invoices` table.
 * PDF bytes are uploaded separately through the authenticated backend route.
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

    if (error) throw error;
    return { success: true, id: data.id };
  } catch (err: any) {
    console.error('saveInvoice Error:', err);
    return { success: false, error: err?.message || 'Failed to save invoice to database.' };
  }
}

/**
 * Uploads the generated PDF bytes to the backend. The browser never writes
 * directly to Supabase Storage and receives only a backend download reference.
 */
export async function uploadInvoicePdfToBackend(
  businessId: string,
  invoiceId: string,
  invoiceNumber: string,
  pdfBlob: Blob
): Promise<InvoicePdfResult> {
  if (!businessId || !invoiceId) return { success: false, error: 'Business ID and invoice ID are required.' };
  if (!(pdfBlob instanceof Blob) || pdfBlob.size === 0) return { success: false, error: 'The generated PDF is empty.' };
  if (pdfBlob.type && pdfBlob.type !== 'application/pdf') return { success: false, error: 'Only PDF files can be uploaded.' };

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'Your session has expired. Please sign in again.' };

  try {
    const response = await fetch('/api/invoices/pdf', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/pdf',
        'X-Business-Id': businessId,
        'X-Invoice-Id': invoiceId,
        'X-Invoice-Number': invoiceNumber
      },
      body: pdfBlob
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      return { success: false, error: data.error || 'The backend could not store the invoice PDF.' };
    }

    return {
      success: true,
      id: data.id,
      pdfUrl: data.pdfUrl,
      sizeBytes: data.sizeBytes
    };
  } catch (err: any) {
    console.error('uploadInvoicePdfToBackend Error:', err);
    return { success: false, error: err?.message || 'Failed to upload invoice PDF to the backend.' };
  }
}

/**
 * Downloads the PDF through the authenticated backend endpoint, not from a
 * browser-only Blob or a direct public Storage URL.
 */
export async function downloadInvoicePdfFromBackend(
  businessId: string,
  invoiceId: string,
  invoiceNumber: string
): Promise<{ success: boolean; error?: string }> {
  if (!businessId || !invoiceId) return { success: false, error: 'Business ID and invoice ID are required.' };

  const accessToken = await getAccessToken();
  if (!accessToken) return { success: false, error: 'Your session has expired. Please sign in again.' };

  try {
    const response = await fetch(`/api/invoices/${encodeURIComponent(businessId)}/${encodeURIComponent(invoiceId)}/pdf`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { success: false, error: errorData.error || 'The backend could not retrieve the invoice PDF.' };
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(invoiceNumber || 'invoice').replace(/[^a-z0-9._-]+/gi, '-')}.pdf`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { success: true };
  } catch (err: any) {
    console.error('downloadInvoicePdfFromBackend Error:', err);
    return { success: false, error: err?.message || 'Failed to download invoice PDF from the backend.' };
  }
}

/** Retrieves all saved invoices for the current business. */
export async function fetchInvoicesFromSupabase(businessId: string): Promise<SavedInvoice[]> {
  if (!businessId) return [];

  try {
    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as SavedInvoice[];
  } catch (err) {
    console.error('fetchInvoicesFromSupabase Error:', err);
    return [];
  }
}

/** Deletes a saved invoice metadata record from Supabase. */
export async function deleteInvoiceFromSupabase(
  invoiceId: string,
  businessId: string
): Promise<{ success: boolean; error?: string }> {
  if (!invoiceId || !businessId) return { success: false, error: 'Invoice ID and Business ID are required.' };

  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('business_id', businessId);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('deleteInvoiceFromSupabase Error:', err);
    return { success: false, error: err?.message || 'Failed to delete invoice.' };
  }
}

/** Subscribes to real-time invoice table changes for the business. */
export function subscribeToInvoices(
  businessId: string,
  onUpdate: (invoices: SavedInvoice[]) => void
) {
  if (!businessId) return () => { };

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
