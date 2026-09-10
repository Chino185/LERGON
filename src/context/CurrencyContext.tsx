import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  ExchangeRateCache,
  getCachedExchangeRates,
  fetchLiveExchangeRates,
  getRateForCurrency
} from '../utils/currencyUtils';

interface CurrencyContextType {
  currency: string;             // e.g. "USD", "EUR", "GBP"
  currencySymbol: string;       // e.g. "$", "€", "£"
  rates: Record<string, number>;
  isRateOutdated: boolean;
  rateMultiplier: number;       // Rate multiplier relative to USD
  convertFromBase: (usdAmount: number) => number;
  convertToBase: (displayAmount: number) => number;
  formatAmount: (usdAmount: number) => string;
  formatCSVAmount: (usdAmount: number) => string;
  refreshRates: () => Promise<void>;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export interface CurrencyProviderProps {
  currency: string;
  currencySymbol: string;
  children: ReactNode;
}

export const CurrencyProvider: React.FC<CurrencyProviderProps> = ({
  currency = 'USD',
  currencySymbol = '$',
  children
}) => {
  const [ratesData, setRatesData] = useState<ExchangeRateCache>(() => getCachedExchangeRates());

  const refreshRates = async () => {
    const updated = await fetchLiveExchangeRates();
    setRatesData(updated);
  };

  useEffect(() => {
    refreshRates();
    const interval = setInterval(refreshRates, 4 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [currency]);

  const activeRates = ratesData.rates;
  const rateMultiplier = getRateForCurrency(activeRates, currency);

  // Inventory, invoices, credits, and transactions are stored in the
  // business's configured currency. They are not USD-base amounts, so a
  // value entered as 5 in GHS must remain 5 in GHS when saved and read back.
  // Keep these helpers for component compatibility, but make them identity
  // functions rather than silently applying an exchange rate.
  const convertFromBase = (amount: number) => Number.isFinite(amount) ? amount : 0;
  const convertToBase = (amount: number) => Number.isFinite(amount) ? amount : 0;

  const formatAmount = (amount: number) => {
    const safeAmount = Number.isFinite(amount) ? amount : 0;
    return `${currencySymbol}${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatCSVAmount = (amount: number) => {
    const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : 0;
    return `${currencySymbol}${safeAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <CurrencyContext.Provider value={{
      currency,
      currencySymbol,
      rates: activeRates,
      isRateOutdated: ratesData.isOutdated,
      rateMultiplier,
      convertFromBase,
      convertToBase,
      formatAmount,
      formatCSVAmount,
      refreshRates
    }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = (): CurrencyContextType => {
  const context = useContext(CurrencyContext);
  if (!context) {
    const fallbackRates = getCachedExchangeRates().rates;
    return {
      currency: 'USD',
      currencySymbol: '$',
      rates: fallbackRates,
      isRateOutdated: false,
      rateMultiplier: 1.0,
      convertFromBase: (usd) => (typeof usd === 'number' && !isNaN(usd)) ? usd : 0,
      convertToBase: (disp) => (typeof disp === 'number' && !isNaN(disp)) ? disp : 0,
      formatAmount: (usd) => {
        const val = (typeof usd === 'number' && !isNaN(usd)) ? usd : 0;
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
      formatCSVAmount: (usd) => {
        const val = (typeof usd === 'number' && !isNaN(usd)) ? usd : 0;
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      },
      refreshRates: async () => {}
    };
  }
  return context;
};
