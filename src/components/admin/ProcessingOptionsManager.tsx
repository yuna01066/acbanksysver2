import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProcessingOptions } from "@/hooks/useProcessingOptions";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, createOption, deleteOption } = useProcessingOptions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const handleEdit = (option: any) => {
    setEditingId(option.id);
    setEditValues({
      name: option.name,
      multiplier: option.multiplier || '',
      base_cost: option.base_cost || '',
      is_active: option.is_active
    });
  };

  const handleSave = async (id: string) => {
    try {
      await updateOption.mutateAsync({
        id,
        updates: {
          name: editValues.name,
          multiplier: editValues.multiplier ? parseFloat(editValues.multiplier) : null,
          base_cost: editValues.base_cost ? parseFloat(editValues.base_cost) : null,
          is_active: editValues.is_active
        }
      });
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      await deleteOption.mutateAsync(id);
    }
  };

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    await updateOption.mutateAsync({
      id,
      updates: { is_active: !currentStatus }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const categories = {
    additional: processingOptions?.filter(o => o.category === 'additional') || [],
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>가공 옵션 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {categories.additional.map((option) => (
              <div key={option.id} className="border rounded-lg p-4 space-y-3">
                {editingId === option.id ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>옵션명</Label>
                        <Input
                          value={editValues.name}
                          onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>배율 (Multiplier)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={editValues.multiplier}
                          onChange={(e) => setEditValues({ ...editValues, multiplier: e.target.value })}
                          placeholder="배율이 있는 경우"
                        />
                      </div>
                      <div>
                        <Label>기본 비용 (Base Cost)</Label>
                        <Input
                          type="number"
                          step="100"
                          value={editValues.base_cost}
                          onChange={(e) => setEditValues({ ...editValues, base_cost: e.target.value })}
                          placeholder="고정 비용이 있는 경우"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={editValues.is_active}
                          onCheckedChange={(checked) => setEditValues({ ...editValues, is_active: checked })}
                        />
                        <Label>활성화</Label>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={() => handleSave(option.id)} size="sm">
                        <Save className="w-4 h-4 mr-2" />
                        저장
                      </Button>
                      <Button onClick={() => setEditingId(null)} variant="outline" size="sm">
                        취소
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{option.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {option.multiplier && `배율: ${option.multiplier}배`}
                          {option.multiplier && option.base_cost && ' | '}
                          {option.base_cost && `기본비용: ${option.base_cost.toLocaleString()}원`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={option.is_active}
                          onCheckedChange={() => handleToggleActive(option.id, option.is_active)}
                        />
                        <Button onClick={() => handleEdit(option)} variant="outline" size="sm">
                          수정
                        </Button>
                        <Button onClick={() => handleDelete(option.id)} variant="destructive" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingOptionsManager;
