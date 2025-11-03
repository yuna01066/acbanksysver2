import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// 두께를 숫자 크기 순으로 정렬하는 함수
const sortThicknesses = (thicknesses: string[]): string[] => {
  return thicknesses.sort((a, b) => {
    // "T" 문자를 제거하고 숫자로 변환하여 비교
    const numA = parseFloat(a.replace('T', ''));
    const numB = parseFloat(b.replace('T', ''));
    return numA - numB;
  });
};

export const useThicknessList = () => {
  const { data: thicknessList, isLoading } = useQuery({
    queryKey: ['thickness-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('thickness')
        .order('thickness', { ascending: true });

      if (error) throw error;
      
      // 중복 제거하고 두께 크기 순으로 정렬
      const uniqueThicknesses = [...new Set(data.map(item => item.thickness))];
      return sortThicknesses(uniqueThicknesses);
    },
  });

  return {
    thicknessList: thicknessList || [],
    isLoading,
  };
};
