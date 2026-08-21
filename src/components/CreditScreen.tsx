import React, { useState, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  Plus,
  Coins,
  CheckCircle2,
  AlertCircle,
  PhoneCall,
  Mail,
  CalendarDays,
  Search,
  MessageSquare,
  History,
  Copy,
  PlusCircle,
  TrendingDown,
  Clock,
  Check,
  Paperclip,
  UploadCloud,
  FileText,
  FileImage,
  Trash2,
  Eye,
  Download,
  X,
  Sparkles,
  RotateCw,
  AlertTriangle,
  Send
} from 'lucide-react';
import { CreditAccount, CreditTransaction, BusinessConfig, StockAdjustment, InventoryItem } from '../types';
import { motion } from 'motion/react';
import MaterialIcon from './MaterialIcon';

interface CreditScreenProps {
  creditAccounts: CreditAccount[];
  transactions: CreditTransaction[];
  config: BusinessConfig;
  inventory: InventoryItem[];
  adjustments: StockAdjustment[];
  onAddAccount: (
    account: Omit<CreditAccount, 'id' | 'remainingAmount' | 'status' | 'lastUpdated'>,
    items?: Array<{ itemId: string; qty: number; unitPrice: number }>
  ) => void | Promise<string | null>;
  onAddTransaction: (
    accountId: string,
    amount: number,
    type: CreditTransaction['type'],
    notes: string,
    paymentMethod?: 'Cash' | 'Mobile Money' | 'Bank',
    transactionProof?: { name: string; dataUrl: string; type: string },
    relatedCreditTxnId?: string
  ) => void | Promise<{ success: boolean; error?: string }>;
  onSettleAccount: (accountId: string) => void;
  initialOpenAddModal?: boolean;
  onClearInitialOpenAddModal?: () => void;
  modalOnly?: boolean;
  userRole?: number;
}

