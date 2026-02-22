import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface QuoteVersion {
  id: string;
  quote_id: string;
  version_number: number;
  snapshot: Record<string, any>;
  change_summary: string | null;
  changed_by: string;
  changed_by_name: string;
  created_at: string;
}

export const useQuoteVersions = (quoteId: string | undefined) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['quote-versions', quoteId],
    queryFn: async () => {
      if (!quoteId) return [];
      const { data, error } = await supabase
        .from('quote_versions')
        .select('*')
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false });
      if (error) throw error;
      return (data || []) as QuoteVersion[];
    },
    enabled: !!quoteId && !!user,
  });

  const saveVersion = useMutation({
    mutationFn: async ({ snapshot, changeSummary }: { snapshot: Record<string, any>; changeSummary: string }) => {
      if (!quoteId || !user) throw new Error('Missing context');
      const nextVersion = (versions[0]?.version_number || 0) + 1;
      const { error } = await supabase.from('quote_versions').insert({
        quote_id: quoteId,
        version_number: nextVersion,
        snapshot,
        change_summary: changeSummary,
        changed_by: user.id,
        changed_by_name: profile?.full_name || user.email || '알 수 없음',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-versions', quoteId] });
    },
  });

  return { versions, isLoading, saveVersion };
};
