import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { FileText, CheckCircle2, Send, XCircle, Receipt, TrendingUp, TrendingDown } from 'lucide-react';

interface TaxInvoiceStatsProps {
  invoices: any[];
  direction: 'sales' | 'purchase';
}

const TaxInvoiceStats: React.FC<TaxInvoiceStatsProps> = ({ invoices, direction }) => {
  const stats = useMemo(() => {
    const filtered = invoices.filter(i => i.invoice_direction === direction || (!i.invoice_direction && direction === 'sales'));
    const total = filtered.length;
    const issued = filtered.filter(i => i.status === 'issued').length;
    const nts = filtered.filter(i => ['sent_to_nts', 'nts_accepted'].includes(i.status)).length;
    const cancelled = filtered.filter(i => i.status === 'cancelled').length;
    const draft = filtered.filter(i => i.status === 'draft').length;
    const totalSupply = filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.supply_cost_total || 0), 0);
    const totalTax = filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.tax_total || 0), 0);
    const totalAmount = filtered.filter(i => i.status !== 'cancelled').reduce((s, i) => s + (i.total_amount || 0), 0);
    return { total, issued, nts, cancelled, draft, totalSupply, totalTax, totalAmount };
  }, [invoices, direction]);

  const cards = [
    { label: '전체', value: stats.total, icon: FileText, color: 'text-foreground' },
    { label: '임시저장', value: stats.draft, icon: FileText, color: 'text-muted-foreground' },
    { label: '발행완료', value: stats.issued, icon: CheckCircle2, color: 'text-primary' },
    { label: '국세청전송', value: stats.nts, icon: Send, color: 'text-emerald-600' },
    { label: '취소', value: stats.cancelled, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-3">
        {cards.map((s, i) => (
          <Card key={i} className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <span className="text-xs text-muted-foreground">{s.label}</span>
            </div>
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <span className="text-xs text-muted-foreground">공급가액 합계</span>
          <p className="text-lg font-bold">{stats.totalSupply.toLocaleString()}원</p>
        </Card>
        <Card className="p-3">
          <span className="text-xs text-muted-foreground">세액 합계</span>
          <p className="text-lg font-bold">{stats.totalTax.toLocaleString()}원</p>
        </Card>
        <Card className="p-3">
          <span className="text-xs text-muted-foreground">총 합계</span>
          <p className="text-lg font-bold text-primary">{stats.totalAmount.toLocaleString()}원</p>
        </Card>
      </div>
    </div>
  );
};

export default TaxInvoiceStats;
