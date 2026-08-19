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
import { createSerializedTaskQueue } from '@/utils/serializedTaskQueue';
import {
  buildAnonymousQuoteDraftFingerprint,
  getAnonymousQuoteDraftDecisionKey,
  userDeclinedAnonymousQuoteDraft,
} from '@/utils/anonymousQuoteDraft';

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
  anonymousDraftResolutionRequired: boolean;
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
  importAnonymousDraft: () => Promise<boolean>;
  keepAnonymousDraftSeparate: () => boolean;
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
  const [anonymousDraftResolutionRequired, setAnonymousDraftResolutionRequired] = useState(false);
  const [draftHydrationRevision, setDraftHydrationRevision] = useState(0);
  const hydratedUserRef = useRef<string | null>(null);
  const isHydratingDraftRef = useRef(false);
  const anonymousDraftResolutionRequiredRef = useRef(false);
  const draftOwnerUserIdRef = useRef<string | null>(null);
  const lastSavedSignatureRef = useRef<string>('');
  const activeDraftIdRef = useRef<string | null>(null);
  const quotesRef = useRef<Quote[]>(quotes);
  const recipientRef = useRef<QuoteRecipient | null>(recipient);
  const quoteNumberRef = useRef<string>(quoteNumber);
  const draftTitleRef = useRef<string>(draftTitle);
  const draftSaveQueueRef = useRef(createSerializedTaskQueue());
  const draftSaveRequestSequenceRef = useRef(0);
  const draftPersistenceGenerationRef = useRef(0);

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

  const persistAnonymousDraftLocally = () => {
    try {
      const serializedDraft = JSON.stringify({
        quotes: quotesRef.current,
        recipient: recipientRef.current,
        quoteNumber: quoteNumberRef.current,
        savedAt: new Date().toISOString(),
      });
      window.localStorage.setItem(QUOTE_DRAFT_STORAGE_KEY, serializedDraft);
      return serializedDraft;
    } catch (error) {
      console.error('Failed to preserve anonymous quote draft:', error);
      setDraftSaveStatus('error');
      setDraftError('로그인 전 초안을 브라우저에 보관하지 못했습니다. 다시 시도해주세요.');
      return null;
    }
  };

  const persistDraft = (mode: 'auto' | 'manual' = 'auto'): Promise<string | null> => {
    const requestSequence = ++draftSaveRequestSequenceRef.current;
    const persistenceGeneration = draftPersistenceGenerationRef.current;
    const anonymousResolutionPendingAtInvocation = anonymousDraftResolutionRequiredRef.current;

    return draftSaveQueueRef.current.enqueue(async () => {
      // Saves invoked after a terminal archive/issue request are queued behind
      // that mutation. Once it succeeds, its generation changes and these
      // stale saves must not create a replacement draft from leftover UI data.
      if (persistenceGeneration !== draftPersistenceGenerationRef.current) return null;

      if (
        anonymousResolutionPendingAtInvocation
        || anonymousDraftResolutionRequiredRef.current
      ) {
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('offline');
          setDraftError('로그인 전에 작성한 초안을 이 계정으로 가져올지 먼저 선택해주세요.');
        }
        return null;
      }

      if (!user) {
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('offline');
        }
        return null;
      }

      if (draftOwnerUserIdRef.current && draftOwnerUserIdRef.current !== user.id) {
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('offline');
          setDraftError('계정 전환을 확인하는 중입니다. 잠시 후 다시 시도해주세요.');
        }
        return null;
      }

      // Read refs only when this queued task starts so a save waiting behind an
      // in-flight request always persists the newest editor snapshot.
      const currentQuotes = normalizeQuoteItems(quotesRef.current);
      const currentRecipient = buildDraftRecipient();
      const currentTitle = draftTitleRef.current || buildQuoteDraftTitle(currentRecipient);

      if (!hasDraftContent(currentQuotes, currentRecipient) && !activeDraftIdRef.current) {
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('idle');
        }
        return null;
      }

      const signature = buildDraftSignature();
      if (mode === 'auto' && signature === lastSavedSignatureRef.current) {
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('saved');
          setDraftError(null);
        }
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

        // The next queued task can start before React effects run. Update the ref
        // synchronously so the first create is never repeated.
        activeDraftIdRef.current = savedDraft.id;
        draftOwnerUserIdRef.current = user.id;
        setActiveDraftId(savedDraft.id);
        if (draftTitleRef.current === currentTitle) {
          draftTitleRef.current = savedDraft.title;
          setDraftTitleState(savedDraft.title);
        }
        const savedSignature = JSON.stringify({
          activeDraftId: savedDraft.id,
          title: savedDraft.title,
          quotes: savedDraft.items,
          recipient: savedDraft.recipient,
        });
        lastSavedSignatureRef.current = savedSignature;
        if (activeDraftStorageKey) window.localStorage.setItem(activeDraftStorageKey, savedDraft.id);
        setDraftLastSavedAt(new Date());

        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus(buildDraftSignature() === savedSignature ? 'saved' : 'saving');
        }
        return savedDraft.id;
      } catch (error) {
        console.error('Failed to save quote draft:', error);
        if (requestSequence === draftSaveRequestSequenceRef.current) {
          setDraftSaveStatus('error');
          setDraftError(error instanceof Error ? error.message : '초안 저장에 실패했습니다.');
        }
        return null;
      }
    });
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
      quotesRef.current = normalizedDraftItems;
      recipientRef.current = draft.recipient;
      quoteNumberRef.current = draft.recipient?.quoteNumber || '';
      activeDraftIdRef.current = draft.id;
      draftOwnerUserIdRef.current = user?.id || draft.user_id;
      draftTitleRef.current = draft.title;
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
    if (authLoading || user) return;
    hydratedUserRef.current = null;
    anonymousDraftResolutionRequiredRef.current = false;
    setAnonymousDraftResolutionRequired(false);

    if (!draftOwnerUserIdRef.current) return;

    // Logging out must not reclassify account-owned editor state as an
    // anonymous browser draft. Clear only memory; the account copy remains in
    // server/user-scoped mirror storage.
    isHydratingDraftRef.current = true;
    draftPersistenceGenerationRef.current += 1;
    quotesRef.current = [];
    recipientRef.current = null;
    quoteNumberRef.current = '';
    activeDraftIdRef.current = null;
    draftTitleRef.current = '새 견적 초안';
    lastSavedSignatureRef.current = '';
    setQuotes([]);
    setRecipient(null);
    setQuoteNumber('');
    setActiveDraftId(null);
    setDraftTitleState('새 견적 초안');
    setDraftSaveStatus('idle');
    setDraftLastSavedAt(null);
    setDraftError(null);
  }, [authLoading, user]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (user && !anonymousDraftResolutionRequired) return;
    if (!user && draftOwnerUserIdRef.current) return;

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
  }, [anonymousDraftResolutionRequired, quotes, recipient, quoteNumber, user]);

  useEffect(() => {
    if (authLoading || user || !draftOwnerUserIdRef.current) return;
    if (quotes.length > 0 || recipient || quoteNumber) return;

    // This runs after the anonymous persistence effect has skipped the logout
    // transition, so a future logged-out edit can safely become anonymous.
    draftOwnerUserIdRef.current = null;
    isHydratingDraftRef.current = false;
  }, [authLoading, quoteNumber, quotes, recipient, user]);

  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;
    if (isHydratingDraftRef.current || anonymousDraftResolutionRequiredRef.current) return;
    if (draftOwnerUserIdRef.current && draftOwnerUserIdRef.current !== user.id) return;

    // On the first render after login the anonymous payload is already in
    // component state, while the explicit ownership prompt is established in
    // the following hydration effect. Never mirror that unowned data into the
    // signed-in account during this gap.
    const anonymousPayload = parseLocalDraftPayload(
      window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY),
    );
    const hasUnresolvedAnonymousPayload = draftOwnerUserIdRef.current !== user.id
      && !activeDraftId
      && hasDraftContent(anonymousPayload.quotes, anonymousPayload.recipient);
    if (hasUnresolvedAnonymousPayload) return;

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
  }, [activeDraftId, anonymousDraftResolutionRequired, quotes, recipient, quoteNumber, user]);

  useEffect(() => {
    if (authLoading || !user || typeof window === 'undefined') return;
    if (hydratedUserRef.current === user.id) return;

    hydratedUserRef.current = user.id;

    const hydrate = async () => {
      isHydratingDraftRef.current = true;
      try {
        const localRaw = window.localStorage.getItem(QUOTE_DRAFT_STORAGE_KEY);
        const anonymousLocalDraft = parseLocalDraftPayload(localRaw);
        const anonymousLocalHasContent = hasDraftContent(
          anonymousLocalDraft.quotes,
          anonymousLocalDraft.recipient,
        );
        const declinedAnonymousDraft = userDeclinedAnonymousQuoteDraft(
          localRaw,
          window.localStorage.getItem(getAnonymousQuoteDraftDecisionKey(user.id)),
        );

        if (localRaw && anonymousLocalHasContent && !declinedAnonymousDraft) {
          // A browser-local anonymous draft has no trustworthy account
          // provenance. Keep it local and require an explicit ownership choice
          // instead of silently creating it under whichever user logs in next.
          const anonymousTitle = buildQuoteDraftTitle(anonymousLocalDraft.recipient);
          quotesRef.current = anonymousLocalDraft.quotes;
          recipientRef.current = anonymousLocalDraft.recipient;
          quoteNumberRef.current = anonymousLocalDraft.quoteNumber;
          activeDraftIdRef.current = null;
          draftTitleRef.current = anonymousTitle;
          draftOwnerUserIdRef.current = null;
          setQuotes(anonymousLocalDraft.quotes);
          setRecipient(anonymousLocalDraft.recipient);
          setQuoteNumber(anonymousLocalDraft.quoteNumber);
          setActiveDraftId(null);
          setDraftTitleState(anonymousTitle);
          anonymousDraftResolutionRequiredRef.current = true;
          setAnonymousDraftResolutionRequired(true);
          setDraftSaveStatus('offline');
          setDraftError(null);
          return;
        }

        anonymousDraftResolutionRequiredRef.current = false;
        setAnonymousDraftResolutionRequired(false);

        // Never carry one authenticated user's in-memory editor into another
        // account. Account-owned drafts remain in their server/mirror storage.
        if (
          draftOwnerUserIdRef.current !== user.id
          && hasDraftContent(quotesRef.current, recipientRef.current)
        ) {
          quotesRef.current = [];
          recipientRef.current = null;
          quoteNumberRef.current = '';
          activeDraftIdRef.current = null;
          draftTitleRef.current = '새 견적 초안';
          lastSavedSignatureRef.current = '';
          setQuotes([]);
          setRecipient(null);
          setQuoteNumber('');
          setActiveDraftId(null);
          setDraftTitleState('새 견적 초안');
        }
        draftOwnerUserIdRef.current = user.id;

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
            const mirrorTitle = buildQuoteDraftTitle(mirrorDraft.recipient);
            quotesRef.current = mirrorDraft.quotes;
            recipientRef.current = mirrorDraft.recipient;
            quoteNumberRef.current = mirrorDraft.quoteNumber;
            draftTitleRef.current = mirrorTitle;
            draftOwnerUserIdRef.current = user.id;
            setQuotes(mirrorDraft.quotes);
            setRecipient(mirrorDraft.recipient);
            setQuoteNumber(mirrorDraft.quoteNumber);
            setDraftTitleState(mirrorTitle);
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
  }, [authLoading, draftHydrationRevision, user]);

  useEffect(() => {
    if (!user || isHydratingDraftRef.current || anonymousDraftResolutionRequiredRef.current) return;
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
    if (anonymousDraftResolutionRequiredRef.current) {
      setDraftSaveStatus('offline');
      setDraftError('로그인 전 초안을 이 계정으로 가져올지 먼저 선택해주세요.');
      return;
    }

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
    quotesRef.current = [];
    recipientRef.current = null;
    quoteNumberRef.current = '';

    if (user && draftIdToClear) {
      void persistDraft('manual');
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
    draftTitleRef.current = title;
    setDraftTitleState(title);
  };

  const importAnonymousDraft = async () => {
    if (!user || !anonymousDraftResolutionRequiredRef.current) return false;

    // Temporarily release the persistence guard only for this explicit import.
    // The local payload remains intact until the server save succeeds.
    anonymousDraftResolutionRequiredRef.current = false;
    const importedDraftId = await persistDraft('manual');
    if (!importedDraftId) {
      anonymousDraftResolutionRequiredRef.current = true;
      setAnonymousDraftResolutionRequired(true);
      return false;
    }

    window.localStorage.removeItem(QUOTE_DRAFT_STORAGE_KEY);
    window.localStorage.removeItem(getAnonymousQuoteDraftDecisionKey(user.id));
    setAnonymousDraftResolutionRequired(false);
    setDraftError(null);
    return true;
  };

  const keepAnonymousDraftSeparate = () => {
    if (!user || !anonymousDraftResolutionRequiredRef.current) return false;
    const preservedAnonymousDraft = persistAnonymousDraftLocally();
    if (!preservedAnonymousDraft) return false;
    const preservedFingerprint = buildAnonymousQuoteDraftFingerprint(preservedAnonymousDraft);
    if (!preservedFingerprint) return false;

    try {
      window.localStorage.setItem(
        getAnonymousQuoteDraftDecisionKey(user.id),
        preservedFingerprint,
      );
    } catch (error) {
      console.error('Failed to keep anonymous quote draft separate:', error);
      setDraftSaveStatus('error');
      setDraftError('이 계정과 초안을 분리한 기록을 저장하지 못했습니다. 다시 시도해주세요.');
      return false;
    }

    // Preserve the anonymous payload under its original browser-local key,
    // clear it from this account's in-memory editor, then rerun account-only
    // hydration. The account mirror is guarded while this transition occurs.
    anonymousDraftResolutionRequiredRef.current = false;
    setAnonymousDraftResolutionRequired(false);
    isHydratingDraftRef.current = true;
    draftPersistenceGenerationRef.current += 1;
    quotesRef.current = [];
    recipientRef.current = null;
    quoteNumberRef.current = '';
    activeDraftIdRef.current = null;
    draftTitleRef.current = '새 견적 초안';
    lastSavedSignatureRef.current = '';
    setQuotes([]);
    setRecipient(null);
    setQuoteNumber('');
    setActiveDraftId(null);
    setDraftTitleState('새 견적 초안');
    setDraftSaveStatus('idle');
    setDraftLastSavedAt(null);
    setDraftError(null);
    hydratedUserRef.current = null;
    setDraftHydrationRevision(revision => revision + 1);
    return true;
  };

  const saveDraftNow = async () => persistDraft('manual');

  const createDraftAction = async (title?: string) => {
    if (!user) {
      setDraftSaveStatus('offline');
      return null;
    }

    if (anonymousDraftResolutionRequiredRef.current) {
      setDraftSaveStatus('offline');
      setDraftError('로그인 전 초안을 이 계정으로 가져올지 먼저 선택해주세요.');
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
    if (anonymousDraftResolutionRequiredRef.current) {
      setDraftSaveStatus('offline');
      setDraftError('로그인 전 초안을 이 계정으로 가져올지 먼저 선택해주세요.');
      return false;
    }

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

    return draftSaveQueueRef.current.enqueue(async () => {
      try {
        await archiveQuoteDraft(draftId);

        // A lifecycle mutation shares the save queue so an older save can
        // never finish later and reactivate an archived draft. Only clear the
        // editor if this is still the draft the user asked to archive.
        if (activeDraftIdRef.current === draftId) {
          draftPersistenceGenerationRef.current += 1;
          if (activeDraftStorageKey) window.localStorage.removeItem(activeDraftStorageKey);
          isHydratingDraftRef.current = true;
          quotesRef.current = [];
          recipientRef.current = null;
          quoteNumberRef.current = '';
          activeDraftIdRef.current = null;
          draftTitleRef.current = '새 견적 초안';
          lastSavedSignatureRef.current = '';
          setQuotes([]);
          setRecipient(null);
          setQuoteNumber('');
          setActiveDraftId(null);
          setDraftTitleState('새 견적 초안');
          setDraftSaveStatus('idle');
          setDraftLastSavedAt(null);
          setDraftError(null);
          isHydratingDraftRef.current = false;
        }
        return true;
      } catch (error) {
        console.error('Failed to archive quote draft:', error);
        setDraftSaveStatus('error');
        setDraftError(error instanceof Error ? error.message : '초안 보관에 실패했습니다.');
        return false;
      }
    });
  };

  const markActiveDraftIssued = async (quoteId: string) => {
    const draftId = activeDraftIdRef.current;
    if (!draftId) return;
    await draftSaveQueueRef.current.enqueue(async () => {
      await updateQuoteDraft(draftId, {
        status: 'issued',
        issuedQuoteId: quoteId,
        issuedAt: new Date().toISOString(),
      });

      // As with archive, publish the terminal state inside the same queue as
      // persistence. Saves queued afterwards will observe a null active id and
      // cannot overwrite the issued draft with the cleared editor state.
      if (activeDraftIdRef.current === draftId) {
        draftPersistenceGenerationRef.current += 1;
        if (activeDraftStorageKey) window.localStorage.removeItem(activeDraftStorageKey);
        activeDraftIdRef.current = null;
        lastSavedSignatureRef.current = '';
        setActiveDraftId(null);
      }
    });
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
      anonymousDraftResolutionRequired,
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
      markActiveDraftIssued,
      importAnonymousDraft,
      keepAnonymousDraftSeparate,
    }}>
      {children}
    </QuoteContext.Provider>
  );
};
