import React from 'react';
import { Button } from "@/components/ui/button";

interface ColorOption {
  id: string;
  name: string;
  category: 'standard' | 'premium' | 'special';
}

const COLOR_OPTIONS: ColorOption[] = [
  // 표준 색상
  { id: 'white', name: '화이트', category: 'standard' },
  { id: 'black', name: '블랙', category: 'standard' },
  { id: 'gray', name: '그레이', category: 'standard' },
  { id: 'beige', name: '베이지', category: 'standard' },
  
  // 프리미엄 색상
  { id: 'red', name: '레드', category: 'premium' },
  { id: 'blue', name: '블루', category: 'premium' },
  { id: 'green', name: '그린', category: 'premium' },
  { id: 'yellow', name: '옐로우', category: 'premium' },
  { id: 'orange', name: '오렌지', category: 'premium' },
  { id: 'purple', name: '퍼플', category: 'premium' },
  
  // 특수 색상
  { id: 'metallic-silver', name: '메탈릭 실버', category: 'special' },
  { id: 'metallic-gold', name: '메탈릭 골드', category: 'special' },
  { id: 'pearl-white', name: '펄 화이트', category: 'special' },
  { id: 'custom', name: '맞춤 색상', category: 'special' }
];

interface ColorSelectionProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorSelection: React.FC<ColorSelectionProps> = ({
  selectedColor,
  onColorSelect
}) => {
  const categories = [
    {
      id: 'standard',
      name: '표준 색상',
      description: '기본 제공 색상',
      colors: COLOR_OPTIONS.filter(color => color.category === 'standard')
    },
    {
      id: 'premium',
      name: '프리미엄 색상',
      description: '다양한 컬러 옵션',
      colors: COLOR_OPTIONS.filter(color => color.category === 'premium')
    },
    {
      id: 'special',
      name: '특수 색상',
      description: '메탈릭, 펄, 맞춤 색상',
      colors: COLOR_OPTIONS.filter(color => color.category === 'special')
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">3. 색상을 선택해주세요</h3>
        <p className="text-gray-600">원하는 색상을 선택해주세요</p>
      </div>
      
      <div className="space-y-8">
        {categories.map((category) => (
          <div key={category.id} className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{category.name}</h4>
              <p className="text-sm text-gray-600">{category.description}</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {category.colors.map((color) => (
                <Button
                  key={color.id}
                  variant={selectedColor === color.id ? "default" : "minimal"}
                  className="h-16 text-base font-semibold shadow-depth hover:shadow-smooth transform hover:scale-105 transition-all duration-200"
                  onClick={() => onColorSelect(color.id)}
                >
                  {color.name}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorSelection;