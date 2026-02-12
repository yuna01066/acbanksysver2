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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Megaphone, ArrowRight, Plus, Loader2, Calendar, CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = ['00', '10', '20', '30', '40', '50'];

const AnnouncementCard = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<'general' | 'meeting'>('general');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingTime, setMeetingTime] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [selectedHour, setSelectedHour] = useState('10');
  const [selectedMinute, setSelectedMinute] = useState('00');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  const { data: latestAnnouncements = [] } = useQuery({
    queryKey: ['latest-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인이 필요합니다.');
      
      const finalMeetingTime = meetingTime || (announcementType === 'meeting' ? `${selectedHour}:${selectedMinute}` : '');

      const insertData: any = {
        title,
        content,
        author_id: user.id,
        author_name: profile.full_name || user.email || '관리자',
        announcement_type: announcementType,
      };
      if (announcementType === 'meeting') {
        insertData.meeting_date = meetingDate || null;
        insertData.meeting_time = finalMeetingTime || null;
        insertData.meeting_location = meetingLocation || null;
      }
      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      if (announcementType === 'meeting') {
        const meetingInfo = `📋 회의 공지: ${title}\n📅 ${meetingDate || '미정'}${finalMeetingTime ? ` ⏰ ${finalMeetingTime}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
        await supabase.from('team_messages').insert({
          user_id: user.id,
          user_name: profile.full_name || user.email || '관리자',
          avatar_url: profile.avatar_url || null,
          message: meetingInfo,
        });
      }

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_approved', true);

      if (allProfiles && allProfiles.length > 0) {
        const notiTitle = announcementType === 'meeting' ? '📋 회의 공지' : '새 공지사항';
        const notiDesc = announcementType === 'meeting'
          ? `회의가 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${finalMeetingTime ? ` ${finalMeetingTime}` : ''})`
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

      return announcement;
    },
    onSuccess: () => {
      toast.success(announcementType === 'meeting' ? '회의 공지가 등록되었습니다.' : '공지사항이 등록되었습니다.');
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['latest-announcements'] });
    },
    onError: (err: any) => {
      toast.error('등록 실패: ' + (err.message || '알 수 없는 오류'));
    },
  });

  const resetForm = () => {
    setTitle('');
    setContent('');
    setAnnouncementType('general');
    setMeetingDate('');
    setMeetingTime('');
    setMeetingLocation('');
    setSelectedHour('10');
    setSelectedMinute('00');
    setShowForm(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setMeetingDate(format(date, 'yyyy-MM-dd'));
      setDatePickerOpen(false);
    }
  };

  const handleTimeSelect = (hour: string, minute: string) => {
    setSelectedHour(hour);
    setSelectedMinute(minute);
    setMeetingTime(`${hour}:${minute}`);
    setTimePickerOpen(false);
  };

  const canPost = isAdmin || isModerator;

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-primary" />
            <CardTitle className="text-xl">공지사항</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {canPost && (
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setShowForm(!showForm)}>
                <Plus className="h-3 w-3 mr-1" />작성
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigate('/announcements')}>
              전체보기<ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {canPost && showForm && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <div className="flex gap-2">
              <Button type="button" variant={announcementType === 'general' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setAnnouncementType('general')}>
                <Megaphone className="h-3 w-3 mr-1" />공지
              </Button>
              <Button type="button" variant={announcementType === 'meeting' ? 'default' : 'outline'} size="sm" className="h-7 text-xs" onClick={() => setAnnouncementType('meeting')}>
                <Calendar className="h-3 w-3 mr-1" />회의
              </Button>
            </div>
            <Input
              placeholder={announcementType === 'meeting' ? '회의 제목' : '공지 제목'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-8 text-sm"
            />
            {announcementType === 'meeting' && (
              <div className="grid grid-cols-3 gap-2">
                {/* Date Picker */}
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-8 text-xs justify-start font-normal", !meetingDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3 w-3 mr-1" />
                      {meetingDate ? format(new Date(meetingDate), 'M/d (EEE)', { locale: ko }) : '날짜'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={meetingDate ? new Date(meetingDate) : undefined}
                      onSelect={handleDateSelect}
                      locale={ko}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>

                {/* Time Picker */}
                <Popover open={timePickerOpen} onOpenChange={setTimePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("h-8 text-xs justify-start font-normal", !meetingTime && "text-muted-foreground")}>
                      <Clock className="h-3 w-3 mr-1" />
                      {meetingTime || '시간'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-3" align="start">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">시간 선택</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground mb-1">시</p>
                          <div className="h-32 overflow-y-auto border rounded-md">
                            {HOURS.map(h => (
                              <button
                                key={h}
                                className={cn(
                                  "w-full px-2 py-1 text-xs text-center hover:bg-accent transition-colors",
                                  selectedHour === h && "bg-primary text-primary-foreground hover:bg-primary"
                                )}
                                onClick={() => { setSelectedHour(h); setMeetingTime(`${h}:${selectedMinute}`); }}
                              >
                                {h}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-[10px] text-muted-foreground mb-1">분</p>
                          <div className="h-32 overflow-y-auto border rounded-md">
                            {MINUTES.map(m => (
                              <button
                                key={m}
                                className={cn(
                                  "w-full px-2 py-1 text-xs text-center hover:bg-accent transition-colors",
                                  selectedMinute === m && "bg-primary text-primary-foreground hover:bg-primary"
                                )}
                                onClick={() => { setSelectedMinute(m); setMeetingTime(`${selectedHour}:${m}`); }}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Button size="sm" className="w-full h-7 text-xs" onClick={() => handleTimeSelect(selectedHour, selectedMinute)}>
                        확인
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Input placeholder="장소" value={meetingLocation} onChange={e => setMeetingLocation(e.target.value)} className="h-8 text-sm" />
              </div>
            )}
            <Textarea
              placeholder="내용을 입력하세요..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="text-sm resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetForm}>취소</Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => postMutation.mutate()}
                disabled={!title.trim() || !content.trim() || (announcementType === 'meeting' && !meetingDate) || postMutation.isPending}
              >
                {postMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                등록
              </Button>
            </div>
          </div>
        )}

        {latestAnnouncements.length > 0 ? (
          <div className="space-y-2">
            {latestAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className="cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors"
                onClick={() => navigate('/announcements')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ann.title}</p>
                    {(ann.meeting_date || ann.meeting_time || ann.meeting_location) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        {ann.meeting_date && (
                          <span className="flex items-center gap-0.5">
                            <CalendarIcon className="h-3 w-3" />
                            {format(new Date(ann.meeting_date), 'M월 d일 (EEE)', { locale: ko })}
                          </span>
                        )}
                        {ann.meeting_time && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-3 w-3" />
                            {ann.meeting_time}
                          </span>
                        )}
                        {ann.meeting_location && (
                          <span>📍 {ann.meeting_location}</span>
                        )}
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2 leading-relaxed">
                      {ann.content}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {format(new Date(ann.created_at), 'M/d', { locale: ko })}
                  </Badge>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{ann.author_name}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">등록된 공지사항이 없습니다.</div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementCard;
