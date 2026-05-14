export interface NumericCutItem {
  width: number;
  height: number;
  quantity: number;
  id: string;
}

export interface PanelSize {
  name: string;
  width: number;
  height: number;
}

export interface PlacedItem {
  x: number;
  y: number;
  width: number;
  height: number;
  rotated: boolean;
  itemId: string;
}

export interface OffcutAnalysis {
  wasteArea: number;
  largestReusableRect: { width: number; height: number; area: number };
  reusableArea: number;
  scrapArea: number;
  fragmentationPenalty: number;
}

export interface PanelPackResult {
  positions: PlacedItem[];
  totalPieces: number;
  canFitAll: boolean;
  placedCounts: Record<string, number>;
  efficiency: number;
  wasteArea: number;
  offcut: OffcutAnalysis;
}

export interface YieldPlanResult {
  piecesPerPanel: number;
  efficiency: number;
  wasteArea: number;
  canFitAll: boolean;
  panelsNeeded: number;
  placedCounts: Record<string, number>;
  offcut: OffcutAnalysis;
  layoutPanels: PanelPackResult[];
  score: number;
}

type Strategy = 'area' | 'long-edge' | 'wide-first' | 'tall-first';

const REUSABLE_MIN_WIDTH = 300;
const REUSABLE_MIN_HEIGHT = 300;
const MAX_PANELS = 50;

export const getYieldSpacing = (selectedThickness?: string) => {
  const thickness = parseFloat(selectedThickness?.replace('T', '') || '0');
  return thickness < 10 ? 6 : 8;
};

const sortItems = (items: NumericCutItem[], strategy: Strategy) => {
  const sorted = items.filter(item => item.quantity > 0).map(item => ({ ...item }));

  sorted.sort((a, b) => {
    if (strategy === 'long-edge') {
      return Math.max(b.width, b.height) - Math.max(a.width, a.height);
    }
    if (strategy === 'wide-first') return b.width - a.width;
    if (strategy === 'tall-first') return b.height - a.height;
    return b.width * b.height - a.width * a.height;
  });

  return sorted;
};

const overlaps = (
  x: number,
  y: number,
  width: number,
  height: number,
  positions: PlacedItem[],
  spacing: number
) => positions.some(pos =>
  !(x >= pos.x + pos.width + spacing ||
    x + width + spacing <= pos.x ||
    y >= pos.y + pos.height + spacing ||
    y + height + spacing <= pos.y)
);

const normalizeCandidate = (point: { x: number; y: number }) => ({
  x: Math.max(0, Math.round(point.x)),
  y: Math.max(0, Math.round(point.y)),
});

const scoreCandidate = (
  x: number,
  y: number,
  width: number,
  height: number,
  panelW: number,
  panelH: number,
  positions: PlacedItem[]
) => {
  const usedRight = Math.max(x + width, ...positions.map(pos => pos.x + pos.width), 0);
  const usedBottom = Math.max(y + height, ...positions.map(pos => pos.y + pos.height), 0);
  const boundingArea = usedRight * usedBottom;
  const rightOffcutArea = Math.max(0, panelW - usedRight) * panelH;
  const bottomOffcutArea = usedRight * Math.max(0, panelH - usedBottom);
  const largestOffcut = Math.max(rightOffcutArea, bottomOffcutArea);

  return (
    boundingArea * 0.001 +
    y * 10 +
    x +
    Math.abs((panelW - usedRight) - (panelH - usedBottom)) * 0.02 -
    largestOffcut * 0.0004
  );
};

