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

export function SizeSelector({ qualityId, productName, onSelectSize, onBack, selectedSizeId }: SizeSelectorProps) {
  // Use CASTING_QUALITIES from calculator as the source of truth
  const quality = CASTING_QUALITIES.find(q => q.id === qualityId);
  const sizes = quality?.sizes || [];

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
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sizes.map((size) => (
            <Button
              key={size}
              variant={selectedSizeId === size ? "default" : "outline"}
              className="h-auto flex-col p-4"
              onClick={() => onSelectSize(size, size)}
            >
              <span className="font-medium">{size}</span>
            </Button>
          ))}
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
