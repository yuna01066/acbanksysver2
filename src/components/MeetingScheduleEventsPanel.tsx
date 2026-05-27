import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { AlertCircle, CalendarDays, Loader2, MapPin, PartyPopper, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ScheduleEventRow = {
  id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  announcement_type: string;
  meeting_date: string | null;
  meeting_location: string | null;
  event_end_date: string | null;
  created_at: string;
  updated_at: string;
};

type ScheduleDraft = {
  title: string;
  content: string;
  start_date: string;
  end_date: string;
  location: string;
};

interface MeetingScheduleEventsPanelProps {
  compactLayout?: boolean;
  maxItems?: number;
}

const todayString = () => format(new Date(), 'yyyy-MM-dd');
const plusDaysString = (days: number) => format(addDays(new Date(), days), 'yyyy-MM-dd');

const createEmptyDraft = (): ScheduleDraft => ({
  title: '',
  content: '',
  start_date: todayString(),
  end_date: '',
  location: '',
});

const formatDateLabel = (value: string | null) => {
  if (!value) return '날짜 미정';
  const date = parseISO(value);
  return Number.isNaN(date.getTime()) ? value : format(date, 'M월 d일 (EEE)', { locale: ko });
};

const getEventEndDate = (event: ScheduleEventRow) => event.event_end_date || event.meeting_date;

const MeetingScheduleEventsPanel = ({ compactLayout = false, maxItems = 8 }: MeetingScheduleEventsPanelProps) => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedEventId = searchParams.get('event');
  const queryClient = useQueryClient();
  const canManage = isAdmin || isModerator;
  const [draft, setDraft] = useState<ScheduleDraft>(() => createEmptyDraft());
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailDraft, setDetailDraft] = useState<ScheduleDraft | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['meeting-widget-schedule-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, author_id, author_name, announcement_type, meeting_date, meeting_location, event_end_date, created_at, updated_at')
        .eq('announcement_type', 'event')
        .or(`meeting_date.gte.${todayString()},event_end_date.gte.${todayString()}`)
        .order('meeting_date', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data || []) as ScheduleEventRow[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) || null,
    [events, selectedEventId],
  );

  useEffect(() => {
    if (!focusedEventId || events.length === 0 || selectedEventId === focusedEventId) return;
    const focused = events.find((event) => event.id === focusedEventId);
    if (!focused) return;
    setSelectedEventId(focused.id);
    setDetailDraft({
      title: focused.title,
      content: focused.content,
      start_date: focused.meeting_date || todayString(),
      end_date: focused.event_end_date || '',
      location: focused.meeting_location || '',
    });
  }, [events, focusedEventId, selectedEventId]);

  const visibleEvents = useMemo(() => events.slice(0, maxItems), [events, maxItems]);
  const todayCount = events.filter((event) => event.meeting_date === todayString()).length;
  const weekCount = events.filter((event) => {
    const start = event.meeting_date || '';
    const end = getEventEndDate(event) || '';
    return start <= plusDaysString(7) && end >= todayString();
  }).length;

  const validateDraft = (target: ScheduleDraft) => {
    if (!user || !profile) return '로그인이 필요합니다.';
    if (!canManage) return '이벤트 일정은 관리자 또는 중간관리자만 등록할 수 있습니다.';
    if (!target.title.trim()) return '이벤트 제목을 입력해주세요.';
    if (!target.content.trim()) return '이벤트 내용을 입력해주세요.';
    if (!target.start_date) return '시작일을 선택해주세요.';
    if (target.end_date && target.end_date < target.start_date) return '종료일은 시작일보다 빠를 수 없습니다.';
    return '';
  };

  const formError = validateDraft(draft);
  const detailError = detailDraft ? validateDraft(detailDraft) : '';

  const notifyEventCreated = async (event: ScheduleEventRow) => {
    if (!user || !profile) return;

    await supabase.from('team_messages').insert({
      user_id: user.id,
      user_name: profile.full_name || user.email || '관리자',
      avatar_url: profile.avatar_url || null,
      message: `이벤트 공지: ${event.title}\n${event.meeting_date || '날짜 미정'}${event.event_end_date ? ` ~ ${event.event_end_date}` : ''}${event.meeting_location ? `\n장소: ${event.meeting_location}` : ''}`,
    });

    const { data: profiles } = await supabase.from('profile_directory').select('id');
    const notifications = (profiles || [])
      .filter((item) => item.id !== user.id)
      .map((item) => ({
        user_id: item.id,
        type: 'system',
        title: '이벤트 일정 등록',
        description: `${event.title} (${formatDateLabel(event.meeting_date)}${event.event_end_date ? ` ~ ${formatDateLabel(event.event_end_date)}` : ''})`,
        data: { announcementId: event.id, eventId: event.id },
      }));

    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications);
    }
  };

  const invalidateScheduleQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['meeting-widget-schedule-events'] });
    queryClient.invalidateQueries({ queryKey: ['announcements'] });
    queryClient.invalidateQueries({ queryKey: ['announcement-events'] });
    queryClient.invalidateQueries({ queryKey: ['calendar-announcement-events'] });
    queryClient.invalidateQueries({ queryKey: ['today-upcoming-events'] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인이 필요합니다.');
      if (formError) throw new Error(formError);

      const { data, error } = await supabase
        .from('announcements')
        .insert({
          title: draft.title.trim(),
          content: draft.content.trim(),
          author_id: user.id,
          author_name: profile.full_name || user.email || '관리자',
          announcement_type: 'event',
          meeting_date: draft.start_date,
          event_end_date: draft.end_date || null,
          meeting_location: draft.location.trim() || null,
        })
        .select('id, title, content, author_id, author_name, announcement_type, meeting_date, meeting_location, event_end_date, created_at, updated_at')
        .single();
      if (error) throw error;
      await notifyEventCreated(data as ScheduleEventRow);
      return data as ScheduleEventRow;
    },
    onSuccess: (event) => {
      toast.success('이벤트 일정이 등록되었습니다.');
      setDraft(createEmptyDraft());
      setSelectedEventId(event.id);
      setDetailDraft({
        title: event.title,
        content: event.content,
        start_date: event.meeting_date || todayString(),
        end_date: event.event_end_date || '',
        location: event.meeting_location || '',
      });
      invalidateScheduleQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || '이벤트 일정 등록에 실패했습니다.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEvent || !detailDraft) throw new Error('수정할 이벤트를 선택해주세요.');
      if (detailError) throw new Error(detailError);

      const { data, error } = await supabase
        .from('announcements')
        .update({
          title: detailDraft.title.trim(),
          content: detailDraft.content.trim(),
          meeting_date: detailDraft.start_date,
          event_end_date: detailDraft.end_date || null,
          meeting_location: detailDraft.location.trim() || null,
        })
        .eq('id', selectedEvent.id)
        .select('id, title, content, author_id, author_name, announcement_type, meeting_date, meeting_location, event_end_date, created_at, updated_at')
        .single();
      if (error) throw error;
      return data as ScheduleEventRow;
    },
    onSuccess: (event) => {
      toast.success('이벤트 일정이 수정되었습니다.');
      setSelectedEventId(event.id);
      setDetailDraft({
        title: event.title,
        content: event.content,
        start_date: event.meeting_date || todayString(),
        end_date: event.event_end_date || '',
        location: event.meeting_location || '',
      });
      invalidateScheduleQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || '이벤트 일정 수정에 실패했습니다.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from('announcements').delete().eq('id', eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('이벤트 일정이 삭제되었습니다.');
      setSelectedEventId(null);
      setDetailDraft(null);
      invalidateScheduleQueries();
    },
    onError: (error: Error) => {
      toast.error(error.message || '이벤트 일정 삭제에 실패했습니다.');
    },
  });

  const openDetail = (event: ScheduleEventRow) => {
    setSelectedEventId(event.id);
    setDetailDraft({
      title: event.title,
      content: event.content,
      start_date: event.meeting_date || todayString(),
      end_date: event.event_end_date || '',
      location: event.meeting_location || '',
    });
  };

  return (
    <div className={cn('grid min-w-0 gap-5 p-4 sm:p-5', compactLayout ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_370px]')}>
      <div className="min-w-0 space-y-4">
        <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#cacacb] bg-white">
              <PartyPopper className="h-4 w-4 text-[#111111]" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[#111111]">이벤트 일정</h3>
              <p className="mt-1 text-xs leading-5 text-[#707072]">
                전사 이벤트와 주요 일정을 미팅 예약 화면에서 함께 관리합니다.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold text-[#39393b]">제목</Label>
            <Input
              value={draft.title}
              disabled={!canManage}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="예: 쇼룸 오픈 이벤트"
              className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#39393b]">시작일</Label>
            <Input
              type="date"
              value={draft.start_date}
              disabled={!canManage}
              onChange={(event) => setDraft((prev) => ({ ...prev, start_date: event.target.value }))}
              className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-[#39393b]">종료일</Label>
            <Input
              type="date"
              value={draft.end_date}
              min={draft.start_date}
              disabled={!canManage}
              onChange={(event) => setDraft((prev) => ({ ...prev, end_date: event.target.value }))}
              className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold text-[#39393b]">장소</Label>
            <Input
              value={draft.location}
              disabled={!canManage}
              onChange={(event) => setDraft((prev) => ({ ...prev, location: event.target.value }))}
              placeholder="예: ACBANK 쇼룸"
              className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs font-semibold text-[#39393b]">내용</Label>
            <Textarea
              value={draft.content}
              disabled={!canManage}
              onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="이벤트 내용, 준비 사항, 공유할 안내를 입력하세요."
              className="min-h-28 rounded-lg border-[#cacacb] bg-white text-sm"
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={!!formError || createMutation.isPending}
          className="h-11 w-full rounded-full bg-[#111111] text-sm font-semibold text-white hover:bg-[#39393b]"
        >
          {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PartyPopper className="mr-2 h-4 w-4" />}
          이벤트 일정 등록
        </Button>
        {formError && <p className="text-center text-xs font-medium text-[#707072]">{formError}</p>}
      </div>

      <aside className="min-w-0 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: '오늘', value: todayCount },
            { label: '7일 내', value: weekCount },
            { label: '전체', value: events.length },
          ].map((item) => (
            <div key={item.label} className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3">
              <CalendarDays className="h-4 w-4 text-[#707072]" />
              <p className="mt-2 text-xl font-bold leading-none text-[#111111]">{item.value}</p>
              <p className="mt-1 text-xs font-medium text-[#707072]">{item.label}</p>
            </div>
          ))}
        </div>

        {selectedEvent && detailDraft && (
          <div className="rounded-lg border border-[#111111] bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-3 py-3">
              <div>
                <h3 className="text-sm font-bold text-[#111111]">이벤트 상세</h3>
                <p className="text-xs text-[#707072]">수정 후 저장하면 캘린더와 알림 영역에 반영됩니다.</p>
              </div>
              {canManage && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => {
                    if (confirm('이 이벤트 일정을 삭제하시겠습니까?')) deleteMutation.mutate(selectedEvent.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="space-y-3 p-3">
              <Input
                value={detailDraft.title}
                disabled={!canManage}
                onChange={(event) => setDetailDraft((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm font-semibold"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={detailDraft.start_date}
                  disabled={!canManage}
                  onChange={(event) => setDetailDraft((prev) => (prev ? { ...prev, start_date: event.target.value } : prev))}
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />
                <Input
                  type="date"
                  value={detailDraft.end_date}
                  min={detailDraft.start_date}
                  disabled={!canManage}
                  onChange={(event) => setDetailDraft((prev) => (prev ? { ...prev, end_date: event.target.value } : prev))}
                  className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
                />
              </div>
              <Input
                value={detailDraft.location}
                disabled={!canManage}
                onChange={(event) => setDetailDraft((prev) => (prev ? { ...prev, location: event.target.value } : prev))}
                placeholder="장소"
                className="h-10 rounded-lg border-[#cacacb] bg-white text-sm"
              />
              <Textarea
                value={detailDraft.content}
                disabled={!canManage}
                onChange={(event) => setDetailDraft((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
                className="min-h-24 rounded-lg border-[#cacacb] bg-white text-sm"
              />
              {canManage && (
                <Button
                  type="button"
                  onClick={() => updateMutation.mutate()}
                  disabled={!!detailError || updateMutation.isPending}
                  className="h-10 w-full rounded-full bg-[#111111] text-sm font-semibold text-white hover:bg-[#39393b]"
                >
                  {updateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  변경 저장
                </Button>
              )}
              {detailError && <p className="text-center text-xs font-medium text-[#707072]">{detailError}</p>}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[#e5e5e5] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] px-3 py-3">
            <div>
              <h3 className="text-sm font-bold text-[#111111]">다가오는 이벤트</h3>
              <p className="text-xs text-[#707072]">목록에서 상세 편집 패널을 열 수 있습니다.</p>
            </div>
            <AlertCircle className="h-4 w-4 text-[#707072]" />
          </div>
          <div className="max-h-[540px] divide-y divide-[#e5e5e5] overflow-auto">
            {isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-[#707072]">
                <Loader2 className="h-4 w-4 animate-spin" />
                이벤트 일정을 불러오는 중
              </div>
            ) : visibleEvents.length > 0 ? (
              visibleEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => openDetail(event)}
                  className={cn(
                    'block w-full space-y-2 p-3 text-left transition-colors hover:bg-[#fafafa]',
                    selectedEventId === event.id && 'bg-[#f5f5f5]',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Badge variant="outline" className="h-5 rounded-full border-emerald-500 px-2 text-[11px] font-semibold text-emerald-700">
                        이벤트
                      </Badge>
                      <h4 className="mt-1 truncate text-sm font-bold text-[#111111]">{event.title}</h4>
                    </div>
                    <span className="shrink-0 text-xs text-[#707072]">
                      {formatDateLabel(event.meeting_date)}
                    </span>
                  </div>
                  {event.event_end_date && (
                    <p className="text-xs text-[#707072]">종료 {formatDateLabel(event.event_end_date)}</p>
                  )}
                  {event.meeting_location && (
                    <div className="flex items-center gap-1.5 text-xs text-[#707072]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{event.meeting_location}</span>
                    </div>
                  )}
                  <p className="line-clamp-2 text-xs leading-5 text-[#707072]">{event.content}</p>
                </button>
              ))
            ) : (
              <div className="p-4 text-sm text-[#707072]">예정된 이벤트 일정이 없습니다.</div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MeetingScheduleEventsPanel;
