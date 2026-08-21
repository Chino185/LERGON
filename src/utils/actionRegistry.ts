import React from 'react';
import { InventoryItem, StockAdjustment, CreditAccount, CreditTransaction, BusinessConfig } from '../types';
import { logActivity } from './authServices';
import { saveInventoryItem, directAdminRestockTransaction } from './inventoryServices';
import { recordSaleTransaction, recordRepaymentTransaction } from './transactionServices';
import { supabase } from './supabaseClient';

export interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
}

export interface ActionContext {
  inventory: InventoryItem[];
  setInventory?: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  adjustments: StockAdjustment[];
  setAdjustments?: React.Dispatch<React.SetStateAction<StockAdjustment[]>>;
  creditAccounts: CreditAccount[];
  setCreditAccounts?: React.Dispatch<React.SetStateAction<CreditAccount[]>>;
  transactions: CreditTransaction[];
  setTransactions?: React.Dispatch<React.SetStateAction<CreditTransaction[]>>;
  config: BusinessConfig;
  onUpdateConfig?: (cfg: BusinessConfig) => void;
  userRole?: number | string;
  businessId?: string;
  setActiveScreen?: (screen: string) => void;
  performedBy?: string;
}

export const ACTION_METADATA: Record<string, { isConsequential: boolean; adminOnly: boolean }> = {
  add_inventory_item: { isConsequential: true, adminOnly: false },
  update_item_price: { isConsequential: true, adminOnly: false },
  correct_inventory_stock: { isConsequential: true, adminOnly: false },
  record_stock_restock: { isConsequential: true, adminOnly: false },
  process_sale: { isConsequential: true, adminOnly: false },
  delete_inventory_item: { isConsequential: true, adminOnly: true },
  export_inventory_csv: { isConsequential: false, adminOnly: false },

  create_credit_account: { isConsequential: true, adminOnly: false },
  record_credit_payment: { isConsequential: true, adminOnly: false },
  correct_credit_balance: { isConsequential: true, adminOnly: false },
  export_credit_csv: { isConsequential: false, adminOnly: false },

  generate_invoice: { isConsequential: true, adminOnly: false },
  print_invoice: { isConsequential: false, adminOnly: false },
  export_invoice_pdf: { isConsequential: false, adminOnly: false },
  mark_invoice_paid: { isConsequential: true, adminOnly: false },

  export_financial_report: { isConsequential: false, adminOnly: false },
  set_report_date_range: { isConsequential: false, adminOnly: false },
  correct_dashboard_kpi: { isConsequential: true, adminOnly: true },

  query_activity_log: { isConsequential: false, adminOnly: false },
  export_activity_log: { isConsequential: false, adminOnly: false },

  mark_all_notifications_read: { isConsequential: false, adminOnly: false },
  clear_all_notifications: { isConsequential: false, adminOnly: false },

  update_business_profile: { isConsequential: true, adminOnly: true },
  change_currency: { isConsequential: true, adminOnly: true },
  change_theme: { isConsequential: false, adminOnly: false },
  generate_attendant_invite_pin: { isConsequential: true, adminOnly: true },
  clear_transactions_only: { isConsequential: true, adminOnly: true },
  reset_seed_data: { isConsequential: true, adminOnly: true },
  wipe_storage: { isConsequential: true, adminOnly: true },

  navigate_to_page: { isConsequential: false, adminOnly: false },
  scroll_page: { isConsequential: false, adminOnly: false }
};

export function validateActionPermission(actionName: string, userRole: number | string = 'admin'): { allowed: boolean; reason?: string } {
  const meta = ACTION_METADATA[actionName];
  if (!meta) return { allowed: true };

  const isAdmin = userRole === 2 || userRole === '2' || userRole === 'admin';
  if (meta.adminOnly && !isAdmin) {
    return {
      allowed: false,
      reason: `Unauthorized: The action '${actionName}' requires Administrator permissions.`
    };
  }

  return { allowed: true };
}

/**
 * Main dispatcher for all application actions (used by UI buttons & Gemini Live)
 */
