import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, Star, Target, TrendingUp, MessageSquare, ChevronDown, ChevronUp, Lock, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ReviewCycle {
  id: string;
  year: number;
  quarter: number;
  title: string;
  status: string;
}

interface ReviewCategory {
  id: string;
  name: string;
  weight: number;
  display_order: number;
}

interface ReviewScore {
  id: string;
  category_id: string;
  score: number;
  comment: string | null;
}

interface Review {
  id: string;
  reviewer_type: string;
  overall_grade: string | null;
  goal_achievement_rate: number | null;
  strengths: string | null;
  improvements: string | null;
  general_comment: string | null;
  status: string;
  created_at: string;
  scores?: ReviewScore[];
}

interface SentSummary {
  id: string;
  overall_grade: string | null;
  avg_score: number | null;
  avg_goal_rate: number | null;
  category_scores: { name: string; avg: number }[];
  strengths_summary: string | null;
  improvements_summary: string | null;
  general_comment: string | null;
  sent_at: string;
  sent_by_name: string;
}

const gradeColor = (grade: string) => {
  switch (grade) {
    case 'S': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case 'A': return 'bg-green-100 text-green-800 border-green-300';
    case 'B': return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'C': return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'D': return 'bg-red-100 text-red-800 border-red-300';
    default: return '';
  }
};

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--primary) / 0.8)', 'hsl(var(--primary) / 0.6)', 'hsl(var(--primary) / 0.4)'];

