import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface CategoryLogicSlot {
  id: string;
  category: string;
  slot_key: string;
  slot_order: number;
  created_at?: string;
  updated_at?: string;
}

export const useCategoryLogic = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 모든 카테고리 로직 조회
  const { data: categoryLogic, isLoading } = useQuery({
    queryKey: ['category-logic'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('category_logic_slots')
        .select('*')
        .order('category', { ascending: true })
        .order('slot_order', { ascending: true });

      if (error) throw error;
      return data as CategoryLogicSlot[];
    },
  });

  // 특정 카테고리의 로직 조회
  const getCategorySlots = (category: string) => {
    return categoryLogic?.filter(slot => slot.category === category) || [];
  };

  // 카테고리 로직 저장 (기존 것 삭제 후 새로 삽입)
  const saveCategoryLogic = useMutation({
    mutationFn: async ({ category, slots }: { category: string; slots: { slotKey: string }[] }) => {
      // 1. 해당 카테고리의 기존 로직 삭제
      const { error: deleteError } = await supabase
        .from('category_logic_slots')
        .delete()
        .eq('category', category);

      if (deleteError) throw deleteError;

      // 2. 새 로직이 있으면 삽입
      if (slots.length > 0) {
        const newSlots = slots.map((slot, index) => ({
          category,
          slot_key: slot.slotKey,
          slot_order: index,
        }));

        const { error: insertError } = await supabase
          .from('category_logic_slots')
          .insert(newSlots);

        if (insertError) throw insertError;
      }

      return { category, slots };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['category-logic'] });
      toast({
        title: '저장 완료',
        description: '카테고리 로직이 저장되었습니다.',
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

  return {
    categoryLogic,
    isLoading,
    getCategorySlots,
    saveCategoryLogic,
  };
};
