import { supabase } from '@/integrations/supabase/client';
import type { Quote, QuoteRecipient } from '@/contexts/QuoteContext';
import { detectQuoteStyleFromItems, type QuoteStyleType } from '@/utils/quoteStyle';
import { saveIssuedQuote } from '@/services/issuedQuoteSaver';
import { secureRandomNumericString } from '@/utils/secureRandom';
import { normalizeQuoteItems } from '@/utils/quoteItemIdentity';

export type QuoteDraftStatus = 'active' | 'issued' | 'archived';

export interface QuoteDraftRecord {
  id: string;
  user_id: string;
  title: string;
  recipient: QuoteRecipient | null;
  items: Quote[];
  subtotal: number;
  tax: number;
  total: number;
  quote_style: QuoteStyleType;
  status: QuoteDraftStatus;
  issued_quote_id: string | null;
  issued_at: string | null;
  last_opened_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteDraftPayload {
  userId: string;
  title?: string;
  recipient?: QuoteRecipient | null;
  items?: Quote[];
  quoteStyle?: QuoteStyleType;
}

export interface IssueDraftResult {
  draftId: string;
  success: boolean;
  quoteId?: string;
  quoteNumber?: string;
  error?: string;
}

const table = () => (supabase as any).from('quote_drafts');

const restoreDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const normalizeDraftRecipient = (recipient: unknown): QuoteRecipient | null => {
  if (!recipient || typeof recipient !== 'object' || Array.isArray(recipient)) return null;
  const record = recipient as Record<string, unknown>;
  return {
    ...(record as unknown as QuoteRecipient),
    quoteDate: restoreDate(record.quoteDate),
    desiredDeliveryDate: restoreDate(record.desiredDeliveryDate),
  };
};

export const normalizeDraftItems = (items: unknown): Quote[] => {
  if (!Array.isArray(items)) return [];
  return normalizeQuoteItems(items
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    .map(item => ({
      ...(item as unknown as Quote),
      createdAt: restoreDate(item.createdAt) || new Date(),
    })));
};

const normalizeDraft = (row: any): QuoteDraftRecord => ({
  id: row.id,
  user_id: row.user_id,
  title: row.title || '새 견적 초안',
  recipient: normalizeDraftRecipient(row.recipient),
  items: normalizeDraftItems(row.items),
  subtotal: Number(row.subtotal) || 0,
  tax: Number(row.tax) || 0,
  total: Number(row.total) || 0,
  quote_style: (row.quote_style || 'panel') as QuoteStyleType,
  status: (row.status || 'active') as QuoteDraftStatus,
  issued_quote_id: row.issued_quote_id || null,
  issued_at: row.issued_at || null,
  last_opened_at: row.last_opened_at || null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const calculateQuoteDraftTotals = (items: Quote[]) => {
  const subtotal = Math.round(items.reduce((sum, item) => {
    const totalPrice = Number(item.totalPrice) || 0;
    const quantity = Number(item.quantity) || 1;
    return sum + totalPrice * quantity;
  }, 0) / 100) * 100;
  const tax = Math.round(subtotal * 0.1);
  return { subtotal, tax, total: subtotal + tax };
};

export const buildQuoteDraftTitle = (recipient?: QuoteRecipient | null, fallback = '새 견적 초안') => {
  const projectName = recipient?.projectName?.trim();
  if (projectName) return projectName.slice(0, 150);
  const companyName = recipient?.companyName?.trim();
  if (companyName) return `${companyName} 견적 초안`.slice(0, 150);
  return fallback;
};

const toDraftRow = ({ userId, title, recipient, items = [], quoteStyle }: QuoteDraftPayload) => {
  const normalizedItems = normalizeQuoteItems(items);
  const totals = calculateQuoteDraftTotals(normalizedItems);
  const style = quoteStyle || detectQuoteStyleFromItems(normalizedItems);
  return {
    user_id: userId,
    title: (title || buildQuoteDraftTitle(recipient)).slice(0, 150),
    recipient: recipient || null,
    items: normalizedItems,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    quote_style: style,
  };
};

export async function listQuoteDrafts(status?: QuoteDraftStatus | 'all'): Promise<QuoteDraftRecord[]> {
  let query = table()
    .select('*')
    .order('updated_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeDraft);
}

export async function getQuoteDraft(id: string): Promise<QuoteDraftRecord> {
  const { data, error } = await table()
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return normalizeDraft(data);
}

export async function createQuoteDraft(payload: QuoteDraftPayload): Promise<QuoteDraftRecord> {
  const { data, error } = await table()
    .insert([toDraftRow(payload)])
    .select('*')
    .single();
  if (error) throw error;
  return normalizeDraft(data);
}

export async function updateQuoteDraft(
  id: string,
  payload: Partial<QuoteDraftPayload> & { status?: QuoteDraftStatus; issuedQuoteId?: string | null; issuedAt?: string | null; lastOpenedAt?: string | null },
): Promise<QuoteDraftRecord> {
  const items = payload.items;
  const normalizedItems = items ? normalizeQuoteItems(items) : null;
  const totals = normalizedItems ? calculateQuoteDraftTotals(normalizedItems) : null;
  const row: Record<string, unknown> = {};

  if (payload.title !== undefined) row.title = (payload.title || '새 견적 초안').slice(0, 150);
  if (payload.recipient !== undefined) row.recipient = payload.recipient;
  if (items !== undefined) {
    row.items = normalizedItems;
    row.subtotal = totals?.subtotal || 0;
    row.tax = totals?.tax || 0;
    row.total = totals?.total || 0;
    row.quote_style = payload.quoteStyle || detectQuoteStyleFromItems(normalizedItems || []);
  } else if (payload.quoteStyle !== undefined) {
    row.quote_style = payload.quoteStyle;
  }
  if (payload.status !== undefined) row.status = payload.status;
  if (payload.issuedQuoteId !== undefined) row.issued_quote_id = payload.issuedQuoteId;
  if (payload.issuedAt !== undefined) row.issued_at = payload.issuedAt;
  if (payload.lastOpenedAt !== undefined) row.last_opened_at = payload.lastOpenedAt;

  const { data, error } = await table()
    .update(row)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw error;
  return normalizeDraft(data);
}

export async function duplicateQuoteDraft(id: string): Promise<QuoteDraftRecord> {
  const draft = await getQuoteDraft(id);
  return createQuoteDraft({
    userId: draft.user_id,
    title: `${draft.title} 복사본`,
    recipient: draft.recipient,
    items: draft.items,
    quoteStyle: draft.quote_style,
  });
}

export async function archiveQuoteDraft(id: string): Promise<void> {
  const { error } = await table()
    .update({ status: 'archived' })
    .eq('id', id);
  if (error) throw error;
}

export const generateIssuedQuoteNumber = (offset = 0) => {
  const now = new Date(Date.now() + offset);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const sequence = secureRandomNumericString(10, 99, 2);
  return `${month}${day}${hour}${minute}${sequence}`;
};

export const validateDraftForIssue = (draft: QuoteDraftRecord): string | null => {
  if (!draft.items.length) return '견적 항목이 없습니다.';
  const recipient = draft.recipient;
  if (!recipient) return '수신 정보가 없습니다.';
  if (!recipient.projectName?.trim()) return '프로젝트명이 없습니다.';
  if (!recipient.companyName?.trim() && !recipient.contactPerson?.trim()) return '거래처 또는 담당자 정보가 없습니다.';
  return null;
};

export async function issueQuoteDrafts({
  draftIds,
  userId,
}: {
  draftIds: string[];
  userId: string;
}): Promise<IssueDraftResult[]> {
  const results: IssueDraftResult[] = [];

  for (const [index, draftId] of draftIds.entries()) {
    try {
      const draft = await getQuoteDraft(draftId);
      const validationError = validateDraftForIssue(draft);
      if (validationError) {
        results.push({ draftId, success: false, error: validationError });
        continue;
      }

      const quoteNumber = generateIssuedQuoteNumber(index * 1000);
      const recipient = {
        ...draft.recipient!,
        quoteNumber,
        quoteDate: new Date(),
      };
      const totals = calculateQuoteDraftTotals(draft.items);
      const quoteStyle = detectQuoteStyleFromItems(draft.items);
      const saved = await saveIssuedQuote({
        userId,
        quotes: draft.items,
        recipient,
        quoteNumber,
        quoteStyle,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
      });

      await updateQuoteDraft(draft.id, {
        status: 'issued',
        issuedQuoteId: saved.quoteId,
        issuedAt: new Date().toISOString(),
      });

      results.push({ draftId, success: true, quoteId: saved.quoteId, quoteNumber });
    } catch (error) {
      results.push({
        draftId,
        success: false,
        error: error instanceof Error ? error.message : '발행에 실패했습니다.',
      });
    }
  }

  return results;
}
