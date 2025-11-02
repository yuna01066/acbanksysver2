import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Database, Palette } from 'lucide-react';

interface OptionSelectorProps {
  materialName: string;
  onSelectOption: (option: 'size' | 'color') => void;
  onBack: () => void;
}

export function OptionSelector({ materialName, onSelectOption, onBack }: OptionSelectorProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>관리 옵션 선택</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{materialName}의 관리 항목을 선택해주세요</p>
          </div>
          <Button onClick={onBack} variant="outline" size="sm">
            소재 선택으로
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Button
            variant="outline"
            className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-accent"
            onClick={() => onSelectOption('size')}
          >
            <Database className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold text-lg">사이즈 / 가격 관리</div>
              <div className="text-sm text-muted-foreground mt-1">원판의 가용 사이즈와 가격을 관리합니다</div>
            </div>
          </Button>
          
          <Button
            variant="outline"
            className="h-32 flex flex-col items-center justify-center gap-3 hover:bg-accent"
            onClick={() => onSelectOption('color')}
          >
            <Palette className="w-8 h-8" />
            <div className="text-center">
              <div className="font-semibold text-lg">컬러 관리</div>
              <div className="text-sm text-muted-foreground mt-1">재질별 컬러 옵션을 관리합니다</div>
            </div>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
