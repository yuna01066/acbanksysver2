import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Megaphone, ArrowLeft, Plus, Loader2, Trash2, Edit, Pin } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const canManage = isAdmin || isModerator;

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
    enabled: !!user,
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 필요');

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({ title, content })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data: announcement, error } = await supabase
          .from('announcements')
          .insert({
            title,
            content,
            author_id: user.id,
            author_name: profile.full_name || user.email || '관리자',
          })
          .select()
          .single();
        if (error) throw error;

        // Notify all users
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_approved', true);

        if (allProfiles && allProfiles.length > 0) {
          const notifications = allProfiles
            .filter(p => p.id !== user.id)
            .map(p => ({
              user_id: p.id,
              type: 'system',
              title: '새 공지사항',
              description: `공지사항이 등록되었습니다: ${title}`,
              data: { announcementId: announcement.id },
            }));
          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }
        }
      }
    },
    onSuccess: () => {
      toast.success(editingId ? '수정되었습니다.' : '등록되었습니다.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['latest-announcement'] });
    },
    onError: (err: any) => {
      toast.error('실패: ' + (err.message || '알 수 없는 오류'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      queryClient.invalidateQueries({ queryKey: ['latest-announcement'] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      const { error } = await supabase
        .from('announcements')
        .update({ is_pinned: !isPinned })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setShowForm(true);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Megaphone className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold">공지사항</h1>
            </div>
          </div>
          {canManage && (
            <Button onClick={() => { resetForm(); setShowForm(true); }} className="gap-2">
              <Plus className="h-4 w-4" />
              새 공지 작성
            </Button>
          )}
        </div>

        {/* Post form */}
        {canManage && showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-3">
              <Input
                placeholder="공지 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <Textarea
                placeholder="공지 내용을 입력하세요..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                className="resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetForm}>취소</Button>
                <Button
                  onClick={() => postMutation.mutate()}
                  disabled={!title.trim() || !content.trim() || postMutation.isPending}
                >
                  {postMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingId ? '수정' : '등록'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Announcements list */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : announcements && announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((a) => (
              <Card key={a.id} className={a.is_pinned ? 'border-primary/30 bg-primary/5' : ''}>
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {a.is_pinned && (
                          <Pin className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                        <h3 className="font-semibold text-base">{a.title}</h3>
                      </div>
                      <p className="text-sm text-foreground/80 whitespace-pre-wrap mt-2">{a.content}</p>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>{a.author_name}</span>
                        <span>
                          {format(new Date(a.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                        </span>
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => togglePinMutation.mutate({ id: a.id, isPinned: a.is_pinned })}
                          title={a.is_pinned ? '고정 해제' : '상단 고정'}
                        >
                          <Pin className={`h-3.5 w-3.5 ${a.is_pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(a)}
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            if (confirm('정말 삭제하시겠습니까?')) {
                              deleteMutation.mutate(a.id);
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnouncementsPage;
