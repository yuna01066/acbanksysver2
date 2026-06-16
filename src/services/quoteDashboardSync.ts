import type { QueryClient } from '@tanstack/react-query';

import { supabase } from '@/integrations/supabase/client';

const DASHBOARD_QUOTE_QUERY_KEYS = [
  ['calendar-events'],
  ['calendar-dashboard-summary'],
  ['today-work-upcoming-quotes'],
  ['quote-projects-progress'],
  ['home-quote-follow-ups'],
] as const;

export function invalidateQuoteDashboardQueries(queryClient: QueryClient) {
  DASHBOARD_QUOTE_QUERY_KEYS.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  });
}

export async function syncSavedQuoteCalendarEvent(quoteId: string) {
  const { error } = await (supabase as any).rpc('calendar_sync_saved_quote', {
    _quote_id: quoteId,
  });

  if (error) {
    throw error;
  }
}

export async function refreshQuoteDashboardState(queryClient: QueryClient, quoteId: string) {
  try {
    await syncSavedQuoteCalendarEvent(quoteId);
  } catch (error) {
    console.warn('[QuoteDashboardSync] Calendar event sync failed:', error);
  } finally {
    invalidateQuoteDashboardQueries(queryClient);
  }
}
