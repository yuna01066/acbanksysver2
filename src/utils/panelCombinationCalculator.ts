import { calculateYieldPlan, type NumericCutItem, type PanelSize } from './yieldOptimization';

export interface PanelUsage {
  panelName: string;
  quantity: number;
  placedItems: Array<{ itemId: string; count: number }>;
  efficiency: number;
  positions?: Array<{ x: number; y: number; width: number; height: number; rotated: boolean; itemId: string }>;
  offcut?: {
    largestReusableRect: { width: number; height: number; area: number };
    scrapArea: number;
    reusableArea: number;
  };
}

export interface CombinationResult {
  panels: PanelUsage[];
  totalEfficiency: number;
  totalWasteArea: number;
  totalCost: number;
  allItemsPlaced: boolean;
  remainingItems: Array<{ itemId: string; remaining: number }>;
  score?: number;
}

const remainingAfterPlaced = (
  items: NumericCutItem[],
  placedCounts: Record<string, number>
) => items.map(item => ({
  ...item,
  quantity: Math.max(0, item.quantity - (placedCounts[item.id] || 0)),
}));

const toPanelUsage = (
  panelName: string,
  plan: ReturnType<typeof calculateYieldPlan>
): PanelUsage => ({
  panelName,
  quantity: plan.panelsNeeded,
  placedItems: Object.entries(plan.placedCounts).map(([itemId, count]) => ({ itemId, count })),
  efficiency: plan.efficiency,
  positions: plan.layoutPanels[0]?.positions || [],
  offcut: plan.offcut,
});

// 복합 조합 계산: 원판 수와 총 잔재를 줄이고, 남는 잔재는 큰 직사각형으로 남기는 조합을 우선합니다.
export const calculatePanelCombinations = (
  cutItems: NumericCutItem[],
  availablePanels: PanelSize[],
  maxCombinations: number = 10,
  selectedThickness?: string
): CombinationResult[] => {
  const results: CombinationResult[] = [];
  const totalRequiredArea = cutItems.reduce((sum, item) => sum + item.width * item.height * item.quantity, 0);
  const singlePlans = availablePanels
    .map(panel => ({
      panel,
      plan: calculateYieldPlan(cutItems, panel.width, panel.height, selectedThickness),
    }))
    .filter(({ plan }) => plan.panelsNeeded > 0)
    .sort((a, b) => a.plan.score - b.plan.score);
  const candidatePlans = singlePlans.slice(0, Math.min(5, singlePlans.length));

  for (const { panel, plan } of singlePlans) {
    if (!plan.canFitAll || plan.panelsNeeded === 0) continue;

    results.push({
      panels: [toPanelUsage(panel.name, plan)],
      totalEfficiency: plan.efficiency,
      totalWasteArea: plan.wasteArea,
      totalCost: plan.panelsNeeded,
      allItemsPlaced: true,
      remainingItems: [],
      score: plan.score,
    });
  }

  for (let i = 0; i < candidatePlans.length; i++) {
    for (let j = i; j < candidatePlans.length; j++) {
      const panel1 = candidatePlans[i].panel;
      const panel2 = candidatePlans[j].panel;
      const plan1 = candidatePlans[i].plan;
      if (plan1.panelsNeeded === 0) continue;

      const remaining = remainingAfterPlaced(cutItems, plan1.placedCounts);
      if (remaining.every(item => item.quantity === 0)) continue;

      const plan2 = calculateYieldPlan(remaining, panel2.width, panel2.height, selectedThickness);
      if (plan2.panelsNeeded === 0) continue;

      const combinedCounts = { ...plan1.placedCounts };
      Object.entries(plan2.placedCounts).forEach(([itemId, count]) => {
        combinedCounts[itemId] = (combinedCounts[itemId] || 0) + count;
      });

      const finalRemaining = remainingAfterPlaced(cutItems, combinedCounts);
      const allItemsPlaced = finalRemaining.every(item => item.quantity === 0);
      if (!allItemsPlaced) continue;

      const totalPanels = plan1.panelsNeeded + plan2.panelsNeeded;
      const totalPanelArea = panel1.width * panel1.height * plan1.panelsNeeded +
        panel2.width * panel2.height * plan2.panelsNeeded;
      const totalWasteArea = Math.max(0, totalPanelArea - totalRequiredArea);
      const totalEfficiency = totalPanelArea > 0 ? (totalRequiredArea / totalPanelArea) * 100 : 0;
      const largestReusable = Math.max(
        plan1.offcut.largestReusableRect.area,
        plan2.offcut.largestReusableRect.area
      );
      const scrapArea = plan1.offcut.scrapArea + plan2.offcut.scrapArea;
      const score = (
        totalPanels * 1_000_000_000 +
        totalWasteArea +
        scrapArea * 1.5 -
        largestReusable * 0.6
      );

      results.push({
        panels: [toPanelUsage(panel1.name, plan1), toPanelUsage(panel2.name, plan2)],
        totalEfficiency,
        totalWasteArea,
        totalCost: totalPanels,
        allItemsPlaced: true,
        remainingItems: [],
        score,
      });
    }
  }

  results.sort((a, b) => {
    if (a.totalCost !== b.totalCost) return a.totalCost - b.totalCost;
    if (Math.abs(a.totalWasteArea - b.totalWasteArea) > 1000) return a.totalWasteArea - b.totalWasteArea;
    return (a.score || 0) - (b.score || 0);
  });

  return results.slice(0, maxCombinations);
};
