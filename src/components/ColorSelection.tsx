import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface ColorOption {
  id: string;
  name: string;
  acCode: string;
  hexCode: string;
  category: 'clear-a' | 'clear-b';
  isEmpty?: boolean; // 빈 색상 표시용
}

const COLOR_OPTIONS: ColorOption[] = [
  // 클리어 A 색상
  { id: 'pink-light', name: '연핑크', acCode: 'AC-C011', hexCode: '#fcafc0', category: 'clear-a' },
  { id: 'pink-standard', name: '핑크', acCode: 'AC-C012', hexCode: '#fb637e', category: 'clear-a' },
  { id: 'red', name: '레드', acCode: 'AC-C013', hexCode: '#ef3340', category: 'clear-a' },
  { id: 'maroon', name: '마룬', acCode: 'AC-C014', hexCode: '#a4343a', category: 'clear-a' },
  { id: 'peach', name: '피치', acCode: 'AC-C021', hexCode: '#ffb3ab', category: 'clear-a' },
  { id: 'coral', name: '코랄', acCode: 'AC-C022', hexCode: '#ff5c39', category: 'clear-a' },
  { id: 'orange-red', name: '오렌지 레드', acCode: 'AC-C023', hexCode: '#fa4616', category: 'clear-a' },
  { id: 'rust', name: '러스트', acCode: 'AC-C024', hexCode: '#963821', category: 'clear-a' },
  { id: 'salmon', name: '살몬', acCode: 'AC-C031', hexCode: '#ffbe9f', category: 'clear-a' },
  { id: 'tangerine', name: '탠저린', acCode: 'AC-C032', hexCode: '#ff7f32', category: 'clear-a' },
  { id: 'flame', name: '플레임', acCode: 'AC-C033', hexCode: '#ff6720', category: 'clear-a' },
  { id: 'brick', name: '브릭', acCode: 'AC-C034', hexCode: '#be531c', category: 'clear-a' },
  { id: 'orange-light', name: '연오렌지', acCode: 'AC-C041', hexCode: '#fecb8b', category: 'clear-a' },
  { id: 'orange-standard', name: '오렌지', acCode: 'AC-C042', hexCode: '#ffb25b', category: 'clear-a' },
  { id: 'orange-dark', name: '진오렌지', acCode: 'AC-C043', hexCode: '#ff8200', category: 'clear-a' },
  { id: 'brown', name: '브라운', acCode: 'AC-C044', hexCode: '#be6a14', category: 'clear-a' },
  { id: 'yellow-light', name: '연노랑', acCode: 'AC-C051', hexCode: '#f8e08e', category: 'clear-a' },
  { id: 'yellow-standard', name: '노랑', acCode: 'AC-C052', hexCode: '#ffc72c', category: 'clear-a' },
  { id: 'orange-bright', name: '브라이트 오렌지', acCode: 'AC-C053', hexCode: '#ffa300', category: 'clear-a' },
  { id: 'amber', name: '앰버', acCode: 'AC-C054', hexCode: '#b58500', category: 'clear-a' },
  { id: 'lemon', name: '레몬', acCode: 'AC-C061', hexCode: '#f6eb61', category: 'clear-a' },
  { id: 'gold', name: '골드', acCode: 'AC-C062', hexCode: '#fae053', category: 'clear-a' },
  { id: 'sunshine', name: '선샤인', acCode: 'AC-C063', hexCode: '#fedd00', category: 'clear-a' },
  { id: 'mustard', name: '머스타드', acCode: 'AC-C064', hexCode: '#af9800', category: 'clear-a' },
  { id: 'lime-light', name: '연라임', acCode: 'AC-C071', hexCode: '#aed000', category: 'clear-a' },
  { id: 'lime-standard', name: '라임', acCode: 'AC-C072', hexCode: '#79c300', category: 'clear-a' },
  { id: 'green-dark', name: '진그린', acCode: 'AC-C073', hexCode: '#1fa824', category: 'clear-a' },
  { id: 'olive', name: '올리브', acCode: 'AC-C074', hexCode: '#5e7930', category: 'clear-a' },
  { id: 'mint', name: '민트', acCode: 'AC-C081', hexCode: '#26d07c', category: 'clear-a' },
  { id: 'green-standard', name: '그린', acCode: 'AC-C082', hexCode: '#00bb31', category: 'clear-a' },
  { id: 'forest-green', name: '포레스트 그린', acCode: 'AC-C083', hexCode: '#00b74f', category: 'clear-a' },
  { id: 'pine-green', name: '파인 그린', acCode: 'AC-C084', hexCode: '#275d38', category: 'clear-a' },
  { id: 'sea-green', name: '시 그린', acCode: 'AC-C091', hexCode: '#47d7ac', category: 'clear-a' },
  { id: 'emerald', name: '에메랄드', acCode: 'AC-C092', hexCode: '#00aa63', category: 'clear-a' },
  { id: 'jade', name: '제이드', acCode: 'AC-C093', hexCode: '#00af66', category: 'clear-a' },
  { id: 'forest', name: '포레스트', acCode: 'AC-C094', hexCode: '#007749', category: 'clear-a' },
  { id: 'cyan-light', name: '연시안', acCode: 'AC-C101', hexCode: '#88dbdf', category: 'clear-a' },
  { id: 'cyan-standard', name: '시안', acCode: 'AC-C102', hexCode: '#2dccd3', category: 'clear-a' },
  { id: 'teal', name: '틸', acCode: 'AC-C103', hexCode: '#009ca6', category: 'clear-a' },
  { id: 'navy', name: '네이비', acCode: 'AC-C104', hexCode: '#007377', category: 'clear-a' },
  { id: 'sky-blue', name: '하늘색', acCode: 'AC-C111', hexCode: '#6ad1e3', category: 'clear-a' },
  { id: 'turquoise', name: '터키석', acCode: 'AC-C112', hexCode: '#05c3dd', category: 'clear-a' },
  { id: 'ocean-blue', name: '오션 블루', acCode: 'AC-C113', hexCode: '#00a9ce', category: 'clear-a' },
  { id: 'steel-blue', name: '스틸 블루', acCode: 'AC-C114', hexCode: '#0092bc', category: 'clear-a' },
  { id: 'powder-blue', name: '파우더 블루', acCode: 'AC-C121', hexCode: '#92c1e9', category: 'clear-a' },
  { id: 'cerulean', name: '세룰리안', acCode: 'AC-C122', hexCode: '#00b5e2', category: 'clear-a' },
  { id: 'sapphire', name: '사파이어', acCode: 'AC-C123', hexCode: '#0085ca', category: 'clear-a' },
  { id: 'midnight', name: '미드나잇', acCode: 'AC-C124', hexCode: '#00587c', category: 'clear-a' },
  { id: 'blue-light', name: '연블루', acCode: 'AC-C131', hexCode: '#a7c6ed', category: 'clear-a' },
  { id: 'blue-standard', name: '블루', acCode: 'AC-C132', hexCode: '#307fe2', category: 'clear-a' },
  { id: 'blue-dark', name: '진블루', acCode: 'AC-C133', hexCode: '#0032a0', category: 'clear-a' },
  { id: 'indigo', name: '인디고', acCode: 'AC-C134', hexCode: '#10069f', category: 'clear-a' },
  { id: 'lavender', name: '라벤더', acCode: 'AC-C141', hexCode: '#ad96dc', category: 'clear-a' },
  { id: 'violet', name: '바이올렛', acCode: 'AC-C142', hexCode: '#7d55c7', category: 'clear-a' },
  { id: 'royal-purple', name: '로얄 퍼플', acCode: 'AC-C143', hexCode: '#6244bb', category: 'clear-a' },
  { id: 'deep-purple', name: '딥 퍼플', acCode: 'AC-C144', hexCode: '#440099', category: 'clear-a' },
  { id: 'lilac', name: '라일락', acCode: 'AC-C151', hexCode: '#c1a7e2', category: 'clear-a' },
  { id: 'amethyst', name: '자수정', acCode: 'AC-C152', hexCode: '#9063cd', category: 'clear-a' },
  { id: 'orchid', name: '오키드', acCode: 'AC-C153', hexCode: '#753bbd', category: 'clear-a' },
  { id: 'eggplant', name: '에그플랜트', acCode: 'AC-C154', hexCode: '#5f249f', category: 'clear-a' },
  { id: 'purple-light', name: '연퍼플', acCode: 'AC-C161', hexCode: '#dd9cdf', category: 'clear-a' },
  { id: 'purple-standard', name: '퍼플', acCode: 'AC-C162', hexCode: '#c964cf', category: 'clear-a' },
  { id: 'purple-dark', name: '진퍼플', acCode: 'AC-C163', hexCode: '#bb29bb', category: 'clear-a' },
  { id: 'wine', name: '와인', acCode: 'AC-C164', hexCode: '#981e97', category: 'clear-a' },
  { id: 'pink-pastel', name: '파스텔 핑크', acCode: 'AC-C171', hexCode: '#f4a6d7', category: 'clear-a' },
  { id: 'magenta', name: '마젠타', acCode: 'AC-C172', hexCode: '#f277c6', category: 'clear-a' },
  { id: 'hot-pink', name: '핫 핑크', acCode: 'AC-C173', hexCode: '#e10098', category: 'clear-a' },
  { id: 'berry', name: '베리', acCode: 'AC-C174', hexCode: '#a20067', category: 'clear-a' },
  { id: 'light-gray', name: '라이트 그레이', acCode: 'AC-C181', hexCode: '#9d9994', category: 'clear-a' },
  { id: 'charcoal', name: '차콜', acCode: 'AC-C182', hexCode: '#4c4e56', category: 'clear-a' },
  { id: 'jet-black', name: '제트 블랙', acCode: 'AC-C183', hexCode: '#25282a', category: 'clear-a' },
  { id: 'black', name: '블랙', acCode: 'AC-C184', hexCode: '#2d2c2f', category: 'clear-a' },
  { id: 'fluorescent-red', name: '형광 레드', acCode: 'AC-C191', hexCode: '#ff5555', category: 'clear-a' },
  { id: 'fluorescent-orange', name: '형광 오렌지', acCode: 'AC-C192', hexCode: '#fc8427', category: 'clear-a' },
  { id: 'fluorescent-yellow', name: '형광 노랑', acCode: 'AC-C193', hexCode: '#ffcf00', category: 'clear-a' },
  { id: 'neon-yellow', name: '네온 노랑', acCode: 'AC-C194', hexCode: '#ffdf5e', category: 'clear-a' },
  { id: 'neon-green', name: '네온 그린', acCode: 'AC-C195', hexCode: '#c8ff00', category: 'clear-a' },
  { id: 'fluorescent-pink', name: '형광 핑크', acCode: 'AC-C196', hexCode: '#fe1493', category: 'clear-a' },

  // 클리어 B 색상
  { id: 'brown-clear-b', name: '브라운 B', acCode: 'AC-C006', hexCode: '#ae8a79', category: 'clear-b' },
  { id: 'rust-clear-b', name: '러스트 B', acCode: 'AC-C007', hexCode: '#a9431e', category: 'clear-b' },
  { id: 'burgundy-clear-b', name: '버건디 B', acCode: 'AC-C008', hexCode: '#8a2a2b', category: 'clear-b' },
  { id: 'empty-009', name: '', acCode: 'AC-C009', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'pastel-pink-clear-b', name: '파스텔 핑크 B', acCode: 'AC-C016', hexCode: '#fcafc0', category: 'clear-b' },
  { id: 'rose-clear-b', name: '로즈 B', acCode: 'AC-C017', hexCode: '#ff8da1', category: 'clear-b' },
  { id: 'maroon-clear-b', name: '마룬 B', acCode: 'AC-C018', hexCode: '#6d3332', category: 'clear-b' },
  { id: 'empty-019', name: '', acCode: 'AC-C019', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'peach-clear-b', name: '피치 B', acCode: 'AC-C026', hexCode: '#ffa38b', category: 'clear-b' },
  { id: 'orange-red-clear-b', name: '오렌지 레드 B', acCode: 'AC-C027', hexCode: '#fa4616', category: 'clear-b' },
  { id: 'crimson-clear-b', name: '크림슨 B', acCode: 'AC-C028', hexCode: '#af272f', category: 'clear-b' },
  { id: 'empty-029', name: '', acCode: 'AC-C029', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'light-orange-clear-b', name: '연오렌지 B', acCode: 'AC-C036', hexCode: '#ffb990', category: 'clear-b' },
  { id: 'dark-orange-clear-b', name: '다크 오렌지 B', acCode: 'AC-C037', hexCode: '#fc4c02', category: 'clear-b' },
  { id: 'warm-red-clear-b', name: '웜 레드 B', acCode: 'AC-C038', hexCode: '#f9423a', category: 'clear-b' },
  { id: 'empty-039', name: '', acCode: 'AC-C039', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'light-peach-clear-b', name: '연피치 B', acCode: 'AC-C046', hexCode: '#fecb8b', category: 'clear-b' },
  { id: 'golden-orange-clear-b', name: '골든 오렌지 B', acCode: 'AC-C047', hexCode: '#ffad00', category: 'clear-b' },
  { id: 'burnt-orange-clear-b', name: '번트 오렌지 B', acCode: 'AC-C048', hexCode: '#e57200', category: 'clear-b' },
  { id: 'rust-orange-clear-b', name: '러스트 오렌지 B', acCode: 'AC-C049', hexCode: '#dc4405', category: 'clear-b' },
  { id: 'bright-yellow-clear-b', name: '브라이트 옐로우 B', acCode: 'AC-C056', hexCode: '#fedb00', category: 'clear-b' },
  { id: 'golden-yellow-clear-b', name: '골든 옐로우 B', acCode: 'AC-C057', hexCode: '#f2ca00', category: 'clear-b' },
  { id: 'olive-yellow-clear-b', name: '올리브 옐로우 B', acCode: 'AC-C058', hexCode: '#a76d11', category: 'clear-b' },
  { id: 'empty-059', name: '', acCode: 'AC-C059', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'lime-yellow-clear-b', name: '라임 옐로우 B', acCode: 'AC-C066', hexCode: '#f3e500', category: 'clear-b' },
  { id: 'bright-lime-clear-b', name: '브라이트 라임 B', acCode: 'AC-C067', hexCode: '#fdda24', category: 'clear-b' },
  { id: 'olive-green-clear-b', name: '올리브 그린 B', acCode: 'AC-C068', hexCode: '#af9800', category: 'clear-b' },
  { id: 'dark-olive-clear-b', name: '다크 올리브 B', acCode: 'AC-C069', hexCode: '#897a27', category: 'clear-b' },
  { id: 'lime-green-clear-b', name: '라임 그린 B', acCode: 'AC-C076', hexCode: '#c0df16', category: 'clear-b' },
  { id: 'bright-green-clear-b', name: '브라이트 그린 B', acCode: 'AC-C077', hexCode: '#44d62c', category: 'clear-b' },
  { id: 'forest-green-clear-b', name: '포레스트 그린 B', acCode: 'AC-C078', hexCode: '#97d700', category: 'clear-b' },
  { id: 'moss-green-clear-b', name: '모스 그린 B', acCode: 'AC-C079', hexCode: '#79863c', category: 'clear-b' },
  { id: 'emerald-green-clear-b', name: '에메랄드 그린 B', acCode: 'AC-C086', hexCode: '#00bf6f', category: 'clear-b' },
  { id: 'jade-green-clear-b', name: '제이드 그린 B', acCode: 'AC-C087', hexCode: '#00b140', category: 'clear-b' },
  { id: 'pine-green-clear-b', name: '파인 그린 B', acCode: 'AC-C088', hexCode: '#44883e', category: 'clear-b' },
  { id: 'empty-089', name: '', acCode: 'AC-C089', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'teal-clear-b', name: '틸 B', acCode: 'AC-C096', hexCode: '#49c5b1', category: 'clear-b' },
  { id: 'turquoise-clear-b', name: '터키석 B', acCode: 'AC-C097', hexCode: '#00b388', category: 'clear-b' },
  { id: 'sea-green-clear-b', name: '시 그린 B', acCode: 'AC-C098', hexCode: '#00ab84', category: 'clear-b' },
  { id: 'empty-099', name: '', acCode: 'AC-C099', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'light-cyan-clear-b', name: '연시안 B', acCode: 'AC-C106', hexCode: '#a4dbe8', category: 'clear-b' },
  { id: 'bright-cyan-clear-b', name: '브라이트 시안 B', acCode: 'AC-C107', hexCode: '#00b398', category: 'clear-b' },
  { id: 'dark-cyan-clear-b', name: '다크 시안 B', acCode: 'AC-C108', hexCode: '#009681', category: 'clear-b' },
  { id: 'empty-109', name: '', acCode: 'AC-C109', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'light-blue-clear-b', name: '연블루 B', acCode: 'AC-C116', hexCode: '#b9d9eb', category: 'clear-b' },
  { id: 'sky-blue-clear-b', name: '하늘색 B', acCode: 'AC-C117', hexCode: '#4ec3e0', category: 'clear-b' },
  { id: 'ocean-blue-clear-b', name: '오션 블루 B', acCode: 'AC-C118', hexCode: '#00a9ce', category: 'clear-b' },
  { id: 'empty-119', name: '', acCode: 'AC-C119', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'powder-blue-clear-b', name: '파우더 블루 B', acCode: 'AC-C126', hexCode: '#c3d7ee', category: 'clear-b' },
  { id: 'cornflower-clear-b', name: '콘플라워 B', acCode: 'AC-C127', hexCode: '#69b3e7', category: 'clear-b' },
  { id: 'royal-blue-clear-b', name: '로얄 블루 B', acCode: 'AC-C128', hexCode: '#0077c8', category: 'clear-b' },
  { id: 'navy-blue-clear-b', name: '네이비 블루 B', acCode: 'AC-C129', hexCode: '#007fa3', category: 'clear-b' },
  { id: 'periwinkle-clear-b', name: '페리윙클 B', acCode: 'AC-C136', hexCode: '#cbd3eb', category: 'clear-b' },
  { id: 'bright-blue-clear-b', name: '브라이트 블루 B', acCode: 'AC-C137', hexCode: '#00a9e0', category: 'clear-b' },
  { id: 'deep-blue-clear-b', name: '딥 블루 B', acCode: 'AC-C138', hexCode: '#0033a0', category: 'clear-b' },
  { id: 'indigo-clear-b', name: '인디고 B', acCode: 'AC-C139', hexCode: '#10069f', category: 'clear-b' },
  { id: 'lavender-clear-b', name: '라벤더 B', acCode: 'AC-C146', hexCode: '#ad96dc', category: 'clear-b' },
  { id: 'violet-clear-b', name: '바이올렛 B', acCode: 'AC-C147', hexCode: '#7d55c7', category: 'clear-b' },
  { id: 'deep-purple-clear-b', name: '딥 퍼플 B', acCode: 'AC-C148', hexCode: '#330072', category: 'clear-b' },
  { id: 'empty-149', name: '', acCode: 'AC-C149', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'empty-206', name: '', acCode: 'AC-C206', hexCode: '', category: 'clear-b', isEmpty: true },
  { id: 'silver-gray-clear-b', name: '실버 그레이 B', acCode: 'AC-C207', hexCode: '#b3b0c4', category: 'clear-b' },
  { id: 'steel-gray-clear-b', name: '스틸 그레이 B', acCode: 'AC-C208', hexCode: '#1f2a44', category: 'clear-b' },
  { id: 'charcoal-gray-clear-b', name: '차콜 그레이 B', acCode: 'AC-C209', hexCode: '#13294b', category: 'clear-b' }
];

