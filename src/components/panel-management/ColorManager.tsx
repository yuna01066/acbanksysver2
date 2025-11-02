import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Save, X, Trash2, Plus } from "lucide-react";
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
  display_order: number;
}

interface ColorManagerProps {
  panelMasterId: string;
}

const ColorManager = ({ panelMasterId }: ColorManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ColorOption>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newColor, setNewColor] = useState({ color_name: '', color_code: '' });

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
      setNewColor({ color_name: '', color_code: '' });
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
        {isAdding && (
          <div className="mb-4 p-4 border rounded-lg bg-muted/50">
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <Button size="sm" onClick={handleAdd} className="mt-3">
              추가
            </Button>
          </div>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>컬러 이름</TableHead>
                <TableHead>컬러 코드</TableHead>
                <TableHead className="text-center">활성</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {colors && colors.length > 0 ? (
                colors.map((color) => {
                  const isEditing = editingId === color.id;
                  return (
                    <TableRow key={color.id}>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.color_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, color_name: e.target.value })}
                          />
                        ) : (
                          <div className="font-medium">{color.color_name}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.color_code || ''}
                            onChange={(e) => setEditForm({ ...editForm, color_code: e.target.value })}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {color.color_code && (
                              <>
                                <div
                                  className="w-6 h-6 rounded border"
                                  style={{ backgroundColor: color.color_code }}
                                />
                                <span className="text-sm font-mono">{color.color_code}</span>
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Switch
                            checked={editForm.is_active ?? false}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                          />
                        ) : (
                          <Badge variant={color.is_active ? 'default' : 'secondary'}>
                            {color.is_active ? '활성' : '비활성'}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="default" onClick={saveEdit}>
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => startEdit(color)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(color.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    등록된 컬러가 없습니다
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorManager;
