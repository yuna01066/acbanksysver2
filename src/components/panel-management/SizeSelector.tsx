import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { CASTING_QUALITIES } from '@/types/calculator';

interface SizeSelectorProps {
  qualityId: string;
  productName: string;
  onSelectSize: (sizeId: string, sizeName: string) => void;
  onBack: () => void;
  selectedSizeId: string | null;
}

interface PanelSizeInfo {
  baseName: string;
  baseWidth: number;
  baseHeight: number;
}

export function SizeSelector({ qualityId, productName, onSelectSize, onBack, selectedSizeId }: SizeSelectorProps) {
  // Use CASTING_QUALITIES from calculator as the source of truth
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const sizes = quality?.sizes || [];

  // 사이즈 정보 계산 (10T~20T 기준)
  const getSizeInfo = (sizeString: string): PanelSizeInfo => {
    const baseSizeMapping: { [key: string]: { width: number; height: number } } = {
      '소3*6': { width: 800, height: 1700 },
      '3*6': { width: 860, height: 1750 },
      '대3*6': { width: 900, height: 1800 },
      '4*5': { width: 1120, height: 1425 },
      '대4*5': { width: 1200, height: 1500 },
      '소1*2': { width: 950, height: 1900 },
      '1*2': { width: 1000, height: 2000 },
      '4*6': { width: 1200, height: 1800 },
      '4*8': { width: 1200, height: 2400 },
      '4*10': { width: 1200, height: 3000 },
      '5*5': { width: 1500, height: 1500 },
      '5*6': { width: 1500, height: 1800 },
      '5*8': { width: 1500, height: 2400 }
    };
    
    const baseSize = baseSizeMapping[sizeString];
    return {
      baseName: sizeString,
      baseWidth: baseSize?.width || 1000,
      baseHeight: baseSize?.height || 1000
    };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{productName} - 사이즈 선택</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sizes.map((size) => {
            const sizeInfo = getSizeInfo(size);
            const isSelected = selectedSizeId === size;
            
            return (
              <div
                key={size}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
                onClick={() => onSelectSize(size, size)}
              >
                <div className="text-center space-y-2">
                  <div className="font-semibold text-lg">
                    {sizeInfo.baseName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>가용: {sizeInfo.baseWidth}×{sizeInfo.baseHeight}mm</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sizes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            사이즈가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
