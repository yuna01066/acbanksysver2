import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronRight, Loader2, MessageSquareText } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

type ChannelTalkInquiry = {
  id: string;
  customer_name: string | null;
  customer_company: string | null;
  inquiry_type: string;
  status: string;
  analysis: Record<string, any>;
  missing_fields: string[];
  created_at: string;
};

const ACTIVE_STATUSES = ['new', 'needs_review', 'analyzed'];

const statusLabel = (status: string) => {
  switch (status) {
    case 'new':
      return { label: '신규', className: 'border-sky-200 bg-sky-50 text-sky-700' };
    case 'needs_review':
      return { label: '검토 필요', className: 'border-amber-200 bg-amber-50 text-amber-700' };
    case 'analyzed':
      return { label: '분석 완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
    default:
      return { label: status || '미분류', className: 'border-muted bg-muted text-muted-foreground' };
  }
};

const confidenceLabel = (confidence?: string | null) => {
  if (confidence === 'high') return { label: '신뢰도 높음', className: 'border-emerald-200 text-emerald-700' };
  if (confidence === 'medium') return { label: '신뢰도 보통', className: 'border-blue-200 text-blue-700' };
  return { label: '수동 검토', className: 'border-amber-200 text-amber-700' };
};

const inquiryTypeLabel = (type?: string | null) => {
  if (!type || type === 'quote') return '견적 문의';
  if (type === 'drawing') return '도면 문의';
  if (type === 'production') return '제작 문의';
  return type;
};

const ChannelTalkInquiryCard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: inquiries = [], isLoading } = useQuery<ChannelTalkInquiry[]>({
    queryKey: ['home-channel-talk-inquiries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_talk_quote_leads' as any)
        .select('id, customer_name, customer_company, inquiry_type, status, analysis, missing_fields, created_at')
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkInquiry[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  });

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('home-channel-talk-inquiries')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'channel_talk_quote_leads',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['home-channel-talk-inquiries'] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-primary/10 bg-background/85 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={MessageSquareText}
          title="채널톡 문의"
          subtitle="AI가 분석한 최근 문의를 확인합니다."
          actions={(
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate('/channel-talk-leads')}>
              전체보기
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        {isLoading ? (
          <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground sm:h-[360px]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            채널톡 문의를 불러오는 중입니다.
          </div>
        ) : inquiries.length === 0 ? (
          <div className="flex h-[340px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center sm:h-[360px]">
            <MessageSquareText className="mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm font-medium">최근 채널톡 분석 문의가 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">새 문의가 분석되면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <ScrollArea className="h-[340px] pr-3 sm:h-[360px]">
            <div className="space-y-2 pb-1">
              {inquiries.map((inquiry) => {
                const status = statusLabel(inquiry.status);
                const confidence = confidenceLabel(inquiry.analysis?.confidence);
                const title = inquiry.analysis?.item_name
                  || inquiry.customer_company
                  || inquiry.customer_name
                  || '채널톡 문의';
                const customer = [inquiry.customer_company, inquiry.customer_name].filter(Boolean).join(' · ') || '고객 미확인';

                return (
                  <button
                    key={inquiry.id}
                    type="button"
                    onClick={() => navigate(`/channel-talk-leads?id=${inquiry.id}`)}
                    className="group w-full rounded-xl border bg-card/80 p-3 text-left transition-colors hover:bg-accent/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{customer}</p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={cn('text-[10px]', status.className)}>{status.label}</Badge>
                      <Badge variant="outline" className={cn('text-[10px]', confidence.className)}>{confidence.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{inquiryTypeLabel(inquiry.analysis?.inquiry_type || inquiry.inquiry_type)}</Badge>
                      {inquiry.missing_fields?.length > 0 && (
                        <Badge variant="outline" className="border-amber-200 text-[10px] text-amber-700">
                          누락 {inquiry.missing_fields.length}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {inquiry.analysis?.summary || '분석 요약이 없습니다.'}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(inquiry.created_at), { addSuffix: true, locale: ko })}
                    </p>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default ChannelTalkInquiryCard;
