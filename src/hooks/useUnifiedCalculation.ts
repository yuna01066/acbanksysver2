import { useMemo } from 'react';
import { calculateUnifiedRecommendations, UnifiedResult } from '@/utils/unifiedPanelCalculator';

interface UseUnifiedCalculationProps {
  cutItems: Array<{ id: string; width: string; height: string; quantity: string }>;
  availablePanelSizes: Array<{ name: string; width: number; height: number }>;
  maxResults?: number;
}

interface UseUnifiedCalculationReturn {
  unifiedResults: UnifiedResult[];
  totalQuantity: number;
  bestSingleRecommendation: UnifiedResult | undefined;
}

export const useUnifiedCalculation = ({
  cutItems,
  availablePanelSizes,
  maxResults = 10
}: UseUnifiedCalculationProps): UseUnifiedCalculationReturn => {
  
  const { unifiedResults, totalQuantity } = useMemo(() => {
    const calculatedResults = calculateUnifiedRecommendations(
      cutItems, 
      availablePanelSizes, 
      maxResults
    );
    
    const calculatedTotalQuantity = cutItems.reduce((sum, item) => 
      sum + (item.quantity ? parseInt(item.quantity) : 0), 0
    );
    
    return {
      unifiedResults: calculatedResults,
      totalQuantity: calculatedTotalQuantity
    };
  }, [cutItems, availablePanelSizes, maxResults]);

  const bestSingleRecommendation = useMemo(() => {
    return unifiedResults.find(rec => rec.type === 'single');
  }, [unifiedResults]);

  return {
    unifiedResults,
    totalQuantity,
    bestSingleRecommendation
  };
};