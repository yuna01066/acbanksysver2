import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Check } from "lucide-react";

interface PanelMaster {
  id: string;
  material: 'acrylic' | 'pet';
  quality: 'glossy-color' | 'glossy-standard' | 'astel-color' | 'satin-color';
  name: string;
  description: string | null;
}

interface PanelMasterListProps {
  onSelectMaster: (masterId: string | null) => void;
  selectedMasterId: string | null;
}

const materialLabels: Record<string, string> = {
  'acrylic': '아크릴',
  'pet': 'PET'
};

const qualityLabels: Record<string, string> = {
  'glossy-color': '유광 컬러',
  'glossy-standard': '유광 스탠다드',
  'astel-color': '아스텔 컬러',
  'satin-color': '무광 컬러'
};

export const PanelMasterList = ({ onSelectMaster, selectedMasterId }: PanelMasterListProps) => {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    material: 'acrylic' | 'pet';
    quality: 'glossy-color' | 'glossy-standard' | 'astel-color' | 'satin-color';
    name: string;
    description: string;
  }>({
    material: 'acrylic',
    quality: 'glossy-color',
    name: '',
    description: ''
  });

  const { data: masters, isLoading } = useQuery({
    queryKey: ['panel-masters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as PanelMaster[];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('panel_masters')
        .insert([data]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters'] });
      toast.success('원판 마스터가 추가되었습니다');
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
        .from('panel_masters')
        .update(data)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters'] });
      toast.success('원판 마스터가 수정되었습니다');
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
        .from('panel_masters')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['panel-masters'] });
      toast.success('원판 마스터가 삭제되었습니다');
      if (selectedMasterId === editingId) {
        onSelectMaster(null);
      }
    },
    onError: (error) => {
      toast.error('삭제 실패: ' + error.message);
    }
  });

  const resetForm = () => {
    setFormData({
      material: 'acrylic',
      quality: 'glossy-color',
      name: '',
      description: ''
    });
  };

  const handleEdit = (master: PanelMaster) => {
    setEditingId(master.id);
    setFormData({
      material: master.material,
      quality: master.quality,
      name: master.name,
      description: master.description || ''
    });
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('이름을 입력해주세요');
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
            <span>원판 마스터 목록</span>
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
              {isAdding ? '취소' : '새 원판 추가'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(isAdding || editingId) && (
            <div className="mb-6 p-4 border rounded-lg space-y-4">
              <h3 className="font-medium">
                {editingId ? '원판 마스터 수정' : '새 원판 마스터 추가'}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>재질</Label>
                  <Select
                    value={formData.material}
                    onValueChange={(value: any) => setFormData({ ...formData, material: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acrylic">아크릴</SelectItem>
                      <SelectItem value="pet">PET</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>품질</Label>
                  <Select
                    value={formData.quality}
                    onValueChange={(value: any) => setFormData({ ...formData, quality: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="glossy-color">유광 컬러</SelectItem>
                      <SelectItem value="glossy-standard">유광 스탠다드</SelectItem>
                      <SelectItem value="astel-color">아스텔 컬러</SelectItem>
                      <SelectItem value="satin-color">무광 컬러</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>이름</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="예: 유광 컬러 아크릴"
                />
              </div>

              <div className="space-y-2">
                <Label>설명 (선택)</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="원판에 대한 추가 설명"
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
            {masters?.map((master) => (
              <div
                key={master.id}
                className={`p-4 border rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                  selectedMasterId === master.id ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                }`}
                onClick={() => onSelectMaster(master.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{master.name}</h3>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      {materialLabels[master.material]}
                    </span>
                    <span className="text-xs bg-secondary px-2 py-1 rounded">
                      {qualityLabels[master.quality]}
                    </span>
                  </div>
                  {master.description && (
                    <p className="text-sm text-muted-foreground mt-1">{master.description}</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(master);
                    }}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('정말 삭제하시겠습니까? 관련된 모든 사이즈와 가격 정보도 함께 삭제됩니다.')) {
                        deleteMutation.mutate(master.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
            {masters?.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                아직 등록된 원판 마스터가 없습니다. 새 원판을 추가해주세요.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
