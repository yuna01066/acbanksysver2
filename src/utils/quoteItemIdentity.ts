import type { Quote } from '@/contexts/QuoteContext';
import { secureRandomToken } from '@/utils/secureRandom';

type QuoteItemLike = Partial<Quote> & {
  id?: string;
  createdAt?: Date | string;
  [key: string]: unknown;
};

export const createQuoteItemId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${secureRandomToken(8)}`;
};

export const normalizeQuoteItems = <T extends QuoteItemLike>(items: T[]): T[] => {
  const usedIds = new Set<string>();

  return items.map((item) => {
    const rawId = typeof item.id === 'string' ? item.id.trim() : '';
    const id = rawId && !usedIds.has(rawId) ? rawId : createQuoteItemId();
    usedIds.add(id);

    return {
      ...item,
      id,
    };
  });
};
