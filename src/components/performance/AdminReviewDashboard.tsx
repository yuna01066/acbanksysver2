import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Send, User, Star, TrendingUp, MessageSquare, Search, CheckCircle, Users, ClipboardCheck, Award } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import ProfileAvatarImage from '@/components/employee/ProfileAvatarImage';
import { summarizeStructuredFeedback } from '@/lib/performanceFeedback';

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

interface EmployeeReviewData {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
  reviewCount: number;
  avgScore: number | null;
  avgGoalRate: number | null;
  mostFreqGrade: string | null;
  categoryScores: { name: string; avg: number }[];
  strengths: string[];
  improvements: string[];
  generalComments: string[];
  hasSummary: boolean;
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

const AdminReviewDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [employeeData, setEmployeeData] = useState<EmployeeReviewData[]>([]);
  const [search, setSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeReviewData | null>(null);

  // Send dialog state
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendGrade, setSendGrade] = useState('');
  const [sendStrengths, setSendStrengths] = useState('');
  const [sendImprovements, setSendImprovements] = useState('');
  const [sendComment, setSendComment] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCycleId) fetchAllReviewData();
  }, [selectedCycleId]);

  const fetchInitialData = async () => {
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

  const fetchAllReviewData = async () => {
    setLoading(true);

    // Fetch employees, reviews, scores, and existing summaries in parallel
    const [empRes, reviewsRes, summariesRes] = await Promise.all([
      (supabase.from('profile_directory' as any) as any).select('id, full_name, department, position, avatar_url').order('full_name'),
      supabase.from('performance_reviews').select('*').eq('cycle_id', selectedCycleId).eq('status', 'submitted'),
      supabase.from('performance_review_summaries').select('reviewee_id').eq('cycle_id', selectedCycleId),
    ]);

    const employees = empRes.data || [];
    const reviews = reviewsRes.data || [];
    const sentSummaryIds = new Set((summariesRes.data || []).map((s: any) => s.reviewee_id));

    // Fetch all scores for these reviews
    const reviewIds = reviews.map(r => r.id);
    let allScores: any[] = [];
    if (reviewIds.length > 0) {
      const { data: scoresData } = await supabase
        .from('performance_review_scores')
        .select('*')
        .in('review_id', reviewIds);
      allScores = scoresData || [];
    }

    // Aggregate per employee
    const result: EmployeeReviewData[] = employees.map(emp => {
      const empReviews = reviews.filter(r => r.reviewee_id === emp.id);
      const empScores = allScores.filter(s => empReviews.some(r => r.id === s.review_id));

      // Avg weighted score
      let avgScore: number | null = null;
      if (empReviews.length > 0) {
        const reviewAvgs = empReviews.map(r => {
          const scores = empScores.filter(s => s.review_id === r.id);
          if (scores.length === 0) return null;
          let tw = 0, ws = 0;
          scores.forEach((s: any) => {
            const cat = categories.find(c => c.id === s.category_id);
            const w = cat?.weight || 1;
            tw += w; ws += s.score * w;
          });
          return tw > 0 ? ws / tw : null;
        }).filter(Boolean) as number[];
        if (reviewAvgs.length > 0) avgScore = reviewAvgs.reduce((a, b) => a + b, 0) / reviewAvgs.length;
      }

      // Avg goal rate
      const goalRates = empReviews.filter(r => r.goal_achievement_rate != null).map(r => r.goal_achievement_rate as number);
      const avgGoalRate = goalRates.length > 0 ? Math.round(goalRates.reduce((a, b) => a + b, 0) / goalRates.length) : null;

      // Most frequent grade
      const grades = empReviews.filter(r => r.overall_grade).map(r => r.overall_grade as string);
      let mostFreqGrade: string | null = null;
      if (grades.length > 0) {
        const freq: Record<string, number> = {};
        grades.forEach(g => { freq[g] = (freq[g] || 0) + 1; });
        mostFreqGrade = Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
      }

      // Category avg scores
      const categoryScores = categories.map(cat => {
        const catScores = empScores.filter((s: any) => s.category_id === cat.id);
        const avg = catScores.length > 0 ? catScores.reduce((sum: number, s: any) => sum + s.score, 0) / catScores.length : 0;
        return { name: cat.name, avg: Math.round(avg * 10) / 10 };
      });

      // Aggregated text
      const strengths = empReviews.filter(r => r.strengths).map(r => r.strengths as string);
      const improvements = empReviews.filter(r => r.improvements).map(r => r.improvements as string);
      const generalComments = empReviews.filter(r => r.general_comment).map(r => r.general_comment as string);

      return {
        ...emp,
        reviewCount: empReviews.length,
        avgScore,
        avgGoalRate,
        mostFreqGrade,
        categoryScores,
        strengths,
        improvements,
        generalComments,
        hasSummary: sentSummaryIds.has(emp.id),
      };
    });

    // Sort: employees with reviews first
    result.sort((a, b) => b.reviewCount - a.reviewCount);
    setEmployeeData(result);
    setLoading(false);
  };

  const openSendDialog = (emp: EmployeeReviewData) => {
    setSendGrade(emp.mostFreqGrade || '');
    setSendStrengths(summarizeStructuredFeedback(
      emp.strengths,
      '선택형 강점 피드백이 부족합니다. 관리자 확인 후 요약을 작성해주세요.',
    ));
    setSendImprovements(summarizeStructuredFeedback(
      emp.improvements,
      '선택형 개선 피드백이 부족합니다. 관리자 확인 후 요약을 작성해주세요.',
    ));
    setSendComment(summarizeStructuredFeedback(
      emp.generalComments,
      '개별 평가 문장은 익명성 보호를 위해 자동 전달하지 않습니다. 선택형 피드백과 점수를 기준으로 관리자 요약을 작성해주세요.',
    ));
    setShowSendDialog(true);
  };

  const handleSendSummary = async () => {
    if (!selectedEmployee || !user || !profile) return;
    setSending(true);
    try {
      // Upsert summary
      const { error: sumError } = await supabase
        .from('performance_review_summaries' as any)
        .upsert({
          cycle_id: selectedCycleId,
          reviewee_id: selectedEmployee.id,
          reviewee_name: selectedEmployee.full_name,
          sent_by: user.id,
          sent_by_name: profile.full_name || profile.email,
          overall_grade: sendGrade || null,
          avg_score: selectedEmployee.avgScore,
          avg_goal_rate: selectedEmployee.avgGoalRate,
          category_scores: selectedEmployee.categoryScores,
          strengths_summary: sendStrengths || null,
          improvements_summary: sendImprovements || null,
          general_comment: sendComment || null,
          sent_at: new Date().toISOString(),
        }, { onConflict: 'cycle_id,reviewee_id' });

      if (sumError) throw sumError;

      // Send notification
      const cycleTitle = cycles.find(c => c.id === selectedCycleId)?.title || '';
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: selectedEmployee.id,
          type: 'performance_review_summary',
          title: '업무평가서가 도착했습니다',
          description: `${cycleTitle} 업무 평가 결과가 발송되었습니다.`,
          data: { cycleId: selectedCycleId, cycleTitle },
        });

      if (notifError) console.error('Notification error:', notifError);

      toast.success(`${selectedEmployee.full_name}님에게 평가서가 발송되었습니다.`);
      setShowSendDialog(false);
      // Update hasSummary flag
      setEmployeeData(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, hasSummary: true } : e));
    } catch (e: any) {
      toast.error('발송 실패: ' + (e.message || ''));
    } finally {
      setSending(false);
    }
  };

  const selectedStrengthSummary = selectedEmployee
    ? summarizeStructuredFeedback(selectedEmployee.strengths, '선택형 강점 피드백이 아직 없습니다.')
    : '';
  const selectedImprovementSummary = selectedEmployee
    ? summarizeStructuredFeedback(selectedEmployee.improvements, '선택형 개선 피드백이 아직 없습니다.')
    : '';

  const filteredEmployees = employeeData.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) ||
      (e.department && e.department.toLowerCase().includes(s));
  });

  const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--primary) / 0.8)', 'hsl(var(--primary) / 0.6)', 'hsl(var(--primary) / 0.4)'];
  const selectedCycle = cycles.find(c => c.id === selectedCycleId);
  const reviewedEmployeeCount = employeeData.filter(e => e.reviewCount > 0).length;
  const sentSummaryCount = employeeData.filter(e => e.hasSummary).length;
  const scoredEmployees = employeeData.filter(e => e.avgScore !== null);
  const averageScore = scoredEmployees.length
    ? scoredEmployees.reduce((sum, e) => sum + (e.avgScore || 0), 0) / scoredEmployees.length
    : null;
  const reviewRate = employeeData.length ? Math.round((reviewedEmployeeCount / employeeData.length) * 100) : 0;

  if (loading && cycles.length === 0) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border bg-card/95 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-semibold">관리자 대시보드</p>
              <p className="mt-1 text-xs text-muted-foreground">
                평가 현황, 점수 분포, 직원별 전달 상태를 한 화면에서 확인합니다.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedCycleId} onValueChange={v => { setSelectedCycleId(v); setSelectedEmployee(null); }}>
                <SelectTrigger className="h-10 w-full rounded-xl text-sm sm:w-64">
                  <SelectValue placeholder="평가 주기 선택" />
                </SelectTrigger>
                <SelectContent>
                  {cycles.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedCycle && (
                <Badge variant="secondary" className="h-9 rounded-full px-3 text-xs">
                  {selectedCycle.status === 'active' ? '진행중' : selectedCycle.status === 'closed' ? '종료' : '대기'}
                </Badge>
              )}
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="h-4 w-4" /> 대상 직원
              </div>
              <p className="mt-2 text-2xl font-semibold">{employeeData.length}</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ClipboardCheck className="h-4 w-4" /> 평가 작성
              </div>
              <p className="mt-2 text-2xl font-semibold">{reviewedEmployeeCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">{reviewRate}% 진행</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Award className="h-4 w-4" /> 평균 점수
              </div>
              <p className="mt-2 text-2xl font-semibold">{averageScore !== null ? averageScore.toFixed(1) : '-'}</p>
            </div>
            <div className="rounded-2xl border bg-background p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Send className="h-4 w-4" /> 결과 발송
              </div>
              <p className="mt-2 text-2xl font-semibold">{sentSummaryCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedEmployee ? (
        /* Employee Detail View */
        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <Button variant="outline" size="sm" onClick={() => setSelectedEmployee(null)} className="shrink-0 rounded-xl">
              <ArrowLeft className="h-4 w-4 mr-1" /> 목록으로
            </Button>
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {selectedEmployee.avatar_url ? (
                  <ProfileAvatarImage src={selectedEmployee.avatar_url} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-base truncate">{selectedEmployee.full_name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[selectedEmployee.department, selectedEmployee.position].filter(Boolean).join(' · ') || '부서 정보 없음'}
                </div>
              </div>
            </div>
            {selectedEmployee.hasSummary && (
              <Badge variant="secondary" className="w-fit rounded-full text-xs gap-1">
                <CheckCircle className="h-3 w-3" /> 발송 완료
              </Badge>
            )}
          </div>

          {/* Stats cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">평가 건수</p>
                <p className="text-2xl font-bold">{selectedEmployee.reviewCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">평균 점수</p>
                <p className="text-2xl font-bold">{selectedEmployee.avgScore?.toFixed(1) ?? '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">목표 달성률</p>
                <p className="text-2xl font-bold">{selectedEmployee.avgGoalRate !== null ? `${selectedEmployee.avgGoalRate}%` : '-'}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">최빈 등급</p>
                <p className="text-2xl font-bold">
                  {selectedEmployee.mostFreqGrade ? (
                    <span className={`px-2 py-0.5 rounded border text-lg ${gradeColor(selectedEmployee.mostFreqGrade)}`}>{selectedEmployee.mostFreqGrade}</span>
                  ) : '-'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Category Score Chart */}
          {selectedEmployee.reviewCount > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">항목별 평균 점수</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={selectedEmployee.categoryScores} layout="vertical" margin={{ left: 80, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 10]} tickCount={6} />
                    <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(val: number) => val.toFixed(1)} />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                      {selectedEmployee.categoryScores.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Structured Feedback Summary */}
          {selectedEmployee.reviewCount > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />선택형 강점 요약</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm bg-muted/50 p-3 rounded border whitespace-pre-line">{selectedStrengthSummary}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5"><MessageSquare className="h-4 w-4" />선택형 개선점 요약</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm bg-muted/50 p-3 rounded border whitespace-pre-line">{selectedImprovementSummary}</p>
                  </CardContent>
                </Card>
              </div>
              <div className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                개별 평가 원문은 문체 노출을 막기 위해 자동 표시하지 않습니다. 직원 전달 전에는 선택형 피드백과 점수 분포를 기준으로 공식 요약만 작성해주세요.
              </div>
            </div>
          )}

          {/* Send button */}
          <div className="flex justify-end">
            <Button onClick={() => openSendDialog(selectedEmployee)} disabled={selectedEmployee.reviewCount === 0} className="gap-1.5">
              <Send className="h-4 w-4" />
              {selectedEmployee.hasSummary ? '평가서 재발송' : '평가서 발송'}
            </Button>
          </div>
        </div>
      ) : (
        /* Employee List */
        <div className="space-y-3">
          <div className="rounded-2xl border bg-card p-3 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="이름, 부서로 검색..." value={search} onChange={e => setSearch(e.target.value)} className="h-11 rounded-xl pl-9 text-sm" />
            </div>
          </div>

          {filteredEmployees.length === 0 && !loading ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">검색 결과가 없습니다.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {filteredEmployees.map(emp => (
                <Card
                  key={emp.id}
                  className="cursor-pointer border bg-card transition-all hover:border-primary/40 hover:shadow-sm"
                  onClick={() => setSelectedEmployee(emp)}
                >
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        {emp.avatar_url ? (
                          <ProfileAvatarImage src={emp.avatar_url} className="w-11 h-11 rounded-full object-cover" />
                        ) : (
                          <User className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{emp.full_name}</span>
                          {emp.department && <Badge variant="secondary" className="rounded-full text-xs">{emp.department}</Badge>}
                          {emp.hasSummary && <Badge variant="outline" className="rounded-full text-xs gap-1"><CheckCircle className="h-2.5 w-2.5" />발송완료</Badge>}
                        </div>
                        {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">평가</p>
                        <p className="text-sm font-bold">{emp.reviewCount}</p>
                      </div>
                      {emp.avgScore !== null && (
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">점수</p>
                          <p className="text-sm font-bold flex items-center gap-0.5"><Star className="h-3 w-3" />{emp.avgScore.toFixed(1)}</p>
                        </div>
                      )}
                      {emp.mostFreqGrade && (
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColor(emp.mostFreqGrade)}`}>
                          {emp.mostFreqGrade}
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Send Summary Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              {selectedEmployee?.full_name} 평가서 발송
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] px-6 pb-6">
            <div className="space-y-4 pt-4">
              <p className="text-xs text-muted-foreground">아래 내용을 수정한 뒤 발송하세요. 직원의 마이페이지에서 확인됩니다.</p>

              <div>
                <Label className="text-xs text-muted-foreground">종합 등급</Label>
                <div className="flex gap-1.5 mt-1.5">
                  {['S', 'A', 'B', 'C', 'D'].map(g => (
                    <button
                      key={g}
                      onClick={() => setSendGrade(g)}
                      className={`w-10 h-9 rounded-lg text-sm font-bold border-2 transition-all ${sendGrade === g ? gradeColor(g) + ' ring-2 ring-offset-1 ring-primary/30' : 'border-muted bg-muted/30 text-muted-foreground hover:bg-muted'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-xs text-muted-foreground">강점 요약</Label>
                <Textarea value={sendStrengths} onChange={e => setSendStrengths(e.target.value)} rows={4} className="mt-1 text-sm resize-none" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">개선점 요약</Label>
                <Textarea value={sendImprovements} onChange={e => setSendImprovements(e.target.value)} rows={4} className="mt-1 text-sm resize-none" />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground">종합 의견</Label>
                <Textarea value={sendComment} onChange={e => setSendComment(e.target.value)} rows={4} className="mt-1 text-sm resize-none" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowSendDialog(false)}>취소</Button>
                <Button size="sm" className="gap-1.5" onClick={handleSendSummary} disabled={sending}>
                  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  발송하기
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminReviewDashboard;
