import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight, ClipboardCheck, CalendarDays } from 'lucide-react';

interface CycleSummary {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  reviewCount: number;
  pendingCount: number;
  draftReview: DraftReviewSummary | null;
}

interface DraftReviewSummary {
  id: string;
  revieweeId: string;
  revieweeName: string;
  updatedAt: string;
}

const getSeoulDateKey = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
};

const getDaysLeft = (endDate: string) => {
  const today = new Date(`${getSeoulDateKey()}T00:00:00+09:00`);
  const end = new Date(`${endDate}T00:00:00+09:00`);
  return Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
};

const formatShortDate = (dateKey: string) => {
  const [, month, day] = dateKey.split('-');
  return `${Number(month)}.${Number(day)}`;
};

const PerformanceReviewDashboardCard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCycle, setActiveCycle] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setActiveCycle(null);
      return;
    }

    fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayKey = getSeoulDateKey();

      const { data: cycles } = await supabase
        .from('performance_review_cycles')
        .select('id, title, status, start_date, end_date')
        .eq('status', 'active')
        .lte('start_date', todayKey)
        .gte('end_date', todayKey)
        .order('end_date', { ascending: true })
        .limit(1);

      if (!cycles || cycles.length === 0) {
        setActiveCycle(null);
        setLoading(false);
        return;
      }

      const cycle = cycles[0];

      // Count reviews by this user as reviewer
      const { count: reviewCount } = await supabase
        .from('performance_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_id', user.id)
        .eq('cycle_id', cycle.id)
        .eq('status', 'submitted');

      // Count drafts
      const { count: pendingCount } = await supabase
        .from('performance_reviews')
        .select('id', { count: 'exact', head: true })
        .eq('reviewer_id', user.id)
        .eq('cycle_id', cycle.id)
        .eq('status', 'draft');

      const { data: drafts } = await supabase
        .from('performance_reviews')
        .select('id, reviewee_id, reviewee_name, updated_at')
        .eq('reviewer_id', user.id)
        .eq('cycle_id', cycle.id)
        .eq('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(1);

      const latestDraft = drafts?.[0];

      setActiveCycle({
        id: cycle.id,
        title: cycle.title,
        startDate: cycle.start_date,
        endDate: cycle.end_date,
        reviewCount: reviewCount || 0,
        pendingCount: pendingCount || 0,
        draftReview: latestDraft
          ? {
              id: latestDraft.id,
              revieweeId: latestDraft.reviewee_id,
              revieweeName: latestDraft.reviewee_name,
              updatedAt: latestDraft.updated_at,
            }
          : null,
      });
    } catch (err) {
      console.error('Error fetching review summary:', err);
    }
    setLoading(false);
  };

  if (loading || !activeCycle) return null;

  const daysLeft = getDaysLeft(activeCycle.endDate);
  const reviewLabel = activeCycle.reviewCount > 0
    ? `${activeCycle.reviewCount}건 제출`
    : '제출 전';
  const hasDraft = Boolean(activeCycle.draftReview);
  const targetPath = hasDraft && activeCycle.draftReview
    ? `/performance-review?cycleId=${activeCycle.id}&revieweeId=${activeCycle.draftReview.revieweeId}&resume=1`
    : '/performance-review';

  return (
    <Card className="overflow-hidden border-foreground/10 bg-card shadow-none">
      <CardContent className="p-4 sm:p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/10 bg-foreground text-background">
              <Star className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">업무 평가 기간입니다</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">기간 중 평가 작성을 완료해 주세요.</p>
            </div>
          </div>
          <Badge variant="outline" className="shrink-0 rounded-full border-foreground/15 px-2.5 text-xs">
            {daysLeft === 0 ? '오늘 마감' : `${daysLeft}일 남음`}
          </Badge>
        </div>

        <div className="rounded-xl border border-border bg-background/70 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-foreground">{activeCycle.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatShortDate(activeCycle.startDate)} - {formatShortDate(activeCycle.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ClipboardCheck className="h-3.5 w-3.5" />
              {reviewLabel}
            </span>
            {activeCycle.pendingCount > 0 && (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                임시저장 {activeCycle.pendingCount}건
              </span>
            )}
          </div>
          {activeCycle.draftReview && (
            <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">
              이어하기: <span className="font-medium text-foreground">{activeCycle.draftReview.revieweeName}</span> 평가 작성 중
            </p>
          )}
        </div>

        <Button
          size="sm"
          className="mt-3 h-10 w-full gap-2 rounded-xl bg-foreground text-background hover:bg-foreground/90"
          onClick={() => navigate(targetPath)}
        >
          {hasDraft ? '지난 업무평가 이어하기' : '업무평가 바로가기'}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default PerformanceReviewDashboardCard;
