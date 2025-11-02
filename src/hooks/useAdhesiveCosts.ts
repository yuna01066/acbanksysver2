import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface AdhesiveCost {
  id: string;
  panel_master_id: string;
  thickness: string;
  cost: number;
}

export const useAdhesiveCosts = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 모든 접착 비용 조회
  const { data: adhesiveCosts, isLoading } = useQuery({
    queryKey: ['adhesive-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('adhesive_costs')
        .select(`
          *,
          panel_masters (
            name,
            material,
            quality
          )
        `)
        .order('thickness', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // 접착 비용 업데이트
  const updateCost = useMutation({
    mutationFn: async ({ id, cost }: { id: string; cost: number }) => {
      const { data, error } = await supabase
        .from('adhesive_costs')
        .update({ cost })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adhesive-costs'] });
      toast({
        title: '저장 완료',
        description: '접착 비용이 업데이트되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        title: '저장 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 접착 비용 생성
  const createCost = useMutation({
    mutationFn: async (newCost: { panel_master_id: string; thickness: string; cost: number }) => {
      const { data, error } = await supabase
        .from('adhesive_costs')
        .insert(newCost)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adhesive-costs'] });
      toast({
        title: '생성 완료',
        description: '새 접착 비용이 추가되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        title: '생성 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // 접착 비용 삭제
  const deleteCost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('adhesive_costs')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adhesive-costs'] });
      toast({
        title: '삭제 완료',
        description: '접착 비용이 삭제되었습니다.',
      });
    },
    onError: (error) => {
      toast({
        title: '삭제 실패',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    adhesiveCosts,
    isLoading,
    updateCost,
    createCost,
    deleteCost,
  };
};
