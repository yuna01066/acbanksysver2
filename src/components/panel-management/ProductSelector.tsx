import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PanelMaster {
  id: string;
  name: string;
  material: string;
  quality: string;
  description: string | null;
}

interface ProductSelectorProps {
  materialId: string;
  materialName: string;
  onSelectProduct: (masterId: string, productName: string) => void;
  onBack: () => void;
  selectedProductId: string | null;
  variant?: 'default' | 'compact';
}

export function ProductSelector({ materialId, materialName, onSelectProduct, onBack, selectedProductId, variant = 'default' }: ProductSelectorProps) {
  const isCompact = variant === 'compact';
  const panelMaterialId = materialId === 'casting' ? 'acrylic' : materialId;
  const { data: panelMasters = [], isLoading } = useQuery({
    queryKey: ['panel-management-products', panelMaterialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('id, name, quality, material')
        .eq('material', panelMaterialId as any)
        .order('name', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <Card className={isCompact ? 'border-border bg-white shadow-none' : undefined}>
      <CardHeader className={isCompact ? 'px-4 pb-2 pt-4' : undefined}>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className={isCompact ? 'text-base' : undefined}>재질 선택</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{materialName}의 재질을 선택해주세요.</p>
          </div>
          <Button onClick={onBack} variant="outline" size="sm" className={isCompact ? 'rounded-full shadow-none' : undefined}>
            소재 선택으로
          </Button>
        </div>
      </CardHeader>
      <CardContent className={isCompact ? 'px-4 pb-4' : undefined}>
        {isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">재질을 불러오는 중입니다.</div>
        )}
        <div className={isCompact ? 'grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5' : 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4'}>
          {panelMasters.map((quality) => (
            <Button
              key={quality.quality}
              variant={selectedProductId === quality.quality ? "default" : "outline"}
              className={isCompact ? 'h-11 rounded-full text-sm font-semibold shadow-none' : 'h-20 text-lg font-semibold'}
              onClick={() => onSelectProduct(quality.quality, quality.name)}
            >
              {quality.name}
            </Button>
          ))}
        </div>
        {!isLoading && panelMasters.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            등록된 원판 마스터가 없습니다.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
