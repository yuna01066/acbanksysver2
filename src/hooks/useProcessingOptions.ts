import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ProcessingOption {
  id: string;
  option_type: 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'additional';
  category: 'raw' | 'simple' | 'complex' | 'full' | 'adhesion' | 'additional';
  option_id: string;
  name: string;
  description?: string;
  multiplier?: number;
  base_cost?: number;
  is_active: boolean;
  display_order: number;
}

export const useProcessingOptions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 모든 가공 옵션 조회
  const { data: processingOptions, isLoading } = useQuery({
    queryKey: ['processing-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_options')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ProcessingOption[];
    },
  });

  // 활성화된 추가 옵션만 조회
  const { data: activeAdditionalOptions } = useQuery({
    queryKey: ['processing-options', 'additional', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_options')
        .select('*')
        .eq('option_type', 'additional')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ProcessingOption[];
    },
  });

  // 가공 옵션 업데이트
  const updateOption = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ProcessingOption> }) => {
      const { data, error } = await supabase
        .from('processing_options')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing-options'] });
      toast({
        title: '저장 완료',
        description: '가공 옵션이 업데이트되었습니다.',
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

  // 가공 옵션 생성
  const createOption = useMutation({
    mutationFn: async (newOption: Omit<ProcessingOption, 'id'>) => {
      const { data, error } = await supabase
        .from('processing_options')
        .insert(newOption)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing-options'] });
      toast({
        title: '생성 완료',
        description: '새 가공 옵션이 추가되었습니다.',
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

  // 가공 옵션 삭제
  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('processing_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing-options'] });
      toast({
        title: '삭제 완료',
        description: '가공 옵션이 삭제되었습니다.',
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
    processingOptions,
    activeAdditionalOptions,
    isLoading,
    updateOption,
    createOption,
    deleteOption,
  };
};
