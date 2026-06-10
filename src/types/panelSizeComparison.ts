export type PanelSizeComparisonViewMode = 'all' | 'largest';

export interface PanelSizeComparisonItem {
  id: string;
  panelMasterId: string;
  material: string;
  quality: string;
  qualityName: string;
  thickness: string;
  sizeName: string;
  width: number;
  height: number;
  area: number;
  price: number | null;
  isActive: true;
}

export interface PanelSizeComparisonQualitySummary {
  quality: string;
  qualityName: string;
  material: string;
  activeSizeCount: number;
  thicknesses: string[];
  sizeNames: string[];
  maxWidth: number;
  maxHeight: number;
}

export interface PanelSizeComparisonDashboardSummary {
  selectedThickness: string;
  availableThicknesses: string[];
  activeQualityCount: number;
  activeSizeCount: number;
  maxWidth: number;
  maxHeight: number;
  missingPriceCount: number;
}

export interface PanelSizeComparisonFilters {
  thickness: string;
  selectedQualities: string[];
  selectedSizeNames: string[];
  opacity: number;
  isPlaying: boolean;
  viewMode: PanelSizeComparisonViewMode;
}

export interface PanelSizeComparisonVisual {
  label: string;
  shortLabel: string;
  fill: string;
  stroke: string;
  surface: string;
  order: number;
}

export const PANEL_SIZE_COMPARISON_QUALITY_ORDER = [
  'glossy-color',
  'bright-color',
  'astel-color',
  'satin-color',
  'acrylic-mirror',
  'astel-mirror',
  'satin-mirror',
  'glossy-standard',
];

export const PANEL_SIZE_COMPARISON_VISUALS: Record<string, PanelSizeComparisonVisual> = {
  'glossy-color': {
    label: 'Clear',
    shortLabel: 'Clear',
    fill: '#14b8a6',
    stroke: '#0f766e',
    surface: '#ccfbf1',
    order: 0,
  },
  'bright-color': {
    label: 'Bright',
    shortLabel: 'Bright',
    fill: '#f59e0b',
    stroke: '#b45309',
    surface: '#fef3c7',
    order: 1,
  },
  'astel-color': {
    label: 'Astel',
    shortLabel: 'Astel',
    fill: '#3b82f6',
    stroke: '#1d4ed8',
    surface: '#dbeafe',
    order: 2,
  },
  'satin-color': {
    label: 'Satin',
    shortLabel: 'Satin',
    fill: '#d946ef',
    stroke: '#a21caf',
    surface: '#fae8ff',
    order: 3,
  },
  'acrylic-mirror': {
    label: 'Mirror',
    shortLabel: 'Mirror',
    fill: '#22c55e',
    stroke: '#15803d',
    surface: '#dcfce7',
    order: 4,
  },
  'astel-mirror': {
    label: 'Astel Mirror',
    shortLabel: 'A.Mirror',
    fill: '#8b5cf6',
    stroke: '#6d28d9',
    surface: '#ede9fe',
    order: 5,
  },
  'satin-mirror': {
    label: 'Satin Mirror',
    shortLabel: 'S.Mirror',
    fill: '#f43f5e',
    stroke: '#be123c',
    surface: '#ffe4e6',
    order: 6,
  },
  'glossy-standard': {
    label: 'Standard',
    shortLabel: 'Std',
    fill: '#64748b',
    stroke: '#334155',
    surface: '#e2e8f0',
    order: 7,
  },
};

export const DEFAULT_PANEL_SIZE_COMPARISON_VISUAL: PanelSizeComparisonVisual = {
  label: 'Panel',
  shortLabel: 'Panel',
  fill: '#64748b',
  stroke: '#334155',
  surface: '#e2e8f0',
  order: 99,
};
