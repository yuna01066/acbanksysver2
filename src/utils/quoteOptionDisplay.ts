const PANEL_SIZE_PATTERN = /(?:대?3\*6|4\*5|4\*6|4\*8|4\*10|5\*6|5\*8)/i;

export const isPanelStockSummaryValue = (value?: string | null) => {
  const normalized = (value || '').trim();
  if (!normalized) return false;

  return PANEL_SIZE_PATTERN.test(normalized) && /\(\d+\s*개\)/.test(normalized);
};

export const isPanelSurfaceSummaryValue = (value?: string | null) => {
  const normalized = (value || '').trim();
  if (!normalized) return false;

  return PANEL_SIZE_PATTERN.test(normalized) && /:\s*(단면|양면)/.test(normalized);
};
