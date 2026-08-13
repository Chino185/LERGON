import { StockAdjustment, CreditTransaction, InventoryItem, CreditAccount } from '../types';

export interface ActivityItem {
  id: string;
  timestamp: string; // ISO string
  formattedTime: string; // e.g. "Aug 8, 8:40 AM"
  performedBy: string;
  category: 'stock' | 'credit' | 'system';
  type: string; // 'sale_out' | 'purchase_in' | 'damaged' | 'returned' | 'pay' | 'borrow' | 'add_item' | 'price_edit'
  title: string;
  description: string;
  amount?: number;
  qty?: number;
  itemName?: string;
  accountName?: string;
}

type ActivityListener = (activity: ActivityItem, summary: string) => void;

class ActivityLoggerService {
  private listeners: Set<ActivityListener> = new Set();
  private sessionLogs: ActivityItem[] = [];

  public subscribe(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(activity: ActivityItem) {
    this.sessionLogs.unshift(activity);
    if (this.sessionLogs.length > 100) {
      this.sessionLogs.pop();
    }
    const summary = `${activity.formattedTime}, ${activity.performedBy}: ${activity.description}`;
    this.listeners.forEach(fn => {
      try {
        fn(activity, summary);
      } catch (err) {
        console.error('Error in activity listener:', err);
      }
    });
  }

  public getSessionLogs(): ActivityItem[] {
    return this.sessionLogs;
  }
}

export const activityLogger = new ActivityLoggerService();

function maskSensitiveData(text: string): string {
  if (!text) return text;
  return text.replace(/(pass(?:word)?|pin|secret|passcode|token)=['"]?([^'"\s]+)['"]?/gi, '$1=[REDACTED]');
}

/**
 * Centralized activity logging helper
 */
export function logActivity(data: {
  performedBy?: string;
  category: 'stock' | 'credit' | 'system';
  type: string;
  title: string;
  description: string;
  amount?: number;
  qty?: number;
  itemName?: string;
  accountName?: string;
}): ActivityItem {
  const d = new Date();
  const formattedTime = d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });

  const activity: ActivityItem = {
    id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: d.toISOString(),
    formattedTime,
    performedBy: maskSensitiveData(data.performedBy || 'Operator'),
    category: data.category,
    type: data.type,
    title: maskSensitiveData(data.title),
    description: maskSensitiveData(data.description),
    amount: data.amount,
    qty: data.qty,
    itemName: maskSensitiveData(data.itemName || ''),
    accountName: maskSensitiveData(data.accountName || '')
  };

  activityLogger.emit(activity);
  return activity;
}

/**
 * Builds unified sorted array of all activity logs from adjustments and transactions
 */
export function buildUnifiedActivities(
  adjustments: StockAdjustment[] = [],
  transactions: CreditTransaction[] = [],
  inventory: InventoryItem[] = [],
  creditAccounts: CreditAccount[] = []
): ActivityItem[] {
  const list: ActivityItem[] = [];

  // 1. Process physical stock adjustments
  adjustments.forEach(adj => {
    const item = inventory.find(i => i.id === adj.itemId);
    const d = new Date(adj.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (adj.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let type = adj.type || 'audit';
    let title = `Stock Adjustment: ${adj.itemName || 'Item'}`;
    let description = `${adj.performedBy || 'Operator'} adjusted stock of ${adj.itemName || 'item'} by ${adj.qtyChanged > 0 ? '+' : ''}${adj.qtyChanged}`;

    if (adj.type === 'purchase_in') {
      type = 'restock';
      title = `Restocked ${adj.itemName || 'Item'}`;
      description = `${adj.performedBy || 'Operator'} restocked ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    } else if (adj.type === 'sale_out') {
      type = 'sell';
      title = `Sold ${adj.itemName || 'Item'}`;
      description = `${adj.performedBy || 'Operator'} sold ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    } else if (adj.type === 'damaged') {
      type = 'damaged';
      title = `Reported Damaged: ${adj.itemName || 'Item'}`;
      description = `${adj.performedBy || 'Operator'} reported ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'} as damaged`;
    } else if (adj.type === 'returned') {
      type = 'returned';
      title = `Returned Item: ${adj.itemName || 'Item'}`;
      description = `${adj.performedBy || 'Operator'} logged return of ${Math.abs(adj.qtyChanged)}x ${adj.itemName || 'item'}`;
    }

    if (adj.notes && !description.includes(adj.notes)) {
      description += ` (${adj.notes})`;
    }

    list.push({
      id: `adj-${adj.id}`,
      timestamp: adj.date || new Date().toISOString(),
      formattedTime,
      performedBy: adj.performedBy || 'Operator',
      category: 'stock',
      type,
      title,
      description,
      qty: Math.abs(adj.qtyChanged),
      itemName: adj.itemName
    });
  });

  // 2. Process credit transactions
  transactions.forEach(tx => {
    const account = creditAccounts.find(a => a.id === tx.creditAccountId);
    const d = new Date(tx.date || Date.now());
    const formattedTime = isNaN(d.getTime())
      ? (tx.date || 'Recently')
      : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    let type = tx.type || 'credit';
    let title = `Credit Activity: ${tx.accountName || 'Account'}`;
    const safeAmount = typeof tx.amount === 'number' && !isNaN(tx.amount) ? tx.amount : 0;
    let description = `${tx.flaggedBy || 'Operator'} recorded ${tx.type} of $${safeAmount.toFixed(2)} for ${tx.accountName || 'customer'}`;

    if (tx.type === 'pay') {
      type = 'payment';
      title = `Payment Received from ${tx.accountName || 'Account'}`;
      description = `${tx.flaggedBy || 'Operator'} received payment of $${safeAmount.toFixed(2)} from ${tx.accountName || 'customer'}`;
    } else if (tx.type === 'borrow' || tx.type === 'charge') {
      type = 'credit_sale';
      title = `Credit Given to ${tx.accountName || 'Account'}`;
      description = `${tx.flaggedBy || 'Operator'} issued $${safeAmount.toFixed(2)} credit to ${tx.accountName || 'customer'}`;
    }

    if (tx.notes && !description.includes(tx.notes)) {
      description += ` (${tx.notes})`;
    }

    list.push({
      id: `tx-${tx.id}`,
      timestamp: tx.date || new Date().toISOString(),
      formattedTime,
      performedBy: tx.flaggedBy || 'Operator',
      category: 'credit',
      type,
      title,
      description,
      amount: tx.amount,
      accountName: tx.accountName
    });
  });

  // Sort descending by timestamp
  return list.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime() || 0;
    const timeB = new Date(b.timestamp).getTime() || 0;
    return timeB - timeA;
  });
}

