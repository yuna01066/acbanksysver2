import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Palette } from "lucide-react";
import { getColorSeriesLabel, getColorSeriesTab, hasExplicitSeriesTabs } from '@/utils/colorSeries';
import {
  ColorOptionAttributes,
  getColorAttributeBadges,
  getColorAttributes,
  getColorSearchTokens,
  getColorSelectionTypeLabel,
  isBrightPigmentColor,
  isWhiteOpacityReference,
} from '@/utils/colorAttributes';

interface ColorOption {
  id: string;
  color_name: string;
  color_code: string;
  is_active: boolean;
  is_producible?: boolean;
  is_bright_pigment?: boolean;
  unavailable_reason?: string | null;
  color_attribute_note?: string | null;
  series_key?: string | null;
  pantone?: string | null;
  source_url?: string | null;
  attributes?: ColorOptionAttributes | null;
}

interface ColorSelectionProps {
  selectedColor: string;
  onColorSelect: (id: string, extraInfo?: { 
    acCode: string; 
    hexCode: string;
    customColorName?: string;
    customOpacity?: string;
    isBrightPigment?: boolean;
    colorTypeLabel?: string;
    colorAttributes?: ColorOptionAttributes;
  }) => void;
  selectedQuality?: { id: string; name: string } | null;
  initialCustomColor?: string;
  initialCustomColorName?: string;
  initialCustomOpacity?: string;
}

const MIRROR_FALLBACK_COLORS: Record<string, ColorOption> = {
  'acrylic-mirror': {
    id: 'fallback-acrylic-mirror',
    color_name: 'MIRROR 미러',
    color_code: '#d8dde6',
    is_active: true,
    is_producible: true,
    color_attribute_note: '미러 기본 색상'
  },
  'astel-mirror': {
    id: 'fallback-astel-mirror',
    color_name: 'ASTEL-MIRROR 아스텔 미러',
    color_code: '#e4e7ec',
    is_active: true,
    is_producible: true,
    color_attribute_note: '아스텔 미러 기본 색상'
  },
  'satin-mirror': {
    id: 'fallback-satin-mirror',
    color_name: 'SATIN-MIRROR 사틴 미러',
    color_code: '#eef0f3',
    is_active: true,
    is_producible: true,
    color_attribute_note: '사틴 미러 기본 색상'
  },
};

const getMirrorFallbackColors = (qualityId?: string | null): ColorOption[] => {
  if (!qualityId) return [];
  const fallbackColor = MIRROR_FALLBACK_COLORS[qualityId];
  return fallbackColor ? [fallbackColor] : [];
};

