import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Star, ArrowRight, Loader2, ClipboardCheck } from 'lucide-react';

interface CycleSummary {
  id: string;
  title: string;
  status: string;
  reviewCount: number;
  pendingCount: number;
}

const PerformanceReviewDashboardCard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeCycle, setActiveCycle] = useState<CycleSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) fetchSummary();
  }, [user]);

  const fetchSummary = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get active or most recent cycle
      const { data: cycles } = await supabase
        .from('performance_review_cycles')
        .select('id, title, status')
        .order('year', { ascending: false })
        .order('quarter', { ascending: false })
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

      setActiveCycle({
        id: cycle.id,
        title: cycle.title,
        status: cycle.status,
        reviewCount: reviewCount || 0,
        pendingCount: pendingCount || 0,
      });
    } catch (err) {
      console.error('Error fetching review summary:', err);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Star className="h-4 w-4 text-primary" />
            </div>
            <h3 className="font-semibold text-sm">업무 평가</h3>
          </div>
          {activeCycle && (
            <Badge variant={activeCycle.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {activeCycle.status === 'active' ? '진행중' : activeCycle.status === 'completed' ? '완료' : '준비중'}
            </Badge>
          )}
        </div>

        {!activeCycle ? (
          <p className="text-sm text-muted-foreground">등록된 평가 주기가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">{activeCycle.title}</p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-medium">{activeCycle.reviewCount}건 제출</span>
              </div>
              {activeCycle.pendingCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                    {activeCycle.pendingCount}건 임시저장
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full mt-4 gap-2 text-xs"
          onClick={() => navigate('/performance-review')}
        >
          평가하러 가기
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
};

export default PerformanceReviewDashboardCard;
