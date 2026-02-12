import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface TaxInvoiceMonthlyChartProps {
  direction: 'sales' | 'purchase';
}

const TaxInvoiceMonthlyChart: React.FC<TaxInvoiceMonthlyChartProps> = ({ direction }) => {
  const { data: chartData = [] } = useQuery({
    queryKey: ['tax-invoice-monthly-chart', direction],
    queryFn: async () => {
      const months: { month: string; label: string; start: string; end: string }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = subMonths(new Date(), i);
        const start = format(startOfMonth(d), 'yyyy-MM-dd');
        const end = format(new Date(d.getFullYear(), d.getMonth() + 1, 0), 'yyyy-MM-dd');
        months.push({
          month: format(d, 'yyyy-MM'),
          label: format(d, 'M월', { locale: ko }),
          start,
          end,
        });
      }

      const results = [];
      for (const m of months) {
        const { data } = await supabase
          .from('tax_invoices')
          .select('supply_cost_total, tax_total, total_amount, status')
          .eq('invoice_direction', direction)
          .gte('write_date', m.start)
          .lte('write_date', m.end)
          .neq('status', 'cancelled');

        const items = data || [];
        results.push({
          name: m.label,
          건수: items.length,
          공급가액: items.reduce((s, i) => s + (i.supply_cost_total || 0), 0),
          세액: items.reduce((s, i) => s + (i.tax_total || 0), 0),
          합계: items.reduce((s, i) => s + (i.total_amount || 0), 0),
        });
      }
      return results;
    },
  });

  const formatAmount = (value: number) => {
    if (value >= 100000000) return `${(value / 100000000).toFixed(1)}억`;
    if (value >= 10000) return `${(value / 10000).toFixed(0)}만`;
    return value.toLocaleString();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          월별 {direction === 'sales' ? '매출' : '매입'} 추이 (최근 6개월)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatAmount} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toLocaleString()}원`} />
              <Legend />
              <Bar dataKey="공급가액" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="세액" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TaxInvoiceMonthlyChart;
