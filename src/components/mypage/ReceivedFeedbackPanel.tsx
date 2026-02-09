import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Heart, MessageSquare, Coffee } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface FeedbackItem {
  id: string;
  sender_id: string;
  feedback_type: string;
  message: string;
  emoji: string | null;
  is_read: boolean;
  created_at: string;
  sender_name?: string;
}

const FEEDBACK_META: Record<string, { label: string; icon: React.ReactNode; badgeVariant: 'default' | 'secondary' | 'outline' }> = {
  recognition: { label: '인정', icon: <Heart className="h-3.5 w-3.5" />, badgeVariant: 'default' },
  feedback: { label: '피드백', icon: <MessageSquare className="h-3.5 w-3.5" />, badgeVariant: 'secondary' },
  one_on_one: { label: '1:1 요청', icon: <Coffee className="h-3.5 w-3.5" />, badgeVariant: 'outline' },
};

const ReceivedFeedbackPanel: React.FC = () => {
  const { user } = useAuth();
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchFeedback = async () => {
      const { data, error } = await supabase
        .from('peer_feedback')
        .select('*')
        .eq('receiver_id', user.id)
        .order('created_at', { ascending: false });

      if (error || !data) { setLoading(false); return; }

      const senderIds = [...new Set(data.map(f => f.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', senderIds);

      const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);
      setFeedbacks(data.map(f => ({ ...f, sender_name: nameMap.get(f.sender_id) || '알 수 없음' })));

      // Mark unread as read
      const unreadIds = data.filter(f => !f.is_read).map(f => f.id);
      if (unreadIds.length > 0) {
        await supabase.from('peer_feedback').update({ is_read: true }).in('id', unreadIds);
      }
      setLoading(false);
    };
    fetchFeedback();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🙏 받은 인정 & 피드백</CardTitle>
        <CardDescription>동료들이 보내준 인정, 피드백, 1:1 미팅 요청을 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        {feedbacks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">아직 받은 피드백이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {feedbacks.map(fb => {
              const meta = FEEDBACK_META[fb.feedback_type] || FEEDBACK_META.feedback;
              return (
                <div key={fb.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                  <Avatar className="h-9 w-9 rounded-lg shrink-0">
                    <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                      {fb.sender_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{fb.sender_name}</span>
                      <Badge variant={meta.badgeVariant} className="gap-1 text-xs">
                        {meta.icon}{meta.label}
                      </Badge>
                      {!fb.is_read && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{fb.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      {format(new Date(fb.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReceivedFeedbackPanel;
