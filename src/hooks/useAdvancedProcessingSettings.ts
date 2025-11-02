import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdvancedProcessingSetting {
  id: string;
  setting_key: string;
  setting_value: number;
  display_name: string;
  description: string | null;
  unit: string | null;
  is_active: boolean;
}

export const useAdvancedProcessingSettings = () => {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['advanced-processing-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('advanced_processing_settings')
        .select('*')
        .eq('is_active', true)
        .order('setting_key');
      
      if (error) throw error;
      return data as AdvancedProcessingSetting[];
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AdvancedProcessingSetting> }) => {
      const { data, error } = await supabase
        .from('advanced_processing_settings')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['advanced-processing-settings'] });
    },
  });

  const getSettingValue = (key: string): number => {
    const setting = settings?.find(s => s.setting_key === key);
    return setting?.setting_value || 0;
  };

  return {
    settings,
    isLoading,
    updateSetting,
    getSettingValue,
  };
};
