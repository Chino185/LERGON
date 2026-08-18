import React, { useState, useMemo, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  ArrowUpRight,
  ArrowDownRight,
  Search,
  CalendarDays,
  TrendingUp,
  Coins,
  Boxes,
  Filter,
  X,
  FileDown,
  ArrowLeftRight,
  ClipboardList,
  PlusCircle,
  ShoppingBag,
  History,
  TrendingDown,
  UserPlus,
  Receipt,
  Wallet,
  UploadCloud,
  FileText,
  Flag,
  CheckCircle,
  Edit3,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StockAdjustment, CreditTransaction, InventoryItem, CreditAccount, BusinessConfig } from '../types';
import MaterialIcon from './MaterialIcon';
import NeumorphicSelect, { NeumorphicSelectOption } from './NeumorphicSelect';
import { downloadCSV, formatCSVDateTime, formatCSVCurrency, formatCSVNumber } from '../utils/csvExporter';

interface TransactionsScreenProps {
  adjustments: StockAdjustment[];
  transactions: CreditTransaction[];
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  config: BusinessConfig;
  onLogAdjustment?: (itemId: string, qtyChanged: number, type: StockAdjustment['type'], notes: string) => void;
  onAddTransaction?: (
    accountId: string,
    amount: number,
    type: CreditTransaction['type'],
    notes: string,
    paymentMethod?: 'Cash' | 'Mobile Money' | 'Bank',
    transactionProof?: { name: string; dataUrl: string; type: string },
    relatedCreditTxnId?: string
  ) => void;
  onAddAccount?: (newAccData: Omit<CreditAccount, 'id' | 'remainingAmount' | 'status' | 'lastUpdated'>) => void;
  onFlagAdjustment?: (id: string, comment: string) => void;
  onCorrectAdjustmentQty?: (id: string, correctedQty: number, correctionNotes: string) => void;
  onFlagTransaction?: (id: string, comment: string) => void;
  onCorrectTransactionAmount?: (id: string, correctedAmount: number, correctionNotes: string) => void;
  userRole?: number;
}

type TabType = 'inventory' | 'sale_credit' | 'credit' | 'payable';

