import React, { useState, useEffect } from 'react';
import {
  Building2,
  LayoutDashboard,
  Boxes,
  Coins,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  History,
  Bell,
  AlertTriangle,
  Check,
  AlertCircle,
  Clock,
  Receipt,
  Shield,
  Menu,
  X,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BackendNotification, BusinessConfig, InventoryItem, CreditAccount, StockAdjustment, CreditTransaction, Organization, PendingRestock } from '../types';
import { translate } from '../utils/translations';
import MaterialIcon from './MaterialIcon';

interface NavigationProps {
  activeScreen: string;
  setActiveScreen: (screen: string) => void;
  config: BusinessConfig;
  children: React.ReactNode;
  warningAlertCount: number;
  onLogout: () => void;
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  userRole?: number;
  organizationName?: string;
  currentUserName?: string;
  currentUserPhoto?: string;
  currentOrg?: Organization;
  onNavigateToSettingsTab?: (tab: 'profile' | 'system' | 'security') => void;
  pendingRestocks?: PendingRestock[];
  onNavigateToInventoryTab?: (tab: 'active_stock' | 'damaged_audit' | 'restock_validations') => void;
  readNotificationIds?: string[];
  backendNotifications?: BackendNotification[];
  onMarkAsRead?: (ids: string[]) => void;
  themeMode?: 'light' | 'dark' | 'system';
  onThemeChange?: (theme: 'light' | 'dark') => void;
}

