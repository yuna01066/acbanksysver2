import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface PanelSize {
  id: string;
  panel_master_id: string;
  thickness: string;
  size_name: string;
  actual_width: number;
  actual_height: number;
  is_active: boolean;
}

interface PanelSizeManagerProps {
  masterId: string;
}

export const PanelSizeManager = ({ masterId }: PanelSizeManagerProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    thickness: '',
    size_name: '',
    actual_width: '',
    actual_height: '',
    is_active: true
  });

  const { data: sizes, isLoading } = useQuery({
    queryKey: ['panel-sizes', masterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_sizes')
        .select('*')
        .eq('panel_master_id', masterId)
        .order('thickness', { ascending: true })
        .order('size_name', { ascending: true });
      
      if (error) throw error;
      return data as PanelSize[];
    },
    enabled: !!masterId
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('panel_sizes')
        .insert([{
          panel_master_id: masterId,
          thickness: data.thickness,
          size_name: data.size_name,
          actual_width: parseInt(data.actual_width),
          actual_height: parseInt(data.actual_height),
          is_active: data.is_active
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast.success('사이즈가 추가되었습니다');
      setIsAdding(false);
      resetForm();
    },
    onError: (error) => {
      toast.error('추가 실패: ' + error.message);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('panel_sizes')
        .update({
          thickness: data.thickness,
          size_name: data.size_name,
          actual_width: parseInt(data.actual_width),
          actual_height: parseInt(data.actual_height),
          is_active: data.is_active
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast.success('사이즈가 수정되었습니다');
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
        .from('panel_sizes')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-sizes', masterId] });
      toast.success('사이즈가 삭제되었습니다');
    },
    onError: (error) => {
      toast.error('삭제 실패: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      thickness: '',
      size_name: '',
      actual_width: '',
      actual_height: '',
      is_active: true
    });
  };

  const handleEdit = (size: PanelSize) => {
    setEditingId(size.id);
    setFormData({
      thickness: size.thickness,
      size_name: size.size_name,
      actual_width: size.actual_width.toString(),
      actual_height: size.actual_height.toString(),
      is_active: size.is_active
    });
  };

  const handleSubmit = () => {
    if (!formData.thickness || !formData.size_name || !formData.actual_width || !formData.actual_height) {
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
            <span>사이즈 관리</span>
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
              {isAdding ? '취소' : '새 사이즈 추가'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isAdding || editingId) && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">
                {editingId ? '사이즈 수정' : '새 사이즈 추가'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>두께</Label>
                  <Input
                    value={formData.thickness}
                    onChange={(e) => setFormData({ ...formData, thickness: e.target.value })}
                    placeholder="예: 10T, 15T"
                  />
                </div>

                <div className="space-y-2">
                  <Label>사이즈 이름</Label>
                  <Input
                    value={formData.size_name}
                    onChange={(e) => setFormData({ ...formData, size_name: e.target.value })}
                    placeholder="예: 3*6, 4*8"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>실제 가로 (mm)</Label>
                  <Input
                    type="number"
                    value={formData.actual_width}
                    onChange={(e) => setFormData({ ...formData, actual_width: e.target.value })}
                    placeholder="예: 860"
                  />
                </div>

                <div className="space-y-2">
                  <Label>실제 세로 (mm)</Label>
                  <Input
                    type="number"
                    value={formData.actual_height}
                    onChange={(e) => setFormData({ ...formData, actual_height: e.target.value })}
                    placeholder="예: 1750"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>활성화</Label>
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
            {sizes?.map((size) => (
              <div
                key={size.id}
                className="p-4 border rounded-lg flex items-center justify-between"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">
                      {size.thickness} - {size.size_name}
                    </h3>
                    {!size.is_active && (
                      <span className="text-xs bg-muted px-2 py-1 rounded">비활성</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    실제 크기: {size.actual_width}mm × {size.actual_height}mm
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(size)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('정말 삭제하시겠습니까?')) {
                        deleteMutation.mutate(size.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {sizes?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                아직 등록된 사이즈가 없습니다. 새 사이즈를 추가해주세요.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
