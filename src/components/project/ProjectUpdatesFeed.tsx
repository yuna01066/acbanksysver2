import React, { useState, useEffect, useRef } from 'react';
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
import { Send, Trash2, MessageSquarePlus, Hash, ExternalLink } from 'lucide-react';
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

interface ProjectUpdate {
  id: string;
  project_id: string;
  user_id: string;
  user_name: string;
  content: string;
  notion_links: NotionLink[];
  created_at: string;
}

interface Props {
  projectId: string;
}

const ProjectUpdatesFeed: React.FC<Props> = ({ projectId }) => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [notionLinks, setNotionLinks] = useState<NotionLink[]>([]);
  const [notionSearchOpen, setNotionSearchOpen] = useState(false);
  const [notionSearch, setNotionSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const addUpdate = useMutation({
    mutationFn: async () => {
      if (!user || !profile) throw new Error('로그인 필요');
      const { error } = await supabase.from('project_updates').insert({
        project_id: projectId,
        user_id: user.id,
        user_name: profile.full_name,
        content: content.trim(),
        notion_links: notionLinks as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-updates', projectId] });
      setContent('');
      setNotionLinks([]);
      toast.success('업데이트가 추가되었습니다.');
    },
    onError: () => toast.error('업데이트 추가에 실패했습니다.'),
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

  const canDelete = (update: ProjectUpdate) =>
    update.user_id === user?.id || isAdmin || isModerator;

  return (
    <Card className="shadow-none">
      <CardContent className="p-5">
        <h3 className="text-sm font-bold mb-3 flex items-center gap-1.5">
          <MessageSquarePlus className="h-4 w-4" />
          프로젝트 업데이트
        </h3>

        {/* Input area */}
        <div className="space-y-2 mb-4">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="업데이트 내용을 입력하세요..."
            className="text-sm min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && content.trim()) {
                e.preventDefault();
                addUpdate.mutate();
              }
            }}
          />

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

          <div className="flex items-center justify-between">
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
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              disabled={!content.trim() || addUpdate.isPending}
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => deleteUpdate.mutate(update.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{update.content}</p>
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
      </CardContent>
    </Card>
  );
};

export default ProjectUpdatesFeed;
