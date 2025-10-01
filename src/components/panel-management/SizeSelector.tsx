import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PanelSize {
  id: string;
  panel_master_id: string;
  size_name: string;
  thickness: string;
  actual_width: number;
  actual_height: number;
  is_active: boolean;
}

interface SizeSelectorProps {
  masterId: string;
  productName: string;
  onSelectSize: (sizeId: string, sizeName: string) => void;
  onBack: () => void;
  selectedSizeId: string | null;
}

export function SizeSelector({ masterId, productName, onSelectSize, onBack, selectedSizeId }: SizeSelectorProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    size_name: '',
    thickness: '',
    actual_width: '',
    actual_height: ''
  });

  // Fetch sizes
  const { data: sizes = [], isLoading } = useQuery({
    queryKey: ['panel-sizes', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', masterId)
        .eq('is_active', true)
        .order('size_name');
      
      if (error) throw error;
      return data as PanelSize[];
    }
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('panel_sizes')
        .insert([{
          panel_master_id: masterId,
          size_name: data.size_name,
          thickness: data.thickness,
          actual_width: parseInt(data.actual_width),
          actual_height: parseInt(data.actual_height)
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast({ title: "사이즈가 추가되었습니다" });
      handleCancel();
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('panel_sizes')
        .update({
          size_name: data.size_name,
          thickness: data.thickness,
          actual_width: parseInt(data.actual_width),
          actual_height: parseInt(data.actual_height)
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast({ title: "사이즈가 수정되었습니다" });
      handleCancel();
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('panel_sizes')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast({ title: "사이즈가 삭제되었습니다" });
    }
  });

  const handleSubmit = () => {
    if (!formData.size_name.trim() || !formData.thickness.trim() || 
        !formData.actual_width || !formData.actual_height) {
      toast({ title: "모든 필드를 입력해주세요", variant: "destructive" });
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (size: PanelSize) => {
    setEditingId(size.id);
    setFormData({
      size_name: size.size_name,
      thickness: size.thickness,
      actual_width: size.actual_width.toString(),
      actual_height: size.actual_height.toString()
    });
    setIsAdding(true);
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData({ size_name: '', thickness: '', actual_width: '', actual_height: '' });
  };

  if (isLoading) {
    return <div className="text-center py-8">로딩 중...</div>;
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
          <Button
            onClick={() => setIsAdding(!isAdding)}
            variant="outline"
            size="sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            사이즈 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isAdding && (
          <div className="p-4 border rounded-lg space-y-4 bg-muted/50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="size_name">사이즈명</Label>
                <Input
                  id="size_name"
                  value={formData.size_name}
                  onChange={(e) => setFormData({ ...formData, size_name: e.target.value })}
                  placeholder="예: 3*6"
                />
              </div>
              <div>
                <Label htmlFor="thickness">두께</Label>
                <Input
                  id="thickness"
                  value={formData.thickness}
                  onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                  placeholder="예: 3T"
                />
              </div>
              <div>
                <Label htmlFor="actual_width">실제 가로 (mm)</Label>
                <Input
                  id="actual_width"
                  type="number"
                  value={formData.actual_width}
                  onChange={(e) => setFormData({ ...formData, actual_width: e.target.value })}
                  placeholder="예: 915"
                />
              </div>
              <div>
                <Label htmlFor="actual_height">실제 세로 (mm)</Label>
                <Input
                  id="actual_height"
                  type="number"
                  value={formData.actual_height}
                  onChange={(e) => setFormData({ ...formData, actual_height: e.target.value })}
                  placeholder="예: 1830"
                />
              </div>
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

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {sizes.map((size) => (
            <Button
              key={size.id}
              variant={selectedSizeId === size.id ? "default" : "outline"}
              className="h-auto flex-col p-4 relative group"
              onClick={() => onSelectSize(size.id, size.size_name)}
            >
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(size);
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
                    if (confirm(`"${size.size_name}"을(를) 삭제하시겠습니까?`)) {
                      deleteMutation.mutate(size.id);
                    }
                  }}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
              <span className="font-medium">{size.size_name}</span>
              <span className="text-xs text-muted-foreground mt-1">
                {size.actual_width} × {size.actual_height} mm
              </span>
            </Button>
          ))}
        </div>

        {sizes.length === 0 && !isAdding && (
          <div className="text-center py-8 text-muted-foreground">
            사이즈가 없습니다. 사이즈를 추가해주세요.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
