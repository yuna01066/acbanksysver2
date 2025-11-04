import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface SlotType {
  id: string;
  slot_key: string;
  label: string;
  title: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  allow_multiple_selection?: boolean;
  show_quantity_control?: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useSlotTypes = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 모든 슬롯 타입 조회
  const { data: slotTypes, isLoading } = useQuery({
    queryKey: ['slot-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slot_types')
        .select('*')
        .order('slot_key', { ascending: true });

      if (error) throw error;
      return data as SlotType[];
    },
  });

  // 활성화된 슬롯 타입만 조회
  const { data: activeSlotTypes } = useQuery({
    queryKey: ['slot-types', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('slot_types')
        .select('*')
        .eq('is_active', true)
        .order('slot_key', { ascending: true });

      if (error) throw error;
      return data as SlotType[];
    },
  });

  // 슬롯 타입 업데이트
  const updateSlotType = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SlotType> }) => {
      const { data, error } = await supabase
        .from('slot_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      toast({
        title: '저장 완료',
        description: '슬롯 타입이 업데이트되었습니다.',
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

  // 슬롯 타입 생성
  const createSlotType = useMutation({
    mutationFn: async (newSlotType: Omit<SlotType, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('slot_types')
        .insert(newSlotType)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      toast({
        title: '생성 완료',
        description: '새 슬롯 타입이 추가되었습니다.',
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

  // 슬롯 타입 삭제
  const deleteSlotType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('slot_types')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['slot-types'] });
      toast({
        title: '삭제 완료',
        description: '슬롯 타입이 삭제되었습니다.',
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
    slotTypes,
    activeSlotTypes,
    isLoading,
    updateSlotType,
    createSlotType,
    deleteSlotType,
  };
};
