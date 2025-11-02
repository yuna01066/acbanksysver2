import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Save, X, Trash2 } from "lucide-react";
import { useProcessingOptions, ProcessingOption } from "@/hooks/useProcessingOptions";
import { Badge } from "@/components/ui/badge";

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, deleteOption } = useProcessingOptions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProcessingOption>>({});

  const startEdit = (option: ProcessingOption) => {
    setEditingId(option.id);
    setEditForm(option);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (editingId && editForm) {
      await updateOption.mutateAsync({
        id: editingId,
        updates: editForm,
      });
      cancelEdit();
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteOption.mutateAsync(id);
    }
  };

  const getOptionTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      additional: { label: '추가 옵션', variant: 'default' },
      processing: { label: '가공 방식', variant: 'secondary' },
      adhesion: { label: '접착 방식', variant: 'outline' },
    };
    const config = variants[type] || { label: type, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return <div className="p-8 text-center">로딩 중...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>가공 가격 관리</CardTitle>
        <CardDescription>
          각 가공 옵션의 배수와 활성화 상태를 관리할 수 있습니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>타입</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>설명</TableHead>
                <TableHead className="text-right">배수</TableHead>
                <TableHead className="text-right">고정 비용</TableHead>
                <TableHead className="text-center">활성</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processingOptions?.map((option) => {
                const isEditing = editingId === option.id;

                return (
                  <TableRow key={option.id}>
                    <TableCell>
                      {getOptionTypeBadge(option.option_type)}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="max-w-[200px]"
                        />
                      ) : (
                        <div className="font-medium">{option.name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Textarea
                          value={editForm.description || ''}
                          onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                          className="max-w-[300px] min-h-[60px]"
                        />
                      ) : (
                        <div className="text-sm text-muted-foreground max-w-[300px]">
                          {option.description}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="0.1"
                          value={editForm.multiplier || ''}
                          onChange={(e) => setEditForm({ ...editForm, multiplier: parseFloat(e.target.value) })}
                          className="max-w-[100px] ml-auto"
                        />
                      ) : (
                        <div className="font-mono">
                          {option.multiplier ? `×${option.multiplier}` : '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          step="1000"
                          value={editForm.base_cost || ''}
                          onChange={(e) => setEditForm({ ...editForm, base_cost: parseFloat(e.target.value) })}
                          className="max-w-[120px] ml-auto"
                        />
                      ) : (
                        <div className="font-mono">
                          {option.base_cost ? `₩${option.base_cost.toLocaleString()}` : '-'}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-2">
                          <Switch
                            checked={editForm.is_active ?? false}
                            onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                          />
                          <Label className="text-xs">
                            {editForm.is_active ? '활성' : '비활성'}
                          </Label>
                        </div>
                      ) : (
                        <Badge variant={option.is_active ? 'default' : 'secondary'}>
                          {option.is_active ? '활성' : '비활성'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={saveEdit}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={cancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(option)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(option.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg space-y-2">
          <h4 className="font-semibold text-sm">안내</h4>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>배수: 원판 금액에 곱해지는 값 (예: 0.5 = 원판금액 × 0.5)</li>
            <li>고정 비용: 원판 금액과 무관하게 고정으로 추가되는 금액</li>
            <li>비활성화된 옵션은 계산기에 표시되지 않습니다</li>
            <li>추가 옵션은 가공 방식 선택 시 사용자에게 표시됩니다</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProcessingOptionsManager;
