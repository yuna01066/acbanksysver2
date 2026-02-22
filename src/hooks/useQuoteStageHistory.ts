import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface StageHistoryEntry {
  id: string;
  quote_id: string;
  old_stage: string | null;
  new_stage: string;
  changed_by: string;
  changed_by_name: string;
  memo: string | null;
  created_at: string;
}

export const useQuoteStageHistory = (quoteId: string | undefined) => {
  const { user } = useAuth();

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['quote-stage-history', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_stage_history')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as StageHistoryEntry[];
    },
    enabled: !!quoteId && !!user,
  });

  return { history, isLoading, refetch };
};

export const logStageChange = async (
  quoteId: string,
  oldStage: string,
  newStage: string,
  userId: string,
  userName: string,
  memo?: string
) => {
  await supabase.from('quote_stage_history').insert({
    quote_id: quoteId,
    old_stage: oldStage,
    new_stage: newStage,
    changed_by: userId,
    changed_by_name: userName,
    memo: memo || null,
  });
};
