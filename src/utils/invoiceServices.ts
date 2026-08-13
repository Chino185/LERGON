import { supabase } from './supabaseClient';
import { sanitizeTextInput } from './securityValidation';

export async function saveInvoice(
    businessId: string,
    userUid: string,
    payload: {
        invoiceNumber: string;
        billTo: string;
        lineItems: unknown[];
        grandTotal: number;
    }
): Promise<{ success: boolean; id?: string; error?: string }> {
    if (!businessId || !userUid) return { success: false, error: 'Business and user identifiers are required.' };
    if (!payload.invoiceNumber.trim()) return { success: false, error: 'Invoice number is required.' };
    if (!payload.billTo.trim()) return { success: false, error: 'Bill-to name is required.' };
    if (!Number.isFinite(payload.grandTotal) || payload.grandTotal < 0) return { success: false, error: 'Invoice total is invalid.' };

    try {
        const { data, error } = await supabase
            .from('invoices')
            .insert({
                business_id: businessId,
                invoice_number: sanitizeTextInput(payload.invoiceNumber, 100),
                bill_to: sanitizeTextInput(payload.billTo, 200),
                line_items: payload.lineItems,
                grand_total: payload.grandTotal,
                generated_by: userUid
            })
            .select('id')
            .single();
        if (error) throw error;
        return { success: true, id: data.id };
    } catch (err: any) {
        console.error('saveInvoice Error:', err);
        return { success: false, error: err?.message || 'Failed to save invoice.' };
    }
}
