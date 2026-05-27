import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertCircle, Edit, Loader2, Megaphone, Pin, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';

interface Announcement {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  is_pinned: boolean;
  announcement_type: string;
  created_at: string;
  updated_at: string;
}

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isModerator;
  const focusedAnnouncementId = searchParams.get('focus');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, author_id, author_name, is_pinned, announcement_type, created_at, updated_at')
        .eq('announcement_type', 'general')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: !!user,
  });

  const formError = useMemo(() => {
    if (!title.trim()) return '공지 제목을 입력해주세요.';
    if (!content.trim()) return '공지 내용을 입력해주세요.';
    return '';
  }, [content, title]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setEditingId(null);
    setShowForm(false);
  };

  const notifyAnnouncementCreated = async (announcement: Announcement) => {
    if (!user || !profile) return;

    const { data: profiles } = await supabase.from('profile_directory').select('id');
    const notifications = (profiles || [])
      .filter((item) => item.id !== user.id)
      .map((item) => ({
        user_id: item.id,
        type: 'system',
        title: '새 공지사항',
        description: `공지사항이 등록되었습니다: ${announcement.title}`,
        data: { announcementId: announcement.id },
      }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인이 필요합니다.');
      if (!canManage) throw new Error('공지 작성 권한이 없습니다.');
      if (formError) throw new Error(formError);

      if (editingId) {
        const { data, error } = await supabase
          .from('announcements')
          .update({
            title: title.trim(),
            content: content.trim(),
            announcement_type: 'general',
            meeting_date: null,
            meeting_time: null,
            meeting_location: null,
            event_end_date: null,
            recipient_id: null,
            recipient_name: null,
            assignee_ids: [],
            assignee_names: [],
          })
          .eq('id', editingId)
          .select('id, title, content, author_id, author_name, is_pinned, announcement_type, created_at, updated_at')
          .single();
        if (error) throw error;
        return { announcement: data as Announcement, created: false };
      }

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: title.trim(),
          content: content.trim(),
          author_id: user.id,
          author_name: profile.full_name || user.email || '관리자',
          announcement_type: 'general',
        })
        .select('id, title, content, author_id, author_name, is_pinned, announcement_type, created_at, updated_at')
        .single();
      if (error) throw error;

      await notifyAnnouncementCreated(data as Announcement);
      return { announcement: data as Announcement, created: true };
    },
    onSuccess: ({ created }) => {
      toast.success(created ? '공지사항이 등록되었습니다.' : '공지사항이 수정되었습니다.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '공지사항 저장에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('공지사항이 삭제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: async ({ id, isPinned }: { id: string; isPinned: boolean }) => {
      if (!isPinned) {
        const pinnedCount = announcements.filter((announcement) => announcement.is_pinned).length;
        if (pinnedCount >= 2) throw new Error('고정 공지는 최대 2건까지 가능합니다.');
      }

      const { error } = await supabase.from('announcements').update({ is_pinned: !isPinned }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || '고정 상태 변경에 실패했습니다.');
    },
  });

  const filteredAnnouncements = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();
    if (!keyword) return announcements;
    return announcements.filter((announcement) =>
      [announcement.title, announcement.content, announcement.author_name]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
  }, [announcements, searchTerm]);

  useEffect(() => {
    if (!focusedAnnouncementId || announcements.length === 0) return;
    const target = announcements.find((announcement) => announcement.id === focusedAnnouncementId);
    if (!target) return;
    setExpandedIds((prev) => new Set(prev).add(target.id));

    window.setTimeout(() => {
      document.getElementById(`announcement-${target.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  }, [announcements, focusedAnnouncementId]);

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (announcement: Announcement) => {
    setEditingId(announcement.id);
    setTitle(announcement.title);
    setContent(announcement.content);
    setShowForm(true);
  };

  const renderAnnouncementCard = (announcement: Announcement) => {
    const isFocused = focusedAnnouncementId === announcement.id;
    const isLong = announcement.content.split('\n').length > 5 || announcement.content.length > 300;
    const isExpanded = expandedIds.has(announcement.id);

    return (
      <Card
        key={announcement.id}
        id={`announcement-${announcement.id}`}
        className={[
          announcement.is_pinned ? 'border-primary/30 bg-primary/5' : '',
          isFocused ? 'ring-2 ring-primary/35 shadow-depth' : '',
        ].filter(Boolean).join(' ')}
      >
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center gap-2">
                {announcement.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                <Badge variant="outline" className="h-5 rounded-full px-2 text-[11px]">공지</Badge>
                <h3 className="min-w-0 truncate text-lg font-semibold">{announcement.title}</h3>
              </div>
              <p className={`mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground/80 ${!isExpanded && isLong ? 'line-clamp-5' : ''}`}>
                {announcement.content}
              </p>
              {isLong && (
                <button
                  type="button"
                  className="mt-1 text-sm text-primary hover:underline"
                  onClick={() => {
                    setExpandedIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(announcement.id)) next.delete(announcement.id);
                      else next.add(announcement.id);
                      return next;
                    });
                  }}
                >
                  {isExpanded ? '접기' : '... 더보기'}
                </button>
              )}
              <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
                <span>{announcement.author_name}</span>
                <span>{format(new Date(announcement.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}</span>
              </div>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => togglePinMutation.mutate({ id: announcement.id, isPinned: announcement.is_pinned })}
                  title={announcement.is_pinned ? '고정 해제' : '상단 고정'}
                >
                  <Pin className={`h-3.5 w-3.5 ${announcement.is_pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditForm(announcement)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => {
                    if (confirm('공지사항을 삭제하시겠습니까?')) deleteMutation.mutate(announcement.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Notice Board"
        title="공지사항"
        description="일반 사내 공지만 관리합니다. 회의, 미팅, 이벤트 일정은 미팅 예약에서 관리합니다."
        icon={<Megaphone className="h-5 w-5" />}
        actions={
          canManage ? (
            <Button type="button" size="sm" onClick={openCreateForm}>
              <Plus className="h-4 w-4" />
              새 공지 작성
            </Button>
          ) : null
        }
      />

      <section className="rounded-2xl border border-primary/15 bg-primary/5 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">일정 기능은 미팅 예약으로 이동했습니다.</h2>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                회의, 클라이언트 미팅, 이벤트 일정은 미팅 예약 화면에서 등록하고 캘린더와 대시보드에 연동됩니다.
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => navigate('/meeting-reservations')}>
            미팅 예약 열기
          </Button>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">전체 공지</div>
          <div className="mt-1 text-xl font-semibold">{announcements.length.toLocaleString()}건</div>
        </div>
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">고정 공지</div>
          <div className="mt-1 text-xl font-semibold">{announcements.filter((announcement) => announcement.is_pinned).length.toLocaleString()}건</div>
        </div>
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">검색 결과</div>
          <div className="mt-1 text-xl font-semibold">{filteredAnnouncements.length.toLocaleString()}건</div>
        </div>
      </div>

      {canManage && showForm && (
        <Card>
          <CardContent className="space-y-3 pt-6">
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="공지 제목"
            />
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="공지 내용을 입력하세요."
              rows={6}
              className="resize-none"
            />
            {formError && (
              <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{formError}</span>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={resetForm}>취소</Button>
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={!!formError || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? '수정' : '등록'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <SearchFilterBar>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="제목, 내용, 작성자 검색"
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearchTerm('');
              if (focusedAnnouncementId) setSearchParams({}, { replace: true });
            }}
            disabled={!searchTerm && !focusedAnnouncementId}
          >
            필터 초기화
          </Button>
        </div>
      </SearchFilterBar>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredAnnouncements.length > 0 ? (
        <div className="space-y-6">
          {filteredAnnouncements.some((announcement) => announcement.is_pinned) && (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredAnnouncements.filter((announcement) => announcement.is_pinned).map(renderAnnouncementCard)}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {filteredAnnouncements.filter((announcement) => !announcement.is_pinned).map(renderAnnouncementCard)}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed bg-muted/20 py-16 text-center text-muted-foreground">
          <Megaphone className="mx-auto mb-3 h-10 w-10 opacity-30" />
          <p>등록된 공지사항이 없습니다.</p>
        </div>
      )}
    </PageShell>
  );
};

export default AnnouncementsPage;
