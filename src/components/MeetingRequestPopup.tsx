import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Check, X, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MeetingRequest {
  id: string;
  sender_id: string;
  message: string;
  meeting_date: string | null;
  meeting_time: string | null;
  meeting_status: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string | null;
  sender_department?: string | null;
}

const MeetingRequestPopup: React.FC = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState<MeetingRequest[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetchPendingRequests();

    const channel = supabase
      .channel('meeting-requests-popup')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'peer_feedback',
        filter: `receiver_id=eq.${user.id}`,
      }, () => {
        fetchPendingRequests();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchPendingRequests = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('peer_feedback')
      .select('*')
      .eq('receiver_id', user.id)
      .eq('feedback_type', 'meeting')
      .eq('meeting_status', 'pending')
      .order('created_at', { ascending: false });

    if (!data || data.length === 0) {
      setRequests([]);
      return;
    }

    // Fetch sender profiles
    const senderIds = [...new Set(data.map(d => d.sender_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, department')
      .in('id', senderIds);

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    const enriched: MeetingRequest[] = data.map(d => ({
      ...d,
      sender_name: profileMap.get(d.sender_id)?.full_name || '알 수 없음',
      sender_avatar: profileMap.get(d.sender_id)?.avatar_url,
      sender_department: profileMap.get(d.sender_id)?.department,
    }));

    setRequests(enriched);
    setCurrentIndex(0);
  };

  const handleRespond = async (status: 'accepted' | 'declined', rescheduleDate?: Date, rescheduleTime?: string) => {
    const req = requests[currentIndex];
    if (!req || !user) return;
    setProcessing(true);

    try {
      const updateData: any = { meeting_status: status };
      if (status === 'accepted' && rescheduleDate) {
        updateData.meeting_date = format(rescheduleDate, 'yyyy-MM-dd');
        updateData.meeting_time = rescheduleTime || req.meeting_time;
        updateData.meeting_status = 'rescheduled';
      }

      const { error } = await supabase
        .from('peer_feedback')
        .update(updateData)
        .eq('id', req.id);

      if (error) throw error;

      // Send notification to sender
      const statusLabel = updateData.meeting_status === 'accepted' ? '수락' : updateData.meeting_status === 'declined' ? '거절' : '일정 변경';
      await supabase.from('notifications').insert({
        user_id: req.sender_id,
        type: 'meeting_response',
        title: `☕ 미팅 요청이 ${statusLabel}되었습니다`,
        description: updateData.meeting_status === 'rescheduled'
          ? `변경된 일정: ${format(rescheduleDate!, 'M월 d일')} ${rescheduleTime || ''}`
          : `${req.sender_name}님의 미팅 요청`,
      });

      toast.success(`미팅 요청을 ${statusLabel}했습니다`);
      setRescheduleMode(false);
      setNewDate(undefined);
      setNewTime('');

      // Remove from list
      setRequests(prev => prev.filter((_, i) => i !== currentIndex));
      if (currentIndex >= requests.length - 1) setCurrentIndex(0);
    } catch (e: any) {
      toast.error('처리 실패: ' + (e.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  if (requests.length === 0) return null;

  const current = requests[currentIndex];
  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-6 text-white text-center">
          <div className="text-4xl mb-2">☕</div>
          <h2 className="text-lg font-bold">1:1 미팅 요청</h2>
          {requests.length > 1 && (
            <p className="text-sm opacity-80 mt-1">{requests.length}개의 미팅 요청</p>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Sender info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 rounded-xl">
              <AvatarImage src={current.sender_avatar || undefined} className="object-cover" />
              <AvatarFallback className="rounded-xl bg-primary/10 text-primary font-semibold">
                {current.sender_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-foreground">{current.sender_name}</p>
              <p className="text-xs text-muted-foreground">{current.sender_department || '부서 미설정'}</p>
            </div>
          </div>

          {/* Date/Time */}
          {current.meeting_date && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <CalendarIcon className="h-5 w-5 text-orange-500 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {format(new Date(current.meeting_date), 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </p>
                {current.meeting_time && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {current.meeting_time}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Message */}
          {current.message && (
            <div className="p-3 rounded-lg bg-muted/30 border">
              <p className="text-sm text-foreground whitespace-pre-wrap">{current.message}</p>
            </div>
          )}

          {/* Reschedule mode */}
          {rescheduleMode && (
            <div className="space-y-3 p-3 rounded-lg border-2 border-dashed border-orange-300 bg-orange-50/50 dark:bg-orange-950/20">
              <p className="text-xs font-medium text-orange-600">📅 새로운 일정 선택</p>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("flex-1 justify-start", !newDate && "text-muted-foreground")}>
                      <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                      {newDate ? format(newDate, 'MM/dd (EEE)', { locale: ko }) : '날짜'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newDate}
                      onSelect={setNewDate}
                      disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Select value={newTime} onValueChange={setNewTime}>
                  <SelectTrigger className="w-[100px]">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    <SelectValue placeholder="시간" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 19 }, (_, i) => {
                      const h = Math.floor(i / 2) + 9;
                      const m = i % 2 === 0 ? '00' : '30';
                      const time = `${String(h).padStart(2, '0')}:${m}`;
                      return <SelectItem key={time} value={time}>{time}</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => { setRescheduleMode(false); setNewDate(undefined); setNewTime(''); }}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                  disabled={!newDate || processing}
                  onClick={() => handleRespond('accepted', newDate, newTime)}
                >
                  일정 변경 확정
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!rescheduleMode && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                disabled={processing}
                onClick={() => handleRespond('declined')}
              >
                <X className="h-4 w-4 mr-1" />
                거절
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-orange-200 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                disabled={processing}
                onClick={() => setRescheduleMode(true)}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                일정 변경
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                disabled={processing}
                onClick={() => handleRespond('accepted')}
              >
                <Check className="h-4 w-4 mr-1" />
                수락
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingRequestPopup;
