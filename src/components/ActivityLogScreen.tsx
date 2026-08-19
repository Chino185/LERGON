import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Calendar,
  User,
  FileDown,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Shield,
  Eye,
  X,
  Printer,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StockAdjustment, CreditTransaction, InventoryItem, CreditAccount, BusinessConfig } from '../types';
import MaterialIcon from './MaterialIcon';
import NeumorphicSelect, { NeumorphicSelectOption } from './NeumorphicSelect';
import { downloadCSV, formatCSVDateTime, formatCSVCurrency, formatCSVNumber } from '../utils/csvExporter';

interface ActivityLogScreenProps {
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  config: BusinessConfig;
}

export default function ActivityLogScreen({
  adjustments = [],
  transactions = [],
  inventory = [],
  creditAccounts = [],
  config
}: ActivityLogScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [performerFilter, setPerformerFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<any>(null);

  // Combine adjustments & transactions into unified log activities
  const allActivities = useMemo(() => {
    const list: any[] = [];

    // Process physical stock adjustments (Restocks, Sales, Damages, Returns, Audits)
    adjustments.forEach(adj => {
      const item = inventory.find(i => i.id === adj.itemId);
      const isPositive = adj.qtyChanged > 0;

      let activityType = 'audit';
      let title = 'Audit Stock Adjustment';
      let badgeColor = 'bg-slate-100 text-slate-800 border-slate-200';
      let icon = <Clock size={14} />;

      const isInitialStock = adj.type === 'initial_stock'
        || (adj.type === 'purchase_in' && (adj.notes || '').toLowerCase().includes('initial stock'));

      if (isInitialStock) {
        activityType = 'new_item';
        title = `New Item ${adj.itemName}`;
        badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        icon = <MaterialIcon name="add_box" size={14} className="text-slate-800" />;
      } else if (adj.type === 'purchase_in') {
        activityType = 'restock';
        title = `Restocked ${adj.itemName}`;
        badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        icon = <MaterialIcon name="south_east" size={14} className="text-slate-800" />;
      } else if (adj.type === 'sale_out') {
        activityType = 'sell';
        title = `Sold ${adj.itemName}`;
        badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        icon = <MaterialIcon name="north_east" size={14} className="text-slate-800" />;
      } else if (adj.type === 'damaged') {
        activityType = 'damaged';
        title = `Damaged Asset: ${adj.itemName}`;
        badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        icon = <MaterialIcon name="warning" size={14} className="text-slate-800" />;
      } else if (adj.type === 'returned') {
        activityType = 'returned';
        title = `Returned Item: ${adj.itemName}`;
        badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        icon = <MaterialIcon name="settings_backup_restore" size={14} className="text-slate-800" />;
      }

      // Compute standard cost/revenue value if possible
      const itemCost = item?.unitCost || 0;
      const itemPrice = item?.unitPrice || 0;
      const totalCostValue = Math.abs(adj.qtyChanged) * itemCost;
      const totalSalesValue = Math.abs(adj.qtyChanged) * itemPrice;
      const adjustmentCorrectionNote = adj.isResolved && adj.correctionNotes
        ? `[Corrected from ${adj.originalQtyChanged ?? adj.qtyChanged} to ${adj.qtyChanged}: ${adj.correctionNotes}]`
        : '';
      const adjustmentNotes = adjustmentCorrectionNote && (adj.notes || '').includes(adjustmentCorrectionNote)
        ? (adj.notes || adjustmentCorrectionNote)
        : [adj.notes, adjustmentCorrectionNote].filter(Boolean).join(' ') || 'No description recorded.';

      list.push({
        id: `stock-${adj.id}`,
        rawId: adj.id,
        date: adj.isResolved && adj.resolvedAt ? adj.resolvedAt : adj.date,
        performedBy: adj.performedBy || 'System / Initial Seed',
        category: 'stock',
        type: activityType,
        title,
        badgeColor,
        icon,
        quantity: Math.abs(adj.qtyChanged),
        amount: activityType === 'sell' ? totalSalesValue : totalCostValue,
        notes: adjustmentNotes,
        meta: {
          itemName: adj.itemName,
          sku: item?.sku || 'N/A',
          qtyChanged: adj.qtyChanged,
          unitCost: itemCost,
          unitPrice: itemPrice,
          creditAccountId: adj.creditAccountId,
          creditAccountName: adj.creditAccountId ? (creditAccounts.find(c => c.id === adj.creditAccountId)?.name || 'Credit Account') : null
        }
      });
    });

    // Process accounts receivables/payables transactions. A credit or
    // supplier-credit row without an account ID is malformed legacy data and
    // must not appear as an "Unknown" credit charge in the operator ledger.
    transactions
      .filter(txn => {
        const transactionType = txn.transactionType || '';
        const isCreditLedgerEvent = ['credit', 'supplier_credit', 'repayment', 'supplier_payment'].includes(transactionType);
        return isCreditLedgerEvent && Boolean(txn.creditAccountId);
      })
      .forEach(txn => {
        const account = creditAccounts.find(c => c.id === txn.creditAccountId);

        let activityType = 'credit_charge';
        let title = `Credit Charged: ${txn.accountName || 'Unknown'}`;
        let badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
        let icon = <MaterialIcon name="credit_card" size={14} className="text-slate-800" />;

        if (txn.type === 'pay') {
          activityType = 'credit_payment';
          title = `Cleared Repayment: ${txn.accountName || 'Unknown'}`;
          badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
          icon = <MaterialIcon name="check_circle" size={14} className="text-slate-800" />;
        } else if (txn.type === 'borrow') {
          activityType = 'credit_borrow';
          title = `Debted Balance: ${txn.accountName || 'Unknown'}`;
          badgeColor = 'neumorphic-card bg-slate-100/80 text-slate-900 border-slate-200/80 font-extrabold shadow-2xs';
          icon = <MaterialIcon name="settings_backup_restore" size={14} className="text-slate-800" />;
        }

        const transactionCorrectionNote = txn.isResolved && txn.correctionNotes
          ? `[Corrected from ${txn.originalAmount ?? txn.amount} to ${txn.amount}: ${txn.correctionNotes}]`
          : '';
        const transactionNotes = [txn.notes, transactionCorrectionNote].filter(Boolean).join(' ') || 'No notes entered.';

        list.push({
          id: `credit-${txn.id}`,
          rawId: txn.id,
          date: txn.isResolved && txn.resolvedAt ? txn.resolvedAt : txn.date,
          performedBy: txn.performedBy || 'System / Initial Seed',
          category: 'credit',
          type: activityType,
          title,
          badgeColor,
          icon,
          quantity: null,
          amount: txn.amount,
          notes: transactionNotes,
          meta: {
            accountName: txn.accountName,
            accountPhone: account?.phone || 'N/A',
            accountType: account?.type || 'Unknown Type',
            paymentMethod: txn.paymentMethod || 'N/A',
            transactionProof: txn.transactionProof || null,
            remainingAmount: txn.remainingAmount
          }
        });
      });

    // Sort complete chronological log with newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [adjustments, transactions, inventory, creditAccounts]);

  // Extract distinct list of actors/performers for custom filters
  const allPerformers = useMemo(() => {
    const set = new Set<string>();
    allActivities.forEach(act => {
      set.add(act.performedBy);
    });
    return Array.from(set);
  }, [allActivities]);

  const performerOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: 'all', label: 'Every User / Operator' },
    ...allPerformers.map(actor => ({ value: actor, label: actor }))
  ], [allPerformers]);

  const actionCategoryOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Movements' },
    { value: 'restock', label: 'Restocks (Capital Purchases)' },
    { value: 'new_item', label: 'New Items (Initial Stock)' },
    { value: 'sell', label: 'Sales (Product Checkouts)' },
    { value: 'damaged', label: 'Damages (Asset Shrinkage)' },
    { value: 'credit', label: 'Credit Ledgers (Borrows/Pays)' }
  ], []);

  const dateIntervalOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Recorded History' },
    { value: 'today', label: 'Today Only' },
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Date Range...' }
  ], []);

  // Active filters handler
  const filteredActivities = useMemo(() => {
    return allActivities.filter(act => {
      // 1. Text Search matches
      const cleanQuery = searchQuery.toLowerCase().trim();
      if (cleanQuery) {
        const matchesTitle = act.title.toLowerCase().includes(cleanQuery);
        const matchesNotes = act.notes.toLowerCase().includes(cleanQuery);
        const matchesPerformer = act.performedBy.toLowerCase().includes(cleanQuery);
        const matchesSku = act.meta.sku ? act.meta.sku.toLowerCase().includes(cleanQuery) : false;

        if (!matchesTitle && !matchesNotes && !matchesPerformer && !matchesSku) {
          return false;
        }
      }

      // 2. Filter by Performer / Operator
      if (performerFilter !== 'all' && act.performedBy !== performerFilter) {
        return false;
      }

      // 3. Filter by Transaction Activity Type
      if (typeFilter !== 'all') {
        if (typeFilter === 'restock' && act.type !== 'restock') return false;
        if (typeFilter === 'new_item' && act.type !== 'new_item') return false;
        if (typeFilter === 'sell' && act.type !== 'sell') return false;
        if (typeFilter === 'damaged' && act.type !== 'damaged') return false;
        if (typeFilter === 'credit' && act.category !== 'credit') return false;
      }

      // 4. Filter by Date range
      if (dateFilter !== 'all') {
        const actDate = new Date(act.date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateFilter === 'today') {
          const actDay = new Date(act.date);
          actDay.setHours(0, 0, 0, 0);
          if (actDay.getTime() !== today.getTime()) return false;
        } else if (dateFilter === '7days') {
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (actDate < sevenDaysAgo) return false;
        } else if (dateFilter === '30days') {
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (actDate < thirtyDaysAgo) return false;
        } else if (dateFilter === 'custom') {
          if (customStartDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            if (actDate < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            if (actDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [allActivities, searchQuery, performerFilter, typeFilter, dateFilter, customStartDate, customEndDate]);

  // Download CSV helper
  const handleExportCSV = () => {
    const headers = ['Activity Logs', 'Type', 'Date', 'Performed By', 'Quantity', 'Associated Value', 'Notes', 'Linked Reference'];
    const rows = filteredActivities.map(act => {
      const notesClean = act.notes.replace(/\n/g, ' ');
      const reference = act.category === 'stock'
        ? `SKU: ${act.meta.sku || 'N/A'}`
        : `Account: ${act.meta.accountName || 'N/A'}`;

      return [
        act.title,
        act.type.toUpperCase(),
        formatCSVDateTime(act.date),
        act.performedBy,
        formatCSVNumber(act.quantity || 0),
        formatCSVCurrency(act.amount, config.currencySymbol),
        notesClean,
        reference
      ];
    });

    downloadCSV({
      filename: `audits_activity_logs_${new Date().toISOString().slice(0, 10)}.xlsx`,
      headers,
      rows
    });
  };

  const formatMoney = (val: number) => {
    return `${config.currencySymbol}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getInitials = (name: string) => {
    return name ? name.trim().slice(0, 2).toUpperCase() : 'OP';
  };

  // Helper: Get Month and Year string label (e.g. "June 2026")
  const getMonthYearLabel = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        return 'Unknown Month';
      }
      return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } catch {
      return 'Unknown Month';
    }
  };

  // Helper: Group items with date by month
  const groupItemsByMonth = <T extends { date: string }>(items: T[]): { monthLabel: string; items: T[] }[] => {
    const groups: { [key: string]: T[] } = {};

    // Sort items newest first before grouping
    const sortedItems = [...items].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    sortedItems.forEach(item => {
      const label = getMonthYearLabel(item.date);
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(item);
    });

    return Object.entries(groups).map(([monthLabel, groupItems]) => ({
      monthLabel,
      items: groupItems
    })).sort((a, b) => {
      const dateA = new Date(a.items[0]?.date || 0).getTime();
      const dateB = new Date(b.items[0]?.date || 0).getTime();
      return dateB - dateA;
    });
  };

  return (
    <div className="space-y-6 animate-fade-in activity-log-print-container">
      <style>{`
        @media print {
          /* Force Light Mode Print Layout for Activity Log Page */
          html, body, #root, main, .activity-log-print-container, .activity-log-print-container * {
            background-color: #ffffff !important;
            background: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            text-shadow: none !important;
            border-color: #e2e8f0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .activity-log-print-header {
            background-color: #ffffff !important;
            border-bottom: 2px solid #0f172a !important;
            color: #0f172a !important;
          }

          .activity-log-print-header *,
          .activity-log-print-header p,
          .activity-log-print-header h1,
          .activity-log-print-header h2,
          .activity-log-print-header strong {
            color: #0f172a !important;
          }

          /* Table Header Bar */
          .activity-log-print-table thead,
          .activity-log-print-table thead tr,
          .activity-log-print-table thead th,
          .activity-log-print-table .neumorphic-table-header,
          .activity-log-print-table .neumorphic-table-header th {
            background-color: #e2e8f0 !important;
            background: #e2e8f0 !important;
            color: #0f172a !important;
            border-color: #cbd5e1 !important;
            font-weight: 800 !important;
            text-shadow: none !important;
          }

          /* Month Group Divider Row */
          .activity-log-print-table tr.bg-slate-100\/70,
          .activity-log-print-table tr[class*="bg-slate-100"] {
            background-color: #f1f5f9 !important;
            background: #f1f5f9 !important;
            border-color: #cbd5e1 !important;
          }

          .activity-log-print-table tr.bg-slate-100\/70 td,
          .activity-log-print-table tr[class*="bg-slate-100"] td {
            color: #475569 !important;
            font-weight: 800 !important;
          }

          /* Table Body Rows */
          .activity-log-print-table tbody tr {
            background-color: #ffffff !important;
            border-bottom: 1px solid #e2e8f0 !important;
          }

          .activity-log-print-table tbody tr:nth-child(even) {
            background-color: #f8fafc !important;
          }

          /* Cell Text */
          .activity-log-print-table td,
          .activity-log-print-table span,
          .activity-log-print-table div,
          .activity-log-print-table strong {
            color: #0f172a !important;
          }

          .activity-log-print-table .text-slate-500,
          .activity-log-print-table .text-slate-600 {
            color: #475569 !important;
          }

          /* Badge Pills ("Admin", "SELL", "RESTOCK") */
          .activity-log-print-table .neumorphic-btn,
          .activity-log-print-table span[class*="neumorphic-btn"],
          .activity-log-print-table span[class*="rounded-full"] {
            background-color: #e2e8f0 !important;
            background: #e2e8f0 !important;
            color: #0f172a !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
          }

          .activity-log-print-table .neumorphic-btn *,
          .activity-log-print-table span[class*="neumorphic-btn"] * {
            color: #0f172a !important;
          }

          /* Cards */
          .activity-log-print-card,
          .finnova-card {
            background-color: #ffffff !important;
            background: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      {/* HEADER SECTION (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card p-5 sm:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 neumorphic-circle text-slate-900 flex items-center justify-center">
              <MaterialIcon name="verified_user" size={22} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                Operator Security Activity
              </h1>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                A system-authoritative, immutable chronological log of stock adjustments and customer credit line transformations.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 select-none self-stretch sm:self-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={filteredActivities.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 neumorphic-btn bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-xs font-black px-5 py-2.5 rounded-full transition shadow-md shadow-sky-500/25 cursor-pointer"
          >
            <FileDown size={14} />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center p-2.5 neumorphic-circle text-slate-700 transition cursor-pointer"
            title="Print overview"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* FILTERS & METRICS BENTO GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Filter Widget panel */}
        <div className="lg:col-span-1 finnova-card p-5 sm:p-6 space-y-4 no-print">
          <h2 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-100 pb-3">
            <MaterialIcon name="filter_alt" size={16} className="text-slate-800" />
            <span>Search & Filters</span>
          </h2>

          {/* Text Search Input */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Query Search</label>
            <div className="relative">
              <input
                type="text"
                placeholder="SKU, operator, desc..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full text-xs px-3 py-2.5 pl-8 rounded-full neumorphic-inset focus:outline-hidden transition font-bold text-slate-800 placeholder:text-slate-400"
              />
              <Search className="absolute left-3 top-3 text-slate-400" size={13} />
            </div>
          </div>

          {/* Performer / Operator Filter Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Who Performed</label>
            <NeumorphicSelect
              value={performerFilter}
              onChange={setPerformerFilter}
              options={performerOptions}
              icon={<User size={14} />}
              className="w-full"
            />
          </div>

          {/* Action Type Filter Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Action Category</label>
            <NeumorphicSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={actionCategoryOptions}
              icon={<Filter size={14} />}
              className="w-full"
            />
          </div>

          {/* Date range Filter Selector */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Time Interval</label>
            <NeumorphicSelect
              value={dateFilter}
              onChange={setDateFilter}
              options={dateIntervalOptions}
              icon={<Calendar size={14} />}
              className="w-full"
            />
          </div>

          <AnimatePresence>
            {dateFilter === 'custom' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3 pt-2 overflow-hidden"
              >
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block text-indigo-950">Start Date</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="w-full neumorphic-inset bg-[#ebf0f7] dark:bg-[#202225] border border-white/80 dark:border-slate-700 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block text-indigo-950">End Date</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="w-full neumorphic-inset bg-[#ebf0f7] dark:bg-[#202225] border border-white/80 dark:border-slate-700 text-slate-900 dark:text-white text-xs px-3 py-2.5 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Activity List */}
        <div className="lg:col-span-3 space-y-4">

          {/* Metrics summary widgets */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 no-print">
            <div className="finnova-card p-4">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-800 block">Total Logs Captured</span>
              <strong className="text-xl font-bold font-jakarta text-slate-900 block mt-1">{filteredActivities.length}</strong>
            </div>
            <div className="finnova-card p-4">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-800 block">Restocks Logged</span>
              <strong className="text-xl font-bold font-jakarta text-slate-900 block mt-1">
                {filteredActivities.filter(a => a.type === 'restock').length}
              </strong>
            </div>
            <div className="finnova-card p-4">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-800 block">Product Checkouts</span>
              <strong className="text-xl font-bold font-jakarta text-slate-900 block mt-1">
                {filteredActivities.filter(a => a.type === 'sell').length}
              </strong>
            </div>
            <div className="finnova-card p-4">
              <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-800 block">Credit Ledger</span>
              <strong className="text-xl font-bold font-jakarta text-slate-900 block mt-1">
                {filteredActivities.filter(a => a.category === 'credit').length}
              </strong>
            </div>
          </div>

          <div className="finnova-card p-0 sm:p-0 overflow-hidden">
            {filteredActivities.length === 0 ? (
              <div className="py-24 text-center text-slate-400 max-w-md mx-auto">
                <Shield size={32} className="mx-auto text-slate-400 stroke-[1.5] mb-2.5 animate-pulse" />
                <h3 className="font-extrabold text-sm text-slate-850">No Operator Activity Logs Found</h3>
                <p className="text-xs text-slate-500 mt-1">
                  We scanned all chronological logs but couldn't locate actions matching your selected query parameters.
                </p>
                {(searchQuery || performerFilter !== 'all' || typeFilter !== 'all' || dateFilter !== 'all' || customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setPerformerFilter('all');
                      setTypeFilter('all');
                      setDateFilter('all');
                      setCustomStartDate('');
                      setCustomEndDate('');
                    }}
                    className="mt-4 px-4 py-1.5 neumorphic-inset text-xs font-bold text-slate-800 rounded-full transition cursor-pointer"
                  >
                    Clear Filter Parameters
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Print-only Document Title Banner */}
                <div className="hidden print:flex items-center justify-between p-4 border-b-2 border-slate-900 mb-4 bg-white activity-log-print-header">
                  <div>
                    <h1 className="text-xl font-black uppercase text-slate-900">{config.businessName || 'Business Enterprise'}</h1>
                    <h2 className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-0.5">Chronological Operator Activity Log</h2>
                  </div>
                  <div className="text-right text-[10px] text-slate-500">
                    <p><strong className="text-slate-800">Printed On:</strong> {new Date().toLocaleString()}</p>
                    <p><strong className="text-slate-800">Total Entries:</strong> {filteredActivities.length}</p>
                  </div>
                </div>

                <table className="w-full text-left border-collapse table-fixed text-xs activity-log-print-table">
                  <thead>
                    <tr className="neumorphic-table-header text-[10px] select-none">
                      <th className="py-3 px-3 w-[18%] text-center">Date & Time</th>
                      <th className="py-3 px-3 w-[12%] text-center">Role Key</th>
                      <th className="py-3 px-3 w-[20%] text-center">Transformation Type</th>
                      <th className="py-3 px-3 w-[35%] text-center">Details Summary</th>
                      <th className="py-3 px-3 w-[15%] text-center">Associated Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groupItemsByMonth<any>(filteredActivities).map((group) => (
                      <React.Fragment key={group.monthLabel}>
                        <tr className="bg-slate-100/70 border-y border-slate-200/60 select-none">
                          <td colSpan={5} className="px-4 py-2 font-black text-[10px] text-slate-600 uppercase tracking-wider">
                            {group.monthLabel}
                          </td>
                        </tr>
                        {group.items.map((act) => {
                          const dateObj = new Date(act.date);
                          const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                          const formattedTime = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                          return (
                            <tr
                              key={act.id}
                              className="hover:bg-slate-50/80 transition duration-150 cursor-pointer"
                              onClick={() => setSelectedActivity(act)}
                            >
                              <td className="py-3 px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="font-extrabold text-slate-900 block">{formattedDate}</span>
                                <span className="text-[10px] text-slate-500 font-mono font-semibold">{formattedTime}</span>
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                                {(() => {
                                  const isAttendantUser = act.performedBy.toLowerCase().includes('attendant') ||
                                    act.performedBy.toLowerCase().includes('samuel') ||
                                    act.performedBy.toLowerCase().includes('zar') ||
                                    (!act.performedBy.toLowerCase().includes('admin') && !act.performedBy.toLowerCase().includes('system'));
                                  return (
                                    <span className="inline-block py-0.5 px-2.5 text-[9px] font-extrabold rounded-full neumorphic-btn text-slate-900 border border-white/80 select-none">
                                      {isAttendantUser ? 'Attendant' : 'Admin'}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="py-3 px-3 whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9.5px] font-extrabold neumorphic-btn text-slate-900 border border-white/80 select-none">
                                  <span className="text-slate-800">{act.icon}</span>
                                  <span className="uppercase tracking-wide">{act.type}</span>
                                </span>
                              </td>
                              <td className="py-3 px-3 overflow-hidden text-ellipsis">
                                <span className="font-extrabold text-slate-950 block truncate" title={act.title}>
                                  {act.title}
                                </span>
                                <span className="text-[10px] text-slate-500 font-medium block truncate" title={act.notes}>
                                  {act.notes}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-mono font-bold whitespace-nowrap overflow-hidden text-ellipsis">
                                {act.quantity && (
                                  <span className="text-[10px] text-slate-500 font-medium mr-1.5 font-sans">({act.quantity}x)</span>
                                )}
                                <span className="text-slate-900 font-extrabold font-jakarta">
                                  {formatMoney(act.amount)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAIL INSPECTION MODAL */}
      <AnimatePresence>
        {selectedActivity && (
          <div className="z-50 fixed inset-0 flex items-center justify-center p-4">

            {/* Overlay background */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/70"
              onClick={() => setSelectedActivity(null)}
            />

            {/* Modal Body */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="relative w-full max-w-md neumorphic-card bg-[#ebf0f7] dark:bg-[#202225] text-slate-900 dark:text-white rounded-2xl shadow-2xl border border-white/90 dark:border-slate-700/80 overflow-hidden"
            >

              {/* Modal Header */}
              <div className="neumorphic-inset bg-[#ebf0f7]/70 dark:bg-[#202225]/70 px-5 py-4 text-slate-900 dark:text-white flex items-center justify-between select-none border-b border-slate-200/80 dark:border-slate-700/60 rounded-none">
                <div className="flex items-center gap-2">
                  <Shield className="text-sky-600 dark:text-sky-400 animate-pulse" size={16} />
                  <div>
                    <h3 className="font-extrabold text-xs tracking-wide">LOG METADATA AUDITOR</h3>
                    <p className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">Immutable Record ID: {selectedActivity.rawId}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Modal Body Info Block */}
              <div className="p-5 space-y-4">

                {/* Title and Badge */}
                <div className="flex justify-between items-start border-b border-gray-100 pb-3">
                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 leading-snug">{selectedActivity.title}</h4>
                    <span className="text-[10px] text-gray-400 block mt-0.5">
                      Recorded on: {new Date(selectedActivity.date).toLocaleString()}
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-extrabold border uppercase ${selectedActivity.badgeColor}`}>
                    {selectedActivity.icon}
                    <span>{selectedActivity.type}</span>
                  </span>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 p-2.5 rounded-xl">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">PERFORMED BY</span>
                    <strong className="text-slate-800 mt-0.5 block">{selectedActivity.performedBy}</strong>
                  </div>
                  <div className="neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 p-2.5 rounded-xl text-right">
                    <span className="text-[9px] font-bold text-slate-400 block uppercase">ASSOCIATED VALUE</span>
                    <strong className="text-emerald-700 font-mono mt-0.5 block font-bold">{formatMoney(selectedActivity.amount)}</strong>
                  </div>
                </div>

                {/* Meta details if category is Stock */}
                {selectedActivity.category === 'stock' && (
                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Physical Stock metadata</h5>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Item Name:</span>
                        <strong className="text-slate-900">{selectedActivity.meta.itemName}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>SKU Code:</span>
                        <strong className="text-slate-900 font-mono">{selectedActivity.meta.sku}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Quantity Changed:</span>
                        <strong className={selectedActivity.meta.qtyChanged > 0 ? 'text-emerald-600 font-mono' : 'text-slate-900 font-mono'}>
                          {selectedActivity.meta.qtyChanged > 0 ? `+${selectedActivity.meta.qtyChanged}` : selectedActivity.meta.qtyChanged} units
                        </strong>
                      </div>
                      {selectedActivity.meta.creditAccountName && (
                        <div className="flex justify-between text-gray-650">
                          <span>Credited Account:</span>
                          <span className="bg-amber-50 text-amber-800 border border-amber-200/50 px-1 rounded font-semibold text-[10px]">
                            {selectedActivity.meta.creditAccountName}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Meta details if category is Credit */}
                {selectedActivity.category === 'credit' && (
                  <div className="space-y-1.5 border-t border-gray-100 pt-3">
                    <h5 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Financial credit metadata</h5>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between text-gray-600">
                        <span>Account Holder:</span>
                        <strong className="text-slate-900">{selectedActivity.meta.accountName}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Contact Info:</span>
                        <strong className="text-slate-900 font-mono">{selectedActivity.meta.accountPhone}</strong>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Ledger Category:</span>
                        <span className={`px-1 rounded uppercase font-semibold text-[9px] ${selectedActivity.meta.accountType === 'receivable' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                          {selectedActivity.meta.accountType === 'receivable' ? 'Receivable (Customer)' : 'Payable (Supplier)'}
                        </span>
                      </div>
                      <div className="flex justify-between text-gray-600">
                        <span>Payment Channel:</span>
                        <strong className="text-slate-900">{selectedActivity.meta.paymentMethod}</strong>
                      </div>
                    </div>
                  </div>
                )}

                {/* Notes Block */}
                <div className="border-t border-gray-100 pt-3 space-y-1">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Clerk logs notes</span>
                  <div className="neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 border border-white/70 dark:border-slate-700/70 rounded-xl p-3 text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed italic">
                    "{selectedActivity.notes}"
                  </div>
                </div>

                {/* Proof of payment attachment if present */}
                {selectedActivity.category === 'credit' && selectedActivity.meta.transactionProof && (
                  <div className="border-t border-gray-100 pt-3">
                    <span className="text-[9px] font-bold text-gray-400 block uppercase">Audit Proof Attachment</span>
                    <div className="mt-2 border border-gray-250 rounded-xl overflow-hidden shadow-2xs max-h-44 flex items-center justify-center bg-slate-950 relative group">
                      <img
                        src={selectedActivity.meta.transactionProof.dataUrl}
                        alt="Audit Proof Attachment"
                        className="w-full h-full object-contain cursor-pointer max-h-44 hover:opacity-90 transition"
                        referrerPolicy="no-referrer"
                        onClick={() => window.open(selectedActivity.meta.transactionProof.dataUrl, '_blank')}
                      />
                    </div>
                  </div>
                )}

              </div>

              {/* Interactive bottom bar */}
              <div className="neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 px-5 py-3.5 border-t border-slate-200/60 dark:border-slate-700/60 text-right rounded-none">
                <button
                  type="button"
                  onClick={() => setSelectedActivity(null)}
                  className="px-4 py-2 neumorphic-btn bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Acknowledge Clear
                </button>
              </div>

            </motion.div>

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
