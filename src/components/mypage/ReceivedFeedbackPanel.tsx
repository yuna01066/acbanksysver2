import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Heart, MessageSquare, Coffee, Inbox, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface FeedbackItem {
  id: string;
  sender_id: string;
  receiver_id: string;
  feedback_type: string;
  message: string;
  emoji: string | null;
  is_read: boolean;
  created_at: string;
  partner_name?: string;
}

const FEEDBACK_META: Record<string, { label: string; icon: React.ReactNode; badgeVariant: 'default' | 'secondary' | 'outline' }> = {
  recognition: { label: '인정', icon: <Heart className="h-3.5 w-3.5" />, badgeVariant: 'default' },
  feedback: { label: '피드백', icon: <MessageSquare className="h-3.5 w-3.5" />, badgeVariant: 'secondary' },
  one_on_one: { label: '1:1 요청', icon: <Coffee className="h-3.5 w-3.5" />, badgeVariant: 'outline' },
};

const FeedbackList: React.FC<{ items: FeedbackItem[]; emptyText: string; showUnread?: boolean }> = ({ items, emptyText, showUnread }) => {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map(fb => {
        const meta = FEEDBACK_META[fb.feedback_type] || FEEDBACK_META.feedback;
        return (
          <div key={fb.id} className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
            <Avatar className="h-9 w-9 rounded-lg shrink-0">
              <AvatarFallback className="rounded-lg bg-primary/10 text-primary text-sm font-semibold">
                {fb.partner_name?.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium">{fb.partner_name}</span>
                <Badge variant={meta.badgeVariant} className="gap-1 text-xs">
                  {meta.icon}{meta.label}
                </Badge>
                {showUnread && !fb.is_read && <span className="h-2 w-2 rounded-full bg-primary" />}
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
  );
};

const ReceivedFeedbackPanel: React.FC = () => {
  const { user } = useAuth();
  const [received, setReceived] = useState<FeedbackItem[]>([]);
  const [sent, setSent] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      const [receivedRes, sentRes] = await Promise.all([
        supabase.from('peer_feedback').select('*').eq('receiver_id', user.id).order('created_at', { ascending: false }),
        supabase.from('peer_feedback').select('*').eq('sender_id', user.id).order('created_at', { ascending: false }),
      ]);

      const allData = [...(receivedRes.data || []), ...(sentRes.data || [])];
      const partnerIds = [...new Set([
        ...(receivedRes.data || []).map(f => f.sender_id),
        ...(sentRes.data || []).map(f => f.receiver_id),
      ])];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', partnerIds.length > 0 ? partnerIds : ['none']);

      const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) || []);

      setReceived((receivedRes.data || []).map(f => ({ ...f, partner_name: nameMap.get(f.sender_id) || '알 수 없음' })));
      setSent((sentRes.data || []).map(f => ({ ...f, partner_name: nameMap.get(f.receiver_id) || '알 수 없음' })));

      // Mark unread received as read
      const unreadIds = (receivedRes.data || []).filter(f => !f.is_read).map(f => f.id);
      if (unreadIds.length > 0) {
        await supabase.from('peer_feedback').update({ is_read: true }).in('id', unreadIds);
      }
      setLoading(false);
    };
    fetchAll();
  }, [user]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🙏 인정 & 피드백</CardTitle>
        <CardDescription>동료들과 주고받은 인정, 피드백, 1:1 미팅 요청을 확인하세요.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="received">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="received" className="gap-1.5">
              <Inbox className="h-3.5 w-3.5" />
              받은 피드백
              {received.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{received.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="sent" className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              보낸 피드백
              {sent.length > 0 && <Badge variant="secondary" className="text-xs ml-1">{sent.length}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="received">
            <FeedbackList items={received} emptyText="아직 받은 피드백이 없습니다." showUnread />
          </TabsContent>
          <TabsContent value="sent">
            <FeedbackList items={sent} emptyText="아직 보낸 피드백이 없습니다." />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ReceivedFeedbackPanel;
