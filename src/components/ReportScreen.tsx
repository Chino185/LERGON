import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import { 
  TrendingUp, 
  TrendingDown,
  BarChart4, 
  Calendar, 
  CalendarDays,
  Zap,
  CreditCard,
  PackageX,
  Building2,
  PieChart as PieChartIcon,
  Download, 
  Copy, 
  Check, 
  PackageCheck, 
  DollarSign, 
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  History,
  Activity,
  Trash2,
  AlertCircle,
  Truck
} from 'lucide-react';
import MaterialIcon from './MaterialIcon';
import NeumorphicSelect, { NeumorphicSelectOption } from './NeumorphicSelect';
import { downloadCSV, formatCSVDate, formatCSVCurrency, formatCSVNumber } from '../utils/csvExporter';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  LineChart, 
  Line,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area
} from 'recharts';
import { InventoryItem, StockAdjustment, CreditAccount, CreditTransaction, BusinessConfig } from '../types';
import { motion, AnimatePresence } from 'motion/react';


interface ReportScreenProps {
  inventory: InventoryItem[];
  creditAccounts: CreditAccount[];
  config: BusinessConfig;
  adjustments?: StockAdjustment[];
  transactions?: CreditTransaction[];
  userRole?: number;
}

type ReportTabType = 'overview' | 'profit' | 'products' | 'credit_debt' | 'damages';

