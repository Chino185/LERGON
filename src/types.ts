export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unitCost: number;
  unitPrice: number;
  reorderPoint: number;
  supplier: string;
  location: string;
  notes: string;
  lastUpdated: string;
  imageUrl?: string;
}

export interface StockAdjustment {
  id: string;
  itemId: string;
  itemName: string;
  qtyChanged: number; // positive = added, negative = removed
  type: 'purchase_in' | 'sale_out' | 'damaged' | 'returned' | 'audit_adjustment';
  date: string;
  notes: string;
  creditAccountId?: string;
  performedBy?: string;
  isFlagged?: boolean;
  flagComment?: string;
  flaggedBy?: string;
  flaggedAt?: string;
  isResolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  originalQtyChanged?: number;
  correctionNotes?: string;
}

export interface CreditAccount {
  id: string;
  name: string;
  type: 'receivable' | 'payable'; // receivable = client owes us, payable = we owe supplier
  phone: string;
  email: string;
  totalAmount: number; // initial credit amount
  remainingAmount: number; // current outstanding amount
  dueDate: string;
  status: 'active' | 'partially_paid' | 'settled' | 'overdue';
  notes: string;
  lastUpdated: string;
  dateOfCrediting?: string;
  paymentDate?: string;
  receipt?: {
    name: string;
    dataUrl: string;
    type: string;
  };
}

export interface CreditTransaction {
  id: string;
  creditAccountId: string;
  accountName: string;
  type: 'borrow' | 'pay' | 'charge'; // charge: credit added, pay: payment received/made
  amount: number;
  date: string;
  notes: string;
  paymentMethod?: 'Cash' | 'Mobile Money' | 'Bank';
  transactionProof?: {
    name: string;
    dataUrl: string;
    type: string;
  };
  remainingAmount?: number; // Outstanding balance of this specific credit record
  relatedCreditTxnId?: string; // Links payment directly to credit record ID
  performedBy?: string;
  transactionType?: string;
  lineItems?: Array<Record<string, unknown>>;
  isFlagged?: boolean;
  flagComment?: string;
  flaggedBy?: string;
  flaggedAt?: string;
  isResolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  originalAmount?: number;
  correctionNotes?: string;
}

export interface BusinessConfig {
  businessName: string;
  ownerName: string;
  phone: string;
  email: string;
  address: string;
  currency: string;
  currencySymbol: string;
  lowStockThresholdDefault: number;
  country?: string;
  language?: string;
  languageCode?: string;
  themeMode?: 'light' | 'dark' | 'system';
  profilePhoto?: string;
  adminPhone?: string;
  attendantPhone?: string;
  totalInventoryValueOverride?: number | null;
  totalRetailValueOverride?: number | null;
  cashSalesValueOverride?: number | null;
  receivablesTotalOverride?: number | null;
  realizedProfitOverride?: number | null;
  totalInventoryValueOverrideByAI?: boolean | null;
  totalRetailValueOverrideByAI?: boolean | null;
  cashSalesValueOverrideByAI?: boolean | null;
  receivablesTotalOverrideByAI?: boolean | null;
  realizedProfitOverrideByAI?: boolean | null;
}

export interface OrganizationInvite {
  code: string;
  createdAt: number;
  expiresAt: number;
  isUsed: boolean;
}

export interface Organization {
  id: string;
  name: string;
  adminPass: string;      // passcode for Admin (role 2)
  attendantPass: string;  // passcode for Attendant (role 5)
  adminEmail?: string;
  attendantEmail?: string;
  adminName?: string;
  adminPhoto?: string;
  attendantName?: string;
  attendantPhoto?: string;
  attendantResetRequested?: boolean;
  attendantResetEmail?: string;
  attendantResetUsername?: string;
  attendantResetTimestamp?: number;
  isTempPassword?: boolean;
  previousAttendantPass?: string;
  activeInvite?: OrganizationInvite;
}

export type UserRole = 2 | 5;

