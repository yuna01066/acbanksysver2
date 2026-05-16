
import React from 'react';
import { Button } from "@/components/ui/button";
import { Material } from "@/types/calculator";

interface MaterialSelectionProps {
  materials: Material[];
  selectedMaterial: Material | null;
  selectedFactory: string;
  factories: { id: string; name: string }[];
  onMaterialSelect: (material: Material) => void;
}

const MaterialSelection: React.FC<MaterialSelectionProps> = ({
  materials,
  selectedMaterial,
  selectedFactory,
  factories,
  onMaterialSelect
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">견적 방식을 선택해주세요</h3>
        <p className="text-muted-foreground">원판 기준, 제품 제작, 공간 견적 중 선택해주세요</p>
        {selectedFactory !== 'jangwon' && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 font-medium">
              {factories.find(f => f.id === selectedFactory)?.name} 공장은 현재 준비 중입니다.
            </p>
            <p className="text-yellow-600 text-sm">템플릿 기능으로 체험해보세요.</p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {materials.map((material) => (
          <Button
            key={material.id}
            variant={selectedMaterial?.id === material.id ? "default" : "outline"}
            className={`h-16 text-lg font-semibold transition-all duration-200 rounded-xl ${
              selectedMaterial?.id === material.id
                ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                : 'bg-white/70 hover:bg-white border-white/70 text-foreground'
            }`}
            onClick={() => onMaterialSelect(material)}
          >
            {material.name}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default MaterialSelection;
