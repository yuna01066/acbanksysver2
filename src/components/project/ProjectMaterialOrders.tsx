import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Package } from 'lucide-react';
import MaterialOrderCard, { MaterialOrderData } from '@/components/MaterialOrderCard';

interface Props {
  projectId: string;
}

const ProjectMaterialOrders: React.FC<Props> = ({ projectId }) => {
  const navigate = useNavigate();

  const { data: orders = [] } = useQuery({
    queryKey: ['project-material-orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_orders')
        .select('*, projects(id, name), saved_quotes(id, quote_number, project_name)')
        .eq('project_id', projectId)
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
    <div className="rounded-lg border bg-card p-3.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Package className="h-3 w-3" />
          원판 발주 ({orders.length})
        </span>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {orders.map(order => (
          <MaterialOrderCard
            key={order.id}
            order={order}
            compact
            showDate
          />
        ))}
      </div>
    </div>
  );
};

export default ProjectMaterialOrders;