export const analyzeOffcuts = (
  positions: PlacedItem[],
  panelW: number,
  panelH: number,
  totalCutArea?: number
): OffcutAnalysis => {
  const placedArea = totalCutArea ?? positions.reduce((sum, pos) => sum + pos.width * pos.height, 0);
  const wasteArea = Math.max(0, panelW * panelH - placedArea);

  if (positions.length === 0) {
    return {
      wasteArea,
      largestReusableRect: { width: panelW, height: panelH, area: panelW * panelH },
      reusableArea: panelW * panelH,
      scrapArea: 0,
      fragmentationPenalty: 0,
    };
  }

  const usedRight = Math.max(...positions.map(pos => pos.x + pos.width));
  const usedBottom = Math.max(...positions.map(pos => pos.y + pos.height));

  const candidates = [
    { width: Math.max(0, panelW - usedRight), height: panelH },
    { width: usedRight, height: Math.max(0, panelH - usedBottom) },
    { width: Math.max(0, panelW - usedRight), height: Math.max(0, panelH - usedBottom) },
  ].map(rect => ({ ...rect, area: rect.width * rect.height }));

  const reusableCandidates = candidates.filter(rect =>
    rect.width >= REUSABLE_MIN_WIDTH && rect.height >= REUSABLE_MIN_HEIGHT
  );
  const largestReusableRect = (reusableCandidates.length > 0 ? reusableCandidates : candidates)
    .sort((a, b) => b.area - a.area)[0] ?? { width: 0, height: 0, area: 0 };
  const reusableArea = reusableCandidates.reduce((sum, rect) => sum + rect.area, 0);
  const scrapArea = Math.max(0, wasteArea - largestReusableRect.area);

  return {
    wasteArea,
    largestReusableRect,
    reusableArea,
    scrapArea,
    fragmentationPenalty: scrapArea + Math.max(0, wasteArea - reusableArea) * 0.5,
  };
};

export const scorePackedPanel = (result: PanelPackResult, panelCount = 1) => (
  panelCount * 1_000_000_000 +
  result.wasteArea +
  result.offcut.scrapArea * 1.5 +
  result.offcut.fragmentationPenalty -
  result.offcut.largestReusableRect.area * 0.6
);

export const packSinglePanel = (
  items: NumericCutItem[],
  panelW: number,
  panelH: number,
  selectedThickness?: string,
  strategy: Strategy = 'area'
): PanelPackResult => {
  const spacing = getYieldSpacing(selectedThickness);
  const remaining = sortItems(items, strategy);
  const totalRequired = remaining.reduce((sum, item) => sum + item.quantity, 0);
  const positions: PlacedItem[] = [];
  const placedCounts: Record<string, number> = {};
  const candidates: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];

  const pruneCandidates = () => {
    const seen = new Set<string>();
    for (let i = candidates.length - 1; i >= 0; i--) {
      const point = normalizeCandidate(candidates[i]);
      const key = `${point.x}:${point.y}`;
      if (
        seen.has(key) ||
        point.x < 0 ||
        point.y < 0 ||
        point.x > panelW ||
        point.y > panelH ||
        overlaps(point.x, point.y, 1, 1, positions, 0)
      ) {
        candidates.splice(i, 1);
      } else {
        candidates[i] = point;
        seen.add(key);
      }
    }
  };

  let placedInPass = true;
  while (placedInPass && remaining.some(item => item.quantity > 0)) {
    placedInPass = false;

    for (const item of remaining) {
      while (item.quantity > 0) {
        let best: PlacedItem | null = null;
        let bestScore = Number.POSITIVE_INFINITY;
        const orientations = [
          { width: item.width, height: item.height, rotated: false },
          { width: item.height, height: item.width, rotated: true },
        ];

        pruneCandidates();

        for (const candidate of candidates) {
          for (const orientation of orientations) {
            if (
              candidate.x + orientation.width > panelW ||
              candidate.y + orientation.height > panelH ||
              overlaps(candidate.x, candidate.y, orientation.width, orientation.height, positions, spacing)
            ) {
              continue;
            }

            const candidateScore = scoreCandidate(
              candidate.x,
              candidate.y,
              orientation.width,
              orientation.height,
              panelW,
              panelH,
              positions
            ) + (orientation.rotated ? 2 : 0);

            if (candidateScore < bestScore) {
              bestScore = candidateScore;
              best = {
                x: candidate.x,
                y: candidate.y,
                width: orientation.width,
                height: orientation.height,
                rotated: orientation.rotated,
                itemId: item.id,
              };
            }
          }
        }

        if (!best) break;

        positions.push(best);
        placedCounts[item.id] = (placedCounts[item.id] || 0) + 1;
        item.quantity -= 1;
        placedInPass = true;
        candidates.push(
          { x: best.x + best.width + spacing, y: best.y },
          { x: best.x, y: best.y + best.height + spacing }
        );
      }
    }
  }

  const totalPieces = positions.length;
  const placedArea = positions.reduce((sum, pos) => sum + pos.width * pos.height, 0);
  const offcut = analyzeOffcuts(positions, panelW, panelH, placedArea);
  const efficiency = panelW * panelH > 0 ? (placedArea / (panelW * panelH)) * 100 : 0;

  return {
    positions,
    totalPieces,
    canFitAll: totalPieces === totalRequired,
    placedCounts,
    efficiency,
    wasteArea: offcut.wasteArea,
    offcut,
  };
};

