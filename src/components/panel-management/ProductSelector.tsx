import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  // Map material IDs to database enum values
  const materialDbValue = materialId === 'casting' || materialId === 'acrylic-dye' ? 'acrylic' as const : 'acrylic' as const;

  // Fetch products filtered by material
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['panel-masters', materialId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('material', materialDbValue)
        .order('name');
      
      if (error) throw error;
      return data as PanelMaster[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string }) => {
      // Map material IDs to database enum values
      const dbMaterialValue = materialId === 'casting' || materialId === 'acrylic-dye' ? 'acrylic' as const : 'acrylic' as const;
      
      // Map product names to quality enum values
      const qualityMap: Record<string, string> = {
        'Clear (클리어)': 'glossy-color',
        'Bright (브라이트)': 'satin-color',
        'Mirror (미러)': 'acrylic-mirror',
        'Astel (아스텔)': 'astel-color',
        'Astel Mirror (아스텔 미러)': 'astel-mirror'
      };
      
      const quality = qualityMap[data.name] || 'glossy-color';
      
      const { error } = await supabase
        .from('panel_masters')
        .insert([{ 
          name: data.name, 
          description: data.description,
          material: dbMaterialValue,
          quality: quality as any
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters', materialId] });
      toast({ title: "제품이 추가되었습니다" });
      setIsAdding(false);
      setFormData({ name: '', description: '' });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; description: string } }) => {
      const { error } = await supabase
        .from('panel_masters')
        .update({ name: data.name, description: data.description })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters', materialId] });
      toast({ title: "제품이 수정되었습니다" });
      setEditingId(null);
      setFormData({ name: '', description: '' });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('panel_masters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters', materialId] });
      toast({ title: "제품이 삭제되었습니다" });
    }
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      toast({ title: "제품명을 입력해주세요", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (product: PanelMaster) => {
    setEditingId(product.id);
    setFormData({ name: product.name, description: product.description || '' });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ name: '', description: '' });
  };

  if (isLoading) {
    return <div className="text-center py-8">로딩 중...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>재질 선택</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{materialName}의 재질을 선택해주세요</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onBack} variant="outline" size="sm">
              소재 선택으로
            </Button>
            <Button
              onClick={() => setIsAdding(!isAdding)}
              variant="outline"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              재질 추가
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <div>
              <Label htmlFor="name">재질명</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="예: Clear (클리어), Bright (브라이트)"
              />
            </div>
            <div>
              <Label htmlFor="description">설명 (선택사항)</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="재질 설명"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSubmit} size="sm">
                {editingId ? '수정' : '추가'}
              </Button>
              <Button onClick={handleCancel} variant="outline" size="sm">
                취소
              </Button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {products.map((product) => (
            <Button
              key={product.id}
              variant={selectedProductId === product.id ? "default" : "outline"}
              className="h-auto flex-col p-4 relative group"
              onClick={() => onSelectProduct(product.id, product.name)}
            >
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(product);
                  }}
                >
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${product.name}"을(를) 삭제하시겠습니까?`)) {
                      deleteMutation.mutate(product.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <span className="font-medium">{product.name}</span>
              {product.description && (
                <span className="text-xs text-muted-foreground mt-1">
                  {product.description}
                </span>
              )}
            </Button>
          ))}
        </div>

        {products.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            재질이 없습니다. 재질을 추가해주세요.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
