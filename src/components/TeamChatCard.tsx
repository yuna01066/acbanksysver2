import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Loader2, Trash2, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useMentionSuggestions, MentionUser } from '@/hooks/useMentionSuggestions';
import { useProjectSuggestions, TaggableProject } from '@/hooks/useProjectSuggestions';
import EmojiPicker from '@/components/chat/EmojiPicker';
import MentionDropdown from '@/components/chat/MentionDropdown';
import ProjectDropdown from '@/components/chat/ProjectDropdown';
import MessageContent from '@/components/chat/MessageContent';
import ChatAttachments from '@/components/chat/ChatAttachments';

interface ChatAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  message: string;
  attachments: ChatAttachment[] | null;
  created_at: string;
}

type DropdownMode = 'mention' | 'project' | null;

const TeamChatCard: React.FC = () => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFiles, setPendingFiles] = useState<ChatAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Suggestion state
  const { filterUsers } = useMentionSuggestions();
  const { filterProjects } = useProjectSuggestions();
  const [dropdownMode, setDropdownMode] = useState<DropdownMode>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const mentionResults = dropdownMode === 'mention' ? filterUsers(query) : [];
  const projectResults = dropdownMode === 'project' ? filterProjects(query) : [];
  const hasResults = mentionResults.length > 0 || projectResults.length > 0;
  const resultCount = mentionResults.length || projectResults.length;

  const scrollToBottom = useCallback(() => {
    const container = scrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, []);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('team_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(100);
      if (!error && data) setMessages(data as unknown as ChatMessage[]);
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const val = e.target.value;
    setNewMessage(val);

    const cursorPos = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPos);

    // Check for @mention
    const mentionMatch = textBeforeCursor.match(/@([^\s]*)$/);
    if (mentionMatch) {
      setDropdownMode('mention');
      setQuery(mentionMatch[1]);
      setSelectedIndex(0);
      return;
    }

    // Check for #project tag
    const projectMatch = textBeforeCursor.match(/#([^\s]*)$/);
    if (projectMatch) {
      setDropdownMode('project');
      setQuery(projectMatch[1]);
      setSelectedIndex(0);
      return;
    }

    setDropdownMode(null);
  };

  const insertTag = (text: string, triggerChar: string) => {
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const textBeforeCursor = newMessage.slice(0, cursorPos);
    const textAfterCursor = newMessage.slice(cursorPos);
    const regex = triggerChar === '@' ? /@([^\s]*)$/ : /#([^\s]*)$/;
    const beforeTag = textBeforeCursor.replace(regex, '');
    // Replace spaces in project names with underscores for tag continuity
    const tagText = text.replace(/\s+/g, '_');
    const updated = `${beforeTag}${triggerChar}${tagText} ${textAfterCursor}`;
    setNewMessage(updated);
    setDropdownMode(null);
    inputRef.current?.focus();
  };

  const insertMention = (mentionUser: MentionUser) => {
    insertTag(mentionUser.full_name, '@');
  };

  const insertProject = (project: TaggableProject) => {
    insertTag(project.title, '#');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (dropdownMode !== null && hasResults) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => (i + 1) % resultCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => (i - 1 + resultCount) % resultCount);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (dropdownMode === 'mention') {
          insertMention(mentionResults[selectedIndex]);
        } else {
          insertProject(projectResults[selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        setDropdownMode(null);
      }
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const form = (e.target as HTMLElement).closest('form');
      if (form) form.requestSubmit();
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    setUploading(true);
    const newAttachments: ChatAttachment[] = [];

    for (const file of Array.from(files)) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: 10MB 이하만 업로드 가능합니다.`);
        continue;
      }
      const path = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage
        .from('team-chat-attachments')
        .upload(path, file);
      if (error) {
        toast.error(`${file.name} 업로드 실패`);
        continue;
      }
      const { data: urlData } = supabase.storage
        .from('team-chat-attachments')
        .getPublicUrl(path);
      newAttachments.push({
        name: file.name,
        url: urlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }
    setPendingFiles(prev => [...prev, ...newAttachments]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dropdownMode !== null && hasResults) return;
    if (!user || (!newMessage.trim() && pendingFiles.length === 0) || sending) return;

    setSending(true);
    const { error } = await supabase.from('team_messages').insert([{
      user_id: user.id,
      user_name: profile?.full_name || user.email?.split('@')[0] || '사용자',
      avatar_url: profile?.avatar_url || null,
      message: newMessage.trim() || (pendingFiles.length > 0 ? '📎 파일 첨부' : ''),
      attachments: (pendingFiles.length > 0 ? pendingFiles : []) as any,
    }]);
    if (error) {
      toast.error('메시지 전송 실패');
    } else {
      setNewMessage('');
      setPendingFiles([]);
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
    <div className="glass-card animate-fade-in flex flex-col h-[400px]">
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
                        <ChatAttachments attachments={msg.attachments || []} />
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
        {dropdownMode === 'mention' && mentionResults.length > 0 && (
          <MentionDropdown
            users={mentionResults}
            selectedIndex={selectedIndex}
            onSelect={insertMention}
          />
        )}
        {dropdownMode === 'project' && projectResults.length > 0 && (
          <ProjectDropdown
            projects={projectResults}
            selectedIndex={selectedIndex}
            onSelect={insertProject}
          />
        )}
        {/* Pending files preview */}
        {pendingFiles.length > 0 && (
          <div className="mb-2">
            <ChatAttachments attachments={pendingFiles} isPreview onRemove={removePendingFile} />
          </div>
        )}
        <div className="flex gap-1.5 items-center">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 w-9 px-0 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          </Button>
          <Textarea
            ref={inputRef as any}
            value={newMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onBlur={() => setTimeout(() => setDropdownMode(null), 150)}
            placeholder="메시지 입력... (@멘션, #프로젝트)"
            className="h-9 min-h-[36px] max-h-[120px] text-sm resize-none py-2"
            maxLength={500}
            disabled={sending}
            rows={1}
          />
          <EmojiPicker onSelect={handleEmojiSelect} />
          <Button type="submit" size="sm" className="h-9 px-3 shrink-0" disabled={(!newMessage.trim() && pendingFiles.length === 0) || sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default TeamChatCard;
