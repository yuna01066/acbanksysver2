import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PanelCatalogQuality {
  id: string;
  material: string;
  quality: string;
  name: string;
}

export interface PanelCatalogSize {
  id: string;
  panel_master_id: string;
  size_name: string;
  thickness: string;
  actual_width: number;
  actual_height: number;
  price: number | null;
  pricing_version_id: string | null;
  is_active: boolean | null;
}

export interface PanelCatalogColor {
  id: string;
  panel_master_id: string;
  color_name: string;
  color_code: string | null;
  series_key: string | null;
  is_active: boolean;
  is_producible: boolean | null;
  is_bright_pigment: boolean | null;
}

export interface PanelCatalogSurcharge {
  id: string;
  quality_id: string;
  surcharge_type: string;
  size_name: string;
  cost: number;
  is_active: boolean;
}

export const usePanelCatalog = () => {
  const qualities = useQuery({
    queryKey: ['panel-catalog', 'qualities'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('id, material, quality, name')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as PanelCatalogQuality[];
    },
  });

  const sizes = useQuery({
    queryKey: ['panel-catalog', 'sizes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('id, panel_master_id, size_name, thickness, actual_width, actual_height, price, pricing_version_id, is_active')
        .order('thickness', { ascending: true })
        .order('size_name', { ascending: true });
      if (error) throw error;
      return (data || []) as PanelCatalogSize[];
    },
  });

  const colors = useQuery({
    queryKey: ['panel-catalog', 'colors'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_options')
        .select('id, panel_master_id, color_name, color_code, series_key, is_active, is_producible, is_bright_pigment')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as PanelCatalogColor[];
    },
  });

  const surcharges = useQuery({
    queryKey: ['panel-catalog', 'surcharges'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_option_surcharges')
        .select('id, quality_id, surcharge_type, size_name, cost, is_active')
        .order('surcharge_type', { ascending: true });
      if (error) throw error;
      return (data || []) as PanelCatalogSurcharge[];
    },
  });

  return {
    qualities: qualities.data || [],
    sizes: sizes.data || [],
    colors: colors.data || [],
    surcharges: surcharges.data || [],
    isLoading: qualities.isLoading || sizes.isLoading || colors.isLoading || surcharges.isLoading,
    error: qualities.error || sizes.error || colors.error || surcharges.error,
  };
};
