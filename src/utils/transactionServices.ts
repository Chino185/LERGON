import { supabase, getSafeChannel } from './supabaseClient';
import { CreditTransaction } from '../types';

export function subscribeToTransactions(
  businessId: string,
  onUpdate: (transactions: CreditTransaction[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchTxns = async () => {
    const [{ data, error }, { data: accountRows }] = await Promise.all([
      supabase
        .from('transactions')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false }),
      supabase
        .from('credit_profiles')
        .select('id, remaining_balance')
        .eq('business_id', businessId)
    ]);

    if (error) {
      if (onError) onError(error);
      return;
    }
    if (!data) return;

    const proofUrls = new Map<string, string>();
    await Promise.all(data.map(async (row) => {
      if (!row.proof_path) return;
      const { data: signedData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(row.proof_path, 60 * 60);
      if (signedData?.signedUrl) {
        proofUrls.set(row.id, signedData.signedUrl);
      }
    }));

    const currentBalances = new Map<string, number>((accountRows || []).map(row => [row.id, Number(row.remaining_balance) || 0]));
    const list: CreditTransaction[] = data.map(d => ({
      id: d.id,
      creditAccountId: (d.items && d.items[0]?.credit_id) || '',
      accountName: (d.items && d.items[0]?.account_name) || '',
      type: d.type === 'repayment' || d.type === 'supplier_payment' ? 'pay' : 'charge',
      amount: Number(d.total_amount) || 0,
      date: d.created_at || new Date().toISOString(),
      notes: (d.items && d.items[0]?.notes) || `${String(d.type || 'transaction').toUpperCase()} transaction`,
      paymentMethod: (d.payment_method as any) || 'Cash',
      transactionProof: d.proof_path && proofUrls.get(d.id)
        ? {
            name: d.proof_file_name || 'Payment proof',
            dataUrl: proofUrls.get(d.id)!,
            type: d.proof_mime_type || 'application/octet-stream'
          }
        : undefined,
      remainingAmount: d.items && d.items[0]?.remaining_amount !== undefined ? Number(d.items[0].remaining_amount) : undefined,
      relatedCreditTxnId: d.items && d.items[0]?.related_credit_txn_id ? d.items[0].related_credit_txn_id : undefined,
      performedBy: d.performed_by || 'User',
      transactionType: d.type || undefined,
      lineItems: Array.isArray(d.items) ? d.items : [],
      isFlagged: Boolean(d.is_flagged),
      flagComment: d.flag_comment || undefined,
      flaggedBy: d.flagged_by || undefined,
      flaggedAt: d.flagged_at || undefined,
      isResolved: Boolean(d.is_resolved),
      resolvedAt: d.resolved_at || undefined,
      resolvedBy: d.resolved_by || undefined,
      originalAmount: d.original_total_amount !== null && d.original_total_amount !== undefined
        ? Number(d.original_total_amount)
        : undefined,
      correctionNotes: d.correction_notes || undefined
    }));

    // Backfill balance snapshots for legacy rows whose JSON items did not yet
    // contain remaining_amount. Start from the current backend balance and
    // replay the account ledger chronologically.
    const chargesByAccount = new Map<string, number>();
    const paymentsByAccount = new Map<string, number>();
    list.forEach(tx => {
      if (!tx.creditAccountId) return;
      if (tx.transactionType === 'repayment' || tx.transactionType === 'supplier_payment') {
        paymentsByAccount.set(tx.creditAccountId, (paymentsByAccount.get(tx.creditAccountId) || 0) + tx.amount);
      } else if (tx.transactionType === 'credit' || tx.transactionType === 'supplier_credit') {
        chargesByAccount.set(tx.creditAccountId, (chargesByAccount.get(tx.creditAccountId) || 0) + tx.amount);
      }
    });

    const startingBalances = new Map<string, number>();
    currentBalances.forEach((current, accountId) => {
      startingBalances.set(
        accountId,
        Math.max(0, current - (chargesByAccount.get(accountId) || 0) + (paymentsByAccount.get(accountId) || 0))
      );
    });

    const runningBalances = new Map(startingBalances);
    [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).forEach(tx => {
      if (!tx.creditAccountId) return;
      const current = runningBalances.get(tx.creditAccountId) || 0;
      const next = tx.transactionType === 'repayment' || tx.transactionType === 'supplier_payment'
        ? Math.max(0, current - tx.amount)
        : (tx.transactionType === 'credit' || tx.transactionType === 'supplier_credit')
          ? current + tx.amount
          : current;
      runningBalances.set(tx.creditAccountId, next);
      if (tx.remainingAmount === undefined && (tx.transactionType === 'repayment' || tx.transactionType === 'supplier_payment')) {
        tx.remainingAmount = next;
      }
    });

    onUpdate(list);
  };

  fetchTxns();

  const channel = getSafeChannel(`txns_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'transactions', filter: `business_id=eq.${businessId}` },
      () => fetchTxns()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function recordSaleTransaction(
  businessId: string,
  userUid: string,
  itemId: string,
  quantity: number,
  unitPrice: number,
  paymentMethod: string = 'Cash',
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !itemId) return { success: false, error: 'Business ID and Item ID are required.' };
  if (quantity <= 0) return { success: false, error: 'Quantity must be greater than zero.' };

  try {
    const { data, error } = await supabase.rpc('record_sale', {
      p_business_id: businessId,
      p_item_id: itemId,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_payment_method: paymentMethod,
      p_performed_by: userUid,
      p_source: source
    });

    if (error) throw error;
    return { success: true, id: data };
  } catch (err: any) {
    console.error('recordSaleTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record sale transaction.' };
  }
}

export async function recordRepaymentTransaction(
  businessId: string,
  userUid: string,
  creditId: string,
  amount: number,
  paymentMethod: string = 'Cash',
  notes?: string,
  source: 'manual' | 'ai_assistant' = 'manual',
  transactionProof?: { name: string; dataUrl: string; type: string }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !creditId) return { success: false, error: 'Business ID and Credit ID are required.' };
  if (amount <= 0) return { success: false, error: 'Repayment amount must be greater than zero.' };

  let uploadedProofPath = '';
  try {
    if (transactionProof && paymentMethod !== 'Cash') {
      const commaIndex = transactionProof.dataUrl.indexOf(',');
      if (commaIndex < 0) throw new Error('The payment proof file could not be read.');

      const encoded = transactionProof.dataUrl.slice(commaIndex + 1);
      const binary = atob(encoded);
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }
      const proofBlob = new Blob([bytes], { type: transactionProof.type || 'application/octet-stream' });
      const extension = (transactionProof.name.split('.').pop() || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'bin';
      const proofId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      uploadedProofPath = `${businessId}/payment-proofs/${proofId}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(uploadedProofPath, proofBlob, {
          contentType: transactionProof.type || 'application/octet-stream',
          upsert: false
        });
      if (uploadError) throw uploadError;
    }

    const { data, error } = await supabase.rpc('record_repayment_with_proof', {
      p_business_id: businessId,
      p_credit_id: creditId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_notes: notes || '',
      p_performed_by: userUid,
      p_source: source,
      p_proof_path: uploadedProofPath || null,
      p_proof_file_name: transactionProof?.name || null,
      p_proof_mime_type: transactionProof?.type || null
    });

    if (error) throw error;
    return { success: true, id: data };
  } catch (err: any) {
    if (uploadedProofPath) {
      await supabase.storage.from('receipts').remove([uploadedProofPath]);
    }
    console.error('recordRepaymentTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record repayment.' };
  }
}


