import { InventoryItem, StockAdjustment, CreditAccount, CreditTransaction, BusinessConfig } from './types';

export const INITIAL_BUSINESS_CONFIG: BusinessConfig = {
  businessName: 'My Business',
  ownerName: 'Administrator',
  phone: '',
  email: '',
  address: '',
  currency: 'USD',
  currencySymbol: '$',
  lowStockThresholdDefault: 3,
  country: 'United States',
  language: 'English',
  languageCode: 'en',
  themeMode: 'light',
  adminPhone: '',
  attendantPhone: ''
};

export const INITIAL_INVENTORY: InventoryItem[] = [];

export const INITIAL_ADJUSTMENTS: StockAdjustment[] = [];

export const INITIAL_CREDIT_ACCOUNTS: CreditAccount[] = [];

export const INITIAL_CREDIT_TRANSACTIONS: CreditTransaction[] = [];

export function getLocalState<T>(key: string, defaultValue: T): T {
  try {
    const val = localStorage.getItem(key);
    if (val) {
      return JSON.parse(val);
    }
  } catch (error) {
    console.error(`Error loading state ${key}`, error);
  }
  return defaultValue;
}

export function saveLocalState<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving state ${key}`, error);
  }
}
