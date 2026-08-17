import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Bell,
  RotateCw,
  AlertTriangle,
  Check,
  AlertCircle,
  Clock,
  ChevronRight,
  ExternalLink,
  SlidersHorizontal,
  Mail,
  Smartphone,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import MaterialIcon from './MaterialIcon';
import { BackendNotification, BusinessConfig, InventoryItem, CreditAccount, StockAdjustment, CreditTransaction, PendingRestock } from '../types';

interface NotificationsScreenProps {
  insights: any;
  loadingInsights: boolean;
  insightsError: string | null;
  onRefreshInsights: () => void;
  creditInsights: any;
  loadingCreditInsights: boolean;
  creditInsightsError: string | null;
  onRefreshCreditInsights: () => void;
  onRefreshAllInsights: () => void;
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  config: BusinessConfig;
  userRole?: number;
  currentOrg?: any;
  pendingRestocks?: PendingRestock[];
  onNavigate: (screen: string, tab?: string) => void;
  readNotificationIds?: string[];
  backendNotifications?: BackendNotification[];
  onMarkAsRead?: (ids: string[]) => void;
}

export default function NotificationsScreen({
  insights,
  loadingInsights,
  insightsError,
  onRefreshInsights,
  creditInsights,
  loadingCreditInsights,
  creditInsightsError,
  onRefreshCreditInsights,
  onRefreshAllInsights,
  inventory = [],
  creditAccounts = [],
  adjustments = [],
  transactions = [],
  config,
  userRole,
  currentOrg,
  pendingRestocks = [],
  onNavigate,
  readNotificationIds: readNotifs = [],
  backendNotifications,
  onMarkAsRead
}: NotificationsScreenProps) {
  const [activeFilter, setActiveFilter] = useState<'all' | 'inventory' | 'credit' | 'system'>('all');

  const formatTimeAgo = (dateStr: string) => {
    try {
      if (!dateStr) return 'Just now';
      const now = new Date();
      const past = new Date(dateStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;
      return past.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  // Build the complete list of system notifications/alerts
  const criticalNotifications = useMemo(() => {
    if (backendNotifications !== undefined) {
      return backendNotifications
        .filter(notification => notification.isActive)
        .map(notification => ({
          id: notification.eventKey || notification.id,
          title: notification.title,
          description: notification.message,
          type: notification.severity,
          date: notification.createdAt,
          category: notification.category === 'inventory' ? 'Inventory' : notification.category === 'credit' ? 'Credit' : 'System',
          targetScreen: notification.targetScreen,
          targetTab: notification.targetTab
        }));
    }

    const list: Array<{
      id: string;
      title: string;
      description: string;
      type: 'error' | 'warning' | 'success';
      date: string;
      category: string;
      targetScreen: string;
      targetTab?: string;
    }> = [];

    // 1. Inventory stock levels monitoring
    inventory.forEach(item => {
      if (item.quantity === 0) {
        list.push({
          id: `notif-oos-${item.id}-${item.lastUpdated || item.quantity}`,
          title: 'Out of Stock Alert',
          description: `"${item.name}" (SKU: ${item.sku}) is completely Sold Out!`,
          type: 'error',
          date: item.lastUpdated || new Date().toISOString(),
          category: 'Inventory',
          targetScreen: 'inventory'
        });
      } else if (item.quantity <= item.reorderPoint) {
        list.push({
          id: `notif-low-${item.id}-${item.lastUpdated || item.quantity}`,
          title: 'Low Stock Level Notification',
          description: `"${item.name}" (SKU: ${item.sku}) is running low with ${item.quantity} units left (reorder level: ${item.reorderPoint}).`,
          type: 'warning',
          date: item.lastUpdated || new Date().toISOString(),
          category: 'Inventory',
          targetScreen: 'inventory'
        });
      }
    });

    // 2. Overdue client-account payments tracking
    const todayStr = new Date().toISOString().split('T')[0];
    creditAccounts.forEach(acc => {
      if (acc.remainingAmount > 0) {
        const isPastDue = acc.dueDate && acc.dueDate < todayStr;
        if (isPastDue || acc.status === 'overdue') {
          list.push({
            id: `notif-overdue-${acc.id}`,
            title: `Unpaid Balance Overdue`,
            description: `${acc.name} holds ${config?.currencySymbol || '$'}${(acc.remainingAmount || 0).toLocaleString()} past payment deadline.`,
            type: 'error',
            date: acc.lastUpdated || new Date().toISOString(),
            category: 'Credit',
            targetScreen: 'credit'
          });
        }
      }
    });

    // 3. Flagged transaction corrections
    adjustments.forEach(adj => {
      if (adj.isFlagged) {
        list.push({
          id: `notif-flag-${adj.id}`,
          title: `Correction Flagged`,
          description: `"${adj.itemName}" transaction (Qty: ${adj.qtyChanged}) flagged by ${adj.flaggedBy || 'Attendant'}: "${adj.flagComment}"`,
          type: 'warning',
          date: adj.flaggedAt || adj.date || new Date().toISOString(),
          category: 'System',
          targetScreen: 'transactions'
        });
      } else if (adj.isResolved) {
        list.push({
          id: `notif-resolved-${adj.id}`,
          title: `Stock Correction Made by Admin`,
          description: `"${adj.itemName}" corrected to ${adj.qtyChanged} units by Admin. Reason: "${adj.correctionNotes || 'None'}"`,
          type: 'success',
          date: adj.resolvedAt || adj.date || new Date().toISOString(),
          category: 'System',
          targetScreen: 'transactions'
        });
      }
    });

    // 4. Flagged ledger transactions
    transactions.forEach(tx => {
      if (tx.isFlagged) {
        list.push({
          id: `notif-flag-tx-${tx.id}`,
          title: `Payment/Credit Flagged`,
          description: `"${tx.accountName}" ${(tx.type || '').toUpperCase()} (${config?.currencySymbol || '$'}${(tx.amount || 0).toLocaleString()}) flagged by ${tx.flaggedBy || 'Attendant'}: "${tx.flagComment}"`,
          type: 'warning',
          date: tx.flaggedAt || tx.date || new Date().toISOString(),
          category: 'System',
          targetScreen: 'transactions'
        });
      } else if (tx.isResolved) {
        list.push({
          id: `notif-resolved-tx-${tx.id}`,
          title: `Transaction Corrected by Admin`,
          description: `"${tx.accountName}" transaction corrected to ${config?.currencySymbol || '$'}${(tx.amount || 0).toLocaleString()} by Admin. Reason: "${tx.correctionNotes || 'None'}"`,
          type: 'success',
          date: tx.resolvedAt || tx.date || new Date().toISOString(),
          category: 'System',
          targetScreen: 'transactions'
        });
      }
    });

    // 5. Attendant passcode reset requested
    if (userRole === 2 && currentOrg?.attendantResetRequested && currentOrg?.attendantPass?.startsWith('__RESETTING_')) {
      list.push({
        id: `notif-pass-reset-${currentOrg.id}`,
        title: 'Attendant PIN Reset Request',
        description: `Your attendant "${currentOrg.attendantResetUsername || 'Attendant'}" requested a security PIN reset.`,
        type: 'error',
        date: new Date(currentOrg.attendantResetTimestamp || Date.now()).toISOString(),
        category: 'System',
        targetScreen: 'settings',
        targetTab: 'security'
      });
    }

    // 6. Restock validation alerts for Admin
    if (userRole === 2 && pendingRestocks) {
      pendingRestocks.forEach(r => {
        if (r.status === 'pending') {
          list.push({
            id: `notif-restock-pending-${r.id}`,
            title: 'Pending Restock Validation',
            description: `"${r.itemName}" has a pending restock of ${r.attendantQty} units submitted by ${r.submittedBy || 'Attendant'}.`,
            type: 'warning',
            date: r.date,
            category: 'Inventory',
            targetScreen: 'inventory',
            targetTab: 'restock_validations'
          });
        } else if (r.status === 'on_hold') {
          list.push({
            id: `notif-restock-hold-${r.id}`,
            title: 'Restock Discrepancy (On Hold)',
            description: `"${r.itemName}" restock is on hold. Attendant logged ${r.attendantQty}, Admin counted ${r.adminInputQty}.`,
            type: 'error',
            date: r.date,
            category: 'Inventory',
            targetScreen: 'inventory',
            targetTab: 'restock_validations'
          });
        }
      });
    }

    // Sort: errors first, then warnings, then newest first
    return list.sort((a, b) => {
      if (a.type === 'error' && b.type !== 'error') return -1;
      if (a.type !== 'error' && b.type === 'error') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [backendNotifications, inventory, creditAccounts, adjustments, transactions, config?.currencySymbol, userRole, currentOrg, pendingRestocks]);

  const markAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead([id]);
    }
  };

  const markAllAsRead = () => {
    const allIds = criticalNotifications.map(n => n.id);
    if (onMarkAsRead) {
      onMarkAsRead(allIds);
    }
  };

  // Filtered Notifications Feed
  const filteredNotifications = useMemo(() => {
    return criticalNotifications.filter(notif => {
      if (activeFilter === 'all') return true;
      return notif.category.toLowerCase() === activeFilter;
    });
  }, [criticalNotifications, activeFilter]);

  const unreadCount = useMemo(() => {
    return criticalNotifications.filter(n => !readNotifs.includes(n.id)).length;
  }, [criticalNotifications, readNotifs]);

  return (
    <div className="space-y-6">

      {/* Top Banner Area */}
      <div className="finnova-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 font-extrabold text-[10px] uppercase tracking-widest font-mono">
            <Bell size={12} className="animate-pulse" />
            <span>System Notifications Hub</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight mt-0.5">Notifications & System Alerts</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time automated supply chain alerts, inventory triggers, and data integrity flags.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-black px-3 py-1 rounded-full animate-bounce">
              {unreadCount} UNREAD ALERTS
            </span>
          )}
          <button
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
            className="px-4 py-2 neumorphic-btn text-slate-800 disabled:opacity-40 text-xs font-extrabold rounded-full transition cursor-pointer"
          >
            Mark all read
          </button>
        </div>
      </div>

      {/* Main Responsive Container */}
      <div className="max-w-5xl w-full mx-auto">

        {/* Full-width System Alerts & Feed Panel */}
        <div className="finnova-card p-5 sm:p-6 flex flex-col">

          {/* Header & Filter Controls */}
          <div className="border-b border-slate-200/50 pb-3 shrink-0">
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 neumorphic-circle text-slate-800 flex items-center justify-center font-bold">
                  <Bell size={16} className="text-slate-800" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-slate-900 leading-tight">Live Alerts & Notifications</h2>
                  <p className="text-[10px] text-slate-500 font-extrabold uppercase tracking-wider">Real-time system-generated triggers</p>
                </div>
              </div>
              <div className="text-[10px] font-extrabold text-slate-900 neumorphic-btn px-3 py-1 rounded-full font-sans">
                {filteredNotifications.length} items
              </div>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'inventory', 'credit', 'system'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-xl transition cursor-pointer ${activeFilter === f
                      ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-sm'
                      : 'neumorphic-btn text-slate-800 hover:text-black'
                    }`}
                >
                  {f === 'all' ? 'All Logs' : f}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Alerts feed */}
          <div className="grow overflow-y-auto mt-4 pr-1 scrollbar-thin">
            <div className="space-y-3">
              <AnimatePresence initial={false}>
                {filteredNotifications.map((notif) => {
                  const isError = notif.type === 'error';
                  const isSuccess = notif.type === 'success';
                  const isRead = readNotifs.includes(notif.id);
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`relative overflow-hidden finnova-card p-4 rounded-2xl transition duration-200 border ${isRead
                          ? 'opacity-70 border-slate-200 dark:border-slate-800'
                          : isError
                            ? 'border-red-300 dark:border-red-900/60 shadow-md'
                            : isSuccess
                              ? 'border-emerald-300 dark:border-emerald-900/60 shadow-md'
                              : 'border-red-300 dark:border-red-900/60 shadow-md'
                        }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <div className="mt-0.5 shrink-0">
                          {isError ? (
                            <div className="w-9 h-9 rounded-full neumorphic-circle bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 flex items-center justify-center">
                              <AlertTriangle size={15} />
                            </div>
                          ) : isSuccess ? (
                            <div className="w-9 h-9 rounded-full neumorphic-circle bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                              <Check size={15} />
                            </div>
                          ) : (
                            <div className="w-9 h-9 rounded-full neumorphic-circle bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
                              <AlertCircle size={15} />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="text-xs font-extrabold text-slate-950 dark:text-white leading-tight font-jakarta">
                              {notif.title}
                            </h4>
                            <span className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold shrink-0 font-jakarta">
                              {formatTimeAgo(notif.date)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-900 dark:text-slate-100 leading-relaxed font-bold mt-1 font-jakarta">
                            {notif.description}
                          </p>

                          <div className="flex flex-wrap items-center justify-between gap-2.5 mt-3 pt-3 border-t border-slate-200/80 dark:border-slate-800">

                            {/* Meta flags */}
                            <div className="flex items-center gap-2">
                              <span className="neumorphic-btn px-2.5 py-1 text-[9px] font-extrabold font-jakarta uppercase text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md">
                                {notif.category}
                              </span>
                              {!isRead && (
                                <span className="inline-flex items-center gap-1 bg-red-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-md shadow-xs animate-pulse font-jakarta">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  Unread
                                </span>
                              )}
                            </div>

                            {/* Interaction Actions block */}
                            <div className="flex items-center gap-2">
                              {/* WhatsApp Dispatch icon */}
                              {notif.category === 'Inventory' && (notif.title.includes('Low Stock') || notif.title.includes('Out of Stock')) && (config.phone || config.adminPhone) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const text = `⚠️ RICHARD. Alerts: ${notif.description}`;
                                    const recipientPhone = config.phone || config.adminPhone || '';
                                    const cleanPh = recipientPhone.replace(/\D/g, '');
                                    if (cleanPh) {
                                      window.open(`https://wa.me/${cleanPh}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
                                    }
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-extrabold cursor-pointer transition select-none shadow-sm font-jakarta"
                                  title="Send WhatsApp Alert"
                                >
                                  <span>WhatsApp 💬</span>
                                </button>
                              )}

                              {/* Navigate to page button */}
                              <button
                                onClick={() => onNavigate(notif.targetScreen, notif.targetTab)}
                                className="neumorphic-btn bg-slate-950 text-white dark:bg-slate-800 dark:text-white px-3 py-1.5 rounded-lg text-xs font-extrabold hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer flex items-center gap-1.5 font-jakarta"
                              >
                                <span>Go to {notif.targetScreen}</span>
                                <ArrowRight size={12} />
                              </button>

                              {/* Mark Single Read */}
                              {!isRead && (
                                <button
                                  onClick={(e) => markAsRead(notif.id, e)}
                                  className="neumorphic-btn bg-white text-slate-900 dark:bg-slate-900 dark:text-white px-3 py-1.5 rounded-lg text-xs font-extrabold hover:text-red-600 dark:hover:text-red-400 transition cursor-pointer font-jakarta"
                                >
                                  Dismiss
                                </button>
                              )}
                            </div>

                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredNotifications.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 neumorphic-card rounded-2xl p-8 border border-white/90 shadow-sm">
                  <div className="w-12 h-12 neumorphic-circle text-slate-800 flex items-center justify-center mb-3">
                    <MaterialIcon name="check_circle" size={24} className="text-slate-800" />
                  </div>
                  <p className="text-xs font-extrabold text-slate-900">No active alerts found.</p>
                  <p className="text-[10px] text-slate-500 max-w-[220px] mt-1 leading-snug font-medium">
                    All system parameters are green. Filter: "{activeFilter}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
