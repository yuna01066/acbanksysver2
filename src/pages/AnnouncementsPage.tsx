import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Megaphone, ArrowLeft, Plus, Loader2, Trash2, Edit, Pin, Calendar, MapPin, Clock, PartyPopper } from 'lucide-react';
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
  announcement_type: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_location: string | null;
  event_end_date: string | null;
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
  const [announcementType, setAnnouncementType] = useState<'general' | 'meeting' | 'event'>('general');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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

      const isMeetingOrEvent = announcementType === 'meeting' || announcementType === 'event';

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title,
            content,
            announcement_type: announcementType,
            meeting_date: isMeetingOrEvent ? meetingDate || null : null,
            meeting_time: announcementType === 'meeting' ? meetingTime || null : null,
            meeting_location: isMeetingOrEvent ? meetingLocation || null : null,
            event_end_date: announcementType === 'event' ? eventEndDate || null : null,
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const insertData: any = {
          title,
          content,
          author_id: user.id,
          author_name: profile.full_name || user.email || '관리자',
          announcement_type: announcementType,
        };
        if (isMeetingOrEvent) {
          insertData.meeting_date = meetingDate || null;
          insertData.meeting_location = meetingLocation || null;
        }
        if (announcementType === 'meeting') {
          insertData.meeting_time = meetingTime || null;
        }
        if (announcementType === 'event') {
          insertData.event_end_date = eventEndDate || null;
        }

        const { data: announcement, error } = await supabase
          .from('announcements')
          .insert(insertData)
          .select()
          .single();
        if (error) throw error;

        // Post to team chat
        if (announcementType === 'meeting') {
          const meetingInfo = `📋 회의 공지: ${title}\n📅 ${meetingDate || '미정'}${meetingTime ? ` ⏰ ${meetingTime}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
          await supabase.from('team_messages').insert({
            user_id: user.id,
            user_name: profile.full_name || user.email || '관리자',
            avatar_url: profile.avatar_url || null,
            message: meetingInfo,
          });
        } else if (announcementType === 'event') {
          const eventInfo = `❗ 이벤트 공지: ${title}\n📅 ${meetingDate || '미정'}${eventEndDate ? ` ~ ${eventEndDate}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
          await supabase.from('team_messages').insert({
            user_id: user.id,
            user_name: profile.full_name || user.email || '관리자',
            avatar_url: profile.avatar_url || null,
            message: eventInfo,
          });
        }

        // Notify all users
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_approved', true);

        if (allProfiles && allProfiles.length > 0) {
          const notiTitle = announcementType === 'meeting' ? '📋 회의 공지'
            : announcementType === 'event' ? '❗ 이벤트 공지'
            : '새 공지사항';
          const notiDesc = announcementType === 'meeting'
            ? `회의가 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${meetingTime ? ` ${meetingTime}` : ''})`
            : announcementType === 'event'
            ? `이벤트가 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${eventEndDate ? ` ~ ${eventEndDate}` : ''})`
            : `공지사항이 등록되었습니다: ${title}`;
          const notifications = allProfiles
            .filter(p => p.id !== user.id)
            .map(p => ({
              user_id: p.id,
              type: 'system',
              title: notiTitle,
              description: notiDesc,
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
      queryClient.invalidateQueries({ queryKey: ['announcement-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-events'] });
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
      if (!isPinned) {
        const pinnedCount = announcements?.filter(a => a.is_pinned).length || 0;
        if (pinnedCount >= 2) {
          throw new Error('고정 공지는 최대 2건까지 가능합니다.');
        }
      }
      const { error } = await supabase.from('announcements').update({ is_pinned: !isPinned }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err: any) => {
      toast.error(err.message || '처리 실패');
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAnnouncementType('general');
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLocation('');
    setEventEndDate('');
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setAnnouncementType((a.announcement_type || 'general') as 'general' | 'meeting' | 'event');
    setMeetingDate(a.meeting_date || '');
    setMeetingTime(a.meeting_time || '');
    setMeetingLocation(a.meeting_location || '');
    setEventEndDate(a.event_end_date || '');
    setShowForm(true);
  };

  const getTypeBadge = (type: string) => {
    if (type === 'meeting') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-600">회의</Badge>;
    if (type === 'event') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500 text-emerald-600">이벤트</Badge>;
    return null;
  };

  const renderAnnouncementCard = (a: Announcement) => {
    const isEvent = a.announcement_type === 'event';
    const isMeeting = a.announcement_type === 'meeting';
    const hasDateInfo = isMeeting || isEvent;

    return (
      <Card key={a.id} className={a.is_pinned ? 'border-primary/30 bg-primary/5' : ''}>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {a.is_pinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                {getTypeBadge(a.announcement_type)}
                <h3 className="font-semibold text-lg">{a.title}</h3>
              </div>
              {hasDateInfo && (a.meeting_date || a.meeting_time || a.meeting_location) && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2 flex-wrap">
                  {a.meeting_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      {a.meeting_date}
                      {isEvent && a.event_end_date && ` ~ ${a.event_end_date}`}
                    </span>
                  )}
                  {isMeeting && a.meeting_time && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.meeting_time}</span>
                  )}
                  {a.meeting_location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.meeting_location}</span>
                  )}
                </div>
              )}
              {(() => {
                const isLong = a.content.split('\n').length > 5 || a.content.length > 300;
                const isExpanded = expandedIds.has(a.id);
                return (
                  <>
                    <p className={`text-base text-foreground/80 whitespace-pre-wrap mt-2 leading-relaxed ${!isExpanded && isLong ? 'line-clamp-5' : ''}`}>
                      {a.content}
                    </p>
                    {isLong && !isExpanded && (
                      <button className="text-sm text-primary mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); setExpandedIds(prev => new Set(prev).add(a.id)); }}>
                        ... 더보기
                      </button>
                    )}
                    {isLong && isExpanded && (
                      <button className="text-sm text-muted-foreground mt-1 hover:underline" onClick={(e) => { e.stopPropagation(); setExpandedIds(prev => { const s = new Set(prev); s.delete(a.id); return s; }); }}>
                        접기
                      </button>
                    )}
                  </>
                );
              })()}
              <div className="flex items-center gap-3 mt-3 text-sm text-muted-foreground">
                <span>{a.author_name}</span>
                <span>{format(new Date(a.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}</span>
              </div>
            </div>
            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePinMutation.mutate({ id: a.id, isPinned: a.is_pinned })} title={a.is_pinned ? '고정 해제' : '상단 고정'}>
                  <Pin className={`h-3.5 w-3.5 ${a.is_pinned ? 'text-primary' : 'text-muted-foreground'}`} />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(a)}>
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => { if (confirm('정말 삭제하시겠습니까?')) deleteMutation.mutate(a.id); }}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const isFormValid = () => {
    if (!title.trim() || !content.trim()) return false;
    if (announcementType === 'meeting' && !meetingDate) return false;
    if (announcementType === 'event' && !meetingDate) return false;
    return true;
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

        {canManage && showForm && (
          <Card className="mb-6">
            <CardContent className="pt-6 space-y-3">
              <div className="flex gap-2">
                <Button type="button" variant={announcementType === 'general' ? 'default' : 'outline'} size="sm" onClick={() => setAnnouncementType('general')}>
                  <Megaphone className="h-4 w-4 mr-1" />공지
                </Button>
                <Button type="button" variant={announcementType === 'meeting' ? 'default' : 'outline'} size="sm" onClick={() => setAnnouncementType('meeting')}>
                  <Calendar className="h-4 w-4 mr-1" />회의
                </Button>
                <Button type="button" variant={announcementType === 'event' ? 'default' : 'outline'} size="sm" onClick={() => setAnnouncementType('event')}>
                  <PartyPopper className="h-4 w-4 mr-1" />이벤트
                </Button>
              </div>
              <Input
                placeholder={announcementType === 'meeting' ? '회의 제목' : announcementType === 'event' ? '이벤트 제목' : '공지 제목'}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              {announcementType === 'meeting' && (
                <div className="grid grid-cols-3 gap-2">
                  <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} placeholder="날짜" />
                  <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} placeholder="시간" />
                  <Input placeholder="장소" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} />
                </div>
              )}
              {announcementType === 'event' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">시작일</label>
                    <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">종료일</label>
                    <Input type="date" value={eventEndDate} onChange={e => setEventEndDate(e.target.value)} min={meetingDate} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">장소 (선택)</label>
                    <Input placeholder="장소" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} />
                  </div>
                </div>
              )}
              <Textarea placeholder="내용을 입력하세요..." value={content} onChange={(e) => setContent(e.target.value)} rows={5} className="resize-none" />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={resetForm}>취소</Button>
                <Button onClick={() => postMutation.mutate()} disabled={!isFormValid() || postMutation.isPending}>
                  {postMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {editingId ? '수정' : '등록'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : announcements && announcements.length > 0 ? (
          <div className="space-y-6">
            {(() => {
              const pinned = announcements.filter(a => a.is_pinned);
              if (pinned.length === 0) return null;
              return (
                <div className={`grid gap-4 ${pinned.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {pinned.map(renderAnnouncementCard)}
                </div>
              );
            })()}
            {(() => {
              const unpinned = announcements.filter(a => !a.is_pinned);
              if (unpinned.length === 0) return null;
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {unpinned.map(renderAnnouncementCard)}
                </div>
              );
            })()}
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
