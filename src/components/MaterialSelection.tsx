
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
        <h3 className="text-2xl font-bold text-gray-900 mb-2">소재를 선택해주세요</h3>
        <p className="text-gray-600">사용하실 판재의 소재를 선택해주세요</p>
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
            className={`h-16 text-lg font-semibold transition-all duration-200 rounded-lg ${
              selectedMaterial?.id === material.id
                ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
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
