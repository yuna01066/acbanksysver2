import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Package, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const LinkMaterialOrderDialog: React.FC<Props> = ({ open, onOpenChange, projectId }) => {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['unlinked-material-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_orders')
        .select('id, material, thickness, size_name, quantity, order_date, status, user_name, project_id, quote_id')
        .is('project_id', null)
        .order('order_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const linkOrder = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from('material_orders')
        .update({ project_id: projectId })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-material-orders', projectId] });
      queryClient.invalidateQueries({ queryKey: ['unlinked-material-orders'] });
      toast.success('원판 발주가 연결되었습니다.');
    },
    onError: () => toast.error('연결에 실패했습니다.'),
  });

  const filtered = orders.filter((o: any) => {
    const term = search.toLowerCase();
    return (
      o.material?.toLowerCase().includes(term) ||
      o.size_name?.toLowerCase().includes(term) ||
      o.user_name?.toLowerCase().includes(term)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>원판 발주 연결</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="소재, 사이즈, 담당자로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">다른 프로젝트에 연결되지 않은 발주만 표시됩니다.</p>
        <div className="max-h-[300px] overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">연결 가능한 발주가 없습니다.</p>
            </div>
          ) : (
            filtered.map((o: any) => (
              <div
                key={o.id}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-accent transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {o.material} · {o.thickness} · {o.size_name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {o.quantity}매 · {o.user_name} · {format(new Date(o.order_date), 'yy.MM.dd', { locale: ko })}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1 shrink-0"
                  onClick={() => linkOrder.mutate(o.id)}
                  disabled={linkOrder.isPending}
                >
                  <Check className="h-3 w-3" /> 연결
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkMaterialOrderDialog;
