import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Package, Users, FileSpreadsheet, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, subYears } from 'date-fns';
import { ko } from 'date-fns/locale';
import { formatPrice } from '@/utils/priceCalculations';

type PeriodType = '6m' | '12m' | 'ytd';

const BusinessDashboard: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<PeriodType>('6m');

  const rangeStart = useMemo(() => {
    const now = new Date();
    if (period === '6m') return subMonths(now, 6);
    if (period === '12m') return subMonths(now, 12);
    return startOfYear(now);
  }, [period]);

  // Fetch completed quotes (revenue)
  const { data: quotes } = useQuery({
    queryKey: ['biz-quotes', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_quotes')
        .select('id, quote_date, total, project_stage, recipient_company, user_id, issuer_name')
        .gte('quote_date', rangeStart.toISOString());
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch project expenses (internal_project_documents)
  const { data: expenses } = useQuery({
    queryKey: ['biz-expenses', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('internal_project_documents')
        .select('id, total, purchase_date, is_paid, vendor_name, project_id, document_type')
        .gte('created_at', rangeStart.toISOString());
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch material orders
  const { data: orders } = useQuery({
    queryKey: ['biz-orders', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('material_orders')
        .select('id, order_date, status, user_name, quantity')
        .gte('order_date', rangeStart.toISOString().split('T')[0]);
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch profiles for KPI
  const { data: profiles } = useQuery({
    queryKey: ['biz-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name').eq('is_approved', true);
      return data || [];
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const completedQuotes = useMemo(() => quotes?.filter(q => q.project_stage === 'completed') || [], [quotes]);
  const allQuotes = quotes || [];
  const allExpenses = expenses || [];
  const allOrders = orders || [];

  // ── Monthly revenue & expense data ──
  const monthlyData = useMemo(() => {
    const months: Record<string, { month: string; key: string; revenue: number; expense: number; quoteCount: number }> = {};
    const monthCount = period === '6m' ? 6 : period === '12m' ? 12 : new Date().getMonth() + 1;

    for (let i = monthCount - 1; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const key = format(d, 'yyyy-MM');
      months[key] = { month: format(d, 'M월', { locale: ko }), key, revenue: 0, expense: 0, quoteCount: 0 };
    }

    completedQuotes.forEach(q => {
      const key = q.quote_date?.substring(0, 7);
      if (key && months[key]) {
        months[key].revenue += Number(q.total) || 0;
        months[key].quoteCount += 1;
      }
    });

    allExpenses.forEach(e => {
      const key = e.purchase_date ? e.purchase_date.substring(0, 7) : '';
      if (key && months[key]) {
        months[key].expense += Number(e.total) || 0;
      }
    });

    return Object.values(months);
  }, [completedQuotes, allExpenses, period]);

  // ── Summary KPIs ──
  const totalRevenue = completedQuotes.reduce((s, q) => s + (Number(q.total) || 0), 0);
  const totalExpense = allExpenses.reduce((s, e) => s + (Number(e.total) || 0), 0);
  const profit = totalRevenue - totalExpense;
  const profitMargin = totalRevenue > 0 ? Math.round((profit / totalRevenue) * 100) : 0;
  const conversionRate = allQuotes.length > 0 ? Math.round((completedQuotes.length / allQuotes.length) * 100) : 0;

  // Previous period comparison
  const prevStart = useMemo(() => {
    const months = period === '6m' ? 6 : period === '12m' ? 12 : new Date().getMonth() + 1;
    return subMonths(rangeStart, months);
  }, [rangeStart, period]);

  // ── Per-person KPI ──
  const personKpi = useMemo(() => {
    const map: Record<string, { name: string; quoteCount: number; completedCount: number; revenue: number; orderCount: number }> = {};

    allQuotes.forEach(q => {
      const name = q.issuer_name || '미지정';
      if (!map[name]) map[name] = { name, quoteCount: 0, completedCount: 0, revenue: 0, orderCount: 0 };
      map[name].quoteCount += 1;
      if (q.project_stage === 'completed') {
        map[name].completedCount += 1;
        map[name].revenue += Number(q.total) || 0;
      }
    });

    allOrders.forEach(o => {
      const name = o.user_name || '미지정';
      if (!map[name]) map[name] = { name, quoteCount: 0, completedCount: 0, revenue: 0, orderCount: 0 };
      map[name].orderCount += 1;
    });

    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [allQuotes, allOrders]);

  // ── Expense by vendor ──
  const vendorExpense = useMemo(() => {
    const map: Record<string, number> = {};
    allExpenses.forEach(e => {
      const name = e.vendor_name || '미지정';
      map[name] = (map[name] || 0) + (Number(e.total) || 0);
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [allExpenses]);

  // ── Unpaid expenses ──
  const unpaidTotal = allExpenses.filter(e => !e.is_paid).reduce((s, e) => s + (Number(e.total) || 0), 0);

  const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6', '#f97316'];

  const kpiCards = [
    { label: '매출 (제작완료)', value: formatPrice(totalRevenue) + '원', icon: DollarSign, color: 'text-emerald-600', bgColor: 'bg-emerald-500/10' },
    { label: '비용 (지출)', value: formatPrice(totalExpense) + '원', icon: TrendingDown, color: 'text-red-500', bgColor: 'bg-red-500/10' },
    { label: '영업이익', value: formatPrice(profit) + '원', icon: profit >= 0 ? TrendingUp : TrendingDown, color: profit >= 0 ? 'text-emerald-600' : 'text-red-500', bgColor: profit >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10' },
    { label: '전환율', value: `${conversionRate}%`, icon: FileSpreadsheet, color: 'text-blue-600', bgColor: 'bg-blue-500/10' },
  ];

  if (!quotes) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">데이터를 불러오는 중...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          경영 대시보드
        </h2>
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
          <SelectTrigger className="w-[130px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="6m">최근 6개월</SelectItem>
            <SelectItem value="12m">최근 12개월</SelectItem>
            <SelectItem value="ytd">올해</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map(kpi => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-7 h-7 rounded-lg ${kpi.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{kpi.label}</span>
                </div>
                <p className="text-sm font-bold">{kpi.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Additional mini KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{allQuotes.length}</p>
            <p className="text-[10px] text-muted-foreground">총 견적</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{completedQuotes.length}</p>
            <p className="text-[10px] text-muted-foreground">제작완료</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-red-500">{formatPrice(unpaidTotal)}원</p>
            <p className="text-[10px] text-muted-foreground">미결제 비용</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="revenue" className="text-xs">매출·비용</TabsTrigger>
          <TabsTrigger value="kpi" className="text-xs">담당자 KPI</TabsTrigger>
          <TabsTrigger value="expense" className="text-xs">비용 분석</TabsTrigger>
        </TabsList>

        {/* Revenue & Expense Chart */}
        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">월별 매출 vs 비용</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 10000)}만`} width={40} />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${formatPrice(value)}원`,
                      name === 'revenue' ? '매출' : '비용',
                    ]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Legend formatter={(v) => (v === 'revenue' ? '매출' : '비용')} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="revenue" />
                  <Bar dataKey="expense" fill="#ef4444" radius={[3, 3, 0, 0]} name="expense" opacity={0.7} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">월별 영업이익 추이</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyData.map(m => ({ ...m, profit: m.revenue - m.expense }))}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 10000)}만`} width={40} />
                  <Tooltip
                    formatter={(value: number) => [`${formatPrice(value)}원`, '영업이익']}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Line type="monotone" dataKey="profit" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Person KPI */}
        <TabsContent value="kpi" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">담당자별 매출 기여</CardTitle>
            </CardHeader>
            <CardContent>
              {personKpi.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(180, personKpi.length * 40)}>
                  <BarChart data={personKpi} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={(v) => `${Math.round(v / 10000)}만`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={60} />
                    <Tooltip
                      formatter={(value: number) => [`${formatPrice(value)}원`, '매출']}
                      contentStyle={{ fontSize: 11 }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-4">데이터가 없습니다</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">담당자별 상세 KPI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium text-muted-foreground">담당자</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">견적 수</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">완료</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">전환율</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">매출</th>
                      <th className="text-right py-2 font-medium text-muted-foreground">발주</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personKpi.map(p => (
                      <tr key={p.name} className="border-b last:border-0">
                        <td className="py-2 font-medium">{p.name}</td>
                        <td className="text-right py-2">{p.quoteCount}</td>
                        <td className="text-right py-2">{p.completedCount}</td>
                        <td className="text-right py-2">
                          <Badge variant={p.quoteCount > 0 && (p.completedCount / p.quoteCount) >= 0.5 ? 'default' : 'secondary'} className="text-[9px] px-1.5">
                            {p.quoteCount > 0 ? Math.round((p.completedCount / p.quoteCount) * 100) : 0}%
                          </Badge>
                        </td>
                        <td className="text-right py-2">{formatPrice(p.revenue)}원</td>
                        <td className="text-right py-2">{p.orderCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Expense Analysis */}
        <TabsContent value="expense" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">거래처별 비용</CardTitle>
              </CardHeader>
              <CardContent>
                {vendorExpense.length > 0 ? (
                  <div className="flex items-center gap-4">
                    <ResponsiveContainer width={120} height={120}>
                      <PieChart>
                        <Pie data={vendorExpense.map(([name, amount]) => ({ name, value: amount }))} dataKey="value" cx="50%" cy="50%" outerRadius={55} innerRadius={30}>
                          {vendorExpense.map((_, idx) => (
                            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex-1 space-y-1.5">
                      {vendorExpense.map(([name, amount], idx) => (
                        <div key={name} className="flex items-center gap-1.5 text-[10px]">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="flex-1 truncate">{name}</span>
                          <span className="font-medium">{formatPrice(amount)}원</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">비용 데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">결제 현황</CardTitle>
              </CardHeader>
              <CardContent>
                {allExpenses.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">결제 완료</span>
                        <span className="text-xs font-medium text-emerald-600">
                          {formatPrice(totalExpense - unpaidTotal)}원
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-emerald-500 h-2 rounded-full transition-all"
                          style={{ width: `${totalExpense > 0 ? ((totalExpense - unpaidTotal) / totalExpense) * 100 : 0}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground">미결제</span>
                        <span className="text-xs font-medium text-red-500">
                          {formatPrice(unpaidTotal)}원
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold">{allExpenses.filter(e => e.is_paid).length}</p>
                        <p className="text-[10px] text-muted-foreground">결제 건</p>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/50">
                        <p className="text-lg font-bold">{allExpenses.filter(e => !e.is_paid).length}</p>
                        <p className="text-[10px] text-muted-foreground">미결제 건</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">비용 데이터가 없습니다</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default BusinessDashboard;
