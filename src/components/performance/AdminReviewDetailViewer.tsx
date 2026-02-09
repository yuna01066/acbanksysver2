import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Loader2, User, Star, Target, TrendingUp, MessageSquare, ChevronDown, ChevronUp, Search, ArrowLeft, AlertTriangle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

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
  description: string | null;
}

interface Review {
  id: string;
  reviewer_id: string;
  reviewer_name: string;
  reviewer_type: string;
  reviewee_id: string;
  reviewee_name: string;
  overall_grade: string | null;
  goal_achievement_rate: number | null;
  strengths: string | null;
  improvements: string | null;
  general_comment: string | null;
  status: string;
  created_at: string;
  scores?: { category_id: string; score: number; comment: string | null }[];
}

interface Employee {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url: string | null;
}

const REVIEWER_TYPES: Record<string, string> = {
  self: '자기 평가',
  superior: '상급자 평가',
  peer: '동료 평가',
  subordinate: '하급자 평가',
};

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

interface Props {
  initialEmployeeId?: string;
}

const AdminReviewDetailViewer: React.FC<Props> = ({ initialEmployeeId }) => {
  const { isAdmin, isModerator } = useAuth();
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [categories, setCategories] = useState<ReviewCategory[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(initialEmployeeId || '');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [expandedReview, setExpandedReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedCycleId && selectedEmployeeId) {
      fetchReviews();
      // Fetch incident report count for this employee
      supabase.from('incident_reports').select('id', { count: 'exact', head: true })
        .eq('user_id', selectedEmployeeId)
        .in('status', ['submitted', 'reviewed'])
        .then(({ count }) => setIncidentCount(count || 0));
    } else {
      setReviews([]);
      setIncidentCount(0);
    }
  }, [selectedCycleId, selectedEmployeeId]);

  const fetchInitialData = async () => {
    setLoading(true);
    const [cyclesRes, catsRes, empRes] = await Promise.all([
      supabase.from('performance_review_cycles').select('*').order('year', { ascending: false }).order('quarter', { ascending: false }),
      supabase.from('performance_review_categories').select('*').eq('is_active', true).order('display_order'),
      supabase.from('profiles').select('id, full_name, department, position, avatar_url').eq('is_approved', true).order('full_name'),
    ]);
    if (cyclesRes.data) {
      setCycles(cyclesRes.data as ReviewCycle[]);
      if (cyclesRes.data.length > 0) setSelectedCycleId(cyclesRes.data[0].id);
    }
    if (catsRes.data) setCategories(catsRes.data as ReviewCategory[]);
    if (empRes.data) setEmployees(empRes.data as Employee[]);
    setLoading(false);
  };

  const fetchReviews = async () => {
    setReviewsLoading(true);
    const { data: reviewsData } = await supabase
      .from('performance_reviews')
      .select('*')
      .eq('reviewee_id', selectedEmployeeId)
      .eq('cycle_id', selectedCycleId)
      .order('created_at', { ascending: false });

    if (reviewsData && reviewsData.length > 0) {
      const reviewIds = reviewsData.map(r => r.id);
      const { data: scoresData } = await supabase
        .from('performance_review_scores')
        .select('*')
        .in('review_id', reviewIds);
      setReviews(reviewsData.map(r => ({
        ...r,
        scores: (scoresData || []).filter(s => s.review_id === r.id),
      })) as Review[]);
    } else {
      setReviews([]);
    }
    setReviewsLoading(false);
  };

  const getWeightedAvg = (scores: { category_id: string; score: number }[]) => {
    if (!scores || scores.length === 0) return null;
    let tw = 0, ws = 0;
    scores.forEach(s => {
      const cat = categories.find(c => c.id === s.category_id);
      const w = cat?.weight || 1;
      tw += w; ws += s.score * w;
    });
    return tw > 0 ? (ws / tw).toFixed(1) : null;
  };

  // Summary stats
  const submitted = reviews.filter(r => r.status === 'submitted');
  const avgScore = (() => {
    const avgs = submitted.map(r => getWeightedAvg(r.scores || [])).filter(Boolean).map(Number);
    return avgs.length > 0 ? (avgs.reduce((a, b) => a + b, 0) / avgs.length).toFixed(1) : null;
  })();
  const avgGoalRate = (() => {
    const rates = submitted.filter(r => r.goal_achievement_rate != null).map(r => r.goal_achievement_rate!);
    return rates.length > 0 ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null;
  })();
  const mostFreqGrade = (() => {
    const grades = submitted.filter(r => r.overall_grade).map(r => r.overall_grade!);
    if (grades.length === 0) return null;
    const freq: Record<string, number> = {};
    grades.forEach(g => { freq[g] = (freq[g] || 0) + 1; });
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  })();
  const categoryAvgScores = categories.map(cat => {
    const scores = submitted.flatMap(r => (r.scores || []).filter(s => s.category_id === cat.id));
    const avg = scores.length > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / scores.length : 0;
    return { name: cat.name, avg: Math.round(avg * 10) / 10 };
  });

  const filteredEmployees = employees.filter(e => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return e.full_name.toLowerCase().includes(s) || (e.department && e.department.toLowerCase().includes(s));
  });

  const selectedEmp = employees.find(e => e.id === selectedEmployeeId);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
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
      </div>

      {/* Employee selection or detail */}
      {!selectedEmployeeId ? (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="이름, 부서로 검색..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {filteredEmployees.map(emp => (
              <Card key={emp.id} className="cursor-pointer hover:border-primary/40 transition-all" onClick={() => setSelectedEmployeeId(emp.id)}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {emp.avatar_url ? <img src={emp.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{emp.full_name}</p>
                    <div className="flex items-center gap-1.5">
                      {emp.department && <Badge variant="secondary" className="text-xs">{emp.department}</Badge>}
                      {emp.position && <span className="text-xs text-muted-foreground">{emp.position}</span>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Employee header */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setSelectedEmployeeId('')}>
              <ArrowLeft className="h-4 w-4 mr-1" /> 직원 목록
            </Button>
            {selectedEmp && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  {selectedEmp.avatar_url ? <img src={selectedEmp.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <span className="font-semibold text-sm">{selectedEmp.full_name}</span>
                {selectedEmp.department && <span className="text-xs text-muted-foreground">{selectedEmp.department}</span>}
              </div>
            )}
          </div>

          {reviewsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <>
              {/* Summary stats */}
              {submitted.length > 0 && (
                <>
                  <div className="grid grid-cols-5 gap-3">
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">평가 건수</p>
                      <p className="text-xl font-bold">{submitted.length}</p>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">평균 점수</p>
                      <p className="text-xl font-bold">{avgScore ?? '-'}</p>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">목표 달성률</p>
                      <p className="text-xl font-bold">{avgGoalRate !== null ? `${avgGoalRate}%` : '-'}</p>
                    </CardContent></Card>
                    <Card><CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground mb-1">최빈 등급</p>
                      <p className="text-xl font-bold">
                        {mostFreqGrade ? <span className={`px-2 py-0.5 rounded border text-lg ${gradeColor(mostFreqGrade)}`}>{mostFreqGrade}</span> : '-'}
                      </p>
                    </CardContent></Card>
                    <Card className={incidentCount > 0 ? 'border-orange-300 dark:border-orange-700' : ''}>
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> 경위서
                        </p>
                        <p className={`text-xl font-bold ${incidentCount > 0 ? 'text-orange-600 dark:text-orange-400' : ''}`}>
                          {incidentCount}건
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Category chart */}
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">항목별 평균 점수</CardTitle></CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={categoryAvgScores} layout="vertical" margin={{ left: 80, right: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" domain={[0, 10]} tickCount={6} />
                          <YAxis type="category" dataKey="name" width={75} tick={{ fontSize: 12 }} />
                          <Tooltip formatter={(val: number) => val.toFixed(1)} />
                          <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                            {categoryAvgScores.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* Individual reviews - full detail with reviewer info */}
              {reviews.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">이 주기에 등록된 평가가 없습니다.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground">개별 평가 내역 ({reviews.length}건)</h3>
                  {reviews.map(review => (
                    <Card key={review.id} className="overflow-hidden">
                      <button
                        className="w-full text-left p-4 hover:bg-accent/30 transition-colors"
                        onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{review.reviewer_name}</span>
                            <Badge variant="outline" className="text-xs">
                              {REVIEWER_TYPES[review.reviewer_type] || review.reviewer_type}
                            </Badge>
                            {review.overall_grade && (
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColor(review.overall_grade)}`}>{review.overall_grade}</span>
                            )}
                            <Badge variant={review.status === 'submitted' ? 'default' : 'secondary'} className="text-xs">
                              {review.status === 'submitted' ? '제출됨' : '임시저장'}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3">
                            {review.goal_achievement_rate !== null && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Target className="h-3 w-3" />{review.goal_achievement_rate}%</span>
                            )}
                            {getWeightedAvg(review.scores || []) && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1"><Star className="h-3 w-3" />{getWeightedAvg(review.scores || [])}</span>
                            )}
                            <span className="text-xs text-muted-foreground">{format(new Date(review.created_at), 'yyyy.MM.dd', { locale: ko })}</span>
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
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReviewDetailViewer;
