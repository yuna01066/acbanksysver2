import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MATERIALS } from '@/types/calculator';

interface MaterialSelectorProps {
  onSelectMaterial: (materialId: string, materialName: string) => void;
  selectedMaterialId: string | null;
}

export function MaterialSelector({ onSelectMaterial, selectedMaterialId }: MaterialSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>소재 선택</CardTitle>
        <p className="text-sm text-muted-foreground">원판의 소재를 선택해주세요</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {MATERIALS.map((material) => (
            <Button
              key={material.id}
              variant={selectedMaterialId === material.id ? "default" : "outline"}
              className="h-20 text-lg font-semibold"
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
