import React, { useState, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Plus,
  Minus,
  Search,
  CheckCircle2,
  X,
  Activity,
  ClipboardList,
  ListPlus,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Check,
  Sparkles,
  RotateCw
} from 'lucide-react';
import {
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { InventoryItem, CreditAccount, StockAdjustment, CreditTransaction, BusinessConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';

interface DashboardProps {
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  config: BusinessConfig;
  userRole?: number;
  isLoading?: boolean;
  onQuickStockIn: (items: Array<{ itemId: string; qty: number }>, notes: string) => void;
  onQuickStockOut: (items: Array<{ itemId: string; qty: number }>, notes: string, creditAccountId?: string, totalAmount?: number) => void;
  onQuickRepayment: (accountId: string, amount: number, notes: string) => void;
  onNavigate?: (screen: string) => void;
  onUpdateConfig?: (newConfig: BusinessConfig) => void;
}



const getShowcaseImageUrl = (imageUrl: string): string => {
  const storageMarker = '/storage/v1/object/public/inventory-images/';
  const markerIndex = imageUrl.indexOf(storageMarker);
  if (markerIndex === -1) return imageUrl;
  const baseUrl = imageUrl.slice(0, markerIndex);
  const objectPath = imageUrl.slice(markerIndex + storageMarker.length);
  return `${baseUrl}/storage/v1/render/image/public/inventory-images/${objectPath}?width=1200&quality=78&resize=contain`;
};

const getItemImage = (name: string, category: string): string => {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('keyboard')) {
    return 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=90';
  }
  if (nameLower.includes('backpack')) {
    return 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=90';
  }
  if (nameLower.includes('hub') || nameLower.includes('usb-c') || nameLower.includes('thunderbolt')) {
    return 'https://images.unsplash.com/photo-1546054454-aa26e2b734c7?auto=format&fit=crop&w=1200&q=90';
  }
  if (nameLower.includes('tumbler') || nameLower.includes('bottle') || nameLower.includes('mug')) {
    return 'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=1200&q=90';
  }
  if (nameLower.includes('headphone') || nameLower.includes('earphone')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=90';
  }
  if (nameLower.includes('desk pad') || nameLower.includes('leather')) {
    return 'https://images.unsplash.com/photo-1585776245991-cf89dd7fc73a?auto=format&fit=crop&w=1200&q=90';
  }

  // Category fallbacks
  const catLower = category.toLowerCase();
  if (catLower.includes('electronics')) {
    return 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=90';
  }
  if (catLower.includes('apparel') || catLower.includes('clothing')) {
    return 'https://images.unsplash.com/photo-1489987707025-afc232f7ea0f?auto=format&fit=crop&w=1200&q=90';
  }
  if (catLower.includes('home') || catLower.includes('office')) {
    return 'https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?auto=format&fit=crop&w=1200&q=90';
  }

  return `https://picsum.photos/seed/${encodeURIComponent(name)}/800/600`;
};

export default function DashboardScreen({
  inventory,
  creditAccounts,
  adjustments,
  transactions,
  config,
  userRole,
  onQuickStockIn,
  onQuickStockOut,
  onQuickRepayment,
  onNavigate,
  onUpdateConfig
}: DashboardProps) {
  // Quick Actions States
  const [quickAction, setQuickAction] = useState<'none' | 'stock_in' | 'stock_out' | 'stock_out_credit' | 'repayment'>('none');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState<number | ''>('');
  const [repaymentNotes, setRepaymentNotes] = useState('');



  // Business Health Score computation and state
  const healthMetrics = useMemo(() => {
    // 1. Inventory sub-score
    const totalItemsTracked = inventory.length;
    const outOfStockCount = inventory.filter(i => (i.quantity || 0) <= 0).length;
    const lowStockCount = inventory.filter(i => (i.quantity || 0) > 0 && (i.quantity || 0) <= (i.reorderPoint || 0)).length;

    let inventoryScore = 100;
    if (totalItemsTracked > 0) {
      const outDeduction = (outOfStockCount / totalItemsTracked) * 100;
      const lowDeduction = (lowStockCount / totalItemsTracked) * 40;
      inventoryScore = Math.max(0, 100 - (outDeduction + lowDeduction));
    }

    // 2. Credit Risk sub-score
    const totalAccounts = creditAccounts.length;
    const highOrCriticalRiskCount = creditAccounts.filter(a => {
      const amt = a.remainingAmount || 0;
      return a.status === 'overdue' || (a.status === 'active' && amt > 1000);
    }).length;

    let creditScore = 100;
    if (totalAccounts > 0) {
      creditScore = Math.max(0, 100 - (highOrCriticalRiskCount / totalAccounts) * 100);
    }

    // 3. Discrepancy sub-score
    const unresolvedAdjustments = adjustments.filter(a => a.isFlagged && !a.isResolved).length;
    const unresolvedTransactions = transactions.filter(t => t.isFlagged && !t.isResolved).length;
    const totalUnresolved = unresolvedAdjustments + unresolvedTransactions;
    const discrepancyScore = Math.max(0, 100 - totalUnresolved * 15);

    // 4. Combined weighted Score
    const finalScore = Math.round((inventoryScore * 0.4) + (creditScore * 0.4) + (discrepancyScore * 0.2));

    return {
      finalScore,
      inventoryScore,
      outOfStockCount,
      lowStockCount,
      totalItemsTracked,
      creditScore,
      highOrCriticalRiskCount,
      totalAccounts,
      discrepancyScore,
      totalUnresolved
    };
  }, [inventory, creditAccounts, adjustments, transactions]);

  const [healthExplanation, setHealthExplanation] = useState<string>('');
  const [loadingHealth, setLoadingHealth] = useState<boolean>(false);

  const fetchHealthExplanation = async () => {
    setLoadingHealth(true);
    try {
      const prompt = `As a professional and encouraging business advisor, explain this business's Health Score in exactly one clear, encouraging-but-honest sentence in plain language for a shop owner.
Data:
- Overall Health Score: ${healthMetrics.finalScore}/100
- Inventory Score: ${Math.round(healthMetrics.inventoryScore)}/100 (${healthMetrics.outOfStockCount} out of stock, ${healthMetrics.lowStockCount} low stock out of ${healthMetrics.totalItemsTracked} items)
- Debtor Credit Risk Score: ${Math.round(healthMetrics.creditScore)}/100 (${healthMetrics.highOrCriticalRiskCount} critical/high risk debtors out of ${healthMetrics.totalAccounts} accounts)
- Log Discrepancies Score: ${Math.round(healthMetrics.discrepancyScore)}/100 (${healthMetrics.totalUnresolved} unresolved flagged issues)

Keep it to exactly one human, actionable, and warm sentence. Do not return any introduction or wrapper. Just the single sentence of advice.`;

      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          systemInstruction: "You are a professional business health consultant helping small shop owners audit their operational state. Keep answers extremely short, strictly limited to one encouraging-but-honest sentence in plain English."
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch explanation');
      }

      const data = await response.json();
      setHealthExplanation(data.text || getProgrammaticHealthExplanation(healthMetrics.finalScore));
    } catch (err) {
      console.log("Chat endpoint failed, using local rule-based fallback advice", err);
      setHealthExplanation(getProgrammaticHealthExplanation(healthMetrics.finalScore));
    } finally {
      setLoadingHealth(false);
    }
  };

  function getProgrammaticHealthExplanation(score: number) {
    if (score >= 90) {
      return "Superb! Your shop has healthy inventory, strong credit accounts in good standing, and no pending discrepancies.";
    } else if (score >= 70) {
      return "Good job! Operational health is solid, but addressing those minor stock-outs or overdue credit balances will keep you thriving.";
    } else if (score >= 50) {
      return "A bit of attention is needed: you have a few out-of-stock items and outstanding debtor risk that should be managed.";
    } else {
      return "Action advised: critical out-of-stock items, high credit risk levels, and unresolved data discrepancies need immediate resolution.";
    }
  }

  // Trigger on score changes
  React.useEffect(() => {
    fetchHealthExplanation();
  }, [healthMetrics.finalScore]);

  // Bulk interactive planner/multi-selector states
  const [showMultiSelectModal, setShowMultiSelectModal] = useState(false);
  const [multiSelectQuantities, setMultiSelectQuantities] = useState<Record<string, number>>({});
  const [restockSearchQuery, setRestockSearchQuery] = useState('');
  const [sellSearchQuery, setSellSearchQuery] = useState('');
  const modalSearchQuery = quickAction === 'stock_in' ? restockSearchQuery : sellSearchQuery;
  const setModalSearchQuery = (val: string) => {
    if (quickAction === 'stock_in') {
      setRestockSearchQuery(val);
    } else {
      setSellSearchQuery(val);
    }
  };
  const [modalLowStockOnly, setModalLowStockOnly] = useState(false);
  const [activeMobileTab, setActiveMobileTab] = useState<'picker' | 'basket'>('picker');

  // Basket list for multiple item restock/sale entries
  const [basketItems, setBasketItems] = useState<Array<{
    itemId: string;
    name: string;
    sku: string;
    qty: number;
    unitPrice: number;
    unitCost: number;
  }>>([]);

  // Search query states for searchable product and client select dialogs
  const [itemQuery, setItemQuery] = useState('');
  const [isItemDropdownOpen, setIsItemDropdownOpen] = useState(false);
  const [accountQuery, setAccountQuery] = useState('');
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  // Dense Dashboard UI Search
  const [itemSearch, setItemSearch] = useState('');

  // Auto Image Slider State for Showcase Carousel
  const [sliderIndex, setSliderIndex] = useState(0);

  React.useEffect(() => {
    if (inventory.length <= 1) return;
    const interval = setInterval(() => {
      setSliderIndex((prev) => (prev + 1) % inventory.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [inventory.length]);

  // Profit Analysis Modal States
  const [isProfitModalOpen, setIsProfitModalOpen] = useState(false);
  const [profitSearchQuery, setProfitSearchQuery] = useState('');

  // Inline Notification Banner (Replaces unsafe window.alert)
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const triggerFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type });
    setTimeout(() => {
      setFeedback(null);
    }, 4500);
  };

  const { formatAmount } = useCurrency();

  const formatMoney = (amount: number) => {
    return formatAmount(amount);
  };

  // --- Calculations for KPIs ---
  // Inventory page total value is retail value at the current quantity. It is
  // the value of stock physically in hand, not the cumulative value originally
  // introduced into the business.
  const totalCostValue = inventory.reduce((acc, item) => acc + (item.quantity * item.unitCost), 0);
  const stockInHandRetailValue = inventory.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  const totalRetailValue = stockInHandRetailValue;

  // Receivables (Asset on Credit) is the currently outstanding customer debt.
  // It is intentionally separate from historical credit-sale value: repayment
  // changes receivables, but it does not put sold stock back into inventory.
  const receivablesTotalCalculated = creditAccounts
    .filter(a => a.type === 'receivable' && a.status !== 'settled')
    .reduce((acc, a) => acc + a.remainingAmount, 0);
  const receivablesTotal = receivablesTotalCalculated;

  // Use sale-time values stored in transactions. Falling back to typed stock
  // adjustments keeps older records visible until their transaction snapshots
  // are available, while avoiding the old error of pricing historical sales at
  // today's inventory price and subtracting current receivables from revenue.
  const saleTotals = useMemo(() => {
    const persistedTotals = transactions.reduce((totals, tx) => {
      const txType = tx.transactionType;
      const lines = Array.isArray(tx.lineItems) ? tx.lineItems : [];
      const saleLines = lines.filter(line => line.item_id && line.quantity && line.unit_price !== undefined);
      if (txType === 'repayment') {
        const account = creditAccounts.find(acc => acc.id === tx.creditAccountId);
        if (account?.type === 'receivable') {
          totals.paidCredit += Number(tx.amount) || 0;
          totals.hasPersistedMovement = true;
        }
        return totals;
      }
      if (saleLines.length === 0) return totals;

      const amount = saleLines.reduce((sum, line) => {
        const quantity = Math.abs(Number(line.quantity) || 0);
        const unitPrice = Number(line.unit_price) || 0;
        return sum + quantity * unitPrice;
      }, 0);

      if (txType === 'sell') totals.cash += amount;
      if (txType === 'credit') totals.credit += amount;
      totals.hasPersistedMovement = true;
      return totals;
    }, { cash: 0, credit: 0, paidCredit: 0, hasPersistedMovement: false });

    if (persistedTotals.hasPersistedMovement) {
      return persistedTotals;
    }

    return adjustments
      .filter(adj => adj.type === 'sale_out')
      .reduce((totals, adj) => {
        const item = inventory.find(i => i.id === adj.itemId);
        const value = Math.abs(adj.qtyChanged) * (item?.unitPrice || 0);
        const note = (adj.notes || '').toLowerCase();
        const isCredit = Boolean(adj.creditAccountId) || /credit|credited|crediting|sold on credit|on credit|debt|receivable|billed|pay later|unpaid|terms/.test(note);
        if (isCredit) totals.credit += value;
        else totals.cash += value;
        return totals;
      }, { cash: 0, credit: 0, paidCredit: 0, hasPersistedMovement: false });
  }, [transactions, adjustments, inventory, creditAccounts]);

  const cashSalesValue = saleTotals.cash;
  const paidCreditValue = saleTotals.paidCredit;
  const valueSold = cashSalesValue + paidCreditValue;
  const creditSalesValue = saleTotals.credit;

  // Unpaid customer credit remains an asset. Repayments move into Value Sold.
  // Restocks increase stock in hand and therefore increase cumulative value.
  const totalInventoryValue = stockInHandRetailValue + valueSold + receivablesTotal;
  const stockInHandValue = Math.max(0, totalInventoryValue - valueSold - receivablesTotal);
  const potentialProfit = totalRetailValue - totalCostValue;

  // Helpers to identify credit sale status and calculate realized profits
  const getLinkedAccount = (adj: StockAdjustment) => {
    if (adj.creditAccountId) {
      return creditAccounts.find(c => c.id === adj.creditAccountId);
    }
    // Check notes for matching account
    const notesLower = (adj.notes || '').toLowerCase();
    const isCreditPhrase =
      notesLower.includes('credit') ||
      notesLower.includes('credited') ||
      notesLower.includes('crediting') ||
      notesLower.includes('sold on credit') ||
      notesLower.includes('on credit') ||
      notesLower.includes('billed on terms') ||
      notesLower.includes('repayment') ||
      notesLower.includes('debt') ||
      notesLower.includes('receivable') ||
      notesLower.includes('pay later') ||
      notesLower.includes('unpaid') ||
      notesLower.includes('terms');

    if (isCreditPhrase) {
      for (const acc of creditAccounts) {
        if (acc.type !== 'receivable') continue;
        if (notesLower.includes(acc.name.toLowerCase())) {
          return acc;
        }
        const nameParts = acc.name.toLowerCase().split(' ');
        if (nameParts.some(part => part.length > 2 && notesLower.includes(part))) {
          return acc;
        }
      }
    }
    return null;
  };

  const isCreditAdjustment = (adj: StockAdjustment) => {
    if (adj.creditAccountId) return true;
    if (getLinkedAccount(adj) !== null) return true;
    const notesLower = (adj.notes || '').toLowerCase();
    return (
      notesLower.includes('credit') ||
      notesLower.includes('credited') ||
      notesLower.includes('crediting') ||
      notesLower.includes('sold on credit') ||
      notesLower.includes('on credit') ||
      notesLower.includes('debt') ||
      notesLower.includes('receivable') ||
      notesLower.includes('billed') ||
      notesLower.includes('pay later') ||
      notesLower.includes('unpaid') ||
      notesLower.includes('terms')
    );
  };

  const getCreditAccountPaidRatio = (account: CreditAccount | null) => {
    if (!account) return 0;
    if (account.totalAmount <= 0) return 1;
    const ratio = (account.totalAmount - account.remainingAmount) / account.totalAmount;
    return Math.max(0, Math.min(1, ratio));
  };

  const realizedProfitCalculated = adjustments
    .filter(adj => adj.type === 'sale_out')
    .reduce((acc, adj) => {
      const item = inventory.find(i => i.id === adj.itemId);
      if (item) {
        const margin = item.unitPrice - item.unitCost;
        const totalProfitPossible = Math.abs(adj.qtyChanged) * margin;

        if (isCreditAdjustment(adj)) {
          const account = getLinkedAccount(adj);
          if (account) {
            const paidRatio = getCreditAccountPaidRatio(account);
            return acc + (totalProfitPossible * paidRatio);
          }
          return acc;
        }

        return acc + totalProfitPossible;
      }
      return acc;
    }, 0);

  const realizedProfit = (config.realizedProfitOverride !== undefined && config.realizedProfitOverride !== null)
    ? config.realizedProfitOverride
    : realizedProfitCalculated;

  // Profit margins breakdown per sale & grouped by item
  const soldItemsBreakdown = useMemo(() => {
    return adjustments
      .filter(adj => adj.type === 'sale_out')
      .map(adj => {
        const item = inventory.find(i => i.id === adj.itemId);
        const qty = Math.abs(adj.qtyChanged);
        const unitCost = item ? item.unitCost : 0;
        const unitPrice = item ? item.unitPrice : 0;
        const revenue = qty * unitPrice;
        const cost = qty * unitCost;

        const totalProfitPossible = revenue - cost;
        const isOnCredit = isCreditAdjustment(adj);
        const account = getLinkedAccount(adj);

        const paidRatio = account ? getCreditAccountPaidRatio(account) : 0;
        const profit = isOnCredit ? totalProfitPossible * paidRatio : totalProfitPossible;
        let creditStatus: 'cash' | 'credit_unpaid' | 'credit_paid' = 'cash';

        if (isOnCredit) {
          creditStatus = paidRatio >= 1 ? 'credit_paid' : 'credit_unpaid';
        }

        return {
          id: adj.id,
          date: adj.date,
          itemId: adj.itemId,
          itemName: adj.itemName || item?.name || 'Unknown Product',
          sku: item?.sku || 'N/A',
          category: item?.category || 'Uncategorized',
          qty,
          unitCost,
          unitPrice,
          revenue,
          cost,
          profit,
          notes: adj.notes,
          isOnCredit,
          creditStatus,
          clientName: account ? account.name : undefined
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, inventory, creditAccounts, transactions]);

  const aggregatedSoldItemsBreakdown = useMemo(() => {
    const groups: {
      [itemId: string]: {
        itemId: string;
        itemName: string;
        sku: string;
        category: string;
        totalQty: number;
        unitCost: number;
        unitPrice: number;
        totalRevenue: number;
        totalCost: number;
        totalProfit: number;
      }
    } = {};

    soldItemsBreakdown.forEach(record => {
      const id = record.itemId;
      if (!groups[id]) {
        groups[id] = {
          itemId: id,
          itemName: record.itemName,
          sku: record.sku,
          category: record.category,
          totalQty: 0,
          unitCost: record.unitCost,
          unitPrice: record.unitPrice,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0
        };
      }
      groups[id].totalQty += record.qty;
      groups[id].totalRevenue += record.revenue;
      groups[id].totalCost += record.cost;
      groups[id].totalProfit += record.profit;
    });

    return Object.values(groups).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [soldItemsBreakdown]);

  const filteredSoldItems = useMemo(() => {
    const q = profitSearchQuery.trim().toLowerCase();
    if (!q) return soldItemsBreakdown;
    return soldItemsBreakdown.filter(item =>
      item.itemName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [soldItemsBreakdown, profitSearchQuery]);

  const filteredAggregatedSoldItems = useMemo(() => {
    const q = profitSearchQuery.trim().toLowerCase();
    if (!q) return aggregatedSoldItemsBreakdown;
    return aggregatedSoldItemsBreakdown.filter(item =>
      item.itemName.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  }, [aggregatedSoldItemsBreakdown, profitSearchQuery]);

  const overdueReceivables = creditAccounts.filter(
    a => a.type === 'receivable' && a.status !== 'settled' && a.dueDate < new Date().toISOString().split('T')[0]
  );

  // --- Category Breakdown Chart ---
  const categories = Array.from(new Set(inventory.map(item => item.category)));
  const pieData = categories.map(cat => {
    const value = inventory
      .filter(item => item.category === cat)
      .reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    return { name: cat, value };
  }).filter(data => data.value > 0);

  const COLORS = ['#0284c7', '#2563eb', '#38bdf8', '#1d4ed8', '#60a5fa', '#0369a1', '#0284c7'];

  const lowStockProducts = useMemo(() => {
    return inventory.filter(item => item.quantity <= item.reorderPoint);
  }, [inventory]);

  // --- Unified Quantity Modifier for Work List & Discovery ---
  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    if (newQty <= 0) {
      setBasketItems(prev => prev.filter(it => it.itemId !== itemId));
      return;
    }

    setBasketItems(prev => {
      const existingIdx = prev.findIndex(it => it.itemId === itemId);
      if (existingIdx > -1) {
        const next = [...prev];
        next[existingIdx] = { ...next[existingIdx], qty: newQty };
        return next;
      } else {
        return [...prev, {
          itemId: item.id,
          name: item.name,
          sku: item.sku,
          qty: newQty,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost
        }];
      }
    });
  };

  // --- Handle Action Submissions ---
  const handleQuickActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickAction === 'stock_in') {
      if (basketItems.length === 0) {
        triggerFeedback('Please add at least one product to the restock batch.', 'error');
        return;
      }
      await onQuickStockIn(
        basketItems.map(it => ({ itemId: it.itemId, qty: it.qty })),
        'Batch Quick Restock'
      );
      triggerFeedback('Restock batch successfully processed!', 'success');
    } else if (quickAction === 'stock_out' || quickAction === 'stock_out_credit') {
      if (basketItems.length === 0) {
        triggerFeedback('Please add at least one product to the sale batch.', 'error');
        return;
      }

      // Check remaining stock constraints for all sold items
      for (const it of basketItems) {
        const item = inventory.find(i => i.id === it.itemId);
        if (item && item.quantity < it.qty) {
          triggerFeedback(`Insufficient stock for ${it.name}! Present: ${item.quantity}. Requested: ${it.qty}`, 'error');
          return;
        }
      }

      let targetAccountIdOrName: string | undefined = undefined;

      if (quickAction === 'stock_out_credit') {
        if (selectedAccountId) {
          targetAccountIdOrName = selectedAccountId;
        } else if (accountQuery.trim()) {
          targetAccountIdOrName = accountQuery.trim();
        } else {
          targetAccountIdOrName = "General Credit Customer";
        }
      }

      const client = targetAccountIdOrName ? creditAccounts.find(c => c.id === targetAccountIdOrName) : undefined;
      const finalClientName = client ? client.name : (targetAccountIdOrName || 'Client');
      const totalSaleValue = basketItems.reduce((sum, it) => sum + (it.unitPrice * it.qty), 0);

      const itemsDesc = basketItems.map(it => `${it.qty}x ${it.name}`).join(', ');
      const defaultNotes = quickAction === 'stock_out_credit'
        ? `Sold ${itemsDesc} on Credit to ${finalClientName} (Total: ${formatMoney(totalSaleValue)})`
        : `Quick Cash Sale of: ${itemsDesc}`;

      await onQuickStockOut(
        basketItems.map(it => ({ itemId: it.itemId, qty: it.qty })),
        defaultNotes,
        quickAction === 'stock_out_credit' ? targetAccountIdOrName : undefined,
        quickAction === 'stock_out_credit' ? totalSaleValue : undefined
      );

      triggerFeedback(
        quickAction === 'stock_out_credit'
          ? `Credit sale batch & ${formatMoney(totalSaleValue)} successfully charged to ${finalClientName}.`
          : 'Cash sale batch successfully processed.',
        'success'
      );
    } else if (quickAction === 'repayment') {
      if (!selectedAccountId) {
        triggerFeedback('Please select an active account holder from the suggested menu list.', 'error');
        return;
      }
      if (!repaymentAmount) {
        triggerFeedback('Please specify payment amount.', 'error');
        return;
      }
      const account = creditAccounts.find(c => c.id === selectedAccountId);
      if (account && account.remainingAmount < Number(repaymentAmount)) {
        triggerFeedback(`Amount too high! Balance is: ${formatMoney(account.remainingAmount)}`, 'error');
        return;
      }
      await onQuickRepayment(selectedAccountId, Number(repaymentAmount), repaymentNotes || 'Quick Repayment');
      triggerFeedback('Repayment processed successfully.', 'success');
    }

    // Reset Form fields
    setSelectedItemId('');
    setSelectedAccountId('');
    setRepaymentAmount('');
    setRepaymentNotes('');
    setItemQuery('');
    setAccountQuery('');
    setIsItemDropdownOpen(false);
    setIsAccountDropdownOpen(false);
    setBasketItems([]);
    setRestockSearchQuery('');
    setSellSearchQuery('');
    setQuickAction('none');
    setActiveMobileTab('picker');
  };

  // --- Compact Inventory Search on Dashboard ---
  const filteredInventory = useMemo(() => {
    const query = itemSearch.trim().toLowerCase();
    if (!query) return inventory;
    return inventory.filter(item =>
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [inventory, itemSearch]);

  // Filter products for searchable stock adjustments select dropdown
  const filteredDropdownItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(item =>
      item.name.toLowerCase().includes(q) ||
      item.sku.toLowerCase().includes(q)
    );
  }, [inventory, itemQuery]);

  // Filter accounts for searchable repayment select dropdown
  const filteredDropdownAccounts = useMemo(() => {
    const isCreditSale = quickAction === 'stock_out_credit';
    const candidateAccs = creditAccounts.filter(acc => {
      if (acc.type !== 'receivable') return false;
      return isCreditSale ? true : acc.remainingAmount > 0;
    });
    const q = accountQuery.trim().toLowerCase();
    if (!q) return candidateAccs;
    return candidateAccs.filter(acc =>
      acc.name.toLowerCase().includes(q) ||
      (acc.phone && acc.phone.toLowerCase().includes(q)) ||
      (acc.type && acc.type.toLowerCase().includes(q))
    );
  }, [creditAccounts, accountQuery, quickAction]);

  return (
    <div id="dashboard-screen" className="flex flex-col gap-6 sm:gap-8 p-1 sm:p-2 pb-16">
      {/* Dynamic Toast / Feedback Panel */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-xl shadow-lg border text-xs font-bold ${feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
              : 'bg-rose-50 text-rose-800 border-rose-100'
              }`}
          >
            {feedback.type === 'success' ? <CheckCircle2 size={14} className="text-emerald-600" /> : <AlertTriangle size={14} className="text-rose-600" />}
            <span>{feedback.message}</span>
            <button onClick={() => setFeedback(null)} className="ml-2 hover:opacity-75">
              <X size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome & Compact Commands Row (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0 p-4 sm:p-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center neumorphic-btn px-5 py-2 rounded-full border border-white/80">
              <span className="font-black text-sm sm:text-base tracking-wider uppercase text-black select-none font-sans">
                WELCOME BACK
              </span>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
            Real-time business inventory, debtor ledger & cash performance overview
          </p>
        </div>

        {/* Action Command Pills - Neumorphic Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="action-btn-stock-in"
            onClick={() => {
              setQuickAction(quickAction === 'stock_in' ? 'none' : 'stock_in');
              setSelectedItemId('');
              setSelectedAccountId('');
              setItemQuery('');
              setAccountQuery('');
              setIsItemDropdownOpen(false);
              setIsAccountDropdownOpen(false);
            }}
            className={`flex items-center gap-2 rounded-full px-4.5 py-2 text-xs font-extrabold transition-all duration-200 cursor-pointer ${quickAction === 'stock_in'
              ? 'neumorphic-inset bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-inner font-black'
              : 'neumorphic-btn text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${quickAction === 'stock_in' ? 'bg-white/20 text-white' : 'neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-blue-600 dark:text-sky-400'}`}>
              <MaterialIcon name="add" size={13} className={quickAction === 'stock_in' ? 'text-white' : 'text-blue-600 dark:text-sky-400'} />
            </div>
            <span>Restock</span>
          </button>

          <button
            type="button"
            id="action-btn-stock-out"
            onClick={() => {
              setQuickAction(quickAction === 'stock_out' ? 'none' : 'stock_out');
              setSelectedItemId('');
              setSelectedAccountId('');
              setItemQuery('');
              setAccountQuery('');
              setIsItemDropdownOpen(false);
              setIsAccountDropdownOpen(false);
            }}
            className={`flex items-center gap-2 rounded-full px-4.5 py-2 text-xs font-extrabold transition-all duration-200 cursor-pointer ${quickAction === 'stock_out'
              ? 'neumorphic-inset bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-inner font-black'
              : 'neumorphic-btn text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${quickAction === 'stock_out' ? 'bg-white/20 text-white' : 'neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-blue-600 dark:text-sky-400'}`}>
              <MaterialIcon name="remove" size={13} className={quickAction === 'stock_out' ? 'text-white' : 'text-blue-600 dark:text-sky-400'} />
            </div>
            <span>Record Sell</span>
          </button>

          <button
            type="button"
            id="action-btn-stock-out-credit"
            onClick={() => {
              setQuickAction('none');
              setSelectedItemId('');
              setSelectedAccountId('');
              setItemQuery('');
              setAccountQuery('');
              setIsItemDropdownOpen(false);
              setIsAccountDropdownOpen(false);
              onNavigate?.('credit-new');
            }}
            className={`flex items-center gap-2 rounded-full px-4.5 py-2 text-xs font-extrabold transition-all duration-200 cursor-pointer ${quickAction === 'stock_out_credit'
              ? 'neumorphic-inset bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-inner font-black'
              : 'neumorphic-btn text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${quickAction === 'stock_out_credit' ? 'bg-white/20 text-white' : 'neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-blue-600 dark:text-sky-400'}`}>
              <MaterialIcon name="credit_card" size={13} className={quickAction === 'stock_out_credit' ? 'text-white' : 'text-blue-600 dark:text-sky-400'} />
            </div>
            <span>Record Credit</span>
          </button>

          <button
            type="button"
            id="action-btn-payment"
            onClick={() => {
              setQuickAction(quickAction === 'repayment' ? 'none' : 'repayment');
              setSelectedItemId('');
              setSelectedAccountId('');
              setItemQuery('');
              setAccountQuery('');
              setIsItemDropdownOpen(false);
              setIsAccountDropdownOpen(false);
            }}
            className={`flex items-center gap-2 rounded-full px-4.5 py-2 text-xs font-extrabold transition-all duration-200 cursor-pointer ${quickAction === 'repayment'
              ? 'neumorphic-inset bg-gradient-to-r from-sky-500 via-blue-600 to-blue-700 text-white shadow-inner font-black'
              : 'neumorphic-btn text-slate-800 dark:text-white hover:text-blue-600 dark:hover:text-sky-400 hover:scale-[1.02] active:scale-[0.98]'
              }`}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${quickAction === 'repayment' ? 'bg-white/20 text-white' : 'neumorphic-circle bg-[#ebf0f7] dark:bg-[#202225] text-blue-600 dark:text-sky-400'}`}>
              <MaterialIcon name="payments" size={13} className={quickAction === 'repayment' ? 'text-white' : 'text-blue-600 dark:text-sky-400'} />
            </div>
            <span>Repayment</span>
          </button>
        </div>
      </div>

      {/* Finnova Style 5-Column KPI Cards Grid (Compact Zero-Scroll) */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${userRole === 2 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5 sm:gap-6 shrink-0`}>

        {/* Total Inventory Value */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.05 }}
          className="finnova-card p-4 sm:p-5 relative group/kpi flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Inventory Value</span>
            <div className="w-8 h-8 neumorphic-circle text-slate-900 font-bold flex items-center justify-center">
              <MaterialIcon name="inventory_2" size={16} />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(totalInventoryValue)}</h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 font-jakarta text-[9px]">
                Cumulative
              </span>
            </div>
          </div>
        </motion.div>

        {/* Stock in Hand Card */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.1 }}
          className="finnova-card p-4 sm:p-5 relative group/kpi flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock in Hand</span>
            <div className="w-8 h-8 neumorphic-circle text-slate-900 font-bold flex items-center justify-center">
              <MaterialIcon name="inventory" size={16} />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(stockInHandValue)}</h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 font-jakarta text-[9px]">
                {inventory.length} Active Items
              </span>
            </div>
          </div>
        </motion.div>

        {/* Value Sold Card */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.15 }}
          className="finnova-card p-4 sm:p-5 relative group/kpi flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Value Sold</span>
            <div className="w-8 h-8 neumorphic-circle text-slate-900 font-bold flex items-center justify-center">
              <MaterialIcon name="trending_up" size={16} />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(valueSold)}</h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 font-jakarta text-[9px]">
                Cash + Paid Credit
              </span>
            </div>
          </div>
        </motion.div>

        {/* Value of Asset on Credit Card */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut', delay: 0.2 }}
          className="finnova-card p-4 sm:p-5 relative group/kpi flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Asset on Credit</span>
            <div className="w-8 h-8 neumorphic-circle text-slate-900 font-bold flex items-center justify-center">
              <MaterialIcon name="payments" size={16} />
            </div>
          </div>
          <div className="mt-1.5">
            <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(receivablesTotal)}</h3>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-extrabold text-slate-900 font-jakarta text-[9px]">
                Credit Debts
              </span>
            </div>
          </div>
        </motion.div>

        {/* Total Realized Profit Card */}
        {userRole === 2 && (
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut', delay: 0.25 }}
            onClick={() => setIsProfitModalOpen(true)}
            className="finnova-card p-4 sm:p-5 relative group/kpi flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Realized Profit</span>
              <div className="w-8 h-8 neumorphic-circle text-slate-900 font-bold flex items-center justify-center">
                <MaterialIcon name="account_balance_wallet" size={16} />
              </div>
            </div>
            <div className="mt-1.5">
              <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{formatMoney(realizedProfit)}</h3>
              <div className="mt-1 flex items-center justify-between">
                <span className="font-extrabold text-slate-900 font-jakarta text-[9px]">
                  Net Margin
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Main Grid Workspace - Compact Content-Fitted Cards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 sm:gap-8">
        {/* Left Side: Stock Distribution Analysis */}
        <div
          className="finnova-card p-5 sm:p-6 flex flex-col justify-between transition-colors duration-200 ease-in-out overflow-hidden"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/40 pb-3 flex items-center justify-between shrink-0">
            <span>Stock Distribution Analysis</span>
          </h2>

          <div className="flex flex-col justify-between mt-2 gap-4">
            {/* Pie Chart display with Neumorphic 3D Ring Well */}
            <div className="flex items-center justify-center relative py-4">
              {pieData.length > 0 ? (
                <motion.div
                  className="flex items-center justify-center relative"
                  initial={{ opacity: 0, scale: 0.85, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{
                    duration: 0.75,
                    type: "spring",
                    stiffness: 80,
                    damping: 16
                  }}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center justify-center relative p-2">
                    {/* Background Neumorphic Inset Ring Track */}
                    <div className="absolute w-[204px] h-[204px] !rounded-full neumorphic-inset flex items-center justify-center pointer-events-none border border-white/60 dark:border-slate-700/60 shadow-inner" style={{ borderRadius: '9999px' }}>
                      <div className="w-[128px] h-[128px] !rounded-full neumorphic-card border border-white/80 dark:border-slate-700/80 shadow-md" style={{ borderRadius: '9999px' }} />
                    </div>

                    <PieChart width={220} height={220} className="filter drop-shadow-[0_6px_14px_rgba(0,0,0,0.25)]">
                      <defs>
                        <linearGradient id="chartGradientSky" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#38bdf8" />
                          <stop offset="100%" stopColor="#0284c7" />
                        </linearGradient>
                        <linearGradient id="chartGradientEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="chartGradientPurple" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#c084fc" />
                          <stop offset="100%" stopColor="#7c3aed" />
                        </linearGradient>
                        <linearGradient id="chartGradientAmber" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#fbbf24" />
                          <stop offset="100%" stopColor="#d97706" />
                        </linearGradient>
                        <linearGradient id="chartGradientRose" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#f43f5e" />
                          <stop offset="100%" stopColor="#be123c" />
                        </linearGradient>
                        <linearGradient id="chartGradientTeal" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#2dd4bf" />
                          <stop offset="100%" stopColor="#0d9488" />
                        </linearGradient>
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={64}
                        outerRadius={92}
                        paddingAngle={4}
                        cornerRadius={6}
                        dataKey="value"
                        isAnimationActive={true}
                        animationBegin={200}
                        animationDuration={1200}
                        animationEasing="ease-out"
                      >
                        {pieData.map((entry, index) => {
                          const gradients = [
                            'url(#chartGradientSky)',
                            'url(#chartGradientEmerald)',
                            'url(#chartGradientPurple)',
                            'url(#chartGradientAmber)',
                            'url(#chartGradientRose)',
                            'url(#chartGradientTeal)'
                          ];
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={gradients[index % gradients.length]}
                              stroke="#ebf0f7"
                              strokeWidth={3}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip
                        wrapperStyle={{ zIndex: 50 }}
                        position={{ y: -30 }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0];
                            const palette = [
                              { dot: 'bg-sky-400', text: 'text-sky-600 dark:text-sky-400' },
                              { dot: 'bg-emerald-400', text: 'text-emerald-600 dark:text-emerald-400' },
                              { dot: 'bg-purple-400', text: 'text-purple-600 dark:text-purple-400' },
                              { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
                              { dot: 'bg-rose-400', text: 'text-rose-600 dark:text-rose-400' },
                              { dot: 'bg-teal-400', text: 'text-teal-600 dark:text-teal-400' }
                            ];
                            const idx = pieData.findIndex(p => p.name === data.name);
                            const item = palette[idx >= 0 ? idx % palette.length : 0];

                            return (
                              <div className="neumorphic-card px-3.5 py-2 !rounded-2xl border border-white/90 dark:border-slate-700 text-xs font-extrabold shadow-xl text-slate-900 dark:text-white flex items-center gap-2 select-none backdrop-blur-md">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ${item.dot}`} />
                                <span className="capitalize font-black">{data.name}:</span>
                                <span className={`font-mono font-black ${item.text} drop-shadow-xs`}>{formatMoney(Number(data.value))}</span>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>

                    {/* Centered Floating 3D Neumorphic Hub (Perfect Circle) */}
                    <div
                      className="absolute w-[100px] h-[100px] !rounded-full neumorphic-card flex flex-col items-center justify-center pointer-events-none select-none border border-white/90 dark:border-slate-700 shadow-lg z-10"
                      style={{ borderRadius: '9999px' }}
                    >
                      <div className="flex items-center gap-1 neumorphic-inset px-2.5 py-0.5 rounded-full mb-0.5 select-none">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-[7.5px] font-black tracking-wider text-slate-900 dark:text-white uppercase font-mono">REALTIME</span>
                      </div>
                      <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider">Asset Sum</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white font-mono tracking-tight">
                        {formatMoney(stockInHandValue)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <p className="text-xs text-gray-400 font-semibold italic">No inventory value registered yet.</p>
              )}
            </div>


          </div>
        </div>

        {/* Right Side: Active Inventory Showcase & Auto Image Slider */}
        <div
          className="finnova-card p-5 sm:p-6 flex flex-col justify-between transition-colors duration-200 ease-in-out"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 border-b border-slate-200/40 pb-3 flex items-center justify-between shrink-0">
            <span>Inventory Showcase</span>
          </h2>

          <div className="flex flex-col mt-1 overflow-hidden justify-between">
            {inventory.length > 0 ? (() => {
              const activeSlide = sliderIndex % inventory.length;
              const item = inventory[activeSlide];
              const fallbackImg = getItemImage(item.name, item.category);
              const customImg = item.imageUrl && item.imageUrl.trim() !== '' ? item.imageUrl : '';
              const optimizedCustomImg = customImg ? getShowcaseImageUrl(customImg) : '';
              const resolvedImg = (optimizedCustomImg && !optimizedCustomImg.includes('photo-1618384887929') && !optimizedCustomImg.includes('photo-1587829741301'))
                ? optimizedCustomImg
                : fallbackImg;
              const isLowStock = item.quantity <= item.reorderPoint;
              const isOutOfStock = item.quantity === 0;
              const profitMargin = item.unitPrice - item.unitCost;
              const marginPercent = item.unitPrice > 0 ? Math.round((profitMargin / item.unitPrice) * 100) : 0;

              return (
                <div className="flex flex-col justify-between gap-2.5 text-slate-900">
                  {/* Photo area with 3D Neumorphic Frame */}
                  <div className="neumorphic-card p-2 rounded-2xl shrink-0">
                    <div className="relative group h-56 sm:h-64 w-full rounded-xl overflow-hidden bg-slate-950 shrink-0">
                      <img
                        src={resolvedImg}
                        alt={item.name}
                        className="w-full h-full object-cover opacity-100 group-hover:scale-105 transition duration-500 rounded-xl"
                        loading="eager"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          const imageElement = e.currentTarget as HTMLImageElement;
                          if (customImg && imageElement.src !== customImg) {
                            imageElement.src = customImg;
                          } else {
                            imageElement.src = 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1200&q=90';
                          }
                        }}
                      />

                      {/* Subtle bottom gradient overlay for readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent pointer-events-none" />

                      {/* Manual Navigation Arrows */}
                      <button
                        type="button"
                        onClick={() => setSliderIndex((prev) => (prev > 0 ? prev - 1 : inventory.length - 1))}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition duration-200 cursor-pointer focus:outline-hidden hover:scale-110 active:scale-95 z-10 shadow-md border border-slate-700/50"
                        title="Previous Product"
                      >
                        <ChevronLeft size={16} />
                      </button>

                      <button
                        type="button"
                        onClick={() => setSliderIndex((prev) => (prev + 1) % inventory.length)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-slate-900/80 hover:bg-slate-900 text-white rounded-full p-2 transition duration-200 cursor-pointer focus:outline-hidden hover:scale-110 active:scale-95 z-10 shadow-md border border-slate-700/50"
                        title="Next Product"
                      >
                        <ChevronRight size={16} />
                      </button>

                      {/* Top status tag overlays */}
                      <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 z-10">
                        <span className="bg-slate-900/90 text-white text-[9.5px] font-jakarta font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md backdrop-blur-xs border border-slate-700/60 select-none">
                          {item.sku}
                        </span>
                        <span className="bg-slate-900/90 text-white text-[9.5px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full shadow-md backdrop-blur-xs border border-slate-700/60 select-none">
                          {item.category}
                        </span>
                      </div>

                      {/* Low/Out of Stock alerts overlay */}
                      {(isOutOfStock || isLowStock) && (
                        <div className="absolute top-3 right-3 z-10">
                          {isOutOfStock ? (
                            <span className="bg-rose-600 font-black text-white text-[9px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none">
                              <AlertTriangle size={10} /> OUT OF STOCK
                            </span>
                          ) : (
                            <span className="bg-amber-500 font-black text-white text-[9px] px-2.5 py-0.5 rounded-full shadow-md flex items-center gap-1 select-none">
                              <AlertTriangle size={10} /> LOW STOCK
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bottom visual alignment text */}
                      <div className="absolute bottom-3 left-3.5 right-3.5 text-white pointer-events-none z-10">
                        <span className="inline-block text-[9px] uppercase font-black tracking-widest text-white bg-slate-950/80 px-2 py-0.5 rounded-md font-jakarta border border-white/20 shadow-sm">Spotlight Product</span>
                        <h3 className="text-base font-black truncate drop-shadow-md text-white mt-1 leading-tight">{item.name}</h3>
                      </div>
                    </div>
                  </div>

                  {/* Details statistics section */}
                  <div className="flex flex-col justify-between neumorphic-inset p-3 rounded-xl gap-2 shrink-0">
                    <div className={`grid grid-cols-2 ${userRole === 2 ? 'md:grid-cols-4' : ''} gap-2 text-center`}>
                      <div className="neumorphic-card rounded-lg p-2 flex flex-col justify-center">
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-jakarta leading-none font-extrabold">Stock Quantity</span>
                        <span className="text-xs sm:text-sm font-black font-jakarta mt-0.5 text-slate-900">
                          {item.quantity} units
                        </span>
                      </div>
                      <div className="neumorphic-card rounded-lg p-2 flex flex-col justify-center">
                        <span className="text-[8px] uppercase tracking-wider text-slate-500 font-jakarta leading-none font-extrabold">Retail Unit Price</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 font-jakarta mt-0.5">
                          {formatMoney(item.unitPrice)}
                        </span>
                      </div>
                      {userRole === 2 && (
                        <>
                          <div className="neumorphic-card rounded-lg p-2 flex flex-col justify-center">
                            <span className="text-[8px] uppercase tracking-wider text-slate-500 font-jakarta leading-none font-extrabold">Supplier Cost</span>
                            <span className="text-xs sm:text-sm font-black text-slate-900 font-jakarta mt-0.5">
                              {formatMoney(item.unitCost)}
                            </span>
                          </div>
                          <div className="neumorphic-card rounded-lg p-2 flex flex-col justify-center" title="Incremental margin per unit sold">
                            <span className="text-[8px] uppercase tracking-wider text-slate-500 font-jakarta leading-none font-extrabold">Profit Margin</span>
                            <span className="text-xs sm:text-sm font-black text-slate-900 font-jakarta mt-0.5">
                              {formatMoney(profitMargin)} <span className="text-[8.5px] font-bold text-slate-900">({marginPercent}%)</span>
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })() : (
              <div className="py-12 text-center text-xs">
                <div className="p-3 bg-slate-50 border border-slate-100 rounded-full max-w-max mx-auto text-slate-400 mb-2">
                  <ImageIcon size={22} className="mx-auto text-slate-450 animate-none" />
                </div>
                <p className="text-gray-400 font-bold italic">No inventory items available to review.</p>
                <p className="text-gray-400 text-[10px] mt-1">Please insert products inside the inventory section first.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Repayment Record Modal Popup */}
      <AnimatePresence>
        {quickAction === 'repayment' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setQuickAction('none');
                setSelectedAccountId('');
                setAccountQuery('');
                setIsAccountDropdownOpen(false);
              }}
              className="absolute inset-0 cursor-default"
            />

            {/* Modal Card Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative finnova-card rounded-3xl border border-slate-700/60 dark:border-slate-800 w-full max-w-md flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-white z-10 font-jakarta"
            >
              {/* Header */}
              <div className="p-4 border-b border-slate-200/80 dark:border-slate-800 flex items-center justify-between bg-slate-100/70 dark:bg-slate-900/60">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-950 dark:text-white flex items-center gap-2 font-jakarta">
                  <MaterialIcon name="payments" className="text-emerald-600 dark:text-emerald-400 text-base" /> Repayment Record
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAction('none');
                    setSelectedItemId('');
                    setSelectedAccountId('');
                    setItemQuery('');
                    setAccountQuery('');
                    setIsItemDropdownOpen(false);
                    setIsAccountDropdownOpen(false);
                  }}
                  className="neumorphic-btn px-3 py-1.5 rounded-full text-xs text-slate-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 font-extrabold cursor-pointer transition flex items-center gap-1 border border-slate-300 dark:border-slate-700 font-jakarta"
                >
                  ✕ Close
                </button>
              </div>

              {/* Compact Interactive Repayment Form */}
              <form onSubmit={handleQuickActionSubmit} className="p-6 space-y-5">
                <div className="space-y-4">

                  {/* Client Name Input + Autocomplete Suggestions */}
                  <div className="relative">
                    <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between font-jakarta">
                      <span>Client Name *</span>
                      {selectedAccountId && (
                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                          ✓ Selected
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        placeholder="Type client or contact name..."
                        value={accountQuery}
                        onChange={(e) => {
                          setAccountQuery(e.target.value);
                          setIsAccountDropdownOpen(true);
                          const cleanTyped = e.target.value.trim().toLowerCase();
                          const match = creditAccounts.find(acc => acc.name.trim().toLowerCase() === cleanTyped && acc.remainingAmount > 0);
                          if (match) {
                            setSelectedAccountId(match.id);
                          } else {
                            setSelectedAccountId('');
                          }
                        }}
                        onFocus={() => setIsAccountDropdownOpen(true)}
                        className="w-full text-xs text-slate-950 dark:text-white rounded-full px-4 py-3 pl-4 pr-16 neumorphic-inset font-extrabold font-jakarta placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-hidden transition"
                      />
                      {(accountQuery || selectedAccountId) && (
                        <button
                          type="button"
                          onClick={() => {
                            setAccountQuery('');
                            setSelectedAccountId('');
                            setIsAccountDropdownOpen(false);
                          }}
                          className="absolute right-9 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer font-extrabold text-xs"
                        >
                          ✕
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                      >
                        <Search size={14} />
                      </button>
                    </div>

                    {/* LIVE AUTOCOMPLETE RECORD SUGGESTIONS */}
                    {isAccountDropdownOpen && accountQuery.trim().length > 0 && (
                      <div className="absolute z-30 w-full mt-1.5 finnova-card rounded-2xl border border-slate-700/60 dark:border-slate-800 shadow-2xl max-h-48 overflow-y-auto text-xs py-1.5 space-y-1 backdrop-blur-md">
                        {filteredDropdownAccounts.length > 0 ? (
                          filteredDropdownAccounts.map(acc => (
                            <button
                              type="button"
                              key={acc.id}
                              onClick={() => {
                                setSelectedAccountId(acc.id);
                                setAccountQuery(acc.name);
                                setIsAccountDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3.5 py-2.5 rounded-xl hover:bg-slate-200/60 dark:hover:bg-slate-800/80 transition flex items-center justify-between cursor-pointer font-jakarta ${selectedAccountId === acc.id ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold border border-indigo-500/20' : 'text-slate-950 dark:text-white font-bold'
                                }`}
                            >
                              <div className="truncate pr-2">
                                <p className="font-extrabold truncate text-slate-950 dark:text-white text-xs">{acc.name}</p>
                                <p className="text-[9.5px] text-slate-500 dark:text-slate-400 font-jakarta mt-0.5">
                                  {acc.type ? acc.type.toUpperCase() : 'CLIENT RECORD'} {acc.phone ? `· ${acc.phone}` : ''}
                                </p>
                              </div>
                              <span className="text-[10px] neumorphic-btn px-2.5 py-1 rounded-full text-slate-950 dark:text-white font-extrabold font-jakarta shrink-0 border border-slate-300 dark:border-slate-700">
                                {formatMoney(acc.remainingAmount)}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-center text-xs font-jakarta">
                            <p className="text-slate-500 dark:text-slate-400 font-extrabold">No matching client record found.</p>
                            <p className="text-[9.5px] text-slate-400 dark:text-slate-500 mt-0.5 font-semibold">You can still enter a custom client name above.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Payment Handed */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-jakarta">
                      Payment Handed ({config.currencySymbol})
                    </label>
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="Amount in cash..."
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full text-xs text-slate-950 dark:text-white rounded-full px-4 py-3 neumorphic-inset font-extrabold font-jakarta placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-hidden transition"
                    />
                  </div>

                  {/* Optional Ledger Note */}
                  <div>
                    <label className="block text-[10px] font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 font-jakarta">
                      Optional Ledger Note
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cleared invoice, installment"
                      value={repaymentNotes}
                      onChange={(e) => setRepaymentNotes(e.target.value)}
                      className="w-full text-xs text-slate-950 dark:text-white rounded-full px-4 py-3 neumorphic-inset font-extrabold font-jakarta placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-hidden transition"
                    />
                  </div>

                </div>

                {/* Submit Action Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    className="neumorphic-btn bg-slate-950 text-white dark:bg-slate-800 dark:text-white py-3.5 px-5 rounded-2xl text-xs font-extrabold font-jakarta uppercase tracking-wider hover:scale-[1.01] active:scale-[0.99] transition cursor-pointer shadow-md w-full text-center flex items-center justify-center gap-1.5"
                  >
                    <span>Accept Repayment Record</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Realized Profit Margin Analytics Modal */}
      <AnimatePresence>
        {isProfitModalOpen && userRole === 2 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsProfitModalOpen(false);
                setProfitSearchQuery('');
              }}
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-md cursor-pointer"
            />

            {/* Content Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              transition={{ type: "spring", duration: 0.45, bounce: 0.1 }}
              className="relative finnova-card rounded-3xl w-full max-w-6xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-white border border-slate-700/60"
            >
              {/* Modal Header Banner */}
              <div className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 p-5 shrink-0">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <span className="text-[9.5px] font-extrabold font-jakarta px-3 py-1 rounded-full uppercase tracking-wider neumorphic-btn text-slate-900 dark:text-white border border-slate-700/60">
                      Realized Profit Analysis
                    </span>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white mt-2 flex items-center gap-2 font-jakarta">
                      <TrendingUp size={18} className="text-slate-800 dark:text-slate-200" />
                      <span>Sales Profits & Margins Ledger</span>
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium font-jakarta">
                      Explore detailed metrics, individual transaction-level logs, and product-specific margin ranks.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setIsProfitModalOpen(false);
                      setProfitSearchQuery('');
                    }}
                    className="p-2 rounded-full neumorphic-circle text-slate-700 dark:text-slate-200 hover:text-black dark:hover:text-white cursor-pointer transition"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* KPI Performance Highlights Inside Header */}
                <div className="mt-4 flex">
                  <div className="neumorphic-inset bg-slate-100/90 dark:bg-slate-950/80 rounded-2xl p-3.5 px-5 border border-slate-200/80 dark:border-slate-800">
                    <span className="block text-[9px] font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-jakarta">Total Net Profit</span>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white font-jakarta">{formatMoney(realizedProfit)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sub-Header Actions: Product filtering */}
              <div className="border-b border-slate-200/80 dark:border-slate-800 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 bg-slate-50/60 dark:bg-slate-900/60">
                <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300 font-jakarta">
                  Product Profit & Performance Ledger
                </span>

                {/* Filtering query */}
                <div className="relative w-full sm:w-72">
                  <input
                    type="text"
                    placeholder="Search product, SKU or category..."
                    value={profitSearchQuery}
                    onChange={(e) => setProfitSearchQuery(e.target.value)}
                    className="w-full text-xs rounded-full neumorphic-inset px-4 py-2 pl-8 pr-8 focus:outline-hidden font-bold text-slate-900 dark:text-white placeholder:text-slate-400"
                  />
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  {profitSearchQuery && (
                    <button
                      onClick={() => setProfitSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5 rounded-full"
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable table container */}
              <div className="grow overflow-y-auto p-4 min-h-0 bg-slate-50/30 dark:bg-slate-950/40">
                {/* Aggregated product profitability table */}
                {filteredAggregatedSoldItems.length > 0 ? (
                  <div className="border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900">
                    <table className="w-full border-collapse text-left text-xs font-jakarta">
                      <thead>
                        <tr className="neumorphic-table-header text-[10px] select-none">
                          <th className="p-3 w-12 text-center">Rank</th>
                          <th className="p-3">Product Name & Category</th>
                          {userRole === 2 && <th className="p-3 text-right">Cost Price</th>}
                          <th className="p-3 text-right">Selling Price</th>
                          <th className="p-3 text-center">Total Qty Sold</th>
                          {userRole === 2 && <th className="p-3 text-right">Cumulative Cost Price</th>}
                          <th className="p-3 text-right">Cumulative Revenue</th>
                          {userRole === 2 && <th className="p-3 text-right">Cumulative Profit</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {filteredAggregatedSoldItems.map((record, idx) => {
                          return (
                            <tr key={record.itemId} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition duration-150">
                              <td className="p-3 text-center">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold font-jakarta neumorphic-circle text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700">
                                  {idx + 1}
                                </span>
                              </td>
                              <td className="p-3">
                                <div>
                                  <p className="font-extrabold text-slate-900 dark:text-white leading-tight font-jakarta">{record.itemName}</p>
                                  <div className="flex items-center gap-1.5 mt-0.5 text-[9.5px] text-slate-500 dark:text-slate-400 font-jakarta font-bold">
                                    <span>SKU: {record.sku}</span>
                                    <span>•</span>
                                    <span>{record.category}</span>
                                  </div>
                                </div>
                              </td>
                              {userRole === 2 && (
                                <td className="p-3 text-right font-extrabold text-slate-700 dark:text-slate-300 font-jakarta">
                                  {formatMoney(record.unitCost)}
                                </td>
                              )}
                              <td className="p-3 text-right font-extrabold text-slate-900 dark:text-white font-jakarta">
                                {formatMoney(record.unitPrice)}
                              </td>
                              <td className="p-3 text-center font-extrabold text-slate-900 dark:text-white font-jakarta">
                                {record.totalQty} <span className="text-[9.5px] text-slate-500 dark:text-slate-400 font-bold">units</span>
                              </td>
                              {userRole === 2 && (
                                <td className="p-3 text-right font-extrabold text-slate-700 dark:text-slate-300 font-jakarta">
                                  {formatMoney(record.totalCost)}
                                </td>
                              )}
                              <td className="p-3 text-right font-extrabold text-slate-900 dark:text-white font-jakarta">
                                {formatMoney(record.totalRevenue)}
                              </td>
                              {userRole === 2 && (
                                <td className="p-3 text-right font-extrabold text-slate-900 dark:text-white font-jakarta">
                                  {formatMoney(record.totalProfit)}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-white border border-slate-150 rounded-xl shadow-4xs">
                    <TrendingUp size={24} className="mx-auto text-slate-300" />
                    <p className="text-[11px] text-slate-550 font-semibold mt-2">No product sales matches categorized</p>
                    <p className="text-[9.5px] text-slate-400">Search logic found zero matches for product categorization.</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
        {/* Universal Landscape Pop-Up for Restock & Sale Operations */}
        {(quickAction === 'stock_in' || quickAction === 'stock_out' || quickAction === 'stock_out_credit') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="bg-[#ebf0f7] rounded-3xl shadow-xl w-full max-w-5xl h-[90vh] xl:h-[85vh] flex flex-col overflow-hidden border border-white/80"
              style={{ boxShadow: '10px 10px 30px #cbd3e1, -10px -10px 30px #ffffff' }}
            >
              {/* Header block */}
              <div className="p-4 border-b border-slate-200/60 flex items-center justify-between bg-[#ebf0f7]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 neumorphic-circle text-slate-800 flex items-center justify-center font-bold shrink-0">
                    <ClipboardList size={18} className="text-slate-800" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm tracking-tight uppercase">
                      {quickAction === 'stock_in'
                        ? 'Procurement & Restock Portal'
                        : quickAction === 'stock_out_credit'
                          ? 'Credit Outflow Ledger Hub'
                          : 'Cash Sale Operations Desk'}
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold tracking-wide uppercase mt-0.5">
                      Batch edit quantity and process transactional logs instantaneously
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setQuickAction('none');
                    setBasketItems([]);
                    setActiveMobileTab('picker');
                    setRestockSearchQuery('');
                    setSellSearchQuery('');
                  }}
                  className="w-8 h-8 flex items-center justify-center neumorphic-circle text-slate-700 hover:text-black transition cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Mobile Segmented Tab bar */}
              <div className="flex xl:hidden border-b border-slate-150 bg-slate-100/60 p-1.5 shrink-0 gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('picker')}
                  className={`flex-1 py-1.5 px-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition ${activeMobileTab === 'picker'
                    ? (quickAction === 'stock_in'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : quickAction === 'stock_out_credit'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-orange-600 text-white shadow-xs')
                    : 'text-slate-650 hover:bg-slate-200 font-bold'
                    }`}
                >
                  Find Items
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMobileTab('basket')}
                  className={`flex-1 py-1.5 px-2 text-center text-xs font-black uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-1.5 ${activeMobileTab === 'basket'
                    ? (quickAction === 'stock_in'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : quickAction === 'stock_out_credit'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-orange-600 text-white shadow-xs')
                    : 'text-slate-650 hover:bg-slate-200 font-bold'
                    }`}
                >
                  Added List
                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded-md font-mono font-black ${activeMobileTab === 'basket'
                    ? 'bg-black/20 text-white'
                    : 'bg-slate-200 text-slate-705'
                    }`}>
                    {basketItems.length}
                  </span>
                </button>
              </div>

              {/* Master Dual-Column Landscape Container */}
              <div className="flex-1 grid grid-cols-1 xl:grid-cols-12 xl:overflow-hidden min-h-0 bg-slate-50/20">
                {/* LEFT COLUMN: Product Discovery & Quick Pick */}
                <div className={`col-span-1 xl:col-span-6 flex flex-col h-full min-h-0 border-r border-slate-200/60 bg-[#ebf0f7] ${activeMobileTab === 'picker' ? 'flex' : 'hidden xl:flex'
                  }`}>
                  {/* Search and Filters Header */}
                  <div className="p-3 border-b border-slate-200/60 bg-[#ebf0f7] space-y-2 flex-shrink-0">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search products by SKU, name, or category..."
                        value={modalSearchQuery}
                        onChange={(e) => setModalSearchQuery(e.target.value)}
                        className="w-full text-xs rounded-xl text-slate-900 p-2.5 pl-3.5 pr-8 neumorphic-inset focus:outline-hidden transition font-medium"
                      />
                      {modalSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setModalSearchQuery('')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[9px] text-slate-500 font-extrabold tracking-wider uppercase">
                        {quickAction === 'stock_in'
                          ? (!modalSearchQuery ? 'Low Stock Recommendations' : 'Search Results')
                          : 'Search Products to Add'}
                      </span>
                      {quickAction === 'stock_in' && (
                        <span className="text-[9px] text-slate-800 font-extrabold px-2.5 py-0.5 rounded-full neumorphic-btn">
                          {!modalSearchQuery ? 'Low Stock Highlighted' : 'Searching Catalog'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Scrollable list of products */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-full">
                    {(() => {
                      const lowStockItems = inventory.filter(item => item.quantity <= item.reorderPoint);
                      const hasLowStockAlerts = lowStockItems.length > 0;

                      let filteredModalItems: typeof inventory = [];

                      if (quickAction === 'stock_in') {
                        // Restock popup
                        if (!modalSearchQuery) {
                          // Show only low stock items initially
                          filteredModalItems = lowStockItems;
                        } else {
                          // Filter full inventory by search query
                          filteredModalItems = inventory.filter(item =>
                            item.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                            item.sku.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                            item.category.toLowerCase().includes(modalSearchQuery.toLowerCase())
                          );
                        }
                      } else {
                        // Record Sell / Record Credit
                        if (!modalSearchQuery) {
                          // Must search, initially none
                          filteredModalItems = [];
                        } else {
                          // Filter full inventory by search query
                          filteredModalItems = inventory.filter(item =>
                            item.name.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                            item.sku.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                            item.category.toLowerCase().includes(modalSearchQuery.toLowerCase())
                          );
                        }
                      }

                      if (filteredModalItems.length === 0) {
                        return (
                          <div className="text-center py-10 neumorphic-inset rounded-2xl p-5 my-auto">
                            {quickAction === 'stock_in' ? (
                              !modalSearchQuery ? (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-extrabold text-slate-900">Perfect! Sufficient Stock Levels</p>
                                  <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-normal font-medium">
                                    No elements require an urgent restock right now. Search above by name, category, or SKU to queue items manually.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs font-extrabold text-slate-900">No items matched your search</p>
                                  <p className="text-[10px] text-slate-500 font-medium">Try checking spelling or type an item SKU.</p>
                                </div>
                              )
                            ) : (
                              !modalSearchQuery ? (
                                <div className="space-y-1.5">
                                  <p className="text-xs font-extrabold text-slate-900">Sell Session Active</p>
                                  <p className="text-[10px] text-slate-500 max-w-[280px] mx-auto leading-normal font-medium">
                                    Type a product name, SKU, or category query in the input above to begin adding items to your basket list.
                                  </p>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <p className="text-xs font-extrabold text-slate-900">No items matched your search</p>
                                  <p className="text-[10px] text-slate-500 font-medium">Try searching for other SKU numbers or item names.</p>
                                </div>
                              )
                            )}
                          </div>
                        );
                      }

                      return filteredModalItems.map(item => {
                        const basketItem = basketItems.find(it => it.itemId === item.id);
                        const qtyInBasket = basketItem ? basketItem.qty : 0;
                        const hasLowStock = item.quantity <= item.reorderPoint;

                        return (
                          <div
                            key={`modal-picker-${item.id}`}
                            className={`flex items-center justify-between p-3 rounded-2xl transition finnova-card ${qtyInBasket > 0
                              ? 'border border-blue-400/50 shadow-xs'
                              : 'border border-white/80'
                              }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-extrabold text-slate-900 text-xs break-words whitespace-normal leading-normal">{item.name}</span>
                                {hasLowStock && (
                                  <span className="bg-amber-100 text-amber-900 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">Low Stock</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-[9px] font-bold text-slate-500">
                                <span className="neumorphic-inset px-1.5 py-0.5 rounded-md text-slate-700">SKU: {item.sku}</span>
                                <span>•</span>
                                <span>{item.category}</span>
                              </div>
                              <div className="mt-1 text-[10px] text-slate-600 font-medium">
                                Stock: <span className={`font-bold ${hasLowStock ? 'text-amber-700 font-black' : 'text-slate-900'}`}>{item.quantity} units</span>{userRole === 2 && <> • Cost: <span className="font-bold text-slate-900">{formatMoney(item.unitCost)}</span></>} • Retail: <span className="font-bold text-slate-900">{formatMoney(item.unitPrice)}</span>
                              </div>
                            </div>

                            {/* Direct Interactive Multi-Adjuster inside Discovery picker */}
                            <div className="shrink-0 flex items-center justify-end pl-1">
                              {qtyInBasket > 0 ? (
                                (quickAction === 'stock_out' || quickAction === 'stock_out_credit') ? (
                                  <div className="neumorphic-btn text-emerald-800 text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer">
                                    <Check size={12} className="text-emerald-700 stroke-[3px]" />
                                    <span>Added ({qtyInBasket} pcs)</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 neumorphic-inset p-1 rounded-xl">
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.id, qtyInBasket - 1)}
                                      className="p-1 rounded-lg neumorphic-btn text-slate-800 hover:text-black transition cursor-pointer shrink-0"
                                      title="Decrease Quantity"
                                    >
                                      <Minus size={10} />
                                    </button>
                                    <input
                                      type="number"
                                      min={1}
                                      value={qtyInBasket}
                                      onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val >= 1) handleUpdateQuantity(item.id, val);
                                      }}
                                      className="w-10 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateQuantity(item.id, qtyInBasket + 1)}
                                      className="p-1 rounded-lg neumorphic-btn text-slate-800 hover:text-black transition cursor-pointer shrink-0"
                                      title="Increase Quantity"
                                    >
                                      <Plus size={10} />
                                    </button>
                                  </div>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const deficit = item.reorderPoint - item.quantity;
                                    const defaultQty = quickAction === 'stock_in' && deficit > 0 ? deficit : 1;
                                    handleUpdateQuantity(item.id, defaultQty);
                                  }}
                                  className="px-3 py-1.5 neumorphic-btn text-slate-900 hover:text-black text-[10px] font-extrabold rounded-xl transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                                >
                                  <Plus size={11} className="text-slate-800" />
                                  <span>Add to List</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* RIGHT COLUMN: Active Work List, Ledger Parameters & Final Submit Form */}
                <span className="hidden" /> {/* Extra space anchor */}
                <div
                  className={`col-span-1 xl:col-span-6 flex flex-col h-full min-h-0 bg-[#ebf0f7] p-4 justify-between ${activeMobileTab === 'basket' ? 'flex animate-fade-in' : 'hidden xl:flex'
                    }`}
                >
                  {/* Active List Section */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="flex items-center justify-between border-b border-slate-200/60 pb-2 mb-2 flex-shrink-0 bg-transparent">
                      <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <ClipboardList size={13} className="text-slate-800" />
                        <span>{`Items to Be Worked On (${basketItems.length})`}</span>
                      </span>
                      {basketItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBasketItems([])}
                          className="text-[9px] text-rose-600 hover:text-rose-800 font-extrabold hover:underline cursor-pointer"
                        >
                          Clear All Items
                        </button>
                      )}
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                      {basketItems.map((it) => {
                        const item = inventory.find(i => i.id === it.itemId);
                        const maxAvailable = item ? item.quantity : 0;
                        const exceedsStock = (quickAction === 'stock_out' || quickAction === 'stock_out_credit') && maxAvailable < it.qty;

                        return (
                          <div
                            key={`basket-list-${it.itemId}`}
                            className={`flex items-center justify-between p-3 finnova-card rounded-2xl transition ${exceedsStock ? 'border-rose-400 bg-rose-50/20' : 'border-white/80'
                              }`}
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <p className="font-extrabold text-slate-900 text-xs leading-normal break-words whitespace-normal">{it.name}</p>
                              <div className="flex items-center mt-1 text-[9px] font-bold text-slate-500 gap-1.5">
                                <span className="neumorphic-inset px-1.5 py-0.5 rounded-md text-slate-700">SKU: {it.sku}</span>
                                {!(quickAction === 'stock_in' && userRole !== 2) && (
                                  <>
                                    <span>•</span>
                                    <span>{quickAction === 'stock_in' ? 'Cost' : 'Price'}: {formatMoney(quickAction === 'stock_in' ? it.unitCost : it.unitPrice)}</span>
                                  </>
                                )}
                              </div>
                              {exceedsStock && (
                                <p className="text-[8px] text-rose-600 font-extrabold mt-1">Error: Exceeds current inventory ({maxAvailable} available)</p>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 bg-transparent">
                              {(quickAction === 'stock_out' || quickAction === 'stock_out_credit') ? (
                                <input
                                  type="number"
                                  min={1}
                                  value={it.qty}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    if (!isNaN(val) && val >= 1) handleUpdateQuantity(it.itemId, val);
                                  }}
                                  className="w-14 h-8 text-center text-xs font-bold text-slate-900 neumorphic-inset rounded-xl p-1.5 focus:outline-hidden"
                                />
                              ) : (
                                <div className="flex items-center gap-1 neumorphic-inset p-1 rounded-xl">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(it.itemId, it.qty - 1)}
                                    className="p-1 rounded-lg neumorphic-btn text-slate-800 hover:text-black transition cursor-pointer"
                                    title="Decrease"
                                  >
                                    <Minus size={9} />
                                  </button>
                                  <input
                                    type="number"
                                    min={1}
                                    value={it.qty}
                                    onChange={(e) => {
                                      const val = parseInt(e.target.value, 10);
                                      if (!isNaN(val) && val >= 1) handleUpdateQuantity(it.itemId, val);
                                    }}
                                    className="w-10 text-center text-xs font-bold text-slate-900 bg-transparent focus:outline-hidden"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(it.itemId, it.qty + 1)}
                                    className="p-1 rounded-lg neumorphic-btn text-slate-800 hover:text-black transition cursor-pointer"
                                    title="Increase"
                                  >
                                    <Plus size={9} />
                                  </button>
                                </div>
                              )}
                            </div>

                            <div className="w-16 text-right pr-2 shrink-0">
                              <span className="text-xs font-extrabold text-slate-900">
                                {quickAction === 'stock_in' && userRole !== 2
                                  ? '—'
                                  : formatMoney(it.qty * (quickAction === 'stock_in' ? it.unitCost : it.unitPrice))}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(it.itemId, 0)}
                              className="w-6 h-6 flex items-center justify-center neumorphic-circle text-slate-600 hover:text-rose-600 transition cursor-pointer shrink-0"
                              title="Remove item"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}

                      {basketItems.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center p-8 neumorphic-inset rounded-2xl my-auto space-y-2">
                          <ClipboardList size={34} className="text-slate-400" />
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wide">Work List is Empty</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-[210px] leading-relaxed mx-auto font-medium">
                              Select products from the discovery catalog on the left to configure your batch operations.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sidebar forms parameter panel */}
                  <div className="border-t border-slate-200/60 pt-3 mt-3 flex-shrink-0 space-y-3">


                    {/* Client Selector for stock_out_credit */}
                    {quickAction === 'stock_out_credit' && (
                      <div className="relative">
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                            Client Name / Recipient Account *
                          </label>
                          {selectedAccountId ? (
                            <span className="text-[9px] text-emerald-800 font-extrabold neumorphic-btn px-2 py-0.5 rounded-full">
                              ✓ Linked Account
                            </span>
                          ) : accountQuery.trim() ? (
                            <span className="text-[9px] text-amber-800 font-extrabold neumorphic-btn px-2 py-0.5 rounded-full">
                              ✓ Creates New Profile
                            </span>
                          ) : null}
                        </div>

                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Search existing client or type new contact..."
                            value={accountQuery}
                            onChange={(e) => {
                              setAccountQuery(e.target.value);
                              setIsAccountDropdownOpen(true);
                              const cleanTyped = e.target.value.trim().toLowerCase();
                              const match = creditAccounts.find(acc => acc.name.trim().toLowerCase() === cleanTyped && acc.type === 'receivable');
                              if (match) {
                                setSelectedAccountId(match.id);
                              } else {
                                setSelectedAccountId('');
                              }
                            }}
                            onFocus={() => setIsAccountDropdownOpen(true)}
                            className="w-full text-xs rounded-xl text-slate-900 p-2.5 pr-14 neumorphic-inset focus:outline-hidden transition font-medium"
                          />
                          {accountQuery && (
                            <button
                              type="button"
                              onClick={() => {
                                setAccountQuery('');
                                setSelectedAccountId('');
                                setIsAccountDropdownOpen(false);
                              }}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
                            >
                              <X size={13} />
                            </button>
                          )}
                        </div>

                        {isAccountDropdownOpen && accountQuery.trim().length > 0 && (
                          <div className="absolute z-30 w-full mt-1 bg-[#ebf0f7] border border-white/80 rounded-2xl shadow-xl max-h-32 overflow-y-auto text-xs p-1 space-y-1">
                            {filteredDropdownAccounts.length > 0 ? (
                              filteredDropdownAccounts.map(acc => (
                                <button
                                  key={acc.id}
                                  onClick={() => {
                                    setSelectedAccountId(acc.id);
                                    setAccountQuery(acc.name);
                                    setIsAccountDropdownOpen(false);
                                  }}
                                  className="w-full text-left p-2 hover:bg-slate-200/60 rounded-xl transition flex items-center justify-between cursor-pointer"
                                >
                                  <div>
                                    <p className="font-extrabold text-slate-900">{acc.name}</p>
                                    <p className="text-[9px] text-slate-500 font-medium">Unsettled Balance: {formatMoney(acc.remainingAmount)}</p>
                                  </div>
                                  <span className="text-[9px] text-slate-900 font-extrabold neumorphic-btn px-2 py-0.5 rounded-lg uppercase">Select</span>
                                </button>
                              ))
                            ) : (
                              <p className="p-2 text-slate-500 italic text-[10px] text-center font-medium">
                                No profile match found. Typename will create a new client profile on Process.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Operational Ledger Total & Action Buttons */}
                    <div className="finnova-card rounded-2xl p-3 flex flex-col sm:flex-row gap-3 items-center justify-between border border-white/80 mt-1">
                      <div className="text-center sm:text-left">
                        <span className="block text-[8px] text-slate-500 uppercase font-extrabold tracking-wider">Estimated Operation Ledger</span>
                        <div className="flex items-center gap-1.5 mt-0.5 justify-center sm:justify-start">
                          <span className="text-xs font-extrabold text-slate-900">
                            {basketItems.length} Product{basketItems.length !== 1 ? 's' : ''}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-xs font-extrabold px-3 py-1 rounded-xl text-slate-900 neumorphic-btn border border-white/80">
                            {quickAction === 'stock_in' && userRole !== 2
                              ? `Total: ${basketItems.reduce((acc, it) => acc + it.qty, 0)} units`
                              : `Total: ${formatMoney(basketItems.reduce((acc, it) => acc + (it.qty * (quickAction === 'stock_in' ? it.unitCost : it.unitPrice)), 0))}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAction('none');
                            setBasketItems([]);
                            setActiveMobileTab('picker');
                            setRestockSearchQuery('');
                            setSellSearchQuery('');
                          }}
                          className="flex-1 sm:flex-initial text-xs text-slate-800 hover:text-black font-extrabold px-4 py-2 rounded-xl neumorphic-btn cursor-pointer transition"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={basketItems.length === 0}
                          onClick={() => {
                            const mockEvent = { preventDefault: () => { } } as React.FormEvent;
                            handleQuickActionSubmit(mockEvent);
                          }}
                          className={`flex-1 sm:flex-initial text-xs font-black px-5 py-2 rounded-xl transition whitespace-nowrap cursor-pointer flex items-center justify-center gap-1.5 neumorphic-btn ${basketItems.length === 0
                            ? 'opacity-40 cursor-not-allowed text-slate-400'
                            : 'text-slate-900 hover:text-black border border-white/80'
                            }`}
                        >
                          <span>Confirm & Process</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