/**
 * Builds lightweight summary string of recent rolling actions (default last 15-20)
 * for automatic Gemini context injection.
 */
export function getRecentActivityContext(
  adjustments: StockAdjustment[] = [],
  transactions: CreditTransaction[] = [],
  inventory: InventoryItem[] = [],
  creditAccounts: CreditAccount[] = [],
  limit: number = 15
): string {
  const unified = buildUnifiedActivities(adjustments, transactions, inventory, creditAccounts);
  const recent = unified.slice(0, limit);

  if (recent.length === 0) {
    return "No recent activity logged in current session.";
  }

  const lines = recent.map(act => `- ${act.formattedTime}: ${act.description}`);
  return `=== RECENT APP ACTIVITY LOG (Rolling Window - Last ${recent.length} Actions) ===\n${lines.join('\n')}`;
}

/**
 * On-demand deep activity query tool function for Gemini function calling.
 */
export function queryActivityLog(
  adjustments: StockAdjustment[] = [],
  transactions: CreditTransaction[] = [],
  inventory: InventoryItem[] = [],
  creditAccounts: CreditAccount[] = [],
  filters: {
    activityType?: string;
    itemName?: string;
    accountName?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  } = {}
): string {
  let list = buildUnifiedActivities(adjustments, transactions, inventory, creditAccounts);

  if (filters.activityType && filters.activityType !== 'all') {
    const targetType = filters.activityType.toLowerCase();
    list = list.filter(act => 
      act.type.toLowerCase().includes(targetType) || 
      act.category.toLowerCase().includes(targetType)
    );
  }

  if (filters.itemName) {
    const targetItem = filters.itemName.toLowerCase();
    list = list.filter(act => 
      (act.itemName && act.itemName.toLowerCase().includes(targetItem)) ||
      act.description.toLowerCase().includes(targetItem)
    );
  }

  if (filters.accountName) {
    const targetAcc = filters.accountName.toLowerCase();
    list = list.filter(act => 
      (act.accountName && act.accountName.toLowerCase().includes(targetAcc)) ||
      act.description.toLowerCase().includes(targetAcc)
    );
  }

  if (filters.startDate) {
    const startMs = new Date(filters.startDate).getTime();
    if (!isNaN(startMs)) {
      list = list.filter(act => new Date(act.timestamp).getTime() >= startMs);
    }
  }

  if (filters.endDate) {
    const endMs = new Date(filters.endDate).getTime() + (24 * 60 * 60 * 1000);
    if (!isNaN(endMs)) {
      list = list.filter(act => new Date(act.timestamp).getTime() <= endMs);
    }
  }

  const maxReturn = filters.limit || 30;
  const matches = list.slice(0, maxReturn);

  if (matches.length === 0) {
    return `No activity log entries found matching query filters (${JSON.stringify(filters)}).`;
  }

  const lines = matches.map(act => `- ${act.formattedTime}: ${act.description}`);
  return `=== QUERY ACTIVITY LOG RESULTS (${matches.length} entries matched) ===\n${lines.join('\n')}`;
}
