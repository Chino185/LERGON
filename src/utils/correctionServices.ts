import { supabase } from './supabaseClient';

export async function flagStockAdjustment(
    businessId: string,
    adjustmentId: string,
    comment: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc('flag_stock_adjustment', {
            p_business_id: businessId,
            p_adjustment_id: adjustmentId,
            p_comment: comment
        });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('flagStockAdjustment Error:', err);
        return { success: false, error: err?.message || 'Failed to flag the stock adjustment.' };
    }
}

export async function flagTransaction(
    businessId: string,
    transactionId: string,
    comment: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc('flag_transaction', {
            p_business_id: businessId,
            p_transaction_id: transactionId,
            p_comment: comment
        });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('flagTransaction Error:', err);
        return { success: false, error: err?.message || 'Failed to flag the transaction.' };
    }
}

export async function authorizeStockAdjustmentCorrection(
    businessId: string,
    adjustmentId: string,
    correctedQty: number,
    correctionNotes: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc('authorize_stock_adjustment_correction', {
            p_business_id: businessId,
            p_adjustment_id: adjustmentId,
            p_corrected_qty: correctedQty,
            p_correction_notes: correctionNotes
        });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('authorizeStockAdjustmentCorrection Error:', err);
        return { success: false, error: err?.message || 'Failed to authorize the stock correction.' };
    }
}

export async function authorizeTransactionCorrection(
    businessId: string,
    transactionId: string,
    correctedAmount: number,
    correctionNotes: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase.rpc('authorize_transaction_correction', {
            p_business_id: businessId,
            p_transaction_id: transactionId,
            p_corrected_amount: correctedAmount,
            p_correction_notes: correctionNotes
        });
        if (error) throw error;
        return { success: true };
    } catch (err: any) {
        console.error('authorizeTransactionCorrection Error:', err);
        return { success: false, error: err?.message || 'Failed to authorize the transaction correction.' };
    }
}
