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
}

export function ProductSelector({ materialId, materialName, onSelectProduct, onBack, selectedProductId }: ProductSelectorProps) {
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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재질 선택</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{materialName}의 재질을 선택해주세요</p>
          </div>
          <Button onClick={onBack} variant="outline" size="sm">
            소재 선택으로
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="py-8 text-center text-sm text-muted-foreground">재질을 불러오는 중입니다.</div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {panelMasters.map((quality) => (
            <Button
              key={quality.quality}
              variant={selectedProductId === quality.quality ? "default" : "outline"}
              className="h-20 text-lg font-semibold"
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
