import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useMentionSuggestions, MentionUser } from '@/hooks/useMentionSuggestions';
import EmojiPicker from '@/components/chat/EmojiPicker';
import MentionDropdown from '@/components/chat/MentionDropdown';
import MessageContent from '@/components/chat/MessageContent';

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  message: string;
  created_at: string;
}

const TeamChatCard: React.FC = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mention state
  const { filterUsers } = useMentionSuggestions();
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const mentionResults = mentionQuery !== null ? filterUsers(mentionQuery) : [];

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);
      if (!error && data) setMessages(data);
      setLoading(false);
      setTimeout(scrollToBottom, 100);
    };
    fetchMessages();
  }, [scrollToBottom]);

  useEffect(() => {
    const channel = supabase
      .channel('team-chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages' }, (payload) => {
        setMessages(prev => [...prev, payload.new as ChatMessage]);
        setTimeout(scrollToBottom, 50);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'team_messages' }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [scrollToBottom]);

  // Detect @mention in input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (mentionUser: MentionUser) => {
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursorPos);
    const textAfterCursor = newMessage.slice(cursorPos);
    const beforeMention = textBeforeCursor.replace(/@([^\s]*)$/, '');
    const updated = `${beforeMention}@${mentionUser.full_name} ${textAfterCursor}`;
    setNewMessage(updated);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % mentionResults.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + mentionResults.length) % mentionResults.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      } else if (e.key === 'Escape') {
        setMentionQuery(null);
      }
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mentionQuery !== null && mentionResults.length > 0) return; // Don't submit while selecting mention
    if (!user || !newMessage.trim() || sending) return;

    setSending(true);
    const { error } = await supabase.from('team_messages').insert({
      user_id: user.id,
      user_name: profile?.full_name || user.email?.split('@')[0] || '사용자',
      avatar_url: profile?.avatar_url || null,
      message: newMessage.trim(),
    });
    if (error) {
      toast.error('메시지 전송 실패');
    } else {
      setNewMessage('');
    }
    setSending(false);
  };

  const handleDelete = async (msgId: string) => {
    const { error } = await supabase.from('team_messages').delete().eq('id', msgId);
    if (error) toast.error('삭제 실패');
  };

  const isMyMessage = (msg: ChatMessage) => user && msg.user_id === user.id;

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return format(date, 'a h:mm', { locale: ko });
    return format(date, 'M/d a h:mm', { locale: ko });
  };

  return (
    <div className="rounded-xl border bg-card shadow-sm animate-fade-in flex flex-col h-[400px]">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b shrink-0">
        <MessageSquare className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">팀 채팅</h3>
        <span className="text-xs text-muted-foreground">({messages.length})</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-3" ref={scrollRef}>
        <div className="py-3 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">아직 메시지가 없습니다</p>
              <p className="text-xs text-muted-foreground/60">첫 번째 메시지를 보내보세요!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMine = isMyMessage(msg);
              const timeStr = formatTime(msg.created_at);
              const nextMsg = messages[idx + 1];
              const nextTimeStr = nextMsg ? formatTime(nextMsg.created_at) : null;
              const nextIsSameUserAndTime = nextMsg && nextMsg.user_id === msg.user_id && nextTimeStr === timeStr;
              const showTime = !nextIsSameUserAndTime;
              return (
                <div key={msg.id} className={`flex gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                  {!isMine && (
                    <Avatar className="h-7 w-7 rounded-lg shrink-0">
                      <AvatarImage src={msg.avatar_url || undefined} className="object-cover" />
                      <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-xs font-semibold">
                        {msg.user_name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className={`max-w-[75%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {!isMine && (
                      <span className="text-xs text-muted-foreground font-medium mb-0.5 ml-1">{msg.user_name}</span>
                    )}
                    <div className="group flex items-end gap-1">
                      {isMine && (
                        <button
                          onClick={() => handleDelete(msg.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-muted-foreground hover:text-destructive"
                          title="삭제"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                      <div
                        className={`rounded-xl px-3 py-1.5 text-sm break-words ${
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted rounded-bl-sm'
                        }`}
                      >
                        <MessageContent message={msg.message} isMine={isMine} />
                      </div>
                    </div>
                    {showTime && (
                      <span className={`text-[10px] text-muted-foreground/50 mt-0.5 ${isMine ? 'mr-1 text-right' : 'ml-1'}`}>
                        {timeStr}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t shrink-0 relative">
        {mentionQuery !== null && mentionResults.length > 0 && (
          <MentionDropdown
            users={mentionResults}
            selectedIndex={mentionIndex}
            onSelect={insertMention}
          />
        )}
        <div className="flex gap-1.5 items-center">
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
            placeholder="메시지 입력... (@로 멘션)"
            className="h-9 text-sm"
            maxLength={500}
            disabled={sending}
          />
          <EmojiPicker onSelect={handleEmojiSelect} />
          <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={!newMessage.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TeamChatCard;
