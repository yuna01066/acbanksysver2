import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Send, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface QuoteMemoPanelProps {
  quoteId: string;
}

const QuoteMemoPanel: React.FC<QuoteMemoPanelProps> = ({ quoteId }) => {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [newMemo, setNewMemo] = useState('');

  const { data: memos = [], isLoading } = useQuery({
    queryKey: ['quote-memos', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quote_memos')
        .select('*')
        .eq('quote_id', quoteId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!quoteId,
  });

  const addMemo = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('로그인이 필요합니다');
      const { error } = await supabase.from('quote_memos').insert({
        quote_id: quoteId,
        user_id: user.id,
        user_name: profile?.full_name || user.email || '알 수 없음',
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-memos', quoteId] });
      setNewMemo('');
      toast.success('메모가 추가되었습니다.');
    },
    onError: () => toast.error('메모 추가에 실패했습니다.'),
  });

  const deleteMemo = useMutation({
    mutationFn: async (memoId: string) => {
      const { error } = await supabase.from('quote_memos').delete().eq('id', memoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote-memos', quoteId] });
      toast.success('메모가 삭제되었습니다.');
    },
    onError: () => toast.error('메모 삭제에 실패했습니다.'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemo.trim()) return;
    addMemo.mutate(newMemo.trim());
  };

  return (
    <Card className="print:hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          메모 ({memos.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={newMemo}
            onChange={(e) => setNewMemo(e.target.value)}
            placeholder="메모를 입력하세요..."
            className="min-h-[60px] text-sm resize-none"
            rows={2}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!newMemo.trim() || addMemo.isPending}
            className="shrink-0 self-end"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-2">로딩 중...</p>
        ) : memos.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">아직 메모가 없습니다.</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {memos.map((memo: any) => (
              <div
                key={memo.id}
                className={cn(
                  "rounded-lg border p-3 text-sm space-y-1",
                  memo.user_id === user?.id
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/30"
                )}
              >
                <p className="whitespace-pre-line">{memo.content}</p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>
                    {memo.user_name} · {format(new Date(memo.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </span>
                  {(memo.user_id === user?.id || isAdmin) && (
                    <button
                      onClick={() => deleteMemo.mutate(memo.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteMemoPanel;
