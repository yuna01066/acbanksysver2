import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Trash2, Plus, Package, Scissors, Droplet, Settings } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, deleteOption, createOption } = useProcessingOptions();
  const { settings: advancedSettings, isLoading: isLoadingAdvanced, updateSetting } = useAdvancedProcessingSettings();
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [editSettingForm, setEditSettingForm] = useState<Partial<AdvancedProcessingSetting>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ProcessingOption | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProcessingOption>>({});
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
  const [activeTab, setActiveTab] = useState<string>('all');

  const startEdit = (option: ProcessingOption) => {
    setEditingOption(option);
    setEditForm(option);
    setIsEditDialogOpen(true);
  };

  const cancelEdit = () => {
    setIsEditDialogOpen(false);
    setEditingOption(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (editingOption && editForm) {
      await updateOption.mutateAsync({
        id: editingOption.id,
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
    setIsAddDialogOpen(false);
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

  const getFilteredOptions = () => {
    if (activeTab === 'all') return processingOptions;
    
    return processingOptions?.filter(option => {
      if (activeTab === 'raw-only') return option.option_id === 'raw-only';
      if (activeTab === 'cutting') return option.option_id.includes('laser') || option.option_id.includes('cnc') || option.option_id.includes('cutting') || option.option_id.includes('complex');
      if (activeTab === 'adhesion') return option.option_type === 'adhesion';
      if (activeTab === 'additional') return option.option_type === 'additional';
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

      {/* 가공 옵션 관리 */}
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
              onClick={() => setIsAddDialogOpen(true)}
              variant="default"
              size="sm"
              className="transition-all"
            >
              <Plus className="w-4 h-4 mr-2" />
              새 옵션 추가
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="all" className="transition-all">
                전체
              </TabsTrigger>
              <TabsTrigger value="raw-only" className="transition-all">
                <Package className="w-4 h-4 mr-2" />
                원판
              </TabsTrigger>
              <TabsTrigger value="cutting" className="transition-all">
                <Scissors className="w-4 h-4 mr-2" />
                재단
              </TabsTrigger>
              <TabsTrigger value="adhesion" className="transition-all">
                <Droplet className="w-4 h-4 mr-2" />
                접착
              </TabsTrigger>
              <TabsTrigger value="additional" className="transition-all">
                <Settings className="w-4 h-4 mr-2" />
                추가 옵션
              </TabsTrigger>
            </TabsList>

            <TabsContent value={activeTab} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getFilteredOptions()
                  ?.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                  .map((option) => (
                    <Card key={option.id} className="relative overflow-hidden border-2 hover:border-primary/50 transition-all">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {option.name}
                              {!option.is_active && (
                                <Badge variant="outline" className="text-xs">비활성</Badge>
                              )}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground mt-1">
                              ID: {option.option_id}
                            </p>
                          </div>
                          {getOptionTypeBadge(option.option_type)}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {option.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {option.description}
                          </p>
                        )}
                        
                        <div className="grid grid-cols-2 gap-3">
                          {option.multiplier !== null && option.multiplier !== undefined && (
                            <div className="p-3 bg-primary/5 rounded-lg">
                              <p className="text-xs text-muted-foreground">배수</p>
                              <p className="text-lg font-bold text-primary">
                                ×{option.multiplier}
                              </p>
                              {option.apply_thickness_factor === false && (
                                <p className="text-xs text-muted-foreground mt-1">두께계수 미적용</p>
                              )}
                            </div>
                          )}
                          {option.base_cost !== null && option.base_cost !== undefined && (
                            <div className="p-3 bg-secondary/10 rounded-lg">
                              <p className="text-xs text-muted-foreground">고정 비용</p>
                              <p className="text-lg font-bold">
                                {option.base_cost.toLocaleString()}원
                              </p>
                            </div>
                          )}
                        </div>

                        {(option.min_thickness !== null || option.max_thickness !== null) && (
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">적용 두께 범위</p>
                            <p className="text-sm font-medium">
                              {option.min_thickness || '0'}T ~ {option.max_thickness || '∞'}T
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={option.is_active}
                              onCheckedChange={(checked) => {
                                updateOption.mutateAsync({
                                  id: option.id,
                                  updates: { is_active: checked }
                                });
                              }}
                            />
                            <Label className="text-xs cursor-pointer">
                              {option.is_active ? '활성화' : '비활성'}
                            </Label>
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(option)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(option.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>

              {(!getFilteredOptions() || getFilteredOptions()?.length === 0) && (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>이 카테고리에 옵션이 없습니다.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 추가 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 가공 옵션 추가</DialogTitle>
            <DialogDescription>
              새로운 가공 옵션의 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>옵션 타입</Label>
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
              <div className="space-y-2">
                <Label>옵션 ID (고유 식별자)</Label>
                <Input
                  value={newOptionForm.option_id}
                  onChange={(e) => setNewOptionForm({...newOptionForm, option_id: e.target.value})}
                  placeholder="예: cnc-premium"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>옵션 이름</Label>
              <Input
                value={newOptionForm.name}
                onChange={(e) => setNewOptionForm({...newOptionForm, name: e.target.value})}
                placeholder="예: CNC 프리미엄 가공"
              />
            </div>
            
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea
                value={newOptionForm.description || ''}
                onChange={(e) => setNewOptionForm({...newOptionForm, description: e.target.value})}
                placeholder="가공 옵션에 대한 자세한 설명을 입력하세요"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>배수 (Multiplier)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newOptionForm.multiplier || ''}
                  onChange={(e) => setNewOptionForm({...newOptionForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 1.5"
                />
              </div>
              <div className="space-y-2">
                <Label>기본 비용</Label>
                <Input
                  type="number"
                  value={newOptionForm.base_cost || ''}
                  onChange={(e) => setNewOptionForm({...newOptionForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="원 단위"
                />
              </div>
              <div className="space-y-2">
                <Label>표시 순서</Label>
                <Input
                  type="number"
                  value={newOptionForm.display_order || 0}
                  onChange={(e) => setNewOptionForm({...newOptionForm, display_order: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 두께 (T)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newOptionForm.min_thickness || ''}
                  onChange={(e) => setNewOptionForm({...newOptionForm, min_thickness: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 1"
                />
              </div>
              <div className="space-y-2">
                <Label>최대 두께 (T)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newOptionForm.max_thickness || ''}
                  onChange={(e) => setNewOptionForm({...newOptionForm, max_thickness: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={newOptionForm.apply_thickness_factor !== false}
                onCheckedChange={(checked) => setNewOptionForm({...newOptionForm, apply_thickness_factor: checked})}
              />
              <Label>두께계수 적용 (체크 해제 시 원판 × 배수만 적용)</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={newOptionForm.is_active}
                onCheckedChange={(checked) => setNewOptionForm({...newOptionForm, is_active: checked})}
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddNew}>
              추가하기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>가공 옵션 수정</DialogTitle>
            <DialogDescription>
              가공 옵션의 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>옵션 타입</Label>
                <Select
                  value={editForm.option_type}
                  onValueChange={(value: any) => setEditForm({...editForm, option_type: value})}
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
              <div className="space-y-2">
                <Label>옵션 ID (고유 식별자)</Label>
                <Input
                  value={editForm.option_id}
                  onChange={(e) => setEditForm({...editForm, option_id: e.target.value})}
                  placeholder="예: cnc-premium"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>옵션 이름</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                placeholder="예: CNC 프리미엄 가공"
              />
            </div>
            
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                placeholder="가공 옵션에 대한 자세한 설명을 입력하세요"
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>배수 (Multiplier)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.multiplier || ''}
                  onChange={(e) => setEditForm({...editForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 1.5"
                />
              </div>
              <div className="space-y-2">
                <Label>기본 비용</Label>
                <Input
                  type="number"
                  value={editForm.base_cost || ''}
                  onChange={(e) => setEditForm({...editForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="원 단위"
                />
              </div>
              <div className="space-y-2">
                <Label>표시 순서</Label>
                <Input
                  type="number"
                  value={editForm.display_order || 0}
                  onChange={(e) => setEditForm({...editForm, display_order: parseInt(e.target.value) || 0})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>최소 두께 (T)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.min_thickness || ''}
                  onChange={(e) => setEditForm({...editForm, min_thickness: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 1"
                />
              </div>
              <div className="space-y-2">
                <Label>최대 두께 (T)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editForm.max_thickness || ''}
                  onChange={(e) => setEditForm({...editForm, max_thickness: e.target.value ? parseFloat(e.target.value) : undefined})}
                  placeholder="예: 10"
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.apply_thickness_factor !== false}
                onCheckedChange={(checked) => setEditForm({...editForm, apply_thickness_factor: checked})}
              />
              <Label>두께계수 적용 (체크 해제 시 원판 × 배수만 적용)</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({...editForm, is_active: checked})}
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEdit}>
              취소
            </Button>
            <Button onClick={saveEdit}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말로 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 가공 옵션이 영구적으로 삭제됩니다.
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