const ColorSelection: React.FC<ColorSelectionProps> = ({ 
  selectedColor, 
  onColorSelect, 
  selectedQuality,
  initialCustomColor,
  initialCustomColorName,
  initialCustomOpacity
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customColor, setCustomColor] = useState(initialCustomColor || '#ffffff');
  const [customColorName, setCustomColorName] = useState(initialCustomColorName || '');
  const [customOpacity, setCustomOpacity] = useState(initialCustomOpacity || '');
  const isCustomSelected = selectedColor?.startsWith('CUSTOM');
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);
  const colorLookupQualityId = selectedQuality?.id === 'satin-mirror'
    ? 'glossy-color'
    : selectedQuality?.id;

  // panel_master 조회
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-for-colors', colorLookupQualityId],
    queryFn: async () => {
      if (!colorLookupQualityId) return null;
      
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', colorLookupQualityId as any)
        .maybeSingle();

      if (error) {
        console.error('Error fetching panel master:', error);
        return null;
      }
      return data;
    },
    enabled: !!colorLookupQualityId,
  });

  // DB에서 컬러 옵션 조회
  const { data: colors, isLoading } = useQuery({
    queryKey: ['color-options', panelMaster?.id],
    queryFn: async () => {
      if (!panelMaster?.id) return [];
      
      const { data, error } = await supabase
        .from('color_options')
        .select('*')
        .eq('panel_master_id', panelMaster.id)
        .eq('is_active', true)
        .neq('is_producible', false)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching colors:', error);
        return [];
      }
      
      return data as ColorOption[];
    },
    enabled: !!panelMaster?.id,
    refetchOnWindowFocus: true, // 윈도우 포커스 시 자동 새로고침
  });

  // 검색 필터링 및 카테고리 분리
  const [activeTab, setActiveTab] = React.useState<'A' | 'B' | 'reference'>('A');
  const colorOptions = colors && colors.length > 0
    ? colors
    : getMirrorFallbackColors(selectedQuality?.id);
  
  const hasSeriesTabs = hasExplicitSeriesTabs(colorOptions);
  const referenceColors = colorOptions.filter(isWhiteOpacityReference);
  const regularColors = colorOptions.filter(color => !isWhiteOpacityReference(color));
  const categoryAColors = regularColors.filter(color => getColorSeriesTab(color) === 'A');
  const categoryBColors = regularColors.filter(color => getColorSeriesTab(color) === 'B');
  const hasColorTabs = hasSeriesTabs || referenceColors.length > 0;
  const displayColors = hasColorTabs
    ? activeTab === 'reference'
      ? referenceColors
      : activeTab === 'A'
        ? categoryAColors
        : categoryBColors
    : colorOptions;

  useEffect(() => {
    setActiveTab(categoryAColors.length > 0 ? 'A' : referenceColors.length > 0 ? 'reference' : 'B');
  }, [selectedQuality?.id, categoryAColors.length, referenceColors.length]);
  
  const filteredColors = displayColors.filter(color => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const acCode = color.color_name.split(' ')[0] || '';
    return (
      acCode.toLowerCase().includes(search) ||
      color.color_code?.toLowerCase().includes(search) ||
      color.pantone?.toLowerCase().includes(search) ||
      getColorSearchTokens(color).includes(search)
    );
  });

  const materialGuide = (() => {
    switch (selectedQuality?.id) {
      case 'glossy-color':
        return 'Clear는 유광 기본 컬러입니다. 화이트 기준 컬러는 투명도 단계와 백색 안료 기준을 구분해서 표시합니다.';
      case 'satin-color':
        return 'Satin은 Clear 기본가에 조색비, 사틴 추가금, 양단면 추가금 기준으로 계산됩니다.';
      case 'astel-color':
        return 'Astel은 Clear 기본가에 조색비, 아스텔 추가금, 양단면 추가금 기준으로 계산됩니다.';
      case 'bright-color':
        return 'Bright는 AC-B004 백색 안료 60 기준의 스리/진백 계열 추가금 대상입니다.';
      case 'acrylic-mirror':
      case 'astel-mirror':
      case 'satin-mirror':
        return 'Mirror 계열은 재질 선택 단계에서 미러증착 비용이 포함되고, 하드코팅은 후가공 옵션에서 선택합니다.';
      default:
        return '';
    }
  })();

  const handleCustomColorApply = () => {
    if (!customColorName.trim()) {
      alert('색상명을 입력해주세요.');
      return;
    }
    
    const acCode = customOpacity ? `CUSTOM-${customOpacity}%` : 'CUSTOM';
    onColorSelect(`custom-${Date.now()}`, { 
      acCode: acCode, 
      hexCode: customColor,
      customColorName: customColorName,
      customOpacity: customOpacity
    });
    
    setIsCustomDialogOpen(false);
    setCustomColorName('');
    setCustomOpacity('');
    setCustomColor('#ffffff');
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="mb-2 text-2xl font-semibold text-slate-950">색상을 선택해주세요</h3>
          <p className="text-slate-500">컬러 옵션을 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="mb-2 text-2xl font-semibold text-slate-950">색상을 선택해주세요</h3>
        <p className="text-slate-500">원하는 색상을 선택해주세요</p>
      </div>
      {materialGuide && (
        <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {materialGuide}
        </div>
      )}
      
      {/* 검색 기능 및 커스텀 조색 버튼 */}
      <div className="flex gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-slate-400" />
          </div>
          <Input
            type="text"
            placeholder="색상명, AC 코드, HEX 코드로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 w-full"
          />
        </div>
        
        <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="outline" 
              className={`flex items-center gap-2 whitespace-nowrap ${
                isCustomSelected ? 'border-slate-950 bg-slate-50 text-slate-950 ring-2 ring-slate-950' : ''
              }`}
            >
              {isCustomSelected && customColor && (
                <div 
                  className="w-4 h-4 rounded border border-border" 
                  style={{ backgroundColor: customColor }}
                />
              )}
              <Palette className="h-4 w-4" />
              커스텀 조색
              {isCustomSelected && <span className="text-xs">(선택됨)</span>}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md bg-background">
            <DialogHeader>
              <DialogTitle>커스텀 색상 설정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="color-picker">색상 선택</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="color-picker"
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-12 w-20 cursor-pointer rounded border border-slate-300"
                  />
                  <div className="flex-1">
                    <Input
                      type="text"
                      value={customColor}
                      onChange={(e) => setCustomColor(e.target.value)}
                      placeholder="#FFFFFF"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="opacity">투명도 선택 (선택사항)</Label>
                <select
                  id="opacity"
                  className="w-full rounded-md border border-slate-300 bg-background px-3 py-2"
                  value={customOpacity}
                  onChange={(e) => setCustomOpacity(e.target.value)}
                >
                  <option value="">투명도를 선택하세요</option>
                  <option value="10">Opacity 10%</option>
                  <option value="20">Opacity 20%</option>
                  <option value="40">Opacity 40%</option>
                  <option value="60">Opacity 60%</option>
                  <option value="80">Opacity 80%</option>
                  <option value="100">Opacity 100% (화이트 불투명)</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="color-name">팬톤 색상명</Label>
                <Input
                  id="color-name"
                  type="text"
                  placeholder="예: PT 286 C (선택사항)"
                  value={customColorName}
                  onChange={(e) => setCustomColorName(e.target.value)}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  variant="outline" 
                  onClick={() => setIsCustomDialogOpen(false)}
                >
                  취소
                </Button>
                <Button onClick={handleCustomColorApply}>
                  적용
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {hasColorTabs && (
        <div className="flex gap-2 border-b mb-4">
          {categoryAColors.length > 0 && (
            <button
              onClick={() => setActiveTab('A')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'A'
                  ? 'border-b-2 border-slate-950 text-slate-950'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              A 시리즈 ({categoryAColors.length})
            </button>
          )}
          {categoryBColors.length > 0 && (
            <button
              onClick={() => setActiveTab('B')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'B'
                  ? 'border-b-2 border-slate-950 text-slate-950'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              B 시리즈 ({categoryBColors.length})
            </button>
          )}
          {referenceColors.length > 0 && (
            <button
              onClick={() => setActiveTab('reference')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'reference'
                  ? 'border-b-2 border-slate-950 text-slate-950'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              화이트 기준 ({referenceColors.length})
            </button>
          )}
        </div>
      )}

      {/* 색상 그리드 */}
      <div className="space-y-4">
        {filteredColors.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredColors.map((color) => {
              const acCode = color.color_name.split(' ')[0] || '';
              const isSelected = selectedColor === color.id || selectedColor === acCode;
              const attributes = getColorAttributes(color.attributes);
              const badges = getColorAttributeBadges(color);
              const brightPigment = isBrightPigmentColor(color);
              const colorTypeLabel = getColorSelectionTypeLabel(color);
              
              return (
                <div
                  key={color.id}
                  className="relative group cursor-pointer"
                  onClick={() => onColorSelect(color.id, { 
                    acCode, 
                    hexCode: color.color_code || '',
                    isBrightPigment: brightPigment,
                    colorTypeLabel,
                    colorAttributes: attributes,
                  })}
                >
                  <div className={`aspect-square rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-slate-950 shadow-sm ring-2 ring-slate-950 ring-offset-2' 
                      : 'border-slate-200 hover:border-slate-500'
                  }`}>
                    <div 
                      className="w-full h-full rounded-md"
                      style={{ backgroundColor: color.color_code }}
                    />
                  </div>
                  <div className="mt-1 min-h-[3.75rem] text-center">
                    <div className="text-xs font-medium text-foreground truncate">
                      {acCode}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {color.pantone || color.color_code}
                    </div>
                    {brightPigment && (
                      <div className="text-[10px] font-medium text-rose-600 truncate">
                        화이트 안료 추가
                      </div>
                    )}
                    {color.series_key && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {getColorSeriesLabel(color.series_key)}
                      </div>
                    )}
                    {badges.length > 0 && (
                      <div className="mt-1 flex flex-wrap justify-center gap-1">
                        {badges.slice(0, 2).map((badge) => (
                          <span
                            key={badge}
                            className={`rounded-full px-1.5 py-0.5 text-[10px] leading-none ${
                              brightPigment && badge.includes('화이트 안료')
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}
                    {color.color_attribute_note && !badges.length && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        {color.color_attribute_note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">
              {searchTerm
                ? '검색 결과가 없습니다.'
                : hasColorTabs
                  ? `${activeTab === 'reference' ? '화이트 기준' : `${activeTab} 시리즈`}에 등록된 컬러가 없습니다.`
                  : '등록된 컬러가 없습니다.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorSelection;
