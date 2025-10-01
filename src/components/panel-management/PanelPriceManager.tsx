import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check } from "lucide-react";

interface PanelSize {
  id: string;
  thickness: string;
  size_name: string;
  actual_width: number;
  actual_height: number;
}

interface PanelPrice {
  id: string;
  panel_size_id: string;
  price: number;
  effective_from: string;
  effective_to: string | null;
  panel_sizes: PanelSize;
}

interface PanelPriceManagerProps {
  masterId: string;
}

export const PanelPriceManager = ({ masterId }: PanelPriceManagerProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    panel_size_id: '',
    price: ''
  });

  const { data: sizes } = useQuery({
    queryKey: ['panel-sizes', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', masterId)
        .eq('is_active', true)
        .order('thickness', { ascending: true })
        .order('size_name', { ascending: true });
      
      if (error) throw error;
      return data as PanelSize[];
    },
    enabled: !!masterId
  });

  const { data: prices, isLoading } = useQuery({
    queryKey: ['panel-prices', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_prices')
        .select(`
          *,
          panel_sizes!inner (
            id,
            thickness,
            size_name,
            actual_width,
            actual_height,
            panel_master_id
          )
        `)
        .eq('panel_sizes.panel_master_id', masterId)
        .is('effective_to', null)
        .order('panel_sizes.thickness', { ascending: true });
      
      if (error) throw error;
      return data as PanelPrice[];
    },
    enabled: !!masterId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('panel_prices')
        .insert([{
          panel_size_id: data.panel_size_id,
          price: parseFloat(data.price)
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-prices', masterId] });
      toast.success('가격이 추가되었습니다');
      setIsAdding(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('추가 실패: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      // 기존 가격을 만료시키고 새 가격 추가
      const { error: expireError } = await supabase
        .from('panel_prices')
        .update({ effective_to: new Date().toISOString() })
        .eq('id', id);
      
      if (expireError) throw expireError;

      const { error } = await supabase
        .from('panel_prices')
        .insert([{
          panel_size_id: data.panel_size_id,
          price: parseFloat(data.price)
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-prices', masterId] });
      toast.success('가격이 수정되었습니다');
      setEditingId(null);
      resetForm();
    },
    onError: (error) => {
      toast.error('수정 실패: ' + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('panel_prices')
        .update({ effective_to: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-prices', masterId] });
      toast.success('가격이 삭제되었습니다');
    },
    onError: (error) => {
      toast.error('삭제 실패: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      panel_size_id: '',
      price: ''
    });
  };

  const handleEdit = (price: PanelPrice) => {
    setEditingId(price.id);
    setFormData({
      panel_size_id: price.panel_size_id,
      price: price.price.toString()
    });
  };

  const handleSubmit = () => {
    if (!formData.panel_size_id || !formData.price) {
      toast.error('모든 필드를 입력해주세요');
      return;
    }

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>가격 관리</span>
            <Button
              onClick={() => {
                setIsAdding(!isAdding);
                if (isAdding) {
                  resetForm();
                }
              }}
              size="sm"
            >
              <Plus className="w-4 h-4 mr-2" />
              {isAdding ? '취소' : '새 가격 추가'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isAdding || editingId) && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">
                {editingId ? '가격 수정' : '새 가격 추가'}
              </h3>
              
              <div className="space-y-2">
                <Label>사이즈 선택</Label>
                <Select
                  value={formData.panel_size_id}
                  onValueChange={(value) => setFormData({ ...formData, panel_size_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="사이즈를 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes?.map((size) => (
                      <SelectItem key={size.id} value={size.id}>
                        {size.thickness} - {size.size_name} ({size.actual_width}×{size.actual_height}mm)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>가격 (원)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="예: 50000"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSubmit}>
                  <Check className="w-4 h-4 mr-2" />
                  {editingId ? '수정' : '추가'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                    resetForm();
                  }}
                >
                  취소
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {prices?.map((price) => (
              <div
                key={price.id}
                className="p-4 border rounded-lg flex items-center justify-between"
              >
                <div className="flex-1">
                  <h3 className="font-medium">
                    {price.panel_sizes.thickness} - {price.panel_sizes.size_name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {price.panel_sizes.actual_width}mm × {price.panel_sizes.actual_height}mm
                  </p>
                  <p className="text-lg font-bold mt-2">
                    {price.price.toLocaleString()}원
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(price)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('정말 삭제하시겠습니까?')) {
                        deleteMutation.mutate(price.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {prices?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                아직 등록된 가격이 없습니다. 새 가격을 추가해주세요.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
