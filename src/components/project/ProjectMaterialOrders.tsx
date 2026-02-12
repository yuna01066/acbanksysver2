import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
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

  if (orders.length === 0) {
    return <p className="text-[10px] text-muted-foreground">연결된 발주가 없습니다.</p>;
  }

  return (
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
  );
};

export default ProjectMaterialOrders;