export default function TransactionsScreen({
  adjustments,
  transactions,
  inventory,
  creditAccounts,
  config,
  onLogAdjustment,
  onAddTransaction,
  onAddAccount,
  onFlagAdjustment,
  onCorrectAdjustmentQty,
  onFlagTransaction,
  onCorrectTransactionAmount,
  userRole
}: TransactionsScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('inventory');

  useEffect(() => {
    if (userRole !== 2 && activeTab === 'payable') {
      setActiveTab('inventory');
    }
  }, [userRole, activeTab]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');

  const typeOptions: NeumorphicSelectOption[] = useMemo(() => {
    if (activeTab === 'inventory') {
      return [
        { value: 'all', label: 'Any Ledger Action Type' },
        { value: 'purchase_in', label: 'Paid Stock-Up Purchase (+)' },
        { value: 'sale_out', label: 'Paid Customer Sales (-)' },
        { value: 'credited', label: 'Credited Stock / Products (±)' },
        { value: 'damaged', label: 'Damaged Stock Losses (-)' },
        { value: 'returned', label: 'Customer Returns (+)' },
        { value: 'audit_adjustment', label: 'Audit Reconciliation (±)' },
      ];
    }
    if (activeTab === 'sale_credit') {
      return [
        { value: 'all', label: 'All Sale & Credit Types' },
        { value: 'sale_out', label: 'Paid Sales Only' },
        { value: 'sold_on_credit', label: 'On-Credit Sales Only' },
      ];
    }
    if (activeTab === 'credit') {
      return [{ value: 'all', label: 'Repayments Received Only' }];
    }
    return [{ value: 'all', label: 'Payments Made Only' }];
  }, [activeTab]);

  const paymentOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: 'all', label: 'Any Payment Method' },
    { value: 'Cash', label: 'Cash Only' },
    { value: 'Mobile Money', label: 'Mobile Money Only' },
    { value: 'Bank', label: 'Bank Transfer Only' },
  ], []);

  const dateOptions: NeumorphicSelectOption[] = useMemo(() => [
    { value: 'all', label: 'All Dates Range' },
    { value: 'today', label: "Today's Cycle Only" },
    { value: '7days', label: 'Last 7 Days Activity' },
    { value: '30days', label: 'Last 30 Days Records' },
  ], []);

  // States for Recording Repayment from Transactions screen
  const [showRecModal, setShowRecModal] = useState(false);
  const [recModalType, setRecModalType] = useState<'receivable' | 'payable'>('receivable');
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [paymentOption, setPaymentOption] = useState<'full' | 'partial'>('full');
  const [txnAmount, setTxnAmount] = useState<number | ''>('');
  const [txnNotes, setTxnNotes] = useState('');
  const [txnPaymentMethod, setTxnPaymentMethod] = useState<'Cash' | 'Mobile Money' | 'Bank'>('Cash');
  const [txnProof, setTxnProof] = useState<{ name: string; dataUrl: string; type: string } | null>(null);
  const [isTxnDragging, setIsTxnDragging] = useState(false);

  // States for Transaction Correction & Flagging
  const [flaggingAdjId, setFlaggingAdjId] = useState<string | null>(null);
  const [flagComment, setFlagComment] = useState('');
  const [correctingAdjId, setCorrectingAdjId] = useState<string | null>(null);
  const [correctedQty, setCorrectedQty] = useState<number | ''>('');
  const [correctionNotes, setCorrectionNotes] = useState('');

  // States for CreditTransaction Correction & Flagging
  const [flaggingTxId, setFlaggingTxId] = useState<string | null>(null);
  const [txFlagComment, setTxFlagComment] = useState('');
  const [correctingTxId, setCorrectingTxId] = useState<string | null>(null);
  const [correctedTxAmount, setCorrectedTxAmount] = useState<number | ''>('');
  const [txCorrectionNotes, setTxCorrectionNotes] = useState('');

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

  const handleTxnDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTxnDragging(false);
  };

  const handleTxnDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsTxnDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleTxnFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleRecordTransaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccId || txnAmount === '') return;

    const account = creditAccounts.find(a => a.id === selectedAccId);
    if (!account) return;

    const amt = typeof txnAmount === 'number' ? txnAmount : parseFloat(txnAmount);
    if (isNaN(amt) || amt <= 0) {
      alert('Please specify a valid payment transaction value.');
      return;
    }

    if (account.remainingAmount < amt) {
      if (recModalType === 'receivable') {
        alert(`Client cannot overpay. Remaining balance is: ${formatMoney(account.remainingAmount)}`);
      } else {
        alert(`We cannot overpay supplier. Outstanding debt is: ${formatMoney(account.remainingAmount)}`);
      }
      return;
    }

    if (txnPaymentMethod === 'Mobile Money' && !txnProof) {
      alert('Please upload a screenshot of the Mobile Money transaction message.');
      return;
    }

    const finalProof = txnPaymentMethod === 'Cash' ? undefined : txnProof || undefined;

    if (onAddTransaction) {
      onAddTransaction(
        selectedAccId,
        amt,
        'pay',
        txnNotes || (recModalType === 'receivable' ? 'Repayment logged from Transactions hub' : 'Supplier payment logged from Transactions hub'),
        txnPaymentMethod,
        finalProof,
        undefined
      );
    }

    // Reset settings
    setSelectedAccId('');
    setPaymentOption('full');
    setTxnAmount('');
    setTxnNotes('');
    setTxnPaymentMethod('Cash');
    setTxnProof(null);
    setShowRecModal(false);
  };

  // Compute transaction counts for badges
  const saleCreditTxnsCount = useMemo(() => {
    return adjustments.filter(adj => {
      const isSoldOnCredit = !!(adj.notes && adj.notes.toLowerCase().includes('sold on credit'));
      const isSale = adj.type === 'sale_out';
      return isSale || isSoldOnCredit;
    }).length;
  }, [adjustments]);

  const receivableTxnsCount = useMemo(() => {
    return transactions.filter(tx => {
      const acc = creditAccounts.find(a => a.id === tx.creditAccountId);
      return (!acc || acc.type === 'receivable') && tx.type === 'pay';
    }).length;
  }, [transactions, creditAccounts]);

  const payableTxnsCount = useMemo(() => {
    if (userRole !== 2) return 0;
    return transactions.filter(tx => {
      const acc = creditAccounts.find(a => a.id === tx.creditAccountId);
      return acc && acc.type === 'payable' && tx.type === 'pay';
    }).length;
  }, [transactions, creditAccounts, userRole]);



  const { formatAmount, convertFromBase, convertToBase } = useCurrency();

  // Format Helper: Money
  const formatMoney = (amount: number) => {
    return formatAmount(amount);
  };

  // Helper: Get pure Date string
  const getTxDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toISOString().split('T')[0];
    } catch {
      return dateStr.split('T')[0] || dateStr;
    }
  };

  // Helper: Get pure Time string
  const getTxTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      }) + ' UTC';
    } catch {
      return '00:00:00 UTC';
    }
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

  // Helper to calculate outstanding balance left to pay AFTER a specific transaction was recorded
  const getBalanceAfterTx = (tx: CreditTransaction) => {
    const accTxns = transactions
      .filter(t => t.creditAccountId === tx.creditAccountId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = 0;
    for (const t of accTxns) {
      if (t.type === 'charge' || t.type === 'borrow') {
        runningBalance += t.amount;
      } else if (t.type === 'pay') {
        runningBalance = Math.max(0, runningBalance - t.amount);
      }
      if (t.id === tx.id) {
        return runningBalance;
      }
    }
    return 0;
  };

  // Quick reset filters when tabs change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchQuery('');
    setTypeFilter('all');
    setDateRangeFilter('all');
    setPaymentMethodFilter('all');
  };

  const submitFlag = () => {
    if (!flaggingAdjId || !flagComment.trim()) return;
    if (onFlagAdjustment) {
      onFlagAdjustment(flaggingAdjId, flagComment);
    }
    setFlaggingAdjId(null);
    setFlagComment('');
  };

  const submitCorrection = () => {
    if (!correctingAdjId || correctedQty === '') return;
    if (onCorrectAdjustmentQty) {
      onCorrectAdjustmentQty(correctingAdjId, Number(correctedQty), correctionNotes);
    }
    setCorrectingAdjId(null);
    setCorrectedQty('');
    setCorrectionNotes('');
  };

  const submitTxFlag = () => {
    if (!flaggingTxId || !txFlagComment.trim()) return;
    if (onFlagTransaction) {
      onFlagTransaction(flaggingTxId, txFlagComment);
    }
    setFlaggingTxId(null);
    setTxFlagComment('');
  };

  const submitTxCorrection = () => {
    if (!correctingTxId || correctedTxAmount === '') return;
    if (onCorrectTransactionAmount) {
      onCorrectTransactionAmount(correctingTxId, Number(correctedTxAmount), txCorrectionNotes);
    }
    setCorrectingTxId(null);
    setCorrectedTxAmount('');
    setTxCorrectionNotes('');
  };

  // Filter Adjustments (Inventory Transactions)
  const filteredAdjustments = useMemo(() => {
    return adjustments.filter(adj => {
      // 1. Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        adj.itemName.toLowerCase().includes(searchLower) ||
        (adj.notes || '').toLowerCase().includes(searchLower) ||
        adj.itemId.toLowerCase().includes(searchLower);

      // 2. Type Filter
      let matchesType = false;
      if (typeFilter === 'all') {
        matchesType = true;
      } else if (typeFilter === 'credited') {
        matchesType = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
      } else {
        const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
        if (isCredited) {
          matchesType = false; // Credited items are not standard sold or purchased until they are paid for
        } else {
          matchesType = adj.type === typeFilter;
        }
      }

      // 3. Date Filter
      let matchesDate = true;
      if (dateRangeFilter !== 'all') {
        const adjDate = new Date(adj.date);
        const now = new Date();
        const diffMs = now.getTime() - adjDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRangeFilter === 'today') {
          matchesDate = diffDays <= 1;
        } else if (dateRangeFilter === '7days') {
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === '30days') {
          matchesDate = diffDays <= 30;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [adjustments, searchQuery, typeFilter, dateRangeFilter]);

  // Filter Sale and Credit movements from Inventory Adjustments
  const filteredSaleCreditAdjustments = useMemo(() => {
    return adjustments.filter(adj => {
      const isSoldOnCredit = !!(adj.notes && adj.notes.toLowerCase().includes('sold on credit'));
      const isSale = adj.type === 'sale_out';

      // Filter tab inclusions
      if (!isSale && !isSoldOnCredit) {
        return false;
      }

      // 1. Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        adj.itemName.toLowerCase().includes(searchLower) ||
        (adj.notes || '').toLowerCase().includes(searchLower) ||
        adj.itemId.toLowerCase().includes(searchLower);

      // 2. Type Filter inside this specific view (sale_out vs. credit)
      let matchesType = true;
      if (typeFilter !== 'all') {
        if (typeFilter === 'sale_out') {
          matchesType = isSale && !isSoldOnCredit;
        } else if (typeFilter === 'sold_on_credit') {
          matchesType = isSoldOnCredit;
        }
      }

      // 3. Date Filter
      let matchesDate = true;
      if (dateRangeFilter !== 'all') {
        const adjDate = new Date(adj.date);
        const now = new Date();
        const diffMs = now.getTime() - adjDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRangeFilter === 'today') {
          matchesDate = diffDays <= 1;
        } else if (dateRangeFilter === '7days') {
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === '30days') {
          matchesDate = diffDays <= 30;
        }
      }

      return matchesSearch && matchesType && matchesDate;
    });
  }, [adjustments, searchQuery, typeFilter, dateRangeFilter]);

  const getLinkedAccount = (adj: StockAdjustment) => {
    if (adj.creditAccountId) {
      return creditAccounts.find(c => c.id === adj.creditAccountId);
    }
    const notesLower = (adj.notes || '').toLowerCase();
    const isCreditPhrase = notesLower.includes('credit') || notesLower.includes('sold on credit') || notesLower.includes('billed on terms') || notesLower.includes('repayment');
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

  const getCreditAccountPaidRatio = (account: CreditAccount | null | undefined) => {
    if (!account) return 0;
    if (account.totalAmount <= 0) return 1;
    const ratio = (account.totalAmount - account.remainingAmount) / account.totalAmount;
    return Math.max(0, Math.min(1, ratio));
  };

  // Compute calculated financials for Sale and Credit movements
  const totalFinancials = useMemo(() => {
    let salesValue = 0;
    let creditValue = 0;

    filteredSaleCreditAdjustments.forEach(adj => {
      const item = inventory.find(i => i.id === adj.itemId);
      const price = adj.unitPriceSnapshot ?? (item ? item.unitPrice : 0);
      const val = Math.abs(adj.qtyChanged) * price;

      const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
      if (isCredited) {
        const account = getLinkedAccount(adj);
        const paidRatio = getCreditAccountPaidRatio(account);
        const paidPortion = val * paidRatio;
        const unpaidPortion = val * (1 - paidRatio);
        salesValue += paidPortion;
        creditValue += unpaidPortion;
      } else {
        salesValue += val;
      }
    });

    return {
      salesValue,
      creditValue,
      totalValue: salesValue + creditValue
    };
  }, [filteredSaleCreditAdjustments, inventory, creditAccounts]);

  // Filter Credits (Financial Credit Transactions - Receivables)
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Filter out supplier/payable accounts
      const acc = creditAccounts.find(a => a.id === tx.creditAccountId);
      if (acc && acc.type === 'payable') {
        return false;
      }

      // Record/List only repayments (payments towards credited items)
      if (tx.type !== 'pay') {
        return false;
      }

      // 1. Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        tx.accountName.toLowerCase().includes(searchLower) ||
        (tx.notes || '').toLowerCase().includes(searchLower);

      // 2. Type Filter
      const matchesType = typeFilter === 'all' || tx.type === typeFilter;

      // 3. Date Filter
      let matchesDate = true;
      if (dateRangeFilter !== 'all') {
        const txDate = new Date(tx.date);
        const now = new Date();
        const diffMs = now.getTime() - txDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRangeFilter === 'today') {
          matchesDate = diffDays <= 1;
        } else if (dateRangeFilter === '7days') {
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === '30days') {
          matchesDate = diffDays <= 30;
        }
      }

      // 4. Payment Method Filter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || tx.paymentMethod === paymentMethodFilter;

      return matchesSearch && matchesType && matchesDate && matchesPaymentMethod;
    });
  }, [transactions, creditAccounts, searchQuery, typeFilter, dateRangeFilter, paymentMethodFilter]);

  // Filter Supplier Payables (Financial Credit Transactions - Payables)
  const filteredPayableTransactions = useMemo(() => {
    if (userRole !== 2) {
      return [];
    }
    return transactions.filter(tx => {
      // Must be a supplier payable transaction
      const acc = creditAccounts.find(a => a.id === tx.creditAccountId);
      if (!acc || acc.type !== 'payable') {
        return false;
      }

      // Record/List only payments made of supplier bills/debts
      if (tx.type !== 'pay') {
        return false;
      }

      // 1. Text Search
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch =
        tx.accountName.toLowerCase().includes(searchLower) ||
        (tx.notes || '').toLowerCase().includes(searchLower);

      // 2. Type Filter
      const matchesType = typeFilter === 'all' || tx.type === typeFilter;

      // 3. Date Filter
      let matchesDate = true;
      if (dateRangeFilter !== 'all') {
        const txDate = new Date(tx.date);
        const now = new Date();
        const diffMs = now.getTime() - txDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (dateRangeFilter === 'today') {
          matchesDate = diffDays <= 1;
        } else if (dateRangeFilter === '7days') {
          matchesDate = diffDays <= 7;
        } else if (dateRangeFilter === '30days') {
          matchesDate = diffDays <= 30;
        }
      }

      // 4. Payment Method Filter
      const matchesPaymentMethod = paymentMethodFilter === 'all' || tx.paymentMethod === paymentMethodFilter;

      return matchesSearch && matchesType && matchesDate && matchesPaymentMethod;
    });
  }, [transactions, creditAccounts, searchQuery, typeFilter, dateRangeFilter, paymentMethodFilter, userRole]);

  // Download simple CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = '';

    if (activeTab === 'inventory') {
      headers = ['ID', 'Item Name', 'Qty Changed', 'Movement Type', 'Date Logged', 'Operator Comments'];
      rows = filteredAdjustments.map(adj => {
        const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
        return [
          adj.id,
          adj.itemName,
          formatCSVNumber(adj.qtyChanged),
          isCredited ? 'CREDITED' : adj.type.replace('_', ' ').toUpperCase(),
          formatCSVDateTime(adj.date),
          adj.notes || ''
        ];
      });
      filename = 'inventory-movements';
    } else if (activeTab === 'sale_credit') {
      headers = ['ID', 'Item Name', 'Movement Type', 'Qty Changed', 'Unit Price', 'Total Value', 'Date Logged', 'Operator Comments'];
      rows = filteredSaleCreditAdjustments.map(adj => {
        const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
        const item = inventory.find(i => i.id === adj.itemId);
        const price = adj.unitPriceSnapshot ?? (item ? item.unitPrice : 0);
        const val = Math.abs(adj.qtyChanged) * price;
        return [
          adj.id,
          adj.itemName,
          isCredited ? 'CREDITED' : 'SALE',
          formatCSVNumber(Math.abs(adj.qtyChanged)),
          formatCSVCurrency(price, config.currencySymbol),
          formatCSVCurrency(val, config.currencySymbol),
          formatCSVDateTime(adj.date),
          adj.notes || ''
        ];
      });
      filename = 'sales-and-credits-ledger';
    } else if (activeTab === 'credit') {
      headers = ['ID', 'Credit Account', 'Transaction Type', 'Amount Status', 'Payment Method', 'Date Logged', 'Operator Comments'];
      rows = filteredTransactions.map(tx => [
        tx.id,
        tx.accountName,
        tx.type.toUpperCase(),
        formatCSVCurrency(tx.amount, config.currencySymbol),
        tx.paymentMethod || 'N/A',
        formatCSVDateTime(tx.date),
        tx.notes || ''
      ]);
      filename = 'credit-transactions-journal';
    } else {
      headers = ['ID', 'Supplier Account', 'Transaction Type', 'Amount Status', 'Payment Method', 'Date Logged', 'Operator Comments'];
      rows = filteredPayableTransactions.map(tx => [
        tx.id,
        tx.accountName,
        tx.type.toUpperCase(),
        formatCSVCurrency(tx.amount, config.currencySymbol),
        tx.paymentMethod || 'N/A',
        formatCSVDateTime(tx.date),
        tx.notes || ''
      ]);
      filename = 'supplier-payable-transactions';
    }

    downloadCSV({
      filename: `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`,
      headers,
      rows
    });
  };

  return (
    <div id="transactions-screen" className="space-y-6">
      {/* Top Title Bar (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
            <MaterialIcon name="history" size={24} className="text-slate-900" />
            <span>Store Ledger & Transactions Logs</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            View detailed movement histories, direct customer payments, and track specific physical items given out on credit terms.
          </p>
        </div>
      </div>

      {/* Primary Switch Screen Headers & Pill Track */}
      <div className="finnova-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div id="transactions-nav-tabs" className="pill-nav-track inline-flex flex-wrap items-center gap-1.5 p-1.5">
          <button
            id="tab-inventory-ctrl"
            type="button"
            onClick={() => handleTabChange('inventory')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === 'inventory'
                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="inventory_2" size={16} />
            <span>Inventory Log</span>
          </button>

          <button
            id="tab-sales-credits"
            type="button"
            onClick={() => handleTabChange('sale_credit')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === 'sale_credit'
                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="receipt_long" size={16} />
            <span>Sales & Credit Journal</span>
          </button>

          <button
            id="tab-credit-ctrl"
            type="button"
            onClick={() => handleTabChange('credit')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === 'credit'
                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
          >
            <MaterialIcon name="payments" size={16} />
            <span>Debtor Repayments</span>
          </button>

          {userRole === 2 && (
            <button
              id="tab-payables-ctrl"
              type="button"
              onClick={() => handleTabChange('payable')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${activeTab === 'payable'
                  ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <MaterialIcon name="description" size={16} />
              <span>Supplier Payables</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">



          {/* Dynamic CSV Downloader */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 hover:opacity-95 rounded-lg transition cursor-pointer shadow-xs"
          >
            <FileDown size={14} className="text-white shrink-0" />
            <span className="text-white font-extrabold">
              Export {
                activeTab === 'inventory'
                  ? 'Inventory Log'
                  : activeTab === 'sale_credit'
                    ? 'Sales & Credits Log'
                    : activeTab === 'credit'
                      ? 'Credit Repayment Ledger'
                      : 'Supplier Payable Ledger'
              } XLSX
            </span>
          </button>
        </div>
      </div>

      {/* Filters Area Card container */}
      <div id="general-search-filter-card" className="finnova-card p-4 sm:p-5 space-y-4">
        <div className={`grid grid-cols-1 gap-3 ${(activeTab === 'inventory' || activeTab === 'sale_credit') ? 'md:grid-cols-4' : 'md:grid-cols-5'}`}>
          {/* Text input search */}
          <div className="relative md:col-span-2">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder={
                activeTab === 'inventory'
                  ? "Search movements by item name, comments, or SKU..."
                  : activeTab === 'sale_credit'
                    ? "Search sales and credits by brand, item name, or comments..."
                    : activeTab === 'credit'
                      ? "Search credit transactions by client profile, notes..."
                      : "Search supplier payable transactions by supplier, notes..."
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '44px' }}
              className="w-full pr-8 py-2.5 text-xs text-slate-900 rounded-full neumorphic-inset focus:outline-hidden transition placeholder:text-slate-400 font-extrabold"
            />
          </div>

          {/* Filtering by Operational Type */}
          <NeumorphicSelect
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions}
            icon={<MaterialIcon name="filter_alt" size={16} className="text-slate-800" />}
            className="w-full"
          />

          {/* New Payment Method Filter selector */}
          {activeTab !== 'inventory' && activeTab !== 'sale_credit' && (
            <NeumorphicSelect
              value={paymentMethodFilter}
              onChange={setPaymentMethodFilter}
              options={paymentOptions}
              icon={<Wallet size={14} />}
              className="w-full"
            />
          )}

          {/* Filtering by Date Ranges */}
          <NeumorphicSelect
            value={dateRangeFilter}
            onChange={setDateRangeFilter}
            options={dateOptions}
            icon={<CalendarDays size={14} />}
            className="w-full"
          />
        </div>

        {/* Clear filters label helper */}
        {(searchQuery || typeFilter !== 'all' || dateRangeFilter !== 'all' || paymentMethodFilter !== 'all') && (
          <div className="flex items-center justify-between border-t border-gray-50 pt-3">
            <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">
              Selected Criteria Match:{' '}
              {activeTab === 'inventory'
                ? filteredAdjustments.length
                : activeTab === 'sale_credit'
                  ? filteredSaleCreditAdjustments.length
                  : activeTab === 'credit'
                    ? filteredTransactions.length
                    : filteredPayableTransactions.length
              } entries
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
                setDateRangeFilter('all');
                setPaymentMethodFilter('all');
              }}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-805 transition cursor-pointer"
            >
              Clear Search Settings
            </button>
          </div>
        )}
      </div>

      {/* Main List content cards */}
      <AnimatePresence mode="wait">
        {activeTab === 'inventory' ? (
          <motion.div
            key="inventory-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="finnova-card p-0 sm:p-0 overflow-hidden"
          >
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed text-xs">
                <thead>
                  <tr className="neumorphic-table-header text-[10px] select-none">
                    <th className="px-3.5 py-3 w-[18%]">Transaction ID</th>
                    <th className="px-3.5 py-3 w-[16%]">Date & Time</th>
                    <th className="px-3.5 py-3 w-[32%]">Inventory Product Item</th>
                    <th className="px-3.5 py-3 text-center w-[18%]">Transaction Type</th>
                    <th className="px-3.5 py-3 text-center w-[10%]">Quantity</th>
                    <th className="px-3.5 py-3 text-center w-[6%]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredAdjustments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center">
                        <div className="neumorphic-inset p-8 rounded-2xl flex flex-col items-center justify-center space-y-2">
                          <ClipboardList className="text-slate-400" size={32} />
                          <p className="text-sm font-bold text-slate-800">No stock adjustment entries found.</p>
                          <p className="text-[10px] text-slate-500 font-medium">Try modifying your search or filters to preview historic items.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupItemsByMonth<StockAdjustment>(filteredAdjustments).map((group) => (
                      <React.Fragment key={group.monthLabel}>
                        <tr className="bg-slate-100/60 dark:bg-slate-900/60 border-y border-slate-200/50 dark:border-slate-800/80 select-none">
                          <td colSpan={6} className="px-4 py-2 font-extrabold text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {group.monthLabel}
                          </td>
                        </tr>
                        {group.items.map((adj) => {
                          let badgeClass = '';
                          let qtyPrefix = '';
                          let textClass = '';
                          const qtyVal = adj.qtyChanged;

                          const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
                          const account = isCredited ? getLinkedAccount(adj) : null;
                          const paidRatio = isCredited ? getCreditAccountPaidRatio(account) : 0;

                          const isInitialStock = adj.type === 'initial_stock'
                            || (adj.type === 'purchase_in' && (adj.notes || '').toLowerCase().includes('initial stock'));
                          let badgeText = isInitialStock
                            ? 'NEW ITEM'
                            : adj.type === 'sale_out'
                              ? 'SOLD'
                              : adj.type.replace('_', ' ');
                          if (isCredited) {
                            if (paidRatio === 1) {
                              badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                              qtyPrefix = qtyVal > 0 ? '+' : '';
                              textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                              badgeText = 'CREDITED (FULLY PAID)';
                            } else if (paidRatio > 0) {
                              badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                              qtyPrefix = qtyVal > 0 ? '+' : '';
                              textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                              badgeText = `CREDITED (${Math.round(paidRatio * 100)}% PAID)`;
                            } else {
                              badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                              qtyPrefix = qtyVal > 0 ? '+' : '';
                              textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                              badgeText = 'CREDITED (UNPAID)';
                            }
                          } else if (adj.type === 'purchase_in') {
                            badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                            qtyPrefix = '+';
                            textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                          } else if (adj.type === 'sale_out') {
                            badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                            qtyPrefix = '';
                            textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                          } else if (adj.type === 'damaged') {
                            badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                            qtyPrefix = '';
                            textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                          } else if (adj.type === 'returned') {
                            badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                            qtyPrefix = '+';
                            textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                          } else {
                            badgeClass = 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold border border-slate-200 dark:border-slate-700';
                            qtyPrefix = qtyVal > 0 ? '+' : '';
                            textClass = 'text-slate-900 dark:text-white font-bold font-mono';
                          }

                          return (
                            <tr key={adj.id} className={`hover:bg-white/45 dark:hover:bg-slate-800/40 border-b border-slate-200/40 dark:border-slate-800/60 transition duration-150 ${adj.isFlagged ? 'bg-amber-50/15 dark:bg-amber-950/20' : ''}`}>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold">
                                {adj.id}
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[10px] leading-tight">
                                <div>{getTxDate(adj.date)}</div>
                                <div className="text-slate-400 dark:text-slate-500 text-[9px] mt-0.5">{getTxTime(adj.date)}</div>
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                <div className="flex flex-col items-center justify-center text-center">
                                  <p className="font-bold text-gray-900 dark:text-white text-[11px] leading-snug">{adj.itemName}</p>
                                  <p className="text-[9px] text-gray-400 dark:text-slate-400">ID: {adj.itemId}</p>
                                  {adj.isFlagged && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase neumorphic-inset text-slate-900 dark:text-white border border-white/80 dark:border-slate-800">
                                      <Flag size={8} className="text-slate-800 dark:text-slate-200" /> Flagged Correction
                                    </span>
                                  )}
                                  {adj.isResolved && !adj.isFlagged && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase neumorphic-inset text-slate-900 dark:text-white border border-white/80 dark:border-slate-800">
                                      <CheckCircle size={8} className="text-slate-800 dark:text-slate-200" /> Corrected & Resolved
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className="inline-block px-2.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase tracking-wider neumorphic-btn text-slate-900 dark:text-white border border-white/80 dark:border-slate-700 select-none">
                                  {badgeText}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                                <span className={`${textClass} font-mono text-xs font-extrabold text-slate-900 dark:text-white`}>
                                  {qtyPrefix}{qtyVal}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {adj.isFlagged ? (
                                  userRole === 2 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCorrectingAdjId(adj.id);
                                        setCorrectedQty(adj.qtyChanged);
                                        setCorrectionNotes('');
                                      }}
                                      className="inline-flex items-center gap-1 neumorphic-btn text-slate-900 dark:text-white font-extrabold text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-full border border-white/80 dark:border-slate-700 transition cursor-pointer select-none"
                                    >
                                      <Edit3 size={10} /> Correct Qty
                                    </button>
                                  ) : (
                                    <span className="text-[9.5px] text-amber-600 dark:text-amber-400 font-semibold italic flex items-center justify-center gap-1"><Flag size={10} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFlaggingAdjId(adj.id);
                                      setFlagComment('');
                                    }}
                                    className="w-7 h-7 neumorphic-circle text-slate-800 dark:text-slate-200 hover:text-red-600 dark:hover:text-red-400 inline-flex items-center justify-center transition cursor-pointer select-none"
                                    title="Flag Mistake"
                                  >
                                    <MaterialIcon name="flag" size={15} className="text-slate-800 dark:text-slate-200" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View list Card style */}
            <div className="block lg:hidden text-slate-800 space-y-4">
              {filteredAdjustments.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <ClipboardList className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="font-medium text-xs">No stock adjustment entries found.</p>
                </div>
              ) : (
                groupItemsByMonth<StockAdjustment>(filteredAdjustments).map((group) => (
                  <div key={group.monthLabel} className="space-y-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-100/60 border-b border-slate-150 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      {group.monthLabel}
                    </div>
                    <div className="divide-y divide-slate-150/70">
                      {group.items.map((adj) => {
                        let badgeClass = '';
                        let qtyPrefix = '';
                        let textClass = '';
                        const qtyVal = adj.qtyChanged;

                        const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
                        const account = isCredited ? getLinkedAccount(adj) : null;
                        const paidRatio = isCredited ? getCreditAccountPaidRatio(account) : 0;

                        let badgeText = adj.type === 'sale_out' ? 'SOLD' : adj.type.replace('_', ' ');
                        if (isCredited) {
                          if (paidRatio === 1) {
                            badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                            qtyPrefix = qtyVal > 0 ? '+' : '';
                            textClass = 'text-slate-900 font-bold font-mono';
                            badgeText = 'CREDITED (FULLY PAID)';
                          } else if (paidRatio > 0) {
                            badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                            qtyPrefix = qtyVal > 0 ? '+' : '';
                            textClass = 'text-slate-900 font-bold font-mono';
                            badgeText = `CREDITED (${Math.round(paidRatio * 100)}% PAID)`;
                          } else {
                            badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                            qtyPrefix = qtyVal > 0 ? '+' : '';
                            textClass = 'text-slate-900 font-bold font-mono';
                            badgeText = 'CREDITED (UNPAID)';
                          }
                        } else if (adj.type === 'purchase_in') {
                          badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                          qtyPrefix = '+';
                          textClass = 'text-slate-900 font-bold font-mono';
                        } else if (adj.type === 'sale_out') {
                          badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                          qtyPrefix = '';
                          textClass = 'text-slate-900 font-bold font-mono';
                        } else if (adj.type === 'damaged') {
                          badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                          qtyPrefix = '';
                          textClass = 'text-slate-900 font-bold font-mono';
                        } else if (adj.type === 'returned') {
                          badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                          qtyPrefix = '+';
                          textClass = 'text-slate-900 font-bold font-mono';
                        } else {
                          badgeClass = 'bg-slate-100 text-slate-900 font-bold border border-slate-200';
                          qtyPrefix = qtyVal > 0 ? '+' : '';
                          textClass = 'text-slate-900 font-bold font-mono';
                        }

                        return (
                          <div key={adj.id} className={`p-4 space-y-2.5 ${adj.isFlagged ? 'bg-amber-50/20 border-l-2 border-amber-500' : ''}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 block truncate text-xs">
                                  {adj.itemName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  ID: {adj.id.slice(0, 10).toUpperCase()} • {getTxDate(adj.date)} {getTxTime(adj.date)}
                                </span>
                                {adj.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                    <Flag size={8} className="fill-amber-500 animate-pulse" /> Flagged
                                  </span>
                                )}
                                {adj.isResolved && !adj.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                                    <CheckCircle size={8} className="text-emerald-500" /> Corrected
                                  </span>
                                )}
                              </div>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${badgeClass}`}>
                                {badgeText}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 bg-slate-50 border border-slate-100/60 p-2.5 rounded-lg text-[10px]">
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Qty Moved</span>
                                <span className={`text-xs font-black font-mono ${textClass}`}>{qtyPrefix}{qtyVal}</span>
                              </div>
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Comments</span>
                                <span className="text-slate-600 block text-[10px] truncate italic" title={adj.notes || 'No comments'}>
                                  {adj.notes || '—'}
                                </span>
                              </div>
                            </div>
                            {adj.isFlagged && (
                              <div className="bg-amber-50/80 border border-amber-100 p-2 rounded-lg text-[10px] text-slate-700">
                                <span className="font-extrabold text-[9px] text-amber-800 uppercase block mb-0.5">Flag Comment ({adj.flaggedBy}):</span>
                                <p className="font-sans leading-relaxed">"{adj.flagComment}"</p>
                              </div>
                            )}

                            <div className="flex justify-end gap-2 pt-1">
                              {adj.isFlagged ? (
                                userRole === 2 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCorrectingAdjId(adj.id);
                                      setCorrectedQty(adj.qtyChanged);
                                      setCorrectionNotes('');
                                    }}
                                    className="w-full flex justify-center items-center gap-1.5 bg-indigo-600 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded-lg shadow-xs hover:shadow-md transition"
                                  >
                                    <Edit3 size={11} /> Correct Qty
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-amber-600 font-semibold italic flex items-center justify-end gap-1 w-full"><Flag size={10} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFlaggingAdjId(adj.id);
                                    setFlagComment('');
                                  }}
                                  className="w-full flex justify-center items-center bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-slate-655 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer select-none"
                                  title="Flag Mistake"
                                >
                                  <Flag size={13} className="fill-slate-400 hover:fill-amber-500 transition-colors mr-1" />
                                  <span className="text-[10px] font-bold uppercase">Flag</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : activeTab === 'sale_credit' ? (
          <motion.div
            key="sale-credit-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >


            {/* Main Table Card Area */}
            <div className="finnova-card p-0 sm:p-0 overflow-hidden">
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse table-fixed text-xs">
                  <thead>
                    <tr className="neumorphic-table-header text-[10px] select-none">
                      <th className="px-3.5 py-3 w-[13%]">Transaction ID</th>
                      <th className="px-3.5 py-3 w-[13%]">Date & Time</th>
                      <th className="px-3.5 py-3 w-[24%]">Product / Inventory Item</th>
                      <th className="px-3.5 py-3 text-center w-[17%]">Deal Type / Status</th>
                      <th className="px-3.5 py-3 text-center w-[9%]">Quantity</th>
                      <th className="px-3.5 py-3 text-right w-[11%]">Item Price</th>
                      <th className="px-3.5 py-3 text-right w-[13%] font-black">Total Value</th>
                      <th className="px-3.5 py-3 text-center w-[5%]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                    {filteredSaleCreditAdjustments.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-8 text-center">
                          <div className="neumorphic-inset p-8 rounded-2xl flex flex-col items-center justify-center space-y-2">
                            <ClipboardList className="text-slate-400" size={32} />
                            <p className="text-sm font-bold text-slate-800">No matching sales or credits logged.</p>
                            <p className="text-[10px] text-slate-500 font-medium">Modify your Search Query or select "All Sale & Credit Types" to locate items.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      groupItemsByMonth<StockAdjustment>(filteredSaleCreditAdjustments).map((group) => (
                        <React.Fragment key={group.monthLabel}>
                          <tr className="bg-slate-100/60 border-y border-slate-200/50 select-none">
                            <td colSpan={8} className="px-4 py-2 font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">
                              {group.monthLabel}
                            </td>
                          </tr>
                          {group.items.map((adj) => {
                            const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
                            const item = inventory.find(i => i.id === adj.itemId);
                            const price = adj.unitPriceSnapshot ?? (item ? item.unitPrice : 0);
                            const val = Math.abs(adj.qtyChanged) * price;

                            const account = isCredited ? getLinkedAccount(adj) : null;
                            const paidRatio = isCredited ? getCreditAccountPaidRatio(account) : 0;
                            const badgeClass = 'neumorphic-btn text-slate-900 dark:text-white font-extrabold border border-white/80 dark:border-slate-700';

                            let badgeText = 'PAID SALE';
                            if (isCredited) {
                              if (paidRatio === 1) {
                                badgeText = 'CREDITED (FULLY PAID)';
                              } else if (paidRatio > 0) {
                                badgeText = `CREDITED (${Math.round(paidRatio * 100)}% PAID)`;
                              } else {
                                badgeText = 'CREDITED (UNPAID)';
                              }
                            }

                            return (
                              <tr key={adj.id} className={`hover:bg-white/45 border-b border-slate-100/30 transition duration-150 ${adj.isFlagged ? 'bg-amber-50/15' : ''}`}>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-800 dark:text-slate-200 font-mono text-[10px] font-bold">
                                  {adj.id}
                                </td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap text-slate-600 dark:text-slate-300 font-mono text-[10px] leading-tight">
                                  <div>{getTxDate(adj.date)}</div>
                                  <div className="text-slate-400 dark:text-slate-500 text-[9px] mt-0.5">{getTxTime(adj.date)}</div>
                                </td>
                                <td className="px-3 py-2.5 text-center">
                                  <div className="flex flex-col items-center justify-center text-center">
                                    <p className="font-bold text-gray-900 dark:text-white text-[11px] leading-snug">{adj.itemName}</p>
                                    <p className="text-[9px] text-gray-400 dark:text-slate-400">ID: {adj.itemId}</p>
                                    {adj.isFlagged && (
                                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase neumorphic-inset text-slate-900 dark:text-white border border-white/80 dark:border-slate-800">
                                        <Flag size={8} className="text-slate-800 dark:text-slate-200" /> Flagged Correction
                                      </span>
                                    )}
                                    {adj.isResolved && !adj.isFlagged && (
                                      <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[8px] font-bold uppercase neumorphic-inset text-slate-900 dark:text-white border border-white/80 dark:border-slate-800">
                                        <CheckCircle size={8} className="text-slate-800 dark:text-slate-200" /> Corrected & Resolved
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${badgeClass}`}>
                                    {badgeText}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-center whitespace-nowrap font-mono font-bold">
                                  {Math.abs(adj.qtyChanged)}
                                </td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono text-slate-500">
                                  {formatMoney(price)}
                                </td>
                                <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono font-bold text-slate-900">
                                  {formatMoney(val)}
                                </td>
                                <td className="px-2 py-2.5 text-center align-middle w-[118px] max-w-[118px]">
                                  {adj.isFlagged ? (
                                    userRole === 2 ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setCorrectingAdjId(adj.id);
                                          setCorrectedQty(adj.qtyChanged);
                                          setCorrectionNotes('');
                                        }}
                                        className="w-full max-w-[112px] inline-flex items-center justify-center gap-1 neumorphic-btn text-slate-800 dark:text-white font-extrabold text-[8px] uppercase tracking-wider leading-3 px-1.5 py-1.5 rounded-lg transition cursor-pointer select-none whitespace-normal text-center"
                                      >
                                        <Edit3 size={10} /> Correct Qty
                                      </button>
                                    ) : (
                                      <span className="text-[9.5px] text-amber-600 font-semibold italic flex items-center justify-end gap-1"><Flag size={10} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                    )
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFlaggingAdjId(adj.id);
                                        setFlagComment('');
                                      }}
                                      className="w-8 h-8 neumorphic-btn text-slate-800 hover:text-red-600 inline-flex items-center justify-center rounded-xl transition cursor-pointer select-none"
                                      title="Flag Mistake"
                                    >
                                      <MaterialIcon name="flag" size={16} className="text-slate-800" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile View list Card style */}
              <div className="block lg:hidden text-slate-800 space-y-4">
                {filteredSaleCreditAdjustments.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                    <Receipt className="mx-auto mb-2 text-slate-300" size={32} />
                    No cash sales ledger logs found matching criteria.
                  </div>
                ) : (
                  groupItemsByMonth<StockAdjustment>(filteredSaleCreditAdjustments).map((group) => (
                    <div key={group.monthLabel} className="space-y-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                      <div className="bg-slate-100/60 border-b border-slate-150 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                        {group.monthLabel}
                      </div>
                      <div className="divide-y divide-slate-150/70">
                        {group.items.map((adj) => {
                          const isCredited = !!adj.creditAccountId || !!(adj.notes && (adj.notes.toLowerCase().includes('credited') || adj.notes.toLowerCase().includes('on credit') || adj.notes.toLowerCase().includes('sold on credit') || adj.notes.toLowerCase().includes('purchased on credit')));
                          const item = inventory.find(i => i.id === adj.itemId);
                          const price = adj.unitPriceSnapshot ?? (item ? item.unitPrice : 0);
                          const val = Math.abs(adj.qtyChanged) * price;

                          const account = isCredited ? getLinkedAccount(adj) : null;
                          const paidRatio = isCredited ? getCreditAccountPaidRatio(account) : 0;

                          const badgeClass = isCredited
                            ? (paidRatio === 1
                              ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-250'
                              : paidRatio > 0
                                ? 'bg-amber-50 text-amber-800 font-bold border border-amber-250'
                                : 'bg-rose-50 text-rose-700 font-bold border border-rose-205'
                            )
                            : 'bg-blue-50 text-blue-700 font-bold border border-blue-100';

                          let badgeText = 'PAID SALE';
                          if (isCredited) {
                            if (paidRatio === 1) {
                              badgeText = 'CREDITED (FULLY PAID)';
                            } else if (paidRatio > 0) {
                              badgeText = `CREDITED (${Math.round(paidRatio * 100)}% PAID)`;
                            } else {
                              badgeText = 'CREDITED (UNPAID)';
                            }
                          }

                          return (
                            <div key={adj.id} className={`p-4 space-y-2.5 ${adj.isFlagged ? 'bg-amber-50/15 border-l-4 border-amber-500' : ''}`}>
                              <div className="flex justify-between items-start gap-2">
                                <div className="min-w-0">
                                  <span className="font-extrabold text-slate-900 block truncate text-xs">
                                    {adj.itemName}
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                    ID: {adj.id.slice(0, 10).toUpperCase()} • {getTxDate(adj.date)}
                                  </span>
                                  {adj.isFlagged && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                      <Flag size={9} className="fill-amber-500 animate-pulse" /> Flagged Correction
                                    </span>
                                  )}
                                  {adj.isResolved && !adj.isFlagged && (
                                    <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                                      <CheckCircle size={9} className="text-emerald-500" /> Corrected & Resolved
                                    </span>
                                  )}
                                </div>
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${badgeClass}`}>
                                  {badgeText}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100/60 p-2.5 rounded-lg text-[10px] text-center">
                                <div>
                                  <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Qty</span>
                                  <strong className="text-slate-900 font-mono text-xs">{Math.abs(adj.qtyChanged)} pcs</strong>
                                </div>
                                <div>
                                  <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Unit Price</span>
                                  <strong className="text-slate-650 font-mono">{formatMoney(price)}</strong>
                                </div>
                                <div className="text-right">
                                  <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Total Value</span>
                                  <strong className="text-emerald-700 font-mono text-xs font-black">{formatMoney(val)}</strong>
                                </div>
                              </div>
                              {adj.isFlagged && (
                                <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-slate-700 text-[10px]">
                                  <span className="font-extrabold text-[9px] text-amber-850 uppercase block mb-0.5">Flag Comment ({adj.flaggedBy}):</span>
                                  <p className="font-medium font-sans leading-relaxed">"{adj.flagComment}"</p>
                                </div>
                              )}
                              {adj.notes && (
                                <div className="text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-100/50 italic">
                                  Description: {adj.notes}
                                </div>
                              )}
                              <div className="pt-1 flex justify-end">
                                {adj.isFlagged ? (
                                  userRole === 2 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCorrectingAdjId(adj.id);
                                        setCorrectedQty(adj.qtyChanged);
                                        setCorrectionNotes('');
                                      }}
                                      className="w-full flex justify-center items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded-lg shadow-sm transition cursor-pointer select-none"
                                    >
                                      <Edit3 size={11} /> Correct Qty
                                    </button>
                                  ) : (
                                    <span className="w-full text-center py-1.5 rounded-lg bg-amber-50 text-[10px] text-amber-700 font-bold border border-amber-200 flex items-center justify-center gap-1"><Flag size={11} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFlaggingAdjId(adj.id);
                                      setFlagComment('');
                                    }}
                                    className="w-full flex justify-center items-center bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-slate-655 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer select-none"
                                    title="Flag Mistake"
                                  >
                                    <Flag size={13} className="fill-slate-400 hover:fill-amber-500 transition-colors mr-1" />
                                    <span className="text-[10px] font-bold uppercase">Flag</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        ) : activeTab === 'credit' ? (
          <motion.div
            key="credit-transactions-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="finnova-card p-0 sm:p-0 overflow-hidden"
          >
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto text-xs">
                <thead>
                  <tr className="neumorphic-table-header text-[10px] select-none">
                    <th className="px-3.5 py-3 w-[100px]">Transaction ID</th>
                    <th className="px-3.5 py-3 w-[120px]">Date & Time</th>
                    <th className="px-3.5 py-3">Credit Account Holder</th>
                    <th className="px-3.5 py-3 text-center w-32">Transaction Type</th>
                    <th className="px-3.5 py-3 text-center w-32">Payment Method</th>
                    <th className="px-3.5 py-3 text-right w-28">Impact Amount</th>
                    <th className="px-3.5 py-3 text-right w-32 font-semibold">Balance Left</th>
                    <th className="px-3.5 py-3 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center">
                        <div className="neumorphic-inset p-8 rounded-2xl flex flex-col items-center justify-center space-y-2">
                          <ClipboardList className="text-slate-400" size={32} />
                          <p className="text-sm font-bold text-slate-800">No client repayment or charge records found.</p>
                          <p className="text-[10px] text-slate-500 font-medium">Modify your filter settings above to locate entries.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupItemsByMonth<CreditTransaction>(filteredTransactions).map((group) => (
                      <React.Fragment key={group.monthLabel}>
                        <tr className="bg-slate-100/60 border-y border-slate-200/50 select-none">
                          <td colSpan={9} className="px-4 py-2 font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">
                            {group.monthLabel}
                          </td>
                        </tr>
                        {group.items.map((tx) => {
                          const isBorrow = tx.type === 'borrow' || tx.type === 'charge';
                          const txTypeBadge = isBorrow
                            ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100';

                          return (
                            <tr key={tx.id} className={`hover:bg-white/45 border-b border-slate-100/30 transition duration-150 ${tx.isFlagged ? 'bg-amber-50/15' : ''}`}>
                              <td className="px-3 py-2.5 whitespace-nowrap text-slate-800 font-mono text-[10px] font-bold">
                                {tx.id}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-mono text-[10px] leading-tight">
                                <div>{getTxDate(tx.date)}</div>
                                <div className="text-slate-400 text-[9px] mt-0.5">{getTxTime(tx.date)}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-gray-900 text-[11px]">{tx.accountName}</p>
                                    {tx.isFlagged && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-205 shrink-0">
                                        <Flag size={8} className="fill-amber-500 animate-pulse" /> Flagged Correction
                                      </span>
                                    )}
                                    {tx.isResolved && !tx.isFlagged && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250 shrink-0">
                                        <CheckCircle size={8} className="text-emerald-500" /> Corrected & Resolved
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-gray-400 font-mono text-slate-400 mt-0.5" title={`Raw reference ID: ${tx.creditAccountId}`}>
                                    Credit ID: <span className="text-indigo-650 font-bold">CR-{tx.creditAccountId.replace('credit-', '').slice(-6).toUpperCase()}</span>
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <span className={`inline-block px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider ${txTypeBadge}`}>
                                  {tx.type === 'pay' ? 'Repayment Settle' : 'Credit Granted'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {tx.paymentMethod ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-700">
                                    {tx.paymentMethod}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono text-xs">
                                <span className={`font-bold ${isBorrow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {isBorrow ? '+' : '-'}{formatMoney(tx.amount)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono text-xs text-slate-900 font-bold">
                                {formatMoney(getBalanceAfterTx(tx))}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 italic font-medium max-w-[160px] break-words text-[11px]">
                                <div className="flex flex-col gap-1.5">
                                  {tx.isFlagged && (
                                    <div className="bg-amber-50/80 border border-amber-100 p-2 rounded-lg text-slate-705 not-italic text-[10px]">
                                      <span className="font-extrabold text-[9px] text-amber-800 uppercase block mb-0.5">Flag Comment ({tx.flaggedBy}):</span>
                                      <p className="font-medium font-sans leading-relaxed">"{tx.flagComment}"</p>
                                    </div>
                                  )}
                                  {tx.isResolved && tx.correctionNotes && (
                                    <div className="bg-emerald-50/60 border border-emerald-100 p-2 rounded-lg text-slate-705 not-italic text-[10px]">
                                      <span className="font-extrabold text-[9px] text-emerald-800 uppercase block mb-0.5">Admin Resolution Note ({tx.resolvedBy}):</span>
                                      <p className="font-medium font-sans leading-relaxed">"{tx.correctionNotes}"</p>
                                    </div>
                                  )}
                                  <span>{tx.notes || 'No transaction comments.'}</span>
                                  {tx.paymentMethod && (
                                    <span className="text-[9px] text-indigo-600 font-semibold uppercase not-italic">Method: {tx.paymentMethod}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {tx.isFlagged ? (
                                  userRole === 2 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCorrectingTxId(tx.id);
                                        setCorrectedTxAmount(tx.amount);
                                        setTxCorrectionNotes('');
                                      }}
                                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-705 active:bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer select-none"
                                    >
                                      <Edit3 size={10} /> Correct Amount
                                    </button>
                                  ) : (
                                    <span className="text-[9.5px] text-amber-600 font-semibold italic flex items-center justify-end gap-1"><Flag size={10} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFlaggingTxId(tx.id);
                                      setTxFlagComment('');
                                    }}
                                    className="w-8 h-8 neumorphic-btn text-slate-800 hover:text-red-600 inline-flex items-center justify-center rounded-xl transition cursor-pointer select-none"
                                    title="Flag Mistake"
                                  >
                                    <MaterialIcon name="flag" size={16} className="text-slate-800" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View list Card style */}
            <div className="block lg:hidden text-slate-800 space-y-4">
              {filteredTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <ClipboardList className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="font-medium text-xs">No client records found.</p>
                </div>
              ) : (
                groupItemsByMonth<CreditTransaction>(filteredTransactions).map((group) => (
                  <div key={group.monthLabel} className="space-y-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-100/60 border-b border-slate-150 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      {group.monthLabel}
                    </div>
                    <div className="divide-y divide-slate-150/70">
                      {group.items.map((tx) => {
                        const isBorrow = tx.type === 'borrow' || tx.type === 'charge';
                        const txTypeBadge = isBorrow
                          ? 'bg-amber-100 text-amber-800 border border-amber-200 font-bold'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100';

                        return (
                          <div key={tx.id} className={`p-4 space-y-2.5 ${tx.isFlagged ? 'bg-amber-50/15 border-l-4 border-amber-500' : ''}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 block truncate text-xs">
                                  {tx.accountName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  ID: CR-{tx.creditAccountId.replace('credit-', '').slice(-6).toUpperCase()} • {getTxDate(tx.date)}
                                </span>
                                {tx.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                    <Flag size={9} className="fill-amber-500 animate-pulse" /> Flagged Correction
                                  </span>
                                )}
                                {tx.isResolved && !tx.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                                    <CheckCircle size={9} className="text-emerald-500" /> Corrected & Resolved
                                  </span>
                                )}
                              </div>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${txTypeBadge}`}>
                                {tx.type === 'pay' ? 'Repayment' : 'Credit Granted'}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100/60 p-2.5 rounded-lg text-[10px] text-center">
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Method</span>
                                <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[8.5px] font-bold uppercase bg-indigo-50 border border-indigo-100 text-indigo-700">
                                  {tx.paymentMethod || 'Other'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Impact</span>
                                <strong className={`font-mono text-xs font-black block mt-1 ${isBorrow ? 'text-amber-600' : 'text-emerald-705'}`}>
                                  {isBorrow ? '+' : '-'}{formatMoney(tx.amount)}
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Balance Left</span>
                                <strong className="text-slate-900 font-mono text-xs font-black block mt-1">{formatMoney(getBalanceAfterTx(tx))}</strong>
                              </div>
                            </div>
                            {tx.isFlagged && (
                              <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-slate-700 text-[10px]">
                                <span className="font-extrabold text-[9px] text-amber-850 uppercase block mb-0.5">Flag Comment ({tx.flaggedBy}):</span>
                                <p className="font-medium font-sans leading-relaxed">"{tx.flagComment}"</p>
                              </div>
                            )}
                            {tx.isResolved && tx.correctionNotes && (
                              <div className="bg-emerald-50 border border-emerald-255 p-2.5 rounded-lg text-slate-700 text-[10px]">
                                <span className="font-extrabold text-[9px] text-emerald-850 uppercase block mb-0.5">Admin Resolution Note ({tx.resolvedBy}):</span>
                                <p className="font-medium font-sans leading-relaxed">"{tx.correctionNotes}"</p>
                              </div>
                            )}
                            {tx.notes && (
                              <div className="text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-100/50 italic">
                                Comments: {tx.notes}
                              </div>
                            )}
                            <div className="pt-1 flex justify-end">
                              {tx.isFlagged ? (
                                userRole === 2 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCorrectingTxId(tx.id);
                                      setCorrectedTxAmount(tx.amount);
                                      setTxCorrectionNotes('');
                                    }}
                                    className="w-full flex justify-center items-center gap-1 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded-lg shadow-sm transition cursor-pointer select-none"
                                  >
                                    <Edit3 size={11} /> Correct Amount
                                  </button>
                                ) : (
                                  <span className="w-full text-center py-1.5 rounded-lg bg-amber-50 text-[10px] text-amber-700 font-bold border border-amber-200 flex items-center justify-center gap-1"><Flag size={11} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFlaggingTxId(tx.id);
                                    setTxFlagComment('');
                                  }}
                                  className="w-full flex justify-center items-center bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-slate-655 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer select-none"
                                  title="Flag Mistake"
                                >
                                  <Flag size={13} className="fill-slate-400 hover:fill-amber-500 transition-colors mr-1" />
                                  <span className="text-[10px] font-bold uppercase">Flag</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="payable-transactions-list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="finnova-card p-0 sm:p-0 overflow-hidden"
          >
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto text-xs">
                <thead>
                  <tr className="neumorphic-table-header text-[10px] select-none">
                    <th className="px-3.5 py-3 w-[100px]">Transaction ID</th>
                    <th className="px-3.5 py-3 w-[120px]">Date & Time</th>
                    <th className="px-3.5 py-3">Supplier Account</th>
                    <th className="px-3.5 py-3 text-center w-32">Transaction Type</th>
                    <th className="px-3.5 py-3 text-center w-32">Payment Method</th>
                    <th className="px-3.5 py-3 text-right w-28">Impact Amount</th>
                    <th className="px-3.5 py-3 text-right w-32 font-semibold">Balance Left</th>
                    <th className="px-3.5 py-3 text-right w-28">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
                  {filteredPayableTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center">
                        <div className="neumorphic-inset p-8 rounded-2xl flex flex-col items-center justify-center space-y-2">
                          <ClipboardList className="text-slate-400" size={32} />
                          <p className="text-sm font-bold text-slate-800">No supplier payable transaction records found.</p>
                          <p className="text-[10px] text-slate-500 font-medium">Modify your filter settings above to locate entries.</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    groupItemsByMonth<CreditTransaction>(filteredPayableTransactions).map((group) => (
                      <React.Fragment key={group.monthLabel}>
                        <tr className="bg-slate-100/60 border-y border-slate-200/50 select-none">
                          <td colSpan={9} className="px-4 py-2 font-extrabold text-[10px] text-slate-500 uppercase tracking-wider">
                            {group.monthLabel}
                          </td>
                        </tr>
                        {group.items.map((tx) => {
                          const isBorrow = tx.type === 'borrow' || tx.type === 'charge';
                          const txTypeBadge = isBorrow
                            ? 'bg-amber-100 text-amber-855 border border-amber-200 font-bold'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100';

                          return (
                            <tr key={tx.id} className={`hover:bg-white/45 border-b border-slate-100/30 transition duration-150 ${tx.isFlagged ? 'bg-amber-50/15' : ''}`}>
                              <td className="px-3 py-2.5 whitespace-nowrap text-slate-800 font-mono text-[10px] font-bold">
                                {tx.id}
                              </td>
                              <td className="px-3 py-2.5 whitespace-nowrap text-slate-600 font-mono text-[10px] leading-tight">
                                <div>{getTxDate(tx.date)}</div>
                                <div className="text-slate-400 text-[9px] mt-0.5">{getTxTime(tx.date)}</div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="font-bold text-gray-900 text-[11px]">{tx.accountName}</p>
                                    {tx.isFlagged && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-205 shrink-0">
                                        <Flag size={8} className="fill-amber-500 animate-pulse" /> Flagged Correction
                                      </span>
                                    )}
                                    {tx.isResolved && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250 shrink-0">
                                        <CheckCircle size={8} className="text-emerald-500" /> Corrected & Resolved
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-gray-400 font-mono text-slate-400 mt-0.5" title={`Raw reference ID: ${tx.creditAccountId}`}>
                                    Credit ID: <span className="text-indigo-650 font-bold">CR-{tx.creditAccountId.replace('credit-', '').slice(-6).toUpperCase()}</span>
                                  </p>
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${txTypeBadge}`}>
                                  {tx.type === 'pay' ? 'We Paid Supplier' : 'Debt Added'}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center whitespace-nowrap">
                                {tx.paymentMethod ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-100 text-indigo-700">
                                    {tx.paymentMethod}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-medium">—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono text-xs">
                                <span className={`font-bold ${isBorrow ? 'text-amber-600' : 'text-emerald-600'}`}>
                                  {isBorrow ? '+' : '-'}{formatMoney(tx.amount)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap font-mono text-xs text-slate-900 font-bold">
                                {formatMoney(getBalanceAfterTx(tx))}
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 italic font-medium max-w-[160px] break-words text-[11px]">
                                <div className="flex flex-col gap-1.5">
                                  {tx.isFlagged && (
                                    <div className="bg-amber-50/80 border border-amber-100 p-2 rounded-lg text-slate-755 not-italic text-[10px]">
                                      <span className="font-extrabold text-[9px] text-amber-800 uppercase block mb-0.5">Flag Comment ({tx.flaggedBy}):</span>
                                      <p className="font-medium font-sans leading-relaxed">"{tx.flagComment}"</p>
                                    </div>
                                  )}
                                  {tx.isResolved && tx.correctionNotes && (
                                    <div className="bg-emerald-50/60 border border-emerald-100 p-2 rounded-lg text-slate-755 not-italic text-[10px]">
                                      <span className="font-extrabold text-[9px] text-emerald-800 uppercase block mb-0.5">Admin Resolution Note ({tx.resolvedBy}):</span>
                                      <p className="font-medium font-sans leading-relaxed">"{tx.correctionNotes}"</p>
                                    </div>
                                  )}
                                  <span>{tx.notes || 'No transaction comments.'}</span>
                                  {tx.paymentMethod && (
                                    <span className="text-[9px] text-indigo-600 font-semibold uppercase not-italic">Method: {tx.paymentMethod}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                {tx.isFlagged ? (
                                  userRole === 2 ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setCorrectingTxId(tx.id);
                                        setCorrectedTxAmount(tx.amount);
                                        setTxCorrectionNotes('');
                                      }}
                                      className="inline-flex items-center gap-1 bg-indigo-600 hover:bg-indigo-705 active:bg-indigo-700 text-white font-bold text-[9px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition cursor-pointer select-none"
                                    >
                                      <Edit3 size={10} /> Correct Amount
                                    </button>
                                  ) : (
                                    <span className="text-[9.5px] text-amber-600 font-semibold italic flex items-center justify-end gap-1"><Flag size={10} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                  )
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setFlaggingTxId(tx.id);
                                      setTxFlagComment('');
                                    }}
                                    className="w-8 h-8 neumorphic-btn text-slate-800 hover:text-red-600 inline-flex items-center justify-center rounded-xl transition cursor-pointer select-none"
                                    title="Flag Mistake"
                                  >
                                    <MaterialIcon name="flag" size={16} className="text-slate-800" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View list Card style */}
            <div className="block lg:hidden text-slate-800 space-y-4">
              {filteredPayableTransactions.length === 0 ? (
                <div className="py-12 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
                  <ClipboardList className="mx-auto text-slate-300 mb-2" size={32} />
                  <p className="font-medium text-xs">No supplier entries found.</p>
                </div>
              ) : (
                groupItemsByMonth<CreditTransaction>(filteredPayableTransactions).map((group) => (
                  <div key={group.monthLabel} className="space-y-1 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                    <div className="bg-slate-100/60 border-b border-slate-150 px-4 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider select-none">
                      {group.monthLabel}
                    </div>
                    <div className="divide-y divide-slate-150/70">
                      {group.items.map((tx) => {
                        const isBorrow = tx.type === 'borrow' || tx.type === 'charge';
                        const txTypeBadge = isBorrow
                          ? 'bg-amber-100 text-amber-855 border border-amber-200 font-bold'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-100';

                        return (
                          <div key={tx.id} className={`p-4 space-y-2.5 ${tx.isFlagged ? 'bg-amber-50/15 border-l-4 border-amber-500' : ''}`}>
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <span className="font-extrabold text-slate-900 block truncate text-xs">
                                  {tx.accountName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                                  ID: CR-{tx.creditAccountId.replace('credit-', '').slice(-6).toUpperCase()} • {getTxDate(tx.date)}
                                </span>
                                {tx.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                                    <Flag size={9} className="fill-amber-500 animate-pulse" /> Flagged Correction
                                  </span>
                                )}
                                {tx.isResolved && !tx.isFlagged && (
                                  <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-250">
                                    <CheckCircle size={9} className="text-emerald-500" /> Corrected & Resolved
                                  </span>
                                )}
                              </div>
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[8.5px] font-bold uppercase tracking-wider shrink-0 whitespace-nowrap ${txTypeBadge}`}>
                                {tx.type === 'pay' ? 'We Paid Supplier' : 'Debt Added'}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-slate-50 border border-slate-100/60 p-2.5 rounded-lg text-[10px] text-center">
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Method</span>
                                <span className="inline-block px-1.5 py-0.5 mt-0.5 rounded text-[8.5px] font-bold uppercase bg-indigo-50 border border-indigo-100 text-indigo-700">
                                  {tx.paymentMethod || 'Other'}
                                </span>
                              </div>
                              <div>
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Impact</span>
                                <strong className={`font-mono text-xs font-black ${isBorrow ? 'text-amber-650' : 'text-emerald-700'}`}>
                                  {isBorrow ? '+' : '-'}{formatMoney(tx.amount)}
                                </strong>
                              </div>
                              <div className="text-right">
                                <span className="block text-slate-400 text-[9px] uppercase font-semibold font-mono">Debt Left</span>
                                <strong className="text-slate-900 font-mono text-xs font-black">{formatMoney(getBalanceAfterTx(tx))}</strong>
                              </div>
                            </div>
                            {tx.isFlagged && (
                              <div className="bg-amber-50 border border-amber-100 p-2.5 rounded-lg text-slate-700 text-[10px]">
                                <span className="font-extrabold text-[9px] text-amber-855 uppercase block mb-0.5">Flag Comment ({tx.flaggedBy}):</span>
                                <p className="font-medium font-sans leading-relaxed">"{tx.flagComment}"</p>
                              </div>
                            )}
                            {tx.isResolved && tx.correctionNotes && (
                              <div className="bg-emerald-50 border border-emerald-250 p-2.5 rounded-lg text-slate-700 text-[10px]">
                                <span className="font-extrabold text-[9px] text-emerald-855 uppercase block mb-0.5">Admin Resolution Note ({tx.resolvedBy}):</span>
                                <p className="font-medium font-sans leading-relaxed">"{tx.correctionNotes}"</p>
                              </div>
                            )}
                            {tx.notes && (
                              <div className="text-[10px] text-slate-500 bg-slate-50/50 p-2 rounded border border-slate-100/50 italic">
                                Comments: {tx.notes}
                              </div>
                            )}
                            <div className="pt-1 flex justify-end">
                              {tx.isFlagged ? (
                                userRole === 2 ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCorrectingTxId(tx.id);
                                      setCorrectedTxAmount(tx.amount);
                                      setTxCorrectionNotes('');
                                    }}
                                    className="w-full flex justify-center items-center gap-1 bg-indigo-600 hover:bg-indigo-705 active:bg-indigo-700 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded-lg shadow-sm transition cursor-pointer select-none"
                                  >
                                    <Edit3 size={11} /> Correct Amount
                                  </button>
                                ) : (
                                  <span className="w-full text-center py-1.5 rounded-lg bg-amber-50 text-[10px] text-amber-700 font-bold border border-amber-200 flex items-center justify-center gap-1"><Flag size={11} className="fill-amber-500 animate-pulse" /> Awaiting Review</span>
                                )
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFlaggingTxId(tx.id);
                                    setTxFlagComment('');
                                  }}
                                  className="w-full flex justify-center items-center bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 text-slate-655 py-1.5 rounded-lg border border-slate-200 transition cursor-pointer select-none"
                                  title="Flag Mistake"
                                >
                                  <Flag size={13} className="fill-slate-400 hover:fill-amber-500 transition-colors mr-1" />
                                  <span className="text-[10px] font-bold uppercase">Flag</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: HIGH-CRAFT REPAYMENT ENTRY FROM TRANSACTIONS TAB */}
      {showRecModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-xs flex flex-col max-h-[90vh] border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <MaterialIcon name="payments" size={18} className="text-sky-600 dark:text-sky-400" /> {recModalType === 'receivable' ? 'Record Repayment' : 'Record Supplier Payment'}
              </h3>
              <button
                type="button"
                onClick={() => setShowRecModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable Form body */}
            <form onSubmit={handleRecordTransaction} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block font-semibold text-gray-755 mb-1">
                  {recModalType === 'receivable' ? 'Target Client Profile *' : 'Target Supplier Profile *'}
                </label>
                <select
                  required
                  value={selectedAccId}
                  onChange={(e) => {
                    const accId = e.target.value;
                    setSelectedAccId(accId);
                    const acc = creditAccounts.find(a => a.id === accId);
                    if (acc) {
                      if (paymentOption === 'full') {
                        setTxnAmount(acc.remainingAmount);
                        setTxnNotes('Full payment of outstanding dues.');
                      } else {
                        setTxnAmount('');
                        setTxnNotes('Partial payment of outstanding dues.');
                      }
                    } else {
                      setTxnAmount('');
                    }
                  }}
                  className="w-full text-xs rounded-md border border-gray-300 p-2.5 bg-white text-gray-900 focus:outline"
                >
                  <option value="">
                    {recModalType === 'receivable' ? 'Select a Client Profile...' : 'Select a Supplier Profile...'}
                  </option>
                  {creditAccounts
                    .filter(a => a.type === recModalType && (userRole === 2 || a.type !== 'payable') && a.remainingAmount > 0)
                    .map(a => (
                      <option key={a.id} value={a.id}>
                        CR-{a.id.replace('credit-', '').slice(-6).toUpperCase()} — {a.name} ({formatMoney(a.remainingAmount)} outstanding)
                      </option>
                    ))
                  }
                </select>
              </div>

              {/* Payment Type Selection: Full or Partial */}
              <div>
                <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">Payment Option *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOption('full');
                      const acc = creditAccounts.find(a => a.id === selectedAccId);
                      if (acc) {
                        setTxnAmount(acc.remainingAmount);
                      }
                      setTxnNotes('Full payment of outstanding dues.');
                    }}
                    className={`py-2 px-1 rounded-md border text-center font-semibold transition cursor-pointer text-xs ${paymentOption === 'full'
                        ? 'border-indigo-650 bg-indigo-50/50 text-indigo-700 font-bold'
                        : 'border-slate-200 hover:border-slate-350 text-slate-750 bg-slate-50/20'
                      }`}
                  >
                    Full Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentOption('partial');
                      setTxnNotes('Partial payment of outstanding dues.');
                    }}
                    className={`py-2 px-1 rounded-md border text-center font-semibold transition cursor-pointer text-xs ${paymentOption === 'partial'
                        ? 'border-indigo-650 bg-indigo-50/50 text-indigo-700 font-bold'
                        : 'border-slate-200 hover:border-slate-350 text-slate-750 bg-slate-50/20'
                      }`}
                  >
                    Partial Payment
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-semibold text-gray-750">Transaction Value ({config.currencySymbol}) *</label>
                  {paymentOption === 'full' && !!selectedAccId && (
                    <span className="text-[10px] text-indigo-600 font-bold">Locked to full outstanding balance</span>
                  )}
                </div>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={txnAmount}
                  disabled={paymentOption === 'full' && !!selectedAccId}
                  onChange={(e) => setTxnAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className={`w-full rounded-md border p-2.5 font-mono text-sm ${paymentOption === 'full' && !!selectedAccId
                      ? 'bg-slate-100 text-slate-500 cursor-not-allowed border-slate-200 font-semibold'
                      : 'bg-white text-gray-900 border-gray-300 focus:outline'
                    }`}
                />
              </div>

              {/* Payment Method */}
              <div>
                <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'Mobile Money', 'Bank'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setTxnPaymentMethod(method);
                        if (method === 'Cash') setTxnProof(null);
                      }}
                      className={`py-2 px-1 rounded-md border text-center font-semibold transition cursor-pointer ${txnPaymentMethod === method
                          ? 'border-indigo-600 bg-indigo-50/50 text-indigo-700 font-bold'
                          : 'border-slate-200 hover:border-slate-350 text-slate-750 bg-slate-50/20'
                        }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Proof Upload */}
              {txnPaymentMethod !== 'Cash' && (
                <div className="space-y-1.5">
                  <label className="block font-semibold text-gray-750">
                    {txnPaymentMethod === 'Mobile Money'
                      ? 'Upload Screenshot of confirmation * (Compulsory)'
                      : 'Upload Bank Slip/Receipt (Optional)'}
                  </label>

                  {!txnProof ? (
                    <div
                      onDragOver={handleTxnDragOver}
                      onDragLeave={handleTxnDragLeave}
                      onDrop={handleTxnDrop}
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition ${isTxnDragging
                          ? 'border-indigo-500 bg-indigo-50/50'
                          : 'border-slate-300 hover:border-slate-400 bg-slate-50/50 bg-white'
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
                        <UploadCloud size={20} className={`mb-1 ${isTxnDragging ? 'text-indigo-600 font-semibold' : 'text-slate-400'}`} />
                        <span className="text-[10px] font-bold text-gray-750 block">
                          {txnPaymentMethod === 'Mobile Money' ? 'Drag screenshot here, or browse' : 'Drag file here, or browse'}
                        </span>
                        <span className="text-[9px] text-gray-400 block mt-0.5">
                          Supports images and PDF documents
                        </span>
                      </label>
                    </div>
                  ) : (
                    <div className="border rounded-lg bg-indigo-50/10 p-2.5 flex items-center justify-between gap-2 border-indigo-100/50">
                      <div className="flex items-center gap-2 min-w-0">
                        {txnProof.type.startsWith('image/') ? (
                          <div className="w-8 h-8 rounded border overflow-hidden shrink-0 bg-white shadow-3xs flex items-center justify-center">
                            <img src={txnProof.dataUrl} className="w-full h-full object-cover" alt="repayment screenshot" />
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
                        className="text-gray-400 hover:text-red-500 font-bold px-1 py-0.5 rounded shrink-0 cursor-pointer text-[10px]"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Operator Comments */}
              <div>
                <label className="block font-semibold text-gray-750 mb-1">Operator comments / notes</label>
                <textarea
                  placeholder="Provide transaction details or proof memo notes..."
                  value={txnNotes}
                  onChange={(e) => setTxnNotes(e.target.value)}
                  className="w-full rounded-md border border-gray-300 p-2.5 bg-white text-gray-900 focus:outline text-xs h-16 resize-none"
                />
              </div>

              {/* Actions row */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowRecModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition cursor-pointer font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={selectedAccId === '' || txnAmount === '' || (txnPaymentMethod === 'Mobile Money' && !txnProof)}
                  className={`px-4 py-2 rounded-md font-semibold transition ${selectedAccId === '' || txnAmount === '' || (txnPaymentMethod === 'Mobile Money' && !txnProof)
                      ? 'neumorphic-inset bg-slate-200/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-white/80 dark:border-slate-700'
                      : 'neumorphic-btn text-slate-800 dark:text-white cursor-pointer'
                    }`}
                >
                  {recModalType === 'receivable' ? 'Record Repayment' : 'Record Payment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: FLAGGING CORRECTION MISTAKE */}
      {flaggingAdjId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden text-slate-900 dark:text-white text-xs flex flex-col"
          >
            {/* Header */}
            <div className="p-5 pb-3 flex justify-between items-center shrink-0 border-b border-slate-200/50">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <MaterialIcon name="flag" size={18} className="text-slate-800" />
                <span>Flag Transaction for Correction</span>
              </h3>
              <button
                type="button"
                onClick={() => setFlaggingAdjId(null)}
                className="w-7 h-7 neumorphic-btn text-slate-600 hover:text-slate-900 flex items-center justify-center rounded-lg transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={(e) => { e.preventDefault(); submitFlag(); }} className="p-6 space-y-4">
              <div>
                {/* Info about the item */}
                {(() => {
                  const targetAdj = adjustments.find(a => a.id === flaggingAdjId);
                  if (!targetAdj) return null;
                  return (
                    <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 p-3 rounded-xl mb-4 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">{targetAdj.itemName}</p>
                      <div className="grid grid-cols-2 text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                        <p>ID: {targetAdj.id.slice(0, 10).toUpperCase()}</p>
                        <p className="text-right">Original Qty: <span className="font-bold text-slate-900 dark:text-white">{targetAdj.qtyChanged}</span></p>
                      </div>
                    </div>
                  );
                })()}

                <label className="block font-extrabold text-slate-900 dark:text-white mb-1.5 text-xs">
                  Explain the quantity mistake / correction comment *
                </label>
                <textarea
                  required
                  placeholder="e.g. Bought 5 items but 6 was keyed in. Correct quantity should be 5."
                  value={flagComment}
                  onChange={(e) => setFlagComment(e.target.value)}
                  className="w-full text-xs rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 neumorphic-inset focus:outline-hidden h-24 resize-none font-extrabold"
                />
              </div>

              {/* Actions row */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setFlaggingAdjId(null)}
                  className="px-5 py-2.5 neumorphic-btn text-slate-700 hover:text-slate-950 rounded-xl transition cursor-pointer font-extrabold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!flagComment.trim()}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition ${!flagComment.trim()
                      ? 'neumorphic-inset bg-slate-200/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-white/80 dark:border-slate-700'
                      : 'neumorphic-btn bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white hover:text-sky-700 dark:hover:text-sky-300 cursor-pointer border border-white/80 dark:border-slate-700'
                    }`}
                >
                  Flag Transaction
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADMIN RESOLVING & CORRECTING QUANTITY */}
      {correctingAdjId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-xs flex flex-col border border-white/80 dark:border-slate-800"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Edit3 size={15} className="text-slate-800 dark:text-white" /> Admin Stock Correction Center
              </h3>
              <button
                type="button"
                onClick={() => setCorrectingAdjId(null)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={(e) => { e.preventDefault(); submitCorrection(); }} className="p-6 space-y-4">
              <div>
                <p className="text-slate-700 dark:text-slate-200 mb-3 leading-relaxed">
                  As Admin, you can correct the transaction amount/quantity. The difference will be added back or subtracted from the active inventory instantly.
                </p>

                {/* Info about the item */}
                {(() => {
                  const targetAdj = adjustments.find(a => a.id === correctingAdjId);
                  if (!targetAdj) return null;
                  return (
                    <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 p-3.5 rounded-xl mb-4 space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white">{targetAdj.itemName}</p>
                      <div className="grid grid-cols-2 text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                        <p>ID: {targetAdj.id.slice(0, 10).toUpperCase()}</p>
                        <p className="text-right">Original Qty Changed: <span className="font-extrabold text-slate-900 dark:text-white">{targetAdj.qtyChanged}</span></p>
                      </div>
                      <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#111827] border border-white/80 dark:border-slate-700 p-2.5 rounded-xl text-[10.5px] text-slate-800 dark:text-slate-200">
                        <span className="font-bold text-slate-800 dark:text-white block uppercase text-[9px] mb-0.5">Attendant Comment:</span>
                        "{targetAdj.flagComment}"
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">
                      New Corrected Quantity (Use negative sign for sales/stock-out) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. -5 (negative if sale_out)"
                      value={correctedQty}
                      onChange={(e) => setCorrectedQty(e.target.value === '' ? '' : Number(e.target.value))}
                      className="neumorphic-inset w-full text-xs rounded-xl border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#111827] text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">
                      Correction Notes / Resolution Reason *
                    </label>
                    <textarea
                      required
                      placeholder="Explain how this issue was resolved..."
                      value={correctionNotes}
                      onChange={(e) => setCorrectionNotes(e.target.value)}
                      className="neumorphic-inset w-full text-xs rounded-xl border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#111827] text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCorrectingAdjId(null)}
                  className="neumorphic-btn px-4 py-2 text-slate-800 dark:text-white rounded-xl transition cursor-pointer font-semibold text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctedQty === '' || !correctionNotes.trim()}
                  className={`px-4 py-2 rounded-md font-semibold text-[11px] transition ${correctedQty === '' || !correctionNotes.trim()
                      ? 'neumorphic-inset bg-slate-200/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-white/80 dark:border-slate-700'
                      : 'neumorphic-btn text-slate-800 dark:text-white cursor-pointer'
                    }`}
                >
                  Save Correction & Resolve
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: FLAGGING LEDGER TRANSACTION CORRECTION MISTAKE */}
      {flaggingTxId && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card rounded-2xl border border-white/90 dark:border-slate-700 shadow-2xl w-full max-w-md overflow-hidden text-slate-900 dark:text-white text-xs flex flex-col"
          >
            {/* Header */}
            <div className="p-5 pb-3 flex justify-between items-center shrink-0 border-b border-slate-200/50">
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                <MaterialIcon name="flag" size={18} className="text-slate-800" />
                <span>Flag Repayment for Correction</span>
              </h3>
              <button
                type="button"
                onClick={() => setFlaggingTxId(null)}
                className="w-7 h-7 neumorphic-btn text-slate-600 hover:text-slate-900 flex items-center justify-center rounded-lg transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={(e) => { e.preventDefault(); submitTxFlag(); }} className="p-6 space-y-4">
              <div>
                {/* Info about the transaction */}
                {(() => {
                  const targetTx = transactions.find(t => t.id === flaggingTxId);
                  if (!targetTx) return null;
                  return (
                    <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 p-3 rounded-xl mb-4 space-y-1">
                      <p className="font-bold text-slate-900 dark:text-white">{targetTx.accountName}</p>
                      <div className="grid grid-cols-2 text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                        <p>ID: {targetTx.id.slice(0, 10).toUpperCase()}</p>
                        <p className="text-right">Original Amount: <span className="font-bold text-slate-900 dark:text-white">{formatMoney(targetTx.amount)}</span></p>
                      </div>
                    </div>
                  );
                })()}

                <label className="block font-extrabold text-slate-900 dark:text-white mb-1.5 text-xs">
                  Explain the repayment/transaction mistake *
                </label>
                <textarea
                  required
                  placeholder="e.g. Paid 20,000 but 200,000 was keyed in. Correct amount should be 20,000."
                  value={txFlagComment}
                  onChange={(e) => setTxFlagComment(e.target.value)}
                  className="w-full text-xs rounded-xl p-3 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 neumorphic-inset focus:outline-hidden h-24 resize-none font-extrabold"
                />
              </div>

              {/* Actions row */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200/50">
                <button
                  type="button"
                  onClick={() => setFlaggingTxId(null)}
                  className="px-5 py-2.5 neumorphic-btn text-slate-700 hover:text-slate-950 rounded-xl transition cursor-pointer font-extrabold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!txFlagComment.trim()}
                  className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition ${!txFlagComment.trim()
                      ? 'neumorphic-inset bg-slate-200/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-white/80 dark:border-slate-700'
                      : 'neumorphic-btn bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white hover:text-sky-700 dark:hover:text-sky-300 cursor-pointer border border-white/80 dark:border-slate-700'
                    }`}
                >
                  Flag Repayment
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: ADMIN RESOLVING & CORRECTING LEDGER TRANSACTION AMOUNT */}
      {correctingTxId && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="neumorphic-card bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-xs flex flex-col border border-white/80 dark:border-slate-800"
          >
            {/* Header */}
            <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-white/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Edit3 size={15} className="text-slate-800 dark:text-white" /> Admin Ledger Correction Center
              </h3>
              <button
                type="button"
                onClick={() => setCorrectingTxId(null)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={(e) => { e.preventDefault(); submitTxCorrection(); }} className="p-6 space-y-4">
              <div>
                <p className="text-slate-700 dark:text-slate-200 mb-3 leading-relaxed">
                  As Admin, you can correct the ledger transaction or repayment amount. The difference will be reconciled with the credit account's outstanding balance instantly.
                </p>

                {/* Info about the item */}
                {(() => {
                  const targetTx = transactions.find(t => t.id === correctingTxId);
                  if (!targetTx) return null;
                  return (
                    <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#0f172a] border border-white/80 dark:border-slate-700 p-3.5 rounded-xl mb-4 space-y-1.5">
                      <p className="font-bold text-slate-900 dark:text-white">{targetTx.accountName}</p>
                      <div className="grid grid-cols-2 text-[10px] text-slate-500 dark:text-slate-300 font-mono">
                        <p>ID: {targetTx.id.slice(0, 10).toUpperCase()}</p>
                        <p className="text-right">Original Amount: <span className="font-extrabold text-slate-900 dark:text-white">{formatMoney(targetTx.amount)}</span></p>
                      </div>
                      <div className="neumorphic-inset bg-[#ebf0f7] dark:bg-[#111827] border border-white/80 dark:border-slate-700 p-2.5 rounded-xl text-[10.5px] text-slate-800 dark:text-slate-200">
                        <span className="font-bold text-slate-800 dark:text-white block uppercase text-[9px] mb-0.5">Attendant Comment:</span>
                        "{targetTx.flagComment}"
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">
                      New Corrected Amount ({config.currencySymbol}) *
                    </label>
                    <input
                      type="number"
                      required
                      placeholder="e.g. 5000"
                      value={correctedTxAmount}
                      onChange={(e) => setCorrectedTxAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="neumorphic-inset w-full text-xs rounded-xl border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#111827] text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-800 dark:text-white mb-1.5">
                      Correction Notes / Resolution Reason *
                    </label>
                    <textarea
                      required
                      placeholder="Explain how this ledger issue was resolved..."
                      value={txCorrectionNotes}
                      onChange={(e) => setTxCorrectionNotes(e.target.value)}
                      className="neumorphic-inset w-full text-xs rounded-xl border border-white/80 dark:border-slate-700 p-2.5 bg-[#ebf0f7] dark:bg-[#111827] text-slate-900 dark:text-white placeholder:text-slate-500 focus:outline-none h-20 resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Actions row */}
              <div className="flex justify-end gap-2 pt-3 border-t border-white/80 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCorrectingTxId(null)}
                  className="neumorphic-btn px-4 py-2 text-slate-800 dark:text-white rounded-xl transition cursor-pointer font-semibold text-[11px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctedTxAmount === '' || !txCorrectionNotes.trim()}
                  className={`px-4 py-2 rounded-md font-semibold text-[11px] transition ${correctedTxAmount === '' || !txCorrectionNotes.trim()
                      ? 'neumorphic-inset bg-slate-200/70 dark:bg-slate-900/70 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-white/80 dark:border-slate-700'
                      : 'neumorphic-btn text-slate-800 dark:text-white cursor-pointer'
                    }`}
                >
                  Save Correction & Resolve
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
