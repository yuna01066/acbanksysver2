import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CASTING_QUALITIES } from '@/types/calculator';
import {
  DEFAULT_PANEL_SIZE_COMPARISON_VISUAL,
  PANEL_SIZE_COMPARISON_QUALITY_ORDER,
  PANEL_SIZE_COMPARISON_VISUALS,
  type PanelSizeComparisonDashboardSummary,
  type PanelSizeComparisonItem,
  type PanelSizeComparisonQualitySummary,
} from '@/types/panelSizeComparison';

type PanelMasterRow = {
  id: string;
  material: string;
  quality: string;
  name: string;
};

type PanelSizeRow = {
  id: string;
  panel_master_id: string;
  thickness: string;
  size_name: string;
  actual_width: number;
  actual_height: number;
  price: number | null;
  is_active: boolean | null;
};

const qualityNameLookup = new Map(CASTING_QUALITIES.map((quality) => [quality.id, quality.name]));

export function sortPanelThicknesses(thicknesses: string[]) {
  return Array.from(new Set(thicknesses.filter(Boolean))).sort((a, b) => {
    const numericA = Number.parseFloat(a);
    const numericB = Number.parseFloat(b);
    if (Number.isFinite(numericA) && Number.isFinite(numericB) && numericA !== numericB) {
      return numericA - numericB;
    }
    return a.localeCompare(b, 'ko');
  });
}

export function getPanelQualityVisual(quality: string) {
  return PANEL_SIZE_COMPARISON_VISUALS[quality] || {
    ...DEFAULT_PANEL_SIZE_COMPARISON_VISUAL,
    label: quality,
    shortLabel: quality,
  };
}

export function getPanelQualitySortIndex(quality: string) {
  const explicitIndex = PANEL_SIZE_COMPARISON_QUALITY_ORDER.indexOf(quality);
  if (explicitIndex >= 0) return explicitIndex;
  return getPanelQualityVisual(quality).order;
}

export function sortPanelSizeComparisonItems(items: PanelSizeComparisonItem[]) {
  return [...items].sort((a, b) => {
    const qualityDiff = getPanelQualitySortIndex(a.quality) - getPanelQualitySortIndex(b.quality);
    if (qualityDiff !== 0) return qualityDiff;
    if (a.area !== b.area) return a.area - b.area;
    return a.sizeName.localeCompare(b.sizeName, 'ko');
  });
}

export function getLargestPanelSizeByQuality(items: PanelSizeComparisonItem[]) {
  const byQuality = new Map<string, PanelSizeComparisonItem>();

  for (const item of items) {
    const current = byQuality.get(item.quality);
    if (!current || item.area > current.area) {
      byQuality.set(item.quality, item);
    }
  }

  return sortPanelSizeComparisonItems(Array.from(byQuality.values()));
}

export function getPanelComparisonDashboardSummary(
  items: PanelSizeComparisonItem[],
  defaultThickness = '3T'
): PanelSizeComparisonDashboardSummary {
  const availableThicknesses = sortPanelThicknesses(items.map((item) => item.thickness));
  const selectedThickness = availableThicknesses.includes(defaultThickness)
    ? defaultThickness
    : availableThicknesses[0] || defaultThickness;
  const selectedItems = items.filter((item) => item.thickness === selectedThickness);
  const largestItem = selectedItems.reduce<PanelSizeComparisonItem | null>((largest, item) => {
    if (!largest || item.area > largest.area) return item;
    return largest;
  }, null);

  return {
    selectedThickness,
    availableThicknesses,
    activeQualityCount: new Set(selectedItems.map((item) => item.quality)).size,
    activeSizeCount: selectedItems.length,
    maxWidth: largestItem?.width || 0,
    maxHeight: largestItem?.height || 0,
    missingPriceCount: selectedItems.filter((item) => !item.price || item.price <= 0).length,
  };
}

function summarizeQualities(items: PanelSizeComparisonItem[]): PanelSizeComparisonQualitySummary[] {
  const grouped = new Map<string, PanelSizeComparisonItem[]>();

  for (const item of items) {
    grouped.set(item.quality, [...(grouped.get(item.quality) || []), item]);
  }

  return Array.from(grouped.entries())
    .map(([quality, qualityItems]) => {
      const first = qualityItems[0];

      return {
        quality,
        qualityName: first.qualityName,
        material: first.material,
        activeSizeCount: qualityItems.length,
        thicknesses: sortPanelThicknesses(qualityItems.map((item) => item.thickness)),
        sizeNames: Array.from(new Set(qualityItems.map((item) => item.sizeName))).sort((a, b) => a.localeCompare(b, 'ko')),
        maxWidth: Math.max(...qualityItems.map((item) => item.width)),
        maxHeight: Math.max(...qualityItems.map((item) => item.height)),
      };
    })
    .sort((a, b) => {
      const qualityDiff = getPanelQualitySortIndex(a.quality) - getPanelQualitySortIndex(b.quality);
      if (qualityDiff !== 0) return qualityDiff;
      return a.qualityName.localeCompare(b.qualityName, 'ko');
    });
}

export function usePanelSizeComparisonData() {
  const query = useQuery({
    queryKey: ['panel-size-comparison-data'],
    queryFn: async () => {
      const [mastersResult, sizesResult] = await Promise.all([
        supabase
          .from('panel_masters')
          .select('id, material, quality, name'),
        supabase
          .from('panel_sizes')
          .select('id, panel_master_id, thickness, size_name, actual_width, actual_height, price, is_active')
          .eq('is_active', true),
      ]);

      if (mastersResult.error) throw mastersResult.error;
      if (sizesResult.error) throw sizesResult.error;

      const masters = (mastersResult.data || []) as PanelMasterRow[];
      const sizes = (sizesResult.data || []) as PanelSizeRow[];
      const masterById = new Map(masters.map((master) => [master.id, master]));

      const items = sortPanelSizeComparisonItems(
        sizes
          .map((size): PanelSizeComparisonItem | null => {
            const master = masterById.get(size.panel_master_id);
            const width = Number(size.actual_width);
            const height = Number(size.actual_height);

            if (!master || size.is_active !== true || width <= 0 || height <= 0) {
              return null;
            }

            const visual = getPanelQualityVisual(master.quality);
            const qualityName = qualityNameLookup.get(master.quality) || master.name || visual.label;

            return {
              id: size.id,
              panelMasterId: master.id,
              material: master.material,
              quality: master.quality,
              qualityName,
              thickness: size.thickness,
              sizeName: size.size_name,
              width,
              height,
              area: width * height,
              price: typeof size.price === 'number' ? size.price : null,
              isActive: true,
            };
          })
          .filter((item): item is PanelSizeComparisonItem => item !== null)
      );

      return {
        items,
        qualitySummaries: summarizeQualities(items),
        thicknesses: sortPanelThicknesses(items.map((item) => item.thickness)),
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    ...query,
    items: query.data?.items || [],
    qualitySummaries: query.data?.qualitySummaries || [],
    thicknesses: query.data?.thicknesses || [],
  };
}
