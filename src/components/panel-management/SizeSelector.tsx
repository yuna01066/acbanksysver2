import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SizeSelectorProps {
  qualityId: string;
  productName: string;
  onSelectSize: (sizeId: string, sizeName: string) => void;
  onBack: () => void;
  selectedSizeId: string | null;
}

interface PanelSizeInfo {
  baseName: string;
  baseWidth: number;
  baseHeight: number;
}

interface SizeData {
  sizeName: string;
  actualWidth: number;
  actualHeight: number;
}

export function SizeSelector({ qualityId, productName, onSelectSize, onBack, selectedSizeId }: SizeSelectorProps) {
  const { toast } = useToast();
  const [sizes, setSizes] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSizes = async () => {
      try {
        setLoading(true);
        
        // Get distinct sizes for this quality from panel_sizes joined with panel_masters
        const { data, error } = await supabase
          .from('panel_sizes')
          .select(`
            size_name,
            actual_width,
            actual_height,
            panel_masters!inner(quality)
          `)
          .eq('panel_masters.quality', qualityId as any)
          .eq('is_active', true);

        if (error) throw error;

        // Get unique sizes (some sizes may appear multiple times with different thicknesses)
        const uniqueSizes = Array.from(
          new Map(
            data.map(item => [
              item.size_name,
              {
                sizeName: item.size_name,
                actualWidth: item.actual_width,
                actualHeight: item.actual_height
              }
            ])
          ).values()
        );

        setSizes(uniqueSizes);
      } catch (error) {
        console.error('Error fetching sizes:', error);
        toast({
          title: "오류",
          description: "사이즈 목록을 불러오는데 실패했습니다.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSizes();
  }, [qualityId, toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>로딩 중...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button onClick={onBack} variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <CardTitle>{productName} - 사이즈 선택</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sizes.map((size) => {
            const isSelected = selectedSizeId === size.sizeName;
            
            return (
              <div
                key={size.sizeName}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  isSelected 
                    ? 'border-primary bg-primary/5 shadow-md' 
                    : 'border-border bg-card hover:border-muted-foreground/30'
                }`}
                onClick={() => onSelectSize(size.sizeName, size.sizeName)}
              >
                <div className="text-center space-y-2">
                  <div className="font-semibold text-lg">
                    {size.sizeName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>{size.actualWidth}×{size.actualHeight}mm</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {sizes.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            사이즈가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