export default function Navigation({
  activeScreen,
  setActiveScreen,
  config,
  children,
  warningAlertCount,
  onLogout,
  inventory = [],
  creditAccounts = [],
  adjustments = [],
  transactions = [],
  userRole = 5,
  organizationName,
  currentUserName,
  currentUserPhoto,
  currentOrg,
  onNavigateToSettingsTab,
  pendingRestocks = [],
  onNavigateToInventoryTab,
  readNotificationIds = [],
  backendNotifications,
  onMarkAsRead,
  themeMode,
  onThemeChange
}: NavigationProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [notificationTab, setNotificationTab] = useState<'critical' | 'activities'>('critical');

  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const notificationRef = React.useRef<HTMLDivElement>(null);
  const mobileMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (isDropdownOpen) {
        const isClickInsideDropdown = dropdownRef.current?.contains(target);
        const isClickOnToggle = target.closest('#desktop-profile-trigger') || target.closest('#mobile-profile-trigger');
        if (!isClickInsideDropdown && !isClickOnToggle) {
          setIsDropdownOpen(false);
        }
      }

      if (isNotificationOpen) {
        const isClickInsideNotification = notificationRef.current?.contains(target);
        const isClickOnToggle = target.closest('#desktop-notifications-trigger') || target.closest('#mobile-notification-trigger');
        if (!isClickInsideNotification && !isClickOnToggle) {
          setIsNotificationOpen(false);
        }
      }

      if (isMobileMenuOpen) {
        const isClickInsideMobileMenu = mobileMenuRef.current?.contains(target);
        const isClickOnToggle = target.closest('#mobile-menu-trigger');
        if (!isClickInsideMobileMenu && !isClickOnToggle) {
          setIsMobileMenuOpen(false);
        }
      }
    };

    if (isDropdownOpen || isNotificationOpen || isMobileMenuOpen) {
      document.addEventListener('click', handleClickOutside, true);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside, true);
    };
  }, [isDropdownOpen, isNotificationOpen, isMobileMenuOpen]);

  // Low stock items computed list for news ticker
  const lowStockItems = React.useMemo(() => {
    return inventory.filter(item => item.quantity <= item.reorderPoint && item.quantity >= 1);
  }, [inventory]);

  const [currentTickerIndex, setCurrentTickerIndex] = useState(0);

  React.useEffect(() => {
    if (lowStockItems.length <= 1) {
      setCurrentTickerIndex(0);
      return;
    }
    const interval = setInterval(() => {
      setCurrentTickerIndex((prev) => (prev + 1) % lowStockItems.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [lowStockItems.length]);

  // Main navigation items with Google Fonts Material Symbols icons
  const navItems = [
    { id: 'dashboard', name: translate('dashboard', config.languageCode), materialIcon: 'dashboard' },
    { id: 'inventory', name: translate('inventory', config.languageCode), materialIcon: 'inventory_2' },
    { id: 'credit', name: translate('creditManagement', config.languageCode), materialIcon: 'payments' },
    { id: 'transactions', name: translate('transactions', config.languageCode), materialIcon: 'receipt_long' },
    { id: 'report', name: translate('reports', config.languageCode), materialIcon: 'bar_chart' },
    ...(userRole === 2 ? [{ id: 'activity_log', name: 'Activity', materialIcon: 'shield' }] : []),
    { id: 'invoice', name: translate('invoiceGenerator', config.languageCode), materialIcon: 'description' }
  ];

  const handleDropdownItemClick = (screenId: string) => {
    setActiveScreen(screenId);
    setIsDropdownOpen(false);
  };

  const handleNotificationItemClick = (screenId: string, targetTab?: string) => {
    setActiveScreen(screenId);
    if (screenId === 'settings' && targetTab && onNavigateToSettingsTab) {
      onNavigateToSettingsTab(targetTab as any);
    } else if (screenId === 'inventory' && targetTab && onNavigateToInventoryTab) {
      onNavigateToInventoryTab(targetTab as any);
    }
    setIsNotificationOpen(false);
  };

  const displayName = currentUserName || config.ownerName || 'Operator';
  const displayPhoto = currentUserPhoto || config.profilePhoto;
  const menuLetter = displayName ? displayName.trim().slice(0, 2).toUpperCase() : 'OP';

  // --- Dynamic Time difference formatter ---
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

  // Critical Alerts list: includes Out of Stock and Overdue Credit lines
  const criticalNotifications = React.useMemo(() => {
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
          description: `"${item.name}" (SKU: ${item.sku}) is running low with ${item.quantity} units left (shortage level: ${item.reorderPoint}).`,
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
            description: `${acc.name} holds ${config.currencySymbol}${(acc.remainingAmount || 0).toLocaleString()} past deadline.`,
            type: 'error',
            date: acc.lastUpdated || new Date().toISOString(),
            category: 'Credit',
            targetScreen: 'credit'
          });
        }
      }
    });

    // 3. Flagged transaction corrections awaiting review / resolved ones
    adjustments.forEach(adj => {
      if (adj.isFlagged) {
        list.push({
          id: `notif-flag-${adj.id}`,
          title: `Correction Flagged`,
          description: `"${adj.itemName}" transaction (Qty: ${adj.qtyChanged}) flagged by ${adj.flaggedBy || 'Attendant'}: "${adj.flagComment}"`,
          type: 'warning',
          date: adj.flaggedAt || adj.date || new Date().toISOString(),
          category: 'Flagged Transactions',
          targetScreen: 'transactions'
        });
      } else if (adj.isResolved) {
        list.push({
          id: `notif-resolved-${adj.id}`,
          title: `Stock Correction Made by Admin`,
          description: `"${adj.itemName}" corrected from ${adj.originalQtyChanged !== undefined ? adj.originalQtyChanged : 'N/A'} to ${adj.qtyChanged} by Admin. Reason: "${adj.correctionNotes || 'None'}"`,
          type: 'success',
          date: adj.resolvedAt || adj.date || new Date().toISOString(),
          category: 'Stock Corrections',
          targetScreen: 'transactions'
        });
      }
    });

    // 4. Flagged ledger transaction corrections awaiting review / resolved ones
    transactions.forEach(tx => {
      if (tx.isFlagged) {
        list.push({
          id: `notif-flag-tx-${tx.id}`,
          title: `Payment/Credit Flagged`,
          description: `"${tx.accountName}" ${(tx.type || '').toUpperCase()} transaction (${config.currencySymbol}${(tx.amount || 0).toLocaleString()}) flagged by ${tx.flaggedBy || 'Attendant'}: "${tx.flagComment}"`,
          type: 'warning',
          date: tx.flaggedAt || tx.date || new Date().toISOString(),
          category: 'Flagged Transactions',
          targetScreen: 'transactions'
        });
      } else if (tx.isResolved) {
        list.push({
          id: `notif-resolved-tx-${tx.id}`,
          title: `Transaction Corrected by Admin`,
          description: `"${tx.accountName}" transaction corrected from ${config.currencySymbol}${tx.originalAmount !== undefined && tx.originalAmount !== null ? tx.originalAmount.toLocaleString() : 'N/A'} to ${config.currencySymbol}${(tx.amount || 0).toLocaleString()} by Admin. Reason: "${tx.correctionNotes || 'None'}"`,
          type: 'success',
          date: tx.resolvedAt || tx.date || new Date().toISOString(),
          category: 'Transaction Corrections',
          targetScreen: 'transactions'
        });
      }
    });

    // 5. Attendant passcode reset requested
    if (userRole === 2 && currentOrg?.attendantResetRequested && currentOrg?.attendantPass?.startsWith('__RESETTING_')) {
      list.push({
        id: `notif-pass-reset-${currentOrg.id}`,
        title: 'Attendant PIN Reset Request',
        description: `Your attendant "${currentOrg.attendantResetUsername || 'Attendant'}" has requested a PIN reset. Click to set.`,
        type: 'error',
        date: new Date(currentOrg.attendantResetTimestamp || Date.now()).toISOString(),
        category: 'Security',
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
            category: 'Restock Validation',
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
            category: 'Restock Validation',
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
  }, [backendNotifications, inventory, creditAccounts, adjustments, transactions, config.currencySymbol, userRole, currentOrg, pendingRestocks]);

  // Combined Operations Feed (Latest 8 stock movements or credit movements)
  const activityEvents = React.useMemo(() => {
    const events: Array<{
      id: string;
      title: string;
      description: string;
      type: 'stock' | 'payment';
      date: string;
      badge: string;
      targetScreen: string;
    }> = [];

    // Process adjustments
    adjustments.forEach(adj => {
      const isPositive = adj.qtyChanged > 0;
      let badge = 'Stock In';
      if (adj.type === 'damaged') badge = 'Damage';
      else if (adj.type === 'returned') badge = 'Return';
      else if (adj.type === 'sale_out' || !isPositive) badge = 'Stock Out';

      events.push({
        id: `act-adj-${adj.id}`,
        title: adj.itemName,
        description: `${isPositive ? 'Restocked' : 'Checkout'} ${Math.abs(adj.qtyChanged)} units — ${adj.notes || 'Warehouse change'}`,
        type: 'stock',
        date: adj.date,
        badge,
        targetScreen: 'transactions'
      });
    });

    // Process transactions
    transactions.forEach(txn => {
      let badge = 'Charge';
      if (txn.type === 'pay') badge = 'Repayment';
      else if (txn.type === 'borrow') badge = 'Debt';

      events.push({
        id: `act-txn-${txn.id}`,
        title: txn.accountName || 'Ledger action',
        description: `${txn.type === 'pay' ? 'Paid' : 'Borrowed'} ${config.currencySymbol}${(txn.amount || 0).toLocaleString()} — ${txn.notes || 'Balance update'}`,
        type: 'payment',
        date: txn.date,
        badge,
        targetScreen: 'transactions'
      });
    });

    // Keep the full stream for unread-count reconciliation. The panel below
    // still renders only the latest eight entries for readability.
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, transactions, config.currencySymbol]);
  const visibleActivityEvents = activityEvents.slice(0, 8);
  const markAsRead = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onMarkAsRead) {
      onMarkAsRead([id]);
    }
  };

  const markAllAsRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    const allIds = [
      ...criticalNotifications.map(n => n.id),
      ...activityEvents.map(a => a.id)
    ];
    if (onMarkAsRead) {
      onMarkAsRead(allIds);
    }
  };

  const unreadCriticalCount = React.useMemo(() => {
    return criticalNotifications.filter(n => !readNotificationIds.includes(n.id)).length;
  }, [criticalNotifications, readNotificationIds]);

  const unreadActivityCount = React.useMemo(() => {
    return activityEvents.filter(e => !readNotificationIds.includes(e.id)).length;
  }, [activityEvents, readNotificationIds]);

  const criticalCount = criticalNotifications.length;
  // The global badge mirrors the Notifications page, which contains the
  // system-notification list. Live activities remain available in the panel
  // but must not make the main notification badge appear unread.
  const unreadNotificationCount = unreadCriticalCount;

  const [localDarkMode, setLocalDarkMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
    }
    return false;
  });

  const isDarkMode = themeMode ? themeMode === 'dark' : localDarkMode;

  useEffect(() => {
    const effectiveDarkMode = themeMode ? themeMode === 'dark' : localDarkMode;
    if (effectiveDarkMode) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  }, [themeMode, localDarkMode]);

  return (
    <div id="app-shell" className="relative min-h-screen crextio-canvas overflow-x-hidden flex flex-col text-slate-900 font-sans">

      {/* Decorative ambient subtle background gradients */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10 select-none">
        <div className="absolute -top-[10%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-200/30 blur-[130px]" />
        <div className="absolute top-[20%] -right-[15%] w-[50%] h-[50%] rounded-full bg-blue-200/25 blur-[140px]" />
        <div className="absolute -bottom-[5%] left-[10%] w-[50%] h-[50%] rounded-full bg-sky-200/30 blur-[120px]" />
      </div>

      {/* TOP FLOATING PILL NAVIGATION HEADER (CREXTIO & FINNOVA AESTHETIC) */}
      <header className="no-print sticky top-0 z-50 py-2.5 px-4 sm:px-6 xl:px-8 bg-[#ebf0f7] border-b border-slate-200/60 shadow-xs select-none">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Left Brand Identity Capsule */}
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              id="mobile-menu-trigger"
              onClick={() => {
                setIsMobileMenuOpen(!isMobileMenuOpen);
                setIsNotificationOpen(false);
                setIsDropdownOpen(false);
              }}
              className="xl:hidden p-2 text-slate-700 hover:text-slate-900 neumorphic-btn cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>

            <div className="flex items-center gap-2.5 neumorphic-card px-4 py-1.5 rounded-full select-none">
              <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-400 via-cyan-400 to-blue-500 flex items-center justify-center text-white text-[11px] font-black shadow-xs">
                L
              </div>
              <span className="font-extrabold text-sm tracking-wider uppercase bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-300 dark:via-cyan-300 dark:to-sky-400 [data-theme='dark']:from-sky-300 [data-theme='dark']:via-cyan-300 [data-theme='dark']:to-sky-400 bg-clip-text text-transparent">
                LERGON
              </span>
            </div>
          </div>

          {/* Center Pill Navbar Track (Crextio & Finnova Style) */}
          <nav className="hidden xl:flex items-center">
            <div className="pill-nav-track flex items-center gap-1.5 p-1.5">
              {navItems.map(item => {
                const isActive = activeScreen === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    id={`nav-btn-${item.id}`}
                    onClick={() => setActiveScreen(item.id)}
                    className={`flex items-center gap-2 select-none transition-all cursor-pointer rounded-full px-4 py-1.5 text-xs xl:text-sm font-bold ${isActive
                      ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-md shadow-sky-500/25'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50 font-bold'
                      }`}
                  >
                    <MaterialIcon name={item.materialIcon} size={18} className={isActive ? 'text-white' : 'text-slate-500'} />
                    <span>{item.name}</span>
                    {item.id === 'notifications' && unreadNotificationCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-black bg-white dark:bg-slate-950 text-red-600 dark:text-red-400 rounded-full leading-none animate-pulse border border-red-500 dark:border-red-400">
                        {unreadNotificationCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Right Action Controls & Profile Avatar Capsule */}
          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              id="theme-toggle-trigger"
              onClick={() => {
                const nextTheme = isDarkMode ? 'light' : 'dark';
                const root = document.documentElement;
                root.classList.toggle('dark', nextTheme === 'dark');
                root.setAttribute('data-theme', nextTheme);
                localStorage.setItem('theme', nextTheme);
                setLocalDarkMode(nextTheme === 'dark');
                onThemeChange?.(nextTheme);
              }}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="w-9 h-9 neumorphic-circle flex items-center justify-center text-slate-700 dark:text-amber-400 hover:text-amber-500 cursor-pointer transition-all duration-200"
            >
              {isDarkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-slate-700" />}
            </button>

            {/* Notification Alert Trigger */}
            <button
              type="button"
              id="desktop-notifications-trigger"
              onClick={() => {
                setActiveScreen('notifications');
                setIsDropdownOpen(false);
              }}
              className="relative w-9 h-9 neumorphic-circle flex items-center justify-center text-slate-700 hover:text-indigo-600 cursor-pointer transition"
            >
              <Bell size={16} />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-white dark:bg-slate-950 text-red-600 dark:text-red-400 font-extrabold text-[8px] px-1 rounded-full flex items-center justify-center border border-red-500 dark:border-red-400 animate-pulse">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {/* Profile Avatar Button & Dropdown Container */}
            <div className="relative">
              <button
                type="button"
                id="desktop-profile-trigger"
                onClick={() => {
                  setIsDropdownOpen(!isDropdownOpen);
                  setIsNotificationOpen(false);
                }}
                className="flex items-center p-0.5 rounded-full transition cursor-pointer"
              >
                <div className="w-9 h-9 neumorphic-circle flex items-center justify-center text-slate-900 font-extrabold text-xs uppercase select-none overflow-hidden">
                  {displayPhoto ? (
                    <img
                      src={displayPhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    menuLetter
                  )}
                </div>
              </button>

              {/* Float Dropdown Menu */}
              <AnimatePresence>
                {isDropdownOpen && (
                  <motion.div
                    ref={dropdownRef}
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -8 }}
                    transition={{ duration: 0.12, ease: 'easeOut' }}
                    className="z-50 absolute right-0 top-full mt-2 w-60 neumorphic-card rounded-2xl border border-white/90 shadow-2xl overflow-hidden text-slate-900 animate-fade-in"
                  >
                    {/* Dropdown Header Info block */}
                    <div className="p-5 border-b border-slate-200/50 flex flex-col items-center text-center">
                      <div className="w-14 h-14 neumorphic-circle text-slate-900 font-extrabold text-lg flex items-center justify-center select-none mb-2.5 overflow-hidden border border-white/90">
                        {displayPhoto ? (
                          <img
                            src={displayPhoto}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          menuLetter
                        )}
                      </div>
                      <div className="w-full">
                        <p className="font-extrabold text-sm text-slate-900 truncate">
                          {displayName}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500 truncate mt-0.5">
                          {config.email || 'No email registered'}
                        </p>
                        <div className="mt-2.5 text-center">
                          <span className="inline-block text-[9.5px] font-extrabold neumorphic-inset text-slate-800 px-3 py-1 rounded-full border border-white/50 shadow-2xs">
                            {config.currency} ({config.currencySymbol})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Operational Settings options */}
                    <div className="p-2.5 space-y-2 bg-[#ebf0f7]/50 border-t border-slate-200/50">
                      <button
                        type="button"
                        id="dropdown-settings"
                        onClick={() => handleDropdownItemClick('settings')}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-slate-900 neumorphic-btn hover:text-black transition cursor-pointer text-left select-none border border-white/80"
                      >
                        <MaterialIcon name="settings" size={16} className="text-slate-800" />
                        <span>{translate('settings', config.languageCode)}</span>
                      </button>

                      <button
                        type="button"
                        id="dropdown-logout"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-extrabold text-slate-900 neumorphic-btn hover:text-black transition cursor-pointer text-left select-none border border-white/80"
                      >
                        <MaterialIcon name="logout" size={16} className="text-slate-800" />
                        <span>{translate('logOut', config.languageCode)}</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mobile Hamburger Menu Dropdown Overlay */}
          <AnimatePresence>
            {isMobileMenuOpen && (
              <motion.div
                ref={mobileMenuRef}
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.12, ease: 'easeOut' }}
                className="xl:hidden z-50 absolute left-4 right-4 top-14 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in"
              >
                <div className="p-3.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500">Navigation Menu</span>
                  <button
                    type="button"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>
                <div className="py-1 max-h-[60vh] overflow-y-auto">
                  {navItems.map(item => {
                    const isActive = activeScreen === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setActiveScreen(item.id);
                          setIsMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3.5 text-xs font-bold transition cursor-pointer text-left border-l-4 ${isActive
                          ? 'bg-indigo-50/75 text-indigo-700 border-indigo-500 font-extrabold'
                          : 'text-slate-700 hover:bg-slate-50 border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <MaterialIcon name={item.materialIcon} size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                          <span>{item.name}</span>
                        </div>
                        {item.id === 'notifications' && unreadNotificationCount > 0 && (
                          <span className="px-2 py-0.5 text-[9px] font-black bg-white dark:bg-slate-950 text-red-600 dark:text-red-400 rounded-full leading-none mr-2 border border-red-500 dark:border-red-400">
                            {unreadNotificationCount}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>



          {/* REAL-TIME DYNAMIC SYSTEM MONITORING NOTIFICATIONS PANEL */}
          <AnimatePresence>
            {isNotificationOpen && (
              <motion.div
                ref={notificationRef}
                initial={{ opacity: 0, scale: 0.95, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -8 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="z-50 absolute right-0 top-11 xl:top-15 mt-1 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in"
              >
                {/* Header Title with Counts */}
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-indigo-400 animate-swing" />
                    <span className="font-bold text-xs tracking-tight">{translate('systemNotificationCenter', config.languageCode)}</span>
                  </div>
                  {unreadCriticalCount > 0 || unreadActivityCount > 0 ? (
                    <button
                      type="button"
                      onClick={markAllAsRead}
                      className="bg-slate-800 hover:bg-slate-705 active:bg-slate-700 text-slate-100 text-[8px] font-extrabold px-2 py-0.5 rounded-md border border-slate-700 transition cursor-pointer font-bold uppercase tracking-wider select-none"
                    >
                      Mark all read
                    </button>
                  ) : (
                    <span className="text-slate-400 text-[8px] font-semibold uppercase tracking-wider select-none">All Read</span>
                  )}
                </div>

                {/* Tabs Selector */}
                <div className="flex border-b border-slate-100 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => setNotificationTab('critical')}
                    className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md uppercase tracking-wider transition ${notificationTab === 'critical'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-850'
                      }`}
                  >
                    {translate('alerts', config.languageCode)} <span className="text-red-600 font-black">({unreadCriticalCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotificationTab('activities')}
                    className={`flex-1 py-1.5 text-center text-[10px] font-bold rounded-md uppercase tracking-wider transition ${notificationTab === 'activities'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-slate-500 hover:text-slate-850'
                      }`}
                  >
                    {translate('liveActivities', config.languageCode)} <span className="text-red-600 font-black">({unreadActivityCount})</span>
                  </button>
                </div>

                {/* Notification List Container */}
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {notificationTab === 'critical' ? (
                    criticalNotifications.length > 0 ? (
                      criticalNotifications.map((notif) => {
                        const isError = notif.type === 'error';
                        const isSuccess = notif.type === 'success';
                        const isRead = readNotificationIds.includes(notif.id);
                        return (
                          <div
                            key={notif.id}
                            className={`w-full text-left px-4 py-2.5 transition flex items-start gap-2.5 border-b border-slate-100 relative ${isRead ? 'bg-slate-50/50 hover:bg-slate-50/80 opacity-60' : 'bg-white hover:bg-slate-50/70'
                              }`}
                          >
                            <div
                              onClick={() => handleNotificationItemClick(notif.targetScreen, notif.targetTab)}
                              className="flex-1 text-left flex items-start gap-2.5 min-w-0 cursor-pointer"
                            >
                              <div className="mt-0.5 shrink-0">
                                {isError ? (
                                  <div className="p-1 rounded-full bg-red-50 text-red-600 border border-red-100">
                                    <AlertTriangle size={12} />
                                  </div>
                                ) : isSuccess ? (
                                  <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    <Check size={12} />
                                  </div>
                                ) : (
                                  <div className="p-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                    <AlertCircle size={12} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className={`font-bold text-[11px] leading-tight ${isRead ? 'text-slate-500' : isError ? 'text-red-700' : isSuccess ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {notif.title}
                                </p>
                                <p className="text-[10px] text-slate-600 mt-0.5 leading-snug">
                                  {notif.description}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1.5 text-[8.5px] text-slate-400 font-semibold font-mono">
                                  <span className="uppercase text-[8px] bg-slate-100 px-1 rounded text-slate-500">
                                    {notif.category}
                                  </span>
                                  <span>•</span>
                                  <span>{formatTimeAgo(notif.date)}</span>
                                </div>
                                {notif.category === 'Inventory' && (notif.title.includes('Low Stock') || notif.title.includes('Out of Stock')) && (config.attendantPhone || config.adminPhone || config.phone) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const pendingReport = localStorage.getItem('velo_ic_pending_whatsapp_report') || `⚠️ Shortage Warning: ${notif.description}`;
                                      const recipientPhone = config.attendantPhone || config.adminPhone || config.phone || '';
                                      const cleanPh = recipientPhone.replace(/\D/g, '');
                                      if (cleanPh) {
                                        window.open(`https://wa.me/${cleanPh}?text=${encodeURIComponent(pendingReport)}`, '_blank', 'noopener,noreferrer');
                                      }
                                    }}
                                    className="mt-1.5 flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/60 rounded text-[9px] font-extrabold cursor-pointer transition select-none inline-flex"
                                    title="Send WhatsApp Alert"
                                  >
                                    <span>WhatsApp 💬</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Toggle Check Button on far right */}
                            {!isRead && (
                              <button
                                type="button"
                                onClick={(e) => markAsRead(notif.id, e)}
                                className="shrink-0 p-1 bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-md transition cursor-pointer self-center"
                                title="Mark as read"
                              >
                                <Check size={11} className="stroke-[3]" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400">
                        <Check className="mx-auto text-emerald-500 mb-2" size={18} />
                        <p className="font-extrabold text-[10px] uppercase tracking-wider text-slate-800">{translate('noAlertsPending', config.languageCode)}</p>
                        <p className="text-[10px] mt-0.5">{translate('allAlertsCleared', config.languageCode)}</p>
                      </div>
                    )
                  ) : (
                    visibleActivityEvents.length > 0 ? (
                      visibleActivityEvents.map((evt) => {
                        const isStock = evt.type === 'stock';
                        const isRead = readNotificationIds.includes(evt.id);
                        return (
                          <div
                            key={evt.id}
                            className={`w-full text-left px-4 py-2.5 transition flex items-start gap-2.5 border-b border-slate-100 relative ${isRead ? 'bg-slate-50/50 hover:bg-slate-50/80 opacity-60' : 'bg-white hover:bg-slate-50/70'
                              }`}
                          >
                            <button
                              type="button"
                              onClick={() => handleNotificationItemClick(evt.targetScreen)}
                              className="flex-1 text-left flex items-start gap-2.5 min-w-0 cursor-pointer"
                            >
                              <div className="mt-0.5 shrink-0">
                                {isStock ? (
                                  <div className="p-1 rounded-full bg-blue-50 text-indigo-500 border border-blue-100">
                                    <Boxes size={12} />
                                  </div>
                                ) : (
                                  <div className="p-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                    <Coins size={12} />
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-extrabold text-[10px] text-slate-800 uppercase tracking-tight truncate">
                                  {evt.title}
                                </p>
                                <p className="text-[10px] text-slate-655 mt-0.5 leading-snug">
                                  {evt.description}
                                </p>
                                <div className="flex items-center gap-1.5 mt-1.5 text-[8.5px] text-slate-400 font-semibold">
                                  <span className={`uppercase font-mono text-[8px] px-1 rounded ${isStock ? 'bg-blue-50 text-indigo-600 font-bold' : 'bg-emerald-50 text-emerald-700 font-bold'
                                    }`}>
                                    {evt.badge}
                                  </span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-400">{formatTimeAgo(evt.date)}</span>
                                </div>
                              </div>
                            </button>

                            {/* Toggle Check Button on far right */}
                            {!isRead && (
                              <button
                                type="button"
                                onClick={(e) => markAsRead(evt.id, e)}
                                className="shrink-0 p-1 bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-md transition cursor-pointer self-center"
                                title="Mark as read"
                              >
                                <Check size={11} className="stroke-[3]" />
                              </button>
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-6 text-center text-slate-400">
                        <Clock className="mx-auto text-slate-300 mb-2" size={16} />
                        <p className="font-extrabold text-[10px] uppercase tracking-wider text-slate-800">No Activity Recorded</p>
                        <p className="text-[10px] mt-0.5">Real-time actions populate automatic log feeds.</p>
                      </div>
                    )
                  )}
                </div>

                {/* Footer link to easily look at full log feed */}
                <div className="bg-slate-50 border-t border-slate-100 p-2 text-center">
                  <button
                    type="button"
                    onClick={() => handleNotificationItemClick('transactions')}
                    className="text-[9.5px] font-black uppercase text-indigo-600 hover:text-indigo-800 tracking-wider cursor-pointer"
                  >
                    {translate('viewFullAuditLedger', config.languageCode)} →
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* VIEWPORT BODY CONTENT CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0">
        {lowStockItems.length > 0 && (
          <div className="neumorphic-inset bg-[#eef2f7] dark:bg-[#0f172a] text-[10px] sm:text-[11px] font-semibold py-1 px-3 sm:px-4 flex items-center h-9 select-none relative overflow-hidden shrink-0 no-print min-w-0 border-b border-slate-200/80 dark:border-slate-800">
            <div className="flex items-center gap-1.5 shrink-0 z-10">
              <div className="neumorphic-btn bg-white dark:bg-slate-800 text-slate-950 dark:text-white px-3 py-1 text-[9px] font-extrabold font-jakarta uppercase tracking-wider flex items-center gap-1.5 rounded-full border border-slate-300 dark:border-slate-700 shadow-sm">
                <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="font-extrabold text-slate-950 dark:text-white">LOW STOCK<span className="hidden sm:inline"> TICKER</span></span>
              </div>
            </div>

            <div className="relative w-full h-full overflow-hidden flex items-center pl-3 sm:pl-4 bg-transparent select-none min-w-0">
              <AnimatePresence mode="wait">
                {lowStockItems.map((item, idx) => {
                  if (idx !== (currentTickerIndex < lowStockItems.length ? currentTickerIndex : 0)) return null;
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ x: 120, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      exit={{ x: -120, opacity: 0 }}
                      transition={{ duration: 0.45, ease: "easeInOut" }}
                      className="flex items-center gap-2 h-full py-1 whitespace-nowrap min-w-0 text-[11px] font-jakarta"
                    >
                      <span
                        className="text-slate-950 dark:text-white font-extrabold hover:underline cursor-pointer truncate max-w-[110px] xs:max-w-[150px] sm:max-w-none"
                        onClick={() => setActiveScreen('inventory')}
                        title={item.name}
                      >
                        "{item.name}"
                      </span>
                      <span className="text-slate-950 dark:text-slate-100 font-extrabold uppercase tracking-wide shrink-0">
                        — LOW STOCK [ <strong className="font-black text-slate-950 dark:text-white">{item.quantity}</strong> UNITS LEFT ]
                      </span>
                      {lowStockItems.length > 1 && (
                        <span className="text-[10px] text-slate-700 dark:text-slate-300 font-extrabold ml-1 shrink-0 font-jakarta">
                          ({currentTickerIndex + 1}/{lowStockItems.length})
                        </span>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        <main id="app-main-content" className="flex-1 p-3 sm:p-4 xl:p-4 overflow-y-auto">
          <div className={`${(activeScreen === 'invoice' || activeScreen === 'transactions') ? 'max-w-none xl:max-w-[1550px]' : 'max-w-7xl'} mx-auto w-full`}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
