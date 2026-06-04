import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, format, isValid, parseISO } from 'date-fns';
import { AlertTriangle, ChevronRight, FileText, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { getQuoteStatusInfo } from '@/utils/quoteStatus';
import { normalizeProjectStage, parseValidUntilDate } from '@/utils/quoteWorkflow';

type FollowUpQuote = {
  id: string;
  quote_number: string;
  project_name: string | null;
  recipient_company: string | null;
  recipient_name: string | null;
  total: number;
  quote_date: string;
  valid_until: string | null;
  project_id: string | null;
  project_stage: string | null;
  quote_status: string | null;
  assigned_to: string | null;
  assigned_to_name: string | null;
  issuer_id: string | null;
  issuer_name: string | null;
  user_id: string;
  created_at: string;
  status_updated_at: string | null;
};

type FollowUpReason = {
  label: string;
  description: string;
  tone: 'warning' | 'danger' | 'primary' | 'neutral' | 'success';
  priority: number;
};

type FollowUpItem = {
  quote: FollowUpQuote;
  reason: FollowUpReason;
  ageDays: number;
};

const FOLLOW_UP_AFTER_DAYS = 3;
const EXPIRING_SOON_DAYS = 3;
const ACTIVE_LIMIT = 80;

const toneDotClass = (tone: FollowUpReason['tone']) => {
  switch (tone) {
    case 'danger':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'primary':
      return 'bg-foreground';
    case 'success':
      return 'bg-emerald-500';
    default:
      return 'bg-muted-foreground';
  }
};

const formatCurrency = (value: number) => new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: 'KRW',
  maximumFractionDigits: 0,
}).format(value || 0);

const parseDate = (value?: string | null) => {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
};

const daysSince = (value?: string | null) => {
  const parsed = parseDate(value);
  return parsed ? Math.max(0, differenceInCalendarDays(new Date(), parsed)) : 0;
};

const validUntilDays = (value?: string | null) => {
  const parsed = parseValidUntilDate(value);
  return parsed ? differenceInCalendarDays(parsed, new Date()) : null;
};

const getFollowUpReason = (quote: FollowUpQuote): FollowUpReason | null => {
  const stage = normalizeProjectStage(quote.project_stage, quote.quote_status);
  const status = quote.quote_status || getQuoteStatusInfo(quote.quote_status, quote.project_stage).value;
  const ageDays = daysSince(quote.status_updated_at || quote.quote_date || quote.created_at);
  const daysToExpiry = validUntilDays(quote.valid_until);

  if (status === 'revision_requested' || stage === 'revision_requested') {
    return {
      label: '수정요청',
      description: '고객 또는 내부 수정 요청이 남아 있습니다.',
      tone: 'danger',
      priority: 10,
    };
  }

  if (status === 'won' && !quote.project_id) {
    return {
      label: '프로젝트 전환',
      description: '수주 상태지만 프로젝트 연결이 없습니다.',
      tone: 'success',
      priority: 20,
    };
  }

  if (status === 'on_hold' || stage === 'on_hold') {
    return {
      label: '보류 확인',
      description: '보류된 견적의 다음 조치를 확인하세요.',
      tone: 'neutral',
      priority: 30,
    };
  }

  if ((status === 'sent' || stage === 'quote_issued') && daysToExpiry !== null && daysToExpiry < 0) {
    return {
      label: '유효기간 만료',
      description: '견적 유효기간이 지났습니다.',
      tone: 'danger',
      priority: 40,
    };
  }

  if ((status === 'sent' || stage === 'quote_issued') && daysToExpiry !== null && daysToExpiry <= EXPIRING_SOON_DAYS) {
    return {
      label: '만료 임박',
      description: `유효기간이 ${Math.max(0, daysToExpiry)}일 남았습니다.`,
      tone: 'warning',
      priority: 50,
    };
  }

  if ((status === 'sent' || stage === 'quote_issued') && !quote.project_id && ageDays >= FOLLOW_UP_AFTER_DAYS) {
    return {
      label: '후속 필요',
      description: `발송 후 ${ageDays}일째 프로젝트 미연결입니다.`,
      tone: 'primary',
      priority: 60,
    };
  }

  return null;
};

const getQuoteTitle = (quote: FollowUpQuote) => {
  return quote.project_name || quote.recipient_company || quote.recipient_name || `견적 ${quote.quote_number}`;
};