export default function CreditScreen({
  creditAccounts,
  transactions,
  config,
  inventory,
  adjustments,
  onAddAccount,
  onAddTransaction,
  onSettleAccount,
  initialOpenAddModal,
  onClearInitialOpenAddModal,
  modalOnly = false,
  userRole
}: CreditScreenProps) {
  // Navigation tabs for Receivables vs Payables
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable'>('receivable');

  useEffect(() => {
    if (userRole !== 2 && activeTab !== 'receivable') {
      setActiveTab('receivable');
    }
  }, [userRole, activeTab]);

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'settled'>('all');

  // Add Account Modal states
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (initialOpenAddModal) {
      setShowAddModal(true);
      if (onClearInitialOpenAddModal) {
        onClearInitialOpenAddModal();
      }
    }
  }, [initialOpenAddModal, onClearInitialOpenAddModal]);

  const [accType, setAccType] = useState<'receivable' | 'payable'>('receivable');
  const [accName, setAccName] = useState('');
  const [accPhone, setAccPhone] = useState('');
  const [accAmount, setAccAmount] = useState<number | ''>('');
  const [accReceipt, setAccReceipt] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic credited items builder state
  const [creditedItems, setCreditedItems] = useState<Array<{ itemId: string; name: string; qty: number; unitValue: number }>>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [itemQty, setItemQty] = useState<number | ''>('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);

  // Recalculate and lock accAmount based on creditedItems when they are specified
  useEffect(() => {
    if (creditedItems.length > 0) {
      const total = creditedItems.reduce((sum, item) => sum + (item.qty * item.unitValue), 0);
      setAccAmount(total);
    }
  }, [creditedItems]);

  // Clear creditedItems when accType changes or when modal is opened/closed
  useEffect(() => {
    setCreditedItems([]);
    setSelectedItemId('');
    setItemQty('');
    setItemPrice('');
  }, [accType, showAddModal]);

  // Receipt Viewer states
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [receiptAccount, setReceiptAccount] = useState<CreditAccount | null>(null);

  // Transaction Recording Modal states (Repayment or Charge)
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [selectedAccId, setSelectedAccId] = useState<string | null>(null);
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial'>('full');
  const [txnType, setTxnType] = useState<CreditTransaction['type']>('pay');
  const [txnAmount, setTxnAmount] = useState<number | ''>('');
  const [txnNotes, setTxnNotes] = useState('');
  const [txnPaymentMethod, setTxnPaymentMethod] = useState<'Cash' | 'Mobile Money' | 'Bank'>('Cash');
  const [txnProof, setTxnProof] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  const [isTxnDragging, setIsTxnDragging] = useState(false);

  // Reminder Script Modal states
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderAcc, setReminderAcc] = useState<CreditAccount | null>(null);
  const [copiedText, setCopiedText] = useState(false);

  // History Log Modal states
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyAcc, setHistoryAcc] = useState<CreditAccount | null>(null);
  const [modalHistoryTab, setModalHistoryTab] = useState<'activity' | 'goods'>('activity');

  // Transaction Proof Viewer states
  const [showProofModal, setShowProofModal] = useState(false);
  const [activeProof, setActiveProof] = useState<{ name: string; dataUrl: string; type: string; accountName: string } | null>(null);

  const formatMoney = (amount: number) => {
    const safeAmt = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
    return `${config.currencySymbol}${safeAmt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getProfileGoodsLedger = (account: CreditAccount) => {
    // 1. Find matching adjustments
    const matchedAdjs = adjustments.filter(adj => {
      // Must correspond to the correct flow orientation:
      if (account.type === 'receivable' && adj.type !== 'sale_out') return false;
      if (account.type === 'payable' && adj.type !== 'purchase_in') return false;

      // Link by ID directly
      if (adj.creditAccountId === account.id) return true;

      // Fallback: match by name inside notes
      const notesLower = (adj.notes || '').toLowerCase();
      const hasCreditPhrase = notesLower.includes('credit') || notesLower.includes('on credit') || notesLower.includes('repayment') || notesLower.includes('ledger');
      if (hasCreditPhrase) {
        if (notesLower.includes(account.name.toLowerCase())) return true;
        const parts = account.name.toLowerCase().split(' ');
        if (parts.some(p => p.length > 2 && notesLower.includes(p))) return true;
      }
      return false;
    });

    // 2. Sort from oldest to newest to allocate payment correctly (FIFO flow)
    const sortedAdjs = [...matchedAdjs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Total sum paid is: Initial client totalAmount - remaining balance
    let totalPaid = Math.max(0, account.totalAmount - account.remainingAmount);

    return sortedAdjs.map(adj => {
      // Find item in inventory to get unit price and sku
      const item = inventory.find(i => i.id === adj.itemId);
      const originalQuantity = Math.abs(adj.qtyChanged);

      // Calculate unit price: prefer unit price for customer sales, use standard rate if not found
      let unitValue = 0;
      if (account.type === 'receivable') {
        unitValue = item?.unitPrice || 0;
        // Search if price can be extracted from notes (e.g., "$140 each" or similar)
        if (!unitValue && adj.notes) {
          const match = adj.notes.match(/\$?([0-9]+(?:\.[0-9]+)?)/);
          if (match) unitValue = parseFloat(match[1]);
        }
      } else {
        unitValue = item?.unitCost || 0;
      }

      const totalValue = originalQuantity * unitValue;

      // FIFO payment allocation
      const allocatedPaidValue = Math.min(totalValue, totalPaid);
      totalPaid = Math.max(0, totalPaid - allocatedPaidValue);

      // Remaining unpaid balance for this item
      const outstandingValue = Math.max(0, totalValue - allocatedPaidValue);

      // Status
      let itemStatus: 'sold' | 'outstanding' | 'partially_paid' = 'outstanding';
      if (outstandingValue === 0) {
        itemStatus = 'sold'; // fully paid and recorded as sold!
      } else if (allocatedPaidValue > 0) {
        itemStatus = 'partially_paid';
      }

      // Proportional quantities
      const paidQuantity = (allocatedPaidValue / (totalValue || 1)) * originalQuantity;
      const outstandingQuantity = originalQuantity - paidQuantity;

      return {
        id: adj.id,
        itemName: adj.itemName,
        originalQuantity,
        paidQuantity,
        outstandingQuantity,
        unitValue,
        totalValue,
        allocatedPaidValue,
        outstandingValue,
        date: adj.date,
        status: itemStatus,
        sku: item?.sku || 'N/A'
      };
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter accounts
  const filteredAccounts = creditAccounts.filter(acc => {
    if (userRole !== 2 && acc.type === 'payable') return false;
    if (acc.type !== activeTab) return false;

    const matchesSearch = acc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      acc.phone.includes(searchTerm);

    // Status Checks
    const isSettled = acc.status === 'settled';

    let matchesStatus = true;
    if (statusFilter === 'all') {
      matchesStatus = !isSettled;
    } else if (statusFilter === 'settled') {
      matchesStatus = isSettled;
    }

    return matchesSearch && matchesStatus;
  });

  // Calculate high level summaries
  const receivablesOutstanding = creditAccounts
    .filter(a => a.type === 'receivable' && a.status !== 'settled')
    .reduce((acc, a) => acc + a.remainingAmount, 0);

  const payablesOutstanding = creditAccounts
    .filter(a => a.type === 'payable' && a.status !== 'settled')
    .reduce((acc, a) => acc + a.remainingAmount, 0);

  const handleFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setAccReceipt({
        name: file.name,
        dataUrl: e.target?.result as string,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleViewReceipt = (acc: CreditAccount) => {
    setReceiptAccount(acc);
    setShowReceiptModal(true);
  };

  const handleTxnFileChange = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setTxnProof({
        name: file.name,
        dataUrl: e.target?.result as string,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  const handleTxnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTxnDragging(true);
  };

  const handleTxnDragLeave = () => {
    setIsTxnDragging(false);
  };

  const handleTxnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTxnDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleTxnFileChange(e.dataTransfer.files[0]);
    }
  };

  // Handle Create Account Submit
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName || !accPhone || accAmount === '') {
      alert('Please fill in Name, Contact Phone, and Amount.');
      return;
    }

    const safeDueDate = new Date().toISOString().slice(0, 10);
    const createdAccountId = await onAddAccount({
      name: accName.trim(),
      type: userRole === 2 ? accType : 'receivable',
      phone: accPhone.trim(),
      email: '',
      totalAmount: Number(accAmount),
      dueDate: safeDueDate,
      notes: accReceipt ? `Attached receipt: ${accReceipt.name}` : '',
      receipt: accReceipt || undefined
    }, creditedItems.map(x => ({ itemId: x.itemId, qty: x.qty, unitPrice: x.unitValue })));

    if (!createdAccountId) return;

    // Reset Form
    setAccName('');
    setAccPhone('');
    setAccAmount('');
    setAccReceipt(null);
    setCreditedItems([]);
    setSelectedItemId('');
    setItemQty('');
    setItemPrice('');
    setShowAddModal(false);
  };

  // Handle Transaction Submit
  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccId || txnAmount === '') return;

    const account = creditAccounts.find(a => a.id === selectedAccId);
    if (!account) return;

    const amt = Number(txnAmount);

    if (txnType === 'pay' && account.remainingAmount < amt) {
      alert(`Client cannot overpay. Remaining balance is: ${formatMoney(account.remainingAmount)}`);
      return;
    }

    const isSupplier = account.type === 'payable';

    if (txnPaymentMethod === 'Mobile Money' && !txnProof) {
      alert('Please upload a screenshot of the Mobile Money transaction message.');
      return;
    }

    if (isSupplier && txnPaymentMethod === 'Bank' && !txnProof) {
      alert('Please upload a bank payment receipt to complete the transaction.');
      return;
    }

    const finalProof = txnPaymentMethod === 'Cash' ? undefined : txnProof || undefined;

    const result = await onAddTransaction(
      selectedAccId,
      amt,
      txnType,
      txnNotes || 'Manually logged transaction',
      txnPaymentMethod,
      finalProof,
      undefined
    );

    if (result && !result.success) return;

    // Reset Form
    setSelectedAccId(null);
    setPaymentOption('full');
    setTxnAmount('');
    setTxnNotes('');
    setTxnPaymentMethod('Cash');
    setTxnProof(null);
    setShowTxnModal(false);
  };

  // Open transaction logging
  const handleOpenTxn = (accountId: string) => {
    const acc = creditAccounts.find(a => a.id === accountId);
    setSelectedAccId(accountId);
    setPaymentOption('full');
    setTxnType('pay');
    setTxnNotes(acc && acc.type === 'receivable' ? 'Received full repayment.' : 'Paid full supplier balance.');
    setTxnAmount(acc ? acc.remainingAmount : '');
    setTxnPaymentMethod('Cash');
    setTxnProof(null);
    setShowTxnModal(true);
  };

  const generateReminderText = (acc: CreditAccount) => {
    return `Hello ${acc.name},\n\nThis is a friendly reminder from ${config.businessName} regarding your outstanding credit balance of ${formatMoney(acc.remainingAmount)}.\n\nPlease arrange for settlement via ACH or Mobile/Cash at your earliest convenience to maintain an active profile.\n\nThank you for choosing ${config.businessName}!\nContact: ${config.phone || 'us directly'}`;
  };

  const copyReminderToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2000);
  };

  return (
    <>
      <div id="credit-screen" className={modalOnly ? 'hidden' : 'space-y-6'}>
        {/* Header and Summary stats (Crextio & Finnova Aesthetic) */}
        <div className="finnova-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Credit</h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {userRole === 2
                ? "Track client credit payments, invoices due, supplier balances, and settlement diaries."
                : "Track client credit payments, invoices due, and settlement diaries."}
            </p>
          </div>

        </div>

        {/* Credit Summary Board (Finnova KPI Card style) */}
        <div className={`grid grid-cols-1 ${userRole === 2 ? 'md:grid-cols-2' : ''} gap-5`}>
          <div className="finnova-card p-5 sm:p-6 flex items-center justify-between transition duration-300">
            <div>
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Customer Receivables</span>
              <strong className="text-2xl font-extrabold text-slate-900 block mt-1">{formatMoney(receivablesOutstanding)}</strong>
            </div>
            <div className="w-10 h-10 neumorphic-circle text-slate-900 flex items-center justify-center">
              <MaterialIcon name="payments" size={22} />
            </div>
          </div>

          {userRole === 2 && (
            <div className="finnova-card p-5 sm:p-6 flex items-center justify-between transition duration-300">
              <div>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Supplier Payables</span>
                <strong className="text-2xl font-extrabold text-slate-900 block mt-1">{formatMoney(payablesOutstanding)}</strong>
              </div>
              <div className="w-10 h-10 neumorphic-circle text-slate-900 flex items-center justify-center">
                <MaterialIcon name="outbound" size={22} />
              </div>
            </div>
          )}
        </div>

        {/* Navigation tabs & Controls */}
        <div className="finnova-card p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200/40 pb-3">
            {/* Sub Navigation Pill Track */}
            {userRole === 2 && (
              <div className="pill-nav-track inline-flex items-center gap-1 p-1.5 shadow-xs">
                <button
                  onClick={() => { setActiveTab('receivable'); setStatusFilter('all'); }}
                  className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer ${activeTab === 'receivable'
                    ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                    : 'neumorphic-btn text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                >
                  Customer Debtors
                </button>
                <button
                  onClick={() => { setActiveTab('payable'); setStatusFilter('all'); }}
                  className={`text-xs font-bold px-4 py-1.5 rounded-full transition cursor-pointer ${activeTab === 'payable'
                    ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                    : 'neumorphic-btn text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                >
                  Supplier Accounts
                </button>
              </div>
            )}

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2 items-center">
              {(['all', 'settled'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setStatusFilter(f)}
                  className={`text-[11px] px-3.5 py-1.5 rounded-full font-bold transition cursor-pointer select-none ${statusFilter === f
                    ? 'neumorphic-inset text-slate-900 font-extrabold bg-slate-200/50'
                    : 'finnova-card text-slate-600 hover:text-slate-900'
                    }`}
                >
                  {f === 'all' ? 'Active Profiles' : 'Settled (Audit)'}
                </button>
              ))}
            </div>
          </div>

          {/* Search tool block */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-slate-400" size={16} />
            <input
              type="search"
              id="credit-ledger-search-input"
              name="creditLedgerSearchField"
              autoComplete="off"
              placeholder={`Search ${activeTab === 'receivable' ? 'Client' : 'Supplier'} Name or Phone...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs text-slate-900 rounded-full pl-10 pr-4 py-2.5 neumorphic-inset focus:outline-hidden transition font-bold placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Accounts List Container (Desktop Table & Mobile list Cards) */}
        <div className="finnova-card p-0 sm:p-0 overflow-hidden">
          {/* Desktop View Table */}
          <div className="hidden lg:block text-slate-900">
            <table className="w-full text-left border-collapse table-fixed text-xs">
              <thead>
                <tr className="neumorphic-table-header text-[10px] select-none">
                  <th className="py-3 px-3 w-[24%]">Contact Name</th>
                  <th className="py-3 px-3 w-[10%]">Type</th>
                  <th className="py-3 px-3 w-[11%]">Created</th>
                  <th className="py-3 px-3 w-[12%]">Last Payment</th>
                  <th className="py-3 px-3 w-[11%]">Initial</th>
                  <th className="py-3 px-3 w-[12%]">Remaining</th>
                  <th className="py-3 px-3 w-[8%]">Status</th>
                  <th className="py-3 px-3 text-right w-[12%]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/40 text-xs text-gray-700">
                {filteredAccounts.map(acc => {
                  const progressWidth = `${Math.max(0, Math.min(100, (1 - (acc.remainingAmount / (acc.totalAmount || 1))) * 100))}%`;
                  const itemsForAcc = getProfileGoodsLedger(acc);

                  return (
                    <tr key={acc.id} className="hover:bg-white/45 border-b border-slate-100/30 transition duration-150">
                      <td className="py-2.5 px-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-gray-905 text-xs">{acc.name}</span>
                            <span className="font-mono text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded leading-none">
                              CR-{acc.id.replace('credit-', '').slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[10px] items-center mt-1">
                            <span className="flex items-center gap-0.5 text-gray-400"><PhoneCall size={10} /> {acc.phone || 'No phone'}</span>
                            {acc.receipt && (
                              <>
                                <span className="text-gray-300 select-none">•</span>
                                <button
                                  type="button"
                                  onClick={() => handleViewReceipt(acc)}
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer underline decoration-dotted"
                                  title="Click to view/download attached receipt"
                                >
                                  <Paperclip size={10} className="shrink-0 text-indigo-500" /> Receipt File
                                </button>
                              </>
                            )}
                          </div>

                          {/* List of Credited Items inside desktop row */}
                          {itemsForAcc.length > 0 && (
                            <div className="mt-2.5 bg-slate-50/70 p-2 rounded-lg border border-slate-200/40 max-w-[280px]">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{`Credited Products (${itemsForAcc.length}):`}</span>
                              <div className="space-y-1 max-h-[110px] overflow-y-auto pr-1">
                                {itemsForAcc.map(g => (
                                  <div key={g.id} className="flex justify-between items-center text-[10px] gap-2 py-0.5 border-b border-gray-100 last:border-0">
                                    <span className="truncate text-slate-700 font-medium max-w-[150px]" title={g.itemName}>
                                      {g.itemName} <span className="text-slate-400 font-mono text-[9px] font-normal">x{g.originalQuantity}</span>
                                    </span>
                                    <span className={`text-[8.5px] font-bold px-1 rounded-sm ${g.status === 'sold'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                      }`}>
                                      {g.status === 'sold' ? 'Sold' : formatMoney(g.outstandingValue)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${acc.type === 'receivable'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100/50'
                          : 'bg-purple-50 text-purple-700 border border-purple-100/50'
                          }`}>
                          {acc.type === 'receivable' ? 'Customer' : 'Supplier'}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 font-mono text-slate-900 dark:text-white">
                        {acc.dateOfCrediting
                          ? new Date(acc.dateOfCrediting).toLocaleDateString()
                          : (acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleDateString() : 'N/A')}
                      </td>
                      <td className="py-2.5 px-2 font-mono">
                        {acc.paymentDate ? (
                          <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                            {new Date(acc.paymentDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 italic">No payments yet</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-medium text-slate-900 dark:text-white">{formatMoney(acc.totalAmount)}</td>
                      <td className="py-2.5 px-2">
                        <div>
                          <span className={`font-bold font-mono ${acc.remainingAmount === 0 ? 'text-slate-400 line-through' : 'text-slate-900 dark:text-white'}`}>
                            {formatMoney(acc.remainingAmount)}
                          </span>
                          {acc.totalAmount > 0 && acc.remainingAmount > 0 && (
                            <div className="w-24 bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: progressWidth }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className="inline-flex items-center gap-1 text-[9.5px] uppercase font-extrabold px-2.5 py-0.5 rounded-full neumorphic-btn text-slate-900 dark:text-white border border-white/80 dark:border-slate-700 select-none">
                          {acc.status === 'settled' ? <CheckCircle2 size={10} className="text-slate-800 dark:text-slate-200" /> : <Clock size={10} className="text-slate-800 dark:text-slate-200" />}
                          {acc.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {acc.remainingAmount > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenTxn(acc.id)}
                                className="px-2.5 py-1 neumorphic-btn text-slate-900 dark:text-white font-extrabold text-[10px] uppercase rounded-full cursor-pointer transition border border-white/80 dark:border-slate-700 select-none"
                                title="Record repayment installment"
                              >
                                Record Payment
                              </button>
                              {acc.type === 'receivable' && (
                                <button
                                  type="button"
                                  onClick={() => { setReminderAcc(acc); setShowReminderModal(true); }}
                                  className="w-7 h-7 neumorphic-circle text-slate-800 dark:text-slate-200 hover:text-black inline-flex items-center justify-center select-none cursor-pointer"
                                  title="Generate reminder text"
                                >
                                  <MessageSquare size={13} />
                                </button>
                              )}
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => { setHistoryAcc(acc); setShowHistoryModal(true); }}
                            className="w-7 h-7 neumorphic-btn text-slate-800 hover:text-black inline-flex items-center justify-center rounded-lg select-none cursor-pointer transition"
                            title="Statements Ledger History"
                          >
                            <MaterialIcon name="history" size={16} className="text-slate-800" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center">
                      <div className="neumorphic-inset p-8 rounded-2xl flex flex-col items-center justify-center space-y-2">
                        <p className="font-bold text-xs text-slate-600">No matching creditor or debtor journals found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>        {/* Mobile View Card list */}
          <div className="block lg:hidden divide-y divide-slate-200/60 dark:divide-slate-700/60 text-slate-900 dark:text-white p-2 neumorphic-inset bg-[#ebf0f7]/50 dark:bg-[#202225]/50">
            {filteredAccounts.map(acc => {
              const itemsForAcc = getProfileGoodsLedger(acc);

              return (
                <div key={acc.id} className="neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700/80 p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-gray-950 leading-tight">{acc.name}</h4>
                        <span className="font-mono text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded leading-none">
                          CR-{acc.id.replace('credit-', '').slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${acc.type === 'receivable'
                          ? 'bg-blue-50 text-blue-700 border border-blue-100/50'
                          : 'bg-purple-50 text-purple-700 border border-purple-100/50'
                          }`}>
                          {acc.type === 'receivable' ? 'Customer Receivable' : 'Supplier Payable'}
                        </span>
                        {acc.receipt && (
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(acc)}
                            className="inline-flex items-center gap-0.5 text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded cursor-pointer"
                          >
                            <Paperclip size={8} /> Receipt Attached
                          </button>
                        )}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide shrink-0 ${acc.status === 'settled'
                      ? 'bg-emerald-100 text-emerald-850'
                      : 'bg-amber-100 text-amber-800'
                      }`}>
                      {acc.status.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 p-2.5 rounded-xl border border-white/70 dark:border-slate-700/70 text-[10px]">
                    <div>
                      <span className="block text-gray-500 text-[9px] uppercase">Original Ledger</span>
                      <strong className="text-gray-900 text-xs">{formatMoney(acc.totalAmount)}</strong>
                    </div>
                    <div>
                      <span className="block text-gray-500 text-[9px] uppercase">Balance Remaining</span>
                      <strong className={`text-xs block ${acc.remainingAmount === 0 ? 'text-slate-400 line-through' : 'text-red-600 font-extrabold'}`}>
                        {formatMoney(acc.remainingAmount)}
                      </strong>
                    </div>
                    <div>
                      <span className="block text-gray-500 text-[9px] uppercase">Credited Date</span>
                      <span className="font-mono text-gray-800 text-xs block">
                        {acc.dateOfCrediting
                          ? new Date(acc.dateOfCrediting).toLocaleDateString()
                          : (acc.lastUpdated ? new Date(acc.lastUpdated).toLocaleDateString() : 'N/A')}
                      </span>
                    </div>
                    <div>
                      <span className="block text-gray-500 text-[9px] uppercase">Payment Date</span>
                      <span className={`font-mono text-xs block ${acc.paymentDate ? 'text-emerald-700 font-semibold' : 'text-gray-400 italic font-normal'}`}>
                        {acc.paymentDate ? new Date(acc.paymentDate).toLocaleDateString() : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Credited Items */}
                  {itemsForAcc.length > 0 && (
                    <div className="neumorphic-inset bg-[#ebf0f7]/60 dark:bg-[#202225]/60 p-2 rounded-xl border border-white/70 dark:border-slate-700/70 text-[10px] space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block mb-1">{`Credited Products (${itemsForAcc.length}):`}</span>
                      <div className="divide-y divide-gray-100 max-h-[110px] overflow-y-auto pr-1">
                        {itemsForAcc.map(g => (
                          <div key={g.id} className="flex justify-between items-center py-1 gap-2">
                            <span className="truncate text-slate-700 font-medium max-w-[150px]" title={g.itemName}>
                              {g.itemName} <span className="text-gray-400 font-mono text-[9px]">x{g.originalQuantity}</span>
                            </span>
                            <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded-sm border ${g.status === 'sold'
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-100'
                              : 'bg-amber-50 text-amber-800 border-amber-100'
                              }`}>
                              {g.status === 'sold' ? 'Sold' : formatMoney(g.outstandingValue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Mobile action strip with 44px touch sizes */}
                  <div className="flex gap-2">
                    {acc.remainingAmount > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenTxn(acc.id)}
                          className="flex-1 min-h-[44px] neumorphic-btn text-emerald-700 dark:text-emerald-300 rounded-xl flex items-center justify-center gap-1.5 font-bold text-xs hover:text-emerald-800 dark:hover:text-emerald-200 cursor-pointer"
                        >
                          <Coins size={14} /> Record Payment
                        </button>
                        {acc.type === 'receivable' && (
                          <button
                            type="button"
                            onClick={() => { setReminderAcc(acc); setShowReminderModal(true); }}
                            className="w-12 min-h-[44px] neumorphic-btn text-indigo-700 dark:text-indigo-300 rounded-xl flex items-center justify-center hover:text-indigo-900 dark:hover:text-indigo-200 cursor-pointer"
                          >
                            <MessageSquare size={16} />
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="flex-1 flex items-center justify-center min-h-[44px] text-xs text-emerald-700 dark:text-emerald-300 neumorphic-inset font-semibold rounded-xl">
                        Fully Settled Ledger Profile
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { setHistoryAcc(acc); setShowHistoryModal(true); }}
                      className="w-8 h-8 neumorphic-btn text-slate-800 hover:text-black inline-flex items-center justify-center rounded-xl select-none cursor-pointer transition"
                      title="Statements Ledger History"
                    >
                      <MaterialIcon name="history" size={16} className="text-slate-800" />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredAccounts.length === 0 && (
              <div className="py-12 text-center text-gray-400">
                <p className="text-xs">No matching dynamic credit entries.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MODAL: ADD CREDIT ACCOUNT */}
      {showAddModal && (
        <div
          onClick={() => setShowAddModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mobile-credit-modal bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-3xl lg:max-w-4xl max-h-[85vh] sm:max-h-[90vh] flex flex-col min-w-0 min-h-0 overflow-hidden text-xs cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Plus size={16} className="text-sky-600 dark:text-sky-400" /> New Credit Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer flex items-center gap-1 border border-white/80 dark:border-slate-700"
                aria-label="Close"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateAccount} className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden" autoComplete="off">
              <div className="p-4 sm:p-5 lg:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start min-w-0">

                  {/* Left Column: Profile Core Settings */}
                  <div className="space-y-4">
                    <div className="border border-white/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-[#1a2232] p-4 rounded-2xl space-y-3.5 neumorphic-card">
                      <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Account Settings</span>

                      {/* Profile Type Selector */}
                      {userRole === 2 && (
                        <div>
                          <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">Profile Type *</label>
                          <div className="grid grid-cols-2 gap-2 bg-slate-200/60 dark:bg-slate-950 p-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 neumorphic-inset">
                            <button
                              type="button"
                              onClick={() => setAccType('receivable')}
                              className={`py-2 text-center rounded-lg font-extrabold transition cursor-pointer text-xs ${accType === 'receivable'
                                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold'
                                }`}
                            >
                              Customer Receivable
                            </button>
                            <button
                              type="button"
                              onClick={() => setAccType('payable')}
                              className={`py-2 text-center rounded-lg font-extrabold transition cursor-pointer text-xs ${accType === 'payable'
                                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-xs'
                                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold'
                                }`}
                            >
                              Supplier Payable
                            </button>
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">Contact Name *</label>
                        <input
                          type="text"
                          id="profile-contact-name-input"
                          name="profileContactName"
                          autoComplete="off"
                          required
                          placeholder={accType === 'receivable' ? "e.g. David Chen" : "e.g. Apex Bags Ltd."}
                          value={accName}
                          onChange={(e) => setAccName(e.target.value)}
                          className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-semibold"
                        />
                      </div>

                      {/* Mobile Phone (Required) - No Email */}
                      <div>
                        <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">Contact Phone Number *</label>
                        <input
                          type="tel"
                          id="profile-contact-phone-input"
                          name="profileContactPhone"
                          autoComplete="off"
                          required
                          placeholder="e.g. +1 (555) 000-0000"
                          value={accPhone}
                          onChange={(e) => setAccPhone(e.target.value)}
                          className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-semibold"
                        />
                      </div>
                    </div>

                    {/* Initial Debt */}
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        {creditedItems.length > 0 ? 'Total Account Amount (Autocalculated) *' : 'Initial Outstanding Debt *'}
                      </label>
                      <input
                        type="number"
                        id="profile-outstanding-amount-input"
                        name="profileOutstandingAmount"
                        autoComplete="off"
                        min="0"
                        step="0.01"
                        required
                        readOnly={creditedItems.length > 0}
                        placeholder="e.g. 500.00"
                        value={accAmount}
                        onChange={(e) => setAccAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className={`w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-semibold ${creditedItems.length > 0 ? 'bg-indigo-50/50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 font-extrabold text-indigo-950 dark:text-indigo-300 scale-[1.01]' : ''
                          }`}
                      />
                      {creditedItems.length > 0 && (
                        <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold mt-1">
                          ✓ Price locked from {creditedItems.length} product list {creditedItems.length === 1 ? 'item' : 'items'} above.
                        </p>
                      )}
                    </div>

                    {/* Receipt File Upload */}
                    <div>
                      <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">
                        Upload Receipt Document (PDF/Image) * <span className="text-rose-500 font-bold">(Compulsory)</span>
                      </label>

                      {!accReceipt ? (
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`border-2 border-dashed rounded-2xl p-4 text-center transition neumorphic-inset ${isDragging
                            ? 'border-sky-500 bg-sky-50/50 dark:bg-sky-950/40'
                            : 'border-slate-300/80 dark:border-slate-800 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-700 dark:text-slate-300'
                            }`}
                        >
                          <label className="flex flex-col items-center justify-center cursor-pointer select-none">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleFileChange(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                            <UploadCloud size={20} className={`mb-1 ${isDragging ? 'text-sky-600 dark:text-sky-400 font-extrabold' : 'text-slate-400'}`} />
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">Drag & drop receipt, or <span className="text-sky-600 dark:text-sky-400 underline">browse</span></span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 block">Supports PDF, JPEG, PNG</span>
                          </label>
                        </div>
                      ) : (
                        <div className="border rounded-xl bg-indigo-50/50 dark:bg-indigo-950/40 p-2.5 flex items-center justify-between gap-3 border-indigo-200 dark:border-indigo-800 neumorphic-inset">
                          <div className="flex items-center gap-2 min-w-0">
                            {accReceipt.type.startsWith('image/') ? (
                              <div className="w-8 h-8 rounded border overflow-hidden shrink-0 bg-white dark:bg-slate-900 shadow-3xs flex items-center justify-center">
                                <img src={accReceipt.dataUrl} className="w-full h-full object-cover" alt="thumbnail" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded shrink-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500 shadow-3xs">
                                <FileText size={14} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={accReceipt.name}>
                                {accReceipt.name}
                              </p>
                              <p className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-mono">
                                {accReceipt.type.split('/')[1] || 'Document'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAccReceipt(null)}
                            className="p-1 px-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg text-rose-500 hover:text-rose-700 transition cursor-pointer select-none shrink-0"
                            title="Remove uploaded receipt"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Interactive Credited Goods Builder */}
                  <div className="space-y-4">
                    {/* INTERACTIVE CREDITED PRODUCTS BUILDER */}
                    <div className="bg-[#ebf0f7] dark:bg-[#1a2232] p-4 border border-white/80 dark:border-slate-800 rounded-2xl space-y-3.5 neumorphic-card">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Add Credited Goods / Products</span>
                        {creditedItems.length > 0 && (
                          <span className="text-[9px] font-semibold text-indigo-750 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-150 dark:border-indigo-800 rounded px-1.5 py-0.5">
                            {creditedItems.length} {creditedItems.length === 1 ? 'Product' : 'Products'} Added
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Custom 3D Neumorphic Product Selector */}
                        <div className="relative">
                          <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Select Product Item</label>
                          <div
                            onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                            className="w-full text-xs font-extrabold text-slate-900 dark:text-white rounded-xl border border-white/80 dark:border-slate-800 p-2.5 neumorphic-inset bg-[#ebf0f7] dark:bg-slate-950/80 flex items-center justify-between cursor-pointer min-h-[42px] select-none"
                          >
                            <span className="truncate pr-2">
                              {selectedItemId
                                ? (() => {
                                  const item = inventory.find(i => i.id === selectedItemId);
                                  return item ? `${item.name} (SKU: ${item.sku.substring(0, 6)}) [${item.quantity} in stock]` : 'Choose Product';
                                })()
                                : 'Choose Product'}
                            </span>
                            <MaterialIcon name="expand_more" size={18} className={`text-slate-700 dark:text-slate-300 transition-transform shrink-0 ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>

                          {isProductDropdownOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsProductDropdownOpen(false)}
                              />
                              <div className="absolute left-0 top-full mt-1.5 w-full bg-[#ebf0f7] dark:bg-[#1e2738] border border-white/90 dark:border-slate-700 rounded-2xl p-1.5 shadow-2xl neumorphic-card max-h-56 overflow-y-auto space-y-1 z-50">
                                <div
                                  onClick={() => {
                                    setSelectedItemId('');
                                    setItemQty('');
                                    setItemPrice('');
                                    setIsProductDropdownOpen(false);
                                  }}
                                  className="px-3 py-2 rounded-xl text-xs font-extrabold text-slate-500 dark:text-slate-400 hover:bg-slate-200/80 dark:hover:bg-slate-800 cursor-pointer"
                                >
                                  Clear Selection
                                </div>
                                {inventory.map(item => (
                                  <div
                                    key={item.id}
                                    onClick={() => {
                                      setSelectedItemId(item.id);
                                      setItemQty(1);
                                      setItemPrice(accType === 'receivable' ? item.unitPrice : item.unitCost);
                                      setIsProductDropdownOpen(false);
                                    }}
                                    className={`px-3 py-2 rounded-xl text-xs font-extrabold cursor-pointer transition flex items-center justify-between ${selectedItemId === item.id ? 'bg-slate-300/80 dark:bg-slate-700 text-slate-950 dark:text-white font-black' : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/90 dark:hover:bg-slate-800'
                                      }`}
                                  >
                                    <span className="truncate pr-2">{item.name}</span>
                                    <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">({item.quantity} in stock)</span>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider">Quantity</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              placeholder="Qty"
                              value={itemQty}
                              onChange={(e) => setItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full text-xs font-extrabold text-slate-900 dark:text-white rounded-xl border border-white/80 dark:border-slate-800 p-2.5 neumorphic-inset bg-[#ebf0f7] dark:bg-slate-950/80 focus:outline-hidden min-h-[42px]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-300 mb-1.5 uppercase tracking-wider truncate" title={`${accType === 'receivable' ? 'Sale Price' : 'Supply Cost'} (${config.currencySymbol})`}>
                              {accType === 'receivable' ? 'Sale Price' : 'Supply Cost'} ({config.currencySymbol})
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Value"
                              value={itemPrice}
                              onChange={(e) => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full text-xs font-extrabold text-slate-900 dark:text-white rounded-xl border border-white/80 dark:border-slate-800 p-2.5 neumorphic-inset bg-[#ebf0f7] dark:bg-slate-950/80 focus:outline-hidden font-mono min-h-[42px]"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!selectedItemId || itemQty === '' || itemPrice === '') {
                              alert('Please select a product, a valid quantity and custom price/cost rate.');
                              return;
                            }
                            const item = inventory.find(i => i.id === selectedItemId);
                            if (!item) return;

                            // Check if quantity is available in stock for customer receivables
                            if (accType === 'receivable' && item.quantity < Number(itemQty)) {
                              const confirmProceed = window.confirm(`Warning: Only ${item.quantity} units are physically in stock. Do you want to approve this over-credit sale anyway?`);
                              if (!confirmProceed) return;
                            }

                            // Check if already in list
                            const qtyVal = Number(itemQty);
                            const priceVal = Number(itemPrice);

                            setCreditedItems(prev => {
                              const existingIdx = prev.findIndex(x => x.itemId === selectedItemId);
                              if (existingIdx > -1) {
                                // Update
                                const next = [...prev];
                                next[existingIdx] = {
                                  ...next[existingIdx],
                                  qty: next[existingIdx].qty + qtyVal,
                                  unitValue: priceVal // use latest typed price
                                };
                                return next;
                              } else {
                                // Append
                                return [...prev, {
                                  itemId: selectedItemId,
                                  name: item.name,
                                  qty: qtyVal,
                                  unitValue: priceVal
                                }];
                              }
                            });

                            // Reset inputs
                            setSelectedItemId('');
                            setItemQty('');
                            setItemPrice('');
                          }}
                          className="neumorphic-btn text-slate-900 dark:text-white border border-white/90 dark:border-slate-700 font-extrabold px-4 py-2 rounded-xl text-xs transition cursor-pointer hover:text-black dark:hover:text-white flex items-center gap-1.5 select-none"
                        >
                          <MaterialIcon name="add" size={16} className="text-slate-800 dark:text-slate-200" />
                          <span>Add Product Line</span>
                        </button>
                      </div>

                      {/* List of Current Selected Items */}
                      {creditedItems.length > 0 ? (
                        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-[#ebf0f7] dark:bg-slate-950/80 max-h-[160px] overflow-y-auto neumorphic-inset">
                          <table className="w-full text-left text-[10px] border-collapse">
                            <thead className="bg-slate-200/60 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold sticky top-0">
                              <tr>
                                <th className="py-1.5 px-2">Product Name</th>
                                <th className="py-1.5 px-2">Qty</th>
                                <th className="py-1.5 px-2">Rate</th>
                                <th className="py-1.5 px-2 text-right">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                              {creditedItems.map((ci) => (
                                <tr key={ci.itemId} className="hover:bg-slate-200/40 dark:hover:bg-slate-900/40 text-slate-900 dark:text-white font-medium">
                                  <td className="py-1.5 px-2 font-semibold">{ci.name}</td>
                                  <td className="py-1.5 px-2 font-mono font-bold">{ci.qty}</td>
                                  <td className="py-1.5 px-2 font-mono">{config.currencySymbol}{ci.unitValue.toFixed(2)}</td>
                                  <td className="py-1.5 px-2 text-right">
                                    <button
                                      type="button"
                                      onClick={() => setCreditedItems(prev => prev.filter(x => x.itemId !== ci.itemId))}
                                      className="text-rose-600 dark:text-rose-400 hover:underline font-bold"
                                    >
                                      Remove
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="border border-dashed border-slate-300 dark:border-slate-800 py-5 text-center text-slate-500 dark:text-slate-400 bg-[#ebf0f7] dark:bg-slate-950/60 rounded-xl font-medium text-[10px] neumorphic-inset">
                          No credited products added yet. Add items to autocalculate and track inventory deductions.
                        </div>
                      )}
                    </div>
                  </div>

                </div>

              </div>

              {/* Buttons */}
              <div className="p-4 bg-slate-100/90 dark:bg-[#0f172a] border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-5 py-2.5 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
                >
                  Dismiss
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold rounded-xl neumorphic-btn shadow-md transition-all text-xs cursor-pointer border border-white/30 dark:border-slate-700/60 active:scale-[0.98]"
                >
                  Create Profile
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: EXTRINSIC TRANSACTION RECORDING */}
      {showTxnModal && (
        <div
          onClick={() => setShowTxnModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mobile-payment-modal bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col min-w-0 overflow-hidden text-xs cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Coins size={15} className="text-sky-600 dark:text-sky-400" /> Record Payment
              </h3>
              <button
                type="button"
                onClick={() => setShowTxnModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer flex items-center gap-1 border border-white/80 dark:border-slate-700"
                aria-label="Close"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Form */}
            {(() => {
              const currentAcc = creditAccounts.find(a => a.id === selectedAccId);
              const isSupplierForTxn = currentAcc?.type === 'payable';
              const isUploadCompulsory =
                txnPaymentMethod === 'Mobile Money' ||
                (txnPaymentMethod === 'Bank' && isSupplierForTxn);
              const isUploadMissing = isUploadCompulsory && !txnProof;
              const isSubmitDisabled = txnAmount === '' || isUploadMissing;

              return (
                <form onSubmit={handleRecordTransaction} className="p-4 sm:p-6 space-y-4 overflow-y-auto min-w-0">
                  <div>
                    <span className="block text-slate-600 dark:text-slate-300 font-bold mb-1">Target Account:</span>
                    <strong className="neumorphic-inset text-slate-900 dark:text-white block text-sm p-2.5 border border-white/80 dark:border-slate-700 rounded-xl">
                      {currentAcc?.name}
                    </strong>
                  </div>

                  {/* Payment Type Selection: Full or Partial */}
                  <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Payment Option *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentOption('full');
                          if (currentAcc) {
                            setTxnAmount(currentAcc.remainingAmount);
                          }
                          setTxnNotes(currentAcc && currentAcc.type === 'receivable' ? 'Received full repayment.' : 'Paid full supplier balance.');
                        }}
                          className={`neumorphic-btn w-full py-2 px-1 rounded-xl border text-center font-semibold transition cursor-pointer text-xs ${paymentOption === 'full'
                          ? 'neumorphic-inset text-slate-900 dark:text-white font-bold'
                          : 'text-slate-700 dark:text-slate-200'
                          }`}
                      >
                        Full Payment
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentOption('partial');
                          setTxnNotes(currentAcc && currentAcc.type === 'receivable' ? 'Received partial repayment.' : 'Paid partial supplier balance.');
                        }}
                          className={`neumorphic-btn w-full py-2 px-1 rounded-xl border text-center font-semibold transition cursor-pointer text-xs ${paymentOption === 'partial'
                          ? 'neumorphic-inset text-slate-900 dark:text-white font-bold'
                          : 'text-slate-700 dark:text-slate-200'
                          }`}
                      >
                        Partial Payment
                      </button>
                    </div>
                  </div>

                  {/* Amount */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-semibold text-slate-700 dark:text-slate-200">Transaction Value ({config.currencySymbol}) *</label>
                      {paymentOption === 'full' && currentAcc && (
                        <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold">Locked to full outstanding balance</span>
                      )}
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      placeholder="e.g. 100.00"
                      value={txnAmount}
                      disabled={paymentOption === 'full'}
                      onChange={(e) => setTxnAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className={`w-full rounded-lg border p-2.5 font-mono text-sm font-semibold ${paymentOption === 'full'
                        ? 'neumorphic-inset text-slate-500 dark:text-slate-400 cursor-not-allowed border-white/70 dark:border-slate-700'
                        : 'neumorphic-inset text-slate-900 dark:text-white border-white/80 dark:border-slate-700 focus:outline-hidden focus:ring-1 focus:ring-sky-500'
                        }`}
                    />
                  </div>

                  {/* Payment Method Selector */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Payment Method *</label>
                    <div className="neumorphic-inset grid grid-cols-3 gap-1.5 p-1 rounded-xl">
                      {(['Cash', 'Mobile Money', 'Bank'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setTxnPaymentMethod(method)}
                          className={`neumorphic-btn py-1.5 text-center rounded-lg font-semibold transition cursor-pointer text-[10px] ${txnPaymentMethod === method
                            ? 'neumorphic-inset text-slate-900 dark:text-white font-bold'
                            : 'text-slate-600 dark:text-slate-300'
                            }`}
                        >
                          {method}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Receipt / Screenshot Attachment Upload (Only for Mobile Money & Bank) */}
                  {txnPaymentMethod !== 'Cash' && (
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1 text-[11px] leading-snug">
                        {txnPaymentMethod === 'Mobile Money'
                          ? 'Upload Message Screenshot * (Compulsory)'
                          : isSupplierForTxn
                            ? 'Upload Bank Receipt * (Compulsory)'
                            : 'Upload Bank Receipt (Optional)'}
                      </label>

                      {!txnProof ? (
                        <div
                          onDragOver={handleTxnDragOver}
                          onDragLeave={handleTxnDragLeave}
                          onDrop={handleTxnDrop}
                          className={`border-2 border-dashed rounded-lg p-4 text-center transition ${isTxnDragging
                            ? 'border-indigo-500 bg-indigo-50/50'
                            : 'neumorphic-inset border-white/80 dark:border-slate-700 bg-[#ebf0f7]/60 dark:bg-[#0f172a]/60'
                            }`}
                        >
                          <label className="flex flex-col items-center justify-center cursor-pointer select-none">
                            <input
                              type="file"
                              accept="image/*,application/pdf"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleTxnFileChange(e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                            <UploadCloud size={20} className={`mb-1 ${isTxnDragging ? 'text-indigo-600 font-extrabold' : 'text-slate-400'}`} />
                            <span className="text-[10px] font-bold text-gray-700 block">
                              {txnPaymentMethod === 'Mobile Money' ? 'Drag screenshot here, or browse' : 'Drag receipt here, or browse'}
                            </span>
                            <span className="text-[9px] text-gray-400 block mt-0.5">
                              {txnPaymentMethod === 'Mobile Money' ? 'Supports screenshots' : 'Supports images and PDF documents'}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <div className="neumorphic-card border rounded-xl p-2.5 flex items-center justify-between gap-2 border-white/80 dark:border-slate-700">
                          <div className="flex items-center gap-2 min-w-0">
                            {txnProof.type.startsWith('image/') ? (
                              <div className="w-8 h-8 rounded border overflow-hidden shrink-0 bg-white shadow-3xs flex items-center justify-center">
                                <img src={txnProof.dataUrl} className="w-full h-full object-cover" alt="txn thumbnail" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded shrink-0 bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-3xs">
                                <FileText size={14} />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-gray-800 truncate" title={txnProof.name}>
                                {txnProof.name}
                              </p>
                              <p className="text-[8px] text-gray-500 uppercase font-mono">
                                {txnProof.type.split('/')[1] || 'Document'}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTxnProof(null)}
                            className="neumorphic-circle-danger p-1 px-1.5 rounded-lg text-rose-500 hover:text-rose-700 transition cursor-pointer select-none shrink-0"
                            title="Remove uploaded file"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Memo */}
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Reference Memo / Serial</label>
                    <input
                      type="text"
                      placeholder="e.g. Transaction ID, operator notes, reference number."
                      value={txnNotes}
                      onChange={(e) => setTxnNotes(e.target.value)}
                      className="neumorphic-inset w-full rounded-xl border border-white/80 dark:border-slate-700 p-2.5 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="pt-4 border-t border-white/70 dark:border-slate-700 flex flex-wrap justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setShowTxnModal(false)}
                      className="neumorphic-btn text-slate-900 rounded-full px-4.5 py-2 text-xs font-extrabold hover:text-black transition cursor-pointer"
                    >
                      Dismiss
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitDisabled}
                      className={`neumorphic-btn px-5 py-2.5 font-semibold rounded-xl text-xs transition ${isSubmitDisabled
                        ? 'neumorphic-inset text-slate-500 dark:text-slate-400 cursor-not-allowed border border-white/60 dark:border-slate-700'
                        : 'text-slate-900 dark:text-white hover:scale-[1.01] cursor-pointer font-bold'
                        }`}
                      title={isSubmitDisabled ? 'Please complete all required fields and upload proof' : 'Confirm Logs'}
                    >
                      Confirm Logs
                    </button>
                  </div>
                </form>
              );
            })()}
          </motion.div>
        </div>
      )}

      {/* MODAL: STATEMENT STATEMENT HISTORY LOGS */}
      {showHistoryModal && historyAcc && (
        <div
          onClick={() => setShowHistoryModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh] cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <MaterialIcon name="history" size={18} className="text-sky-600 dark:text-sky-400" />
                <span>Statement Ledger: {historyAcc.name}</span>
                <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-white font-extrabold px-2 py-0.5 rounded-full ml-1">CR-{historyAcc.id.replace('credit-', '').slice(-6).toUpperCase()}</span>
              </h3>
              <button
                type="button"
                onClick={() => { setShowHistoryModal(false); setHistoryAcc(null); }}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer flex items-center gap-1 border border-white/80 dark:border-slate-700"
                aria-label="Close"
              >
                <X size={15} />
                <span>Close</span>
              </button>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 p-3 rounded-xl grid grid-cols-2 gap-y-3 gap-x-2 text-[11px] text-slate-900 dark:text-white">
                <div>
                  <span className="text-gray-500 block">Credit Record Identifier:</span>
                  <strong className="text-slate-800 dark:text-white text-xs font-mono font-bold">CR-{historyAcc.id.replace('credit-', '').slice(-6).toUpperCase()}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Credit Allocated:</span>
                  <strong className="text-slate-900 dark:text-white text-sm font-mono">{formatMoney(historyAcc.totalAmount)}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Current Outstanding Balance:</span>
                  <strong className="text-slate-800 dark:text-white text-sm font-semibold font-mono">{formatMoney(historyAcc.remainingAmount)}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Date of Crediting:</span>
                  <strong className="text-slate-900 dark:text-white font-mono text-[11px]">
                    {historyAcc.dateOfCrediting
                      ? new Date(historyAcc.dateOfCrediting).toLocaleDateString()
                      : (historyAcc.lastUpdated ? new Date(historyAcc.lastUpdated).toLocaleDateString() : 'N/A')}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Payment Date:</span>
                  <strong className={`font-mono text-[11px] ${historyAcc.paymentDate ? 'text-slate-800 dark:text-white' : 'text-gray-400 italic font-normal'}`}>
                    {historyAcc.paymentDate ? new Date(historyAcc.paymentDate).toLocaleDateString() : 'No payments yet'}
                  </strong>
                </div>
              </div>

              {/* Modal Tabs */}
              <div className="flex neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-1 rounded-xl border border-white/80 dark:border-slate-700 mb-4 font-semibold text-[11px]">
                <button
                  type="button"
                  onClick={() => setModalHistoryTab('activity')}
                  className={`flex-1 text-center py-1.5 rounded transition cursor-pointer ${modalHistoryTab === 'activity' ? 'neumorphic-btn bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white shadow-2xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {`Activity Ledger (${transactions.filter(t => t.creditAccountId === historyAcc.id).length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setModalHistoryTab('goods')}
                  className={`flex-1 text-center py-1.5 rounded transition cursor-pointer ${modalHistoryTab === 'goods' ? 'neumorphic-btn bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white shadow-2xs font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {`Credited Goods & Deductions (${getProfileGoodsLedger(historyAcc).length})`}
                </button>
              </div>

              {modalHistoryTab === 'activity' && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">Recorded Activity Ledger:</h4>
                  <div className="divide-y divide-gray-100 pr-1">
                    {transactions.filter(t => t.creditAccountId === historyAcc.id).map(txn => (
                      <div key={txn.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-gray-800 capitalize">{txn.type === 'pay' ? 'Installment Repayment' : 'Credit Granted / Charge'}</span>
                            {txn.paymentMethod && (
                              <span className="neumorphic-inset text-slate-800 dark:text-white text-[9px] font-bold px-1.5 py-0.5 rounded-sm border border-slate-300 dark:border-slate-700">
                                {txn.paymentMethod}
                              </span>
                            )}
                            {txn.transactionProof && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveProof({
                                    name: txn.transactionProof!.name,
                                    dataUrl: txn.transactionProof!.dataUrl,
                                    type: txn.transactionProof!.type,
                                    accountName: historyAcc.name
                                  });
                                  setShowProofModal(true);
                                }}
                                className="text-[9px] font-bold text-slate-800 dark:text-white hover:text-slate-950 dark:hover:text-slate-200 underline flex items-center gap-0.5 cursor-pointer ml-1"
                              >
                                <Paperclip size={8} /> Receipt Proof
                              </button>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {txn.notes} • {new Date(txn.date).toLocaleString()}
                            {txn.type === 'pay' && txn.relatedCreditTxnId && (
                              <span className="block text-slate-800 dark:text-white font-bold mt-0.5">
                                Directed to Credit ID: {txn.relatedCreditTxnId.replace('txn-', '')}
                              </span>
                            )}
                            {(txn.type === 'charge' || txn.type === 'borrow') && (
                              <span className={`block font-bold mt-0.5 text-slate-800 dark:text-white`}>
                                Unpaid Record Balance: {formatMoney(txn.remainingAmount !== undefined ? txn.remainingAmount : txn.amount)}
                              </span>
                            )}
                            {txn.type === 'pay' && txn.remainingAmount !== undefined && (
                              <span className={`block font-bold mt-0.5 text-slate-800 dark:text-white`}>
                                Balance Left After Payment: {formatMoney(txn.remainingAmount)}
                              </span>
                            )}
                          </p>
                        </div>
                        <strong className={`font-mono font-bold text-xs shrink-0 text-slate-800 dark:text-white`}>
                          {txn.type === 'pay' ? '-' : '+'}{formatMoney(txn.amount)}
                        </strong>
                      </div>
                    ))}
                    {transactions.filter(t => t.creditAccountId === historyAcc.id).length === 0 && (
                      <p className="py-8 text-center text-gray-400 text-xs">No entries reported on this profile.</p>
                    )}
                  </div>
                </div>
              )}

              {modalHistoryTab === 'goods' && (
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="neumorphic-table-header text-[10px] select-none">
                          <th className="py-2 px-3">Product Item</th>
                          <th className="py-2 px-3">Credited Qty</th>
                          <th className="py-2 px-3">Total Value</th>
                          <th className="py-2 px-3">Outstanding Unpaid</th>
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {getProfileGoodsLedger(historyAcc).map((g) => (
                          <tr key={g.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3">
                              <div>
                                <span className="font-semibold text-slate-900 block">{g.itemName}</span>
                                <span className="text-[9.5px] text-slate-400 font-mono">SKU: {g.sku}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-mono">
                              {g.originalQuantity} {g.originalQuantity === 1 ? 'unit' : 'units'}
                            </td>
                            <td className="py-3 px-3 font-mono font-medium text-slate-800">
                              {formatMoney(g.totalValue)}
                            </td>
                            <td className="py-3 px-3">
                              {g.outstandingQuantity > 0 ? (
                                <div>
                                  <span className="text-slate-800 dark:text-white font-bold font-mono">
                                    {formatMoney(g.outstandingValue)}
                                  </span>
                                  <span className="text-[9px] text-slate-400 block font-mono">
                                    ({g.outstandingQuantity.toFixed(1)} qty unpaid)
                                  </span>
                                </div>
                              ) : (
                                <span className="text-slate-800 dark:text-white line-through font-mono font-medium">
                                  {formatMoney(0)}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              {g.status === 'sold' ? (
                                <span className="neumorphic-inset text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-full font-extrabold uppercase text-[9px] px-2 py-0.5 inline-block whitespace-nowrap">
                                  ✓ Sold & Fully Paid
                                </span>
                              ) : g.status === 'partially_paid' ? (
                                <span className="neumorphic-inset text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-full font-bold uppercase text-[9px] px-2 py-0.5 inline-block whitespace-nowrap">
                                  Part-Deducted
                                </span>
                              ) : (
                                <span className="neumorphic-inset text-slate-800 dark:text-white border border-slate-300 dark:border-slate-700 rounded-full font-bold uppercase text-[9px] px-2 py-0.5 inline-block whitespace-nowrap">
                                  Outstanding
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {getProfileGoodsLedger(historyAcc).length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No specific goods transactions matched under this profile.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t text-right">
              <button
                onClick={() => { setShowHistoryModal(false); setHistoryAcc(null); }}
                className="px-4 py-2 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                Ok, Got it
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: DISPATCH REMINDER FORM SIMULATION */}
      {showReminderModal && reminderAcc && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="mobile-reminder-modal neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700/80 shadow-2xl w-full max-w-md max-h-[calc(100dvh-2rem)] flex flex-col min-w-0 overflow-hidden text-slate-900 dark:text-white text-xs"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <MessageSquare size={16} /> Automated Client Payment Reminder
              </h3>
              <button
                type="button"
                onClick={() => { setShowReminderModal(false); setReminderAcc(null); }}
                className="neumorphic-btn text-slate-900 rounded-full px-3 py-1 text-xs font-extrabold hover:text-black transition cursor-pointer flex items-center gap-1"
                aria-label="Close"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto min-w-0">
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                Generate and copy a professional reminder notice to text David or send right to Sarah via WhatsApp or cellular networks:
              </p>

              <div className="neumorphic-inset border border-white/70 dark:border-slate-700/70 p-4.5 rounded-xl space-y-2 font-mono whitespace-pre-wrap text-[11px] text-slate-700 dark:text-slate-200 select-all leading-relaxed relative">
                {generateReminderText(reminderAcc)}
              </div>

              <div className="neumorphic-inset text-slate-700 dark:text-slate-200 p-3 rounded-xl text-[10px] leading-snug border border-white/80 dark:border-slate-700">
                <strong>Tip for Merchants:</strong> Just copy this text and paste it into messages or mail clients.
              </div>

              {/* Action */}
              <div className="flex flex-wrap justify-end gap-2 pt-3 border-t border-white/70 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => { setShowReminderModal(false); setReminderAcc(null); }}
                  className="neumorphic-btn text-slate-900 rounded-full px-4.5 py-2 text-xs font-extrabold hover:text-black transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => copyReminderToClipboard(generateReminderText(reminderAcc))}
                  className="neumorphic-btn text-slate-900 dark:text-white px-5 py-2.5 font-semibold rounded-xl flex items-center gap-1 cursor-pointer transition hover:scale-[1.01]"
                >
                  {copiedText ? (
                    <><Check size={14} /> Copied!</>
                  ) : (
                    <><Copy size={14} /> Copy to Clipboard</>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: VIEW ATTACHED RECEIPT */}
      {showReceiptModal && receiptAccount && receiptAccount.receipt && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700/80 shadow-2xl w-full max-w-xl overflow-hidden text-slate-900 dark:text-white flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Paperclip size={16} className="text-indigo-400" /> Attached Receipt Verification
              </h3>
              <button
                type="button"
                onClick={() => { setShowReceiptModal(false); setReceiptAccount(null); }}
                className="neumorphic-btn text-slate-900 rounded-full px-3 py-1 text-xs font-extrabold hover:text-black transition cursor-pointer flex items-center gap-1"
                aria-label="Close"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="neumorphic-inset border border-white/70 dark:border-slate-700/70 p-3.5 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-gray-400 text-[10px] block font-semibold uppercase">Profile Holder:</span>
                  <strong className="text-gray-900 text-sm block truncate max-w-[280px]">{receiptAccount.name}</strong>
                  <span className="text-gray-500 text-[10px] block mt-0.5 font-mono truncate max-w-[400px]">{receiptAccount.receipt.name} ({receiptAccount.receipt.type})</span>
                </div>
                <a
                  href={receiptAccount.receipt.dataUrl}
                  download={receiptAccount.receipt.name}
                  className="bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition shrink-0 select-none"
                >
                  <Download size={14} /> Download File
                </a>
              </div>

              <div className="border rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[50vh]">
                {receiptAccount.receipt.type.startsWith('image/') ? (
                  <img
                    src={receiptAccount.receipt.dataUrl}
                    alt="Receipt source representation"
                    className="max-w-full max-h-[48vh] object-contain shadow-xs bg-white"
                  />
                ) : receiptAccount.receipt.type === 'application/pdf' ? (
                  <iframe
                    src={receiptAccount.receipt.dataUrl}
                    className="w-full h-[48vh] border-0"
                    title="Receipt PDF Source Document"
                  />
                ) : (
                  <div className="p-12 text-center text-gray-500 space-y-3">
                    <FileText size={48} className="mx-auto text-slate-400" />
                    <p className="font-semibold text-gray-750">Preview is unavailable for this format.</p>
                    <p className="text-[10px] text-gray-400">Please download the file using the button above to view records locally.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60 text-right neumorphic-inset rounded-none">
              <button
                onClick={() => { setShowReceiptModal(false); setReceiptAccount(null); }}
                className="px-4.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer text-xs"
              >
                Close Records View
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: VIEW TRANSACTION PROOF SCREENSHOT */}
      {showProofModal && activeProof && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700/80 shadow-2xl w-full max-w-xl overflow-hidden text-slate-900 dark:text-white flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-semibold text-sm flex items-center gap-1.5">
                <Paperclip size={16} className="text-indigo-400" /> Payment Transaction Verification Proof
              </h3>
              <button
                type="button"
                onClick={() => { setShowProofModal(false); setActiveProof(null); }}
                className="neumorphic-btn text-slate-900 rounded-full px-3 py-1 text-xs font-extrabold hover:text-black transition cursor-pointer flex items-center gap-1"
                aria-label="Close"
              >
                <X size={14} />
                <span>Close</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
              <div className="neumorphic-inset border border-white/70 dark:border-slate-700/70 p-3.5 rounded-xl flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-gray-400 text-[10px] block font-semibold uppercase">Profile Link:</span>
                  <strong className="text-gray-900 text-sm block truncate max-w-[280px]">{activeProof.accountName}</strong>
                  <span className="text-gray-500 text-[10px] block mt-0.5 font-mono truncate max-w-[400px]">{activeProof.name} ({activeProof.type})</span>
                </div>
                <a
                  href={activeProof.dataUrl}
                  download={activeProof.name}
                  className="bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 text-white font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition shrink-0 select-none"
                >
                  <Download size={14} /> Download Image/File
                </a>
              </div>

              <div className="border rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center min-h-[300px] max-h-[50vh]">
                {activeProof.type.startsWith('image/') ? (
                  <img
                    src={activeProof.dataUrl}
                    alt="Transaction level proof illustration"
                    className="max-w-full max-h-[48vh] object-contain shadow-xs bg-white"
                  />
                ) : activeProof.type === 'application/pdf' ? (
                  <iframe
                    src={activeProof.dataUrl}
                    className="w-full h-[48vh] border-0"
                    title="Transaction Proof documents"
                  />
                ) : (
                  <div className="p-12 text-center text-gray-500 space-y-3">
                    <FileText size={48} className="mx-auto text-slate-400" />
                    <p className="font-semibold text-gray-750">Preview is unavailable for this format.</p>
                    <p className="text-[10px] text-gray-400">Please download the file using the button above to view locally.</p>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-slate-200/60 dark:border-slate-700/60 text-right neumorphic-inset rounded-none">
              <button
                onClick={() => { setShowProofModal(false); setActiveProof(null); }}
                className="px-4.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg cursor-pointer text-xs"
              >
                Close Records View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
