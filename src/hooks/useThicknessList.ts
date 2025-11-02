import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const useThicknessList = () => {
  const { data: thicknessList, isLoading } = useQuery({
    queryKey: ['thickness-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('thickness')
        .order('thickness', { ascending: true });

      if (error) throw error;
      
      // 중복 제거하고 정렬
      const uniqueThicknesses = [...new Set(data.map(item => item.thickness))];
      return uniqueThicknesses;
    },
  });

  return {
    thicknessList: thicknessList || [],
    isLoading,
  };
};
