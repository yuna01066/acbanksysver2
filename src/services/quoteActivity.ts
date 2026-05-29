import { supabase } from '@/integrations/supabase/client';

export type QuoteActivityAction =
  | 'status_changed'
  | 'assignee_changed'
  | 'quote_updated'
  | 'memo_added'
  | 'memo_deleted'
  | 'file_uploaded'
  | 'file_deleted'
  | 'project_converted'
  | 'project_linked'
  | 'quote_reissued'
  | 'created_from_reissue';

interface LogQuoteActivityParams {
  quoteId: string;
  actionType: QuoteActivityAction;
  actorId?: string | null;
  actorName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  memo?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logQuoteActivity({
  quoteId,
  actionType,
  actorId,
  actorName,
  oldValue,
  newValue,
  memo,
  metadata,
}: LogQuoteActivityParams) {
  if (!quoteId || !actorId) return;

  const { error } = await (supabase as any)
    .from('quote_activity_history')
    .insert({
      quote_id: quoteId,
      action_type: actionType,
      actor_id: actorId,
      actor_name: actorName || '알 수 없음',
      old_value: oldValue || null,
      new_value: newValue || null,
      memo: memo || null,
      metadata: metadata || {},
    });

  if (error) {
    console.warn('[QuoteActivity] Failed to log activity:', error);
  }
}
