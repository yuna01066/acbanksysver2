import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useDirectMessages } from '@/hooks/useDirectMessages';
import MessageContent from '@/components/chat/MessageContent';

interface DirectMessageViewProps {
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  partnerDepartment?: string | null;
}

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } catch {
      toast.error('메시지 전송 실패');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">아직 메시지가 없습니다</p>
            <p className="text-xs text-muted-foreground/60">첫 번째 메시지를 보내보세요!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => {
              const isMine = msg.sender_id === user?.id;
              const showDate = i === 0 || 
                format(new Date(msg.created_at), 'yyyy-MM-dd') !== format(new Date(messages[i-1].created_at), 'yyyy-MM-dd');

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="text-center py-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {format(new Date(msg.created_at), 'M월 d일 (EEE)', { locale: ko })}
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
                        <MessageContent message={msg.message} isMine={isMine} />
                      </div>
                      <p className={`text-[10px] text-muted-foreground mt-0.5 ${isMine ? 'text-right' : ''}`}>
                        {format(new Date(msg.created_at), 'HH:mm')}
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
      <div className="p-3 border-t shrink-0">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="메시지를 입력하세요..."
            disabled={sending}
            className="flex-1"
          />
          <Button size="icon" onClick={handleSend} disabled={!newMessage.trim() || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DirectMessageView;
