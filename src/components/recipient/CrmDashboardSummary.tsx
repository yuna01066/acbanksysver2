import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, FileText, TrendingUp, Users } from 'lucide-react';
import { formatPrice } from '@/utils/priceCalculations';

const CrmDashboardSummary: React.FC = () => {
  const { data: stats } = useQuery({
    queryKey: ['crm-dashboard-stats'],
    queryFn: async () => {
      const [recipientsRes, quotesRes] = await Promise.all([
        supabase.from('recipients').select('id', { count: 'exact', head: true }),
        supabase.from('saved_quotes').select('id, total, recipient_company'),
      ]);

      const totalRecipients = recipientsRes.count || 0;
      const quotes = quotesRes.data || [];
      const totalQuotes = quotes.length;
      const totalRevenue = quotes.reduce((sum, q) => sum + (q.total || 0), 0);
      const uniqueCompanies = new Set(quotes.map(q => q.recipient_company).filter(Boolean));
      const activeClients = uniqueCompanies.size;

      return { totalRecipients, totalQuotes, totalRevenue, activeClients };
    },
  });

  const cards = [
    { label: '전체 고객사', value: stats?.totalRecipients || 0, icon: Building2, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '거래 고객사', value: stats?.activeClients || 0, icon: Users, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: '총 견적 건수', value: stats?.totalQuotes || 0, icon: FileText, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: '총 견적 금액', value: formatPrice(stats?.totalRevenue || 0), icon: TrendingUp, color: 'text-amber-500', bg: 'bg-amber-500/10', isPrice: true },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-none shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center shrink-0`}>
                <c.icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{c.label}</p>
                <p className={`font-bold ${c.isPrice ? 'text-sm' : 'text-lg'}`}>{c.value}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CrmDashboardSummary;
