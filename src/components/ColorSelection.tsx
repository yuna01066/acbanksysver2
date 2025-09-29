import React from 'react';
import { Button } from "@/components/ui/button";

interface ColorOption {
  id: string;
  name: string;
  acCode: string;
  hexCode: string;
  category: 'light' | 'standard' | 'dark' | 'fluorescent';
}

const COLOR_OPTIONS: ColorOption[] = [
  // 밝은 색상
  { id: 'pink-light', name: '연핑크', acCode: 'AC-C011', hexCode: '#fcafc0', category: 'light' },
  { id: 'orange-light', name: '연오렌지', acCode: 'AC-C041', hexCode: '#fecb8b', category: 'light' },
  { id: 'lime-light', name: '연라임', acCode: 'AC-C071', hexCode: '#aed000', category: 'light' },
  { id: 'cyan-light', name: '연시안', acCode: 'AC-C101', hexCode: '#88dbdf', category: 'light' },
  { id: 'blue-light', name: '연블루', acCode: 'AC-C131', hexCode: '#a7c6ed', category: 'light' },
  { id: 'purple-light', name: '연퍼플', acCode: 'AC-C161', hexCode: '#dd9cdf', category: 'light' },
  { id: 'peach', name: '피치', acCode: 'AC-C021', hexCode: '#ffb3ab', category: 'light' },
  { id: 'yellow-light', name: '연노랑', acCode: 'AC-C051', hexCode: '#f8e08e', category: 'light' },
  { id: 'mint', name: '민트', acCode: 'AC-C081', hexCode: '#26d07c', category: 'light' },
  { id: 'sky-blue', name: '하늘색', acCode: 'AC-C111', hexCode: '#6ad1e3', category: 'light' },
  { id: 'lavender', name: '라벤더', acCode: 'AC-C141', hexCode: '#ad96dc', category: 'light' },
  { id: 'pink-pastel', name: '파스텔 핑크', acCode: 'AC-C171', hexCode: '#f4a6d7', category: 'light' },

  // 표준 색상
  { id: 'pink-standard', name: '핑크', acCode: 'AC-C012', hexCode: '#fb637e', category: 'standard' },
  { id: 'orange-standard', name: '오렌지', acCode: 'AC-C042', hexCode: '#ffb25b', category: 'standard' },
  { id: 'lime-standard', name: '라임', acCode: 'AC-C072', hexCode: '#79c300', category: 'standard' },
  { id: 'cyan-standard', name: '시안', acCode: 'AC-C102', hexCode: '#2dccd3', category: 'standard' },
  { id: 'blue-standard', name: '블루', acCode: 'AC-C132', hexCode: '#307fe2', category: 'standard' },
  { id: 'purple-standard', name: '퍼플', acCode: 'AC-C162', hexCode: '#c964cf', category: 'standard' },
  { id: 'coral', name: '코랄', acCode: 'AC-C022', hexCode: '#ff5c39', category: 'standard' },
  { id: 'yellow-standard', name: '노랑', acCode: 'AC-C052', hexCode: '#ffc72c', category: 'standard' },
  { id: 'green-standard', name: '그린', acCode: 'AC-C082', hexCode: '#00bb31', category: 'standard' },
  { id: 'turquoise', name: '터키석', acCode: 'AC-C112', hexCode: '#05c3dd', category: 'standard' },
  { id: 'violet', name: '바이올렛', acCode: 'AC-C142', hexCode: '#7d55c7', category: 'standard' },
  { id: 'magenta', name: '마젠타', acCode: 'AC-C172', hexCode: '#f277c6', category: 'standard' },

  // 진한 색상
  { id: 'red', name: '레드', acCode: 'AC-C013', hexCode: '#ef3340', category: 'dark' },
  { id: 'orange-dark', name: '진오렌지', acCode: 'AC-C043', hexCode: '#ff8200', category: 'dark' },
  { id: 'green-dark', name: '진그린', acCode: 'AC-C073', hexCode: '#1fa824', category: 'dark' },
  { id: 'teal', name: '틸', acCode: 'AC-C103', hexCode: '#009ca6', category: 'dark' },
  { id: 'blue-dark', name: '진블루', acCode: 'AC-C133', hexCode: '#0032a0', category: 'dark' },
  { id: 'purple-dark', name: '진퍼플', acCode: 'AC-C163', hexCode: '#bb29bb', category: 'dark' },
  { id: 'maroon', name: '마룬', acCode: 'AC-C014', hexCode: '#a4343a', category: 'dark' },
  { id: 'brown', name: '브라운', acCode: 'AC-C044', hexCode: '#be6a14', category: 'dark' },
  { id: 'olive', name: '올리브', acCode: 'AC-C074', hexCode: '#5e7930', category: 'dark' },
  { id: 'navy', name: '네이비', acCode: 'AC-C104', hexCode: '#007377', category: 'dark' },
  { id: 'indigo', name: '인디고', acCode: 'AC-C134', hexCode: '#10069f', category: 'dark' },
  { id: 'wine', name: '와인', acCode: 'AC-C164', hexCode: '#981e97', category: 'dark' },
  { id: 'black', name: '블랙', acCode: 'AC-C184', hexCode: '#2d2c2f', category: 'dark' },
  { id: 'charcoal', name: '차콜', acCode: 'AC-C183', hexCode: '#25282a', category: 'dark' },
  { id: 'gray', name: '그레이', acCode: 'AC-C182', hexCode: '#4c4e56', category: 'dark' },
  { id: 'light-gray', name: '라이트 그레이', acCode: 'AC-C181', hexCode: '#9d9994', category: 'dark' },

  // 형광 색상
  { id: 'fluorescent-red', name: '형광 레드', acCode: 'AC-C191', hexCode: '#ff5555', category: 'fluorescent' },
  { id: 'fluorescent-orange', name: '형광 오렌지', acCode: 'AC-C192', hexCode: '#fc8427', category: 'fluorescent' },
  { id: 'fluorescent-yellow', name: '형광 노랑', acCode: 'AC-C193', hexCode: '#ffcf00', category: 'fluorescent' },
  { id: 'neon-yellow', name: '네온 노랑', acCode: 'AC-C194', hexCode: '#ffdf5e', category: 'fluorescent' },
  { id: 'neon-green', name: '네온 그린', acCode: 'AC-C195', hexCode: '#c8ff00', category: 'fluorescent' },
  { id: 'fluorescent-pink', name: '형광 핑크', acCode: 'AC-C196', hexCode: '#fe1493', category: 'fluorescent' }
];

