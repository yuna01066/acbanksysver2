import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, Heart, MessageCircle, Coffee, CalendarIcon, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import { useChatInput } from '@/hooks/useChatInput';
import MessageContent from '@/components/chat/MessageContent';
import MentionDropdown from '@/components/chat/MentionDropdown';
import ProjectDropdown from '@/components/chat/ProjectDropdown';
import EmojiPicker from '@/components/chat/EmojiPicker';

interface DirectMessageViewProps {
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerDepartment?: string | null;
}

interface TimelineItem {
  id: string;
  type: 'dm' | 'feedback';
  created_at: string;
  // DM fields
  sender_id?: string;
  message?: string;
  // Feedback fields
  feedback_type?: string;
  emoji?: string | null;
  meeting_date?: string | null;
  meeting_time?: string | null;
  meeting_status?: string;
  sender_name?: string;
}

const FEEDBACK_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  recognition: { label: '업무 인정', icon: <Heart className="h-3.5 w-3.5" />, color: 'text-pink-500' },
  feedback: { label: '피드백', icon: <MessageCircle className="h-3.5 w-3.5" />, color: 'text-blue-500' },
  meeting: { label: '1:1 미팅 요청', icon: <Coffee className="h-3.5 w-3.5" />, color: 'text-orange-500' },
};

const MEETING_STATUS_LABELS: Record<string, string> = {
  pending: '⏳ 대기 중',
  accepted: '✅ 수락됨',
  declined: '❌ 거절됨',
  rescheduled: '📅 일정 변경됨',
};

