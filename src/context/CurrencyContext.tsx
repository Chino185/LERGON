import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  ExchangeRateCache,
  getCachedExchangeRates,
  fetchLiveExchangeRates,
  convertFromBaseUSD,
  convertToBaseUSD,
  formatCurrencyAmount,
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

  const convertFromBase = (usdAmount: number) => convertFromBaseUSD(usdAmount, currency, activeRates);
  const convertToBase = (displayAmount: number) => convertToBaseUSD(displayAmount, currency, activeRates);

  const formatAmount = (usdAmount: number) => {
    return formatCurrencyAmount(usdAmount, currency, currencySymbol, activeRates);
  };

  const formatCSVAmount = (usdAmount: number) => {
    const safeUsd = (typeof usdAmount === 'number' && !isNaN(usdAmount)) ? usdAmount : 0;
    const converted = convertFromBase(safeUsd);
    const safeConverted = (typeof converted === 'number' && !isNaN(converted)) ? converted : 0;
    return `${currencySymbol}${safeConverted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
