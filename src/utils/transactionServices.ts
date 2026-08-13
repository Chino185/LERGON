import { supabase } from './supabaseClient';
import { CreditTransaction } from '../types';

export function subscribeToTransactions(
  businessId: string,
  onUpdate: (transactions: CreditTransaction[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => {};
  }

  const fetchTxns = () => {
    supabase
      .from('transactions')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (data) {
          const list: CreditTransaction[] = data.map(d => ({
            id: d.id,
            creditAccountId: (d.items && d.items[0]?.credit_id) || d.id,
            accountName: (d.items && d.items[0]?.account_name) || 'Transaction',
            type: d.type === 'credit' || d.type === 'sell' ? 'charge' : 'pay',
            amount: Number(d.total_amount) || 0,
            date: d.created_at ? d.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
            notes: (d.items && d.items[0]?.notes) || `${d.type.toUpperCase()} transaction`,
            paymentMethod: (d.payment_method as any) || 'Cash',
            performedBy: d.performed_by || 'User'
          }));
          onUpdate(list);
        }
      });
  };

  fetchTxns();

  const channel = supabase
    .channel(`txns_${businessId}`)
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
  source: 'manual' | 'ai_assistant' = 'manual'
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !creditId) return { success: false, error: 'Business ID and Credit ID are required.' };
  if (amount <= 0) return { success: false, error: 'Repayment amount must be greater than zero.' };

  try {
    const { data, error } = await supabase.rpc('record_repayment', {
      p_business_id: businessId,
      p_credit_id: creditId,
      p_amount: amount,
      p_payment_method: paymentMethod,
      p_notes: notes || '',
      p_performed_by: userUid,
      p_source: source
    });

    if (error) throw error;
    return { success: true, id: data };
  } catch (err: any) {
    console.error('recordRepaymentTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record repayment.' };
  }
}
