import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowRight, Megaphone, Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

type Announcement = {
  id: string;
  title: string;
  content: string;
  author_name: string;
  is_pinned: boolean;
  created_at: string;
};

const AnnouncementCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: latestAnnouncements = [] } = useQuery({
    queryKey: ['latest-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, content, author_name, is_pinned, created_at')
        .eq('announcement_type', 'general')
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data || []) as Announcement[];
    },
    enabled: !!user,
  });

  return (
    <Card className="flex h-full w-full flex-col">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={Megaphone}
          title="공지사항"
          subtitle="일반 사내 공지만 표시합니다."
          actions={
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-2.5 text-xs" onClick={() => navigate('/announcements')}>
              전체보기
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col space-y-3 pt-0">
        {latestAnnouncements.length > 0 ? (
          <div className="space-y-2">
            {latestAnnouncements.map((announcement) => (
              <button
                key={announcement.id}
                type="button"
                className="w-full rounded-xl border border-border/70 bg-background/70 p-3 text-left transition-colors hover:bg-accent/35"
                onClick={() => navigate(`/announcements?focus=${announcement.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {announcement.is_pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                      <p className="truncate text-sm font-semibold">{announcement.title}</p>
                    </div>
                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
                      {announcement.content}
                    </p>
                    <p className="mt-1 text-[10px] text-muted-foreground/70">{announcement.author_name}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {format(new Date(announcement.created_at), 'M/d', { locale: ko })}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center">
            <Megaphone className="mb-2 h-8 w-8 text-muted-foreground/35" />
            <p className="text-sm text-muted-foreground">등록된 공지사항이 없습니다.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AnnouncementCard;
