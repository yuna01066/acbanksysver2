import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Trash2, Plus, Package, Scissors, Droplet, Settings, CheckCircle2, Sparkles, Layers, Zap } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type MainCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion' | 'additional';
type ProcessingOptionCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion' | 'additional';

interface SlotConfig {
  slotType: 'slot1' | 'slot2' | 'slot3' | 'slot4';
  optionId: string;
}

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, deleteOption, createOption } = useProcessingOptions();
  const { settings: advancedSettings, isLoading: isLoadingAdvanced, updateSetting } = useAdvancedProcessingSettings();
  const { toast } = useToast();
  
  const [editingSettingId, setEditingSettingId] = useState<string | null>(null);
  const [editSettingForm, setEditSettingForm] = useState<Partial<AdvancedProcessingSetting>>({});
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ProcessingOption | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProcessingOption>>({});
  const [newOptionForm, setNewOptionForm] = useState<Partial<ProcessingOption>>({
    option_type: 'slot1',
    category: 'raw',
    name: '',
    description: '',
    option_id: '',
    multiplier: undefined,
    base_cost: undefined,
    is_active: true,
    display_order: 0
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null);
  const [categorySlots, setCategorySlots] = useState<Record<MainCategory, SlotConfig[]>>({
    raw: [],
    simple: [],
    complex: [],
    full: [],
    adhesion: [],
    additional: []
  });

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
      option_type: 'slot1',
      category: 'raw',
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

  const handleCategorySelect = (category: MainCategory) => {
    setSelectedCategory(category);
  };

  const addSlotToCategory = (category: MainCategory) => {
    setCategorySlots({
      ...categorySlots,
      [category]: [
        ...categorySlots[category],
        { slotType: 'slot1', optionId: '' }
      ]
    });
  };

  const removeSlot = (category: MainCategory, index: number) => {
    setCategorySlots({
      ...categorySlots,
      [category]: categorySlots[category].filter((_, i) => i !== index)
    });
  };

  const updateSlot = (category: MainCategory, index: number, field: 'slotType' | 'optionId', value: string) => {
    const newSlots = [...categorySlots[category]];
    if (field === 'slotType') {
      newSlots[index].slotType = value as 'slot1' | 'slot2' | 'slot3' | 'slot4';
    } else {
      newSlots[index].optionId = value;
    }
    setCategorySlots({
      ...categorySlots,
      [category]: newSlots
    });
  };

  const saveCategoryLogic = async () => {
    if (!selectedCategory) return;

    try {
      const slots = categorySlots[selectedCategory];
      
      for (const slot of slots) {
        if (slot.optionId) {
          const option = processingOptions?.find(opt => opt.option_id === slot.optionId);
          if (option) {
            await updateOption.mutateAsync({
              id: option.id,
              updates: {
                option_type: slot.slotType,
                category: selectedCategory as ProcessingOptionCategory,
              }
            });
          }
        }
      }
      
      toast({
        title: '저장 완료',
        description: '가공 로직이 저장되어 견적 계산기에 반영됩니다.',
      });
    } catch (error) {
      toast({
        title: '저장 실패',
        description: '가공 로직 저장에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  const getAvailableOptions = () => {
    if (!selectedCategory || !processingOptions) return [];
    return processingOptions.filter(opt => opt.category === selectedCategory || opt.category === 'additional');
  };

  const getOptionTypeBadge = (type: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      slot1: { label: '선택 1', variant: 'default' },
      slot2: { label: '선택 2', variant: 'secondary' },
      slot3: { label: '선택 3', variant: 'outline' },
      slot4: { label: '선택 4', variant: 'destructive' },
      additional: { label: '추가 옵션', variant: 'default' },
    };
    const config = variants[type] || { label: type, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getCategoryBadge = (category: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      raw: { label: '원판구매', variant: 'default' },
      simple: { label: '단순재단', variant: 'secondary' },
      complex: { label: '복합재단', variant: 'outline' },
      full: { label: '전체재단', variant: 'destructive' },
      adhesion: { label: '접착가공', variant: 'default' },
      additional: { label: '추가옵션', variant: 'secondary' },
    };
    const config = variants[category] || { label: category, variant: 'default' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
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
              <CardTitle className="text-xl">가공 로직 설정</CardTitle>
              <CardDescription className="text-muted-foreground mt-2">
                카테고리별 가공 로직을 설정하고 슬롯을 관리합니다.
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
        <CardContent className="pt-6 space-y-6">
          {/* 카테고리 선택 */}
          <div>
            <div className="mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                가공 카테고리 선택
              </h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { key: 'raw', icon: Package, label: '원판 구매' },
                { key: 'simple', icon: Scissors, label: '단순 재단' },
                { key: 'complex', icon: Layers, label: '복합 재단' },
                { key: 'full', icon: Zap, label: '전체 재단' },
                { key: 'adhesion', icon: Droplet, label: '접착 가공' },
                { key: 'additional', icon: Settings, label: '추가 옵션' },
              ].map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => handleCategorySelect(key as MainCategory)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    selectedCategory === key
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-background border-border hover:border-primary/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-5 h-5 text-primary" />
                    <span className="font-semibold text-sm">{label}</span>
                    {selectedCategory === key && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 선택된 카테고리의 로직 설정 */}
          {selectedCategory && selectedCategory !== 'additional' && (
            <>
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    로직 슬롯 관리
                  </h4>
                  <Button 
                    onClick={() => addSlotToCategory(selectedCategory)}
                    variant="outline"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    슬롯 추가
                  </Button>
                </div>

                {categorySlots[selectedCategory].length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    슬롯이 없습니다. "슬롯 추가" 버튼을 눌러 시작하세요.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {categorySlots[selectedCategory].map((slot, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                        <div className="w-32">
                          <Label className="text-xs mb-1">슬롯 타입</Label>
                          <Select
                            value={slot.slotType}
                            onValueChange={(value) => updateSlot(selectedCategory, idx, 'slotType', value)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="slot1">선택 1</SelectItem>
                              <SelectItem value="slot2">선택 2</SelectItem>
                              <SelectItem value="slot3">선택 3</SelectItem>
                              <SelectItem value="slot4">선택 4</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex-1">
                          <Label className="text-xs mb-1">옵션 선택</Label>
                          <Select
                            value={slot.optionId}
                            onValueChange={(value) => updateSlot(selectedCategory, idx, 'optionId', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="옵션을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableOptions().map((opt) => (
                                <SelectItem key={opt.id} value={opt.option_id}>
                                  {opt.name} ({opt.option_id})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSlot(selectedCategory, idx)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button 
                  onClick={saveCategoryLogic}
                  className="w-full"
                  disabled={categorySlots[selectedCategory].length === 0}
                >
                  <Save className="w-4 h-4 mr-2" />
                  로직 저장 (견적 계산기에 반영)
                </Button>
              </div>
            </>
          )}

          <Separator />

          {/* 슬롯별 옵션 목록 */}
          <div className="space-y-6">
            <h4 className="text-sm font-semibold">슬롯별 옵션 관리</h4>
            
            {['slot1', 'slot2', 'slot3', 'slot4', 'additional'].map((slotType) => {
              const slotOptions = processingOptions?.filter(opt => opt.option_type === slotType) || [];
              const slotLabels: Record<string, string> = {
                slot1: '선택 1',
                slot2: '선택 2',
                slot3: '선택 3',
                slot4: '선택 4',
                additional: '추가 옵션'
              };
              
              return (
                <Card key={slotType} className="border-2">
                  <CardHeader className="pb-3 bg-muted/30">
                    <CardTitle className="text-base flex items-center gap-2">
                      {getOptionTypeBadge(slotType)}
                      <span className="text-muted-foreground text-sm ml-2">
                        ({slotOptions.length}개)
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {slotOptions.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground text-sm">
                        {slotLabels[slotType]}에 등록된 옵션이 없습니다.
                      </div>
                    ) : (
                      <div className="rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>옵션 ID</TableHead>
                              <TableHead>이름</TableHead>
                              <TableHead>카테고리</TableHead>
                              <TableHead>설명</TableHead>
                              <TableHead className="text-right">기본 비용</TableHead>
                              <TableHead>활성화</TableHead>
                              <TableHead className="text-right">작업</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {slotOptions.map((option) => (
                              <TableRow key={option.id}>
                                <TableCell className="font-mono text-xs">{option.option_id}</TableCell>
                                <TableCell className="font-medium">{option.name}</TableCell>
                                <TableCell>{getCategoryBadge(option.category)}</TableCell>
                                <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                                  {option.description || '-'}
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  {option.base_cost ? `${option.base_cost.toLocaleString()}원` : '-'}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={option.is_active ? 'default' : 'secondary'}>
                                    {option.is_active ? '활성' : '비활성'}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex gap-2 justify-end">
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
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 새 옵션 추가 다이얼로그 */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 가공 옵션 추가</DialogTitle>
            <DialogDescription>
              새로운 가공 옵션의 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="option_id">옵션 ID *</Label>
                <Input
                  id="option_id"
                  value={newOptionForm.option_id || ''}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, option_id: e.target.value })}
                  placeholder="예: laser-simple"
                />
              </div>
              <div>
                <Label htmlFor="name">이름 *</Label>
                <Input
                  id="name"
                  value={newOptionForm.name || ''}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, name: e.target.value })}
                  placeholder="예: 레이저 단순 가공"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="category">카테고리</Label>
                <Select
                  value={newOptionForm.category}
                  onValueChange={(value) => setNewOptionForm({ ...newOptionForm, category: value as ProcessingOptionCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">원판구매</SelectItem>
                    <SelectItem value="simple">단순재단</SelectItem>
                    <SelectItem value="complex">복합재단</SelectItem>
                    <SelectItem value="full">전체재단</SelectItem>
                    <SelectItem value="adhesion">접착가공</SelectItem>
                    <SelectItem value="additional">추가옵션</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="option_type">슬롯 타입</Label>
                <Select
                  value={newOptionForm.option_type}
                  onValueChange={(value) => setNewOptionForm({ ...newOptionForm, option_type: value as 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'additional' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot1">선택 1</SelectItem>
                    <SelectItem value="slot2">선택 2</SelectItem>
                    <SelectItem value="slot3">선택 3</SelectItem>
                    <SelectItem value="slot4">선택 4</SelectItem>
                    <SelectItem value="additional">추가 옵션</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="description">설명</Label>
              <Textarea
                id="description"
                value={newOptionForm.description || ''}
                onChange={(e) => setNewOptionForm({ ...newOptionForm, description: e.target.value })}
                placeholder="옵션에 대한 설명을 입력하세요"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="base_cost">기본 비용 (원)</Label>
                <Input
                  id="base_cost"
                  type="number"
                  value={newOptionForm.base_cost || ''}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0"
                />
              </div>
              <div>
                <Label htmlFor="display_order">표시 순서</Label>
                <Input
                  id="display_order"
                  type="number"
                  value={newOptionForm.display_order || 0}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={newOptionForm.is_active}
                onCheckedChange={(checked) => setNewOptionForm({ ...newOptionForm, is_active: checked })}
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddNew}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 옵션 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>가공 옵션 수정</DialogTitle>
            <DialogDescription>
              가공 옵션의 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_option_id">옵션 ID</Label>
                <Input
                  id="edit_option_id"
                  value={editForm.option_id || ''}
                  onChange={(e) => setEditForm({ ...editForm, option_id: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_name">이름</Label>
                <Input
                  id="edit_name"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_category">카테고리</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) => setEditForm({ ...editForm, category: value as ProcessingOptionCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">원판구매</SelectItem>
                    <SelectItem value="simple">단순재단</SelectItem>
                    <SelectItem value="complex">복합재단</SelectItem>
                    <SelectItem value="full">전체재단</SelectItem>
                    <SelectItem value="adhesion">접착가공</SelectItem>
                    <SelectItem value="additional">추가옵션</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit_option_type">슬롯 타입</Label>
                <Select
                  value={editForm.option_type}
                  onValueChange={(value) => setEditForm({ ...editForm, option_type: value as 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'additional' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slot1">선택 1</SelectItem>
                    <SelectItem value="slot2">선택 2</SelectItem>
                    <SelectItem value="slot3">선택 3</SelectItem>
                    <SelectItem value="slot4">선택 4</SelectItem>
                    <SelectItem value="additional">추가 옵션</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="edit_description">설명</Label>
              <Textarea
                id="edit_description"
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_base_cost">기본 비용 (원)</Label>
                <Input
                  id="edit_base_cost"
                  type="number"
                  value={editForm.base_cost || ''}
                  onChange={(e) => setEditForm({ ...editForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                />
              </div>
              <div>
                <Label htmlFor="edit_display_order">표시 순서</Label>
                <Input
                  id="edit_display_order"
                  type="number"
                  value={editForm.display_order || 0}
                  onChange={(e) => setEditForm({ ...editForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
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
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 이 가공 옵션이 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProcessingOptionsManager;
