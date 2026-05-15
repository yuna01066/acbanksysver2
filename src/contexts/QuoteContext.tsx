import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  deleteStoredFile,
  getAttachmentTarget,
  removeDocumentFileRecord,
  type DocumentSyncStatus,
  type StorageProvider,
} from '@/services/documentFiles';

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
  customColorName?: string;
  customOpacity?: string;
  surface: string;
  colorMixingCost: number;
  processing: string;
  processingName: string;
  totalPrice: number;
  quantity: number;
  breakdown: { label: string; price: number }[];
  pricingVersionId?: string | null;
  pricingVersionName?: string;
  quoteStyle?: 'panel' | 'fabrication' | 'space' | 'mixed';
  calculationSnapshot?: {
    schemaVersion: number;
    capturedAt: string;
    pricingVersion?: {
      id?: string | null;
      versionName?: string;
      supplierName?: string;
      effectiveFrom?: string;
    } | null;
    selectedOptions?: Record<string, unknown>;
    breakdown: { label: string; price: number }[];
    totalPrice: number;
    note?: string;
  };
  createdAt: Date;
  serialNumber?: string;
}

export interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
  documentFileId?: string | null;
  storageProvider?: StorageProvider;
  storageBucket?: string;
  storagePath?: string;
  driveFileId?: string | null;
  driveFolderId?: string | null;
  syncStatus?: DocumentSyncStatus;
  pendingDelete?: boolean;
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
  issuerId?: string;
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
  clearQuotes: (options?: { deleteAttachments?: boolean }) => void;
  getTotalPrice: () => number;
  getTotalPriceWithTax: () => number;
  updateRecipient: (recipient: QuoteRecipient) => void;
  generateQuoteNumber: () => string;
  updateAttachments: (attachments: Attachment[]) => void;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);
const QUOTE_DRAFT_STORAGE_KEY = 'acbank_quote_draft_v1';

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

const restoreDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

const loadDraft = (): {
  quotes: Quote[];
  recipient: QuoteRecipient | null;
  quoteNumber: string;
} => {
  if (typeof window === 'undefined') {
    return { quotes: [], recipient: null, quoteNumber: '' };
  }

  try {
    const raw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
    if (!raw) return { quotes: [], recipient: null, quoteNumber: '' };

    const parsed = JSON.parse(raw);
    return {
      quotes: Array.isArray(parsed.quotes)
        ? parsed.quotes.map((quote: Quote & { createdAt?: string }) => ({
          ...quote,
          createdAt: restoreDate(quote.createdAt) || new Date(),
        }))
        : [],
      recipient: parsed.recipient ? {
        ...parsed.recipient,
        quoteDate: restoreDate(parsed.recipient.quoteDate),
        desiredDeliveryDate: restoreDate(parsed.recipient.desiredDeliveryDate),
      } : null,
      quoteNumber: typeof parsed.quoteNumber === 'string' ? parsed.quoteNumber : '',
    };
  } catch (error) {
    console.warn('Failed to restore quote draft:', error);
    return { quotes: [], recipient: null, quoteNumber: '' };
  }
};

export const QuoteProvider: React.FC<QuoteProviderProps> = ({ children }) => {
  const [initialDraft] = useState(loadDraft);
  const [quotes, setQuotes] = useState<Quote[]>(initialDraft.quotes);
  const [recipient, setRecipient] = useState<QuoteRecipient | null>(initialDraft.recipient);
  const [quoteNumber, setQuoteNumber] = useState<string>(initialDraft.quoteNumber);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (quotes.length === 0 && !recipient && !quoteNumber) {
      window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, JSON.stringify({
      quotes,
      recipient,
      quoteNumber,
      savedAt: new Date().toISOString(),
    }));
  }, [quotes, recipient, quoteNumber]);

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

  const clearQuotes = (options: { deleteAttachments?: boolean } = {}) => {
    const shouldDeleteAttachments = options.deleteAttachments ?? true;

    if (shouldDeleteAttachments && recipient?.attachments && recipient.attachments.length > 0) {
      recipient.attachments.forEach(async (attachment) => {
        try {
          await deleteStoredFile(getAttachmentTarget(attachment, 'quote-attachments'));
          await removeDocumentFileRecord(attachment.documentFileId);
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
