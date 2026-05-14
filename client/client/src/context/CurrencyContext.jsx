import React, { createContext, useContext, useState, useEffect } from 'react';

const currencySymbols = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'C$',
  INR: '₹',
};

const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
  const [currency, setCurrencyState] = useState('USD');
  const symbol = currencySymbols[currency] || '$';

  // On mount, load currency from localStorage if available
  useEffect(() => {
    const stored = localStorage.getItem('selectedCurrency');
    if (stored && currencySymbols[stored]) {
      setCurrencyState(stored);
    }
  }, []);

  // When currency changes, save to localStorage
  const setCurrency = (newCurrency) => {
    setCurrencyState(newCurrency);
    localStorage.setItem('selectedCurrency', newCurrency);
  };

  return (
    <CurrencyContext.Provider value={{ currency, symbol, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
} 