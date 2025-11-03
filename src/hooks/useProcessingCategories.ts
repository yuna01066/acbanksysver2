import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProcessingCategory {
  id: string;
  category_key: string;
  category_name: string;
  icon_name: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export const useProcessingCategories = () => {
  const queryClient = useQueryClient();

  const { data: categories, isLoading } = useQuery({
    queryKey: ['processing_categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('processing_categories')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ProcessingCategory[];
    },
  });

  const createCategory = useMutation({
    mutationFn: async (newCategory: Omit<ProcessingCategory, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('processing_categories')
        .insert(newCategory)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing_categories'] });
      toast.success('카테고리가 추가되었습니다.');
    },
    onError: (error: any) => {
      toast.error('카테고리 추가 실패: ' + error.message);
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, updates, silent }: { id: string; updates: Partial<ProcessingCategory>; silent?: boolean }) => {
      const { data, error } = await supabase
        .from('processing_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return { data, silent };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['processing_categories'] });
      if (!result.silent) {
        toast.success('카테고리가 수정되었습니다.');
      }
    },
    onError: (error: any) => {
      toast.error('카테고리 수정 실패: ' + error.message);
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('processing_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processing_categories'] });
      toast.success('카테고리가 삭제되었습니다.');
    },
    onError: (error: any) => {
      toast.error('카테고리 삭제 실패: ' + error.message);
    },
  });

  return {
    categories,
    isLoading,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};