const MyPerformanceReviewResults: React.FC = () => {
  const { user } = useAuth();
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<SentSummary | null>(null);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchCyclesAndCategories();
  }, [user]);

  useEffect(() => {
    if (selectedCycleId && user) {
      fetchReviews();
      fetchSummary();
    }
  }, [selectedCycleId]);

  const fetchCyclesAndCategories = async () => {
    setLoading(true);
    const [cyclesRes, catsRes] = await Promise.all([
      supabase.from('performance_review_cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
      supabase.from('performance_review_categories').select('*').eq('is_active', true).order('display_order'),
    ]);
    if (cyclesRes.data) {
      setCycles(cyclesRes.data as ReviewCycle[]);
      if (cyclesRes.data.length > 0) setSelectedCycleId(cyclesRes.data[0].id);
    }
    if (catsRes.data) setCategories(catsRes.data as ReviewCategory[]);
    setLoading(false);
  };

  const fetchReviews = async () => {
    if (!user) return;
    const { data: reviewsData } = await supabase
      .from('performance_reviews')
      .select('id, reviewer_type, overall_grade, goal_achievement_rate, strengths, improvements, general_comment, status, created_at')
      .eq('reviewee_id', user.id)
      .eq('cycle_id', selectedCycleId)
      .eq('status', 'submitted')
      .order('created_at', { ascending: false });

    if (reviewsData && reviewsData.length > 0) {
      const reviewIds = reviewsData.map(r => r.id);
      const { data: scoresData } = await supabase
        .from('performance_review_scores')
        .select('*')
        .in('review_id', reviewIds);
      setReviews(reviewsData.map(r => ({
        ...r,
        scores: (scoresData || []).filter(s => s.review_id === r.id) as ReviewScore[],
      })) as Review[]);
    } else {
      setReviews([]);
    }
  };

  const fetchSummary = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('performance_review_summaries' as any)
      .select('*')
      .eq('cycle_id', selectedCycleId)
      .eq('reviewee_id', user.id)
      .maybeSingle() as { data: any };
    if (data) {
      setSummary({
        id: data.id,
        overall_grade: data.overall_grade,
        avg_score: data.avg_score,
        avg_goal_rate: data.avg_goal_rate,
        category_scores: (data.category_scores as any) || [],
        strengths_summary: data.strengths_summary,
        improvements_summary: data.improvements_summary,
        general_comment: data.general_comment,
        sent_at: data.sent_at,
        sent_by_name: data.sent_by_name,
      });
    } else {
      setSummary(null);
    }
  };

  const getWeightedAvg = (scores: ReviewScore[]) => {
    if (!scores || scores.length === 0) return null;
    let totalWeight = 0, weightedSum = 0;
    scores.forEach(s => {
      const cat = categories.find(c => c.id === s.category_id);
      const w = cat?.weight || 1;
      totalWeight += w;
      weightedSum += s.score * w;
    });
    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(1) : null;
  };

  const submittedReviews = reviews.filter(r => r.status === 'submitted');
  const avgScore = (() => {
    const avgs = submittedReviews.map(r => getWeightedAvg(r.scores || [])).filter(Boolean).map(Number);
    return avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : null;
  })();
  const avgGoalRate = (() => {
    const rates = submittedReviews.filter(r => r.goal_achievement_rate !== null).map(r => r.goal_achievement_rate!);
    return rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
  })();
  const mostFreqGrade = (() => {
    const grades = submittedReviews.filter(r => r.overall_grade).map(r => r.overall_grade!);
    if (grades.length === 0) return null;
    const freq: Record<string, number> = {};
    grades.forEach(g => { freq[g] = (freq[g] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  })();

  const categoryAvgScores = categories.map(cat => {
    const scores = submittedReviews.flatMap(r => (r.scores || []).filter(s => s.category_id === cat.id));
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : null;
    return { ...cat, avg };
  });

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (cycles.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          등록된 평가 주기가 없습니다.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cycle selector */}
      <div className="flex items-center gap-3">
        <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
          <SelectTrigger className="w-56 h-9 text-sm">
            <SelectValue placeholder="평가 주기 선택" />
          </SelectTrigger>
          <SelectContent>
            {cycles.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          평가자 정보는 익명으로 표시됩니다
        </div>
      </div>

      {/* Admin-sent Summary */}
      {summary && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              공식 업무 평가서
              {summary.overall_grade && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ml-2 ${gradeColor(summary.overall_grade)}`}>
                  {summary.overall_grade}
                </span>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {new Date(summary.sent_at).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 발송
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-2 bg-card rounded-lg border">
                <p className="text-xs text-muted-foreground">평균 점수</p>
                <p className="text-lg font-bold">{summary.avg_score?.toFixed(1) ?? '-'}</p>
              </div>
              <div className="text-center p-2 bg-card rounded-lg border">
                <p className="text-xs text-muted-foreground">목표 달성률</p>
                <p className="text-lg font-bold">{summary.avg_goal_rate !== null ? `${summary.avg_goal_rate}%` : '-'}</p>
              </div>
              <div className="text-center p-2 bg-card rounded-lg border">
                <p className="text-xs text-muted-foreground">종합 등급</p>
                <p className="text-lg font-bold">
                  {summary.overall_grade ? (
                    <span className={`px-2 py-0.5 rounded border ${gradeColor(summary.overall_grade)}`}>{summary.overall_grade}</span>
                  ) : '-'}
                </p>
              </div>
            </div>

            {/* Category scores chart */}
            {summary.category_scores && summary.category_scores.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-2">항목별 점수</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary.category_scores} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} tickCount={6} />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(val: number) => val.toFixed(1)} />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                      {summary.category_scores.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Comments */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {summary.strengths_summary && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1"><TrendingUp className="h-3 w-3" />강점</h4>
                  <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{summary.strengths_summary}</p>
                </div>
              )}
              {summary.improvements_summary && (
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1"><MessageSquare className="h-3 w-3" />개선점</h4>
                  <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{summary.improvements_summary}</p>
                </div>
              )}
            </div>
            {summary.general_comment && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">종합 의견</h4>
                <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{summary.general_comment}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Anonymous review summary stats */}
      {submittedReviews.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">평가 건수</p>
                <p className="text-2xl font-bold">{submittedReviews.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">평균 점수</p>
                <p className="text-2xl font-bold">{avgScore ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {mostFreqGrade ? '최빈 등급' : '평균 목표달성률'}
                </p>
                <p className="text-2xl font-bold">
                  {mostFreqGrade ? (
                    <span className={`px-2 py-0.5 rounded border text-lg ${gradeColor(mostFreqGrade)}`}>{mostFreqGrade}</span>
                  ) : avgGoalRate !== null ? `${avgGoalRate}%` : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">항목별 평균 점수</h4>
              <div className="space-y-2">
                {categoryAvgScores.map(cat => (
                  <div key={cat.id} className="flex items-center gap-3">
                    <span className="text-sm w-32 shrink-0 truncate">{cat.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2.5">
                      <div className="bg-primary rounded-full h-2.5 transition-all" style={{ width: `${(cat.avg ?? 0) * 10}%` }} />
                    </div>
                    <span className="text-sm font-mono font-medium w-10 text-right">
                      {cat.avg !== null ? cat.avg.toFixed(1) : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Anonymous individual reviews */}
      {submittedReviews.length === 0 && !summary && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            이 주기에 제출된 평가가 없습니다.
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {submittedReviews.map((review, index) => (
          <Card key={review.id} className="overflow-hidden">
            <button
              className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
              onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-muted-foreground">평가 #{index + 1}</span>
                  {review.overall_grade && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColor(review.overall_grade)}`}>
                      {review.overall_grade}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {review.goal_achievement_rate !== null && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Target className="h-3 w-3" />{review.goal_achievement_rate}%
                    </span>
                  )}
                  {getWeightedAvg(review.scores || []) && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Star className="h-3 w-3" />{getWeightedAvg(review.scores || [])}
                    </span>
                  )}
                  {expandedReview === review.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>
            </button>
            {expandedReview === review.id && (
              <div className="border-t px-4 pb-4 space-y-4 bg-muted/20">
                {review.scores && review.scores.length > 0 && (
                  <div className="pt-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-3">항목별 점수</h4>
                    <div className="space-y-2">
                      {categories.map(cat => {
                        const score = review.scores?.find(s => s.category_id === cat.id);
                        if (!score) return null;
                        return (
                          <div key={cat.id} className="flex items-center gap-3">
                            <span className="text-sm w-32 shrink-0">{cat.name}</span>
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${score.score * 10}%` }} />
                            </div>
                            <span className="text-sm font-mono font-medium w-8 text-right">{score.score}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {review.strengths && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />강점
                      </h4>
                      <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{review.strengths}</p>
                    </div>
                  )}
                  {review.improvements && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />개선점
                      </h4>
                      <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{review.improvements}</p>
                    </div>
                  )}
                </div>
                {review.general_comment && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">종합 의견</h4>
                    <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{review.general_comment}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MyPerformanceReviewResults;
