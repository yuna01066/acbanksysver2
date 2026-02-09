import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, X, RefreshCw, Trash2, CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface MeetingActionButtonsProps {
  feedbackId: string;
  senderId: string;
  receiverId: string;
  currentUserId: string;
  meetingStatus: string;
  meetingDate?: string | null;
  meetingTime?: string | null;
  onUpdated: () => void;
}

const MeetingActionButtons: React.FC<MeetingActionButtonsProps> = ({
  feedbackId,
  senderId,
  receiverId,
  currentUserId,
  meetingStatus,
  meetingDate,
  meetingTime,
  onUpdated,
}) => {
  const [processing, setProcessing] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [newTime, setNewTime] = useState('');

  const isSender = currentUserId === senderId;
  const isReceiver = currentUserId === receiverId;

  const sendDmLog = async (message: string, toUserId: string) => {
    await supabase.from('direct_messages').insert({
      sender_id: currentUserId,
      receiver_id: toUserId,
      message,
    });
  };

  const handleAccept = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('peer_feedback')
        .update({ meeting_status: 'accepted' })
        .eq('id', feedbackId);
      if (error) throw error;

      const desc = meetingDate
        ? `${format(new Date(meetingDate), 'M월 d일')} ${meetingTime || ''}`
        : '';
      await supabase.from('notifications').insert({
        user_id: senderId,
        type: 'meeting_response',
        title: '☕ 미팅 요청이 수락되었습니다',
        description: desc || '미팅 요청이 수락되었습니다',
      });
      await sendDmLog(`✅ 미팅 요청을 수락했습니다${desc ? ` (${desc})` : ''}`, senderId);

      toast.success('미팅 요청을 수락했습니다');
      onUpdated();
    } catch (e: any) {
      toast.error('처리 실패: ' + (e.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('peer_feedback')
        .update({ meeting_status: 'declined' })
        .eq('id', feedbackId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: senderId,
        type: 'meeting_response',
        title: '☕ 미팅 요청이 거절되었습니다',
        description: '미팅 요청이 거절되었습니다',
      });
      await sendDmLog('❌ 미팅 요청을 거절했습니다', senderId);

      toast.success('미팅 요청을 거절했습니다');
      onUpdated();
    } catch (e: any) {
      toast.error('처리 실패: ' + (e.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  const handleReschedule = async () => {
    if (!newDate) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('peer_feedback')
        .update({
          meeting_status: 'rescheduled',
          meeting_date: format(newDate, 'yyyy-MM-dd'),
          meeting_time: newTime || meetingTime || null,
        })
        .eq('id', feedbackId);
      if (error) throw error;

      const otherUserId = currentUserId === senderId ? receiverId : senderId;
      const dateStr = `${format(newDate, 'M월 d일')} ${newTime || ''}`;
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'meeting_response',
        title: '☕ 미팅 일정이 변경되었습니다',
        description: `변경된 일정: ${dateStr}`,
      });
      await sendDmLog(`📅 미팅 일정을 변경했습니다 (${dateStr})`, otherUserId);

      toast.success('일정을 변경했습니다');
      setRescheduleMode(false);
      setNewDate(undefined);
      setNewTime('');
      onUpdated();
    } catch (e: any) {
      toast.error('처리 실패: ' + (e.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('peer_feedback')
        .delete()
        .eq('id', feedbackId);
      if (error) throw error;

      await supabase.from('notifications').insert({
        user_id: receiverId,
        type: 'meeting_response',
        title: '☕ 미팅 요청이 취소되었습니다',
        description: '상대방이 미팅 요청을 취소했습니다',
      });
      await sendDmLog('🚫 미팅 요청을 취소했습니다', receiverId);

      toast.success('미팅 요청을 취소했습니다');
      onUpdated();
    } catch (e: any) {
      toast.error('처리 실패: ' + (e.message || ''));
    } finally {
      setProcessing(false);
    }
  };

  // No actions if already declined
  if (meetingStatus === 'declined') return null;

  // Reschedule mode UI
  if (rescheduleMode) {
    const now = new Date();
    return (
      <div className="mt-2 space-y-2 w-full">
        <p className="text-[10px] font-medium text-orange-600 text-center">📅 새로운 일정 선택</p>
        <div className="flex gap-1.5 justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-7 text-xs", !newDate && "text-muted-foreground")}>
                <CalendarIcon className="h-3 w-3 mr-1" />
                {newDate ? format(newDate, 'MM/dd (EEE)', { locale: ko }) : '날짜'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="center">
              <Calendar
                mode="single"
                selected={newDate}
                onSelect={setNewDate}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Select value={newTime} onValueChange={setNewTime}>
            <SelectTrigger className="w-[90px] h-7 text-xs">
              <Clock className="h-3 w-3 mr-1" />
              <SelectValue placeholder="시간" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 19 }, (_, i) => {
                const h = Math.floor(i / 2) + 9;
                const m = i % 2 === 0 ? '00' : '30';
                const time = `${String(h).padStart(2, '0')}:${m}`;
                const isToday = newDate &&
                  newDate.getFullYear() === now.getFullYear() &&
                  newDate.getMonth() === now.getMonth() &&
                  newDate.getDate() === now.getDate();
                if (isToday && (h < now.getHours() || (h === now.getHours() && parseInt(m) <= now.getMinutes()))) {
                  return null;
                }
                return <SelectItem key={time} value={time}>{time}</SelectItem>;
              }).filter(Boolean)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1.5 justify-center">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => { setRescheduleMode(false); setNewDate(undefined); setNewTime(''); }}
          >
            취소
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs bg-orange-500 hover:bg-orange-600 text-white"
            disabled={!newDate || processing}
            onClick={handleReschedule}
          >
            일정 변경 확정
          </Button>
        </div>
      </div>
    );
  }

  // Receiver actions
  if (isReceiver) {
    const isPending = meetingStatus === 'pending';
    return (
      <div className="flex gap-1.5 mt-2 justify-center">
        {isPending && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
            disabled={processing}
            onClick={handleDecline}
          >
            <X className="h-3 w-3" /> 거절
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-orange-600 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 gap-1"
          disabled={processing}
          onClick={() => setRescheduleMode(true)}
        >
          <RefreshCw className="h-3 w-3" /> 일정 변경
        </Button>
        {isPending && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-green-600 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 gap-1"
            disabled={processing}
            onClick={handleAccept}
          >
            <Check className="h-3 w-3" /> 수락
          </Button>
        )}
      </div>
    );
  }

  // Sender action: cancel or reschedule
  if (isSender) {
    return (
      <div className="flex gap-1.5 justify-center mt-2">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-orange-600 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20 gap-1"
          disabled={processing}
          onClick={() => setRescheduleMode(true)}
        >
          <RefreshCw className="h-3 w-3" /> 일정 변경
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
          disabled={processing}
          onClick={handleCancel}
        >
          <Trash2 className="h-3 w-3" /> 요청 취소
        </Button>
      </div>
    );
  }

  return null;
};

export default MeetingActionButtons;