const DashboardQuoteFollowUpCard = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isModerator } = useAuth();
  const canReviewAll = isAdmin || isModerator;

  const { data: quotes = [], isLoading } = useQuery<FollowUpQuote[]>({
    queryKey: ['home-quote-follow-ups', user?.id, canReviewAll],
    queryFn: async () => {
      let query = supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, recipient_name, total, quote_date, valid_until, project_id, project_stage, quote_status, assigned_to, assigned_to_name, issuer_id, issuer_name, user_id, created_at, status_updated_at')
        .not('quote_status', 'eq', 'cancelled')
        .not('project_stage', 'eq', 'cancelled')
        .not('project_stage', 'eq', 'delivered')
        .order('status_updated_at', { ascending: false })
        .limit(ACTIVE_LIMIT);

      if (!canReviewAll && user?.id) {
        query = query.or(`user_id.eq.${user.id},issuer_id.eq.${user.id},assigned_to.eq.${user.id}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as FollowUpQuote[];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  const followUps = useMemo<FollowUpItem[]>(() => {
    return quotes
      .map((quote) => {
        const reason = getFollowUpReason(quote);
        if (!reason) return null;
        return {
          quote,
          reason,
          ageDays: daysSince(quote.status_updated_at || quote.quote_date || quote.created_at),
        };
      })
      .filter((item): item is FollowUpItem => Boolean(item))
      .sort((a, b) => a.reason.priority - b.reason.priority || b.ageDays - a.ageDays)
      .slice(0, 8);
  }, [quotes]);

  const visibleItems = followUps.slice(0, 5);
  const revisionCount = followUps.filter((item) => item.reason.label === '수정요청').length;
  const projectCount = followUps.filter((item) => item.reason.label === '프로젝트 전환').length;
  const followUpCount = followUps.filter((item) => item.reason.label === '후속 필요' || item.reason.label.includes('만료')).length;

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-lg border-border bg-card shadow-none">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={FileText}
          title="견적 후속관리"
          subtitle="수정 요청, 만료 임박, 프로젝트 미전환 견적을 확인합니다."
          actions={(
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate('/saved-quotes')}>
              전체보기
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        />
      </CardHeader>
      <CardContent className="min-h-0 flex-1 pt-0">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="rounded-full px-2.5 py-1">
            총 {followUps.length}건
          </Badge>
          {revisionCount > 0 && (
            <Badge variant="outline" className="rounded-full border-border bg-card px-2.5 py-1 text-muted-foreground">
              <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', toneDotClass('danger'))} />
              수정 {revisionCount}
            </Badge>
          )}
          {followUpCount > 0 && (
            <Badge variant="outline" className="rounded-full border-border bg-card px-2.5 py-1 text-muted-foreground">
              <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', toneDotClass('warning'))} />
              후속 {followUpCount}
            </Badge>
          )}
          {projectCount > 0 && (
            <Badge variant="outline" className="rounded-full border-border bg-card px-2.5 py-1 text-muted-foreground">
              <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', toneDotClass('success'))} />
              전환 {projectCount}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <div className="flex h-[340px] items-center justify-center text-sm text-muted-foreground sm:h-[360px]">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            견적 후속 항목을 불러오는 중입니다.
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="flex h-[340px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center sm:h-[360px]">
            <AlertTriangle className="mb-2 h-9 w-9 text-muted-foreground/40" />
            <p className="text-sm font-medium">후속 확인이 필요한 견적이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">수정 요청이나 만료 임박 견적이 생기면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          <ScrollArea className="h-[340px] pr-3 sm:h-[360px]">
            <div className="space-y-2 pb-1">
              {visibleItems.map(({ quote, reason }) => {
                const status = getQuoteStatusInfo(quote.quote_status);
                const displayDate = parseDate(quote.quote_date);

                return (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                    className="group w-full rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{getQuoteTitle(quote)}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {quote.recipient_company || quote.recipient_name || '거래처 미확인'} · {formatCurrency(quote.total)}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className="border-border bg-card text-[10px] text-muted-foreground">
                        <span className={cn('mr-1.5 h-1.5 w-1.5 rounded-full', toneDotClass(reason.tone))} />
                        {reason.label}
                      </Badge>
                      <Badge variant="outline" className="border-border bg-card text-[10px] text-muted-foreground">
                        {status.label}
                      </Badge>
                      {quote.assigned_to_name && (
                        <Badge variant="outline" className="text-[10px]">
                          담당 {quote.assigned_to_name}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {reason.description}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground/70">
                      {quote.quote_number}
                      {displayDate ? ` · ${format(displayDate, 'yy.MM.dd')} 발행` : ''}
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

export default DashboardQuoteFollowUpCard;
