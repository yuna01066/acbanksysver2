import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MATERIALS } from '@/types/calculator';

interface MaterialSelectorProps {
  onSelectMaterial: (materialId: string, materialName: string) => void;
  selectedMaterialId: string | null;
  variant?: 'default' | 'compact';
}

export function MaterialSelector({ onSelectMaterial, selectedMaterialId, variant = 'default' }: MaterialSelectorProps) {
  const isCompact = variant === 'compact';

  return (
    <Card className={isCompact ? 'border-border bg-white shadow-none' : undefined}>
      <CardHeader className={isCompact ? 'px-4 pb-2 pt-4' : undefined}>
        <CardTitle className={isCompact ? 'text-base' : undefined}>소재 선택</CardTitle>
        <p className="text-sm text-muted-foreground">원판의 소재를 선택해주세요.</p>
      </CardHeader>
      <CardContent className={isCompact ? 'px-4 pb-4' : undefined}>
        <div className={isCompact ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid grid-cols-2 md:grid-cols-3 gap-4'}>
          {MATERIALS.map((material) => (
            <Button
              key={material.id}
              variant={selectedMaterialId === material.id ? "default" : "outline"}
              className={isCompact ? 'h-11 rounded-full text-sm font-semibold shadow-none' : 'h-20 text-lg font-semibold'}
              onClick={() => onSelectMaterial(material.id, material.name)}
            >
              {material.name}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
