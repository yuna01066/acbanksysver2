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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MainCategory = 'raw' | 'cutting' | 'adhesion' | 'additional';
type CuttingType = 'simple' | 'complex' | 'full';
type ProcessingMethod = 'laser' | 'cnc';
type AdhesionAngle = '45' | '90';
type AdhesionType = 'normal' | 'bubble-free';

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
    option_type: 'slot1',
    name: '',
    description: '',
    option_id: '',
    multiplier: undefined,
    base_cost: undefined,
    is_active: true,
    display_order: 0
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // 계층적 선택 상태
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null);
  const [selectedCuttingType, setSelectedCuttingType] = useState<CuttingType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<ProcessingMethod | null>(null);
  const [selectedAngle, setSelectedAngle] = useState<AdhesionAngle | null>(null);
  const [selectedAdhesionType, setSelectedAdhesionType] = useState<AdhesionType | null>(null);
  
  // 로직 공식 슬롯 선택 상태 (동적 배열로 관리)
  const [formulaSlots, setFormulaSlots] = useState<(ProcessingOption | null)[]>([]);

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
    setSelectedCuttingType(null);
    setSelectedMethod(null);
    setSelectedAngle(null);
    setSelectedAdhesionType(null);
    // 슬롯 초기화
    setFormulaSlots([]);
  };

  const addFormulaSlot = () => {
    setFormulaSlots([...formulaSlots, null]);
  };

  const removeFormulaSlot = (index: number) => {
    setFormulaSlots(formulaSlots.filter((_, i) => i !== index));
  };

  const updateFormulaSlot = (index: number, option: ProcessingOption) => {
    const newSlots = [...formulaSlots];
    newSlots[index] = option;
    setFormulaSlots(newSlots);
  };

  const getAvailableOptionsForCategory = () => {
    if (!selectedCategory) return [];
    
    return processingOptions?.filter(option => {
      if (selectedCategory === 'raw') {
        return option.option_type === 'slot1';
      } else if (selectedCategory === 'cutting') {
        return option.option_type === 'slot2';
      } else if (selectedCategory === 'adhesion') {
        return option.option_type === 'slot3';
      } else if (selectedCategory === 'additional') {
        return option.option_type === 'additional';
      }
      return false;
    }) || [];
  };

  const getFilteredOptions = () => {
    if (!selectedCategory) return [];
    
    return processingOptions?.filter(option => {
      if (selectedCategory === 'raw') {
        return option.option_type === 'slot1';
      } else if (selectedCategory === 'cutting') {
        return option.option_type === 'slot2';
      } else if (selectedCategory === 'adhesion') {
        return option.option_type === 'slot3';
      } else if (selectedCategory === 'additional') {
        return option.option_type === 'additional';
      }
      return false;
    }) || [];
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
                단계별로 가공 옵션을 선택하여 관리할 수 있습니다.
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
          {/* STEP 1: 카테고리 선택 */}
          <div>
            <div className="mb-4">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" />
                STEP 1: 가공 카테고리 선택
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleCategorySelect('raw')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCategory === 'raw'
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">원판 구매</span>
                  {selectedCategory === 'raw' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  원판 옵션 관리
                </p>
              </button>

              <button
                onClick={() => handleCategorySelect('cutting')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCategory === 'cutting'
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Scissors className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">재단 가공</span>
                  {selectedCategory === 'cutting' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  재단 옵션 관리
                </p>
              </button>

              <button
                onClick={() => handleCategorySelect('adhesion')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCategory === 'adhesion'
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Droplet className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">접착 가공</span>
                  {selectedCategory === 'adhesion' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  접착 옵션 관리
                </p>
              </button>

              <button
                onClick={() => handleCategorySelect('additional')}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  selectedCategory === 'additional'
                    ? 'bg-primary/10 border-primary shadow-md'
                    : 'bg-background border-border hover:border-primary/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-semibold text-sm">추가 옵션</span>
                  {selectedCategory === 'additional' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                </div>
                <p className="text-xs text-muted-foreground">
                  추가 옵션 관리
                </p>
              </button>
            </div>
          </div>

          {/* STEP 2: 재단 타입 선택 */}
          {selectedCategory === 'cutting' && (
            <>
              <Separator />
              <div>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary" />
                    STEP 2: 재단 타입 선택
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedCuttingType('simple')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedCuttingType === 'simple'
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Scissors className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm">단순 재단</span>
                      {selectedCuttingType === 'simple' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedCuttingType('complex')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedCuttingType === 'complex'
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm">복합 재단</span>
                      {selectedCuttingType === 'complex' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedCuttingType('full')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedCuttingType === 'full'
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm">풀 재단</span>
                      {selectedCuttingType === 'full' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* STEP 3: 재단 가공 방식 선택 */}
          {selectedCategory === 'cutting' && selectedCuttingType && (
            <>
              <Separator />
              <div>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    STEP 3: 가공 방식 선택
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedMethod('laser')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === 'laser'
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm">레이저 가공</span>
                      {selectedMethod === 'laser' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedMethod('cnc')}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      selectedMethod === 'cnc'
                        ? 'bg-primary/10 border-primary shadow-md'
                        : 'bg-background border-border hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-sm">CNC 가공</span>
                      {selectedMethod === 'cnc' && <CheckCircle2 className="w-4 h-4 text-primary ml-auto" />}
                    </div>
                  </button>
                </div>
              </div>
            </>
          )}

          {/* 로직 공식 영역 - 모든 카테고리 (추가 옵션 제외) */}
          {selectedCategory && selectedCategory !== 'additional' && (
            <>
              <Separator />
              <div className="space-y-6">
                {/* 로직 공식 영역 */}
                <div>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      {selectedCategory === 'raw' && '원판 구매 로직 공식'}
                      {selectedCategory === 'cutting' && '재단 가공 로직 공식'}
                      {selectedCategory === 'adhesion' && '접착 가공 로직 공식'}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      아래 옵션들을 클릭하여 공식에 추가하세요
                    </p>
                  </div>

                  {/* 공식 슬롯 */}
                  <div className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg border-2 border-primary/30">
                    <div className="flex items-center justify-center gap-3 flex-wrap">
                      {/* 원판 기본 */}
                      <div className="px-4 py-2 bg-background rounded-lg border-2 border-border">
                        <span className="text-sm font-medium">원판 (원판+면수+조색비)</span>
                      </div>

                      {/* 동적 슬롯 렌더링 */}
                      {formulaSlots.map((slot, index) => (
                        <React.Fragment key={index}>
                          {/* 연산자 - 모두 덧셈 */}
                          <span className="text-2xl font-bold text-primary">+</span>

                          {/* 슬롯 */}
                          <div className="relative group">
                            <div className={`min-w-[180px] px-4 py-3 rounded-lg border-2 transition-all ${
                              slot 
                                ? 'bg-primary text-primary-foreground border-primary shadow-md'
                                : 'bg-background border-dashed border-muted-foreground/30'
                            }`}>
                              {slot ? (
                                <div className="text-center">
                                  <div className="text-sm font-medium">{slot.name}</div>
                                  <div className="text-xs mt-1 opacity-80">
                                    {slot.multiplier !== null && slot.multiplier !== undefined && `×${slot.multiplier}`}
                                    {slot.base_cost !== null && slot.base_cost !== undefined && `+${slot.base_cost.toLocaleString()}원`}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-center text-sm text-muted-foreground">
                                  선택 {index + 1}
                                </div>
                              )}
                            </div>
                            {/* 삭제 버튼 */}
                            <button
                              onClick={() => removeFormulaSlot(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center hover:bg-destructive/90"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </React.Fragment>
                      ))}

                      {/* 슬롯 추가 버튼 */}
                      <button
                        onClick={addFormulaSlot}
                        className="min-w-[180px] px-4 py-3 rounded-lg border-2 border-dashed border-primary/50 bg-background hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-primary"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm font-medium">슬롯 추가</span>
                      </button>

                      {/* 추가 옵션 */}
                      <span className="text-2xl font-bold text-primary">+</span>
                      <div className="px-4 py-2 bg-background rounded-lg border-2 border-border">
                        <span className="text-sm font-medium">추가 옵션</span>
                      </div>

                      {/* 최종 결과 표시 */}
                      {formulaSlots.length > 0 && (
                        <>
                          <span className="text-2xl font-bold text-primary">=</span>
                          <div className="px-6 py-3 bg-primary text-primary-foreground rounded-lg border-2 border-primary shadow-lg">
                            <div className="text-center">
                              <div className="text-xs opacity-80">최종 로직</div>
                              <div className="text-sm font-bold mt-1">합산</div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* 옵션 선택 영역 */}
                <div>
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Settings className="w-4 h-4 text-primary" />
                      옵션 선택 및 관리
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      각 옵션을 클릭하여 공식 슬롯에 추가하세요
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {getAvailableOptionsForCategory().map(option => {
                      const isSelected = formulaSlots.some(slot => slot?.id === option.id);
                      
                      return (
                        <Card 
                          key={option.id} 
                          className={`relative overflow-hidden border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-primary shadow-md'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => {
                            // 빈 슬롯 찾기
                            const emptySlotIndex = formulaSlots.findIndex(slot => slot === null);
                            if (emptySlotIndex !== -1) {
                              updateFormulaSlot(emptySlotIndex, option);
                            }
                          }}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-base flex items-center gap-2">
                                  {option.name}
                                  {!option.is_active && (
                                    <Badge variant="outline" className="text-xs">비활성</Badge>
                                  )}
                                  {isSelected && (
                                    <CheckCircle2 className="w-4 h-4 text-primary" />
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
                                onClick={(e) => e.stopPropagation()}
                              />
                              <Label className="text-xs cursor-pointer">
                                {option.is_active ? '활성화' : '비활성'}
                              </Label>
                            </div>
                            
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  startEdit(option);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(option.id);
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                    })}
                  </div>

                  {/* 슬롯 초기화 버튼 */}
                  {formulaSlots.length > 0 && (
                    <div className="mt-4 text-center">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setFormulaSlots([])}
                      >
                        <X className="w-4 h-4 mr-2" />
                        모든 슬롯 초기화
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 추가 옵션 관리 */}
          {selectedCategory === 'additional' && (
            <>
              <Separator />
              <div>
                <div className="mb-4">
                  <h4 className="text-sm font-semibold">관리할 옵션</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {getFilteredOptions()
                    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
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
              </div>
            </>
          )}

          {selectedCategory && getFilteredOptions().length === 0 && selectedCategory === 'additional' && (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>선택한 조건에 해당하는 옵션이 없습니다.</p>
            </div>
          )}

          {!selectedCategory && (
            <div className="text-center py-12 text-muted-foreground">
              <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>카테고리를 선택하여 옵션을 관리하세요.</p>
            </div>
          )}
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
                    <SelectItem value="slot1">선택 1</SelectItem>
                    <SelectItem value="slot2">선택 2</SelectItem>
                    <SelectItem value="slot3">선택 3</SelectItem>
                    <SelectItem value="slot4">선택 4</SelectItem>
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
                    <SelectItem value="slot1">선택 1</SelectItem>
                    <SelectItem value="slot2">선택 2</SelectItem>
                    <SelectItem value="slot3">선택 3</SelectItem>
                    <SelectItem value="slot4">선택 4</SelectItem>
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
