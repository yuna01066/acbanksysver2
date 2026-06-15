
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
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">견적 방식을 선택해주세요</h3>
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
            variant="outline"
            className={`h-16 rounded-xl text-lg font-semibold transition-all duration-200 ${
              selectedMaterial?.id === material.id
                ? 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800'
                : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50'
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
