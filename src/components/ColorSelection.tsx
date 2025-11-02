import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, Palette } from "lucide-react";

interface ColorOption {
  id: string;
  color_name: string;
  color_code: string;
  is_active: boolean;
}

interface ColorSelectionProps {
  selectedColor: string;
  onColorSelect: (id: string, extraInfo?: { acCode: string; hexCode: string }) => void;
  selectedQuality?: { id: string; name: string } | null;
}

const ColorSelection: React.FC<ColorSelectionProps> = ({ 
  selectedColor, 
  onColorSelect, 
  selectedQuality 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [customColor, setCustomColor] = useState('#ffffff');
  const [customColorName, setCustomColorName] = useState('');
  const [customOpacity, setCustomOpacity] = useState('');
  const [isCustomDialogOpen, setIsCustomDialogOpen] = useState(false);

  // panel_master 조회
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-for-colors', selectedQuality?.id],
    queryFn: async () => {
      if (!selectedQuality?.id) return null;
      
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', selectedQuality.id as any)
        .maybeSingle();

      if (error) {
        console.error('Error fetching panel master:', error);
        return null;
      }
      return data;
    },
    enabled: !!selectedQuality?.id,
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
  const [activeTab, setActiveTab] = React.useState<'A' | 'B'>('A');
  
  const categoryAColors = colors?.filter(color => {
    const acCode = color.color_name.split(' ')[0];
    const lastDigit = acCode.charAt(acCode.length - 1);
    return ['1', '2', '3', '4'].includes(lastDigit);
  }) || [];

  const categoryBColors = colors?.filter(color => {
    const acCode = color.color_name.split(' ')[0];
    const lastDigit = acCode.charAt(acCode.length - 1);
    return ['6', '7', '8', '9'].includes(lastDigit);
  }) || [];

  const displayColors = activeTab === 'A' ? categoryAColors : categoryBColors;
  
  const filteredColors = displayColors.filter(color => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const acCode = color.color_name.split(' ')[0] || '';
    return (
      acCode.toLowerCase().includes(search) ||
      color.color_code?.toLowerCase().includes(search)
    );
  });

  const handleCustomColorApply = () => {
    if (!customColorName.trim()) {
      alert('색상명을 입력해주세요.');
      return;
    }
    
    const acCode = customOpacity ? `CUSTOM-${customOpacity}%` : 'CUSTOM';
    onColorSelect(`custom-${Date.now()}`, { 
      acCode: acCode, 
      hexCode: customColor 
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
          <h3 className="text-2xl font-bold text-gray-900 mb-2">색상을 선택해주세요</h3>
          <p className="text-gray-600">컬러 옵션을 로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-gray-900 mb-2">색상을 선택해주세요</h3>
        <p className="text-gray-600">원하는 색상을 선택해주세요</p>
      </div>
      
      {/* 검색 기능 및 커스텀 조색 버튼 */}
      <div className="flex gap-3 max-w-2xl mx-auto">
        <div className="relative flex-1">
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
        
        <Dialog open={isCustomDialogOpen} onOpenChange={setIsCustomDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 whitespace-nowrap">
              <Palette className="h-4 w-4" />
              커스텀 조색
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
                    className="w-20 h-12 rounded border border-gray-300 cursor-pointer"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-background"
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

      {/* A/B 카테고리 탭 */}
      <div className="flex gap-2 border-b mb-4">
        <button
          onClick={() => setActiveTab('A')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'A'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          카테고리 A ({categoryAColors.length})
        </button>
        <button
          onClick={() => setActiveTab('B')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'B'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          카테고리 B ({categoryBColors.length})
        </button>
      </div>

      {/* 색상 그리드 */}
      <div className="space-y-4">
        {filteredColors.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {filteredColors.map((color) => {
              const isSelected = selectedColor === color.id;
              const acCode = color.color_name.split(' ')[0] || '';
              
              return (
                <div
                  key={color.id}
                  className="relative group cursor-pointer"
                  onClick={() => onColorSelect(color.id, { acCode, hexCode: color.color_code || '' })}
                >
                  <div className={`aspect-square rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-primary shadow-lg scale-105' 
                      : 'border-border hover:border-primary/50 hover:shadow-md'
                  }`}>
                    <div 
                      className="w-full h-full rounded-md"
                      style={{ backgroundColor: color.color_code }}
                    />
                  </div>
                  <div className="mt-1 text-center">
                    <div className="text-xs font-medium text-foreground truncate">
                      {acCode}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {color.color_code}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-muted/50 rounded-lg">
            <p className="text-muted-foreground">
              {searchTerm ? '검색 결과가 없습니다.' : `카테고리 ${activeTab}에 등록된 컬러가 없습니다.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ColorSelection;
