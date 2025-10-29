
import React from 'react';
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Material, Quality } from "@/types/calculator";
import { Package, Layers, Palette, Ruler, Box, Scissors, Droplet, DollarSign } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";

interface SelectionItem {
  category: string;
  label: string;
  value: string;
  description?: string;
  price?: number;
  icon?: React.ReactNode;
}

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
  selectedAdhesion: string;
  processingOptions: { id: string; name: string }[];
  factories?: { id: string; name: string }[];
  basePrice?: number;
  processingCost?: number;
  adhesionCost?: number;
  qty?: number;
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
  selectedAdhesion,
  processingOptions,
  factories,
  basePrice = 0,
  processingCost = 0,
  adhesionCost = 0,
  qty = 1
}) => {
  const selections: SelectionItem[] = [];

  // 소재 및 재질
  if (selectedMaterial) {
    selections.push({ 
      category: '기본정보',
      label: '소재', 
      value: selectedMaterial.name,
      description: '아크릴 소재',
      icon: <Package className="w-4 h-4" />
    });
  }

  if (selectedQuality) {
    selections.push({ 
      category: '기본정보',
      label: '재질', 
      value: selectedQuality.name,
      description: selectedQuality.id.includes('glossy') ? '광택 재질' : selectedQuality.id.includes('satin') ? '무광 재질' : '아스텔 재질',
      icon: <Layers className="w-4 h-4" />
    });
  }

  // 색상 정보
  if (selectedColor) {
    const colorOptions = [
      { id: 'pink-light', acCode: 'AC-C011', name: '핑크 라이트' },
      { id: 'pink-standard', acCode: 'AC-C012', name: '핑크 스탠다드' },
      { id: 'red', acCode: 'AC-C013', name: '레드' },
      { id: 'maroon', acCode: 'AC-C014', name: '마룬' },
      { id: 'peach', acCode: 'AC-C021', name: '피치' },
      { id: 'coral', acCode: 'AC-C022', name: '코랄' },
      { id: 'orange-red', acCode: 'AC-C023', name: '오렌지 레드' },
      { id: 'rust', acCode: 'AC-C024', name: '러스트' },
      { id: 'salmon', acCode: 'AC-C031', name: '살몬' },
      { id: 'tangerine', acCode: 'AC-C032', name: '탠저린' },
      { id: 'flame', acCode: 'AC-C033', name: '플레임' },
      { id: 'brick', acCode: 'AC-C034', name: '브릭' },
      { id: 'orange-light', acCode: 'AC-C041', name: '오렌지 라이트' },
      { id: 'orange-standard', acCode: 'AC-C042', name: '오렌지 스탠다드' },
      { id: 'orange-dark', acCode: 'AC-C043', name: '오렌지 다크' },
      { id: 'brown', acCode: 'AC-C044', name: '브라운' },
      { id: 'yellow-light', acCode: 'AC-C051', name: '옐로우 라이트' },
      { id: 'yellow-standard', acCode: 'AC-C052', name: '옐로우 스탠다드' },
      { id: 'orange-bright', acCode: 'AC-C053', name: '오렌지 브라이트' },
      { id: 'amber', acCode: 'AC-C054', name: '앰버' },
      { id: 'lemon', acCode: 'AC-C061', name: '레몬' },
      { id: 'gold', acCode: 'AC-C062', name: '골드' },
      { id: 'sunshine', acCode: 'AC-C063', name: '선샤인' },
      { id: 'mustard', acCode: 'AC-C064', name: '머스타드' },
      { id: 'lime-light', acCode: 'AC-C071', name: '라임 라이트' },
      { id: 'lime-standard', acCode: 'AC-C072', name: '라임 스탠다드' },
      { id: 'green-dark', acCode: 'AC-C073', name: '그린 다크' },
      { id: 'olive', acCode: 'AC-C074', name: '올리브' },
      { id: 'mint', acCode: 'AC-C081', name: '민트' },
      { id: 'green-standard', acCode: 'AC-C082', name: '그린 스탠다드' },
      { id: 'forest-green', acCode: 'AC-C083', name: '포레스트 그린' },
      { id: 'pine-green', acCode: 'AC-C084', name: '파인 그린' },
      { id: 'sea-green', acCode: 'AC-C091', name: '씨 그린' },
      { id: 'emerald', acCode: 'AC-C092', name: '에메랄드' },
      { id: 'jade', acCode: 'AC-C093', name: '제이드' },
      { id: 'forest', acCode: 'AC-C094', name: '포레스트' },
      { id: 'cyan-light', acCode: 'AC-C101', name: '시안 라이트' },
      { id: 'cyan-standard', acCode: 'AC-C102', name: '시안 스탠다드' },
      { id: 'teal', acCode: 'AC-C103', name: '틸' },
      { id: 'navy', acCode: 'AC-C104', name: '네이비' },
      { id: 'sky-blue', acCode: 'AC-C111', name: '스카이 블루' },
      { id: 'turquoise', acCode: 'AC-C112', name: '터콰이즈' },
      { id: 'ocean-blue', acCode: 'AC-C113', name: '오션 블루' },
      { id: 'steel-blue', acCode: 'AC-C114', name: '스틸 블루' },
      { id: 'powder-blue', acCode: 'AC-C121', name: '파우더 블루' },
      { id: 'cerulean', acCode: 'AC-C122', name: '세룰리안' },
      { id: 'sapphire', acCode: 'AC-C123', name: '사파이어' },
      { id: 'midnight', acCode: 'AC-C124', name: '미드나잇' },
      { id: 'blue-light', acCode: 'AC-C131', name: '블루 라이트' },
      { id: 'blue-standard', acCode: 'AC-C132', name: '블루 스탠다드' },
      { id: 'blue-dark', acCode: 'AC-C133', name: '블루 다크' },
      { id: 'indigo', acCode: 'AC-C134', name: '인디고' },
      { id: 'lavender', acCode: 'AC-C141', name: '라벤더' },
      { id: 'violet', acCode: 'AC-C142', name: '바이올렛' },
      { id: 'royal-purple', acCode: 'AC-C143', name: '로열 퍼플' },
      { id: 'deep-purple', acCode: 'AC-C144', name: '딥 퍼플' },
      { id: 'lilac', acCode: 'AC-C151', name: '라일락' },
      { id: 'amethyst', acCode: 'AC-C152', name: '자수정' },
      { id: 'orchid', acCode: 'AC-C153', name: '오키드' },
      { id: 'eggplant', acCode: 'AC-C154', name: '에그플랜트' },
      { id: 'purple-light', acCode: 'AC-C161', name: '퍼플 라이트' },
      { id: 'purple-standard', acCode: 'AC-C162', name: '퍼플 스탠다드' },
      { id: 'purple-dark', acCode: 'AC-C163', name: '퍼플 다크' },
      { id: 'wine', acCode: 'AC-C164', name: '와인' },
      { id: 'pink-pastel', acCode: 'AC-C171', name: '핑크 파스텔' },
      { id: 'magenta', acCode: 'AC-C172', name: '마젠타' },
      { id: 'hot-pink', acCode: 'AC-C173', name: '핫 핑크' },
      { id: 'berry', acCode: 'AC-C174', name: '베리' },
      { id: 'light-gray', acCode: 'AC-C181', name: '라이트 그레이' },
      { id: 'charcoal', acCode: 'AC-C182', name: '차콜' },
      { id: 'jet-black', acCode: 'AC-C183', name: '제트 블랙' },
      { id: 'black', acCode: 'AC-C184', name: '블랙' },
      { id: 'fluorescent-red', acCode: 'AC-C191', name: '형광 레드' },
      { id: 'fluorescent-orange', acCode: 'AC-C192', name: '형광 오렌지' },
      { id: 'fluorescent-yellow', acCode: 'AC-C193', name: '형광 옐로우' },
      { id: 'neon-yellow', acCode: 'AC-C194', name: '네온 옐로우' },
      { id: 'neon-green', acCode: 'AC-C195', name: '네온 그린' },
      { id: 'fluorescent-pink', acCode: 'AC-C196', name: '형광 핑크' },
    ];
    
    const selectedColorOption = colorOptions.find(option => option.id === selectedColor);
    if (selectedColorOption) {
      selections.push({ 
        category: '색상/규격',
        label: '색상 코드', 
        value: selectedColorOption.acCode,
        description: selectedColorOption.name,
        icon: <Palette className="w-4 h-4" />
      });
    }
  }

  // 두께 및 사이즈
  if (selectedThickness) {
    selections.push({ 
      category: '색상/규격',
      label: '두께', 
      value: selectedThickness,
      description: '아크릴 판재 두께',
      icon: <Ruler className="w-4 h-4" />
    });
  }

  if (selectedSize) {
    selections.push({ 
      category: '색상/규격',
      label: '사이즈', 
      value: selectedSize,
      description: '패널 크기',
      icon: <Box className="w-4 h-4" />,
      price: basePrice
    });
  }

  if (selectedColorType) {
    selections.push({ 
      category: '색상/규격',
      label: '색상 타입', 
      value: selectedColorType,
      icon: <Palette className="w-4 h-4" />
    });
  }

  if (selectedSurface) {
    selections.push({ 
      category: '색상/규격',
      label: '면수', 
      value: selectedSurface,
      description: selectedSurface === '단면' ? '한 면만 마감' : '양면 마감',
      icon: <Layers className="w-4 h-4" />
    });
  }

  // 조색비
  if (colorMixingCost > 0) {
    const mixingCount = (colorMixingCost / 10000).toFixed(0);
    selections.push({ 
      category: '추가옵션',
      label: '조색비', 
      value: `${mixingCount}개`,
      description: '색상 혼합 작업',
      price: colorMixingCost,
      icon: <Palette className="w-4 h-4" />
    });
  }

  // 가공 방식
  if (selectedProcessing) {
    const processingName = processingOptions.find(p => p.id === selectedProcessing)?.name;
    const processingDescriptions: Record<string, string> = {
      'raw-only': '가공 없이 원판만 구매',
      'none': '기본 문의용',
      'auto': '두께에 따라 최적 방식 자동 선택',
      'simple-cutting': '직선 재단 작업',
      'edge-finishing': '엣지 연마 및 격면 마감',
      'laser-simple': '10T 미만 단순 레이저 커팅',
      'laser-complex': '10T 미만 복잡한 레이저 커팅',
      'cnc-simple': '10T 이상 단순 CNC 가공',
      'cnc-complex': '10T 이상 복잡한 CNC 가공'
    };
    
    if (processingName) {
      selections.push({ 
        category: '가공/접착',
        label: '가공 방식', 
        value: processingName,
        description: processingDescriptions[selectedProcessing] || '가공 작업',
        price: processingCost,
        icon: <Scissors className="w-4 h-4" />
      });
    }
  }

  // 접착 작업
  if (selectedAdhesion) {
    const adhesionOptions = [
      { id: 'bond-normal', name: '일반 접착', desc: '기본 접착 작업' },
      { id: 'bond-mugipo-auto', name: '무기포 접착 (자동)', desc: '45°/90° 중 최적 선택' },
      { id: 'bond-mugipo-45', name: '무기포 접착 45°', desc: '45도 각도 무기포 접착' },
      { id: 'bond-mugipo-90', name: '무기포 접착 90°', desc: '90도 각도 무기포 접착' }
    ];
    const adhesionOption = adhesionOptions.find(a => a.id === selectedAdhesion);
    if (adhesionOption) {
      selections.push({ 
        category: '가공/접착',
        label: '접착 작업', 
        value: adhesionOption.name,
        description: adhesionOption.desc + (qty > 1 ? ` (수량: ${qty}EA)` : ''),
        price: adhesionCost,
        icon: <Droplet className="w-4 h-4" />
      });
    }
  }

  if (selections.length === 0) return null;

  // 카테고리별로 그룹화
  const groupedSelections = selections.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, SelectionItem[]>);

  return (
    <Card className="mb-6 border-2 border-primary/20 bg-gradient-to-br from-background to-muted/10">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          선택된 옵션
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(groupedSelections).map(([category, items]) => (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-semibold text-muted-foreground px-2">{category}</h4>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div 
                  key={index}
                  className="flex items-start gap-3 p-3 bg-background/80 rounded-lg border border-border/50 hover:border-primary/30 transition-colors"
                >
                  <div className="mt-0.5 text-primary">
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.value}
                      </Badge>
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  {item.price !== undefined && item.price > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                      <DollarSign className="w-3 h-3" />
                      {formatPrice(item.price)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default SelectionSummary;
