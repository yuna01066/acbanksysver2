
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Material, Quality } from "@/types/calculator";

interface SelectionSummaryProps {
  selectedFactory?: string;
  selectedMaterial: Material | null;
  selectedQuality: Quality | null;
  selectedColor: string;
  selectedThickness: string;
  selectedSize: string;
  selectedColorType: string;
  selectedSurface: string;
  colorMixingCost: number;
  selectedProcessing: string;
  filmBaseType?: string;
  processingOptions: { id: string; name: string }[];
  factories?: { id: string; name: string }[];
}

const SelectionSummary: React.FC<SelectionSummaryProps> = ({
  selectedFactory,
  selectedMaterial,
  selectedQuality,
  selectedColor,
  selectedThickness,
  selectedSize,
  selectedColorType,
  selectedSurface,
  colorMixingCost,
  selectedProcessing,
  filmBaseType,
  processingOptions,
  factories
}) => {
  const selections = [];

  // 첫 번째 항목으로 계산기 유형 표시
  selections.push({ label: '계산기', value: '견적 계산기' });

  if (selectedMaterial) {
    selections.push({ label: '소재', value: selectedMaterial.name });
  }

  if (selectedQuality) {
    // 필름 아크릴인 경우 특수 제작으로 표시
    if (selectedQuality.id === 'film-acrylic') {
      selections.push({ label: '특수 제작', value: selectedQuality.name });
    } else {
      selections.push({ label: '재질', value: selectedQuality.name });
    }
  }

  // 필름 기본 재질 표시 (Clear, Bright, Astel)
  if (filmBaseType) {
    const baseTypeNames: { [key: string]: string } = {
      'clear': 'Clear (클리어)',
      'bright': 'Bright (브라이트)',
      'astel': 'Astel (아스텔)'
    };
    selections.push({ label: '기본 재질', value: baseTypeNames[filmBaseType] || filmBaseType });
  }

  if (selectedColor) {
    // COLOR_OPTIONS에서 선택된 색상의 AC 코드 찾기
    const colorOptions = [
      { id: 'pink-light', acCode: 'AC-C011' },
      { id: 'pink-standard', acCode: 'AC-C012' },
      { id: 'red', acCode: 'AC-C013' },
      { id: 'maroon', acCode: 'AC-C014' },
      { id: 'peach', acCode: 'AC-C021' },
      { id: 'coral', acCode: 'AC-C022' },
      { id: 'orange-red', acCode: 'AC-C023' },
      { id: 'rust', acCode: 'AC-C024' },
      { id: 'salmon', acCode: 'AC-C031' },
      { id: 'tangerine', acCode: 'AC-C032' },
      { id: 'flame', acCode: 'AC-C033' },
      { id: 'brick', acCode: 'AC-C034' },
      { id: 'orange-light', acCode: 'AC-C041' },
      { id: 'orange-standard', acCode: 'AC-C042' },
      { id: 'orange-dark', acCode: 'AC-C043' },
      { id: 'brown', acCode: 'AC-C044' },
      { id: 'yellow-light', acCode: 'AC-C051' },
      { id: 'yellow-standard', acCode: 'AC-C052' },
      { id: 'orange-bright', acCode: 'AC-C053' },
      { id: 'amber', acCode: 'AC-C054' },
      { id: 'lemon', acCode: 'AC-C061' },
      { id: 'gold', acCode: 'AC-C062' },
      { id: 'sunshine', acCode: 'AC-C063' },
      { id: 'mustard', acCode: 'AC-C064' },
      { id: 'lime-light', acCode: 'AC-C071' },
      { id: 'lime-standard', acCode: 'AC-C072' },
      { id: 'green-dark', acCode: 'AC-C073' },
      { id: 'olive', acCode: 'AC-C074' },
      { id: 'mint', acCode: 'AC-C081' },
      { id: 'green-standard', acCode: 'AC-C082' },
      { id: 'forest-green', acCode: 'AC-C083' },
      { id: 'pine-green', acCode: 'AC-C084' },
      { id: 'sea-green', acCode: 'AC-C091' },
      { id: 'emerald', acCode: 'AC-C092' },
      { id: 'jade', acCode: 'AC-C093' },
      { id: 'forest', acCode: 'AC-C094' },
      { id: 'cyan-light', acCode: 'AC-C101' },
      { id: 'cyan-standard', acCode: 'AC-C102' },
      { id: 'teal', acCode: 'AC-C103' },
      { id: 'navy', acCode: 'AC-C104' },
      { id: 'sky-blue', acCode: 'AC-C111' },
      { id: 'turquoise', acCode: 'AC-C112' },
      { id: 'ocean-blue', acCode: 'AC-C113' },
      { id: 'steel-blue', acCode: 'AC-C114' },
      { id: 'powder-blue', acCode: 'AC-C121' },
      { id: 'cerulean', acCode: 'AC-C122' },
      { id: 'sapphire', acCode: 'AC-C123' },
      { id: 'midnight', acCode: 'AC-C124' },
      { id: 'blue-light', acCode: 'AC-C131' },
      { id: 'blue-standard', acCode: 'AC-C132' },
      { id: 'blue-dark', acCode: 'AC-C133' },
      { id: 'indigo', acCode: 'AC-C134' },
      { id: 'lavender', acCode: 'AC-C141' },
      { id: 'violet', acCode: 'AC-C142' },
      { id: 'royal-purple', acCode: 'AC-C143' },
      { id: 'deep-purple', acCode: 'AC-C144' },
      { id: 'lilac', acCode: 'AC-C151' },
      { id: 'amethyst', acCode: 'AC-C152' },
      { id: 'orchid', acCode: 'AC-C153' },
      { id: 'eggplant', acCode: 'AC-C154' },
      { id: 'purple-light', acCode: 'AC-C161' },
      { id: 'purple-standard', acCode: 'AC-C162' },
      { id: 'purple-dark', acCode: 'AC-C163' },
      { id: 'wine', acCode: 'AC-C164' },
      { id: 'pink-pastel', acCode: 'AC-C171' },
      { id: 'magenta', acCode: 'AC-C172' },
      { id: 'hot-pink', acCode: 'AC-C173' },
      { id: 'berry', acCode: 'AC-C174' },
      { id: 'light-gray', acCode: 'AC-C181' },
      { id: 'charcoal', acCode: 'AC-C182' },
      { id: 'jet-black', acCode: 'AC-C183' },
      { id: 'black', acCode: 'AC-C184' },
      { id: 'fluorescent-red', acCode: 'AC-C191' },
      { id: 'fluorescent-orange', acCode: 'AC-C192' },
      { id: 'fluorescent-yellow', acCode: 'AC-C193' },
      { id: 'neon-yellow', acCode: 'AC-C194' },
      { id: 'neon-green', acCode: 'AC-C195' },
      { id: 'fluorescent-pink', acCode: 'AC-C196' },
      // 클리어 B 색상들
      { id: 'brown-clear-b', acCode: 'AC-C006' },
      { id: 'rust-clear-b', acCode: 'AC-C007' },
      { id: 'burgundy-clear-b', acCode: 'AC-C008' },
      { id: 'pastel-pink-clear-b', acCode: 'AC-C016' },
      { id: 'rose-clear-b', acCode: 'AC-C017' },
      { id: 'maroon-clear-b', acCode: 'AC-C018' },
      { id: 'peach-clear-b', acCode: 'AC-C026' },
      { id: 'orange-red-clear-b', acCode: 'AC-C027' },
      { id: 'crimson-clear-b', acCode: 'AC-C028' },
      { id: 'light-orange-clear-b', acCode: 'AC-C036' },
      { id: 'dark-orange-clear-b', acCode: 'AC-C037' },
      { id: 'warm-red-clear-b', acCode: 'AC-C038' },
      { id: 'light-peach-clear-b', acCode: 'AC-C046' },
      { id: 'golden-orange-clear-b', acCode: 'AC-C047' },
      { id: 'burnt-orange-clear-b', acCode: 'AC-C048' },
      { id: 'rust-orange-clear-b', acCode: 'AC-C049' },
      { id: 'bright-yellow-clear-b', acCode: 'AC-C056' },
      { id: 'golden-yellow-clear-b', acCode: 'AC-C057' },
      { id: 'olive-yellow-clear-b', acCode: 'AC-C058' },
      { id: 'lime-yellow-clear-b', acCode: 'AC-C066' },
      { id: 'bright-lime-clear-b', acCode: 'AC-C067' },
      { id: 'olive-green-clear-b', acCode: 'AC-C068' },
      { id: 'dark-olive-clear-b', acCode: 'AC-C069' },
      { id: 'lime-green-clear-b', acCode: 'AC-C076' },
      { id: 'bright-green-clear-b', acCode: 'AC-C077' },
      { id: 'forest-green-clear-b', acCode: 'AC-C078' },
      { id: 'moss-green-clear-b', acCode: 'AC-C079' },
      { id: 'emerald-green-clear-b', acCode: 'AC-C086' },
      { id: 'jade-green-clear-b', acCode: 'AC-C087' },
      { id: 'pine-green-clear-b', acCode: 'AC-C088' },
      { id: 'teal-clear-b', acCode: 'AC-C096' },
      { id: 'turquoise-clear-b', acCode: 'AC-C097' },
      { id: 'sea-green-clear-b', acCode: 'AC-C098' },
      { id: 'light-cyan-clear-b', acCode: 'AC-C106' },
      { id: 'bright-cyan-clear-b', acCode: 'AC-C107' },
      { id: 'dark-cyan-clear-b', acCode: 'AC-C108' },
      { id: 'light-blue-clear-b', acCode: 'AC-C116' },
      { id: 'sky-blue-clear-b', acCode: 'AC-C117' },
      { id: 'ocean-blue-clear-b', acCode: 'AC-C118' },
      { id: 'powder-blue-clear-b', acCode: 'AC-C126' },
      { id: 'cornflower-clear-b', acCode: 'AC-C127' },
      { id: 'royal-blue-clear-b', acCode: 'AC-C128' },
      { id: 'navy-blue-clear-b', acCode: 'AC-C129' },
      { id: 'periwinkle-clear-b', acCode: 'AC-C136' },
      { id: 'bright-blue-clear-b', acCode: 'AC-C137' },
      { id: 'deep-blue-clear-b', acCode: 'AC-C138' },
      { id: 'indigo-clear-b', acCode: 'AC-C139' },
      { id: 'lavender-clear-b', acCode: 'AC-C146' },
      { id: 'violet-clear-b', acCode: 'AC-C147' },
      { id: 'deep-purple-clear-b', acCode: 'AC-C148' },
      { id: 'silver-gray-clear-b', acCode: 'AC-C207' },
      { id: 'steel-gray-clear-b', acCode: 'AC-C208' },
      { id: 'charcoal-gray-clear-b', acCode: 'AC-C209' }
    ];
    
    const selectedColorOption = colorOptions.find(option => option.id === selectedColor);
    if (selectedColorOption) {
      selections.push({ label: '색상', value: selectedColorOption.acCode });
    }
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