const DirectMessageView: React.FC<DirectMessageViewProps> = ({
  partnerId,
  partnerName,
  partnerAvatar,
  partnerDepartment,
}) => {
  const { user, profile } = useAuth();
  const { messages, loading, sending, sendMessage } = useDirectMessages(partnerId);
  const [newMessage, setNewMessage] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);

  const {
    inputRef,
    dropdownMode,
    mentionResults,
    projectResults,
    selectedIndex,
    hasResults,
    handleInputChange,
    insertTag,
    handleKeyDown: chatHandleKeyDown,
    closeDropdown,
  } = useChatInput();

  // Fetch peer_feedback between the two users
  useEffect(() => {
    if (!user || !partnerId) return;
    const fetchFeedbacks = async () => {
      setFeedbackLoading(true);
      const { data } = await supabase
        .from('peer_feedback')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${partnerId}),and(sender_id.eq.${partnerId},receiver_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });
      setFeedbacks(data || []);
      setFeedbackLoading(false);
    };
    fetchFeedbacks();
  }, [user, partnerId]);

  // Merge DMs + feedbacks into a single timeline
  const timeline: TimelineItem[] = React.useMemo(() => {
    const items: TimelineItem[] = [];

    for (const msg of messages) {
      items.push({
        id: msg.id,
        type: 'dm',
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        message: msg.message,
      });
    }

    for (const fb of feedbacks) {
      items.push({
        id: fb.id,
        type: 'feedback',
        created_at: fb.created_at,
        sender_id: fb.sender_id,
        message: fb.message,
        feedback_type: fb.feedback_type,
        emoji: fb.emoji,
        meeting_date: fb.meeting_date,
        meeting_time: fb.meeting_time,
        meeting_status: fb.meeting_status,
        sender_name: fb.sender_id === user?.id ? (profile?.full_name || '나') : partnerName,
      });
    }

    items.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return items;
  }, [messages, feedbacks, user, profile, partnerName]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline]);

  const handleSend = async () => {
    if (dropdownMode !== null && hasResults) return;
    if (!newMessage.trim() || sending) return;
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch {
      toast.error('메시지 전송 실패');
    }
  };

  const handleKeyDownWrapper = (e: React.KeyboardEvent) => {
    const handled = chatHandleKeyDown(e, newMessage, setNewMessage);
    if (handled) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);
    handleInputChange(val, e.target.selectionStart || val.length);
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const isLoading = loading || feedbackLoading;

  const renderFeedbackItem = (item: TimelineItem) => {
    const isMine = item.sender_id === user?.id;
    const fb = FEEDBACK_LABELS[item.feedback_type || ''] || { label: '피드백', icon: null, color: 'text-muted-foreground' };

    return (
      <div className="flex justify-center my-2">
        <div className="inline-flex flex-col items-center gap-1 px-4 py-2.5 rounded-xl bg-muted/60 border border-border/50 max-w-[85%]">
          <div className={`flex items-center gap-1.5 text-xs font-medium ${fb.color}`}>
            {item.emoji ? <span className="text-sm">{item.emoji}</span> : fb.icon}
            <span>{fb.label}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{isMine ? '내가' : partnerName + '님이'}</span>
            {' '}{isMine ? partnerName + '님에게' : '나에게'}
          </p>
          {item.message && (
            <p className="text-sm text-foreground text-center mt-0.5">{item.message}</p>
          )}
          {item.feedback_type === 'meeting' && item.meeting_date && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <CalendarIcon className="h-3 w-3" />
              <span>{format(new Date(item.meeting_date), 'M월 d일 (EEE)', { locale: ko })}</span>
              {item.meeting_time && (
                <>
                  <Clock className="h-3 w-3" />
                  <span>{item.meeting_time}</span>
                </>
              )}
            </div>
          )}
          {item.feedback_type === 'meeting' && item.meeting_status && (
            <span className="text-[10px] text-muted-foreground mt-0.5">
              {MEETING_STATUS_LABELS[item.meeting_status] || item.meeting_status}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/60 mt-0.5">
            {format(new Date(item.created_at), 'HH:mm')}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b shrink-0">
        <Avatar className="h-8 w-8 rounded-lg">
          <AvatarImage src={partnerAvatar || undefined} className="object-cover" />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs">
            {partnerName.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-semibold text-foreground">{partnerName}</p>
          {partnerDepartment && (
            <p className="text-[11px] text-muted-foreground">{partnerDepartment}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : timeline.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">아직 메시지가 없습니다</p>
            <p className="text-xs text-muted-foreground/60">첫 번째 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {timeline.map((item, i) => {
              if (item.type === 'feedback') {
                return <React.Fragment key={item.id}>{renderFeedbackItem(item)}</React.Fragment>;
              }

              const isMine = item.sender_id === user?.id;
              const showDate = i === 0 ||
                format(new Date(item.created_at), 'yyyy-MM-dd') !== format(new Date(timeline[i - 1].created_at), 'yyyy-MM-dd');

              return (
                <React.Fragment key={item.id}>
                  {showDate && (
                    <div className="text-center py-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {format(new Date(item.created_at), 'M월 d일 (EEE)', { locale: ko })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} gap-2`}>
                    {!isMine && (
                      <Avatar className="h-7 w-7 rounded-lg shrink-0">
                        <AvatarImage src={partnerAvatar || undefined} className="object-cover" />
                        <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-[10px]">
                          {partnerName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[75%] ${isMine ? 'order-first' : ''}`}>
                      <div className={`rounded-xl px-3 py-2 text-sm ${
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                      }`}>
                        <MessageContent message={item.message || ''} isMine={isMine} />
                      </div>
                      <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMine ? 'text-right' : ''}`}>
                        {format(new Date(item.created_at), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-3 border-t shrink-0 relative">
        {dropdownMode === 'mention' && mentionResults.length > 0 && (
          <MentionDropdown
            users={mentionResults}
            selectedIndex={selectedIndex}
            onSelect={(u) => insertTag(u.full_name, '@', newMessage, setNewMessage)}
          />
        )}
        {dropdownMode === 'project' && projectResults.length > 0 && (
          <ProjectDropdown
            projects={projectResults}
            selectedIndex={selectedIndex}
            onSelect={(p) => insertTag(p.title, '#', newMessage, setNewMessage)}
          />
        )}
        <div className="flex gap-1.5 items-center">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={onInputChange}
            onKeyDown={handleKeyDownWrapper}
            onBlur={closeDropdown}
            placeholder="메시지 입력... (@멘션, #프로젝트)"
            disabled={sending}
            className="flex-1 h-9 text-sm"
            maxLength={500}
          />
          <EmojiPicker onSelect={handleEmojiSelect} />
          <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={!newMessage.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DirectMessageView;