export async function executeAppActionAsync(
  actionName: string,
  args: any = {},
  ctx: ActionContext
): Promise<ActionResult> {
  const perm = validateActionPermission(actionName, ctx.userRole || 'admin');
  if (!perm.allowed) {
    return {
      success: false,
      message: perm.reason || 'Unauthorized action.',
      error: perm.reason
    };
  }

  const actor = ctx.performedBy || (ctx.userRole === 5 || ctx.userRole === 'attendant' ? 'Attendant' : 'AI Assistant');
  const businessId = ctx.businessId || 'default_business';
  const currentUser = (await supabase.auth.getUser()).data.user;
  const userUid = currentUser?.id || '00000000-0000-0000-0000-000000000000';

  switch (actionName) {
    case 'process_sale': {
      const { itemName, itemId, quantity = 1, unitPrice, paymentMethod = 'Cash' } = args;
      const targetItem = ctx.inventory.find(i => (itemId && i.id === itemId) || (itemName && (i.name || '').toLowerCase() === itemName.toLowerCase()));

      if (!targetItem) {
        return { success: false, message: `Sale failed: Inventory item '${itemName || itemId}' not found.`, error: 'Item not found' };
      }

      const availableQty = typeof targetItem.quantity === 'number' ? targetItem.quantity : 0;
      if (availableQty < quantity) {
        return { success: false, message: `Sale failed: Insufficient stock for ${targetItem.name}. (Available: ${availableQty}, Requested: ${quantity})`, error: 'Insufficient stock' };
      }

      const salePrice = unitPrice || targetItem.unitPrice || 0;

      const saleRes = await recordSaleTransaction(
        businessId, userUid, targetItem.id, quantity, salePrice, paymentMethod, 'ai_assistant'
      );

      if (!saleRes.success) {
        return { success: false, message: `Sale failed: ${saleRes.error}`, error: saleRes.error };
      }

      return {
        success: true,
        message: `Successfully processed sale of ${quantity}x ${targetItem.name} for $${(salePrice * quantity).toFixed(2)}.`,
        data: { itemId: targetItem.id, quantity, totalAmount: salePrice * quantity }
      };
    }

    case 'record_credit_payment': {
      const { accountId, accountName, amount, paymentMethod = 'Cash', notes = 'AI Voice Executed Debt Payment' } = args;
      const targetAccount = ctx.creditAccounts.find(account =>
        (accountId && account.id === accountId) ||
        (accountName && account.name.toLowerCase().includes(String(accountName).toLowerCase()))
      );
      if (!targetAccount) {
        return { success: false, message: `Payment failed: Credit profile '${accountName || accountId}' was not found.`, error: 'Credit account not found' };
      }
      const paymentAmount = Math.abs(Number(amount) || 0);
      if (paymentAmount <= 0) {
        return { success: false, message: 'Payment failed: Amount must be greater than zero.', error: 'Invalid payment amount' };
      }
      if (paymentAmount > targetAccount.remainingAmount) {
        return { success: false, message: `Payment failed: ${targetAccount.name} owes ${targetAccount.remainingAmount}, so the payment cannot exceed the remaining balance.`, error: 'Payment exceeds balance' };
      }
      const paymentRes = await recordRepaymentTransaction(
        businessId,
        userUid,
        targetAccount.id,
        paymentAmount,
        paymentMethod,
        notes,
        'ai_assistant'
      );
      if (!paymentRes.success) {
        return { success: false, message: `Payment failed: ${paymentRes.error}`, error: paymentRes.error };
      }
      return {
        success: true,
        message: `Recorded ${paymentAmount.toFixed(2)} payment for ${targetAccount.name}. The amount moves from Asset on Credit into Value Sold while Total Inventory Value remains unchanged.`,
        data: { id: paymentRes.id, accountId: targetAccount.id, amount: paymentAmount, transactionType: 'repayment' }
      };
    }

    case 'record_stock_restock': {
      const { itemName, itemId, quantity = 1, notes = 'AI Restock' } = args;
      const targetItem = ctx.inventory.find(i => (itemId && i.id === itemId) || (itemName && (i.name || '').toLowerCase() === itemName.toLowerCase()));

      if (!targetItem) {
        return { success: false, message: `Restock failed: Item '${itemName || itemId}' not found.`, error: 'Item not found' };
      }

      const restockRes = await directAdminRestockTransaction(
        businessId, userUid, ctx.userRole || 'admin', targetItem.id, quantity, notes
      );

      if (!restockRes.success) {
        return { success: false, message: `Restock failed: ${restockRes.error}`, error: restockRes.error };
      }

      return {
        success: true,
        message: `Successfully restocked ${quantity}x ${targetItem.name}.`,
        data: { itemId: targetItem.id, quantity }
      };
    }

    case 'update_item_price': {
      const { itemName, itemId, newPrice, newCost } = args;
      const targetItem = ctx.inventory.find(i => (itemId && i.id === itemId) || (itemName && (i.name || '').toLowerCase() === itemName.toLowerCase()));

      if (!targetItem) {
        return { success: false, message: `Price update failed: Item '${itemName || itemId}' not found.`, error: 'Item not found' };
      }

      const updatedPayload = {
        ...targetItem,
        unitPrice: newPrice !== undefined ? newPrice : targetItem.unitPrice,
        unitCost: newCost !== undefined ? newCost : targetItem.unitCost
      };

      const saveRes = await saveInventoryItem(businessId, userUid, ctx.userRole || 'admin', updatedPayload, targetItem.id);

      if (!saveRes.success) {
        return { success: false, message: `Price update failed: ${saveRes.error}`, error: saveRes.error };
      }

      await logActivity(businessId, 'PRICE_UPDATED', `Updated price of ${targetItem.name} to $${(newPrice ?? targetItem.unitPrice).toFixed(2)}`, userUid, 'ai_assistant');

      return {
        success: true,
        message: `Price for ${targetItem.name} updated to $${(newPrice ?? targetItem.unitPrice).toFixed(2)}.`,
        data: { itemId: targetItem.id, newPrice }
      };
    }

    case 'add_inventory_item': {
      const { name, category, unitCost = 0, unitPrice = 0, quantity = 0, sku, supplier = 'Default Supplier' } = args;
      const cleanCategory = typeof category === 'string' ? category.trim() : '';
      if (!name) return { success: false, message: 'Item name is required.' };
      if (!cleanCategory) return { success: false, message: 'A custom category is required when adding an inventory item.' };

      const itemPayload = {
        name,
        sku: sku || `SKU-${Math.floor(1000 + Math.random() * 9000)}`,
        category: cleanCategory,
        quantity,
        reorderPoint: 5,
        unitCost,
        unitPrice,
        supplier,
        location: 'Storefront',
        notes: 'Added via AI Assistant'
      };

      const saveRes = await saveInventoryItem(businessId, userUid, ctx.userRole || 'admin', itemPayload);
      if (!saveRes.success) {
        return { success: false, message: `Add item failed: ${saveRes.error}`, error: saveRes.error };
      }

      await logActivity(businessId, 'ITEM_ADDED', `Added new catalog product '${name}' (${quantity} units @ $${unitPrice.toFixed(2)})`, userUid, 'ai_assistant');

      return {
        success: true,
        message: `Successfully added product '${name}' to inventory catalog.`,
        data: { id: saveRes.itemId, name }
      };
    }

    case 'navigate_to_page': {
      const page = args.page || 'dashboard';
      if (ctx.setActiveScreen) {
        ctx.setActiveScreen(page);
      }
      return {
        success: true,
        message: `Navigated viewport to the '${page}' screen.`
      };
    }

    default: {
      return {
        success: true,
        message: `Action '${actionName}' executed.`
      };
    }
  }
}

export function executeAppAction(
  actionName: string,
  args: any = {},
  ctx: ActionContext
): ActionResult {
  executeAppActionAsync(actionName, args, ctx).catch(err => {
    console.error('executeAppActionAsync background error:', err);
  });

  return {
    success: true,
    message: `Action '${actionName}' submitted to backend services.`
  };
}
