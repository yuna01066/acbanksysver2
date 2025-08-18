
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Material, Quality } from "@/types/calculator";

interface SelectionSummaryProps {
  selectedFactory?: string;
  selectedMaterial: Material | null;
  selectedQuality: Quality | null;
  selectedThickness: string;
  selectedSize: string;
  selectedColorType: string;
  selectedSurface: string;
  colorMixingCost: number;
  selectedProcessing: string;
  processingOptions: { id: string; name: string }[];
  factories?: { id: string; name: string }[];
}

const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selectedFactory,
  selectedMaterial,
  selectedQuality,
  selectedThickness,
  selectedSize,
  selectedColorType,
  selectedSurface,
  colorMixingCost,
  selectedProcessing,
  processingOptions,
  factories
}) => {
  const selections = [];

  if (selectedFactory && factories) {
    const factoryName = factories.find(f => f.id === selectedFactory)?.name;
    if (factoryName) {
      selections.push({ label: '공장', value: factoryName });
    }
  }

  if (selectedMaterial) {
    selections.push({ label: '소재', value: selectedMaterial.name });
  }

  if (selectedQuality) {
    selections.push({ label: '재질', value: selectedQuality.name });
  }

  if (selectedThickness) {
    selections.push({ label: '두께', value: selectedThickness });
  }

  if (selectedSize) {
    selections.push({ label: '사이즈', value: selectedSize });
  }

  if (selectedColorType) {
    selections.push({ label: '색상', value: selectedColorType });
  }

  if (selectedSurface) {
    selections.push({ label: '면수', value: selectedSurface });
  }

  if (colorMixingCost > 0) {
    selections.push({ label: '조색비', value: `${(colorMixingCost / 10000).toFixed(0)}개` });
  }

  if (selectedProcessing) {
    const processingName = processingOptions.find(p => p.id === selectedProcessing)?.name;
    if (processingName) {
      selections.push({ label: '가공', value: processingName });
    }
  }

  if (selections.length === 0) return null;

  return (
    <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h4 className="text-sm font-medium text-slate-700 mb-3">선택된 옵션</h4>
      <div className="flex flex-wrap gap-2">
        {selections.map((selection, index) => (
          <Badge 
            key={index}
            variant="secondary" 
            className="bg-white border border-slate-300 text-slate-700 px-3 py-1"
          >
            {selection.label}: {selection.value}
          </Badge>
        ))}
      </div>
    </div>
  );
};

export default SelectionSummary;
