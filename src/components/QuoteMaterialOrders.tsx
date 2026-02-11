import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Package } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import MaterialOrderCard, { MaterialOrderData } from '@/components/MaterialOrderCard';

interface Props {
  quoteId: string;
}

const QuoteMaterialOrders: React.FC<Props> = ({ quoteId }) => {
  const { data: orders = [] } = useQuery({
    queryKey: ['quote-material-orders', quoteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_orders')
        .select('*, projects(id, name), saved_quotes(id, quote_number, project_name)')
        .eq('quote_id', quoteId)
        .order('order_date', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        projects: d.projects ? { id: d.projects.id, project_name: d.projects.name } : null,
        saved_quotes: d.saved_quotes || null,
      })) as MaterialOrderData[];
    },
  });

  if (orders.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Package className="w-4 h-4" />
          원판 발주 ({orders.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {orders.map(order => (
          <MaterialOrderCard
            key={order.id}
            order={order}
            compact
            showDate
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default QuoteMaterialOrders;
