import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { glossyColorSinglePrices, glossyStandardSinglePrices, astelColorSinglePrices, satinColorSinglePrices } from '@/data/glossyColorPricing';
import { toast } from 'sonner';

export interface CutItem {
  id: string;
  width: string;
  height: string;
  quantity: string;
}

export interface YieldResult {
  panelSize: string;
  panelWidth: number;
  panelHeight: number;
  piecesPerPanel: number;
  panelsNeeded: number;
  totalPieces: number;
  efficiency: number;
  wasteArea: number;
  surplus: number;
  offcut?: {
    largestReusableRect: { width: number; height: number; area: number };
    scrapArea: number;
    reusableArea: number;
  };
  score?: number;
}

interface PanelSize {
  name: string;
  width: number;
  height: number;
  available: boolean;
}

export const getPriceDataByQuality = (qualityId: string) => {
  switch (qualityId) {
    case 'glossy-color': return glossyColorSinglePrices;
    case 'glossy-standard': return glossyStandardSinglePrices;
    case 'astel-color': return astelColorSinglePrices;
    case 'satin-color': return satinColorSinglePrices;
    default: return glossyColorSinglePrices;
  }
};

// ---- Preset hooks ----
export const useYieldPresets = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['yield-presets', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yield_cut_presets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const savePreset = useMutation({
    mutationFn: async ({ name, cutItems }: { name: string; cutItems: CutItem[] }) => {
      if (!user) throw new Error('로그인 필요');
      const { error } = await supabase.from('yield_cut_presets').insert({
        user_id: user.id,
        name,
        cut_items: cutItems as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yield-presets'] });
      toast.success('프리셋이 저장되었습니다.');
    },
    onError: () => toast.error('프리셋 저장에 실패했습니다.'),
  });

  const deletePreset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('yield_cut_presets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yield-presets'] });
      toast.success('프리셋이 삭제되었습니다.');
    },
    onError: () => toast.error('프리셋 삭제에 실패했습니다.'),
  });

  return { presets, isLoading, savePreset, deletePreset };
};

// ---- History hooks ----
export const useYieldHistory = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['yield-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('yield_calculation_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const saveHistory = useMutation({
    mutationFn: async (params: {
      quality: string;
      thickness: string;
      cutItems: CutItem[];
      results: YieldResult[];
      combinations: any[];
      bestEfficiency: number;
      totalPanelsNeeded: number;
    }) => {
      if (!user) throw new Error('로그인 필요');
      const { error } = await supabase.from('yield_calculation_history').insert({
        user_id: user.id,
        user_name: profile?.full_name || user.email || '',
        quality: params.quality,
        thickness: params.thickness,
        cut_items: params.cutItems as any,
        results: params.results as any,
        combinations: params.combinations as any,
        best_efficiency: params.bestEfficiency,
        total_panels_needed: params.totalPanelsNeeded,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yield-history'] });
    },
  });

  const deleteHistory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('yield_calculation_history').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['yield-history'] });
      toast.success('이력이 삭제되었습니다.');
    },
  });

  return { history, isLoading, saveHistory, deleteHistory };
};

// ---- Available panel sizes logic ----
export const useAvailablePanelSizes = (selectedQuality: string, selectedThickness: string) => {
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-yield', selectedQuality],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', selectedQuality as any)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!selectedQuality,
  });

  const { data: activePanelSizesFromDB } = useQuery({
    queryKey: ['active-panel-sizes-yield', panelMaster?.id, selectedThickness],
    queryFn: async () => {
      if (!panelMaster?.id || !selectedThickness) return [];
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', panelMaster.id)
        .eq('thickness', selectedThickness)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!panelMaster?.id && !!selectedThickness,
  });

  const { data: activePanelThicknessesFromDB } = useQuery({
    queryKey: ['active-panel-thicknesses-yield', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('thickness')
        .eq('panel_master_id', panelMaster.id)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!panelMaster?.id,
  });

  const availablePanelSizes = useMemo(() => {
    const getSizeByThickness = (baseW: number, baseH: number) => {
      const t = parseFloat(selectedThickness?.replace('T', '') || '0');
      if (t >= 1.3 && t < 10) return { width: baseW + 20, height: baseH + 20 };
      if (t >= 10 && t <= 20) return { width: baseW, height: baseH };
      if (t > 20 && t <= 30) return { width: baseW - 50, height: baseH - 50 };
      return { width: baseW, height: baseH };
    };

    const baseSizeMapping: Record<string, { width: number; height: number }> = {
      '3*6': { width: 860, height: 1750 },
      '대3*6': { width: 900, height: 1800 },
      '4*5': { width: 1120, height: 1425 },
      '대4*5': { width: 1200, height: 1500 },
      '1*2': { width: 1000, height: 2000 },
      '4*6': { width: 1200, height: 1800 },
      '4*8': { width: 1200, height: 2400 },
      '4*10': { width: 1200, height: 3000 },
      '5*6': { width: 1500, height: 1800 },
      '5*8': { width: 1500, height: 2400 },
    };

    const getFallbackSizeInfo = (sizeStr: string) => {
      const baseInfo = baseSizeMapping[sizeStr];
      if (baseInfo) return getSizeByThickness(baseInfo.width, baseInfo.height);

      const parts = sizeStr.replace(/[소대]/g, '').split('*');
      return {
        width: Number.parseFloat(parts[0]) * 1000 || 0,
        height: Number.parseFloat(parts[1]) * 1000 || 0,
      };
    };

    if (activePanelSizesFromDB && activePanelSizesFromDB.length > 0) {
      return activePanelSizesFromDB
        .map(ps => {
          const fallback = getFallbackSizeInfo(ps.size_name);
          return {
            name: ps.size_name,
            width: ps.actual_width || fallback.width,
            height: ps.actual_height || fallback.height,
            available: true,
          };
        })
        .filter(panel => panel.width > 0 && panel.height > 0)
        .sort((a, b) => a.width * a.height - b.width * b.height);
    }

    const priceData = getPriceDataByQuality(selectedQuality);
    const allSizes = new Set<string>();
    Object.values(priceData).forEach(thicknessData => {
      Object.keys(thicknessData).forEach(size => allSizes.add(size));
    });

    const panelSizes: PanelSize[] = Array.from(allSizes).map(sizeStr => {
      const sizeInfo = getFallbackSizeInfo(sizeStr);
      const { width, height } = sizeInfo;
      const isAvailable = priceData[selectedThickness] && priceData[selectedThickness][sizeStr];
      return { name: sizeStr, width, height, available: !!isAvailable };
    }).filter(p => p.available);

    return panelSizes.sort((a, b) => a.width * a.height - b.width * b.height);
  }, [selectedThickness, selectedQuality, activePanelSizesFromDB]);

  const availableThicknesses = useMemo(() => {
    if (activePanelThicknessesFromDB && activePanelThicknessesFromDB.length > 0) {
      return Array.from(new Set(activePanelThicknessesFromDB.map(row => row.thickness).filter(Boolean)))
        .sort((a, b) => parseFloat(a) - parseFloat(b));
    }

    const priceData = getPriceDataByQuality(selectedQuality);
    return Object.keys(priceData).sort((a, b) => parseFloat(a) - parseFloat(b));
  }, [selectedQuality, activePanelThicknessesFromDB]);

  return { availablePanelSizes, availableThicknesses };
};
