import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const LinkQuoteDialog: React.FC<Props> = ({ open, onOpenChange, projectId }) => {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: quotes = [] } = useQuery({
    queryKey: ['unlinked-quotes-for-project'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, total, quote_date, project_id')
        .is('project_id', null)
        .order('quote_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const linkQuote = useMutation({
    mutationFn: async (quoteId: string) => {
      const { error } = await supabase
        .from('saved_quotes')
        .update({ project_id: projectId })
        .eq('id', quoteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-quotes', projectId] });
      queryClient.invalidateQueries({ queryKey: ['project-quote-counts'] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-quotes-for-project'] });
      toast.success('견적서가 연결되었습니다.');
    },
    onError: () => toast.error('연결에 실패했습니다.'),
  });

  const filtered = quotes.filter((q: any) => {
    const term = search.toLowerCase();
    return (
      q.quote_number?.toLowerCase().includes(term) ||
      q.project_name?.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>견적서 연결</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="견적번호 또는 프로젝트명으로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">다른 프로젝트에 연결되지 않은 견적서만 표시됩니다.</p>
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">연결 가능한 견적서가 없습니다.</p>
            </div>
          ) : (
            filtered.map((q: any) => (
              <div
                key={q.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono">{q.quote_number}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {q.project_name || '-'} · ₩{q.total?.toLocaleString()}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => linkQuote.mutate(q.id)}
                  disabled={linkQuote.isPending}
                >
                  <Check className="h-3 w-3" /> 연결
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkQuoteDialog;
