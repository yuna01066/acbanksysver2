import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import DashboardCalendar from '@/components/DashboardCalendar';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Megaphone, Plus, Loader2, Trash2, Edit, Pin, Calendar, MapPin, Clock, PartyPopper, Building2, Users, X, Coffee, LayoutGrid, Home, Search, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { endOfWeek, format, isSameDay, isWithinInterval, startOfWeek } from 'date-fns';
import { ko } from 'date-fns/locale';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';

type AnnouncementType = 'general' | 'event' | 'conference' | 'meeting';

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
  recipient_id: string | null;
  recipient_name: string | null;
  assignee_ids: string[] | null;
  assignee_names: string[] | null;
  created_at: string;
  updated_at: string;
}

const TAB_CONFIG: { value: string; label: string; icon: React.ReactNode; types: string[] }[] = [
  { value: 'all', label: '전체', icon: <LayoutGrid className="h-4 w-4" />, types: ['general', 'event', 'conference', 'meeting'] },
  { value: 'general', label: '공지', icon: <Megaphone className="h-4 w-4" />, types: ['general'] },
  { value: 'event', label: '이벤트', icon: <PartyPopper className="h-4 w-4" />, types: ['event'] },
  { value: 'conference', label: '회의', icon: <Users className="h-4 w-4" />, types: ['conference'] },
  { value: 'meeting', label: '미팅', icon: <Coffee className="h-4 w-4" />, types: ['meeting'] },
];

const AnnouncementsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<AnnouncementType>('general');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [eventEndDate, setEventEndDate] = useState('');
  const [selectedRecipientId, setSelectedRecipientId] = useState<string | null>(null);
  const [recipientNameInput, setRecipientNameInput] = useState('');
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const canManage = isAdmin || isModerator;
  const focusedAnnouncementId = searchParams.get('focus');

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

  const { data: recipients } = useQuery({
    queryKey: ['recipients-for-announcement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recipients')
        .select('id, company_name')
        .order('company_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user && canManage,
  });

  const { data: employees } = useQuery({
    queryKey: ['employees-for-announcement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_approved', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
    enabled: !!user && canManage,
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 필요');

      const hasDateFields = announcementType === 'event' || announcementType === 'conference' || announcementType === 'meeting';
      const assigneeNames = selectedAssigneeIds.map(id => employees?.find(e => e.id === id)?.full_name || '').filter(Boolean);
      const recipientName = selectedRecipientId 
        ? recipients?.find(r => r.id === selectedRecipientId)?.company_name || recipientNameInput 
        : recipientNameInput || null;

      if (editingId) {
        const { error } = await supabase
          .from('announcements')
          .update({
            title,
            content,
            announcement_type: announcementType,
            meeting_date: hasDateFields ? meetingDate || null : null,
            meeting_time: (announcementType === 'conference' || announcementType === 'meeting') ? meetingTime || null : null,
            meeting_location: hasDateFields ? meetingLocation || null : null,
            event_end_date: announcementType === 'event' ? eventEndDate || null : null,
            recipient_id: announcementType === 'meeting' ? selectedRecipientId : null,
            recipient_name: announcementType === 'meeting' ? recipientName : null,
            assignee_ids: announcementType === 'meeting' ? selectedAssigneeIds : [],
            assignee_names: announcementType === 'meeting' ? assigneeNames : [],
          })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const insertData: Record<string, unknown> = {
          title,
          content,
          author_id: user.id,
          author_name: profile.full_name || user.email || '관리자',
          announcement_type: announcementType,
        };
        if (hasDateFields) {
          insertData.meeting_date = meetingDate || null;
          insertData.meeting_location = meetingLocation || null;
        }
        if (announcementType === 'conference' || announcementType === 'meeting') {
          insertData.meeting_time = meetingTime || null;
        }
        if (announcementType === 'meeting') {
          insertData.recipient_id = selectedRecipientId;
          insertData.recipient_name = recipientName;
          insertData.assignee_ids = selectedAssigneeIds;
          insertData.assignee_names = assigneeNames;
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
        if (announcementType === 'conference') {
          const info = `📋 회의 공지: ${title}\n📅 ${meetingDate || '미정'}${meetingTime ? ` ⏰ ${meetingTime}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
          await supabase.from('team_messages').insert({
            user_id: user.id,
            user_name: profile.full_name || user.email || '관리자',
            avatar_url: profile.avatar_url || null,
            message: info,
          });
        } else if (announcementType === 'meeting') {
          const info = `☕ 미팅: ${title}\n📅 ${meetingDate || '미정'}${meetingTime ? ` ⏰ ${meetingTime}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}${recipientName ? `\n🏢 ${recipientName}` : ''}`;
          await supabase.from('team_messages').insert({
            user_id: user.id,
            user_name: profile.full_name || user.email || '관리자',
            avatar_url: profile.avatar_url || null,
            message: info,
          });
        } else if (announcementType === 'event') {
          const info = `❗ 이벤트 공지: ${title}\n📅 ${meetingDate || '미정'}${eventEndDate ? ` ~ ${eventEndDate}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
          await supabase.from('team_messages').insert({
            user_id: user.id,
            user_name: profile.full_name || user.email || '관리자',
            avatar_url: profile.avatar_url || null,
            message: info,
          });
        }

        // Notify all users
        const { data: allProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('is_approved', true);

        if (allProfiles && allProfiles.length > 0) {
          const notiTitle = announcementType === 'conference' ? '📋 회의 공지'
            : announcementType === 'meeting' ? '☕ 미팅 등록'
            : announcementType === 'event' ? '❗ 이벤트 공지'
            : '새 공지사항';
          const notiDesc = announcementType === 'conference'
            ? `회의가 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${meetingTime ? ` ${meetingTime}` : ''})`
            : announcementType === 'meeting'
            ? `미팅이 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${meetingTime ? ` ${meetingTime}` : ''})`
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
      queryClient.invalidateQueries({ queryKey: ['latest-announcements'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-meetings'] });
      queryClient.invalidateQueries({ queryKey: ['announcement-events'] });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      toast.error('실패: ' + message);
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
      queryClient.invalidateQueries({ queryKey: ['latest-announcements'] });
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
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : '처리 실패';
      toast.error(message);
    },
  });

  const allAnnouncements = useMemo(() => announcements || [], [announcements]);

  const getAnnouncementDate = (announcement: Announcement) => {
    const dateValue = announcement.meeting_date || announcement.created_at;
    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  };

  const filteredAnnouncements = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return allAnnouncements.filter((announcement) => {
      const searchableText = [
        announcement.title,
        announcement.content,
        announcement.author_name,
        announcement.recipient_name,
        announcement.meeting_location,
        ...(announcement.assignee_names || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch = !normalizedSearch || searchableText.includes(normalizedSearch);
      const announcementDate = getAnnouncementDate(announcement);
      const matchesDate = !dateFilter || (
        announcementDate
        && format(announcementDate, 'yyyy-MM-dd') === dateFilter
      );

      return matchesSearch && matchesDate;
    });
  }, [allAnnouncements, searchTerm, dateFilter]);

  const summary = useMemo(() => {
    const today = new Date();
    const weekRange = {
      start: startOfWeek(today, { weekStartsOn: 1 }),
      end: endOfWeek(today, { weekStartsOn: 1 }),
    };

    const scheduled = allAnnouncements.filter((announcement) =>
      ['event', 'conference', 'meeting'].includes(announcement.announcement_type)
    );

    return {
      total: allAnnouncements.length,
      pinned: allAnnouncements.filter((announcement) => announcement.is_pinned).length,
      today: scheduled.filter((announcement) => {
        const date = getAnnouncementDate(announcement);
        return date ? isSameDay(date, today) : false;
      }).length,
      thisWeek: scheduled.filter((announcement) => {
        const date = getAnnouncementDate(announcement);
        return date ? isWithinInterval(date, weekRange) : false;
      }).length,
    };
  }, [allAnnouncements]);

  useEffect(() => {
    if (!focusedAnnouncementId || allAnnouncements.length === 0) return;

    const target = allAnnouncements.find((announcement) => announcement.id === focusedAnnouncementId);
    if (!target) return;

    setActiveTab(target.announcement_type || 'all');
    setExpandedIds(prev => new Set(prev).add(target.id));

    window.setTimeout(() => {
      document.getElementById(`announcement-${target.id}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 120);
  }, [focusedAnnouncementId, allAnnouncements]);

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAnnouncementType(activeTab === 'all' ? 'general' : activeTab as AnnouncementType);
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLocation('');
    setEventEndDate('');
    setSelectedRecipientId(null);
    setRecipientNameInput('');
    setSelectedAssigneeIds([]);
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setAnnouncementType((a.announcement_type || 'general') as AnnouncementType);
    setMeetingDate(a.meeting_date || '');
    setMeetingTime(a.meeting_time || '');
    setMeetingLocation(a.meeting_location || '');
    setEventEndDate(a.event_end_date || '');
    setSelectedRecipientId(a.recipient_id || null);
    setRecipientNameInput(a.recipient_name || '');
    setSelectedAssigneeIds(a.assignee_ids || []);
    setShowForm(true);
    setActiveTab(a.announcement_type || 'general');
  };

  const getTypeBadge = (type: string) => {
    if (type === 'conference') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-blue-500 text-blue-600">회의</Badge>;
    if (type === 'meeting') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500 text-amber-600">미팅</Badge>;
    if (type === 'event') return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-emerald-500 text-emerald-600">이벤트</Badge>;
    return null;
  };

  const renderAnnouncementCard = (a: Announcement) => {
    const isEvent = a.announcement_type === 'event';
    const isConference = a.announcement_type === 'conference';
    const isMeeting = a.announcement_type === 'meeting';
    const hasDateInfo = isEvent || isConference || isMeeting;
    const isFocused = focusedAnnouncementId === a.id;

    return (
      <Card
        key={a.id}
        id={`announcement-${a.id}`}
        className={[
          a.is_pinned ? 'border-primary/30 bg-primary/5' : '',
          isFocused ? 'ring-2 ring-primary/35 shadow-depth' : '',
        ].filter(Boolean).join(' ')}
      >
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
                  {(isConference || isMeeting) && a.meeting_time && (
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{a.meeting_time}</span>
                  )}
                  {a.meeting_location && (
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{a.meeting_location}</span>
                  )}
                  {isMeeting && a.recipient_name && (
                    <span className="flex items-center gap-1 cursor-pointer hover:text-foreground transition-colors" onClick={(e) => { e.stopPropagation(); if (a.recipient_id) navigate(`/recipients?id=${a.recipient_id}`); }}>
                      <Building2 className="h-3.5 w-3.5" />
                      <span className={a.recipient_id ? 'underline' : ''}>{a.recipient_name}</span>
                    </span>
                  )}
                </div>
              )}
              {isMeeting && a.assignee_names && a.assignee_names.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <Users className="h-3.5 w-3.5 shrink-0" />
                  <span>담당: {a.assignee_names.join(', ')}</span>
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
    if ((announcementType === 'conference' || announcementType === 'meeting' || announcementType === 'event') && !meetingDate) return false;
    return true;
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    resetForm();
    setAnnouncementType(tab === 'all' ? 'general' : tab as AnnouncementType);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    if (focusedAnnouncementId) setSearchParams({}, { replace: true });
  };

  const getItemsForTab = (tab: string) => {
    const config = TAB_CONFIG.find(t => t.value === tab);
    if (!config) return [];
    return filteredAnnouncements.filter(a => config.types.includes(a.announcement_type));
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">로그인이 필요합니다.</p>
      </div>
    );
  }

  const renderForm = () => {
    if (!canManage || !showForm) return null;

    return (
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-3">
          <Input
            placeholder={
              announcementType === 'conference' ? '회의 제목' :
              announcementType === 'meeting' ? '미팅 제목' :
              announcementType === 'event' ? '이벤트 제목' : '공지 제목'
            }
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {/* 회의: date/time/location */}
          {announcementType === 'conference' && (
            <div className="grid grid-cols-3 gap-2">
              <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} placeholder="날짜" />
              <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} placeholder="시간" />
              <Input placeholder="장소 (선택)" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} />
            </div>
          )}
          {/* 미팅: date/time/location + recipient + assignees */}
          {announcementType === 'meeting' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} placeholder="날짜" />
                <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} placeholder="시간" />
                <Input placeholder="장소" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="h-3 w-3" />고객사 (선택)</label>
                  <div className="flex gap-1">
                    <Select value={selectedRecipientId || '__none__'} onValueChange={(v) => { setSelectedRecipientId(v === '__none__' ? null : v); if (v !== '__none__') { const r = recipients?.find(r => r.id === v); if (r) setRecipientNameInput(r.company_name); } }}>
                      <SelectTrigger className="flex-1 h-9">
                        <SelectValue placeholder="수신처 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">직접 입력</SelectItem>
                        {recipients?.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.company_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedRecipientId && (
                      <Input className="flex-1 h-9" placeholder="고객사명 입력" value={recipientNameInput} onChange={e => setRecipientNameInput(e.target.value)} />
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />담당자 배정</label>
                  <Select value="__none__" onValueChange={(v) => { if (v !== '__none__' && !selectedAssigneeIds.includes(v)) setSelectedAssigneeIds(prev => [...prev, v]); }}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="담당자 추가" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">선택하세요</SelectItem>
                      {employees?.filter(e => !selectedAssigneeIds.includes(e.id)).map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAssigneeIds.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAssigneeIds.map(id => {
                        const emp = employees?.find(e => e.id === id);
                        return (
                          <Badge key={id} variant="secondary" className="text-xs gap-1 pr-1">
                            {emp?.full_name || '?'}
                            <button onClick={() => setSelectedAssigneeIds(prev => prev.filter(i => i !== id))} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
          {/* 이벤트: start/end date + location */}
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
    );
  };

  const renderList = (items: Announcement[], emptyIcon: React.ReactNode, emptyText: string) => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (items.length === 0) {
      return (
        <div className="text-center py-16 text-muted-foreground">
          <div className="mx-auto mb-3 opacity-30">{emptyIcon}</div>
          <p>{emptyText}</p>
        </div>
      );
    }

    const pinned = items.filter(a => a.is_pinned);
    const unpinned = items.filter(a => !a.is_pinned);

    return (
      <div className="space-y-6">
        {pinned.length > 0 && (
          <div className={`grid gap-4 ${pinned.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
            {pinned.map(renderAnnouncementCard)}
          </div>
        )}
        {unpinned.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {unpinned.map(renderAnnouncementCard)}
          </div>
        )}
      </div>
    );
  };

  const tabLabels: Record<string, string> = { all: '공지', general: '공지', event: '이벤트', conference: '회의', meeting: '미팅' };
  const tabEmptyIcons: Record<string, React.ReactNode> = {
    all: <Megaphone className="h-10 w-10 mx-auto" />,
    general: <Megaphone className="h-10 w-10 mx-auto" />,
    event: <PartyPopper className="h-10 w-10 mx-auto" />,
    conference: <Users className="h-10 w-10 mx-auto" />,
    meeting: <Coffee className="h-10 w-10 mx-auto" />,
  };

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Notice & Calendar"
        title="공지사항"
        description="사내 공지와 회의, 미팅, 이벤트 일정을 한 화면에서 확인합니다."
        icon={<Megaphone className="h-5 w-5" />}
        actions={(
          <>
            {canManage && (
              <Button
                onClick={() => {
                  resetForm();
                  setAnnouncementType(activeTab === 'all' ? 'general' : activeTab as AnnouncementType);
                  setShowForm(true);
                }}
                size="sm"
              >
                <Plus className="h-4 w-4" />
                새 {tabLabels[activeTab] || '공지'} 작성
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4" />
              홈
            </Button>
          </>
        )}
      />

      <div className="grid gap-3 md:grid-cols-4">
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">전체 공지</div>
          <div className="mt-1 text-xl font-semibold">{summary.total.toLocaleString()}건</div>
        </div>
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">오늘 일정</div>
          <div className="mt-1 text-xl font-semibold">{summary.today.toLocaleString()}건</div>
        </div>
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">이번주 일정</div>
          <div className="mt-1 text-xl font-semibold">{summary.thisWeek.toLocaleString()}건</div>
        </div>
        <div className="glass-surface rounded-2xl px-4 py-3">
          <div className="text-xs text-muted-foreground">고정 공지</div>
          <div className="mt-1 text-xl font-semibold">{summary.pinned.toLocaleString()}건</div>
        </div>
      </div>

      <DashboardCalendar />

      <SearchFilterBar>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="제목, 내용, 작성자, 장소, 담당자 검색"
              className="pl-10"
            />
          </div>
          <div className="relative">
            <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={resetFilters}
            disabled={!searchTerm && !dateFilter && !focusedAnnouncementId}
          >
            필터 초기화
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>표시 {filteredAnnouncements.length.toLocaleString()}건</span>
          {focusedAnnouncementId && (
            <Badge variant="secondary" className="h-6">
              캘린더에서 선택한 일정 표시 중
            </Badge>
          )}
        </div>
      </SearchFilterBar>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6 grid h-auto w-full grid-cols-2 gap-1 p-1 sm:grid-cols-5">
          {TAB_CONFIG.map(tab => {
            const count = getItemsForTab(tab.value).length;
            return (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-1.5">
                {tab.icon}
                {tab.label}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-4 px-1.5 text-[10px]">{count}</Badge>
                )}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {TAB_CONFIG.map(tab => (
          <TabsContent key={tab.value} value={tab.value}>
            {renderForm()}
            {renderList(
              getItemsForTab(tab.value),
              tabEmptyIcons[tab.value],
              `등록된 ${tab.label}이(가) 없습니다.`
            )}
          </TabsContent>
        ))}
      </Tabs>
    </PageShell>
  );
};

export default AnnouncementsPage;
