import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Quote {
  id: string;
  factory: string;
  material: string;
  quality: string;
  thickness: string;
  size: string;
  colorType?: string;
  selectedColor?: string;
  selectedColorHex?: string;
  surface: string;
  colorMixingCost: number;
  processing: string;
  processingName: string;
  totalPrice: number;
  quantity: number;
  breakdown: { label: string; price: number }[];
  createdAt: Date;
  serialNumber?: string;
}

interface QuoteContextType {
  quotes: Quote[];
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  removeQuote: (id: string) => void;
  updateQuoteQuantity: (id: string, quantity: number) => void;
  clearQuotes: () => void;
  getTotalPrice: () => number;
  getTotalPriceWithTax: () => number;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

export const useQuotes = () => {
  const context = useContext(QuoteContext);
  if (!context) {
    throw new Error('useQuotes must be used within a QuoteProvider');
  }
  return context;
};

interface QuoteProviderProps {
  children: ReactNode;
}

export const QuoteProvider: React.FC<QuoteProviderProps> = ({ children }) => {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  const addQuote = (quoteData: Omit<Quote, 'id' | 'createdAt'>) => {
    const newQuote: Quote = {
      ...quoteData,
      id: Date.now().toString(),
      createdAt: new Date()
    };
    setQuotes(prev => [...prev, newQuote]);
  };

  const removeQuote = (id: string) => {
    setQuotes(prev => prev.filter(quote => quote.id !== id));
  };

  const updateQuoteQuantity = (id: string, quantity: number) => {
    setQuotes(prev => prev.map(quote => 
      quote.id === id ? { ...quote, quantity: Math.max(1, quantity) } : quote
    ));
  };

  const clearQuotes = () => {
    setQuotes([]);
  };

  const getTotalPrice = () => {
    return quotes.reduce((total, quote) => total + (quote.totalPrice * quote.quantity), 0);
  };

  const getTotalPriceWithTax = () => {
    const subtotal = getTotalPrice();
    return subtotal * 1.1; // 10% 부가세 추가
  };

  return (
    <QuoteContext.Provider value={{
      quotes,
      addQuote,
      removeQuote,
      updateQuoteQuantity,
      clearQuotes,
      getTotalPrice,
      getTotalPriceWithTax
    }}>
      {children}
    </QuoteContext.Provider>
  );
};