export async function recordCreditSaleTransaction(
  businessId: string,
  userUid: string,
  creditId: string,
  itemId: string,
  quantity: number,
  unitPrice: number,
  notes?: string,
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !userUid || !creditId || !itemId) return { success: false, error: 'Business, user, credit, and item identifiers are required.' };
  if (quantity <= 0) return { success: false, error: 'Quantity must be greater than zero.' };
  try {
    const { data, error } = await supabase.rpc('record_credit_sale', {
      p_business_id: businessId,
      p_credit_id: creditId,
      p_item_id: itemId,
      p_quantity: quantity,
      p_unit_price: unitPrice,
      p_notes: notes || '',
      p_performed_by: userUid,
      p_source: source
    });
    if (error) throw error;
    return { success: true, id: data as string };
  } catch (err: any) {
    console.error('recordCreditSaleTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record credit sale.' };
  }
}

export async function recordSupplierCreditPurchaseTransaction(
  businessId: string,
  userUid: string,
  creditId: string,
  itemId: string,
  quantity: number,
  unitCost: number,
  notes?: string,
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !userUid || !creditId || !itemId) return { success: false, error: 'Business, user, credit, and item identifiers are required.' };
  if (quantity <= 0) return { success: false, error: 'Quantity must be greater than zero.' };
  try {
    const { data, error } = await supabase.rpc('record_supplier_credit_purchase', {
      p_business_id: businessId,
      p_credit_id: creditId,
      p_item_id: itemId,
      p_quantity: quantity,
      p_unit_cost: unitCost,
      p_notes: notes || '',
      p_performed_by: userUid,
      p_source: source
    });
    if (error) throw error;
    return { success: true, id: data as string };
  } catch (err: any) {
    console.error('recordSupplierCreditPurchaseTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record supplier credit purchase.' };
  }
}


export async function recordCreditChargeTransaction(
  businessId: string,
  userUid: string,
  creditId: string,
  amount: number,
  notes?: string,
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !userUid || !creditId) return { success: false, error: 'Business, user, and credit identifiers are required.' };
  if (amount <= 0) return { success: false, error: 'Charge amount must be greater than zero.' };
  try {
    const { data, error } = await supabase.rpc('record_credit_charge', {
      p_business_id: businessId,
      p_credit_id: creditId,
      p_amount: amount,
      p_notes: notes || '',
      p_performed_by: userUid,
      p_source: source
    });
    if (error) throw error;
    return { success: true, id: data as string };
  } catch (err: any) {
    console.error('recordCreditChargeTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record credit charge.' };
  }
}
