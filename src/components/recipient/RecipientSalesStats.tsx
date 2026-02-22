import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import { formatPrice } from '@/utils/priceCalculations';

interface Props {
  companyName: string;
}

const RecipientSalesStats: React.FC<Props> = ({ companyName }) => {
  const { data: stats } = useQuery({
    queryKey: ['recipient-sales-stats', companyName],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, total, quote_date, project_stage')
        .eq('recipient_company', companyName);
      if (error) throw error;

      const quotes = data || [];
      const totalAmount = quotes.reduce((s, q) => s + (q.total || 0), 0);
      const avgAmount = quotes.length > 0 ? totalAmount / quotes.length : 0;
      const contractedQuotes = quotes.filter(q => ['contracted', 'completed', 'delivered'].includes(q.project_stage || ''));
      const contractedAmount = contractedQuotes.reduce((s, q) => s + (q.total || 0), 0);
      const conversionRate = quotes.length > 0 ? (contractedQuotes.length / quotes.length * 100) : 0;

      // Monthly breakdown (last 6 months)
      const now = new Date();
      const monthly: { month: string; amount: number; count: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = `${d.getMonth() + 1}월`;
        const monthQuotes = quotes.filter(q => q.quote_date?.startsWith(key));
        monthly.push({ month: label, amount: monthQuotes.reduce((s, q) => s + (q.total || 0), 0), count: monthQuotes.length });
      }

      return { totalQuotes: quotes.length, totalAmount, avgAmount, contractedAmount, conversionRate, monthly };
    },
  });

  const maxAmount = Math.max(...(stats?.monthly.map(m => m.amount) || [1]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          매출 통계
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">총 견적 금액</p>
            <p className="text-sm font-bold mt-0.5">{formatPrice(stats?.totalAmount || 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">수주 금액</p>
            <p className="text-sm font-bold mt-0.5">{formatPrice(stats?.contractedAmount || 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">평균 견적 단가</p>
            <p className="text-sm font-bold mt-0.5">{formatPrice(stats?.avgAmount || 0)}</p>
          </div>
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground">수주 전환율</p>
            <p className="text-sm font-bold mt-0.5">{(stats?.conversionRate || 0).toFixed(1)}%</p>
          </div>
        </div>

        {/* Simple bar chart */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">월별 견적 추이 (최근 6개월)</p>
          <div className="flex items-end gap-1.5 h-24">
            {stats?.monthly.map((m) => (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full relative" style={{ height: '80px' }}>
                  <div
                    className="absolute bottom-0 w-full bg-primary/20 rounded-t transition-all"
                    style={{ height: maxAmount > 0 ? `${(m.amount / maxAmount) * 100}%` : '0%', minHeight: m.amount > 0 ? '4px' : '0px' }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RecipientSalesStats;