export const calculateYieldPlan = (
  items: NumericCutItem[],
  panelW: number,
  panelH: number,
  selectedThickness?: string
): YieldPlanResult => {
  const totalRequired = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalRequiredArea = items.reduce((sum, item) => sum + item.width * item.height * item.quantity, 0);
  const strategies: Strategy[] = ['area', 'long-edge', 'wide-first', 'tall-first'];
  let bestPlan: YieldPlanResult | null = null;

  const everyItemCanFit = items.every(item =>
    (item.width <= panelW && item.height <= panelH) ||
    (item.height <= panelW && item.width <= panelH)
  );

  if (!everyItemCanFit) {
    const emptyOffcut = analyzeOffcuts([], panelW, panelH, 0);
    return {
      piecesPerPanel: 0,
      efficiency: 0,
      wasteArea: panelW * panelH,
      canFitAll: false,
      panelsNeeded: 0,
      placedCounts: {},
      offcut: emptyOffcut,
      layoutPanels: [],
      score: Number.POSITIVE_INFINITY,
    };
  }

  for (const strategy of strategies) {
    let remaining = items.map(item => ({ ...item }));
    const layoutPanels: PanelPackResult[] = [];
    const placedCounts: Record<string, number> = {};

    while (remaining.some(item => item.quantity > 0) && layoutPanels.length < MAX_PANELS) {
      const result = packSinglePanel(remaining, panelW, panelH, selectedThickness, strategy);
      if (result.totalPieces === 0) break;

      layoutPanels.push(result);
      Object.entries(result.placedCounts).forEach(([itemId, count]) => {
        placedCounts[itemId] = (placedCounts[itemId] || 0) + count;
      });
      remaining = remaining.map(item => ({
        ...item,
        quantity: Math.max(0, item.quantity - (result.placedCounts[item.id] || 0)),
      }));
    }

    const panelsNeeded = layoutPanels.length;
    const totalPlaced = Object.values(placedCounts).reduce((sum, count) => sum + count, 0);
    const canFitAll = totalPlaced >= totalRequired;
    const totalPanelArea = panelW * panelH * panelsNeeded;
    const wasteArea = Math.max(0, totalPanelArea - totalRequiredArea);
    const efficiency = totalPanelArea > 0 ? (totalRequiredArea / totalPanelArea) * 100 : 0;
    const avgPiecesPerPanel = panelsNeeded > 0 ? Math.round(totalPlaced / panelsNeeded) : 0;
    const aggregateOffcut = layoutPanels.reduce<OffcutAnalysis>((acc, panel) => ({
      wasteArea: acc.wasteArea + panel.offcut.wasteArea,
      largestReusableRect: acc.largestReusableRect.area >= panel.offcut.largestReusableRect.area
        ? acc.largestReusableRect
        : panel.offcut.largestReusableRect,
      reusableArea: acc.reusableArea + panel.offcut.reusableArea,
      scrapArea: acc.scrapArea + panel.offcut.scrapArea,
      fragmentationPenalty: acc.fragmentationPenalty + panel.offcut.fragmentationPenalty,
    }), {
      wasteArea: 0,
      largestReusableRect: { width: 0, height: 0, area: 0 },
      reusableArea: 0,
      scrapArea: 0,
      fragmentationPenalty: 0,
    });

    const score = (
      (canFitAll ? 0 : 10_000_000_000) +
      panelsNeeded * 1_000_000_000 +
      wasteArea +
      aggregateOffcut.scrapArea * 1.5 +
      aggregateOffcut.fragmentationPenalty -
      aggregateOffcut.largestReusableRect.area * 0.6
    );

    const plan: YieldPlanResult = {
      piecesPerPanel: avgPiecesPerPanel,
      efficiency,
      wasteArea,
      canFitAll,
      panelsNeeded,
      placedCounts,
      offcut: aggregateOffcut,
      layoutPanels,
      score,
    };

    if (!bestPlan || plan.score < bestPlan.score) {
      bestPlan = plan;
    }
  }

  return bestPlan!;
};
