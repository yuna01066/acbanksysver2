import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Trash2, Plus, AlertTriangle, Palette } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ColorOption {
  id: string;
  panel_master_id: string;
  color_name: string;
  color_code?: string;
  is_active: boolean;
  is_producible?: boolean;
  is_bright_pigment?: boolean;
  unavailable_reason?: string | null;
  color_attribute_note?: string | null;
  display_order: number;
}

interface ColorManagerProps {
  panelMasterId?: string;  // UUID
  qualityId?: string;       // 'glossy-color', 'astel-color', etc.
}

const ColorManager = ({ panelMasterId: propPanelMasterId, qualityId }: ColorManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ColorOption>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newColor, setNewColor] = useState({
    color_name: '',
    color_code: '',
    is_bright_pigment: false,
    is_producible: true,
    unavailable_reason: '',
    color_attribute_note: '',
  });

  // panel_master_id 조회 (qualityId가 주어진 경우)
  const { data: panelMaster } = useQuery({
    queryKey: ['panel-master-for-color', qualityId],
    queryFn: async () => {
      if (!qualityId) return null;
      
      const { data, error } = await supabase
        .from('panel_masters')
        .select('*')
        .eq('quality', qualityId as any)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!qualityId && !propPanelMasterId,
  });

  const panelMasterId = propPanelMasterId || panelMaster?.id;

  // 컬러 옵션 조회
  const { data: colors, isLoading } = useQuery({
    queryKey: ['color-options', panelMasterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_options')
        .select('*')
        .eq('panel_master_id', panelMasterId)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data as ColorOption[];
    },
    enabled: !!panelMasterId,
  });

  // A와 B 카테고리 분리
  const [activeTab, setActiveTab] = useState<'A' | 'B'>('A');
  
  const categoryAColors = colors?.filter(color => {
    const acCode = color.color_name.split(' ')[0];
    const lastDigit = acCode.charAt(acCode.length - 1);
    // 1, 2, 3, 4로 끝나는 경우
    return ['1', '2', '3', '4'].includes(lastDigit);
  }) || [];

  const categoryBColors = colors?.filter(color => {
    const acCode = color.color_name.split(' ')[0];
    const lastDigit = acCode.charAt(acCode.length - 1);
    // 6, 7, 8, 9로 끝나는 경우
    return ['6', '7', '8', '9'].includes(lastDigit);
  }) || [];

  const displayColors = activeTab === 'A' ? categoryAColors : categoryBColors;
  const activeCount = colors?.filter(color => color.is_active).length || 0;
  const blockedCount = colors?.filter(color => color.is_producible === false).length || 0;
  const pigmentCount = colors?.filter(color => color.is_bright_pigment).length || 0;

  // 컬러 업데이트
  const updateColor = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ColorOption> }) => {
      const { error } = await supabase
        .from('color_options')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-options', panelMasterId] });
      toast({ title: '저장 완료', description: '컬러가 업데이트되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ title: '저장 실패', description: error.message, variant: 'destructive' });
    },
  });

  // 컬러 추가
  const addColor = useMutation({
    mutationFn: async (newColorData: Omit<ColorOption, 'id'>) => {
      const { error } = await supabase
        .from('color_options')
        .insert(newColorData);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-options', panelMasterId] });
      toast({ title: '추가 완료', description: '새 컬러가 추가되었습니다.' });
      setIsAdding(false);
      setNewColor({
        color_name: '',
        color_code: '',
        is_bright_pigment: false,
        is_producible: true,
        unavailable_reason: '',
        color_attribute_note: '',
      });
    },
    onError: (error: Error) => {
      toast({ title: '추가 실패', description: error.message, variant: 'destructive' });
    },
  });

  // 컬러 삭제
  const deleteColor = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('color_options')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['color-options', panelMasterId] });
      toast({ title: '삭제 완료', description: '컬러가 삭제되었습니다.' });
    },
    onError: (error: Error) => {
      toast({ title: '삭제 실패', description: error.message, variant: 'destructive' });
    },
  });

  const startEdit = (color: ColorOption) => {
    setEditingId(color.id);
    setEditForm(color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (editingId && editForm) {
      await updateColor.mutateAsync({ id: editingId, updates: editForm });
      cancelEdit();
    }
  };

  const handleAdd = async () => {
    if (!newColor.color_name.trim()) {
      toast({ title: '입력 오류', description: '컬러 이름을 입력하세요.', variant: 'destructive' });
      return;
    }

    const maxOrder = colors?.reduce((max, c) => Math.max(max, c.display_order), 0) || 0;
    await addColor.mutateAsync({
      panel_master_id: panelMasterId,
      color_name: newColor.color_name,
      color_code: newColor.color_code || undefined,
      is_active: true,
      is_producible: newColor.is_producible,
      is_bright_pigment: newColor.is_bright_pigment,
      unavailable_reason: newColor.unavailable_reason || null,
      color_attribute_note: newColor.color_attribute_note || null,
      display_order: maxOrder + 1,
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteColor.mutateAsync(id);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-sm text-muted-foreground">로딩 중...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">컬러 관리</CardTitle>
            <CardDescription>재질별 사용 가능한 컬러를 관리합니다</CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            variant={isAdding ? "outline" : "default"}
          >
            {isAdding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            {isAdding ? '취소' : '컬러 추가'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">활성 컬러</div>
            <div className="mt-1 text-xl font-semibold">{activeCount.toLocaleString()}개</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">조색비 대상</div>
            <div className="mt-1 text-xl font-semibold">{pigmentCount.toLocaleString()}개</div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">생산 불가</div>
            <div className="mt-1 text-xl font-semibold">{blockedCount.toLocaleString()}개</div>
          </div>
        </div>

        {isAdding && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">컬러 이름</Label>
                <Input
                  placeholder="예: 화이트"
                  value={newColor.color_name}
                  onChange={(e) => setNewColor({ ...newColor, color_name: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">컬러 코드 (선택)</Label>
                <Input
                  placeholder="예: #FFFFFF"
                  value={newColor.color_code}
                  onChange={(e) => setNewColor({ ...newColor, color_code: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between rounded border bg-background px-3 py-2">
                <Label className="text-xs">생산 가능</Label>
                <Switch
                  checked={newColor.is_producible}
                  onCheckedChange={(checked) => setNewColor({ ...newColor, is_producible: checked })}
                />
              </div>
              <div className="flex items-center justify-between rounded border bg-background px-3 py-2">
                <Label className="text-xs">브라이트/진백/스리 조색비 대상</Label>
                <Switch
                  checked={newColor.is_bright_pigment}
                  onCheckedChange={(checked) => setNewColor({ ...newColor, is_bright_pigment: checked })}
                />
              </div>
              <div>
                <Label className="text-xs">생산 불가 사유</Label>
                <Input
                  placeholder="예: 해당 두께 생산 불가"
                  value={newColor.unavailable_reason}
                  onChange={(e) => setNewColor({ ...newColor, unavailable_reason: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">속성 메모</Label>
                <Input
                  placeholder="예: 흰색 안료 추가 컬러"
                  value={newColor.color_attribute_note}
                  onChange={(e) => setNewColor({ ...newColor, color_attribute_note: e.target.value })}
                />
              </div>
            </div>
            <Button size="sm" onClick={handleAdd} className="mt-3">
              추가
            </Button>
          </div>
        )}

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

        {displayColors && displayColors.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {displayColors.map((color) => {
              const isEditing = editingId === color.id;

              return (
                <div
                  key={color.id}
                  className={`rounded-lg border bg-background p-3 shadow-sm transition-colors ${
                    color.is_producible === false ? 'border-destructive/30 bg-destructive/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="h-12 w-12 shrink-0 rounded-md border"
                      style={{ backgroundColor: color.color_code || '#ffffff' }}
                    />
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="space-y-2">
                          <Input
                            value={editForm.color_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, color_name: e.target.value })}
                            placeholder="컬러 이름"
                          />
                          <Input
                            value={editForm.color_code || ''}
                            onChange={(e) => setEditForm({ ...editForm, color_code: e.target.value })}
                            placeholder="#FFFFFF"
                            className="font-mono"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="truncate font-semibold">{color.color_name}</div>
                          <div className="mt-0.5 text-xs font-mono text-muted-foreground">
                            {color.color_code || '컬러 코드 없음'}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {isEditing ? (
                        <>
                          <Button size="sm" variant="default" onClick={saveEdit} className="h-8 w-8 p-0">
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 w-8 p-0">
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(color)} className="h-8 w-8 p-0">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(color.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-3 grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs font-medium">활성</span>
                        <Switch
                          checked={editForm.is_active ?? false}
                          onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs font-medium">생산 가능</span>
                        <Switch
                          checked={editForm.is_producible ?? true}
                          onCheckedChange={(checked) => setEditForm({ ...editForm, is_producible: checked })}
                        />
                      </div>
                      {editForm.is_producible === false && (
                        <Input
                          className="h-8 text-xs"
                          placeholder="생산 불가 사유"
                          value={editForm.unavailable_reason || ''}
                          onChange={(e) => setEditForm({ ...editForm, unavailable_reason: e.target.value })}
                        />
                      )}
                      <div className="flex items-center justify-between rounded-md border px-3 py-2">
                        <span className="text-xs font-medium">조색비 대상</span>
                        <Switch
                          checked={editForm.is_bright_pigment ?? false}
                          onCheckedChange={(checked) => setEditForm({ ...editForm, is_bright_pigment: checked })}
                        />
                      </div>
                      <Input
                        className="h-8 text-xs"
                        placeholder="속성 메모"
                        value={editForm.color_attribute_note || ''}
                        onChange={(e) => setEditForm({ ...editForm, color_attribute_note: e.target.value })}
                      />
                    </div>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Badge variant={color.is_active ? 'default' : 'secondary'}>
                        {color.is_active ? '활성' : '비활성'}
                      </Badge>
                      <Badge variant={color.is_producible === false ? 'destructive' : 'outline'}>
                        {color.is_producible === false ? '생산 불가' : '생산 가능'}
                      </Badge>
                      {color.is_bright_pigment && (
                        <Badge variant="outline" className="gap-1 border-rose-200 text-rose-700">
                          <Palette className="h-3 w-3" />
                          조색비 대상
                        </Badge>
                      )}
                    </div>
                  )}

                  {!isEditing && color.is_producible === false && color.unavailable_reason && (
                    <div className="mt-3 flex items-start gap-2 rounded-md bg-background/80 p-2 text-xs text-destructive">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{color.unavailable_reason}</span>
                    </div>
                  )}
                  {!isEditing && color.color_attribute_note && (
                    <div className="mt-2 rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">
                      {color.color_attribute_note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            {activeTab === 'A' ? '카테고리 A' : '카테고리 B'}에 등록된 컬러가 없습니다
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ColorManager;
