import { supabase, getSafeChannel } from './supabaseClient';
import { InventoryItem, PendingRestock } from '../types';
import { sanitizeTextInput } from './securityValidation';

export interface DamageReport {
  id: string;
  business_id: string;
  product_ref: string;
  product_title: string;
  quantity_damaged: number;
  justification_text: string;
  cost_price: number;
  selling_price: number;
  reported_by_uid: string;
  timestamp: string;
}

/**
 * 1. Subscribe to Live Inventory Items for a Business Tenant via Supabase Realtime
 */
export function subscribeToInventoryItems(
  businessId: string,
  onUpdate: (items: InventoryItem[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchItems = () => {
    supabase
      .from('inventory_items')
      .select('*')
      .eq('business_id', businessId)
      .order('product_title', { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (data) {
          const items: InventoryItem[] = data.map(d => ({
            id: d.id,
            name: d.product_title || '',
            sku: d.sku || '',
            category: d.category || 'General',
            quantity: d.quantity_in_hand ?? 0,
            unitCost: Number(d.cost_price) || 0,
            unitPrice: Number(d.selling_price) || 0,
            reorderPoint: d.low_stock_guard_level ?? 5,
            supplier: d.supplier_name || '',
            location: d.shelf_location || '',
            notes: d.internal_notes || '',
            lastUpdated: d.updated_at || d.created_at || new Date().toISOString(),
            imageUrl: d.image_url || ''
          }));
          onUpdate(items);
        }
      });
  };

  fetchItems();

  const channel = getSafeChannel(`inventory_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory_items', filter: `business_id=eq.${businessId}` },
      () => fetchItems()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * 2. Validate SKU Uniqueness within a Business Tenant
 */
export async function checkSkuUnique(
  businessId: string,
  sku: string,
  excludeItemId?: string | null
): Promise<{ isUnique: boolean; error?: string }> {
  if (!businessId) return { isUnique: true };
  const cleanSku = sanitizeTextInput(sku, 100).toUpperCase().trim();
  if (!cleanSku) return { isUnique: false, error: 'SKU cannot be blank.' };

  try {
    let query = supabase
      .from('inventory_items')
      .select('id')
      .eq('business_id', businessId)
      .eq('sku', cleanSku);

    if (excludeItemId) {
      query = query.neq('id', excludeItemId);
    }

    const { data, error } = await query;
    if (error) throw error;

    if (data && data.length > 0) {
      return { isUnique: false, error: `SKU "${cleanSku}" is already assigned to another product in this business.` };
    }

    return { isUnique: true };
  } catch (err: any) {
    console.warn('SKU uniqueness check notice:', err);
    return { isUnique: true };
  }
}

/**
 * 3. Create or Update Inventory Item
 */
export async function saveInventoryItem(
  businessId: string,
  userUid: string,
  userRole: number | string | undefined,
  payload: {
    name: string;
    sku: string;
    category?: string;
    quantity: number;
    unitCost: number;
    unitPrice: number;
    reorderPoint: number;
    supplier?: string;
    location?: string;
    notes?: string;
    imageFile?: File;
  },
  existingItemId?: string | null
): Promise<{ success: boolean; itemId?: string; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Only business Administrators can create or edit inventory items.' };
  }

  if (!businessId) {
    return { success: false, error: 'Business ID is required.' };
  }

  const cleanName = sanitizeTextInput(payload.name, 200);
  const cleanSku = sanitizeTextInput(payload.sku, 100).toUpperCase();
  const cleanCategory = sanitizeTextInput(payload.category || 'General', 100);
  const cleanSupplier = sanitizeTextInput(payload.supplier || '', 200);
  const cleanLocation = sanitizeTextInput(payload.location || '', 200);
  const cleanNotes = sanitizeTextInput(payload.notes || '', 1000);

  if (!cleanName) return { success: false, error: 'Product title is required.' };
  if (!cleanSku) return { success: false, error: 'SKU is required.' };

  if (payload.quantity < 0 || payload.unitCost < 0 || payload.unitPrice < 0 || payload.reorderPoint < 0) {
    return { success: false, error: 'Quantities, costs, and prices cannot be negative values.' };
  }

  const skuCheck = await checkSkuUnique(businessId, cleanSku, existingItemId);
  if (!skuCheck.isUnique) {
    return { success: false, error: skuCheck.error };
  }

  try {
    let imageUrl = '';
    if (payload.imageFile) {
      const fileExt = payload.imageFile.name.split('.').pop();
      const filePath = `${businessId}/${cleanSku}_${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('inventory-images')
        .upload(filePath, payload.imageFile, { upsert: true });

      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage
          .from('inventory-images')
          .getPublicUrl(filePath);
        imageUrl = publicUrl;
      }
    }

    const itemPayload: any = {
      business_id: businessId,
      product_title: cleanName,
      sku: cleanSku,
      category: cleanCategory,
      quantity_in_hand: Number(payload.quantity),
      cost_price: Number(payload.unitCost),
      selling_price: Number(payload.unitPrice),
      low_stock_guard_level: Number(payload.reorderPoint),
      supplier_name: cleanSupplier,
      shelf_location: cleanLocation,
      internal_notes: cleanNotes,
      created_by: userUid,
      updated_at: new Date().toISOString()
    };

    if (imageUrl) {
      itemPayload.image_url = imageUrl;
    }

    if (existingItemId) {
      const { data: existingRow, error: existingError } = await supabase
        .from('inventory_items')
        .select('quantity_in_hand')
        .eq('id', existingItemId)
        .eq('business_id', businessId)
        .single();
      if (existingError) throw existingError;

      const previousQuantity = Number(existingRow.quantity_in_hand) || 0;
      const requestedQuantity = Number(payload.quantity) || 0;
      itemPayload.quantity_in_hand = previousQuantity;

      const { error } = await supabase
        .from('inventory_items')
        .update(itemPayload)
        .eq('id', existingItemId)
        .eq('business_id', businessId);
      if (error) throw error;

      const quantityDelta = requestedQuantity - previousQuantity;
      if (quantityDelta !== 0) {
        const { error: adjustmentError } = await supabase.rpc('record_stock_adjustment', {
          p_business_id: businessId,
          p_item_id: existingItemId,
          p_qty_changed: quantityDelta,
          p_adjustment_type: 'audit_adjustment',
          p_notes: 'Inventory item quantity edited from the Inventory page.',
          p_credit_account_id: null,
          p_performed_by: userUid,
          p_source: 'manual'
        });
        if (adjustmentError) throw adjustmentError;
      }
      return { success: true, itemId: existingItemId };
    } else {
      const requestedQuantity = Number(payload.quantity) || 0;
      itemPayload.quantity_in_hand = 0;
      const { data, error } = await supabase
        .from('inventory_items')
        .insert(itemPayload)
        .select('id')
        .single();
      if (error) throw error;

      if (requestedQuantity > 0) {
        const { error: adjustmentError } = await supabase.rpc('record_stock_adjustment', {
          p_business_id: businessId,
          p_item_id: data.id,
          p_qty_changed: requestedQuantity,
          p_adjustment_type: 'initial_stock',
          p_notes: 'Initial stock captured when the inventory item was created.',
          p_credit_account_id: null,
          p_performed_by: userUid,
          p_source: 'manual'
        });
        if (adjustmentError) {
          await supabase.from('inventory_items').delete().eq('id', data.id).eq('business_id', businessId);
          throw adjustmentError;
        }
      }
      return { success: true, itemId: data.id };
    }
  } catch (err: any) {
    console.error('saveInventoryItem Error:', err);
    return { success: false, error: err?.message || 'Failed to save inventory item.' };
  }
}

/**
 * 4. Report Damaged Stock Transaction via Atomic Postgres RPC
 */
export async function reportDamagedStockTransaction(
  businessId: string,
  userUid: string,
  userRole: number | string | undefined,
  payload: {
    itemId: string;
    productTitle: string;
    quantityDamaged: number;
    justificationText: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Only Administrators can log damaged stock.' };
  }

  const { itemId, quantityDamaged, justificationText } = payload;
  const cleanJustification = sanitizeTextInput(justificationText, 500);

  if (!itemId) return { success: false, error: 'Select a product to report damages.' };
  if (!quantityDamaged || quantityDamaged <= 0) {
    return { success: false, error: 'Damaged quantity must be greater than zero.' };
  }
  if (!cleanJustification) {
    return { success: false, error: 'Justification text is required for auditing purposes.' };
  }

  try {
    const { error } = await supabase.rpc('report_damaged_stock', {
      p_business_id: businessId,
      p_item_id: itemId,
      p_quantity: quantityDamaged,
      p_justification: cleanJustification,
      p_reported_by: userUid,
      p_source: 'manual'
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('reportDamagedStockTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record damaged stock.' };
  }
}

/**
 * 5. Subscribe to Damage Reports via Supabase Realtime
 */
export function subscribeToDamageReports(
  businessId: string,
  onUpdate: (reports: DamageReport[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchReports = () => {
    supabase
      .from('damage_reports')
      .select('*, inventory_items(product_title)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (data) {
          onUpdate(data.map(d => ({
            id: d.id,
            business_id: d.business_id,
            product_ref: d.item_id,
            product_title: d.inventory_items?.product_title || 'Item',
            quantity_damaged: d.quantity_damaged,
            justification_text: d.justification_text,
            cost_price: Number(d.cost_price_at_time) || 0,
            selling_price: Number(d.selling_price_at_time) || 0,
            reported_by_uid: d.reported_by || 'Admin',
            timestamp: d.created_at
          })));
        }
      });
  };

  fetchReports();

  const channel = getSafeChannel(`damage_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'damage_reports', filter: `business_id=eq.${businessId}` },
      () => fetchReports()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function deleteInventoryItem(businessId: string, itemId: string): Promise<boolean> {
  if (!businessId || !itemId) return false;
  try {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId)
      .eq('business_id', businessId);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('deleteInventoryItem error:', err);
    return false;
  }
}

/**
 * 6. Submit Restock Request via Atomic Postgres RPC
 */
export async function submitRestockRequest(
  businessId: string,
  userUid: string,
  userEmail: string,
  userRole: number | string | undefined,
  payload: {
    itemId: string;
    itemName: string;
    requestedQuantity: number;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!businessId) return { success: false, error: 'Business ID is required.' };

  const cleanNotes = sanitizeTextInput(payload.notes || '', 500);
  const qty = Number(payload.requestedQuantity);

  if (!payload.itemId) return { success: false, error: 'Item ID is required.' };
  if (isNaN(qty) || qty <= 0) return { success: false, error: 'Restock quantity must be greater than zero.' };

  try {
    const { error } = await supabase.rpc('submit_restock_request', {
      p_business_id: businessId,
      p_item_id: payload.itemId,
      p_quantity: qty,
      p_notes: cleanNotes,
      p_submitted_by: userUid,
      p_source: 'manual'
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('submitRestockRequest Error:', err);
    return { success: false, error: err?.message || 'Failed to submit restock request.' };
  }
}

/**
 * 7. Direct Admin Restock Transaction via Atomic Postgres RPC
 */
export async function directAdminRestockTransaction(
  businessId: string,
  userUid: string,
  userRole: number | string | undefined,
  itemId: string,
  quantity: number,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) {
    return { success: false, error: 'Unauthorized: Only Administrators can commit direct restocks.' };
  }

  if (!businessId || !itemId) return { success: false, error: 'Select an item to restock.' };
  if (quantity <= 0) return { success: false, error: 'Restock quantity must be greater than zero.' };

  try {
    const { error } = await supabase.rpc('direct_admin_restock', {
      p_business_id: businessId,
      p_item_id: itemId,
      p_quantity: quantity,
      p_notes: sanitizeTextInput(notes || '', 500),
      p_performed_by: userUid,
      p_source: 'manual'
    });

    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    console.error('directAdminRestockTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to commit direct restock.' };
  }
}

/**
 * 8. Verify Restock Request Transaction via Atomic Postgres RPC
 */
export async function verifyRestockRequestTransaction(
  businessId: string,
  userUid: string,
  userRole: number | string | undefined,
  requestId: string,
  itemId: string,
  attendantQty: number,
  adminQty: number,
  notes?: string,
  forceResolveValue?: number
): Promise<{ success: boolean; result: 'resolved_matched' | 'on_hold' | 'resolved_forced' | 'error'; error?: string }> {
  const isAdmin = userRole === 2 || userRole === 'admin';
  if (!isAdmin) {
    return { success: false, result: 'error', error: 'Unauthorized: Only Administrators can verify restock requests.' };
  }

  const cleanNotes = sanitizeTextInput(notes || '', 500);
  const isForced = forceResolveValue !== undefined && forceResolveValue !== null;
  const isMatch = adminQty === attendantQty;

  const targetQty = isForced ? Number(forceResolveValue) : adminQty;
  const status = (isMatch || isForced) ? 'approved' : 'on_hold';

  try {
    const { error } = await supabase.rpc('verify_restock_request', {
      p_business_id: businessId,
      p_request_id: requestId,
      p_item_id: itemId,
      p_admin_qty: targetQty,
      p_status: status,
      p_discrepancy_notes: cleanNotes || (isMatch ? 'Quantity match verified by Admin' : 'Discrepancy resolved by Admin'),
      p_performed_by: userUid,
      p_source: 'manual'
    });

    if (error) throw error;
    const resultTag = isForced ? 'resolved_forced' : (isMatch ? 'resolved_matched' : 'on_hold');
    return { success: true, result: resultTag };
  } catch (err: any) {
    console.error('verifyRestockRequestTransaction Error:', err);
    return { success: false, result: 'error', error: err?.message || 'Failed to verify restock request.' };
  }
}

/**
 * 9. Subscribe to Restock Requests via Supabase Realtime
 */
export function subscribeToRestockRequests(
  businessId: string,
  onUpdate: (requests: PendingRestock[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchRequests = () => {
    supabase
      .from('restock_requests')
      .select('*, inventory_items(product_title)')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          if (onError) onError(error);
          return;
        }
        if (data) {
          onUpdate(data.map(d => ({
            id: d.id,
            itemId: d.item_id,
            itemName: d.inventory_items?.product_title || 'Item',
            attendantQty: d.attendant_qty,
            attendantNotes: d.discrepancy_notes || '',
            date: d.created_at,
            submittedBy: d.submitted_by || 'Attendant',
            status: d.status as any,
            adminInputQty: d.admin_input_qty,
            discrepancyNotes: d.discrepancy_notes,
            resolvedAt: d.resolved_at,
            resolvedQty: d.resolved_qty
          })));
        }
      });
  };

  fetchRequests();

  const channel = getSafeChannel(`restocks_${businessId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'restock_requests', filter: `business_id=eq.${businessId}` },
      () => fetchRequests()
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}


/** Subscribe to the typed, authoritative stock-adjustment ledger. */
export function subscribeToStockAdjustments(
  businessId: string,
  onUpdate: (adjustments: any[]) => void,
  onError?: (err: any) => void
): () => void {
  if (!businessId) {
    onUpdate([]);
    return () => { };
  }

  const fetchAdjustments = () => {
    supabase
      .from('stock_adjustments')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) {
          onError?.(error);
          return;
        }
        onUpdate((data || []).map((d: any) => ({
          id: d.id,
          itemId: d.item_id,
          itemName: d.item_name || '',
          qtyChanged: Number(d.qty_changed) || 0,
          type: d.adjustment_type,
          date: d.created_at,
          notes: d.notes || '',
          unitPriceSnapshot: d.unit_price_snapshot !== null && d.unit_price_snapshot !== undefined
            ? Number(d.unit_price_snapshot)
            : undefined,
          creditAccountId: d.credit_account_id || undefined,
          performedBy: d.performed_by || 'System',
          isFlagged: Boolean(d.is_flagged),
          flagComment: d.flag_comment || undefined,
          flaggedBy: d.flagged_by || undefined,
          flaggedAt: d.flagged_at || undefined,
          isResolved: Boolean(d.is_resolved),
          resolvedAt: d.resolved_at || undefined,
          resolvedBy: d.resolved_by || undefined,
          originalQtyChanged: d.original_qty_changed ?? undefined,
          correctionNotes: d.correction_notes || undefined
        })));
      });
  };

  fetchAdjustments();
  const channel = getSafeChannel(`stock_adjustments_${businessId}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'stock_adjustments', filter: `business_id=eq.${businessId}`
    }, fetchAdjustments)
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

/** Record a normal stock movement atomically in Postgres. */
export async function recordStockAdjustmentTransaction(
  businessId: string,
  userUid: string,
  userRole: number | string | undefined,
  payload: {
    itemId: string;
    qtyChanged: number;
    type: 'initial_stock' | 'purchase_in' | 'sale_out' | 'damaged' | 'returned' | 'audit_adjustment';
    notes?: string;
    creditAccountId?: string;
  }
): Promise<{ success: boolean; id?: string; error?: string }> {
  if (!businessId || !userUid || !payload.itemId) return { success: false, error: 'Business, user, and item identifiers are required.' };
  if (!Number.isInteger(payload.qtyChanged) || payload.qtyChanged === 0) return { success: false, error: 'Stock movement must be a non-zero whole number.' };
  if (payload.type === 'purchase_in' && !(userRole === 2 || userRole === 'admin')) {
    return { success: false, error: 'Attendants must submit restock requests for approval.' };
  }

  try {
    const { data, error } = await supabase.rpc('record_stock_adjustment', {
      p_business_id: businessId,
      p_item_id: payload.itemId,
      p_qty_changed: payload.qtyChanged,
      p_adjustment_type: payload.type,
      p_notes: sanitizeTextInput(payload.notes || '', 500),
      p_credit_account_id: payload.creditAccountId || null,
      p_performed_by: userUid,
      p_source: 'manual'
    });
    if (error) throw error;
    return { success: true, id: data as string };
  } catch (err: any) {
    console.error('recordStockAdjustmentTransaction Error:', err);
    return { success: false, error: err?.message || 'Failed to record stock movement.' };
  }
}

/** Create the five-minute admin invite in the canonical invite_codes table. */
export async function createAttendantInvite(
  businessId: string,
  userRole: number | string | undefined
): Promise<{ success: boolean; code?: string; expiresAt?: string; error?: string }> {
  if (!(userRole === 2 || userRole === 'admin')) return { success: false, error: 'Only Administrators can create invites.' };
  if (!businessId) return { success: false, error: 'Business ID is required.' };
  try {
    const { data, error } = await supabase.rpc('create_attendant_invite', {
      p_business_id: businessId,
      p_expires_in_seconds: 300
    });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { success: true, code: row?.code, expiresAt: row?.expires_at };
  } catch (err: any) {
    console.error('createAttendantInvite Error:', err);
    return { success: false, error: err?.message || 'Failed to create attendant invite.' };
  }
}
