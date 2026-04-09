import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { Plus, Star, Target, MessageSquare, TrendingUp, Loader2, ChevronDown, ChevronUp, Send, Pencil, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface ReviewCycle {
  id: string;
  year: number;
  quarter: number;
  title: string;
  start_date: string;
  end_date: string;
  status: string;
}

interface ReviewCategory {
  id: string;
  name: string;
  description: string | null;
  weight: number;
  display_order: number;
}

interface Review {
  id: string;
  cycle_id: string;
  reviewer_id: string;
  reviewer_name: string;
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

interface ReviewScore {
  id: string;
  category_id: string;
  score: number;
  comment: string | null;
}

const GRADES = ['S', 'A', 'B', 'C', 'D'];

const calcAutoGrade = (scores: Record<string, { score: number; comment: string }>, categories: ReviewCategory[]): string => {
  if (categories.length === 0 || Object.keys(scores).length === 0) return '';
  let totalWeight = 0;
  let weightedSum = 0;
  categories.forEach(c => {
    const s = scores[c.id];
    if (s) {
      totalWeight += c.weight;
      weightedSum += s.score * c.weight;
    }
  });
  if (totalWeight === 0) return '';
  const avg = weightedSum / totalWeight;
  if (avg >= 9) return 'S';
  if (avg >= 7) return 'A';
  if (avg >= 5) return 'B';
  if (avg >= 3) return 'C';
  return 'D';
};
const REVIEWER_TYPES = [
  { value: 'self', label: '자기 평가' },
  { value: 'superior', label: '상급자 평가' },
  { value: 'peer', label: '동료 평가' },
  { value: 'subordinate', label: '하급자 평가' },
];

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

interface Props {
  userId: string;
  userName: string;
  summaryOnly?: boolean;
}

const PerformanceReviewPanel: React.FC<Props> = ({ userId, userName, summaryOnly = false }) => {
  const { user, profile, isAdmin, isModerator } = useAuth();
  const canViewDetails = isAdmin || isModerator;

  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [hasExistingReview, setHasExistingReview] = useState(false);
  const [existingDraftReview, setExistingDraftReview] = useState<Review | null>(null);
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);

  // Form state
  const [formReviewerType, setFormReviewerType] = useState('superior');
  const [formGrade, setFormGrade] = useState('');
  const [formGoalRate, setFormGoalRate] = useState(70);
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formComment, setFormComment] = useState('');
  const [formScores, setFormScores] = useState<Record<string, { score: number; comment: string }>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  useEffect(() => {
    if (selectedCycleId) {
      fetchReviews();
      checkExistingReview();
    }
  }, [selectedCycleId]);

  const fetchData = async () => {
    setLoading(true);
    const [cyclesRes, catsRes] = await Promise.all([
      supabase.from('performance_review_cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
      supabase.from('performance_review_categories').select('*').eq('is_active', true).order('display_order'),
    ]);
    if (cyclesRes.data) {
      setCycles(cyclesRes.data as ReviewCycle[]);
      if (cyclesRes.data.length > 0 && !selectedCycleId) {
        setSelectedCycleId(cyclesRes.data[0].id);
      }
    }
    if (catsRes.data) setCategories(catsRes.data as ReviewCategory[]);
    setLoading(false);
  };

  const checkExistingReview = async () => {
    if (!user || !selectedCycleId) return;
    const { data } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('cycle_id', selectedCycleId)
      .eq('reviewer_id', user.id)
      .eq('reviewee_id', userId)
      .limit(1);
    const existing = data && data.length > 0 ? data[0] : null;
    setHasExistingReview(!!existing);
    if (existing && existing.status === 'draft') {
      // Fetch scores for draft
      const { data: scoresData } = await supabase
        .from('performance_review_scores')
        .select('*')
        .eq('review_id', existing.id);
      setExistingDraftReview({ ...existing, scores: (scoresData || []) as ReviewScore[] } as Review);
    } else {
      setExistingDraftReview(null);
    }
  };

  const fetchReviews = async () => {
    const { data: reviewsData } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('reviewee_id', userId)
      .eq('cycle_id', selectedCycleId)
      .order('created_at', { ascending: false });

    if (reviewsData && reviewsData.length > 0) {
      const reviewIds = reviewsData.map(r => r.id);
      const { data: scoresData } = await supabase
        .from('performance_review_scores')
        .select('*')
        .in('review_id', reviewIds);

      const enriched = reviewsData.map(r => ({
        ...r,
        scores: (scoresData || []).filter(s => s.review_id === r.id) as ReviewScore[],
      })) as Review[];
      setReviews(enriched);
    } else {
      setReviews([]);
    }
  };

  const resetForm = () => {
    setFormReviewerType('superior');
    setFormGrade('');
    setFormGoalRate(70);
    setFormStrengths('');
    setFormImprovements('');
    setFormComment('');
    const defaultScores: Record<string, { score: number; comment: string }> = {};
    categories.forEach(c => { defaultScores[c.id] = { score: 7, comment: '' }; });
    setFormScores(defaultScores);
  };

  const openForm = (draftReview?: Review) => {
    if (hasExistingReview && !draftReview) {
      toast.error('이 분기에 이미 해당 직원에 대한 평가를 작성하셨습니다.');
      return;
    }
    if (draftReview) {
      // Pre-fill form with draft data
      setEditingReviewId(draftReview.id);
      setFormReviewerType(draftReview.reviewer_type || 'superior');
      setFormGrade(draftReview.overall_grade || '');
      setFormGoalRate(draftReview.goal_achievement_rate ?? 70);
      setFormStrengths(draftReview.strengths || '');
      setFormImprovements(draftReview.improvements || '');
      setFormComment(draftReview.general_comment || '');
      const scores: Record<string, { score: number; comment: string }> = {};
      categories.forEach(c => { scores[c.id] = { score: 7, comment: '' }; });
      (draftReview.scores || []).forEach(s => {
        scores[s.category_id] = { score: s.score, comment: s.comment || '' };
      });
      setFormScores(scores);
    } else {
      setEditingReviewId(null);
      resetForm();
    }
    setShowForm(true);
  };

  const handleSubmit = async (asDraft: boolean) => {
    if (!selectedCycleId || !user || !profile) return;
    const autoGrade = calcAutoGrade(formScores, categories);
    if (!asDraft && !autoGrade) {
      toast.error('항목별 점수를 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const reviewPayload = {
        reviewer_type: formReviewerType,
        overall_grade: autoGrade || null,
        goal_achievement_rate: formGoalRate,
        strengths: formStrengths || null,
        improvements: formImprovements || null,
        general_comment: formComment || null,
        status: asDraft ? 'draft' : 'submitted',
      };

      let reviewId: string;

      if (editingReviewId) {
        const { error: reviewError } = await supabase
          .from('performance_reviews')
          .update(reviewPayload)
          .eq('id', editingReviewId);
        if (reviewError) throw reviewError;
        reviewId = editingReviewId;

        // Delete old scores and re-insert
        await supabase.from('performance_review_scores').delete().eq('review_id', reviewId);
      } else {
        // INSERT new review
        const { data: review, error: reviewError } = await supabase
          .from('performance_reviews')
          .insert({
            cycle_id: selectedCycleId,
            reviewer_id: user.id,
            reviewee_id: userId,
            reviewer_name: profile.full_name || profile.email,
            reviewee_name: userName,
            ...reviewPayload,
          })
          .select()
          .single();

        if (reviewError) {
          if (reviewError.message?.includes('unique_review_per_cycle_reviewer_reviewee')) {
            toast.error('이 분기에 이미 해당 직원에 대한 평가를 작성하셨습니다.');
            setHasExistingReview(true);
            setShowForm(false);
            return;
          }
          throw reviewError;
        }
        reviewId = review.id;
      }

      const scoreInserts = Object.entries(formScores).map(([catId, val]) => ({
        review_id: reviewId,
        category_id: catId,
        score: val.score,
        comment: val.comment || null,
      }));

      if (scoreInserts.length > 0) {
        const { error: scoresError } = await supabase.from('performance_review_scores').insert(scoreInserts);
        if (scoresError) throw scoresError;
      }

      toast.success(asDraft ? '임시 저장되었습니다.' : '평가가 제출되었습니다.');
      setShowForm(false);
      setEditingReviewId(null);
      setHasExistingReview(true);
      fetchReviews();
      checkExistingReview();
    } catch (e: any) {
      toast.error('저장 실패: ' + (e.message || ''));
    } finally {
      setSaving(false);
    }
  };

  const getWeightedAvg = (scores: ReviewScore[]) => {
    if (!scores || scores.length === 0) return null;
    let totalWeight = 0;
    let weightedSum = 0;
    scores.forEach(s => {
      const cat = categories.find(c => c.id === s.category_id);
      const w = cat?.weight || 1;
      totalWeight += w;
      weightedSum += s.score * w;
    });
    return totalWeight > 0 ? (weightedSum / totalWeight).toFixed(1) : null;
  };

  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const isCycleActive = selectedCycle?.status === 'active';

  const getWriteButtonTooltip = () => {
    if (hasExistingReview) return '이미 이 분기에 평가를 작성하셨습니다';
    if (!isCycleActive) return selectedCycle?.status === 'draft' ? '평가 기간 준비중입니다' : '평가 기간이 종료되었습니다';
    return '';
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Cycle selector & add button */}
      <div className="flex items-center justify-between">
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
          {selectedCycle && (
            <Badge variant={selectedCycle.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {selectedCycle.status === 'active' ? '진행중' : selectedCycle.status === 'completed' ? '완료' : '준비중'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasExistingReview && !existingDraftReview && (
            <span className="text-xs text-muted-foreground">평가 완료</span>
          )}
          {existingDraftReview && isCycleActive && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5"
              onClick={() => openForm(existingDraftReview)}
            >
              <Pencil className="h-3.5 w-3.5" /> 임시저장 수정
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => openForm()}
            disabled={!selectedCycleId || !isCycleActive || hasExistingReview}
            title={getWriteButtonTooltip()}
          >
            <Plus className="h-3.5 w-3.5" /> 평가 작성
          </Button>
        </div>
      </div>

      {cycles.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            평가 주기가 없습니다. 관리자 설정에서 평가 주기를 먼저 생성해주세요.
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      {reviews.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">평가 건수</p>
              <p className="text-2xl font-bold">{reviews.filter(r => r.status === 'submitted').length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">평균 점수</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const submitted = reviews.filter(r => r.status === 'submitted');
                  const avgs = submitted.map(r => getWeightedAvg(r.scores || [])).filter(Boolean).map(Number);
                  return avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : '-';
                })()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">최빈 등급</p>
              <p className="text-2xl font-bold">
                {(() => {
                  const grades = reviews.filter(r => r.status === 'submitted' && r.overall_grade).map(r => r.overall_grade!);
                  if (grades.length === 0) return '-';
                  const freq: Record<string, number> = {};
                  grades.forEach(g => { freq[g] = (freq[g] || 0) + 1; });
                  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
                })()}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reviews list - hidden in summaryOnly mode */}
      {!summaryOnly && reviews.length === 0 && selectedCycleId && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            이 주기에 등록된 평가가 없습니다.
          </CardContent>
        </Card>
      )}

      {!summaryOnly && !canViewDetails && reviews.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3 w-3" />
          평가 상세 내용은 관리자만 열람할 수 있습니다
        </div>
      )}

      {summaryOnly && reviews.length === 0 && selectedCycleId && (
        <p className="text-sm text-muted-foreground text-center py-4">이 주기에 등록된 평가가 없습니다.</p>
      )}

      {!summaryOnly && (
      <div className="space-y-2">
        {reviews.map((review, index) => (
          <Card key={review.id} className="overflow-hidden">
            <button
              className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
              onClick={() => {
                if (!canViewDetails) {
                  toast.info('평가 상세 내용은 관리자만 열람할 수 있습니다.');
                  return;
                }
                setExpandedReview(expandedReview === review.id ? null : review.id);
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {canViewDetails ? (
                      <>
                        <span className="text-sm font-medium">{review.reviewer_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {REVIEWER_TYPES.find(t => t.value === review.reviewer_type)?.label || review.reviewer_type}
                        </Badge>
                      </>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">평가 #{index + 1}</span>
                    )}
                  </div>
                  {review.overall_grade && (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColor(review.overall_grade)}`}>
                      {review.overall_grade}
                    </span>
                  )}
                  <Badge variant={review.status === 'submitted' ? 'default' : 'secondary'} className="text-xs">
                    {review.status === 'submitted' ? '제출됨' : '임시저장'}
                  </Badge>
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
                  {review.status === 'draft' && review.reviewer_id === user?.id && isCycleActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 px-2"
                      onClick={(e) => { e.stopPropagation(); openForm(review); }}
                    >
                      <Pencil className="h-3 w-3" /> 수정
                    </Button>
                  )}
                  {canViewDetails && (
                    <>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(review.created_at), 'yyyy.MM.dd', { locale: ko })}
                      </span>
                      {expandedReview === review.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </>
                  )}
                  {!canViewDetails && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </div>
            </button>
            {canViewDetails && expandedReview === review.id && (
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
                            <span className="text-sm w-40 shrink-0">{cat.name}</span>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  {review.strengths && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1"><TrendingUp className="h-3 w-3" />강점</h4>
                      <p className="text-sm whitespace-pre-line bg-card p-3 rounded-lg border">{review.strengths}</p>
                    </div>
                  )}
                  {review.improvements && (
                    <div>
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1.5 flex items-center gap-1"><MessageSquare className="h-3 w-3" />개선점</h4>
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
      )}

      {/* Review Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { setShowForm(open); if (!open) setEditingReviewId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              {userName} 업무 평가 {editingReviewId ? '(수정)' : ''}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] px-6 pb-6">
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">평가 유형</Label>
                  <Select value={formReviewerType} onValueChange={setFormReviewerType}>
                    <SelectTrigger className="h-9 text-sm mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REVIEWER_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">종합 등급 (자동 산출)</Label>
                  <div className="flex items-center gap-2 mt-1.5">
                    {(() => {
                      const auto = calcAutoGrade(formScores, categories);
                      const avg = (() => {
                        let tw = 0, ws = 0;
                        categories.forEach(c => { const s = formScores[c.id]; if (s) { tw += c.weight; ws += s.score * c.weight; } });
                        return tw > 0 ? (ws / tw).toFixed(1) : '-';
                      })();
                      return (
                        <>
                          {GRADES.map(g => (
                            <span
                              key={g}
                              className={`w-10 h-9 rounded-lg text-sm font-bold border-2 flex items-center justify-center transition-all ${auto === g ? gradeColor(g) + ' ring-2 ring-offset-1 ring-primary/30' : 'border-muted bg-muted/10 text-muted-foreground/40'}`}
                            >
                              {g}
                            </span>
                          ))}
                          <span className="text-xs text-muted-foreground ml-2">평균 {avg}점</span>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground flex items-center justify-between">
                  <span>목표 달성률</span>
                  <span className="text-sm font-bold text-foreground">{formGoalRate}%</span>
                </Label>
                <Slider
                  value={[formGoalRate]}
                  onValueChange={([v]) => setFormGoalRate(v)}
                  max={100}
                  step={5}
                  className="mt-2"
                />
              </div>

              <Separator />

              <div>
                <h3 className="text-sm font-semibold mb-3">항목별 평가 (0~10점)</h3>
                <div className="space-y-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-sm font-medium">{cat.name}</span>
                          {cat.description && <span className="text-xs text-muted-foreground ml-2">{cat.description}</span>}
                        </div>
                        <span className="text-sm font-bold font-mono">{formScores[cat.id]?.score ?? 7}</span>
                      </div>
                      <Slider
                        value={[formScores[cat.id]?.score ?? 7]}
                        onValueChange={([v]) => setFormScores(prev => ({ ...prev, [cat.id]: { ...prev[cat.id], score: v, comment: prev[cat.id]?.comment || '' } }))}
                        max={10}
                        step={1}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">강점</Label>
                  <Textarea value={formStrengths} onChange={e => setFormStrengths(e.target.value)} rows={3} placeholder="이 직원의 강점을 작성하세요" className="mt-1 text-sm resize-none" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">개선점</Label>
                  <Textarea value={formImprovements} onChange={e => setFormImprovements(e.target.value)} rows={3} placeholder="개선이 필요한 부분을 작성하세요" className="mt-1 text-sm resize-none" />
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">종합 의견</Label>
                <Textarea value={formComment} onChange={e => setFormComment(e.target.value)} rows={3} placeholder="종합적인 평가 의견을 작성하세요" className="mt-1 text-sm resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleSubmit(true)} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  임시 저장
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => handleSubmit(false)} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  제출
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PerformanceReviewPanel;
