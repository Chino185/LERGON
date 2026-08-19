import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCurrency } from '../context/CurrencyContext';
import {
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  ArrowUpDown,
  ArrowDownCircle,
  ArrowUpCircle,
  HelpCircle,
  Package,
  Locate,
  ShoppingBag,
  RotateCcw,
  AlertTriangle,
  PackageX,
  FileDown,
  X,
  Activity,
  ClipboardList,
  Phone,
  ChevronDown,
  Check,
  PackageCheck,
  ShieldAlert,
  CheckCircle2,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { InventoryItem, StockAdjustment, BusinessConfig, PendingRestock } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { translate } from '../utils/translations';
import MaterialIcon from './MaterialIcon';
import { downloadCSV, formatCSVDateTime, formatCSVCurrency, formatCSVNumber } from '../utils/csvExporter';
import {
  subscribeToDamageReports,
  subscribeToRestockRequests,
  reportDamagedStockTransaction,
  subscribeToBusinessCategories,
  saveBusinessCategories,
  DamageReport
} from '../utils/inventoryServices';
import { sanitizeTextInput } from '../utils/securityValidation';
import { downloadExcel, formatExcelDateTime, formatExcelCurrency, formatExcelNumber } from '../utils/excelExporter';


interface InventoryScreenProps {
  inventory: InventoryItem[];
  adjustments: StockAdjustment[];
  config: BusinessConfig;
  businessId: string;
  userUid: string;
  onAddItem: (item: Omit<InventoryItem, 'id' | 'lastUpdated'>) => Promise<{ success: boolean; error?: string }> | any;
  onUpdateItem: (id: string, updates: Partial<InventoryItem>) => Promise<{ success: boolean; error?: string }> | any;
  onDeleteItem: (id: string) => void;
  onLogAdjustment: (itemId: string, qtyChanged: number, type: StockAdjustment['type'], notes: string) => void | Promise<{ success: boolean; error?: string }>;
  userRole?: number;
  pendingRestocks?: PendingRestock[];
  onVerifyRestock?: (id: string, adminQty: number, notes?: string, forceResolveValue?: number) => 'resolved_matched' | 'on_hold' | 'resolved_forced' | 'error';
  inventoryTabOverride?: 'active_stock' | 'damaged_audit' | 'restock_validations' | null;
  onClearInventoryTabOverride?: () => void;
}

function RestockVerificationRow({
  restock,
  onVerifyRestock,
  config
}: {
  key?: React.Key,
  restock: PendingRestock,
  onVerifyRestock?: (id: string, adminQty: number, notes?: string, forceResolveValue?: number) => 'resolved_matched' | 'on_hold' | 'resolved_forced' | 'error',
  config: BusinessConfig
}) {
  const [adminQty, setAdminQty] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Resolution states (when on_hold)
  const [resolvedQty, setResolvedQty] = useState<number | ''>('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [showResolutionForm, setShowResolutionForm] = useState(false);

  const handleSubmitVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminQty === '') {
      setErrorMsg('Please enter a count quantity.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');

    if (onVerifyRestock) {
      const result = onVerifyRestock(restock.id, Number(adminQty), notes);
      if (result === 'resolved_matched') {
        setSuccessMsg('Match successful! Stock quantities verified and added to system.');
      } else if (result === 'on_hold') {
        setErrorMsg('Discrepancy detected! This restock has been put On Hold. Please query the attendant.');
      }
    }
  };

  const handleResolveConflictSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (resolvedQty === '') {
      alert('Please enter the finalized resolved quantity.');
      return;
    }

    if (onVerifyRestock) {
      onVerifyRestock(restock.id, restock.adminInputQty || 0, resolutionNotes || 'Conflict resolved by Admin', Number(resolvedQty));
      alert('Discrepancy resolved successfully! Stock updated.');
    }
  };

  const formattedDate = new Date(restock.date).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const attendantPhone = config.phone || '';
  const cleanPhone = attendantPhone.replace(/\D/g, '');
  const whatsappMsg = `Hi ${restock.submittedBy || 'Attendant'},\n\nI noticed a discrepancy in your restock entry for *${restock.itemName}* on ${formattedDate}.\n\nYou submitted a restock of *${restock.attendantQty}* units, but my count is *${restock.adminInputQty || adminQty}* units.\n\nCan you please check what the problem is so we can resolve it? Thanks!`;
  const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappMsg)}`;

  const isOnHold = restock.status === 'on_hold';

  return (
    <div className={`p-4 border rounded-xl shadow-2xs transition ${isOnHold ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200 bg-slate-50/30'
      }`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Info Area */}
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className={`inline-block text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${isOnHold ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'
              }`}>
              {isOnHold ? 'ON HOLD' : 'PENDING'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">{formattedDate}</span>
          </div>
          <h4 className="text-sm font-bold text-slate-900">{restock.itemName}</h4>
          <p className="text-[11px] text-slate-500 font-medium">
            Submitted by: <strong className="text-slate-700">{restock.submittedBy}</strong>
          </p>
          {restock.attendantNotes && (
            <p className="text-[10.5px] text-slate-500 leading-relaxed italic bg-white/50 border border-slate-100 px-2 py-1 rounded mt-1 max-w-xl">
              &ldquo;{restock.attendantNotes}&rdquo;
            </p>
          )}
        </div>

        {/* Input/Action Area */}
        {!isOnHold ? (
          <form onSubmit={handleSubmitVerification} className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <div className="text-left w-full sm:w-auto">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Your Counted Qty</label>
              <input
                type="number"
                min="0"
                required
                placeholder="Counted pcs"
                value={adminQty}
                onChange={(e) => setAdminQty(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-28 rounded-lg border border-slate-300 p-2 bg-white text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-center"
              />
            </div>

            <div className="text-left w-full sm:w-auto">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Discrepancy Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Broken packages found"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-48 rounded-lg border border-slate-300 p-2 bg-white text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
              />
            </div>

            <button
              type="submit"
              className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer h-9 shrink-0 flex items-center justify-center gap-1"
            >
              Verify
            </button>
          </form>
        ) : (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            {/* On Hold Discrepancy details & Query Actions */}
            <div className="text-left bg-white p-3 border border-amber-200 rounded-lg max-w-sm space-y-1.5 shadow-3xs">
              <div className="text-[10px] font-extrabold text-amber-800 uppercase flex items-center gap-1">
                <AlertTriangle size={12} className="text-amber-500" /> Count Discrepancy Found!
              </div>
              <div className="text-[10.5px] text-slate-700 grid grid-cols-2 gap-x-2">
                <span>Attendant Logged:</span> <strong className="text-slate-900">{restock.attendantQty} pcs</strong>
                <span>Admin Logged:</span> <strong className="text-slate-900">{restock.adminInputQty} pcs</strong>
              </div>
              <div className="text-[10px] text-slate-500 truncate max-w-[240px]">
                {restock.discrepancyNotes}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {cleanPhone ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 text-center leading-none"
                >
                  <Phone size={12} /> Query Attendant
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => alert(`Attendant phone details:\n- Attendant: ${restock.attendantQty} pcs\n- Admin: ${restock.adminInputQty} pcs`)}
                  className="py-1.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 leading-none"
                >
                  Query Attendant
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowResolutionForm(!showResolutionForm)}
                className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer flex items-center justify-center gap-1.5 leading-none"
              >
                Resolve Discrepancy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Form Dropdown when clicked */}
      {isOnHold && showResolutionForm && (
        <motion.form
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleResolveConflictSubmit}
          className="mt-4 pt-4 border-t border-amber-200 grid grid-cols-1 md:grid-cols-3 gap-3 text-left"
        >
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Final Agreed Quantity</label>
            <input
              type="number"
              min="0"
              required
              placeholder="Correct quantity pcs"
              value={resolvedQty}
              onChange={(e) => setResolvedQty(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 p-2 bg-white text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 font-mono text-xs"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">Resolution / Correction Note</label>
            <input
              type="text"
              required
              placeholder="e.g. Attendant entered wrong product box size"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2 bg-white text-gray-900 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-xs"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition shadow-2xs cursor-pointer h-9 flex items-center justify-center gap-1"
            >
              Resolve & Approve Stock
            </button>
          </div>
        </motion.form>
      )}

      {/* Message feedback alerts */}
      {errorMsg && !isOnHold && (
        <p className="text-[10.5px] text-red-600 font-bold mt-2">{errorMsg}</p>
      )}
      {successMsg && (
        <p className="text-[10.5px] text-emerald-650 font-bold mt-2">{successMsg}</p>
      )}
    </div>
  );
}

export default function InventoryScreen({
  inventory,
  adjustments = [],
  config,
  businessId,
  userUid,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onLogAdjustment,
  userRole,
  pendingRestocks = [],
  onVerifyRestock,
  inventoryTabOverride,
  onClearInventoryTabOverride
}: InventoryScreenProps) {
  // Navigation tabs for the Inventory main viewport
  const [inventoryTab, setInventoryTab] = useState<'active_stock' | 'damaged_audit' | 'restock_validations'>('active_stock');

  React.useEffect(() => {
    if (inventoryTabOverride) {
      setInventoryTab(inventoryTabOverride);
      if (onClearInventoryTabOverride) {
        onClearInventoryTabOverride();
      }
    }
  }, [inventoryTabOverride, onClearInventoryTabOverride]);

  // Business ID and User ID now come directly from App.tsx (sourced
  // from the authenticated Supabase session) instead of being guessed
  // from the config object.

  // Damage reports and restock requests are only subscribed here (no
  // duplicate elsewhere), so they keep their own realtime stream.
  // Inventory itself is NOT re-subscribed here: App.tsx already owns a
  // live Supabase Realtime subscription for inventory_items AND performs
  // an optimistic local update the instant an item is added, so items
  // show up immediately. A second subscription here used to fight over
  // the same Realtime channel name (inventory_${businessId}), tearing
  // down App.tsx's channel and forcing this screen to wait on its own
  // round trip before new items appeared.
  const [realtimeDamageReports, setRealtimeDamageReports] = useState<DamageReport[] | null>(null);
  const [realtimeRestocks, setRealtimeRestocks] = useState<PendingRestock[] | null>(null);

  useEffect(() => {
    if (!businessId || businessId === 'default') return;

    const unsubDamages = subscribeToDamageReports(businessId, (reports) => {
      setRealtimeDamageReports(reports);
    });

    const unsubRestocks = subscribeToRestockRequests(businessId, (restocks) => {
      setRealtimeRestocks(restocks);
    });

    return () => {
      unsubDamages();
      unsubRestocks();
    };
  }, [businessId]);

  const activeInventory = inventory;
  const activePendingRestocks = realtimeRestocks !== null ? realtimeRestocks : pendingRestocks;

  const pendingCount = useMemo(() => {
    return activePendingRestocks?.filter(r => r.status === 'pending').length || 0;
  }, [activePendingRestocks]);

  // Lists, filters, search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);
  const [stockStatus, setStockStatus] = useState<'All' | 'Low Stock' | 'Out of Stock'>('All');

  const [damageSearchQuery, setDamageSearchQuery] = useState('');
  const [damageDateFilter, setDamageDateFilter] = useState('all');
  const [dateDropdownOpen, setDateDropdownOpen] = useState(false);
  const dateDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
        setCategoryDropdownOpen(false);
      }
      if (dateDropdownRef.current && !dateDropdownRef.current.contains(e.target as Node)) {
        setDateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sort state
  const [sortBy, setSortBy] = useState<'name' | 'quantity' | 'value'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Modals state
  const [showAddEditModal, setShowAddEditModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Adjustment Modal state
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustItemId, setAdjustItemId] = useState<string | null>(null);
  const [qtyChangeAmt, setQtyChangeAmt] = useState<number | ''>('');
  const [adjustType, setAdjustType] = useState<StockAdjustment['type']>('purchase_in');
  const [adjustNotes, setAdjustNotes] = useState('');

  // Specialized Damage Reporting Modal state
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageItemId, setDamageItemId] = useState('');
  const [damageQty, setDamageQty] = useState<number | ''>('');
  const [damageNotes, setDamageNotes] = useState('');

  // Form states for Add/Edit
  const [itemName, setItemName] = useState('');
  const [itemSku, setItemSku] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [businessCategories, setBusinessCategories] = useState<string[]>([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [itemQty, setItemQty] = useState<number | ''>('');
  const [itemCost, setItemCost] = useState<number | ''>('');
  const [itemPrice, setItemPrice] = useState<number | ''>('');
  const [itemReorder, setItemReorder] = useState<number | ''>('');
  const [itemSupplier, setItemSupplier] = useState('');
  const [itemLocation, setItemLocation] = useState('');
  const [itemNotes, setItemNotes] = useState('');

  // Loading & Error Feedback states for Save Product action
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [itemSaveError, setItemSaveError] = useState<string | null>(null);

  // Subscribe to live custom categories from Supabase
  useEffect(() => {
    if (!businessId) return;
    const unsubscribe = subscribeToBusinessCategories(businessId, (cats) => {
      setBusinessCategories(cats || []);
    });
    return () => {
      unsubscribe();
    };
  }, [businessId]);

  const allAvailableCategories = useMemo(() => {
    const fromItems = activeInventory.map(item => item.category?.trim()).filter(Boolean);
    return Array.from(new Set([...businessCategories, ...fromItems]));
  }, [businessCategories, activeInventory]);

  const handleCreateCategory = async (catName: string) => {
    const trimmed = sanitizeTextInput(catName, 60).trim();
    if (!trimmed) return;
    if (!businessId) {
      setItemSaveError('Business ID is unavailable. Please sign in again before adding a category.');
      return;
    }
    if (businessCategories.some(category => category.toLowerCase() === trimmed.toLowerCase())) {
      setItemCategory(businessCategories.find(category => category.toLowerCase() === trimmed.toLowerCase()) || trimmed);
      setNewCategoryInput('');
      setIsAddingNewCategory(false);
      return;
    }

    const previous = businessCategories;
    const updated = [...businessCategories, trimmed];
    setItemSaveError(null);

    const result = await saveBusinessCategories(businessId, updated);
    if (!result.success) {
      setBusinessCategories(previous);
      setNewCategoryInput(trimmed);
      setIsAddingNewCategory(true);
      setItemSaveError(result.error || 'Failed to save custom category. Apply the custom-categories migration and try again.');
      return;
    }

    setBusinessCategories(updated);
    setItemCategory(trimmed);
    setNewCategoryInput('');
    setIsAddingNewCategory(false);
  };

  const handleDeleteCategory = async (catToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const previous = businessCategories;
    const updated = businessCategories.filter(c => c !== catToDelete);
    setBusinessCategories(updated);
    if (itemCategory === catToDelete) {
      setItemCategory(updated[0] || '');
    }

    if (businessId) {
      const result = await saveBusinessCategories(businessId, updated);
      if (!result.success) {
        setBusinessCategories(previous);
        setItemCategory(catToDelete);
        setItemSaveError(result.error || 'Failed to delete custom category.');
      }
    }
  };

  const { formatAmount, convertFromBase, convertToBase } = useCurrency();
  // Round a converted currency amount to 2 decimal places so the edit form
  // always shows the same figure as the inventory table (which is formatted
  // with formatCurrencyAmount's 2 dp rounding).
  const roundMoney = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;

  const formatMoney = (amount: number) => {
    return formatAmount(amount);
  };

  useEffect(() => {
    if (selectedCategory !== 'All' && !allAvailableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [allAvailableCategories, selectedCategory]);

  // 1. Gather Unique Categories for lookup dropdown
  const categoriesList = ['All', ...allAvailableCategories];

  // 2. Filter logic
  const filteredItems = activeInventory.filter(item => {
    // Search query
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.supplier && item.supplier.toLowerCase().includes(searchTerm.toLowerCase()));

    // Category match
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    // Stock Status
    let matchesStatus = true;
    if (stockStatus === 'Low Stock') {
      matchesStatus = item.quantity <= item.reorderPoint && item.quantity > 0;
    } else if (stockStatus === 'Out of Stock') {
      matchesStatus = item.quantity === 0;
    }

    return matchesSearch && matchesCategory && matchesStatus;
  });

  // 3. Sorting
  const sortedItems = [...filteredItems].sort((a, b) => {
    let propA: any = a.name.toLowerCase();
    let propB: any = b.name.toLowerCase();

    if (sortBy === 'quantity') {
      propA = a.quantity;
      propB = b.quantity;
    } else if (sortBy === 'value') {
      propA = a.quantity * a.unitPrice;
      propB = b.quantity * b.unitPrice;
    }

    if (propA < propB) return sortOrder === 'asc' ? -1 : 1;
    if (propA > propB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSort = (field: 'name' | 'quantity' | 'value') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  // 4. Open Modal for Add
  const handleOpenAdd = () => {
    setEditingItemId(null);
    setItemName('');
    setItemSku(`SKU-${Math.floor(Math.random() * 90000) + 10000}`);
    setItemCategory(allAvailableCategories[0] || '');
    setIsCategoryDropdownOpen(false);
    setIsAddingNewCategory(false);
    setNewCategoryInput('');
    setItemQty(5);
    setItemCost(roundMoney(convertFromBase(10)));
    setItemPrice(roundMoney(convertFromBase(20)));
    setItemReorder(config.lowStockThresholdDefault || 5);
    setItemSupplier('');
    setItemLocation('');
    setItemNotes('');
    setItemSaveError(null);
    setIsSavingItem(false);
    setShowAddEditModal(true);
  };

  // 5. Open Modal for Edit
  const handleOpenEdit = (item: InventoryItem) => {
    setEditingItemId(item.id);
    setItemName(item.name);
    setItemSku(item.sku);
    setItemCategory(item.category);
    setItemQty(item.quantity);
    setItemCost(roundMoney(convertFromBase(item.unitCost)));
    setItemPrice(roundMoney(convertFromBase(item.unitPrice)));
    setItemReorder(item.reorderPoint);
    setItemSupplier(item.supplier || '');
    setItemLocation(item.location || '');
    setItemNotes(item.notes || '');
    setItemSaveError(null);
    setIsSavingItem(false);
    setShowAddEditModal(true);
  };

  // 6. Save Add / Edit (With SKU Uniqueness & Input Sanitization)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setItemSaveError(null);

    const cleanTitle = sanitizeTextInput(itemName, 200);
    const cleanSkuStr = sanitizeTextInput(itemSku, 100).toUpperCase();
    const cleanCategory = sanitizeTextInput(itemCategory, 100).trim();

    if (!cleanTitle) {
      setItemSaveError('Please fill out the product title.');
      return;
    }

    if (!cleanSkuStr) {
      setItemSaveError('Please fill out the Stock SKU.');
      return;
    }

    if (!cleanCategory) {
      setItemSaveError('Create or select a custom category before saving this item.');
      return;
    }

    setIsSavingItem(true);

    try {
      const itemPayload = {
        name: cleanTitle,
        sku: cleanSkuStr,
        category: cleanCategory,
        quantity: itemQty === '' ? 0 : Number(itemQty),
        unitCost: userRole === 2 ? (itemCost === '' ? 0 : convertToBase(Number(itemCost))) : 0,
        unitPrice: userRole === 2 ? (itemPrice === '' ? 0 : convertToBase(Number(itemPrice))) : 0,
        reorderPoint: userRole === 2 ? (itemReorder === '' ? 5 : Number(itemReorder)) : 5,
        supplier: sanitizeTextInput(itemSupplier, 200),
        location: sanitizeTextInput(itemLocation, 200),
        notes: sanitizeTextInput(itemNotes, 1000)
      };

      // Route through the onAddItem/onUpdateItem props (owned by App.tsx)
      // instead of calling saveInventoryItem directly. Those handlers
      // already perform an optimistic local state update immediately
      // after a successful save, so the new/edited item appears in the
      // UI right away instead of waiting on the realtime subscription
      // to round-trip.
      const result = editingItemId
        ? await onUpdateItem(editingItemId, itemPayload as any)
        : await onAddItem(itemPayload as any);

      // onAddItem returns {success: false, error} on failure.
      // onUpdateItem currently returns a plain `false` on failure instead —
      // handle both shapes so a failed update isn't silently treated as success.
      const failed = result === false || (result && result.success === false);
      if (failed) {
        const errMsg = (result && typeof result === 'object' && result.error) || 'Failed to save product.';
        setItemSaveError(errMsg);
        return;
      }

      setShowAddEditModal(false);
    } catch (err: any) {
      console.error('[SAVE ITEM EXCEPTION]', err);
      setItemSaveError(err?.message || 'An unexpected error occurred while saving.');
    } finally {
      setIsSavingItem(false);
    }
  };

  // 7. Open Stock Adjust
  const handleOpenAdjust = (item: InventoryItem) => {
    setAdjustItemId(item.id);
    setQtyChangeAmt('');
    setAdjustType('purchase_in');
    setAdjustNotes('');
    setShowAdjustModal(true);
  };

  // 8. Submit Adjust
  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItemId || qtyChangeAmt === '') return;

    const item = activeInventory.find(i => i.id === adjustItemId);
    if (!item) return;

    const amt = Number(qtyChangeAmt);
    const isOutflow = ['sale_out', 'damaged'].includes(adjustType);
    const finalChange = isOutflow ? -Math.abs(amt) : Math.abs(amt);

    if (isOutflow && item.quantity < Math.abs(finalChange)) {
      alert(`${translate('insufficient stock!', config.languageCode)} ${translate('quantity available', config.languageCode)}: ${item.quantity}. ${translate('requested', config.languageCode)}: ${Math.abs(finalChange)}.`);
      return;
    }

    const result = await onLogAdjustment(adjustItemId, finalChange, adjustType, adjustNotes || translate('manual adjustment log', config.languageCode));
    if (result && !result.success) return;
    setShowAdjustModal(false);
  };

  // 9. Delete item safely
  const handleDeleteCheck = (id: string, name: string) => {
    if (userRole === 5) {
      alert("Unauthorized Access: Deleting items from physical stock lists is restricted to Admin operators (Role Level 2) only.");
      return;
    }
    if (confirm(`${translate('are you sure you want to delete', config.languageCode)} "${name}" ${translate('from inventory? this action cannot be undone.', config.languageCode)}`)) {
      onDeleteItem(id);
    }
  };

  // 10. Damage Reporting Handlers & Calculations for auditing sake
  const handleOpenDamageReport = (item?: InventoryItem) => {
    setDamageItemId(item?.id || activeInventory[0]?.id || '');
    setDamageQty('');
    setDamageNotes('');
    setShowDamageModal(true);
  };

  const handleSaveDamageReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!damageItemId || damageQty === '') {
      alert(translate('please select a product and enter the quantity.', config.languageCode));
      return;
    }

    const item = activeInventory.find(i => i.id === damageItemId);
    if (!item) return;

    const qty = Number(damageQty);
    if (qty <= 0) {
      alert(translate('damage quantity must be greater than zero.', config.languageCode));
      return;
    }

    if (item.quantity < qty) {
      alert(`${translate('insufficient stock!', config.languageCode)} ${translate('quantity available', config.languageCode)}: ${item.quantity} ${translate('units', config.languageCode)}. ${translate('requested damage claim', config.languageCode)}: ${qty} ${translate('units', config.languageCode)}.`);
      return;
    }

    const justification = damageNotes.trim() || translate('unsupervised damage recorded in inventory audit', config.languageCode);

    // Execute atomic Firestore transaction
    const result = await reportDamagedStockTransaction(businessId, userUid, userRole, {
      itemId: damageItemId,
      productTitle: item.name,
      quantityDamaged: qty,
      justificationText: justification
    });

    if (!result.success) {
      alert(result.error || 'Failed to record damaged stock.');
      return;
    }

    // The atomic RPC already decremented stock and recorded the damage report;
    // realtime subscriptions refresh inventory and audit state.
    setShowDamageModal(false);
  };

  // Memoized all damaged logs
  const damagedLogs = useMemo(() => {
    if (realtimeDamageReports !== null && realtimeDamageReports.length > 0) {
      return realtimeDamageReports.map(rep => ({
        id: rep.id,
        itemId: rep.product_ref,
        itemName: rep.product_title,
        qtyChanged: -rep.quantity_damaged,
        type: 'damaged' as const,
        date: rep.timestamp,
        notes: rep.justification_text,
        cost_price: rep.cost_price,
        selling_price: rep.selling_price,
        product_title: rep.product_title,
        quantity_damaged: rep.quantity_damaged,
        justification_text: rep.justification_text,
        timestamp: rep.timestamp,
        sku: ''
      }));
    }
    return adjustments.filter(adj => adj.type === 'damaged');
  }, [realtimeDamageReports, adjustments]);

  // Memoized filtered damaged logs
  const filteredDamagedLogs = useMemo(() => {
    return damagedLogs.filter(log => {
      const q = damageSearchQuery.toLowerCase();
      const matchesSearch = log.itemName.toLowerCase().includes(q) ||
        (log.notes || '').toLowerCase().includes(q) ||
        log.itemId.toLowerCase().includes(q);

      let matchesDate = true;
      if (damageDateFilter !== 'all') {
        const logDate = new Date(log.date);
        const now = new Date();
        const diffMs = now.getTime() - logDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (damageDateFilter === 'today') {
          matchesDate = diffDays <= 1;
        } else if (damageDateFilter === '7days') {
          matchesDate = diffDays <= 7;
        } else if (damageDateFilter === '30days') {
          matchesDate = diffDays <= 30;
        }
      }
      return matchesSearch && matchesDate;
    });
  }, [damagedLogs, damageSearchQuery, damageDateFilter]);

  // Compute Total Damage Loss Financial Totals for auditing sake
  const damageMetrics = useMemo(() => {
    let totalQty = 0;
    let totalCostLoss = 0;
    let totalRetailLoss = 0;

    damagedLogs.forEach(log => {
      const item = activeInventory.find(i => i.id === log.itemId);
      const cost = item ? item.unitCost : (log.cost_price || 0);
      const price = item ? item.unitPrice : (log.selling_price || 0);

      const qtyChangedAbs = Math.abs(log.quantity_damaged || log.qtyChanged || 0);
      totalQty += qtyChangedAbs;
      totalCostLoss += (qtyChangedAbs * cost);
      totalRetailLoss += (qtyChangedAbs * price);
    });

    return {
      totalQty,
      totalCostLoss,
      totalRetailLoss
    };
  }, [damagedLogs, activeInventory]);

  const handleExportDamagesCSV = () => {
    const headers = ['Damage ID', 'Product Name', 'SKU', 'Date Logged', 'Units Damaged', 'Unit Cost', 'Capital Loss Value (Sunk Cost)', 'Unit Selling Price', 'Revenue Loss Value (Potential Retail)', 'Audit Justification'];
    const rows = filteredDamagedLogs.map(log => {
      const item = activeInventory.find(i => i.id === log.itemId);
      const cost = item ? item.unitCost : (log.cost_price || 0);
      const price = item ? item.unitPrice : (log.selling_price || 0);
      const qty = Math.abs(log.quantity_damaged || log.qtyChanged || 0);

      return [
        log.id,
        log.product_title || log.itemName,
        item?.sku || log.sku || 'N/A',
        formatExcelDateTime(log.timestamp || log.date),
        formatExcelNumber(qty),
        formatExcelCurrency(cost, config.currencySymbol),
        formatExcelCurrency(qty * cost, config.currencySymbol),
        formatExcelCurrency(price, config.currencySymbol),
        formatExcelCurrency(qty * price, config.currencySymbol),
        log.justification_text || log.notes || ''
      ];
    });

    downloadExcel({
      filename: `damaged-goods-audit-report-${new Date().toISOString().split('T')[0]}.xlsx`,
      sheetName: 'Damaged Goods Audit Log',
      headers,
      rows
    });
  };

  return (

    <div id="inventory-screen" className="space-y-6">
      {/* Page Header (Crextio & Finnova Aesthetic) */}
      <div className="finnova-card p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">{translate('stock inventory ledger', config.languageCode)}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{translate('track levels, spots, and record damaged stock for high-fidelity auditing.', config.languageCode)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Main Action: Report Damaged Stock */}
          {userRole !== 5 && (
            <button
              type="button"
              id="btn-report-damaged-trigger"
              onClick={() => handleOpenDamageReport()}
              className="flex items-center gap-1.5 neumorphic-btn text-slate-900 rounded-full px-4.5 py-2 text-xs font-extrabold cursor-pointer transition hover:text-black"
            >
              <PackageX size={14} className="text-slate-800" /> {translate('report damaged stock', config.languageCode)}
            </button>
          )}

          {/* Main Action: Create Inventory Item */}
          {userRole !== 5 && (
            <button
              type="button"
              id="btn-add-item-trigger"
              onClick={handleOpenAdd}
              className="flex items-center gap-1.5 neumorphic-btn text-slate-900 rounded-full px-4.5 py-2 text-xs font-black cursor-pointer transition hover:text-black"
            >
              <Plus size={15} /> {translate('create inventory item', config.languageCode)}
            </button>
          )}
        </div>
      </div>

      {/* Pill Tab Selector: Active Inventory vs Damaged Auditing Log vs Restock Validations */}
      <div className="pill-nav-track inline-flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setInventoryTab('active_stock')}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition cursor-pointer ${inventoryTab === 'active_stock'
            ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-md shadow-sky-500/25'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          {translate('active store stock', config.languageCode)}
        </button>
        <button
          type="button"
          onClick={() => setInventoryTab('damaged_audit')}
          className={`px-4 py-1.5 text-xs font-bold rounded-full transition cursor-pointer flex items-center gap-1.5 ${inventoryTab === 'damaged_audit'
            ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-md shadow-sky-500/25'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
        >
          <span>{translate('damaged auditing log', config.languageCode)}</span>
          {damagedLogs.length > 0 && (
            <span className="bg-slate-100 text-slate-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold">
              {damagedLogs.length}
            </span>
          )}
        </button>
        {userRole === 2 && (
          <button
            type="button"
            onClick={() => setInventoryTab('restock_validations')}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition cursor-pointer flex items-center gap-1.5 ${inventoryTab === 'restock_validations'
              ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold shadow-md shadow-sky-500/25'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <span>Restock Validations</span>
            {pendingCount > 0 && (
              <span className="bg-amber-100 text-amber-900 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* TAB 1: ACTIVE INVENTORY VIEW */}
      {inventoryTab === 'active_stock' && (
        <>
          {/* Searching and Filter Widgets */}
          <div className="finnova-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder={translate('search by name, sku, or supplier', config.languageCode) + '...'}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full text-xs text-slate-900 rounded-full pl-9 pr-4 py-2 neumorphic-inset focus:outline-hidden transition font-medium"
                />
              </div>

              {/* Category Filter - Custom Neumorphic Dropdown */}
              <div className="flex items-center gap-2 relative" ref={categoryDropdownRef}>
                <MaterialIcon name="filter_alt" size={16} className="text-slate-800 shrink-0" />
                <button
                  type="button"
                  onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                  className="text-xs text-slate-900 rounded-full px-4 py-2 neumorphic-btn focus:outline-hidden transition font-extrabold flex items-center gap-2.5 cursor-pointer border border-white/80 hover:text-black"
                >
                  <span>
                    {selectedCategory === 'All'
                      ? translate('all', config.languageCode)
                      : translate(selectedCategory.toLowerCase(), config.languageCode)} ({translate('category', config.languageCode)})
                  </span>
                  <ChevronDown
                    size={14}
                    className={`text-slate-700 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180 text-blue-600' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {categoryDropdownOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.96 }}
                      animate={{ opacity: 1, y: 4, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.96 }}
                      transition={{ duration: 0.15, ease: 'easeOut' }}
                      className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl bg-[#ebf0f7] p-2 shadow-xl border border-white/90 z-50 overflow-hidden font-sans"
                      style={{ boxShadow: '6px 6px 18px #cbd3e1, -6px -6px 18px #ffffff' }}
                    >
                      <div className="max-h-60 overflow-y-auto space-y-1 p-0.5">
                        {categoriesList.map(cat => {
                          const isSelected = selectedCategory === cat;
                          const label = cat === 'All'
                            ? translate('all', config.languageCode)
                            : translate(String(cat).toLowerCase(), config.languageCode);


                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setSelectedCategory(cat);
                                setCategoryDropdownOpen(false);
                              }}
                              className={`w-full text-left text-xs px-3.5 py-2.5 rounded-xl font-extrabold transition flex items-center justify-between cursor-pointer ${isSelected
                                ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                                : 'text-slate-800 hover:bg-slate-200/70 hover:text-black'
                                }`}
                            >
                              <span>{label} ({translate('category', config.languageCode)})</span>
                              {isSelected && <Check size={14} className="text-white shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Smart Status Tabs */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200/40 pt-3">
              <span className="text-xs text-gray-500 mr-2 font-medium">{translate('stock filter', config.languageCode)} :</span>
              {(['All', 'Low Stock', 'Out of Stock'] as const).map(tab => {
                const count = tab === 'All'
                  ? inventory.length
                  : tab === 'Low Stock'
                    ? inventory.filter(i => i.quantity <= i.reorderPoint && i.quantity > 0).length
                    : inventory.filter(i => i.quantity === 0).length;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setStockStatus(tab)}
                    className={`text-xs px-3.5 py-1.5 rounded-full font-extrabold transition cursor-pointer ${stockStatus === tab
                      ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border-none'
                      : 'neumorphic-btn text-slate-800 hover:text-black'
                      }`}
                  >
                    {tab === 'All'
                      ? translate('all', config.languageCode)
                      : tab === 'Low Stock'
                        ? translate('low stock', config.languageCode)
                        : translate('out of stock', config.languageCode)}{' '}
                    <span className={stockStatus === tab ? 'text-white/90 font-mono text-[10.5px] ml-0.5' : 'text-slate-600 font-mono text-[10.5px] ml-0.5'}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Inventory Item Display (Desktop Table + Mobile Cards) */}
          <div className="finnova-card p-3 overflow-hidden">
            {/* Desktop View Table */}
            <div className="hidden lg:block overflow-x-auto text-gray-900">
              <table className="w-full text-left border-collapse table-fixed text-xs">
                <thead>
                  <tr className="neumorphic-table-header text-[10px] select-none">
                    <th className={`py-3 px-3 text-center cursor-pointer hover:bg-slate-200/70 transition ${userRole === 2 ? 'w-[22%]' : 'w-[30%]'}`} onClick={() => toggleSort('name')}>
                      <span className="flex items-center justify-center gap-1.5">
                        {translate('product detail', config.languageCode)} {sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                    <th className={`py-3 px-3 text-center ${userRole === 2 ? 'w-[13%]' : 'w-[16%]'}`}>{translate('category', config.languageCode)}</th>
                    <th className={`py-3 px-3 text-center cursor-pointer hover:bg-slate-200/70 transition ${userRole === 2 ? 'w-[11%]' : 'w-[14%]'}`} onClick={() => toggleSort('quantity')}>
                      <span className="flex items-center justify-center gap-1.5">
                        {translate('qty in hand', config.languageCode)} {sortBy === 'quantity' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                    {userRole === 2 && (
                      <th className="py-3 px-3 text-center w-[11%]">{translate('cost price', config.languageCode)}</th>
                    )}
                    <th className={`py-3 px-3 text-center ${userRole === 2 ? 'w-[11%]' : 'w-[14%]'}`}>{translate('selling price', config.languageCode)}</th>
                    <th className={`py-3 px-3 text-center cursor-pointer hover:bg-slate-200/70 transition ${userRole === 2 ? 'w-[12%]' : 'w-[16%]'}`} onClick={() => toggleSort('value')}>
                      <span className="flex items-center justify-center gap-1.5">
                        {translate('total value', config.languageCode)} {sortBy === 'value' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                      </span>
                    </th>
                    {userRole === 2 && (
                      <th className="py-3 px-3 text-center font-black w-[11%]">{translate('profit per unit', config.languageCode)}</th>
                    )}
                    <th className={`py-3 px-3 text-center ${userRole === 2 ? 'w-[9%]' : 'w-[10%]'}`}>{translate('actions', config.languageCode)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/40 text-xs text-gray-700">
                  {sortedItems.map(item => {
                    const isOver = item.quantity <= item.reorderPoint;
                    const isZero = item.quantity === 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 border-b border-slate-100/40 transition duration-150">
                        <td className="py-3.5 px-3 text-center overflow-hidden text-ellipsis">
                          <div className="flex flex-col items-center justify-center text-center">
                            <span className="font-extrabold text-slate-900 dark:text-white block truncate">{item.name}</span>
                            <div className="flex gap-2 text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-0.5 truncate justify-center">
                              <span>{translate('sku', config.languageCode)}: <strong className="font-mono text-slate-700 dark:text-slate-300">{item.sku}</strong></span>
                              <span>•</span>
                              <span>{translate('pref. supplier', config.languageCode)}: <strong>{item.supplier || translate('n/a', config.languageCode)}</strong></span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-3 text-center whitespace-nowrap overflow-hidden text-ellipsis">
                          <span className="neumorphic-btn text-slate-900 dark:text-white border border-white/80 dark:border-slate-700 rounded-full px-2.5 py-0.5 text-[9.5px] font-extrabold uppercase select-none inline-block">
                            {translate(item.category.toLowerCase(), config.languageCode)}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <span className="font-extrabold font-mono text-slate-900 dark:text-white text-xs">
                              {item.quantity} {translate('units', config.languageCode)}
                            </span>
                            {isZero ? (
                              <span className="neumorphic-inset text-[8.5px] text-slate-900 dark:text-white font-extrabold uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full border border-white/80 dark:border-slate-800">{translate('out of stock', config.languageCode).toUpperCase()}</span>
                            ) : isOver ? (
                              <span className="neumorphic-inset text-[8.5px] text-slate-900 dark:text-white font-extrabold uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full border border-white/80 dark:border-slate-800">{translate('low stock', config.languageCode).toUpperCase()}</span>
                            ) : null}
                          </div>
                        </td>
                        {userRole === 2 && (
                          <td className="py-4 px-4 text-center font-extrabold text-slate-900 dark:text-white font-mono">{formatMoney(item.unitCost)}</td>
                        )}
                        <td className="py-4 px-4 text-center font-extrabold text-slate-900 dark:text-white font-mono">{formatMoney(item.unitPrice)}</td>
                        <td className="py-4 px-4 text-center font-extrabold text-slate-900 dark:text-white font-mono">
                          {formatMoney(item.quantity * item.unitPrice)}
                        </td>
                        {userRole === 2 && (
                          <td className="py-4 px-4 text-center font-bold font-mono text-slate-900 dark:text-white">
                            {formatMoney(item.unitPrice - item.unitCost)}
                          </td>
                        )}
                        <td className="py-4 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust(item)}
                              className="w-7 h-7 flex items-center justify-center neumorphic-circle text-slate-800 hover:text-black cursor-pointer"
                              title={translate('adjust stock units', config.languageCode)}
                            >
                              <ArrowUpDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(item)}
                              className="w-7 h-7 flex items-center justify-center neumorphic-circle text-slate-800 hover:text-black cursor-pointer"
                              title={translate('edit details', config.languageCode)}
                            >
                              <Edit2 size={13} />
                            </button>
                            {userRole !== 5 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteCheck(item.id, item.name)}
                                className="w-7 h-7 flex items-center justify-center neumorphic-circle text-slate-800 hover:text-black cursor-pointer"
                                title={translate('retire item', config.languageCode)}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedItems.length === 0 && (
                    <tr>
                      <td colSpan={userRole === 2 ? 8 : 6} className="py-12 text-center text-gray-400">
                        <p className="font-medium text-xs">{translate('no matching inventory items found.', config.languageCode)}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View list Card style */}
            <div className="block lg:hidden bg-slate-50/75 p-3.5 space-y-4">
              {sortedItems.map(item => {
                const isOver = item.quantity <= item.reorderPoint;
                const isZero = item.quantity === 0;

                return (
                  <div key={item.id} className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-4 space-y-3.5 transition hover:shadow-sm">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <span className="bg-indigo-50 text-indigo-700 text-[9px] px-2 py-0.5 rounded font-extrabold uppercase tracking-wide">
                          {translate(item.category.toLowerCase(), config.languageCode)}
                        </span>
                        <h4 className="text-sm font-bold text-gray-900 leading-tight mt-1.5 truncate">{item.name}</h4>
                        <p className="text-[10px] text-gray-500 mt-1 flex flex-wrap gap-x-2">
                          <span>{translate('sku', config.languageCode)}: <strong className="font-mono text-gray-700 font-semibold">{item.sku}</strong></span>
                          {item.location && (
                            <>
                              <span className="text-gray-300">•</span>
                              <span>{translate('spot', config.languageCode) || 'Spot'}: <strong className="text-gray-700 font-semibold">{item.location}</strong></span>
                            </>
                          )}
                        </p>
                      </div>
                      <span className={`text-[9px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide shrink-0 border ${isZero
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : isOver
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        }`}>
                        {isZero ? translate('out of stock', config.languageCode) : isOver ? translate('low stock', config.languageCode) : translate('in stock', config.languageCode)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-slate-50/50 p-3 rounded-lg border border-slate-100/80 text-[10px]">
                      <div>
                        <span className="block text-gray-400 text-[8px] uppercase tracking-wider font-semibold">{translate('qty in hand', config.languageCode)}</span>
                        <strong className={`block text-xs mt-0.5 ${isZero ? 'text-rose-600' : isOver ? 'text-amber-500' : 'text-gray-900'}`}>{item.quantity} pcs</strong>
                      </div>
                      <div>
                        <span className="block text-gray-400 text-[8px] uppercase tracking-wider font-semibold">{translate('selling price', config.languageCode)}</span>
                        <strong className="block text-gray-900 text-xs mt-0.5 font-mono">{formatMoney(item.unitPrice)}</strong>
                      </div>
                      <div>
                        <span className="block text-gray-400 text-[8px] uppercase tracking-wider font-semibold">{translate('total value', config.languageCode)}</span>
                        <strong className="block text-gray-950 text-xs mt-0.5 font-mono">{formatMoney(item.quantity * item.unitPrice)}</strong>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-[10px] border-t border-slate-100 pt-3 text-slate-600">
                      {userRole === 2 ? (
                        <span>{translate('profit per unit', config.languageCode)}: <strong className="text-emerald-700 font-extrabold font-mono">{formatMoney(item.unitPrice - item.unitCost)}</strong></span>
                      ) : (
                        <span></span>
                      )}
                      <span className="truncate max-w-[150px]">{translate('supplier', config.languageCode)}: <strong className="text-gray-800 font-semibold">{item.supplier || translate('n/a', config.languageCode)}</strong></span>
                    </div>

                    {/* Mobile Touch Action Strip with 44px responsive target heights */}
                    <div className="flex gap-2 pt-1 border-t border-slate-100/60">
                      <button
                        type="button"
                        onClick={() => handleOpenAdjust(item)}
                        className="flex-1 min-h-[44px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center gap-1 font-bold text-xs transition cursor-pointer"
                        title={translate('adjust stock units', config.languageCode)}
                      >
                        <ArrowUpDown size={14} /> {translate('adjust', config.languageCode)}
                      </button>

                      {userRole !== 5 && (
                        <button
                          type="button"
                          onClick={() => handleOpenDamageReport(item)}
                          className="w-12 min-h-[44px] bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white rounded-xl flex items-center justify-center transition cursor-pointer shadow-xs hover:opacity-95"
                          title={translate('report damage', config.languageCode)}
                        >
                          <AlertTriangle size={15} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="flex-1 min-h-[44px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center gap-1 font-bold text-xs transition cursor-pointer"
                        title={translate('edit details', config.languageCode)}
                      >
                        <Edit2 size={13} /> {translate('edit', config.languageCode)}
                      </button>

                      {userRole !== 5 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCheck(item.id, item.name)}
                          className="w-12 min-h-[44px] bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl flex items-center justify-center transition cursor-pointer"
                          title={translate('retire item', config.languageCode)}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {sortedItems.length === 0 && (
                <div className="py-12 text-center text-gray-400">
                  <p className="text-xs">{translate('no matching stock items discovered.', config.languageCode)}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* TAB 2: DAMAGED GOODS AUDITING LEDGER */}
      {inventoryTab === 'damaged_audit' && (
        <div className="space-y-6">
          {/* Audit Financial Metrics Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="finnova-card p-5 text-slate-900">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider flex items-center gap-1">
                <PackageX size={13} className="text-slate-800" /> {translate('units damaged (shrinkage)', config.languageCode)}
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {damageMetrics.totalQty} {translate('units', config.languageCode)}
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">{translate('total physical stock decommissioned', config.languageCode)}</p>
            </div>

            <div className="finnova-card p-5 text-slate-900">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                {translate('capital sunk loss (at cost)', config.languageCode)}
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {formatMoney(damageMetrics.totalCostLoss)}
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">{translate('true capital loss based on procurement cost', config.languageCode)}</p>
            </div>

            <div className="finnova-card p-5 text-slate-900">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider">
                {translate('revenue loss potential', config.languageCode)}
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {formatMoney(damageMetrics.totalRetailLoss)}
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">{translate('selling value opportunity completely lost', config.languageCode)}</p>
            </div>
          </div>

          {/* Damage Log Filter & Query Header */}
          <div className="finnova-card p-4 sm:p-5 space-y-4">
            <div className="flex flex-col md:flex-row gap-3 justify-between items-center">
              {/* Search Bar */}
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder={translate('filter damages by item name, sku or auditor remarks...', config.languageCode)}
                  value={damageSearchQuery}
                  onChange={(e) => setDamageSearchQuery(e.target.value)}
                  className="w-full text-xs text-slate-900 rounded-full pl-9 pr-4 py-2 neumorphic-inset focus:outline-hidden transition font-medium"
                />
              </div>

              {/* Date Filter & Export */}
              <div className="flex items-center gap-2 w-full md:w-auto shrink-0 justify-end">
                <div className="relative" ref={dateDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setDateDropdownOpen(!dateDropdownOpen)}
                    className="text-xs text-slate-900 rounded-full px-4 py-2 neumorphic-btn focus:outline-hidden transition font-extrabold flex items-center gap-2 cursor-pointer border border-white/80 hover:text-black"
                  >
                    <span>
                      {damageDateFilter === 'all'
                        ? translate('all dates', config.languageCode)
                        : damageDateFilter === 'today'
                          ? translate('today', config.languageCode)
                          : damageDateFilter === '7days'
                            ? translate('last 7 days', config.languageCode)
                            : translate('last 30 days', config.languageCode)}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-slate-700 transition-transform duration-200 ${dateDropdownOpen ? 'rotate-180 text-blue-600' : ''}`}
                    />
                  </button>

                  <AnimatePresence>
                    {dateDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.96 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.96 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute right-0 top-full mt-1.5 w-48 rounded-2xl bg-[#ebf0f7] p-2 shadow-xl border border-white/90 z-50 overflow-hidden font-sans"
                        style={{ boxShadow: '6px 6px 18px #cbd3e1, -6px -6px 18px #ffffff' }}
                      >
                        <div className="space-y-1 p-0.5">
                          {[
                            { val: 'all', label: translate('all dates', config.languageCode) },
                            { val: 'today', label: translate('today', config.languageCode) },
                            { val: '7days', label: translate('last 7 days', config.languageCode) },
                            { val: '30days', label: translate('last 30 days', config.languageCode) }
                          ].map(opt => {
                            const isSelected = damageDateFilter === opt.val;
                            return (
                              <button
                                key={opt.val}
                                type="button"
                                onClick={() => {
                                  setDamageDateFilter(opt.val);
                                  setDateDropdownOpen(false);
                                }}
                                className={`w-full text-left text-xs px-3.5 py-2.5 rounded-xl font-extrabold transition flex items-center justify-between cursor-pointer ${isSelected
                                  ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25'
                                  : 'text-slate-800 hover:bg-slate-200/70 hover:text-black'
                                  }`}
                              >
                                <span>{opt.label}</span>
                                {isSelected && <Check size={14} className="text-white shrink-0" />}
                              </button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={handleExportDamagesCSV}
                  disabled={filteredDamagedLogs.length === 0}
                  className="flex items-center gap-1.5 bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white font-extrabold disabled:opacity-50 disabled:cursor-not-allowed rounded-full px-4.5 py-2 text-xs hover:opacity-95 transition cursor-pointer shadow-md shadow-sky-500/25 shrink-0"
                >
                  <FileDown size={14} className="text-white shrink-0" />
                  <span className="text-white font-black">{translate('export audit excel', config.languageCode)}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Audit Ledger Table (Desktop) */}
          <div className="hidden md:block finnova-card p-3 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="neumorphic-table-header text-[10px] select-none">
                    <th className="py-3 px-4 font-bold text-slate-900">{translate('logged time', config.languageCode)}</th>
                    <th className="py-3 px-4 font-bold text-slate-900">{translate('product particulars', config.languageCode)}</th>
                    <th className="py-3 px-4 text-right font-bold text-slate-900">{translate('units decommissioned', config.languageCode)}</th>
                    {userRole === 2 && (
                      <>
                        <th className="py-3 px-4 text-right font-bold text-slate-900">{translate('unit cost price', config.languageCode)}</th>
                        <th className="py-3 px-4 text-right font-bold text-slate-900">{translate('sunk cost loss', config.languageCode)}</th>
                      </>
                    )}
                    <th className="py-3 px-4 text-right font-bold text-slate-900">{translate('potential retail loss', config.languageCode)}</th>
                    <th className="py-3 px-4 font-bold text-slate-900">{translate('auditor adjustment note / reason remarks', config.languageCode)}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 text-gray-900">
                  {filteredDamagedLogs.map((log) => {
                    const item = inventory.find(i => i.id === log.itemId);
                    const unitCost = item?.unitCost || 0;
                    const unitPrice = item?.unitPrice || 0;
                    const qtyDecommissioned = Math.abs(log.qtyChanged);
                    const costLoss = qtyDecommissioned * unitCost;
                    const retailLoss = qtyDecommissioned * unitPrice;

                    return (
                      <tr key={log.id} className="hover:bg-slate-200/20 transition border-b border-slate-100">
                        <td className="py-3.5 px-4 font-medium text-gray-500 whitespace-nowrap">
                          {new Date(log.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{log.itemName}</div>
                          <div className="text-[10px] text-gray-400">{translate('sku', config.languageCode)}: {item?.sku || translate('n/a', config.languageCode)} • {translate('category', config.languageCode)}: {item?.category ? translate(item.category.toLowerCase(), config.languageCode) : translate('uncategorized', config.languageCode)}</div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-rose-750 font-mono">
                          -{qtyDecommissioned} pcs
                        </td>
                        {userRole === 2 && (
                          <>
                            <td className="py-3.5 px-4 text-right font-mono text-gray-500">
                              {formatMoney(unitCost)}
                            </td>
                            <td className="py-3.5 px-4 text-right font-bold font-mono text-rose-600 bg-rose-50/10">
                              {formatMoney(costLoss)}
                            </td>
                          </>
                        )}
                        <td className="py-3.5 px-4 text-right font-medium font-mono text-amber-600">
                          {formatMoney(retailLoss)}
                        </td>
                        <td className="py-3.5 px-4 text-gray-600 max-w-xs" title={log.notes}>
                          <span className="neumorphic-inset px-2.5 py-1 text-slate-800 font-medium break-words block text-[10px] leading-relaxed rounded-lg">
                            {log.notes}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDamagedLogs.length === 0 && (
                    <tr>
                      <td colSpan={userRole === 2 ? 7 : 5} className="py-12 text-center text-gray-450 font-medium">
                        <p>{translate('no damage claims or audits registered based on your current filters.', config.languageCode)}</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit Ledger Table (Mobile) */}
          <div className="block md:hidden space-y-3.5">
            {filteredDamagedLogs.map((log) => {
              const item = inventory.find(i => i.id === log.itemId);
              const unitCost = item?.unitCost || 0;
              const unitPrice = item?.unitPrice || 0;
              const qtyDecommissioned = Math.abs(log.qtyChanged);
              const costLoss = qtyDecommissioned * unitCost;
              const retailLoss = qtyDecommissioned * unitPrice;

              return (
                <div key={log.id} className="finnova-card p-4 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <strong className="text-sm font-bold text-gray-905 leading-tight block">{log.itemName}</strong>
                      <span className="text-[10px] text-gray-400">{translate('logged on', config.languageCode)} {new Date(log.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>
                    <span className="bg-rose-50 border border-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 font-mono">
                      -{qtyDecommissioned} pcs
                    </span>
                  </div>

                  <div className={`grid ${userRole === 2 ? 'grid-cols-2' : 'grid-cols-1'} gap-2 neumorphic-inset p-2.5 rounded-xl text-[10px] font-mono`}>
                    {userRole === 2 && (
                      <div>
                        <span className="block text-gray-400 text-[8px] uppercase font-bold">{translate('cost loss', config.languageCode)}</span>
                        <strong className="text-rose-600 text-xs font-bold">{formatMoney(costLoss)}</strong>
                      </div>
                    )}
                    <div>
                      <span className="block text-gray-400 text-[8px] uppercase font-bold">{translate('revenue sunk loss', config.languageCode)}</span>
                      <strong className="text-amber-600 text-xs font-bold">{formatMoney(retailLoss)}</strong>
                    </div>
                  </div>

                  <div className="neumorphic-inset text-slate-700 text-[10px] p-2.5 rounded-xl">
                    <span className="text-[8px] uppercase text-slate-400 block font-bold mb-0.5">{translate('auditor reason / note', config.languageCode)}</span>
                    {log.notes}
                  </div>
                </div>
              );
            })}
            {filteredDamagedLogs.length === 0 && (
              <div className="py-12 finnova-card text-center text-gray-400 font-medium">
                {translate('no damage logs recorded for the selected search terms.', config.languageCode)}
              </div>
            )}
          </div>
        </div>
      )}

      {inventoryTab === 'restock_validations' && userRole === 2 && (
        <div className="space-y-6">
          {/* Header section with Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="finnova-card p-5 text-slate-900 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider flex items-center gap-1">
                <PackageCheck size={13} className="text-slate-800" /> Pending Validations
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {activePendingRestocks?.filter(r => r.status === 'pending').length || 0} items
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">Awaiting blind admin verification</p>
            </div>

            <div className="finnova-card p-5 text-slate-900 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider flex items-center gap-1">
                <ShieldAlert size={13} className="text-slate-800" /> On Hold (Conflicts)
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {activePendingRestocks?.filter(r => r.status === 'on_hold').length || 0} items
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">Discrepancies found & query open</p>
            </div>

            <div className="finnova-card p-5 text-slate-900 text-left">
              <span className="text-[10px] uppercase font-bold text-slate-500 block tracking-wider flex items-center gap-1">
                <CheckCircle2 size={13} className="text-slate-800" /> Resolved / Approved
              </span>
              <strong className="text-xl md:text-2xl font-black block mt-1 text-slate-900 font-sans">
                {activePendingRestocks?.filter(r => r.status === 'resolved' || r.status === 'approved').length || 0} items
              </strong>
              <p className="text-[9.5px] text-slate-500 font-medium mt-1">Successfully added to physical inventory</p>
            </div>
          </div>

          {/* Verification section */}
          <div className="finnova-card p-6 space-y-6 text-left">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Verify Pending Restock Quantities</h3>
              <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                Enter your independently counted stock quantity for each restock submission below. If your count matches the attendant's log, the restock is approved automatically. Otherwise, it will be marked "On Hold" so you can query the attendant and resolve any discrepancies.
              </p>
            </div>

            {/* List of Pending Restocks */}
            <div className="space-y-4">
              {(!activePendingRestocks || activePendingRestocks.filter(r => r.status !== 'resolved' && r.status !== 'approved').length === 0) ? (
                <div className="p-8 text-center neumorphic-inset rounded-2xl">
                  <MaterialIcon name="inventory_2" size={32} className="text-slate-700 mb-2 mx-auto block" />
                  <p className="font-extrabold text-xs text-slate-900">All Restocks Verified</p>
                  <p className="text-[10.5px] text-slate-500 mt-0.5">There are no pending restock submissions requiring validation at this time.</p>
                </div>
              ) : (
                activePendingRestocks.filter(r => r.status !== 'resolved' && r.status !== 'approved').map((restock) => {
                  return (
                    <RestockVerificationRow
                      key={restock.id}
                      restock={restock}
                      onVerifyRestock={(id, adminQty, notes, forceValue) => {
                        if (onVerifyRestock) {
                          return onVerifyRestock(id, adminQty, notes, forceValue);
                        }
                        return (restock.attendantQty === adminQty || forceValue !== undefined) ? 'resolved_matched' : 'on_hold';
                      }}
                      config={config}
                    />
                  );
                })
              )}
            </div>

            {/* History of Resolved Restocks */}
            {activePendingRestocks && activePendingRestocks.filter(r => r.status === 'resolved' || r.status === 'approved').length > 0 && (
              <div className="pt-6 border-t border-slate-100">
                <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-3">Validation History (Latest Resolved)</h4>
                <div className="overflow-x-auto bg-white border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px] border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                        <th className="p-3">Item Name</th>
                        <th className="p-3 text-center">Attendant Qty</th>
                        <th className="p-3 text-center">Admin Qty</th>

                        <th className="p-3 text-center">Approved Qty</th>
                        <th className="p-3">Submitted By</th>
                        <th className="p-3">Resolved Date</th>
                        <th className="p-3">Resolution Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {pendingRestocks.filter(r => r.status === 'resolved').slice(0, 10).map((r) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition">
                          <td className="p-3 font-bold text-slate-900">{r.itemName}</td>
                          <td className="p-3 text-center font-mono font-medium">{r.attendantQty}</td>
                          <td className="p-3 text-center font-mono font-medium">{r.adminInputQty ?? 'N/A'}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-600">{r.resolvedQty}</td>
                          <td className="p-3 font-medium">{r.submittedBy}</td>
                          <td className="p-3 font-mono text-slate-500">
                            {new Date(r.resolvedAt || r.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3 max-w-xs truncate" title={r.discrepancyNotes || 'Automatically approved (quantities matched)'}>
                            <span className="text-[10px] text-slate-500 leading-snug">
                              {r.discrepancyNotes || 'Auto-approved (matched)'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT ITEM */}
      {showAddEditModal && (
        <div
          onClick={() => setShowAddEditModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] flex flex-col cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="bg-slate-100/90 dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-slate-200/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <Package size={16} className="text-sky-600 dark:text-sky-400" /> {editingItemId ? translate('update inventory card', config.languageCode) : translate('create new stock profile', config.languageCode)}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddEditModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                {translate('close', config.languageCode)}
              </button>
            </div>

            {/* Form body */}
            <form onSubmit={handleSaveItem} className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
              {itemSaveError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 rounded-xl text-xs font-bold flex items-center gap-2 animate-fade-in">
                  <AlertCircle size={16} className="shrink-0 text-red-500" />
                  <span>{itemSaveError}</span>
                </div>
              )}

              {/* Product Name */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('product title *', config.languageCode)}</label>
                <input
                  type="text"
                  placeholder={translate('e.g. ergonomic premium desk pad', config.languageCode)}
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                />
              </div>

              {/* SKU & Category Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('stock sku *', config.languageCode)}</label>
                  <input
                    type="text"
                    placeholder={translate('e.g. dp-881', config.languageCode)}
                    value={itemSku}
                    onChange={(e) => setItemSku(e.target.value)}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('classification category', config.languageCode)}</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        const willOpen = !isCategoryDropdownOpen;
                        setIsCategoryDropdownOpen(willOpen);
                        if (willOpen && allAvailableCategories.length === 0) {
                          setIsAddingNewCategory(true);
                        }
                      }}
                      className="w-full rounded-xl neumorphic-inset p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white font-extrabold text-left flex items-center justify-between cursor-pointer border border-white/80 dark:border-slate-800 shadow-sm"
                    >
                      <span className="truncate">{itemCategory || translate('select category', config.languageCode)}</span>
                      <ChevronDown size={14} className={`transition-transform duration-200 text-sky-500 shrink-0 ${isCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isCategoryDropdownOpen && (
                      <div className="absolute z-50 mt-1.5 w-full rounded-2xl neumorphic-card p-2.5 bg-[#ebf0f7] dark:bg-[#1e2124] border border-white/90 dark:border-slate-700/80 shadow-2xl space-y-1.5 animate-fade-in max-h-64 flex flex-col">
                        <div className="flex-1 overflow-y-auto space-y-1 pr-1 [scrollbar-width:thin] max-h-40">
                          {allAvailableCategories.length === 0 ? (
                            <div className="py-3 px-2 text-center text-slate-500 dark:text-slate-400">
                              <p className="text-xs font-bold">{translate('no custom categories yet', config.languageCode) || 'No categories created yet.'}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{translate('add your first category below', config.languageCode) || 'Create your business category below'}</p>
                            </div>
                          ) : (
                            allAvailableCategories.map((catName) => (
                              <div
                                key={catName}
                                className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between group cursor-pointer ${itemCategory === catName
                                  ? 'neumorphic-inset bg-gradient-to-r from-sky-500 to-blue-600 text-white font-black shadow-inner'
                                  : 'hover:bg-white/60 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                                  }`}
                                onClick={() => {
                                  setItemCategory(catName);
                                  setIsCategoryDropdownOpen(false);
                                }}
                              >
                                <span className="truncate">{translate(catName.toLowerCase(), config.languageCode) || catName}</span>
                                <div className="flex items-center gap-1.5">
                                  {itemCategory === catName && <Check size={13} className="text-white shrink-0" />}
                                  {businessCategories.includes(catName) && (
                                    <button
                                      type="button"
                                      onClick={(e) => void handleDeleteCategory(catName, e)}
                                      className={`p-1 rounded-lg opacity-0 group-hover:opacity-100 transition hover:bg-red-500 hover:text-white ${itemCategory === catName ? 'text-white/80' : 'text-slate-400 hover:text-white'
                                        }`}
                                      title={translate('delete category', config.languageCode)}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        {/* Add New Custom Category row */}
                        <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                          {isAddingNewCategory ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                autoFocus
                                value={newCategoryInput}
                                onChange={(e) => setNewCategoryInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    void handleCreateCategory(newCategoryInput);
                                  } else if (e.key === 'Escape') {
                                    setIsAddingNewCategory(false);
                                    setNewCategoryInput('');
                                  }
                                }}
                                placeholder={translate('category name...', config.languageCode)}
                                className="w-full text-xs font-semibold px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-sky-400/80 focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => void handleCreateCategory(newCategoryInput)}
                                disabled={!newCategoryInput.trim()}
                                className="px-2.5 py-1.5 rounded-xl bg-sky-500 text-white text-[11px] font-black hover:bg-sky-600 active:scale-95 transition disabled:opacity-40 cursor-pointer shrink-0"
                              >
                                {translate('add', config.languageCode)}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAddingNewCategory(false);
                                  setNewCategoryInput('');
                                }}
                                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsAddingNewCategory(true);
                              }}
                              className="w-full py-1.5 px-3 rounded-xl border border-dashed border-sky-500/50 hover:border-sky-500 text-sky-600 dark:text-sky-400 text-xs font-extrabold flex items-center justify-center gap-1.5 hover:bg-sky-500/10 active:scale-95 transition cursor-pointer"
                            >
                              <Plus size={13} />
                              <span>{translate('add custom category', config.languageCode)}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Qty & Reorder Trigger Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('initial hand quantity', config.languageCode)}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={translate('e.g. 50', config.languageCode)}
                    value={itemQty}
                    onChange={(e) => setItemQty(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('low-stock guard level', config.languageCode)}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder={translate('e.g. 10 (will alert)', config.languageCode)}
                    value={itemReorder}
                    onChange={(e) => setItemReorder(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={userRole !== 2}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {userRole !== 2 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block font-semibold">Only Admins can set the shortage level.</span>
                  )}
                </div>
              </div>

              {/* Cost & retail selling Price Row */}
              <div className={userRole === 2 ? "grid grid-cols-2 gap-3" : "grid grid-cols-1 gap-3"}>
                {userRole === 2 && (
                  <div>
                    <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('incoming asset cost', config.languageCode)} ({config.currencySymbol})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={translate('e.g. 15.00', config.languageCode)}
                      value={itemCost}
                      onChange={(e) => setItemCost(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium font-mono"
                    />
                  </div>
                )}
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('retail selling price', config.languageCode)} ({config.currencySymbol})</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={translate('e.g. 29.99', config.languageCode)}
                    value={itemPrice}
                    onChange={(e) => setItemPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    disabled={userRole !== 2}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {userRole !== 2 && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 block font-semibold">Only Admins can edit the selling price.</span>
                  )}
                </div>
              </div>

              {/* Vendor & Shelf Location Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('supplier vendor source', config.languageCode)}</label>
                  <input
                    type="text"
                    placeholder={translate('e.g. eldorado goods', config.languageCode)}
                    value={itemSupplier}
                    onChange={(e) => setItemSupplier(e.target.value)}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                  />
                </div>
                <div>
                  <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('shelf location designation', config.languageCode)}</label>
                  <input
                    type="text"
                    placeholder={translate('e.g. aisle e - shelf 3', config.languageCode)}
                    value={itemLocation}
                    onChange={(e) => setItemLocation(e.target.value)}
                    className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                  />
                </div>
              </div>

              {/* Remarks / Spec Notes */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('internal item remarks', config.languageCode)}</label>
                <textarea
                  placeholder={translate('insert special quality traits or re-stocking parameters...', config.languageCode)}
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium h-20 resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAddEditModal(false)}
                  disabled={isSavingItem}
                  className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-5 py-2.5 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700 disabled:opacity-50"
                >
                  {translate('dismiss', config.languageCode)}
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem}
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold rounded-xl neumorphic-btn shadow-md transition-all text-xs cursor-pointer border border-white/30 dark:border-slate-700/60 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingItem ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>{translate('saving product...', config.languageCode) || 'Saving product...'}</span>
                    </>
                  ) : (
                    <span>{translate('save product', config.languageCode)}</span>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: STOCK ADJUSTMENT */}
      {showAdjustModal && (
        <div
          onClick={() => setShowAdjustModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="bg-slate-100/90 dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-slate-200/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5">
                <ArrowUpDown size={15} className="text-sky-600 dark:text-sky-400" /> {translate('change item inventory units', config.languageCode)}
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                {translate('close', config.languageCode)}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAdjustment} className="p-6 space-y-4 text-xs">
              <div>
                <span className="block text-slate-500 dark:text-slate-400 font-extrabold mb-1">{translate('target product', config.languageCode)}:</span>
                <strong className="text-slate-900 dark:text-white text-sm block bg-[#ebf0f7] dark:bg-slate-950/80 p-3 rounded-xl border border-white/80 dark:border-slate-800 neumorphic-inset font-bold">
                  {inventory.find(i => i.id === adjustItemId)?.name} (SKU: {inventory.find(i => i.id === adjustItemId)?.sku})
                </strong>
              </div>

              {/* Adjustment Reason Type */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">{translate('movement reason / action', config.languageCode)}</label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAdjustType('purchase_in')}
                    className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 cursor-pointer font-extrabold text-xs transition ${adjustType === 'purchase_in'
                      ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border-none'
                      : 'neumorphic-btn text-slate-800 dark:text-white hover:text-black dark:hover:text-white border border-white/80 dark:border-slate-700'
                      }`}
                  >
                    <ArrowDownCircle size={14} className={adjustType === 'purchase_in' ? 'text-white' : 'text-slate-800 dark:text-slate-200'} /> {translate('stock procurement (+ in)', config.languageCode)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('sale_out')}
                    className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 cursor-pointer font-extrabold text-xs transition ${adjustType === 'sale_out'
                      ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border-none'
                      : 'neumorphic-btn text-slate-800 dark:text-white hover:text-black dark:hover:text-white border border-white/80 dark:border-slate-700'
                      }`}
                  >
                    <ArrowUpCircle size={14} className={adjustType === 'sale_out' ? 'text-white' : 'text-slate-800 dark:text-slate-200'} /> {translate('product outflow (- out)', config.languageCode)}
                  </button>
                  {userRole !== 5 && (
                    <button
                      type="button"
                      onClick={() => setAdjustType('damaged')}
                      className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 cursor-pointer font-extrabold text-xs transition ${adjustType === 'damaged'
                        ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border-none'
                        : 'neumorphic-btn text-slate-800 dark:text-white hover:text-black dark:hover:text-white border border-white/80 dark:border-slate-700'
                        }`}
                    >
                      {translate('stock damaged (- out)', config.languageCode)}
                    </button>
                  )}
                  {userRole !== 5 && (
                    <button
                      type="button"
                      onClick={() => setAdjustType('returned')}
                      className={`p-3 rounded-xl text-center flex items-center justify-center gap-1.5 cursor-pointer font-extrabold text-xs transition ${adjustType === 'returned'
                        ? 'bg-gradient-to-r from-sky-400 via-blue-500 to-blue-600 text-white shadow-md shadow-sky-500/25 border-none'
                        : 'neumorphic-btn text-slate-800 dark:text-white hover:text-black dark:hover:text-white border border-white/80 dark:border-slate-700'
                        }`}
                    >
                      <RotateCcw size={14} className={adjustType === 'returned' ? 'text-white' : 'text-slate-800 dark:text-slate-200'} /> {translate('client return (+ in)', config.languageCode)}
                    </button>
                  )}
                </div>
              </div>

              {/* Units Amount */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('adjust quantity amount', config.languageCode)}</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder={translate('quantity (e.g. 15)', config.languageCode) || 'Quantity (e.g. 15)'}
                  value={qtyChangeAmt}
                  onChange={(e) => setQtyChangeAmt(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                />
              </div>

              {/* Optional comments */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('movement comments', config.languageCode) || 'Movement Comments'}</label>
                <input
                  type="text"
                  placeholder={translate('e.g. received shipment from anker', config.languageCode) || 'e.g. Received shipment from Anker'}
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-5 py-2.5 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
                >
                  {translate('dismiss', config.languageCode)}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 dark:from-sky-400 dark:via-cyan-400 dark:to-blue-500 hover:from-sky-600 hover:to-blue-700 text-white font-extrabold rounded-xl neumorphic-btn shadow-md transition-all text-xs cursor-pointer border border-white/30 dark:border-slate-700/60 active:scale-[0.98]"
                >
                  {translate('publish adjustment', config.languageCode) || 'Publish Adjustment'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: REPORT DAMAGED GOODS */}
      {showDamageModal && (
        <div
          onClick={() => setShowDamageModal(false)}
          className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-[#ebf0f7] dark:bg-[#131924] text-slate-900 dark:text-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col cursor-default border border-white/80 dark:border-slate-800 neumorphic-card"
          >
            {/* Header */}
            <div className="bg-slate-100/90 dark:bg-[#0f172a] p-4 text-slate-900 dark:text-white flex justify-between items-center shrink-0 border-b border-slate-200/80 dark:border-slate-800">
              <h3 className="font-extrabold text-sm flex items-center gap-1.5 text-slate-900 dark:text-white">
                <PackageX size={15} className="text-rose-500 dark:text-rose-400" /> {translate('report damaged stock (audit writeoff)', config.languageCode)}
              </h3>
              <button
                type="button"
                onClick={() => setShowDamageModal(false)}
                className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-3 py-1 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
              >
                {translate('close', config.languageCode)}
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveDamageReport} className="p-6 space-y-4 text-xs animate-fadeIn">
              {/* Product Selection */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1.5">{translate('select damaged product', config.languageCode)}</label>
                <select
                  value={damageItemId}
                  onChange={(e) => setDamageItemId(e.target.value)}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                >
                  <option value="" disabled className="dark:bg-slate-900">{translate('-- choose product --', config.languageCode)}</option>
                  {inventory.map(item => (
                    <option key={item.id} value={item.id} className="dark:bg-slate-900">
                      {item.name} (SKU: {item.sku}) [{translate('in stock', config.languageCode)}: {item.quantity} pcs]
                    </option>
                  ))}
                </select>
              </div>

              {/* Display Stock Warning if selected */}
              {damageItemId && (
                <div className="bg-[#ebf0f7] dark:bg-slate-950/60 p-3 rounded-xl border border-white/80 dark:border-slate-800 flex justify-between text-xs text-slate-600 dark:text-slate-300 neumorphic-inset">
                  <span>{translate('current available qty', config.languageCode)}:</span>
                  <strong className="text-slate-900 dark:text-white font-extrabold">
                    {inventory.find(i => i.id === damageItemId)?.quantity || 0} {translate('units', config.languageCode)}
                  </strong>
                </div>
              )}

              {/* Units Damaged */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('quantity damaged', config.languageCode)}</label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder={translate('units count (e.g. 5)', config.languageCode)}
                  value={damageQty}
                  onChange={(e) => setDamageQty(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white font-mono placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium"
                />
              </div>

              {/* Mandatory Explanation Reasoning */}
              <div>
                <label className="block font-extrabold text-slate-700 dark:text-slate-300 mb-1">{translate('audit justification / comments', config.languageCode) || 'Audit Justification / Comments'}</label>
                <textarea
                  required
                  placeholder={translate('mandatory reasons (e.g. water damage, dropping packages, product expiration...)', config.languageCode)}
                  value={damageNotes}
                  onChange={(e) => setDamageNotes(e.target.value)}
                  rows={3}
                  className="w-full neumorphic-inset rounded-xl p-2.5 bg-[#ebf0f7] dark:bg-slate-950/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none transition-all border border-white/80 dark:border-slate-800 text-xs font-medium resize-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800 flex justify-end gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowDamageModal(false)}
                  className="neumorphic-btn text-slate-900 dark:text-white rounded-full px-5 py-2.5 text-xs font-extrabold hover:text-black dark:hover:text-white transition cursor-pointer border border-white/80 dark:border-slate-700"
                >
                  {translate('dismiss', config.languageCode)}
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-rose-500 via-red-500 to-rose-600 dark:from-rose-500 dark:to-red-600 hover:from-rose-600 hover:to-red-700 text-white font-extrabold rounded-xl neumorphic-btn shadow-md transition-all text-xs cursor-pointer border border-white/30 dark:border-slate-700/60 active:scale-[0.98]"
                >
                  {translate('write off damaged stock', config.languageCode)}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}