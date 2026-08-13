// Global Currency Conversion & Exchange Rate Utility Service

export interface ExchangeRateCache {
  rates: Record<string, number>;
  isOutdated: boolean;
  lastUpdated: number;
}

// Fallback rate dictionary relative to 1 USD in case of initial offline startup
export const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 155.0,
  CNY: 7.23,
  INR: 83.5,
  CHF: 0.91,
  BRL: 5.15,
  RUB: 91.0,
  ZAR: 18.4,
  MXN: 16.7,
  NZD: 1.64,
  SGD: 1.35,
  HKD: 7.82,
  SEK: 10.8,
  NOK: 10.9,
  KRW: 1360.0,
  TRY: 32.3,
  AED: 3.67,
  AFN: 72.0,
  ALL: 93.0,
  DZD: 134.0,
  AOA: 850.0,
  ARS: 880.0,
  AMD: 388.0,
  AZN: 1.70,
  BSD: 1.0,
  BHD: 0.376,
  BDT: 117.0,
  BBD: 2.0,
  BYN: 3.27,
  BZD: 2.0,
  XOF: 603.0,
  BMD: 1.0,
  BTN: 83.5,
  BOB: 6.91,
  BAM: 1.80,
  BWP: 13.6,
  BND: 1.35,
  BGN: 1.80,
  BIF: 2870.0,
  KHR: 4080.0,
  XAF: 603.0,
  CVE: 101.0,
  CLP: 930.0,
  COP: 3890.0,
  KMF: 452.0,
  CRC: 512.0,
  CUP: 24.0,
  CZK: 23.0,
  CDF: 2800.0,
  DKK: 6.86,
  DJF: 177.7,
  DOP: 59.0,
  EGP: 47.0,
  ERN: 15.0,
  SZL: 18.4,
  ETB: 57.0,
  FJD: 2.25,
  GMD: 67.5,
  GEL: 2.70,
  GHS: 14.2,
  GTQ: 7.75,
  GNF: 8600.0,
  GYD: 209.0,
  HTG: 132.0,
  HNL: 24.7,
  HUF: 360.0,
  ISK: 138.0,
  IDR: 16000.0,
  IRR: 42000.0,
  IQD: 1310.0,
  ILS: 3.70,
  JMD: 156.0,
  JOD: 0.709,
  KZT: 443.0,
  KES: 130.0,
  KWD: 0.307,
  KGS: 88.0,
  LAK: 21300.0,
  LBP: 89500.0,
  LSL: 18.4,
  LRD: 194.0,
  LYD: 4.85,
  MAD: 10.0,
  MWK: 1730.0,
  MYR: 4.74,
  MVR: 15.4,
  MUR: 46.5,
  MDL: 17.7,
  MNT: 3450.0,
  MZN: 63.8,
  MMK: 2100.0,
  NAD: 18.4,
  NPR: 133.5,
  NIO: 36.8,
  NGN: 1450.0,
  OMR: 0.385,
  PKR: 278.0,
  PAB: 1.0,
  PGK: 3.85,
  PYG: 7500.0,
  PEN: 3.73,
  PHP: 57.5,
  PLN: 3.97,
  QAR: 3.64,
  RON: 4.58,
  RWF: 1300.0,
  SAR: 3.75,
  RSD: 108.0,
  SCR: 13.5,
  SLL: 22500.0,
  SOS: 570.0,
  LKR: 300.0,
  SDG: 600.0,
  SRD: 31.5,
  TWD: 32.3,
  TJS: 10.9,
  TZS: 2600.0,
  THB: 36.7,
  TOP: 2.35,
  TTD: 6.78,
  TND: 3.12,
  UGX: 3770.0,
  UAH: 39.6,
  UYU: 38.5,
  UZS: 12600.0,
  VUV: 119.0,
  VES: 36.5,
  VND: 25400.0,
  YER: 250.0,
  ZMW: 26.8,
  ZWG: 13.5
};

const CACHE_KEY = 'velo_exchange_rates_cache';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 Hours

export function getCachedExchangeRates(): ExchangeRateCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.rates) {
        const age = Date.now() - (parsed.lastUpdated || 0);
        return {
          rates: { ...FALLBACK_RATES, ...parsed.rates },
          isOutdated: age > CACHE_TTL_MS || !!parsed.isOutdated,
          lastUpdated: parsed.lastUpdated || Date.now()
        };
      }
    }
  } catch (err) {
    console.warn('Failed to read exchange rate cache:', err);
  }
  return {
    rates: FALLBACK_RATES,
    isOutdated: true,
    lastUpdated: Date.now()
  };
}

export async function fetchLiveExchangeRates(): Promise<ExchangeRateCache> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch('https://open.er-api.com/v6/latest/USD', { 
      signal: controller.signal,
      cache: 'no-cache' 
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data && data.rates && typeof data.rates === 'object') {
        const cachePayload: ExchangeRateCache = {
          rates: { ...FALLBACK_RATES, ...data.rates },
          isOutdated: false,
          lastUpdated: Date.now()
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
        return cachePayload;
      }
    }
  } catch (err) {
    console.warn('Live exchange rate API fetch failed, using fallback cache:', err);
  }
  
  const fallback = getCachedExchangeRates();
  fallback.isOutdated = true;
  return fallback;
}

export function getRateForCurrency(rates: Record<string, number>, targetCurrency: string): number {
  if (!targetCurrency || targetCurrency === 'USD') return 1.0;
  const rate = rates[targetCurrency.toUpperCase()];
  if (typeof rate === 'number' && rate > 0) {
    return rate;
  }
  return FALLBACK_RATES[targetCurrency.toUpperCase()] || 1.0;
}

/**
 * Converts stored base USD amount to display amount in target currency
 */
export function convertFromBaseUSD(amountUSD: number, targetCurrency: string, rates?: Record<string, number>): number {
  if (typeof amountUSD !== 'number' || isNaN(amountUSD)) return 0;
  const activeRates = rates || getCachedExchangeRates().rates;
  const rate = getRateForCurrency(activeRates, targetCurrency);
  return amountUSD * rate;
}

/**
 * Converts user input amount from display currency back to stored base USD
 */
export function convertToBaseUSD(amountDisplay: number, displayCurrency: string, rates?: Record<string, number>): number {
  if (typeof amountDisplay !== 'number' || isNaN(amountDisplay)) return 0;
  const activeRates = rates || getCachedExchangeRates().rates;
  const rate = getRateForCurrency(activeRates, displayCurrency);
  return amountDisplay / rate;
}

/**
 * Formats USD amount into display currency string with symbol and 2 decimal places
 */
export function formatCurrencyAmount(
  amountUSD: number, 
  displayCurrency: string, 
  currencySymbol: string = '$',
  rates?: Record<string, number>
): string {
  const safeUSD = (typeof amountUSD === 'number' && !isNaN(amountUSD)) ? amountUSD : 0;
  const converted = convertFromBaseUSD(safeUSD, displayCurrency, rates);
  const safeConverted = (typeof converted === 'number' && !isNaN(converted)) ? converted : 0;
  const formattedNum = safeConverted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${currencySymbol}${formattedNum}`;
}
