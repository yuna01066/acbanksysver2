import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CASTING_QUALITIES, type Quality } from '@/types/calculator';
import { supabase } from '@/integrations/supabase/client';

export type AcrylicCatalogColorOption = {
  id: string;
  color_name: string;
  color_code: string | null;
  pantone?: string | null;
  series_key?: string | null;
};

export type AcrylicCatalogPanelSize = {
  id?: string;
  size_name: string;
  actual_width?: number | null;
  actual_height?: number | null;
};

const UNKNOWN_OPTION = 'consultation_unknown';

const mirrorFallbackColors: Record<string, AcrylicCatalogColorOption> = {
  'acrylic-mirror': {
    id: 'fallback-acrylic-mirror',
    color_name: 'MIRROR 미러',
    color_code: '#d8dde6',
  },
  'astel-mirror': {
    id: 'fallback-astel-mirror',
    color_name: 'ASTEL-MIRROR 아스텔 미러',
    color_code: '#e4e7ec',
  },
  'satin-mirror': {
    id: 'fallback-satin-mirror',
    color_name: 'SATIN-MIRROR 사틴 미러',
    color_code: '#eef0f3',
  },
};

const formatPanelSizeLabel = (size: AcrylicCatalogPanelSize) => {
  if (size.actual_width && size.actual_height) {
    return `${size.size_name} (${size.actual_width}*${size.actual_height})`;
  }
  return size.size_name;
};

export const CONSULTATION_UNKNOWN_OPTION = UNKNOWN_OPTION;

export function useAcrylicOptionCatalog(qualityId?: string, thickness?: string) {
  const qualities = useMemo(() => CASTING_QUALITIES, []);
  const selectedQuality = useMemo<Quality | null>(
    () => qualities.find((quality) => quality.id === qualityId) || null,
    [qualities, qualityId],
  );
  const lookupQualityId = selectedQuality?.id === 'satin-mirror'
    ? 'glossy-color'
    : selectedQuality?.id;

  const { data: panelMaster } = useQuery({
    queryKey: ['consultation-panel-master', lookupQualityId],
    queryFn: async () => {
      if (!lookupQualityId) return null;
      const { data, error } = await (supabase as any)
        .from('panel_masters')
        .select('id, name, quality')
        .eq('quality', lookupQualityId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; name: string | null; quality: string | null } | null;
    },
    enabled: !!lookupQualityId && lookupQualityId !== UNKNOWN_OPTION,
  });

  const { data: colorOptions = [], isLoading: isLoadingColors } = useQuery({
    queryKey: ['consultation-color-options', panelMaster?.id, selectedQuality?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];
      const { data, error } = await (supabase as any)
        .from('color_options')
        .select('id, color_name, color_code, pantone, series_key')
        .eq('panel_master_id', panelMaster.id)
        .eq('is_active', true)
        .neq('is_producible', false)
        .order('display_order', { ascending: true });
      if (error) throw error;
      const rows = (data || []) as AcrylicCatalogColorOption[];
      if (rows.length > 0) return rows;
      const fallback = selectedQuality?.id ? mirrorFallbackColors[selectedQuality.id] : null;
      return fallback ? [fallback] : [];
    },
    enabled: !!panelMaster?.id,
  });

  const { data: dbPanelSizes = [], isLoading: isLoadingPanelSizes } = useQuery({
    queryKey: ['consultation-panel-sizes', panelMaster?.id, thickness],
    queryFn: async () => {
      if (!panelMaster?.id || !thickness) return [];
      const { data, error } = await (supabase as any)
        .from('panel_sizes')
        .select('id, size_name, actual_width, actual_height')
        .eq('panel_master_id', panelMaster.id)
        .eq('thickness', thickness)
        .eq('is_active', true)
        .order('size_name', { ascending: true });
      if (error) throw error;
      return (data || []) as AcrylicCatalogPanelSize[];
    },
    enabled: !!panelMaster?.id && !!thickness && thickness !== UNKNOWN_OPTION,
  });

  const thicknessOptions = selectedQuality?.thicknesses || [];
  const panelSizeOptions = dbPanelSizes.length > 0
    ? dbPanelSizes.map((size) => ({ value: formatPanelSizeLabel(size), label: formatPanelSizeLabel(size) }))
    : (selectedQuality?.sizes || []).map((size) => ({ value: size, label: size }));

  return {
    qualities,
    selectedQuality,
    colorOptions,
    thicknessOptions,
    panelSizeOptions,
    isLoadingColors,
    isLoadingPanelSizes,
  };
}
