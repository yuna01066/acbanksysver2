import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Trash2, Plus } from "lucide-react";
import { useProcessingOptions, ProcessingOption } from "@/hooks/useProcessingOptions";
import { useAdvancedProcessingSettings, AdvancedProcessingSetting } from "@/hooks/useAdvancedProcessingSettings";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, deleteOption, createOption } = useProcessingOptions();
  const { settings: advancedSettings, isLoading: isLoadingAdvanced, updateSetting } = useAdvancedProcessingSettings();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProcessingOption>>({});
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [editSettingForm, setEditSettingForm] = useState<Partial<AdvancedProcessingSetting>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [newOptionForm, setNewOptionForm] = useState<Partial<ProcessingOption>>({
    option_type: 'processing',
    name: '',
    description: '',
    option_id: '',
    multiplier: undefined,
    base_cost: undefined,
    is_active: true,
    display_order: 0
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

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

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId) {
      await deleteOption.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleAddNew = async () => {
    if (!newOptionForm.name || !newOptionForm.option_id) {
      alert('옵션 ID와 이름은 필수입니다.');
      return;
    }
    
    await createOption.mutateAsync(newOptionForm as Omit<ProcessingOption, 'id'>);
    setIsAdding(false);
    setNewOptionForm({
      option_type: 'processing',
      name: '',
      description: '',
      option_id: '',
      multiplier: undefined,
      base_cost: undefined,
      is_active: true,
      display_order: 0
    });
  };

  const startEditSetting = (setting: AdvancedProcessingSetting) => {
    setEditingSettingId(setting.id);
    setEditSettingForm(setting);
  };

  const cancelEditSetting = () => {
    setEditingSettingId(null);
    setEditSettingForm({});
  };

  const saveEditSetting = async () => {
    if (editingSettingId && editSettingForm) {
      await updateSetting.mutateAsync({
        id: editingSettingId,
        updates: editSettingForm,
      });
      cancelEditSetting();
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

  const getCategoryLabel = (optionId: string) => {
    if (optionId === 'raw-only') return '원판 구매';
    if (optionId.includes('bond') || optionId.includes('mugipo')) return '접착';
    if (optionId.includes('laser') || optionId.includes('cnc') || optionId.includes('cutting')) return '가공';
    return '기타';
  };

  const getFilteredOptions = () => {
    if (!selectedCategory) return processingOptions;
    
    return processingOptions?.filter(option => {
      if (selectedCategory === 'raw-only') return option.option_id === 'raw-only';
      if (selectedCategory === 'cutting') return option.option_id.includes('laser') || option.option_id.includes('cnc') || option.option_id.includes('cutting');
      if (selectedCategory === 'complex') return option.option_id.includes('complex');
      if (selectedCategory === 'adhesion') return option.option_type === 'adhesion';
      if (selectedCategory === 'additional') return option.option_type === 'additional';
      return false;
    });
  };

  if (isLoading || isLoadingAdvanced) {
    return <div className="p-8 text-center">로딩 중...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      {/* 고급 옵션 단가 관리 */}
      <Card className="shadow-smooth">
        <CardHeader className="border-b border-border/50">
          <CardTitle className="text-xl">고급 옵션 단가 설정</CardTitle>
          <CardDescription className="text-muted-foreground">
            베벨, 타공, 코너 마감 등 고급 옵션의 단가를 관리합니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>설정 항목</TableHead>
                  <TableHead>설명</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead>단위</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advancedSettings?.map((setting) => {
                  const isEditing = editingSettingId === setting.id;
                  return (
                    <TableRow key={setting.id}>
                      <TableCell>
                        <div className="font-medium">{setting.display_name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground max-w-[300px]">
                          {setting.description}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            step={setting.setting_key === 'volume_discount_factor' ? '0.01' : '100'}
                            value={editSettingForm.setting_value || ''}
                            onChange={(e) => setEditSettingForm({ 
                              ...editSettingForm, 
                              setting_value: e.target.value ? parseFloat(e.target.value) : 0 
                            })}
                            className="max-w-[150px] ml-auto"
                          />
                        ) : (
                          <div className="font-mono">
                            {setting.setting_value.toLocaleString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{setting.unit || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={saveEditSetting}
                            >
                              <Save className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditSetting}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditSetting(setting)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 기존 가공 옵션 관리 */}
      <Card className="shadow-smooth">
        <CardHeader className="border-b border-border/50">
          <div className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">가공 방식 및 배수 관리</CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                가공 옵션의 배수 설정을 관리하고 새로운 옵션을 추가할 수 있습니다.
              </CardDescription>
            </div>
            <Button 
              onClick={() => setIsAdding(!isAdding)}
              variant={isAdding ? "outline" : "default"}
              size="sm"
              className="transition-all"
            >
              {isAdding ? <X className="w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              {isAdding ? '취소' : '새 옵션 추가'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === null ? "default" : "outline"}
              onClick={() => setSelectedCategory(null)}
              size="sm"
              className="transition-all"
            >
              전체 보기
            </Button>
            <Button
              variant={selectedCategory === 'raw-only' ? "default" : "outline"}
              onClick={() => setSelectedCategory('raw-only')}
              size="sm"
              className="transition-all"
            >
              원판 구매
            </Button>
            <Button
              variant={selectedCategory === 'cutting' ? "default" : "outline"}
              onClick={() => setSelectedCategory('cutting')}
              size="sm"
              className="transition-all"
            >
              재단
            </Button>
            <Button
              variant={selectedCategory === 'complex' ? "default" : "outline"}
              onClick={() => setSelectedCategory('complex')}
              size="sm"
              className="transition-all"
            >
              복잡한 모양 가공
            </Button>
            <Button
              variant={selectedCategory === 'adhesion' ? "default" : "outline"}
              onClick={() => setSelectedCategory('adhesion')}
              size="sm"
              className="transition-all"
            >
              접착 가공
            </Button>
            <Button
              variant={selectedCategory === 'additional' ? "default" : "outline"}
              onClick={() => setSelectedCategory('additional')}
              size="sm"
              className="transition-all"
            >
              추가 옵션
            </Button>
          </div>

          {isAdding && (
            <Card className="mb-6 border-2 border-primary/30 bg-primary/5 shadow-smooth animate-scale-in">
              <CardHeader className="border-b border-primary/20">
                <CardTitle className="text-lg">새 가공 옵션 추가</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">옵션 타입</label>
                    <Select
                      value={newOptionForm.option_type}
                      onValueChange={(value: any) => setNewOptionForm({...newOptionForm, option_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="processing">가공 옵션</SelectItem>
                        <SelectItem value="adhesion">접착 옵션</SelectItem>
                        <SelectItem value="additional">추가 옵션</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">옵션 ID (고유 식별자)</label>
                    <Input
                      value={newOptionForm.option_id}
                      onChange={(e) => setNewOptionForm({...newOptionForm, option_id: e.target.value})}
                      placeholder="예: cnc-premium"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">옵션 이름</label>
                  <Input
                    value={newOptionForm.name}
                    onChange={(e) => setNewOptionForm({...newOptionForm, name: e.target.value})}
                    placeholder="예: CNC 프리미엄 가공"
                  />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">설명</label>
                  <Textarea
                    value={newOptionForm.description || ''}
                    onChange={(e) => setNewOptionForm({...newOptionForm, description: e.target.value})}
                    placeholder="가공 옵션에 대한 자세한 설명을 입력하세요"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">배수 (Multiplier)</label>
                    <Input
                      type="number"
                      step="0.1"
                      value={newOptionForm.multiplier || ''}
                      onChange={(e) => setNewOptionForm({...newOptionForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined})}
                      placeholder="예: 1.5"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">기본 비용</label>
                    <Input
                      type="number"
                      value={newOptionForm.base_cost || ''}
                      onChange={(e) => setNewOptionForm({...newOptionForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined})}
                      placeholder="원 단위"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">표시 순서</label>
                    <Input
                      type="number"
                      value={newOptionForm.display_order || 0}
                      onChange={(e) => setNewOptionForm({...newOptionForm, display_order: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Switch
                    checked={newOptionForm.is_active}
                    onCheckedChange={(checked) => setNewOptionForm({...newOptionForm, is_active: checked})}
                  />
                  <label className="text-sm font-medium">활성화</label>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAdding(false)} className="transition-all">
                    취소
                  </Button>
                  <Button onClick={handleAddNew} className="transition-all">
                    추가하기
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="rounded-xl border border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="font-semibold">타입</TableHead>
                  <TableHead className="font-semibold">카테고리</TableHead>
                  <TableHead className="font-semibold">옵션 ID</TableHead>
                  <TableHead className="font-semibold">이름</TableHead>
                  <TableHead className="font-semibold">설명</TableHead>
                  <TableHead className="text-right font-semibold">배수</TableHead>
                  <TableHead className="text-right font-semibold">고정 비용</TableHead>
                  <TableHead className="text-center font-semibold">순서</TableHead>
                  <TableHead className="text-center font-semibold">활성</TableHead>
                  <TableHead className="text-right font-semibold">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getFilteredOptions()
                  ?.sort((a, b) => {
                    // 옵션 타입 우선순위: processing > adhesion > additional
                    const typeOrder = { processing: 1, adhesion: 2, additional: 3 };
                    const typeA = typeOrder[a.option_type as keyof typeof typeOrder] || 4;
                    const typeB = typeOrder[b.option_type as keyof typeof typeOrder] || 4;
                    
                    if (typeA !== typeB) return typeA - typeB;
                    return a.display_order - b.display_order;
                  })
                  .map((option) => {
                  const isEditing = editingId === option.id;

                  return (
                    <TableRow key={option.id}>
                      <TableCell>
                        {getOptionTypeBadge(option.option_type)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{getCategoryLabel(option.option_id)}</Badge>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            value={editForm.option_id || ''}
                            onChange={(e) => setEditForm({ ...editForm, option_id: e.target.value })}
                            className="max-w-[150px] font-mono text-xs"
                          />
                        ) : (
                          <code className="text-xs bg-muted px-2 py-1 rounded">{option.option_id}</code>
                        )}
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
                            rows={2}
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
                            onChange={(e) => setEditForm({ ...editForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                            onChange={(e) => setEditForm({ ...editForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
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
                          <Input
                            type="number"
                            value={editForm.display_order ?? option.display_order}
                            onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })}
                            className="w-20 mx-auto"
                          />
                        ) : (
                          <div className="font-mono">{option.display_order}</div>
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

          <div className="mt-6 space-y-4">
            <h4 className="font-semibold text-base">가공 옵션 설정 안내</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h5 className="font-semibold mb-2">옵션 타입</h5>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• <strong>가공 옵션:</strong> 레이저, CNC 등 가공 방식</li>
                  <li>• <strong>접착 옵션:</strong> 무기포, 일반 접착 등</li>
                  <li>• <strong>추가 옵션:</strong> 기타 부가 서비스</li>
                </ul>
              </div>
              <div className="p-4 bg-muted/50 rounded-lg">
                <h5 className="font-semibold mb-2">가격 설정</h5>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• <strong>배수:</strong> 자재비 × 배수로 계산</li>
                  <li>• <strong>기본 비용:</strong> 고정 추가 비용</li>
                  <li>• <strong>표시 순서:</strong> 작을수록 상단 표시</li>
                </ul>
              </div>
            </div>
            <div className="p-4 bg-blue-50 text-blue-800 rounded-lg border border-blue-200">
              <p className="font-semibold mb-1">💡 팁</p>
              <p className="text-sm">옵션 ID는 시스템에서 사용하는 고유 식별자이므로 신중하게 설정하세요. 변경 시 기존 데이터에 영향을 줄 수 있습니다.</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>가공 옵션 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 가공 옵션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProcessingOptionsManager;
