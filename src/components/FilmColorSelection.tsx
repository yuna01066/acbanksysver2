import React, { useState } from 'react';
import { Button } from "@/components/ui/button";

interface FilmColorSelectionProps {
  selectedColor: string;
  selectedBaseType: string;
  onColorSelect: (colorId: string, colorInfo: { acCode: string; hexCode: string; isBrightPigment?: boolean }) => void;
  onBaseTypeSelect: (baseType: string) => void;
}

// 필름 아크릴용 기본 색상 정의
const FILM_BASE_COLORS = [
  { id: 'clear', name: 'Clear (클리어)', acCode: 'A001', hexCode: '#ffffff' },
  { id: 'bright', name: 'Bright (브라이트)', acCode: 'A002', hexCode: '#f0f0f0' },
  { id: 'astel', name: 'Astel (아스텔)', acCode: 'A003', hexCode: '#e8e8e8' }
];

// 클리어 색상 옵션 (예시)
const CLEAR_COLORS = [
  { id: 'clear-red', name: '레드', acCode: 'AC-C013', hexCode: '#ef3340' },
  { id: 'clear-orange', name: '오렌지', acCode: 'AC-C042', hexCode: '#ffb25b' },
  { id: 'clear-yellow', name: '노랑', acCode: 'AC-C052', hexCode: '#ffc72c' },
  { id: 'clear-green', name: '그린', acCode: 'AC-C082', hexCode: '#00bb31' },
  { id: 'clear-blue', name: '블루', acCode: 'AC-C132', hexCode: '#307fe2' },
  { id: 'clear-purple', name: '퍼플', acCode: 'AC-C162', hexCode: '#c964cf' },
  { id: 'clear-pink', name: '핑크', acCode: 'AC-C012', hexCode: '#fb637e' },
  { id: 'clear-black', name: '블랙', acCode: 'AC-C184', hexCode: '#2d2c2f' },
];

// 브라이트 색상 옵션 (예시)
const BRIGHT_COLORS = [
  { id: 'bright-red', name: '레드', acCode: 'AC-B013', hexCode: '#e4002b' },
  { id: 'bright-orange', name: '오렌지', acCode: 'AC-B042', hexCode: '#ffad00' },
  { id: 'bright-yellow', name: '노랑', acCode: 'AC-B052', hexCode: '#ffc72c' },
  { id: 'bright-green', name: '그린', acCode: 'AC-B082', hexCode: '#00bb31' },
  { id: 'bright-blue', name: '블루', acCode: 'AC-B132', hexCode: '#307fe2' },
  { id: 'bright-purple', name: '퍼플', acCode: 'AC-B162', hexCode: '#c964cf' },
  { id: 'bright-pink', name: '핑크', acCode: 'AC-B012', hexCode: '#f67599' },
  { id: 'bright-black', name: '블랙', acCode: 'AC-B184', hexCode: '#2d2c2f' },
];

// 아스텔 색상 옵션 (예시)
const ASTEL_COLORS = [
  { id: 'astel-red', name: '레드', acCode: 'AC-A013', hexCode: '#ef3340' },
  { id: 'astel-orange', name: '오렌지', acCode: 'AC-A042', hexCode: '#ffb25b' },
  { id: 'astel-yellow', name: '노랑', acCode: 'AC-A052', hexCode: '#ffc72c' },
  { id: 'astel-green', name: '그린', acCode: 'AC-A082', hexCode: '#00bb31' },
  { id: 'astel-blue', name: '블루', acCode: 'AC-A132', hexCode: '#307fe2' },
  { id: 'astel-purple', name: '퍼플', acCode: 'AC-A162', hexCode: '#c964cf' },
  { id: 'astel-pink', name: '핑크', acCode: 'AC-A012', hexCode: '#fb637e' },
  { id: 'astel-black', name: '블랙', acCode: 'AC-A184', hexCode: '#2d2c2f' },
];

const FilmColorSelection: React.FC<FilmColorSelectionProps> = ({
  selectedColor,
  selectedBaseType,
  onColorSelect,
  onBaseTypeSelect
}) => {
  const [selectedBase, setSelectedBase] = useState<string>(selectedBaseType || '');

  const handleBaseColorSelect = (baseId: string) => {
    // 기본 재질 선택 시에는 다음 단계로 넘어가지 않고, 세부 색상만 표시
    setSelectedBase(baseId);
    onBaseTypeSelect(baseId); // 기본 재질 정보 저장
  };

  const handleDetailColorSelect = (colorId: string, colorInfo: { acCode: string; hexCode: string }) => {
    // 세부 색상 선택 시에만 onColorSelect 호출하여 다음 단계로 진행
    onColorSelect(colorId, { ...colorInfo, isBrightPigment: selectedBase === 'bright' });
  };

  const getDetailColors = () => {
    if (selectedBase === 'clear') return CLEAR_COLORS;
    if (selectedBase === 'bright') return BRIGHT_COLORS;
    if (selectedBase === 'astel') return ASTEL_COLORS;
    return [];
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">색상을 선택해주세요</h3>
        <p className="text-gray-600">먼저 기본 재질을 선택한 후 세부 색상을 선택해주세요</p>
      </div>

      {/* 기본 재질 선택 */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 text-center">기본 재질</h4>
        <div className="grid grid-cols-3 gap-4">
          {FILM_BASE_COLORS.map((base) => (
            <Button
              key={base.id}
              variant={selectedBase === base.id ? "default" : "outline"}
              className={`h-16 text-base font-semibold transition-all duration-200 rounded-lg ${
                selectedBase === base.id
                  ? 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                  : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-900'
              }`}
              onClick={() => handleBaseColorSelect(base.id)}
            >
              {base.name}
            </Button>
          ))}
        </div>
      </div>

      {/* 세부 색상 선택 */}
      {selectedBase && (
        <div className="space-y-4 animate-fade-up">
          <h4 className="text-lg font-semibold text-gray-900 text-center">세부 색상</h4>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
            {getDetailColors().map((color) => (
              <button
                key={color.id}
                onClick={() => handleDetailColorSelect(color.id, { acCode: color.acCode, hexCode: color.hexCode })}
                className={`
                  relative aspect-square rounded-lg border-2 transition-all duration-200 
                  hover:scale-110 hover:shadow-lg group
                  ${selectedColor === color.acCode ? 'border-slate-900 ring-2 ring-slate-900 ring-offset-2' : 'border-gray-200'}
                `}
                style={{ backgroundColor: color.hexCode }}
                title={`${color.name} (${color.acCode})`}
              >
                {selectedColor === color.acCode && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-slate-900" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                )}
                
                {/* 호버 시 색상 정보 표시 */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {color.name}
                  <br />
                  {color.acCode}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FilmColorSelection;
