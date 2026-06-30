import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import {
  deleteStoredFile,
  getAttachmentTarget,
  removeDocumentFileRecord,
  type DocumentSyncStatus,
  type StorageProvider,
} from '@/services/documentFiles';
import { useAuth } from '@/contexts/AuthContext';
import {
  archiveQuoteDraft,
  buildQuoteDraftTitle,
  createQuoteDraft,
  duplicateQuoteDraft,
  getQuoteDraft,
  listQuoteDrafts,
  updateQuoteDraft,
  type QuoteDraftRecord,
} from '@/services/quoteDrafts';
import { detectQuoteStyleFromItems } from '@/utils/quoteStyle';
import { secureRandomNumericString } from '@/utils/secureRandom';
import { createQuoteItemId, normalizeQuoteItems } from '@/utils/quoteItemIdentity';

export interface Quote {
  id: string;
  itemTitle?: string;
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
    snapshotVersion?: string;
    formulaDocVersion?: number;
    calculationEngineVersion?: string;
    calculationStatus?: 'calculable' | 'needs_review' | 'blocked' | string;
    calculationWarnings?: string[];
    calculationBlockedReasons?: string[];
    calculationLineItems?: unknown[];
    quantityContext?: Record<string, unknown>;
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
  activeDraftId: string | null;
  draftTitle: string;
  draftSaveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'offline';
  draftLastSavedAt: Date | null;
  draftError: string | null;
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  updateQuote: (id: string, quote: Omit<Quote, 'id' | 'createdAt'>) => void;
  removeQuote: (id: string) => void;
  updateQuoteQuantity: (id: string, quantity: number) => void;
  clearQuotes: (options?: { deleteAttachments?: boolean }) => void;
  getTotalPrice: () => number;
  getTotalPriceWithTax: () => number;
  updateRecipient: (recipient: QuoteRecipient) => void;
  generateQuoteNumber: () => string;
  updateAttachments: (attachments: Attachment[]) => void;
  setDraftTitle: (title: string) => void;
  saveDraftNow: () => Promise<string | null>;
  createDraft: (title?: string) => Promise<string | null>;
  loadDraft: (id: string) => Promise<boolean>;
  duplicateActiveDraft: () => Promise<string | null>;
  archiveActiveDraft: () => Promise<boolean>;
  markActiveDraftIssued: (quoteId: string) => Promise<void>;
}

const QuoteContext = createContext<QuoteContextType | undefined>(undefined);
const QUOTE_DRAFT_STORAGE_KEY = 'acbank_quote_draft_v1';
const USER_QUOTE_DRAFT_MIRROR_PREFIX = 'acbank_quote_draft_mirror_v1';
const ACTIVE_DRAFT_STORAGE_PREFIX = 'acbank_active_quote_draft_id';

const createBlankRecipient = (quoteNumber = ''): QuoteRecipient => ({
  projectName: '',
  quoteNumber,
  quoteDate: new Date(),
  validUntil: '',
  deliveryPeriod: '',
  paymentCondition: '',
  companyName: '',
  contactPerson: '',
  phoneNumber: '',
  email: '',
  desiredDeliveryDate: null,
  deliveryAddress: '',
  clientMemo: '',
  attachments: [],
});

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