export default function ReportScreen({
  inventory = [],
  creditAccounts = [],
  config,
  adjustments = [],
  transactions = [],
  userRole
}: ReportScreenProps) {
  const [activeTab, setActiveTab] = useState<ReportTabType>('overview');

  useEffect(() => {
    if (userRole !== 2 && activeTab === 'profit') {
      setActiveTab('overview');
    }
  }, [userRole, activeTab]);
  const [copiedCSV, setCopiedCSV] = useState(false);
  const [copiedJSON, setCopiedJSON] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>('');

  const { formatAmount } = useCurrency();

  const formatMoney = (amount: number) => {
    return formatAmount(amount);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  // ==========================================================
  // HARD-FIDELITY DATA MUTATIONS & CALCULATION ENGINES
  // ==========================================================

  // --- 1. Helper Functions to identify credit sales ---
  const getLinkedAccount = (adj: StockAdjustment) => {
    if (adj.creditAccountId) {
      return creditAccounts.find(c => c.id === adj.creditAccountId);
    }
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

  const getCreditAccountPaidRatio = (account: CreditAccount | undefined | null) => {
    if (!account) return 0;
    if (account.totalAmount <= 0) return 1;
    const ratio = (account.totalAmount - account.remainingAmount) / account.totalAmount;
    return Math.max(0, Math.min(1, ratio));
  };

  // --- 2. Sales and Realized Profit Calculations ---
  const grossSalesTotal = useMemo(() => {
    return adjustments
      .filter(adj => adj.type === 'sale_out')
      .reduce((acc, adj) => {
        const item = inventory.find(i => i.id === adj.itemId);
        const price = item ? item.unitPrice : 0;
        return acc + (Math.abs(adj.qtyChanged) * price);
      }, 0);
  }, [adjustments, inventory]);

  const totalReceivablesValue = useMemo(() => {
    return creditAccounts
      .filter(a => a.type === 'receivable' && a.status !== 'settled')
      .reduce((acc, a) => acc + a.remainingAmount, 0);
  }, [creditAccounts]);

  const cashSalesReceived = useMemo(() => {
    return Math.max(0, grossSalesTotal - totalReceivablesValue);
  }, [grossSalesTotal, totalReceivablesValue]);

  const grossProfitPossible = useMemo(() => {
    return adjustments
      .filter(adj => adj.type === 'sale_out')
      .reduce((acc, adj) => {
        const item = inventory.find(i => i.id === adj.itemId);
        const margin = item ? (item.unitPrice - item.unitCost) : 0;
        return acc + (Math.abs(adj.qtyChanged) * margin);
      }, 0);
  }, [adjustments, inventory]);

  const realizedProfitTotal = useMemo(() => {
    return adjustments
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
            return acc; // unpaid portion generates no cash profit yet
          }
          return acc + totalProfitPossible;
        }
        return acc;
      }, 0);
  }, [adjustments, inventory, creditAccounts]);

  // --- 3. Restocks Calculations ---
  const restockMovements = useMemo(() => {
    return adjustments.filter(adj => adj.type === 'purchase_in');
  }, [adjustments]);

  const totalRestockEvents = restockMovements.length;
  const totalUnitsRestocked = restockMovements.reduce((acc, adj) => acc + Math.abs(adj.qtyChanged), 0);
  const totalRestockCapitalInvested = useMemo(() => {
    return restockMovements.reduce((acc, adj) => {
      const item = inventory.find(i => i.id === adj.itemId);
      const cost = item ? item.unitCost : 0;
      return acc + (Math.abs(adj.qtyChanged) * cost);
    }, 0);
  }, [restockMovements, inventory]);

  // --- 4. Damaged Stock Calculations ---
  const damagedAdjustments = useMemo(() => {
    return adjustments.filter(adj => adj.type === 'damaged');
  }, [adjustments]);

  const totalDamagedEvents = damagedAdjustments.length;
  const totalUnitsDamaged = damagedAdjustments.reduce((acc, adj) => acc + Math.abs(adj.qtyChanged), 0);
  const totalDamagedCostValue = useMemo(() => {
    return damagedAdjustments.reduce((acc, adj) => {
      const item = inventory.find(i => i.id === adj.itemId);
      const cost = item ? item.unitCost : 0;
      return acc + (Math.abs(adj.qtyChanged) * cost);
    }, 0);
  }, [damagedAdjustments, inventory]);

  // --- 5. Products Velocity & Movement Calculations ---
  const productSalesMap = useMemo(() => {
    const map: Record<string, { id: string; name: string; sku: string; category: string; qtySold: number; revenue: number; margin: number; salesCount: number }> = {};
    
    adjustments
      .filter(adj => adj.type === 'sale_out')
      .forEach(adj => {
        const item = inventory.find(i => i.id === adj.itemId);
        const qty = Math.abs(adj.qtyChanged);
        const price = item ? item.unitPrice : 0;
        const cost = item ? item.unitCost : 0;
        const revenue = qty * price;
        const margin = price - cost;
        
        const itemId = adj.itemId;
        if (!map[itemId]) {
          map[itemId] = {
            id: itemId,
            name: adj.itemName || (item ? item.name : 'Unknown Item'),
            sku: item ? item.sku : 'N/A',
            category: item ? item.category : 'N/A',
            qtySold: 0,
            revenue: 0,
            margin: 0,
            salesCount: 0
          };
        }
        map[itemId].qtySold += qty;
        map[itemId].revenue += revenue;
        map[itemId].margin += (margin * qty);
        map[itemId].salesCount += 1;
      });
      return map;
  }, [adjustments, inventory]);

  const productMovementList = useMemo(() => {
    const list = Object.values(productSalesMap) as Array<{
      id: string;
      name: string;
      sku: string;
      category: string;
      qtySold: number;
      revenue: number;
      margin: number;
      salesCount: number;
    }>;
    return list.sort((a, b) => b.qtySold - a.qtySold);
  }, [productSalesMap]);

  const topProductSold = productMovementList[0] || null;
  const fastMovingItems = productMovementList.slice(0, 5);

  const slowMovingItems = useMemo(() => {
    return inventory.map(item => {
      const saleData = productSalesMap[item.id];
      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        qtySold: saleData ? saleData.qtySold : 0,
        revenue: saleData ? saleData.revenue : 0,
        lastUpdated: item.lastUpdated
      };
    })
    .sort((a, b) => a.qtySold - b.qtySold)
    .slice(0, 5);
  }, [inventory, productSalesMap]);

  // --- 6. Credit & Debts Groups ---
  const outstandingGoodsOnCreditList = useMemo(() => {
    return creditAccounts
      .filter(a => a.type === 'receivable' && a.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [creditAccounts]);

  const suppliersIOweList = useMemo(() => {
    return creditAccounts
      .filter(a => a.type === 'payable' && a.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount);
  }, [creditAccounts]);

  const topPurchasersList = useMemo(() => {
    return creditAccounts
      .filter(a => a.type === 'receivable')
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [creditAccounts]);

  const topPurchaserItem = topPurchasersList[0] || null;

  // --- 7. Monthly Chronological Profit & Weekly Breakdown Map ---
  const monthlyDataMap = useMemo(() => {
    const map: Record<string, { monthKey: string; monthOrder: number; revenue: number; profit: number; salesCount: number; weeklyData: Record<string, { weekKey: string; revenue: number; profit: number }> }> = {};
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const salesListChronological = adjustments
      .filter(adj => adj.type === 'sale_out')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    salesListChronological.forEach(adj => {
      let d = new Date(adj.date);
      if (isNaN(d.getTime())) d = new Date();

      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthName = monthNames[monthIndex];
      const monthKey = `${monthName} ${year}`;
      const monthOrder = year * 12 + monthIndex;

      const item = inventory.find(i => i.id === adj.itemId);
      const qty = Math.abs(adj.qtyChanged);
      const price = item ? item.unitPrice : 0;
      const cost = item ? item.unitCost : 0;
      const revenue = qty * price;
      const margin = price - cost;
      const totalProfitPossible = qty * margin;

      const isCredit = isCreditAdjustment(adj);
      const account = isCredit ? getLinkedAccount(adj) : null;
      const paidRatio = isCredit ? getCreditAccountPaidRatio(account) : 1;
      const profitRealized = isCredit ? totalProfitPossible * paidRatio : totalProfitPossible;

      const day = d.getDate();
      let weekKey = 'Week 1';
      if (day > 21) weekKey = 'Week 4';
      else if (day > 14) weekKey = 'Week 3';
      else if (day > 7) weekKey = 'Week 2';

      if (!map[monthKey]) {
        map[monthKey] = {
          monthKey,
          monthOrder,
          revenue: 0,
          profit: 0,
          salesCount: 0,
          weeklyData: {
            'Week 1': { weekKey: 'Week 1', revenue: 0, profit: 0 },
            'Week 2': { weekKey: 'Week 2', revenue: 0, profit: 0 },
            'Week 3': { weekKey: 'Week 3', revenue: 0, profit: 0 },
            'Week 4': { weekKey: 'Week 4', revenue: 0, profit: 0 }
          }
        };
      }

      map[monthKey].revenue += revenue;
      map[monthKey].profit += profitRealized;
      map[monthKey].salesCount += 1;

      map[monthKey].weeklyData[weekKey].revenue += revenue;
      map[monthKey].weeklyData[weekKey].profit += profitRealized;
    });

    return map;
  }, [adjustments, inventory, creditAccounts]);

  const monthlyList = useMemo(() => {
    const list = Object.values(monthlyDataMap) as Array<{
      monthKey: string;
      monthOrder: number;
      revenue: number;
      profit: number;
      salesCount: number;
      weeklyData: Record<string, { weekKey: string; revenue: number; profit: number }>;
    }>;
    return list.sort((a, b) => a.monthOrder - b.monthOrder);
  }, [monthlyDataMap]);

  const defaultSelectedMonth = useMemo(() => {
    return monthlyList.length > 0 ? monthlyList[monthlyList.length - 1].monthKey : '';
  }, [monthlyList]);

  // Set selected month initially
  useEffect(() => {
    if (!selectedMonth && defaultSelectedMonth) {
      setSelectedMonth(defaultSelectedMonth);
    }
  }, [defaultSelectedMonth, selectedMonth]);

  const activeMonthData = monthlyDataMap[selectedMonth || defaultSelectedMonth];
  const weeklyChartData = activeMonthData 
    ? Object.values(activeMonthData.weeklyData) as Array<{ weekKey: string; revenue: number; profit: number }>
    : [
        { weekKey: 'Week 1', revenue: 0, profit: 0 },
        { weekKey: 'Week 2', revenue: 0, profit: 0 },
        { weekKey: 'Week 3', revenue: 0, profit: 0 },
        { weekKey: 'Week 4', revenue: 0, profit: 0 }
      ];

  // --- 8. Exports Formats ---
  const handleExportCSV = () => {
    const headers = ['Report Category', 'Metric Name', 'Calculated Value', 'Notes / Context'];
    const rows: (string | number)[][] = [
      ['Sales Overview', 'Total Gross Sales', formatCSVCurrency(grossSalesTotal, config.currencySymbol), 'All customer sales logged'],
      ['Sales Overview', 'Direct Cash Received', formatCSVCurrency(cashSalesReceived, config.currencySymbol), 'Actual cash collected from fully paid cash or credit payments'],
      ['Sales Overview', 'Uncollected Credit Sales', formatCSVCurrency(totalReceivablesValue, config.currencySymbol), 'Debts owed to us by customer targets'],
      ['Profit Audit', 'Realized Cash Profit', formatCSVCurrency(realizedProfitTotal, config.currencySymbol), 'Actual profits collected in cash'],
      ['Profit Audit', 'Gross Profit Potential', formatCSVCurrency(grossProfitPossible, config.currencySymbol), 'Markup profits potential'],
      ['Inventory Procurement', 'Total Restock Capital', formatCSVCurrency(totalRestockCapitalInvested, config.currencySymbol), 'Capital spent replenishing stock'],
      ['Inventory Procurement', 'Total Restock Order Events', formatCSVNumber(totalRestockEvents), 'Stock replenishment count'],
      ['Shrinkage Audit', 'Total Damaged Units', formatCSVNumber(totalUnitsDamaged), 'Damaged goods unit count'],
      ['Shrinkage Audit', 'Capital Damage Cost', formatCSVCurrency(totalDamagedCostValue, config.currencySymbol), 'Cost value of reported damaged assets']
    ];

    // Append Fast Moving Items section
    if (fastMovingItems.length > 0) {
      fastMovingItems.forEach(item => {
        rows.push([
          'Fast-Moving Product',
          item.name,
          formatCSVCurrency(item.revenue, config.currencySymbol),
          `SKU: ${item.sku} | Category: ${item.category} | Units Sold: ${formatCSVNumber(item.qtySold)}`
        ]);
      });
    }

    // Append Debtors section
    if (outstandingGoodsOnCreditList.length > 0) {
      outstandingGoodsOnCreditList.forEach(a => {
        rows.push([
          'Debtor Account',
          a.name,
          formatCSVCurrency(a.remainingAmount, config.currencySymbol),
          `Due Date: ${formatCSVDate(a.dueDate)} | Status: ${a.status.toUpperCase()}`
        ]);
      });
    }

    downloadCSV({
      filename: `financial_audit_report_${todayStr}.xlsx`,
      headers,
      rows
    });

    setCopiedCSV(true);
    setTimeout(() => setCopiedCSV(false), 2500);
  };

  const handleExportJSON = () => {
    const reportData = {
      meta: {
        exportedAt: new Date().toISOString(),
        currency: config.currencySymbol,
        businessName: config.businessName
      },
      financialSummary: {
        totalGrossSales: grossSalesTotal,
        directCashReceived: cashSalesReceived,
        ...(userRole === 2 ? {
          capitalProfitsRealized: realizedProfitTotal,
          totalSupplierPayables: suppliersIOweList.reduce((acc, a) => acc + a.remainingAmount, 0),
        } : {}),
        customerReceivablesOwed: totalReceivablesValue,
        supplierAcquisitionRestocksSpent: totalRestockCapitalInvested,
      },
      topPerformers: {
        topProductByVolume: topProductSold,
        fastMovingList: fastMovingItems,
        slowMovingList: slowMovingItems
      },
      ledgers: {
        debtorsOutstandingReceivables: outstandingGoodsOnCreditList,
        ...(userRole === 2 ? {
          creditorsSuppliersOwed: suppliersIOweList
        } : {})
      }
    };

    navigator.clipboard.writeText(JSON.stringify(reportData, null, 2));
    setCopiedJSON(true);
    setTimeout(() => setCopiedJSON(false), 2000);
  };

  return (
    <div id="report-screen" className="space-y-6">
      
      {/* Top Header Row (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display text-slate-900 tracking-tight flex items-center gap-2.5">
            <MaterialIcon name="pie_chart" size={24} className="text-slate-900" />
            <span>Operational & Financial Audit Report</span>
          </h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {userRole === 2
              ? "Realized profits, weekly velocities, moving product assets, credit collection ratios, and supplier liabilities."
              : "Realized profits, weekly velocities, moving product assets, and credit collection ratios."}
          </p>
        </div>
        
        {/* Dynamic Exports Panels */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 neumorphic-btn text-slate-900 rounded-full px-4.5 py-2 text-xs font-extrabold hover:text-black transition cursor-pointer"
          >
            {copiedCSV ? <Check size={14} /> : <FileSpreadsheet size={14} />}
            {copiedCSV ? 'Excel Downloaded!' : 'Export Financial Excel'}
          </button>
        </div>
      </div>

      {/* Segment Tabs (Finnova Pill Navbar Track) */}
      <div className="pill-nav-track inline-flex flex-wrap items-center gap-1.5 p-1.5">
        {[
          { id: 'overview', label: 'Financial Summary', icon: <MaterialIcon name="pie_chart" size={16} /> },
          ...(userRole === 2 ? [{ id: 'profit', label: 'Monthly/Weekly Profits', icon: <MaterialIcon name="calendar_month" size={16} /> }] : []),
          { id: 'products', label: 'Product Velocities', icon: <MaterialIcon name="bolt" size={16} /> },
          { id: 'credit_debt', label: 'Credit & Debts', icon: <MaterialIcon name="credit_card" size={16} /> },
          { id: 'damages', label: 'Damages & Shrinkage', icon: <MaterialIcon name="inventory_2" size={16} /> },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full transition cursor-pointer ${
              activeTab === tab.id 
                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-xs' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Active Tab Content with Fades */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          
          {/* ==========================================================
              TAB 1: FINANCIAL OVERVIEW SUMMARY
              ========================================================== */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              {/* Gross Stats Bento Layout */}
              <div className={`grid grid-cols-1 ${userRole === 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'} gap-5`}>
                
                {/* Sale Performance Cards */}
                <div className="finnova-card p-5 transition duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Total Sales (Gross)</span>
                    <span className="p-1 px-2.5 text-[9px] font-extrabold rounded-full neumorphic-inset text-slate-800">Cash + Credit</span>
                  </div>
                  <strong className="text-2xl font-black font-jakarta text-slate-900 block mt-2">{formatMoney(grossSalesTotal)}</strong>
                  <div className="mt-3 text-xs text-slate-600 flex justify-between">
                    <span>Direct Cash proceeds:</span>
                    <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(cashSalesReceived)}</strong>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-600 flex justify-between border-t border-slate-200/50 pt-1.5">
                    <span>Owed credit sales:</span>
                    <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(totalReceivablesValue)}</strong>
                  </div>
                </div>

                {/* Profit Statistics Cards */}
                {userRole === 2 && (
                  <div className="finnova-card p-5 transition duration-300">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Net Profit Made</span>
                      <span className="p-1 px-2.5 text-[9px] font-extrabold rounded-full neumorphic-inset text-slate-800">Cash Realized</span>
                    </div>
                    <strong className="text-2xl font-black font-jakarta text-slate-900 block mt-2">{formatMoney(realizedProfitTotal)}</strong>
                    <div className="mt-3 text-xs text-slate-600 flex justify-between">
                      <span>Gross markup potential:</span>
                      <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(grossProfitPossible)}</strong>
                    </div>
                    <div className="mt-1.5 text-xs text-slate-600 flex justify-between border-t border-slate-200/50 pt-1.5">
                      <span>Outstanding credit profit:</span>
                      <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(Math.max(0, grossProfitPossible - realizedProfitTotal))}</strong>
                    </div>
                  </div>
                )}

                {/* Acquisition/Procurement Stocks Card */}
                <div className={`finnova-card p-5 transition duration-300 ${userRole === 2 ? 'sm:col-span-2 lg:col-span-1' : ''}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 block">Inventory Capital Replenishment</span>
                    <span className="p-1 px-2.5 text-[9px] font-extrabold rounded-full neumorphic-inset text-slate-800">Restocks</span>
                  </div>
                  <strong className="text-2xl font-black font-jakarta text-slate-900 block mt-2">{formatMoney(totalRestockCapitalInvested)}</strong>
                  <div className="mt-3 text-xs text-slate-600 flex justify-between">
                    <span>Total restock events:</span>
                    <strong className="text-slate-900 font-jakarta font-extrabold">{totalRestockEvents} orders</strong>
                  </div>
                  <div className="mt-1.5 text-xs text-slate-600 flex justify-between border-t border-slate-200/50 pt-1.5">
                    <span>Total physical pieces:</span>
                    <strong className="text-slate-900 font-jakarta font-extrabold">{totalUnitsRestocked} units</strong>
                  </div>
                </div>

              </div>

              {/* Middle Breakdown Rows */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Quick Snapshot List */}
                <div className="finnova-card p-5 sm:p-6 space-y-4 lg:col-span-2">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5 border-b border-slate-200/50 pb-3">
                    <MaterialIcon name="bolt" size={20} className="text-slate-900" />
                    <span>Business Audit Balance Schedule</span>
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pt-1">
                    
                    <div className="space-y-2">
                      <div className="p-3.5 neumorphic-inset rounded-xl flex justify-between items-center">
                        <div>
                          <span className="font-extrabold block text-slate-900">Direct Cash Sales Proceeds</span>
                          <span className="text-[10px] text-slate-500">Cash deposited/collected</span>
                        </div>
                        <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(cashSalesReceived)}</strong>
                      </div>
                      
                      <div className="p-3.5 neumorphic-inset rounded-xl flex justify-between items-center">
                        <div>
                          <span className="font-extrabold block text-slate-900">Uncollected Customer Receivables</span>
                          <span className="text-[10px] text-slate-500">Outstanding goods on credit</span>
                        </div>
                        <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(totalReceivablesValue)}</strong>
                      </div>
                    </div>

                     <div className="space-y-2">
                      {userRole === 2 && (
                        <div className="p-3.5 neumorphic-inset rounded-xl flex justify-between items-center">
                          <div>
                            <span className="font-extrabold block text-slate-900">Supplier Credit Obligations</span>
                            <span className="text-[10px] text-slate-500">Bills & payables we owe</span>
                          </div>
                          <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(suppliersIOweList.reduce((acc, a) => acc + a.remainingAmount, 0))}</strong>
                        </div>
                      )}
                      
                      <div className="p-3.5 neumorphic-inset rounded-xl flex justify-between items-center">
                        <div>
                          <span className="font-extrabold block text-slate-900">Aggregate Stock Damages</span>
                          <span className="text-[10px] text-slate-500">Value of damaged shrinkage logs</span>
                        </div>
                        <strong className="text-slate-900 font-jakarta font-extrabold">{formatMoney(totalDamagedCostValue)}</strong>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Mini chart of financial asset makeup */}
                <div className="finnova-card p-5 flex flex-col justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 mb-1">Financial Inflow Share</h4>
                    <p className="text-[11px] text-slate-500">Revenue composition ratios (Paid Cash vs. Outstanding Credit)</p>
                  </div>
                  
                  <div className="h-44 my-2 flex items-center justify-center">
                    {grossSalesTotal > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Direct Cash Received', value: cashSalesReceived, fill: '#3b82f6' },
                              { name: 'Owed Customer Credit', value: totalReceivablesValue, fill: '#64748b' }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            <Cell fill="#3b82f6" />
                            <Cell fill="#64748b" />
                          </Pie>
                          <Tooltip formatter={(v) => formatMoney(v as number)} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-xs text-slate-400">No gross sales recorded to divide.</div>
                    )}
                  </div>

                  <div className="space-y-1.5 text-[11px] text-slate-700 border-t border-slate-200/50 pt-2.5">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-blue-500 rounded-xs" />
                        <span>Realized cash:</span>
                      </div>
                      <strong className="font-jakarta font-extrabold text-slate-900">{grossSalesTotal > 0 ? ((cashSalesReceived / grossSalesTotal) * 100).toFixed(0) : '0'}%</strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 bg-slate-500 rounded-xs" />
                        <span>Credit assets:</span>
                      </div>
                      <strong className="font-jakarta font-extrabold text-slate-900">{grossSalesTotal > 0 ? ((totalReceivablesValue / grossSalesTotal) * 100).toFixed(0) : '0'}%</strong>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

          {/* ==========================================================
              TAB 2: MONTHLY & WEEKLY PROFIT PERFORMANCE
              ========================================================== */}
          {userRole === 2 && activeTab === 'profit' && (
            <motion.div
              key="profit-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              
              {/* Monthly List Breakdown Trend chart */}
              <div className="finnova-card p-5 sm:p-6">
                <div className="flex justify-between items-center border-b border-slate-200/50 pb-3.5 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <MaterialIcon name="trending_up" size={20} className="text-slate-900" />
                      <span>Monthly Chronological Profitability</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Displays monthly cash revenues vs net realized profits accrued over time.</p>
                  </div>
                </div>

                <div className="h-64">
                  {monthlyList.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={monthlyList}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                          </linearGradient>
                          <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="monthKey" style={{ fontSize: '10px', fontWeight: 500 }} stroke="#94a3b8" />
                        <YAxis tickFormatter={(v) => `${config.currencySymbol}${v}`} style={{ fontSize: '10px' }} stroke="#94a3b8" />
                        <Tooltip formatter={(value) => [`${config.currencySymbol}${Number(value).toLocaleString()}`]} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                        <Area type="monotone" name="Monthly Revenue" dataKey="revenue" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" />
                        <Area type="monotone" name="Realized Net Profit" dataKey="profit" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorProfit)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400 neumorphic-inset rounded-xl">
                      No monthly Sales logs captured yet. Check the Dashboard to log paid sales.
                    </div>
                  )}
                </div>
              </div>

              {/* Weekly Performance breakdown mapping inside month */}
              <div className="finnova-card p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/50 pb-4 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                      <MaterialIcon name="calendar_month" size={20} className="text-slate-900" />
                      <span>Weekly Performance Breakdown</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">Approximates weekly profit metrics within the selected monthly schedule interval.</p>
                  </div>
                  
                  {/* Selector drop-down */}
                  {monthlyList.length > 0 && (
                    <div className="flex items-center gap-1.5 min-w-[170px]">
                      <span className="text-xs text-slate-500 font-semibold uppercase shrink-0">Browse Cycle:</span>
                      <NeumorphicSelect
                        value={selectedMonth || defaultSelectedMonth}
                        onChange={setSelectedMonth}
                        options={monthlyList.map(item => ({ value: item.monthKey, label: item.monthKey }))}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Weekly Chart */}
                  <div className="h-56 lg:col-span-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={weeklyChartData}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="weekKey" style={{ fontSize: '10px', fontWeight: 600 }} stroke="#94a3b8" />
                        <YAxis tickFormatter={(v) => `${config.currencySymbol}${v}`} style={{ fontSize: '10px' }} stroke="#94a3b8" />
                        <Tooltip formatter={(value) => `${config.currencySymbol}${Number(value).toLocaleString()}`} />
                        <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '5px' }} />
                        <Bar name="Weekly Revenue" dataKey="revenue" fill="#4f46e5" radius={[2, 2, 0, 0]} />
                        <Bar name="Weekly Profit" dataKey="profit" fill="#10b981" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Weekly numeric data table card */}
                  <div className="finnova-card p-5 flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-extrabold text-slate-400 tracking-wider">Viewing performance of</span>
                      <h4 className="text-sm font-extrabold text-indigo-900 mt-0.5">
                        {selectedMonth || defaultSelectedMonth || new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </h4>
                    </div>

                    <div className="my-3 space-y-2 text-xs text-slate-700">
                      {weeklyChartData.map((data) => (
                        <div key={data.weekKey} className="neumorphic-inset p-3 rounded-xl flex justify-between items-center gap-2">
                          <span className="font-extrabold text-slate-800">{data.weekKey}</span>
                          <div className="text-right">
                            <span className="block font-jakarta text-slate-900 font-bold">Sale: {formatMoney(data.revenue)}</span>
                            <span className="text-[10px] text-slate-700 font-extrabold font-jakarta">Profit: {formatMoney(data.profit)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 font-medium border-t border-slate-200/50 pt-2.5 leading-relaxed">
                      Weeks are grouped by calendar day milestones: Week 1 (Days 1–7), Week 2 (8–14), Week 3 (15–21), Week 4 (22+).
                    </div>
                  </div>

                </div>
              </div>

            </motion.div>
          )}

          {/* ==========================================================
              TAB 3: PRODUCT VELOCITIES & TURNOVER
              ========================================================== */}
          {activeTab === 'products' && (
            <motion.div
              key="products-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              
              {/* Product cards indicators */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Top Product Sold Card */}
                {topProductSold ? (
                  <div className="finnova-card p-5 transition duration-300">
                    <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider block">Top Product Sold (By Volume)</span>
                    <strong className="text-lg font-bold text-slate-900 block mt-1 leading-snug">{topProductSold.name}</strong>
                    
                    <div className="grid grid-cols-3 gap-3 border-t border-slate-200/50 mt-4 pt-3.5 text-xs text-slate-600">
                      <div>
                        <span>SKU / Category:</span>
                        <strong className="block text-slate-900 font-bold mt-0.5 truncate">{topProductSold.sku} ({topProductSold.category})</strong>
                      </div>
                      <div>
                        <span>Units Sold:</span>
                        <strong className="block text-slate-900 font-bold mt-0.5">{topProductSold.qtySold} pieces</strong>
                      </div>
                      <div>
                        <span>Gross Revenue:</span>
                        <strong className="block text-slate-900 font-bold mt-0.5 font-jakarta">{formatMoney(topProductSold.revenue)}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="neumorphic-inset rounded-xl p-5 flex items-center justify-center text-xs text-slate-400">
                    No top sold product catalogued yet.
                  </div>
                )}

                {/* Restocks Audit general panel */}
                <div className="finnova-card p-5 transition duration-300">
                  <span className="text-[10px] uppercase font-bold text-slate-700 tracking-wider block">Total Restocks Tracker</span>
                  <div className="flex justify-between items-end mt-1.5">
                    <div>
                      <strong className="text-xl font-extrabold text-slate-900 block font-jakarta">{formatMoney(totalRestockCapitalInvested)}</strong>
                      <span className="text-[10px] text-slate-500 block mt-0.5">Procurement purchase capital spent</span>
                    </div>
                    <div className="neumorphic-inset text-right p-1.5 px-3 rounded-full text-xs font-black text-slate-900">
                      {totalRestockEvents} deliveries
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-600 border-t border-slate-200/50 mt-4 pt-3.5">
                    <span>Total physical components stacked:</span>
                    <strong className="text-slate-900 font-bold">{totalUnitsRestocked} units</strong>
                  </div>
                </div>

              </div>

              {/* Fast Moving vs. Slow Moving items */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Fast Moving list */}
                <div className="finnova-card p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <MaterialIcon name="trending_up" size={18} className="text-slate-900" />
                      <span>Fast Moving Items (High Turnover)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Your top 5 catalog products ranked by highest physical volume sold.</p>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {fastMovingItems.map((item, index) => (
                      <div key={item.id} className="py-2.5 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full neumorphic-inset text-slate-800 font-bold font-jakarta text-[10px] flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span className="font-bold text-slate-900 truncate block">{item.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-jakarta block pl-6.5">SKU: {item.sku} • {item.category}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <strong className="block text-slate-950 font-jakarta font-bold">{item.qtySold} sold</strong>
                          <span className="text-[10px] text-slate-500 block font-jakarta">{formatMoney(item.revenue)}</span>
                        </div>
                      </div>
                    ))}
                    {fastMovingItems.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">No moving sales transactions found.</div>
                    )}
                  </div>
                </div>

                {/* Slow Moving list */}
                <div className="finnova-card p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <MaterialIcon name="trending_down" size={18} className="text-slate-900" />
                      <span>Slow Moving Items (Re-Action Needed)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Your catalog items with the lowest sales volumes, which may require promotions.</p>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {slowMovingItems.map((item, index) => (
                      <div key={item.id} className="py-2.5 flex justify-between items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full neumorphic-inset text-slate-800 font-bold font-jakarta text-[10px] flex items-center justify-center shrink-0">
                              {index + 1}
                            </span>
                            <span className="font-bold text-slate-800 truncate block">{item.name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-jakarta block pl-6.5">Qty Stock left: {item.quantity} pieces</span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="p-1 px-2.5 font-jakarta text-[9px] font-bold rounded-full neumorphic-inset text-slate-700">
                            {item.qtySold} sold
                          </span>
                        </div>
                      </div>
                    ))}
                    {slowMovingItems.length === 0 && (
                      <div className="py-8 text-center text-xs text-slate-400">All inventory items are moving correctly.</div>
                    )}
                  </div>
                </div>

              </div>

            </motion.div>
          )}

          {/* ==========================================================
              TAB 4: CREDIT AND DEBT ANALYSIS
              ========================================================== */}
          {activeTab === 'credit_debt' && (
            <motion.div
              key="credit_debt-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              
              {/* Highlight Cards */}
              <div className={`grid grid-cols-1 ${userRole === 2 ? 'md:grid-cols-2' : ''} gap-5`}>
                
                {/* Debtor Customers Sum */}
                <div className="finnova-card p-5 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-700 block tracking-wider">Total Outstanding Credit Assets</span>
                    <strong className="text-2xl font-black font-jakarta text-slate-900 mt-1 block">{formatMoney(totalReceivablesValue)}</strong>
                    <span className="text-[10px] text-slate-500 font-medium block mt-1">Owed to us by active credit boundaries</span>
                  </div>
                  <div className="w-12 h-12 neumorphic-circle text-slate-900 flex items-center justify-center shrink-0">
                    <MaterialIcon name="north_east" size={20} className="text-slate-900" />
                  </div>
                </div>

                {/* Supplier Payable Sum */}
                {userRole === 2 && (
                  <div className="finnova-card p-5 flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-700 block tracking-wider">Total Suppliers Payables I Owe</span>
                      <strong className="text-2xl font-black font-jakarta text-slate-900 mt-1 block">
                        {formatMoney(suppliersIOweList.reduce((acc, a) => acc + a.remainingAmount, 0))}
                      </strong>
                      <span className="text-[10px] text-slate-500 font-medium block mt-1">Outstanding warehouse liabilities to clear</span>
                    </div>
                    <div className="w-12 h-12 neumorphic-circle text-slate-900 flex items-center justify-center shrink-0">
                      <MaterialIcon name="south_east" size={20} className="text-slate-900" />
                    </div>
                  </div>
                )}

              </div>

              {/* Detailed Lists */}
              <div className={`grid grid-cols-1 ${userRole === 2 ? 'lg:grid-cols-2' : ''} gap-6`}>
                
                {/* Debtor Outstanding customers */}
                <div className="finnova-card p-5 space-y-4">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                      <MaterialIcon name="error_outline" size={18} className="text-slate-900" />
                      <span>Outstanding Goods on Credit (Debtors List)</span>
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">Active profiles of customers who have received goods on credit terms.</p>
                  </div>

                  <div className="divide-y divide-slate-100 text-xs">
                    {outstandingGoodsOnCreditList.map((a) => {
                      const dateDiff = new Date(a.dueDate).getTime() - new Date(todayStr).getTime();
                      const daysDiff = Math.ceil(dateDiff / (1000 * 60 * 60 * 24));
                      const isOverdue = daysDiff < 0;

                      return (
                        <div key={a.id} className="py-3 flex justify-between items-center gap-3">
                          <div className="min-w-0">
                            <span className="font-bold text-slate-950 block">{a.name}</span>
                            <span className="text-[10px] text-slate-500 block">Phone: {a.phone || 'N/A'}</span>
                            <span className="text-[10px] font-semibold text-slate-500 block mt-0.5">
                              Due: {a.dueDate} •{' '}
                              <strong className={isOverdue ? 'text-slate-900 font-bold' : 'text-slate-600'}>
                                {isOverdue ? 'OVERDUE' : `${daysDiff} days left`}
                              </strong>
                            </span>
                          </div>
                          
                          <div className="text-right shrink-0">
                            <strong className="block text-slate-900 font-jakarta font-extrabold">{formatMoney(a.remainingAmount)}</strong>
                            <span className="text-[10px] text-slate-500 block font-jakarta">Original: {formatMoney(a.totalAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                    {outstandingGoodsOnCreditList.length === 0 && (
                      <div className="py-12 text-center text-xs text-slate-400 neumorphic-inset rounded-xl">
                        No outstanding customer credit balances!
                      </div>
                    )}
                  </div>
                </div>

                {/* Suppliers accounts we owe */}
                {userRole === 2 && (
                  <div className="finnova-card p-5 space-y-4">
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                        <MaterialIcon name="domain" size={18} className="text-slate-900" />
                        <span>Looming Supplier Liabilities (Creditors)</span>
                      </h3>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">List of active liabilities where we purchased stock on credit from supplier accounts.</p>
                    </div>

                    <div className="divide-y divide-slate-100 text-xs">
                      {suppliersIOweList.map((s) => {
                        const dateDiff = new Date(s.dueDate).getTime() - new Date(todayStr).getTime();
                        const daysDiff = Math.ceil(dateDiff / (1000 * 60 * 60 * 24));
                        const isOverdue = daysDiff < 0;

                        return (
                          <div key={s.id} className="py-3 flex justify-between items-center gap-3">
                            <div className="min-w-0">
                              <span className="font-bold text-slate-950 block">{s.name}</span>
                              <span className="text-[10px] text-slate-500 block">Due Date: {s.dueDate}</span>
                              <span className="text-[10px] font-semibold text-slate-600 block mt-0.5 font-sans">
                                {isOverdue ? 'LATE LIABILITY' : `Liability due in ${daysDiff} days`}
                              </span>
                            </div>
                            
                            <div className="text-right shrink-0">
                              <strong className="block text-slate-900 font-jakarta font-bold">{formatMoney(s.remainingAmount)}</strong>
                              <span className="text-[10px] text-slate-500 block font-jakarta">Original: {formatMoney(s.totalAmount)}</span>
                            </div>
                          </div>
                        );
                      })}
                      {suppliersIOweList.length === 0 && (
                        <div className="py-12 text-center text-xs text-slate-400 neumorphic-inset rounded-xl">
                          Excellent: No supplier liabilities or debts outstanding!
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>

              {/* Top purchaser outline profile details */}
              {topPurchaserItem && (
                <div className="finnova-card p-5 sm:p-6 space-y-3">
                  <h4 className="text-xs uppercase font-extrabold text-slate-800 tracking-widest flex items-center gap-1.5"><MaterialIcon name="auto_awesome" size={16} className="text-slate-900" /><span>Peak Purchaser Customer Demographics</span></h4>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1 text-xs">
                    <div>
                      <span className="text-base font-extrabold text-slate-900">{topPurchaserItem.name}</span>
                      <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                        <span>Email Contact</span>: {topPurchaserItem.email || 'N/A'} <span className="mx-1.5 text-slate-300">•</span> <span>Cell</span>: {topPurchaserItem.phone || 'N/A'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                      <div className="neumorphic-inset p-3 px-4 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Lifetime Credit Logged</span>
                        <strong className="text-sm font-jakarta text-slate-900 font-bold">{formatMoney(topPurchaserItem.totalAmount)}</strong>
                      </div>
                      <div className="neumorphic-inset p-3 px-4 rounded-xl">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Repayments Clear</span>
                        <strong className="text-sm font-jakarta text-slate-900 font-bold">
                          {formatMoney(Math.max(0, topPurchaserItem.totalAmount - topPurchaserItem.remainingAmount))}
                        </strong>
                      </div>
                      <div className="neumorphic-inset p-3 px-4 rounded-xl col-span-2 sm:col-span-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase block">Present Balance Due</span>
                        <strong className="text-sm font-jakarta text-slate-900 font-bold">{formatMoney(topPurchaserItem.remainingAmount)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}

          {/* ==========================================================
              TAB 5: LOSSES & DAMAGES
              ========================================================== */}
          {activeTab === 'damages' && (
            <motion.div
              key="damages-panel"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              
              {/* Damaged stats bento */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                
                {/* Damaged units count card */}
                <div className="finnova-card p-5 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Units Rendered Damaged</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="text-2xl font-black font-jakarta text-slate-900">{totalUnitsDamaged}</strong>
                    <span className="text-xs text-slate-500 font-medium">pieces lost</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">Physical write-offs reported in safety logs</span>
                </div>

                {/* Capital losses count */}
                <div className="finnova-card p-5 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Acquisition Capital Shrinkage</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="text-2xl font-black font-jakarta text-slate-900">{formatMoney(totalDamagedCostValue)}</strong>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">Reckoned dynamically based on item cost prices</span>
                </div>

                {/* Damaged events frequency */}
                <div className="finnova-card p-5 flex flex-col justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Report Frequency Incidence</span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <strong className="text-2xl font-black font-jakarta text-slate-900">{totalDamagedEvents}</strong>
                    <span className="text-xs text-slate-500 font-medium">tickets filed</span>
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-2">Individual recorded damage incidents</span>
                </div>

              </div>

              {/* Damaged list items audit list table */}
              <div className="finnova-card p-5 sm:p-6 space-y-4">
                <div className="border-b border-slate-200/50 pb-3">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                    <MaterialIcon name="inventory_2" size={20} className="text-slate-900" />
                    <span>Damaged Stock Logs (Shrinkage Audit)</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Chronologically displays all reported physical item write-offs and breakage reports.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="neumorphic-table-header text-[10px] select-none">
                        <th className="p-3 w-32">Ticket Date</th>
                        <th className="p-3">Damaged Product Name</th>
                        <th className="p-3 text-right w-36">Units Scrapped</th>
                        {userRole === 2 && <th className="p-3 text-right w-44">Approx Capital Loss</th>}
                        <th className="p-3 min-w-[200px]">Operator Explanation Comments</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {damagedAdjustments.length === 0 ? (
                        <tr>
                          <td colSpan={userRole === 2 ? 5 : 4} className="p-8 text-center text-slate-400 font-medium">
                            Excellent! No stock damages or shrinkage tickets filed in store ledgers.
                          </td>
                        </tr>
                      ) : (
                        damagedAdjustments.map((adj) => {
                          const item = inventory.find(i => i.id === adj.itemId);
                          const cost = item ? item.unitCost : 0;
                          const loss = Math.abs(adj.qtyChanged) * cost;

                          return (
                            <tr key={adj.id} className="hover:bg-slate-200/20 transition border-b border-slate-100">
                              <td className="p-3 font-mono text-[10px] whitespace-nowrap">{adj.date.split('T')[0]}</td>
                              <td className="p-3 font-semibold text-slate-900">
                                {adj.itemName}
                                <span className="block text-[10px] text-slate-400 font-mono font-normal">ID: {adj.itemId}</span>
                              </td>
                              <td className="p-3 text-right font-mono text-red-600 font-bold whitespace-nowrap">
                                -{Math.abs(adj.qtyChanged)} pieces
                              </td>
                              {userRole === 2 && (
                                <td className="p-3 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                                  {formatMoney(loss)}
                                </td>
                              )}
                              <td className="p-3 text-slate-500 italic shrink-0 max-w-sm">
                                {adj.notes || 'No description filed by administrator.'}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}
