import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  recipientId: string;
}

const RecipientNotesPanel: React.FC<Props> = ({ recipientId }) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [noteType, setNoteType] = useState('memo');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['recipient-notes', recipientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipient_notes')
        .select('*')
        .eq('recipient_id', recipientId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인 필요');
      const { error } = await supabase.from('recipient_notes').insert({
        recipient_id: recipientId,
        user_id: user.id,
        user_name: profile?.full_name || user.email || '',
        note_type: noteType,
        title: title.trim() || null,
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipient-notes', recipientId] });
      queryClient.invalidateQueries({ queryKey: ['recipient-timeline'] });
      setIsAdding(false);
      setTitle('');
      setContent('');
      setNoteType('memo');
      toast.success('메모가 등록되었습니다.');
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const deleteNote = useMutation({
    mutationFn: async (noteId: string) => {
      const { error } = await supabase.from('recipient_notes').delete().eq('id', noteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipient-notes', recipientId] });
      queryClient.invalidateQueries({ queryKey: ['recipient-timeline'] });
      toast.success('삭제되었습니다.');
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            상담일지 / 메모
            <Badge variant="secondary" className="ml-1">{notes.length}</Badge>
          </CardTitle>
          {!isAdding && (
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setIsAdding(true)}>
              <Plus className="w-3.5 h-3.5" /> 추가
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isAdding && (
          <div className="p-3 border rounded-lg space-y-2 bg-muted/20">
            <div className="flex gap-2">
              <Select value={noteType} onValueChange={setNoteType}>
                <SelectTrigger className="w-28 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="memo">메모</SelectItem>
                  <SelectItem value="consultation">상담</SelectItem>
                  <SelectItem value="call">통화</SelectItem>
                  <SelectItem value="meeting">미팅</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="제목 (선택)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-8 text-xs flex-1"
              />
            </div>
            <Textarea
              placeholder="내용을 입력하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIsAdding(false); setTitle(''); setContent(''); }}>
                <X className="w-3 h-3 mr-1" /> 취소
              </Button>
              <Button size="sm" className="h-7 text-xs" disabled={!content.trim() || addNote.isPending} onClick={() => addNote.mutate()}>
                {addNote.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="p-6 text-center text-muted-foreground text-sm">로딩 중...</div>
        ) : notes.length === 0 && !isAdding ? (
          <div className="p-6 text-center text-muted-foreground text-sm">등록된 메모가 없습니다.</div>
        ) : (
          notes.map((note: any) => {
            const typeLabel = { memo: '메모', consultation: '상담', call: '통화', meeting: '미팅' }[note.note_type as string] || note.note_type;
            const typeColor = { memo: 'text-gray-600 border-gray-300', consultation: 'text-blue-600 border-blue-300', call: 'text-green-600 border-green-300', meeting: 'text-purple-600 border-purple-300' }[note.note_type as string] || '';
            return (
              <div key={note.id} className="p-3 border rounded-lg text-sm group relative">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${typeColor}`}>{typeLabel}</Badge>
                  {note.title && <span className="font-medium text-sm">{note.title}</span>}
                  <span className="text-[11px] text-muted-foreground/60 ml-auto">
                    {new Date(note.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                  </span>
                  {note.user_id === user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => { if (confirm('삭제하시겠습니까?')) deleteNote.mutate(note.id); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>
                <p className="text-muted-foreground whitespace-pre-wrap">{note.content}</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">작성: {note.user_name}</p>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default RecipientNotesPanel;
