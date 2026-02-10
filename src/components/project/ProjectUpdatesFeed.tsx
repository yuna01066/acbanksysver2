import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Send, Trash2, MessageSquarePlus, Hash, ExternalLink, Paperclip, Download, FileText, AtSign, Pencil, Check, X, ZoomIn } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface NotionProject {
  id: string;
  title: string;
  url: string;
}

interface NotionLink {
  id: string;
  title: string;
  url: string;
}

interface Attachment {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface MentionedUser {
  id: string;
  full_name: string;
}

interface ProjectUpdate {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  content: string;
  notion_links: NotionLink[];
  attachments: Attachment[];
  mentioned_user_ids: string[];
  created_at: string;
}

interface Props {
  projectId: string;
}

// Image thumbnail component for attachments
const ImageThumbnail: React.FC<{ attachment: Attachment; onClick: (url: string) => void }> = ({ attachment, onClick }) => {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase.storage.from('project-update-attachments').createSignedUrl(attachment.path, 600)
      .then(({ data }) => { if (data?.signedUrl) setUrl(data.signedUrl); });
  }, [attachment.path]);

  if (!url) return <div className="w-20 h-20 bg-muted rounded animate-pulse" />;

  return (
    <button
      onClick={() => onClick(url)}
      className="relative group w-20 h-20 rounded overflow-hidden border hover:border-primary transition-colors"
    >
      <img src={url} alt={attachment.name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
        <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
};

const ProjectUpdatesFeed: React.FC<Props> = ({ projectId }) => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [notionLinks, setNotionLinks] = useState<NotionLink[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [mentionedUsers, setMentionedUsers] = useState<MentionedUser[]>([]);
  const [notionSearchOpen, setNotionSearchOpen] = useState(false);
  const [notionSearch, setNotionSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCursorPos, setMentionCursorPos] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);

  // Fetch employees for mention
  const { data: allEmployees = [] } = useQuery({
    queryKey: ['employees-for-mention'],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, department, avatar_url')
        .eq('is_approved', true)
        .order('full_name');
      return (data || []) as { id: string; full_name: string; department: string | null; avatar_url: string | null }[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch updates
  const { data: updates = [] } = useQuery({
    queryKey: ['project-updates', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_updates')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((u: any) => ({
        ...u,
        notion_links: Array.isArray(u.notion_links) ? u.notion_links : [],
        attachments: Array.isArray(u.attachments) ? u.attachments : [],
        mentioned_user_ids: Array.isArray(u.mentioned_user_ids) ? u.mentioned_user_ids : [],
      })) as ProjectUpdate[];
    },
  });

  // Fetch Notion projects for linking
  const { data: notionProjects = [] } = useQuery({
    queryKey: ['notion-projects-for-link'],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const res = await supabase.functions.invoke('notion-projects', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.error) return [];
      return (res.data?.projects || []).map((p: any) => ({
        id: p.id,
        title: p.title || p.name || '제목 없음',
        url: p.url || '',
      })) as NotionProject[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`project-updates-${projectId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'project_updates',
        filter: `project_id=eq.${projectId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId, queryClient]);

  // Mention logic
  const filteredMentionUsers = allEmployees.filter(e => {
    if (mentionedUsers.some(m => m.id === e.id)) return false;
    if (!mentionSearch) return true;
    return e.full_name.toLowerCase().includes(mentionSearch.toLowerCase()) ||
      (e.department && e.department.toLowerCase().includes(mentionSearch.toLowerCase()));
  }).slice(0, 8);

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    setContent(val);

    // Check for @ trigger
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    if (atMatch) {
      setMentionOpen(true);
      setMentionSearch(atMatch[1]);
      setMentionCursorPos(cursorPos);
      setMentionIndex(0);
    } else {
      setMentionOpen(false);
      setMentionSearch('');
    }
  };

  const insertMention = useCallback((emp: { id: string; full_name: string }) => {
    const textBeforeCursor = content.slice(0, mentionCursorPos);
    const atMatch = textBeforeCursor.match(/@([^@\s]*)$/);
    if (!atMatch) return;

    const beforeAt = textBeforeCursor.slice(0, atMatch.index);
    const afterCursor = content.slice(mentionCursorPos);
    const newContent = `${beforeAt}@${emp.full_name} ${afterCursor}`;
    setContent(newContent);
    setMentionedUsers(prev => [...prev, { id: emp.id, full_name: emp.full_name }]);
    setMentionOpen(false);
    setMentionSearch('');

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = (beforeAt + `@${emp.full_name} `).length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [content, mentionCursorPos]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMentionUsers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(prev => (prev + 1) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(prev => (prev - 1 + filteredMentionUsers.length) % filteredMentionUsers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMentionUsers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && (content.trim() || files.length > 0)) {
      e.preventDefault();
      addUpdate.mutate();
    }
  };

  const uploadFiles = async (): Promise<Attachment[]> => {
    const uploaded: Attachment[] = [];
    for (const file of files) {
      const path = `${user!.id}/${projectId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from('project-update-attachments').upload(path, file);
      if (!error) {
        uploaded.push({ name: file.name, path, size: file.size, type: file.type });
      }
    }
    return uploaded;
  };

  const sendMentionNotifications = async (mentionIds: string[]) => {
    if (mentionIds.length === 0 || !user || !profile) return;
    const notifications = mentionIds.map(uid => ({
      user_id: uid,
      type: 'system',
      title: '프로젝트 업데이트에서 태그됨',
      description: `${profile.full_name}님이 프로젝트 업데이트에서 회원님을 태그했습니다.`,
      data: { project_id: projectId } as any,
    }));
    await supabase.from('notifications').insert(notifications);
  };

  const addUpdate = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 필요');
      if (!content.trim() && files.length === 0) throw new Error('내용 또는 파일을 추가해주세요.');
      const attachments = files.length > 0 ? await uploadFiles() : [];
      const mentionIds = mentionedUsers.map(m => m.id);
      const { error } = await supabase.from('project_updates').insert({
        project_id: projectId,
        user_id: user.id,
        user_name: profile.full_name,
        content: content.trim(),
        notion_links: notionLinks as any,
        attachments: attachments as any,
        mentioned_user_ids: mentionIds,
      });
      if (error) throw error;
      await sendMentionNotifications(mentionIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
      setContent('');
      setNotionLinks([]);
      setFiles([]);
      setMentionedUsers([]);
      toast.success('업데이트가 추가되었습니다.');
    },
    onError: (e: any) => toast.error(e.message || '업데이트 추가에 실패했습니다.'),
  });

  const deleteUpdate = useMutation({
    mutationFn: async (updateId: string) => {
      const { error } = await supabase.from('project_updates').delete().eq('id', updateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
      toast.success('삭제되었습니다.');
    },
  });

  const editUpdate = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      if (!content.trim()) throw new Error('내용을 입력해주세요.');
      const { error } = await supabase.from('project_updates').update({ content: content.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
      setEditingId(null);
      setEditContent('');
      toast.success('수정되었습니다.');
    },
    onError: (e: any) => toast.error(e.message || '수정에 실패했습니다.'),
  });

  const filteredNotionProjects = notionProjects.filter((p) =>
    p.title.toLowerCase().includes(notionSearch.toLowerCase())
  );

  const addNotionLink = (project: NotionProject) => {
    if (!notionLinks.some((l) => l.id === project.id)) {
      setNotionLinks((prev) => [...prev, project]);
    }
    setNotionSearchOpen(false);
    setNotionSearch('');
  };

  const downloadAttachment = async (att: Attachment) => {
    const { data } = await supabase.storage.from('project-update-attachments').createSignedUrl(att.path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
    else toast.error('파일 다운로드에 실패했습니다.');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const valid = selected.filter(f => f.size <= 10 * 1024 * 1024);
    if (valid.length !== selected.length) toast.error('10MB를 초과하는 파일이 제외되었습니다.');
    setFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const isImageFile = (type: string) => type.startsWith('image/');

  const getAttachmentUrl = async (path: string): Promise<string | null> => {
    const { data } = await supabase.storage.from('project-update-attachments').createSignedUrl(path, 300);
    return data?.signedUrl || null;
  };

  const canDelete = (update: ProjectUpdate) =>
    update.user_id === user?.id || isAdmin || isModerator;

  // Render a text segment with clickable URLs
  const renderWithLinks = (text: string, keyPrefix: string) => {
    const urlPattern = /(https?:\/\/[^\s<]+)/g;
    const parts = text.split(urlPattern);
    return parts.map((part, i) => {
      if (urlPattern.test(part)) {
        return (
          <a key={`${keyPrefix}-${i}`} href={part} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80 break-all">
            {part}
          </a>
        );
      }
      return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
    });
  };

  // Render content with highlighted mentions and clickable links
  const renderContent = (text: string, mentionIds: string[]) => {
    if (!text) return null;
    if (mentionIds.length === 0) return <p className="text-sm whitespace-pre-wrap leading-relaxed">{renderWithLinks(text, 'link')}</p>;

    const mentionNames = mentionIds
      .map(id => allEmployees.find(e => e.id === id)?.full_name)
      .filter(Boolean) as string[];

    if (mentionNames.length === 0) return <p className="text-sm whitespace-pre-wrap leading-relaxed">{renderWithLinks(text, 'link')}</p>;

    const pattern = new RegExp(`@(${mentionNames.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
    const parts = text.split(pattern);

    return (
      <p className="text-sm whitespace-pre-wrap leading-relaxed">
        {parts.map((part, i) => {
          if (mentionNames.includes(part)) {
            return (
              <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
                @{part}
              </span>
            );
          }
          return <React.Fragment key={i}>{renderWithLinks(part, `part-${i}`)}</React.Fragment>;
        })}
      </p>
    );
  };

  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <MessageSquarePlus className="h-4 w-4" />
          프로젝트 업데이트
        </h3>

        {/* Input area */}
        <div className="space-y-2 mb-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              placeholder="업데이트 내용을 입력하세요... (@로 직원 태그)"
              className="text-sm min-h-[60px] resize-none"
            />

            {/* Mention dropdown */}
            {mentionOpen && filteredMentionUsers.length > 0 && (
              <div
                ref={mentionRef}
                className="absolute z-50 left-0 bottom-full mb-1 w-64 bg-popover border rounded-lg shadow-lg overflow-hidden"
              >
                <ScrollArea className="max-h-[200px]">
                  {filteredMentionUsers.map((emp, i) => (
                    <button
                      key={emp.id}
                      onClick={() => insertMention(emp)}
                      className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                        i === mentionIndex ? 'bg-accent' : 'hover:bg-muted'
                      }`}
                    >
                      <Avatar className="h-5 w-5">
                        {emp.avatar_url ? (
                          <img src={emp.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" />
                        ) : (
                          <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                            {emp.full_name.slice(0, 1)}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <span className="font-medium">{emp.full_name}</span>
                      {emp.department && (
                        <span className="text-xs text-muted-foreground">{emp.department}</span>
                      )}
                    </button>
                  ))}
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Mentioned users */}
          {mentionedUsers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {mentionedUsers.map((m) => (
                <Badge key={m.id} variant="outline" className="text-[10px] gap-1 pr-1 bg-primary/5 text-primary border-primary/20">
                  <AtSign className="h-2.5 w-2.5" />
                  {m.full_name}
                  <button onClick={() => setMentionedUsers(prev => prev.filter(u => u.id !== m.id))} className="hover:bg-muted rounded-full p-0.5 ml-0.5">×</button>
                </Badge>
              ))}
            </div>
          )}

          {/* Notion links */}
          {notionLinks.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {notionLinks.map((link) => (
                <Badge key={link.id} variant="outline" className="text-[10px] gap-1 pr-1 bg-muted/50">
                  <Hash className="h-2.5 w-2.5" />
                  {link.title}
                  <button onClick={() => setNotionLinks((prev) => prev.filter((l) => l.id !== link.id))} className="hover:bg-muted rounded-full p-0.5 ml-0.5">
                    <span className="sr-only">Remove</span>×
                  </button>
                </Badge>
              ))}
            </div>
          )}

          {/* File previews */}
          {files.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {files.map((file, i) => (
                <Badge key={i} variant="outline" className="text-[10px] gap-1 pr-1 bg-muted/50">
                  <Paperclip className="h-2.5 w-2.5" />
                  {file.name} ({formatFileSize(file.size)})
                  <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="hover:bg-muted rounded-full p-0.5 ml-0.5">×</button>
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Popover open={notionSearchOpen} onOpenChange={setNotionSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground">
                    <Hash className="h-3 w-3" /> Notion 링크
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-2" align="start">
                  <input
                    className="w-full text-sm border rounded px-2 py-1.5 mb-2 outline-none focus:ring-1 focus:ring-ring"
                    placeholder="Notion 프로젝트 검색..."
                    value={notionSearch}
                    onChange={(e) => setNotionSearch(e.target.value)}
                    autoFocus
                  />
                  <ScrollArea className="max-h-[160px]">
                    {filteredNotionProjects.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-3">
                        {notionProjects.length === 0 ? 'Notion 프로젝트를 불러오는 중...' : '검색 결과 없음'}
                      </p>
                    ) : (
                      filteredNotionProjects.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => addNotionLink(p)}
                          className="w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted flex items-center gap-1.5"
                        >
                          <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{p.title}</span>
                        </button>
                      ))
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1 text-muted-foreground"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-3 w-3" /> 첨부
              </Button>
            </div>
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={(!content.trim() && files.length === 0) || addUpdate.isPending}
              onClick={() => addUpdate.mutate()}
            >
              <Send className="h-3 w-3" />
              {addUpdate.isPending ? '등록 중...' : '등록'}
            </Button>
          </div>
        </div>

        {/* Feed */}
        <div className="space-y-3">
          {updates.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">아직 업데이트가 없습니다.</p>
          ) : (
            updates.map((update) => (
              <div key={update.id} className="group relative border-l-2 border-muted pl-4 pb-1">
                <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-muted-foreground/40" />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-5 w-5">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {update.user_name.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{update.user_name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {format(new Date(update.created_at), 'M/d HH:mm', { locale: ko })}
                    </span>
                  </div>
                  {canDelete(update) && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {update.user_id === user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-muted-foreground hover:text-foreground"
                          onClick={() => { setEditingId(update.id); setEditContent(update.content); }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteUpdate.mutate(update.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {editingId === update.id ? (
                  <div className="space-y-1.5">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="text-sm min-h-[50px] resize-none"
                      autoFocus
                    />
                    <div className="flex items-center gap-1 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => { setEditingId(null); setEditContent(''); }}>
                        <X className="h-3 w-3" /> 취소
                      </Button>
                      <Button size="sm" className="h-6 text-xs gap-1" disabled={!editContent.trim() || editUpdate.isPending} onClick={() => editUpdate.mutate({ id: update.id, content: editContent })}>
                        <Check className="h-3 w-3" /> {editUpdate.isPending ? '저장 중...' : '저장'}
                      </Button>
                    </div>
                  </div>
                ) : (
                  renderContent(update.content, update.mentioned_user_ids)
                )}
                {update.attachments && update.attachments.length > 0 && (
                  <div className="mt-1.5 space-y-1.5">
                    {/* Image attachments */}
                    {update.attachments.filter(att => isImageFile(att.type)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {update.attachments.filter(att => isImageFile(att.type)).map((att, i) => (
                          <ImageThumbnail key={`img-${i}`} attachment={att} onClick={setPreviewImage} />
                        ))}
                      </div>
                    )}
                    {/* Non-image attachments */}
                    {update.attachments.filter(att => !isImageFile(att.type)).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {update.attachments.filter(att => !isImageFile(att.type)).map((att, i) => (
                          <button
                            key={`file-${i}`}
                            onClick={() => downloadAttachment(att)}
                            className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded px-1.5 py-1 transition-colors"
                          >
                            <FileText className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate max-w-[120px]">{att.name}</span>
                            <Download className="h-2.5 w-2.5 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {update.notion_links.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {update.notion_links.map((link) => (
                      <a
                        key={link.id}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/5 rounded px-1.5 py-0.5"
                      >
                        <Hash className="h-2.5 w-2.5" />
                        {link.title}
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Image lightbox */}
        <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
          <DialogContent className="max-w-3xl p-1 bg-black/90 border-none">
            {previewImage && (
              <img src={previewImage} alt="미리보기" className="w-full h-auto max-h-[80vh] object-contain rounded" />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default ProjectUpdatesFeed;
