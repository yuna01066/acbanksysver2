import React, { createContext, useContext, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

export interface QuoteRecipient {
  projectName: string;
  quoteNumber: string;
  quoteDate: Date | null;
  validUntil: string;
  deliveryPeriod: string;
  paymentCondition: string;
  companyName: string;
  contactPerson: string;
  phoneNumber: string;
  email: string;
  desiredDeliveryDate: Date | null;
  deliveryAddress: string;
  clientMemo: string;
  // 발신 담당자 정보
  issuerName?: string;
  issuerEmail?: string;
  issuerPhone?: string;
  issuerDepartment?: string;
  issuerPosition?: string;
  // 첨부 파일
  attachments?: Attachment[];
}

interface QuoteContextType {
  quotes: Quote[];
  recipient: QuoteRecipient | null;
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  removeQuote: (id: string) => void;
  updateQuoteQuantity: (id: string, quantity: number) => void;
  clearQuotes: () => void;
  getTotalPrice: () => number;
  getTotalPriceWithTax: () => number;
  updateRecipient: (recipient: QuoteRecipient) => void;
  generateQuoteNumber: () => string;
  updateAttachments: (attachments: Attachment[]) => void;
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
  const [recipient, setRecipient] = useState<QuoteRecipient | null>(null);
  const [quoteNumber, setQuoteNumber] = useState<string>('');

  // 견적번호 생성 함수
  const generateQuoteNumber = () => {
    if (quoteNumber) {
      return quoteNumber;
    }
    
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 100) + 1).padStart(2, '0');
    
    const newQuoteNumber = `${month}${day}${hour}${minute}${sequence}`;
    setQuoteNumber(newQuoteNumber);
    return newQuoteNumber;
  };

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
    // 첨부 파일 삭제
    if (recipient?.attachments && recipient.attachments.length > 0) {
      recipient.attachments.forEach(async (attachment) => {
        try {
          await supabase.storage
            .from('quote-attachments')
            .remove([attachment.path]);
        } catch (error) {
          console.error('Error removing attachment:', error);
        }
      });
    }
    setQuotes([]);
    setRecipient(null);
    setQuoteNumber('');
  };

  const updateRecipient = (newRecipient: QuoteRecipient) => {
    setRecipient(newRecipient);
  };

  const updateAttachments = (attachments: Attachment[]) => {
    setRecipient(prev => prev ? { ...prev, attachments } : null);
  };

  const getTotalPrice = () => {
    const total = quotes.reduce((sum, quote) => sum + (quote.totalPrice * quote.quantity), 0);
    return Math.round(total / 100) * 100; // 100원 단위로 반올림
  };

  const getTotalPriceWithTax = () => {
    const subtotal = getTotalPrice();
    const totalWithTax = subtotal * 1.1; // 10% 부가세 추가
    return Math.round(totalWithTax / 100) * 100; // 100원 단위로 반올림
  };

  return (
    <QuoteContext.Provider value={{
      quotes,
      recipient,
      addQuote,
      removeQuote,
      updateQuoteQuantity,
      clearQuotes,
      getTotalPrice,
      getTotalPriceWithTax,
      updateRecipient,
      generateQuoteNumber,
      updateAttachments
    }}>
      {children}
    </QuoteContext.Provider>
  );
};
