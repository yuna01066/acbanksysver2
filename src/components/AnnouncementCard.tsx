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
import { Megaphone, ArrowRight, Plus, Loader2, Calendar, MapPin, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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

  const { data: latestAnnouncement } = useQuery({
    queryKey: ['latest-announcement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인이 필요합니다.');
      
      // 1. Insert announcement
      const insertData: any = {
        title,
        content,
        author_id: user.id,
        author_name: profile.full_name || user.email || '관리자',
        announcement_type: announcementType,
      };
      if (announcementType === 'meeting') {
        insertData.meeting_date = meetingDate || null;
        insertData.meeting_time = meetingTime || null;
        insertData.meeting_location = meetingLocation || null;
      }
      const { data: announcement, error } = await supabase
        .from('announcements')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      // 2-1. If meeting, post to team chat
      if (announcementType === 'meeting') {
        const meetingInfo = `📋 회의 공지: ${title}\n📅 ${meetingDate || '미정'}${meetingTime ? ` ⏰ ${meetingTime}` : ''}${meetingLocation ? `\n📍 ${meetingLocation}` : ''}`;
        await supabase.from('team_messages').insert({
          user_id: user.id,
          user_name: profile.full_name || user.email || '관리자',
          avatar_url: profile.avatar_url || null,
          message: meetingInfo,
        });
      }

      // 2. Get all approved users to notify
      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('is_approved', true);

      if (allProfiles && allProfiles.length > 0) {
          const notiTitle = announcementType === 'meeting' ? '📋 회의 공지' : '새 공지사항';
          const notiDesc = announcementType === 'meeting'
            ? `회의가 등록되었습니다: ${title} (${meetingDate || '날짜 미정'}${meetingTime ? ` ${meetingTime}` : ''})`
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
      setTitle('');
      setContent('');
      setAnnouncementType('general');
      setMeetingDate('');
      setMeetingTime('');
      setMeetingLocation('');
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['latest-announcement'] });
    },
    onError: (err: any) => {
      toast.error('등록 실패: ' + (err.message || '알 수 없는 오류'));
    },
  });

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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowForm(!showForm)}
              >
                <Plus className="h-3 w-3 mr-1" />
                작성
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => navigate('/announcements')}
            >
              전체보기
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Quick post form for admins */}
        {canPost && showForm && (
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            {/* Type selection */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={announcementType === 'general' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAnnouncementType('general')}
              >
                <Megaphone className="h-3 w-3 mr-1" />공지
              </Button>
              <Button
                type="button"
                variant={announcementType === 'meeting' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setAnnouncementType('meeting')}
              >
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
                <Input type="date" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className="h-8 text-sm" />
                <Input type="time" value={meetingTime} onChange={e => setMeetingTime(e.target.value)} className="h-8 text-sm" />
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
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setShowForm(false); setTitle(''); setContent(''); setAnnouncementType('general'); setMeetingDate(''); setMeetingTime(''); setMeetingLocation(''); }}
              >
                취소
              </Button>
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

        {/* Latest announcement */}
        {latestAnnouncement ? (
          <div
            className="cursor-pointer rounded-lg border p-3 hover:bg-muted/30 transition-colors"
            onClick={() => navigate('/announcements')}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium truncate">{latestAnnouncement.title}</p>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line line-clamp-5 leading-relaxed">
                  {latestAnnouncement.content}
                </p>
                {latestAnnouncement.content.split('\n').length > 5 && (
                  <span className="text-sm text-primary mt-1 inline-block">... 더보기</span>
                )}
              </div>
              <Badge variant="secondary" className="text-xs shrink-0">
                {format(new Date(latestAnnouncement.created_at), 'M/d', { locale: ko })}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {latestAnnouncement.author_name}
            </p>
          </div>
        ) : (
          <div className="text-center py-4 text-sm text-muted-foreground">
            등록된 공지사항이 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementCard;