interface ColorSelectionProps {
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorSelection: React.FC<ColorSelectionProps> = ({
  selectedColor,
  onColorSelect
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  // AC 코드 숫자 순서로 정렬
  const sortedColors = [...COLOR_OPTIONS].sort((a, b) => {
    const aCode = parseInt(a.acCode.replace('AC-C', ''));
    const bCode = parseInt(b.acCode.replace('AC-C', ''));
    return aCode - bCode;
  });

  // 카테고리별 분류
  const categories = [
    {
      id: 'clear-a',
      name: '클리어 A',
      description: '클리어 A 색상 팔레트',
      colors: sortedColors.filter(color => color.category === 'clear-a')
    },
    {
      id: 'clear-b',
      name: '클리어 B',
      description: '클리어 B 색상 팔레트',
      colors: sortedColors.filter(color => color.category === 'clear-b')
    }
  ];

  // 검색 결과 필터링
  const getFilteredColors = () => {
    if (!searchTerm) {
      return categories;
    }
    
    return categories.map(category => ({
      ...category,
      colors: category.colors.filter(color => 
        !color.isEmpty && (
          color.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          color.acCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
          color.hexCode.toLowerCase().includes(searchTerm.toLowerCase())
        )
      )
    })).filter(category => category.colors.length > 0);
  };

  const displayCategories = getFilteredColors();

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">3. 색상을 선택해주세요</h3>
        <p className="text-gray-600">원하는 색상을 선택해주세요</p>
      </div>
      
      {/* 검색 기능 */}
      <div className="relative max-w-md mx-auto">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <Input
          type="text"
          placeholder="색상명, AC 코드, HEX 코드로 검색..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 w-full"
        />
      </div>

      {/* 색상 카테고리별 표시 */}
      {!searchTerm ? (
        <div className="space-y-8">
          {categories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{category.name}</h4>
                <p className="text-sm text-gray-600">{category.description}</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {category.colors.map((color) => (
                  <div
                    key={color.id}
                    className={`relative group ${
                      color.isEmpty 
                        ? 'cursor-not-allowed opacity-50' 
                        : 'cursor-pointer'
                    } ${
                      selectedColor === color.id ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    onClick={() => !color.isEmpty && onColorSelect(color.id)}
                  >
                    <div 
                      className={`w-full h-20 rounded-lg border border-gray-200 transition-all duration-200 ${
                        color.isEmpty 
                          ? 'bg-gray-100 border-dashed' 
                          : 'shadow-sm group-hover:shadow-md'
                      }`}
                      style={!color.isEmpty ? { backgroundColor: color.hexCode } : {}}
                    />
                    <div className="mt-2 text-center">
                      <div className="text-sm font-bold text-gray-500">{color.acCode}</div>
                      {!color.isEmpty && (
                        <div className="text-xs text-gray-400">{color.hexCode}</div>
                      )}
                    </div>
                    {selectedColor === color.id && !color.isEmpty && (
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
      ) : (
        /* 검색 결과 표시 */
        <div className="space-y-8">
          {displayCategories.map((category) => (
            <div key={category.id} className="space-y-4">
              <div>
                <h4 className="text-lg font-semibold text-gray-900">{category.name}</h4>
                <p className="text-sm text-gray-600">검색 결과: {category.colors.length}개</p>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {category.colors.map((color) => (
                  <div
                    key={color.id}
                    className={`relative cursor-pointer group ${
                      selectedColor === color.id ? 'ring-2 ring-primary ring-offset-2' : ''
                    }`}
                    onClick={() => onColorSelect(color.id)}
                  >
                    <div 
                      className="w-full h-20 rounded-lg border border-gray-200 shadow-sm group-hover:shadow-md transition-all duration-200"
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
      )}

      {/* 검색 결과 없음 메시지 */}
      {searchTerm && displayCategories.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">검색 결과가 없습니다.</p>
          <p className="text-sm text-gray-400 mt-1">다른 검색어를 시도해보세요.</p>
        </div>
      )}
    </div>
  );
};

export default ColorSelection;