const parseLocalDraftPayload = (raw: string | null): {
  quotes: Quote[];
  recipient: QuoteRecipient | null;
  quoteNumber: string;
} => {
  try {
    if (!raw) return { quotes: [], recipient: null, quoteNumber: '' };

    const parsed = JSON.parse(raw);
    return {
      quotes: Array.isArray(parsed.quotes)
        ? normalizeQuoteItems(parsed.quotes.map((quote: Quote & { createdAt?: string }) => ({
          ...quote,
          createdAt: restoreDate(quote.createdAt) || new Date(),
        })))
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

const loadLocalDraft = () => {
  if (typeof window === 'undefined') {
    return { quotes: [], recipient: null, quoteNumber: '' };
  }

  return parseLocalDraftPayload(window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY));
};

export const QuoteProvider: React.FC<QuoteProviderProps> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [initialDraft] = useState(loadLocalDraft);
  const [quotes, setQuotes] = useState<Quote[]>(initialDraft.quotes);
  const [recipient, setRecipient] = useState<QuoteRecipient | null>(initialDraft.recipient);
  const [quoteNumber, setQuoteNumber] = useState<string>(initialDraft.quoteNumber);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftTitle, setDraftTitleState] = useState<string>(buildQuoteDraftTitle(initialDraft.recipient));
  const [draftSaveStatus, setDraftSaveStatus] = useState<QuoteContextType['draftSaveStatus']>('idle');
  const [draftLastSavedAt, setDraftLastSavedAt] = useState<Date | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const hydratedUserRef = useRef<string | null>(null);
  const isHydratingDraftRef = useRef(false);
  const lastSavedSignatureRef = useRef<string>('');
  const activeDraftIdRef = useRef<string | null>(null);
  const quotesRef = useRef<Quote[]>(quotes);
  const recipientRef = useRef<QuoteRecipient | null>(recipient);
  const quoteNumberRef = useRef<string>(quoteNumber);
  const draftTitleRef = useRef<string>(draftTitle);

  useEffect(() => { activeDraftIdRef.current = activeDraftId; }, [activeDraftId]);
  useEffect(() => { quotesRef.current = quotes; }, [quotes]);
  useEffect(() => { recipientRef.current = recipient; }, [recipient]);
  useEffect(() => { quoteNumberRef.current = quoteNumber; }, [quoteNumber]);
  useEffect(() => { draftTitleRef.current = draftTitle; }, [draftTitle]);

  const activeDraftStorageKey = user ? `${ACTIVE_DRAFT_STORAGE_PREFIX}:${user.id}` : null;

  const hasDraftContent = (items = quotesRef.current, currentRecipient = recipientRef.current) => {
    if (items.length > 0) return true;
    if (!currentRecipient) return false;
    return Object.entries(currentRecipient).some(([key, value]) => {
      if (key === 'attachments') return Array.isArray(value) && value.length > 0;
      if (value instanceof Date) return true;
      return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
    });
  };

  const buildDraftRecipient = () => {
    const currentRecipient = recipientRef.current;
    if (!currentRecipient && !quoteNumberRef.current) return null;
    if (!currentRecipient) {
      return null;
    }
    return {
      ...currentRecipient,
      quoteNumber: quoteNumberRef.current || currentRecipient.quoteNumber || '',
    };
  };

  const buildDraftSignature = () => JSON.stringify({
    activeDraftId: activeDraftIdRef.current,
    title: draftTitleRef.current,
    quotes: quotesRef.current,
    recipient: buildDraftRecipient(),
  });

  const persistDraft = async (mode: 'auto' | 'manual' = 'auto'): Promise<string | null> => {
    if (!user) {
      setDraftSaveStatus('offline');
      return null;
    }

    const currentQuotes = normalizeQuoteItems(quotesRef.current);
    const currentRecipient = buildDraftRecipient();
    const currentTitle = draftTitleRef.current || buildQuoteDraftTitle(currentRecipient);

    if (!hasDraftContent(currentQuotes, currentRecipient) && !activeDraftIdRef.current) {
      setDraftSaveStatus('idle');
      return null;
    }

    const signature = buildDraftSignature();
    if (mode === 'auto' && signature === lastSavedSignatureRef.current) {
      return activeDraftIdRef.current;
    }

    setDraftSaveStatus('saving');
    setDraftError(null);
    try {
      const quoteStyle = detectQuoteStyleFromItems(currentQuotes);
      const draftId = activeDraftIdRef.current;
      const savedDraft = draftId
        ? await updateQuoteDraft(draftId, {
          title: currentTitle,
          recipient: currentRecipient,
          items: currentQuotes,
          quoteStyle,
        })
        : await createQuoteDraft({
          userId: user.id,
          title: currentTitle,
          recipient: currentRecipient,
          items: currentQuotes,
          quoteStyle,
        });

      setActiveDraftId(savedDraft.id);
      setDraftTitleState(savedDraft.title);
      setDraftLastSavedAt(new Date());
      setDraftSaveStatus('saved');
      lastSavedSignatureRef.current = JSON.stringify({
        activeDraftId: savedDraft.id,
        title: savedDraft.title,
        quotes: savedDraft.items,
        recipient: savedDraft.recipient,
      });
      if (activeDraftStorageKey) window.localStorage.setItem(activeDraftStorageKey, savedDraft.id);
      return savedDraft.id;
    } catch (error) {
      console.error('Failed to save quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError(error instanceof Error ? error.message : '초안 저장에 실패했습니다.');
      return null;
    }
  };

  const applyDraft = async (draft: QuoteDraftRecord) => {
    const normalizedDraftItems = normalizeQuoteItems(draft.items);
    isHydratingDraftRef.current = true;
    try {
      setQuotes(normalizedDraftItems);
      setRecipient(draft.recipient);
      setQuoteNumber(draft.recipient?.quoteNumber || '');
      setActiveDraftId(draft.id);
      setDraftTitleState(draft.title);
      setDraftSaveStatus('saved');
      setDraftLastSavedAt(draft.updated_at ? new Date(draft.updated_at) : new Date());
      setDraftError(null);
      lastSavedSignatureRef.current = JSON.stringify({
        activeDraftId: draft.id,
        title: draft.title,
        quotes: normalizedDraftItems,
        recipient: draft.recipient,
      });
      if (activeDraftStorageKey) window.localStorage.setItem(activeDraftStorageKey, draft.id);
      await updateQuoteDraft(draft.id, { lastOpenedAt: new Date().toISOString() });
    } finally {
      isHydratingDraftRef.current = false;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user) return;

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
  }, [quotes, recipient, quoteNumber, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const mirrorKey = `${USER_QUOTE_DRAFT_MIRROR_PREFIX}:${user.id}`;
    if (quotes.length === 0 && !recipient && !quoteNumber) {
      window.localStorage.removeItem(mirrorKey);
      return;
    }

    window.localStorage.setItem(mirrorKey, JSON.stringify({
      quotes,
      recipient,
      quoteNumber,
      savedAt: new Date().toISOString(),
    }));
  }, [quotes, recipient, quoteNumber, user]);

  useEffect(() => {
    if (authLoading || !user || typeof window === 'undefined') return;
    if (hydratedUserRef.current === user.id) return;

    hydratedUserRef.current = user.id;

    const hydrate = async () => {
      isHydratingDraftRef.current = true;
      try {
        const localRaw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
        const localHasContent = hasDraftContent(quotesRef.current, recipientRef.current);

        if (localRaw && localHasContent) {
          const migrated = await createQuoteDraft({
            userId: user.id,
            title: '이전 작업 초안',
            recipient: buildDraftRecipient(),
            items: quotesRef.current,
            quoteStyle: detectQuoteStyleFromItems(quotesRef.current),
          });
          setActiveDraftId(migrated.id);
          setDraftTitleState(migrated.title);
          setDraftSaveStatus('saved');
          setDraftLastSavedAt(new Date());
          lastSavedSignatureRef.current = JSON.stringify({
            activeDraftId: migrated.id,
            title: migrated.title,
            quotes: migrated.items,
            recipient: migrated.recipient,
          });
          window.localStorage.setItem(`${ACTIVE_DRAFT_STORAGE_PREFIX}:${user.id}`, migrated.id);
          window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
          return;
        }

        const storedDraftId = window.localStorage.getItem(`${ACTIVE_DRAFT_STORAGE_PREFIX}:${user.id}`);
        if (storedDraftId) {
          try {
            const draft = await getQuoteDraft(storedDraftId);
            if (draft.status === 'active') {
              await applyDraft(draft);
              return;
            }
          } catch (error) {
            console.warn('Stored quote draft could not be restored:', error);
            window.localStorage.removeItem(`${ACTIVE_DRAFT_STORAGE_PREFIX}:${user.id}`);
          }
        }

        if (!hasDraftContent(quotesRef.current, recipientRef.current)) {
          const mirrorDraft = parseLocalDraftPayload(
            window.localStorage.getItem(`${USER_QUOTE_DRAFT_MIRROR_PREFIX}:${user.id}`)
          );
          if (mirrorDraft.quotes.length > 0 || mirrorDraft.recipient) {
            setQuotes(mirrorDraft.quotes);
            setRecipient(mirrorDraft.recipient);
            setQuoteNumber(mirrorDraft.quoteNumber);
            setDraftTitleState(buildQuoteDraftTitle(mirrorDraft.recipient));
            setDraftSaveStatus('offline');
            setDraftError('서버 초안 복구 전 로컬 임시 저장 상태를 먼저 불러왔습니다. 필요하면 초안 저장을 눌러 서버에 저장하세요.');
            return;
          }

          const drafts = await listQuoteDrafts('active');
          if (drafts.length > 0) {
            await applyDraft(drafts[0]);
          }
        }
      } finally {
        isHydratingDraftRef.current = false;
      }
    };

    hydrate();
  }, [authLoading, user]);

  useEffect(() => {
    if (!user || isHydratingDraftRef.current) return;
    if (!hasDraftContent(quotes, recipient) && !activeDraftId) return;

    setDraftSaveStatus(prev => prev === 'offline' ? 'idle' : prev);
    const timer = window.setTimeout(() => {
      persistDraft('auto');
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [quotes, recipient, quoteNumber, draftTitle, activeDraftId, user]);

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
    const sequence = secureRandomNumericString(0, 99, 2);
    
    const newQuoteNumber = `${month}${day}${hour}${minute}${sequence}`;
    setQuoteNumber(newQuoteNumber);
    return newQuoteNumber;
  };

  const addQuote = (quoteData: Omit<Quote, 'id' | 'createdAt'>) => {
    const newQuote: Quote = {
      ...quoteData,
      id: createQuoteItemId(),
      createdAt: new Date()
    };
    setQuotes(prev => [...prev, newQuote]);
  };

  const updateQuote = (id: string, quoteData: Omit<Quote, 'id' | 'createdAt'>) => {
    setQuotes(prev => prev.map(quote =>
      quote.id === id
        ? {
          ...quote,
          ...quoteData,
          id: quote.id,
          createdAt: quote.createdAt,
        }
        : quote
    ));
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
    const draftIdToClear = activeDraftIdRef.current;

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

    if (user && draftIdToClear) {
      updateQuoteDraft(draftIdToClear, {
        recipient: null,
        items: [],
        quoteStyle: 'panel',
      }).then(() => {
        setDraftSaveStatus('saved');
        setDraftLastSavedAt(new Date());
        lastSavedSignatureRef.current = JSON.stringify({
          activeDraftId: draftIdToClear,
          title: draftTitleRef.current,
          quotes: [],
          recipient: null,
        });
      }).catch((error) => {
        console.error('Failed to clear quote draft:', error);
        setDraftSaveStatus('error');
      });
    }
  };

  const updateRecipient = (newRecipient: QuoteRecipient) => {
    setRecipient(newRecipient);
  };

  const updateAttachments = (attachments: Attachment[]) => {
    setRecipient(prev => prev
      ? { ...prev, attachments }
      : { ...createBlankRecipient(quoteNumberRef.current || quoteNumber), attachments }
    );
  };

  const setDraftTitle = (title: string) => {
    setDraftTitleState(title);
  };

  const saveDraftNow = async () => persistDraft('manual');

  const createDraftAction = async (title?: string) => {
    if (!user) {
      setDraftSaveStatus('offline');
      return null;
    }

    if (hasDraftContent() || activeDraftIdRef.current) {
      await persistDraft('manual');
    }

    try {
      const draft = await createQuoteDraft({
        userId: user.id,
        title: title || '새 견적 초안',
        recipient: null,
        items: [],
        quoteStyle: 'panel',
      });
      await applyDraft(draft);
      return draft.id;
    } catch (error) {
      console.error('Failed to create quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError(error instanceof Error ? error.message : '초안 생성에 실패했습니다.');
      return null;
    }
  };

  const loadDraftAction = async (id: string) => {
    if (activeDraftIdRef.current === id) return true;

    if (hasDraftContent() || activeDraftIdRef.current) {
      await persistDraft('manual');
    }

    try {
      const draft = await getQuoteDraft(id);
      if (draft.status !== 'active') {
        setDraftError('활성 초안만 열 수 있습니다.');
        setDraftSaveStatus('error');
        return false;
      }
      await applyDraft(draft);
      return true;
    } catch (error) {
      console.error('Failed to load quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError(error instanceof Error ? error.message : '초안을 불러오지 못했습니다.');
      return false;
    }
  };

  const duplicateActiveDraft = async () => {
    const draftId = await persistDraft('manual');
    if (!draftId) return null;

    try {
      const duplicated = await duplicateQuoteDraft(draftId);
      await applyDraft(duplicated);
      return duplicated.id;
    } catch (error) {
      console.error('Failed to duplicate quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError(error instanceof Error ? error.message : '초안 복제에 실패했습니다.');
      return null;
    }
  };

  const archiveActiveDraft = async () => {
    const draftId = activeDraftIdRef.current;
    if (!draftId) return false;

    try {
      await archiveQuoteDraft(draftId);
      if (activeDraftStorageKey) window.localStorage.removeItem(activeDraftStorageKey);
      isHydratingDraftRef.current = true;
      setQuotes([]);
      setRecipient(null);
      setQuoteNumber('');
      setActiveDraftId(null);
      setDraftTitleState('새 견적 초안');
      setDraftSaveStatus('idle');
      setDraftLastSavedAt(null);
      setDraftError(null);
      quotesRef.current = [];
      recipientRef.current = null;
      quoteNumberRef.current = '';
      activeDraftIdRef.current = null;
      draftTitleRef.current = '새 견적 초안';
      lastSavedSignatureRef.current = '';
      isHydratingDraftRef.current = false;
      return true;
    } catch (error) {
      console.error('Failed to archive quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError(error instanceof Error ? error.message : '초안 보관에 실패했습니다.');
      return false;
    }
  };

  const markActiveDraftIssued = async (quoteId: string) => {
    const draftId = activeDraftIdRef.current;
    if (!draftId) return;
    await updateQuoteDraft(draftId, {
      status: 'issued',
      issuedQuoteId: quoteId,
      issuedAt: new Date().toISOString(),
    });
    if (activeDraftStorageKey) window.localStorage.removeItem(activeDraftStorageKey);
    setActiveDraftId(null);
    activeDraftIdRef.current = null;
    lastSavedSignatureRef.current = '';
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
      activeDraftId,
      draftTitle,
      draftSaveStatus,
      draftLastSavedAt,
      draftError,
      addQuote,
      updateQuote,
      removeQuote,
      updateQuoteQuantity,
      clearQuotes,
      getTotalPrice,
      getTotalPriceWithTax,
      updateRecipient,
      generateQuoteNumber,
      updateAttachments,
      setDraftTitle,
      saveDraftNow,
      createDraft: createDraftAction,
      loadDraft: loadDraftAction,
      duplicateActiveDraft,
      archiveActiveDraft,
      markActiveDraftIssued
    }}>
      {children}
    </QuoteContext.Provider>
  );
};
