import { supabase } from './supabaseClient';
import { sanitizeTextInput } from './securityValidation';

const INVOICE_BUCKET = 'invoices';

export interface SaveInvoicePayload {
    invoiceNumber: string;
    billTo: string;
    grandTotal: number;
    pdfBlob: Blob;
    pdfFileName: string;
}

export async function saveInvoice(
    businessId: string,
    userUid: string,
    payload: SaveInvoicePayload
): Promise<{ success: boolean; id?: string; storagePath?: string; error?: string }> {
    if (!businessId || !userUid) return { success: false, error: 'Business and user identifiers are required.' };
    if (!payload.invoiceNumber.trim()) return { success: false, error: 'Invoice number is required.' };
    if (!payload.billTo.trim()) return { success: false, error: 'Bill-to name is required.' };
    if (!Number.isFinite(payload.grandTotal) || payload.grandTotal < 0) return { success: false, error: 'Invoice total is invalid.' };
    if (!(payload.pdfBlob instanceof Blob) || payload.pdfBlob.size === 0) return { success: false, error: 'A generated invoice PDF is required.' };
    if (payload.pdfBlob.type && payload.pdfBlob.type !== 'application/pdf') return { success: false, error: 'The invoice file must be a PDF.' };

    const cleanInvoiceNumber = sanitizeTextInput(payload.invoiceNumber, 100);
    const safeInvoiceNumber = cleanInvoiceNumber
        .replace(/[^a-zA-Z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'invoice';
    const safeFileName = `${safeInvoiceNumber}-${Date.now()}.pdf`;
    const storagePath = `${businessId}/${userUid}/${safeFileName}`;

    try {
        const { error: uploadError } = await supabase.storage
            .from(INVOICE_BUCKET)
            .upload(storagePath, payload.pdfBlob, {
                contentType: 'application/pdf',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data, error } = await supabase
            .from('invoices')
            .insert({
                business_id: businessId,
                invoice_number: cleanInvoiceNumber,
                bill_to: sanitizeTextInput(payload.billTo, 200),
                pdf_storage_path: storagePath,
                pdf_file_name: sanitizeTextInput(payload.pdfFileName || safeFileName, 180),
                pdf_content_type: 'application/pdf',
                pdf_size_bytes: payload.pdfBlob.size,
                grand_total: payload.grandTotal,
                generated_by: userUid
            })
            .select('id, pdf_storage_path')
            .single();

        if (error) {
            await supabase.storage.from(INVOICE_BUCKET).remove([storagePath]);
            throw error;
        }

        return { success: true, id: data.id, storagePath: data.pdf_storage_path };
    } catch (err: any) {
        console.error('saveInvoice Error:', err);
        return { success: false, error: err?.message || 'Failed to save invoice PDF.' };
    }
}
