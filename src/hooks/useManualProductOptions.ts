import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface PanelMaster {
  id: string;
  name: string;
  quality: string;
}

export const useManualProductOptions = () => {
  const { data: materials } = useQuery({
    queryKey: ['manual-product-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('id, name, quality')
        .order('name');
      if (error) throw error;
      return data as PanelMaster[];
    },
  });

  const { data: thicknessMap } = useQuery({
    queryKey: ['manual-product-thicknesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('panel_master_id, thickness')
        .order('thickness');
      if (error) throw error;
      const map: Record<string, string[]> = {};
      for (const row of data) {
        if (!map[row.panel_master_id]) map[row.panel_master_id] = [];
        if (!map[row.panel_master_id].includes(row.thickness)) {
          map[row.panel_master_id].push(row.thickness);
        }
      }
      // Sort numerically
      for (const key of Object.keys(map)) {
        map[key].sort((a, b) => parseFloat(a.replace('T', '')) - parseFloat(b.replace('T', '')));
      }
      return map;
    },
  });

  const { data: colorMap } = useQuery({
    queryKey: ['manual-product-colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_options')
        .select('panel_master_id, color_name, color_code')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      const map: Record<string, { name: string; code: string | null }[]> = {};
      for (const row of data) {
        if (!map[row.panel_master_id]) map[row.panel_master_id] = [];
        map[row.panel_master_id].push({ name: row.color_name, code: row.color_code });
      }
      return map;
    },
  });

  return {
    materials: materials || [],
    thicknessMap: thicknessMap || {},
    colorMap: colorMap || {},
  };
};