export interface PendingRestock {
  id: string;
  itemId: string;
  itemName: string;
  attendantQty: number;
  attendantNotes: string;
  date: string;
  submittedBy: string;
  status: 'pending' | 'on_hold' | 'resolved';
  adminInputQty?: number;
  discrepancyNotes?: string;
  resolvedAt?: string;
  resolvedQty?: number;
}

export interface ActivityLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  metadata?: any;
}

// --- Lergon Multi-Tenant Data Foundation Models ---

export interface BusinessTenant {
  id: string;                    // Document ID = business_id
  trade_name: string;             // Business / Trade name
  base_country: string;           // Base country (e.g., Nigeria, Kenya)
  base_currency_code: string;     // ISO code (e.g., NGN, KES, USD)
  base_currency_symbol: string;   // Symbol (e.g., ₦, KSh, $)
  created_at: string;             // ISO Timestamp
  owner_admin_uid: string;        // Supabase Auth UID of business owner
  invite_code?: string;           // Active attendant registration invite code
}

export interface LergonUser {
  uid: string;                    // Document ID = Supabase Auth UID
  email: string;                  // User email address
  role: 'admin' | 'attendant';    // Role: admin or attendant
  business_id: string;            // ID of associated Business Tenant
  display_username: string;       // Display / Operator username
  profile_photo_url: string;      // Profile photo download URL
  theme_preference: 'light' | 'dark'; // Theme preference
  account_status: 'active' | 'suspended' | 'pending'; // Account state
  created_at?: string;
  last_login?: string;
}

export interface TenantInventoryItem {
  id: string;
  business_id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  reorder_point: number;
  location?: string;
  notes?: string;
  image_url?: string;
  created_at: string;
  last_updated: string;
}

export interface TenantSupplierDetail {
  id: string;
  business_id: string;
  inventory_item_id: string;
  supplier_name: string;
  contact_email?: string;
  contact_phone?: string;
  wholesale_rate: number;
  terms?: string;
}

export interface TenantDamageReport {
  id: string;
  business_id: string;
  inventory_item_id: string;
  damaged_quantity: number;
  reason: string;
  reported_by: string;
  reported_at: string;
  approved_by_admin?: string;
  status: 'pending_review' | 'approved' | 'rejected';
}

export interface TenantSaleTransaction {
  id: string;
  business_id: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  payment_method: 'Cash' | 'Mobile Money' | 'Bank' | 'Credit';
  type: 'sell';
  performed_by_uid: string;
  performed_by_email: string;
  created_at: string;
}

export interface TenantSupplierPayable {
  id: string;
  business_id: string;
  supplier_name: string;
  amount_due: number;
  due_date: string;
  status: 'unpaid' | 'partially_paid' | 'cleared';
}

export interface TenantCustomerCredit {
  id: string;
  business_id: string;
  customer_name: string;
  customer_phone?: string;
  total_credit_amount: number;
  remaining_balance: number;
  status: 'active' | 'partially_paid' | 'settled' | 'overdue';
  recorded_by_uid: string;
  created_at: string;
  due_date: string;
}

export interface TenantSupplierCredit {
  id: string;
  business_id: string;
  supplier_name: string;
  credit_limit: number;
  current_balance: number;
  terms: string;
}

export interface TenantPendingRestock {
  id: string;
  business_id: string;
  item_id: string;
  item_name: string;
  requested_quantity: number;
  notes?: string;
  submitted_by_uid: string;
  submitted_by_email: string;
  status: 'pending' | 'validation' | 'approved' | 'rejected';
  created_at: string;
}

export interface TenantActivityLog {
  id: string;
  business_id: string;
  action: string;
  details: string;
  performed_by_uid: string;
  performed_by_email: string;
  timestamp: string;
}

export interface TenantNotification {
  id: string;
  business_id: string;
  recipient_uid?: string;
  title: string;
  body: string;
  is_read: boolean;
  type: 'stock_alert' | 'pending_restock' | 'credit_due' | 'system';
  created_at: string;
}

export interface TenantInvoice {
  id: string;
  business_id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  pdf_url?: string;
  created_at: string;
}

export interface TenantReport {
  id: string;
  business_id: string;
  period: string;
  total_sales: number;
  created_at: string;
}



