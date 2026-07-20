import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingDown, TrendingUp, FileSpreadsheet, Building2 } from 'lucide-react';
import { formatPrice } from '@/utils/priceCalculations';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths } from 'date-fns';
import { ko } from 'date-fns/locale';
import { isFinalCompletedProjectStage, normalizeProjectStage } from '@/utils/quoteWorkflow';
import { getQuoteLostReasonLabel } from '@/utils/quoteLossReason';

const STAGE_LABELS: Record<string, string> = {
  reviewing: '검토중',
  quote_issued: '견적 발행',
  revision_requested: '수정요청',
  on_hold: '보류',
  contracted: '수주',
  invoice_issued: '계산서 발행',
  in_progress: '진행중',
  panel_ordered: '원판발주',
  manufacturing: '제작중',
  completed: '제작완료',
  delivery_scheduled: '납기 예정',
  delivered: '납기 완료',
  cancelled: '수주 실패/취소',
};

const STAGE_COLORS: Record<string, string> = {
  reviewing: '#f59e0b',
  quote_issued: '#3b82f6',
  revision_requested: '#8b5cf6',
  on_hold: '#71717a',
  contracted: '#10b981',
  invoice_issued: '#6366f1',
  in_progress: '#f59e0b',
  panel_ordered: '#f97316',
  manufacturing: '#a855f7',
  completed: '#10b981',
  delivery_scheduled: '#0ea5e9',
  delivered: '#16a34a',
  cancelled: '#ef4444',
};

const QuoteStatisticsCard: React.FC = () => {
  const { user, isAdmin } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['quote-statistics', isAdmin],
    queryFn: async () => {
      // Fetch all quotes for statistics
      const sixMonthsAgo = subMonths(new Date(), 6).toISOString();
      let query = supabase
        .from('saved_quotes')
        .select('id, quote_date, total, project_stage, quote_status, recipient_company, lost_reason_category, lost_recorded_at')
        .gte('quote_date', sixMonthsAgo);

      if (!isAdmin) {
        query = query.eq('user_id', user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  if (!stats || stats.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            견적 통계
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-4">데이터가 없습니다</p>
        </CardContent>
      </Card>
    );
  }

  // Monthly stats
  const monthlyData: Record<string, { month: string; amount: number; count: number }> = {};
  for (let i = 5; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    const key = format(d, 'yyyy-MM');
    const label = format(d, 'M월', { locale: ko });
    monthlyData[key] = { month: label, amount: 0, count: 0 };
  }

  stats.forEach((q) => {
    const key = q.quote_date.substring(0, 7);
    if (monthlyData[key]) {
      monthlyData[key].amount += Number(q.total) || 0;
      monthlyData[key].count += 1;
    }
  });

  const chartData = Object.values(monthlyData);

  // Stage distribution
  const stageCounts: Record<string, number> = {};
  stats.forEach((q) => {
    const stage = normalizeProjectStage(q.project_stage, (q as any).quote_status);
    stageCounts[stage] = (stageCounts[stage] || 0) + 1;
  });

  const pieData = Object.entries(stageCounts).map(([stage, count]) => ({
    name: STAGE_LABELS[stage] || stage,
    value: count,
    color: STAGE_COLORS[stage] || '#94a3b8',
  }));

  // Top clients
  const clientAmounts: Record<string, number> = {};
  stats.filter((q) => isFinalCompletedProjectStage(q.project_stage)).forEach((q) => {
    const name = q.recipient_company || '미지정';
    clientAmounts[name] = (clientAmounts[name] || 0) + Number(q.total || 0);
  });
  const topClients = Object.entries(clientAmounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const lostQuotes = stats.filter((q) => normalizeProjectStage(q.project_stage, (q as any).quote_status) === 'cancelled');
  const lostAmount = lostQuotes.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const lossRate = stats.length > 0 ? Math.round((lostQuotes.length / stats.length) * 100) : 0;
  const missingLostReasonCount = lostQuotes.filter((q) => !(q as any).lost_reason_category).length;
  const lostReasonCounts = lostQuotes.reduce<Record<string, number>>((acc, quote) => {
    const reason = (quote as any).lost_reason_category || 'missing';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {});
  const topLostReasons = Object.entries(lostReasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  // Summary numbers
  const totalAmount = stats.reduce((sum, q) => sum + (Number(q.total) || 0), 0);
  const completedCount = stats.filter((q) => isFinalCompletedProjectStage(q.project_stage)).length;
  const conversionRate = stats.length > 0 ? Math.round((completedCount / stats.length) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          견적 통계 <span className="text-[10px] text-muted-foreground font-normal">(최근 6개월)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <FileSpreadsheet className="w-4 h-4 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{stats.length}</p>
            <p className="text-[10px] text-muted-foreground">총 견적</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <TrendingUp className="w-4 h-4 mx-auto mb-1 text-emerald-600" />
            <p className="text-lg font-bold">{conversionRate}%</p>
            <p className="text-[10px] text-muted-foreground">전환율</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <Building2 className="w-4 h-4 mx-auto mb-1 text-blue-600" />
            <p className="text-lg font-bold">{Object.keys(clientAmounts).length}</p>
            <p className="text-[10px] text-muted-foreground">거래처</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <TrendingDown className="w-4 h-4 mx-auto mb-1 text-red-600" />
            <p className="text-lg font-bold">{lossRate}%</p>
            <p className="text-[10px] text-muted-foreground">실패율</p>
          </div>
        </div>

        {/* Monthly chart */}
        <div>
          <p className="text-xs font-medium mb-2">월별 견적 금액</p>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={chartData}>
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 10000)}만`} width={35} />
              <Tooltip
                formatter={(value: number) => [`${formatPrice(value)}원`, '금액']}
                labelFormatter={(label) => label}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stage distribution */}
        <div>
          <p className="text-xs font-medium mb-2">상태별 분포</p>
          <div className="flex items-center gap-3">
            <ResponsiveContainer width={90} height={90}>
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                  {pieData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-1">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-[10px]">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top clients */}
        {topClients.length > 0 && (
          <div>
            <p className="text-xs font-medium mb-2">상위 거래처</p>
            <div className="space-y-1">
              {topClients.map(([name, amount], idx) => (
                <div key={name} className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 shrink-0">{idx + 1}</Badge>
                  <span className="flex-1 truncate">{name}</span>
                  <span className="text-muted-foreground">{formatPrice(amount)}원</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {lostQuotes.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-medium">수주 실패 원인</p>
              <Badge variant="outline" className="rounded-full text-[10px]">
                {lostQuotes.length}건 · {formatPrice(lostAmount)}
              </Badge>
            </div>
            <div className="space-y-1">
              {topLostReasons.map(([reason, count]) => (
                <div key={reason} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">
                    {reason === 'missing' ? '원인 미입력' : getQuoteLostReasonLabel(reason)}
                  </span>
                  <span className="font-semibold tabular-nums">{count}건</span>
                </div>
              ))}
              {missingLostReasonCount > 0 && (
                <p className="pt-1 text-[10px] text-red-600">
                  원인 미입력 {missingLostReasonCount}건은 견적 상세에서 보완하세요.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteStatisticsCard;