interface ColorSelectionProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorSelection: React.FC<ColorSelectionProps> = ({
  selectedColor,
  onColorSelect
}) => {
  // AC 코드 숫자 순서로 정렬
  const sortedColors = [...COLOR_OPTIONS].sort((a, b) => {
    const aCode = parseInt(a.acCode.replace('AC-C', ''));
    const bCode = parseInt(b.acCode.replace('AC-C', ''));
    return aCode - bCode;
  });

  // 4개씩 그룹으로 나누기
  const colorGroups = [];
  for (let i = 0; i < sortedColors.length; i += 4) {
    const group = sortedColors.slice(i, i + 4);
    const groupNumber = Math.floor(i / 4) + 1;
    colorGroups.push({
      id: `group-${groupNumber}`,
      name: `그룹 ${groupNumber}`,
      description: `AC-C${String(group[0].acCode.replace('AC-C', '')).padStart(3, '0')} ~ AC-C${String(group[group.length - 1].acCode.replace('AC-C', '')).padStart(3, '0')}`,
      colors: group
    });
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">3. 색상을 선택해주세요</h3>
        <p className="text-gray-600">원하는 색상을 선택해주세요</p>
      </div>
      
      <div className="space-y-8">
        {colorGroups.map((group) => (
          <div key={group.id} className="space-y-4">
            <div>
              <h4 className="text-lg font-semibold text-gray-900">{group.name}</h4>
              <p className="text-sm text-gray-600">{group.description}</p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {group.colors.map((color) => (
                <div
                  key={color.id}
                  className={`relative cursor-pointer group ${
                    selectedColor === color.id ? 'ring-2 ring-primary ring-offset-2' : ''
                  }`}
                  onClick={() => onColorSelect(color.id)}
                >
                  <div 
                    className="w-full h-16 rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition-all duration-200"
                    style={{ backgroundColor: color.hexCode }}
                  />
                  <div className="mt-2 text-center">
                    <div className="text-sm font-bold text-gray-500">{color.acCode}</div>
                    <div className="text-xs text-gray-400">{color.hexCode}</div>
                  </div>
                  {selectedColor === color.id && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-white rounded-full shadow-md flex items-center justify-center">
                        <div className="w-3 h-3 bg-primary rounded-full"></div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ColorSelection;