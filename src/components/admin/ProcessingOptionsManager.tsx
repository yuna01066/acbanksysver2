import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Save, X, Trash2, Plus, Package, Scissors, Droplet, Settings, CheckCircle2, Layers, Zap, ListOrdered, GripVertical } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useProcessingOptions, ProcessingOption } from "@/hooks/useProcessingOptions";
import { useAdvancedProcessingSettings, AdvancedProcessingSetting } from "@/hooks/useAdvancedProcessingSettings";
import { useSlotTypes, SlotType } from "@/hooks/useSlotTypes";
import { useCategoryLogic } from "@/hooks/useCategoryLogic";
import { useThicknessList } from "@/hooks/useThicknessList";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type MainCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion' | 'additional';
type ProcessingOptionCategory = 'raw' | 'simple' | 'complex' | 'full' | 'adhesion' | 'additional';

interface SlotConfig {
  slotKey: string;
}

// 드래그 가능한 행 컴포넌트
const SortableOptionRow = ({ 
  option, 
  onEdit, 
  onDelete 
}: { 
  option: ProcessingOption; 
  onEdit: (option: ProcessingOption) => void; 
  onDelete: (id: string) => void;
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: option.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted/50 rounded inline-flex"
        >
          <GripVertical className="w-4 h-4 text-muted-foreground" />
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">{option.option_id}</TableCell>
      <TableCell className="font-medium">{option.name}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {option.applicable_thicknesses && option.applicable_thicknesses.length > 0 ? (
            option.applicable_thicknesses.map(t => (
              <Badge key={t} variant="outline" className="text-xs">
                {t}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">모든 두께</span>
          )}
        </div>
      </TableCell>
      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
        {option.description || '-'}
      </TableCell>
      <TableCell className="text-right font-mono">
        {option.multiplier ? `×${option.multiplier}` : '-'}
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
            onClick={() => onEdit(option)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(option.id)}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
};

const ProcessingOptionsManager = () => {
  const { processingOptions, isLoading, updateOption, deleteOption, createOption } = useProcessingOptions();
  const { settings: advancedSettings, isLoading: isLoadingAdvanced, updateSetting } = useAdvancedProcessingSettings();
  const { slotTypes, isLoading: isLoadingSlots, updateSlotType, createSlotType, deleteSlotType } = useSlotTypes();
  const { categoryLogic, isLoading: isLoadingLogic, getCategorySlots, saveCategoryLogic: saveCategoryLogicMutation } = useCategoryLogic();
  const { thicknessList, isLoading: isLoadingThickness } = useThicknessList();
  const { toast } = useToast();
  
  // 드래그 앤 드롭 센서
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
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
    applicable_thicknesses: []
  });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // 슬롯 타입 관리
  const [isAddSlotDialogOpen, setIsAddSlotDialogOpen] = useState(false);
  const [isEditSlotDialogOpen, setIsEditSlotDialogOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<SlotType | null>(null);
  const [editSlotForm, setEditSlotForm] = useState<Partial<SlotType>>({});
  const [newSlotForm, setNewSlotForm] = useState<Partial<SlotType>>({
    slot_key: '',
    label: '',
    title: '',
    description: '',
    is_active: true
  });
  const [deleteSlotConfirmId, setDeleteSlotConfirmId] = useState<string | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<MainCategory | null>(null);
  const [categorySlots, setCategorySlots] = useState<Record<MainCategory, SlotConfig[]>>({
    raw: [],
    simple: [],
    complex: [],
    full: [],
    adhesion: [],
    additional: []
  });

  // 로직 데이터가 로드되면 상태에 반영
  React.useEffect(() => {
    if (categoryLogic) {
      const newCategorySlots: Record<MainCategory, SlotConfig[]> = {
        raw: [],
        simple: [],
        complex: [],
        full: [],
        adhesion: [],
        additional: []
      };

      categoryLogic.forEach(slot => {
        if (newCategorySlots[slot.category as MainCategory]) {
          newCategorySlots[slot.category as MainCategory].push({
            slotKey: slot.slot_key
          });
        }
      });

      setCategorySlots(newCategorySlots);
    }
  }, [categoryLogic]);

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
      toast({
        title: '입력 오류',
        description: '옵션 ID와 이름은 필수입니다.',
        variant: 'destructive',
      });
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
      applicable_thicknesses: []
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

  // 슬롯 타입 관리 함수
  const startEditSlot = (slot: SlotType) => {
    setEditingSlot(slot);
    setEditSlotForm(slot);
    setIsEditSlotDialogOpen(true);
  };

  const cancelEditSlot = () => {
    setIsEditSlotDialogOpen(false);
    setEditingSlot(null);
    setEditSlotForm({});
  };

  const saveEditSlot = async () => {
    if (editingSlot && editSlotForm) {
      await updateSlotType.mutateAsync({
        id: editingSlot.id,
        updates: editSlotForm,
      });
      cancelEditSlot();
    }
  };

  const handleAddSlot = async () => {
    if (!newSlotForm.slot_key || !newSlotForm.label) {
      toast({
        title: '입력 오류',
        description: '슬롯 키와 레이블은 필수입니다.',
        variant: 'destructive',
      });
      return;
    }
    
    await createSlotType.mutateAsync(newSlotForm as Omit<SlotType, 'id' | 'created_at' | 'updated_at'>);
    setIsAddSlotDialogOpen(false);
    setNewSlotForm({
      slot_key: '',
      label: '',
      title: '',
      description: '',
      display_order: 0,
      is_active: true
    });
  };

  const handleDeleteSlot = (id: string) => {
    setDeleteSlotConfirmId(id);
  };

  const confirmDeleteSlot = async () => {
    if (deleteSlotConfirmId) {
      await deleteSlotType.mutateAsync(deleteSlotConfirmId);
      setDeleteSlotConfirmId(null);
    }
  };

  const handleCategorySelect = (category: MainCategory) => {
    setSelectedCategory(category);
  };

  const addSlotToLogic = (category: MainCategory) => {
    const availableSlots = slotTypes?.filter(st => st.is_active) || [];
    if (availableSlots.length === 0) {
      toast({
        title: '슬롯 없음',
        description: '먼저 슬롯 타입을 추가해주세요.',
        variant: 'destructive',
      });
      return;
    }
    
    setCategorySlots({
      ...categorySlots,
      [category]: [
        ...categorySlots[category],
        { slotKey: availableSlots[0].slot_key }
      ]
    });
  };

  const removeSlotFromLogic = (category: MainCategory, index: number) => {
    setCategorySlots({
      ...categorySlots,
      [category]: categorySlots[category].filter((_, i) => i !== index)
    });
  };

  const updateLogicSlot = (category: MainCategory, index: number, slotKey: string) => {
    const newSlots = [...categorySlots[category]];
    newSlots[index].slotKey = slotKey;
    setCategorySlots({
      ...categorySlots,
      [category]: newSlots
    });
  };

  const saveCategoryLogic = async () => {
    if (!selectedCategory) return;

    await saveCategoryLogicMutation.mutateAsync({
      category: selectedCategory,
      slots: categorySlots[selectedCategory]
    });
  };

  const getAvailableOptions = () => {
    if (!selectedCategory || !processingOptions) return [];
    return processingOptions.filter(opt => opt.is_active);
  };

  const getSlotBadge = (slotKey: string) => {
    const slot = slotTypes?.find(st => st.slot_key === slotKey);
    return <Badge variant="default">{slot?.label || slotKey}</Badge>;
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

  // 드래그 앤 드롭 핸들러
  const handleDragEnd = async (event: DragEndEvent, slotKey: string) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const optionsForSlot = processingOptions?.filter(opt => opt.option_type === slotKey) || [];
    const oldIndex = optionsForSlot.findIndex(opt => opt.id === active.id);
    const newIndex = optionsForSlot.findIndex(opt => opt.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reorderedOptions = arrayMove(optionsForSlot, oldIndex, newIndex);

    // 각 옵션의 display_order 업데이트
    const updatePromises = reorderedOptions.map((option, index) =>
      updateOption.mutateAsync({
        id: option.id,
        updates: { display_order: index }
      })
    );

    try {
      await Promise.all(updatePromises);
      toast({
        title: '순서 변경 완료',
        description: '옵션 순서가 업데이트되었습니다.',
      });
    } catch (error) {
      toast({
        title: '순서 변경 실패',
        description: '옵션 순서 변경 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading || isLoadingAdvanced || isLoadingSlots || isLoadingLogic || isLoadingThickness) {
    return <div className="p-8 text-center">로딩 중...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-up">
      <Tabs defaultValue="advanced" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="advanced">고급 옵션 단가</TabsTrigger>
          <TabsTrigger value="logic">가공 로직 & 옵션</TabsTrigger>
        </TabsList>

        {/* 고급 옵션 단가 설정 */}
        <TabsContent value="advanced" className="space-y-4">
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
        </TabsContent>

        {/* 가공 로직 & 옵션 관리 */}
        <TabsContent value="logic" className="space-y-6">
          {/* 슬롯 타입 관리 */}
          <Card className="shadow-smooth">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">슬롯 타입 관리</CardTitle>
                  <CardDescription className="text-muted-foreground mt-2">
                    견적 계산기에 표시될 슬롯 타입을 추가하고 관리합니다.
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setIsAddSlotDialogOpen(true)}
                  variant="default"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  슬롯 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>슬롯 키</TableHead>
                      <TableHead>레이블</TableHead>
                      <TableHead>제목 (계산기)</TableHead>
                      <TableHead>설명 (계산기)</TableHead>
                      <TableHead>활성화</TableHead>
                      <TableHead className="text-right">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {slotTypes?.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell className="font-mono text-xs">{slot.slot_key}</TableCell>
                        <TableCell>
                          <Badge>{slot.label}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{slot.title || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                          {slot.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={slot.is_active ? 'default' : 'secondary'}>
                            {slot.is_active ? '활성' : '비활성'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditSlot(slot)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteSlot(slot.id)}
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
            </CardContent>
          </Card>

          {/* 로직 구성 */}
          <Card className="shadow-smooth">
            <CardHeader className="border-b border-border/50">
              <CardTitle className="text-xl flex items-center gap-2">
                <ListOrdered className="w-5 h-5" />
                로직 슬롯 관리
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                카테고리별로 슬롯 순서와 옵션을 구성합니다.
              </CardDescription>
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
              {selectedCategory && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        로직 구성
                      </h4>
                      <Button 
                        onClick={() => addSlotToLogic(selectedCategory)}
                        variant="outline"
                        size="sm"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        슬롯 추가
                      </Button>
                    </div>

                    {categorySlots[selectedCategory].length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        슬롯이 없습니다. "슬롯 추가" 버튼을 눌러 로직을 구성하세요.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {categorySlots[selectedCategory].map((slot, idx) => (
                          <Card key={idx} className="border-2">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <Badge variant="outline" className="text-lg px-3 py-1">
                                    {idx + 1}
                                  </Badge>
                                  <Select
                                    value={slot.slotKey}
                                    onValueChange={(value) => updateLogicSlot(selectedCategory, idx, value)}
                                  >
                                    <SelectTrigger className="w-[280px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {slotTypes?.filter(st => st.is_active).map(st => (
                                        <SelectItem key={st.id} value={st.slot_key}>
                                          {st.label} - {st.title}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <span className="text-sm text-muted-foreground">
                                    ({processingOptions?.filter(opt => 
                                      opt.option_type === slot.slotKey && 
                                      opt.is_active
                                    ).length || 0}개 옵션)
                                  </span>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeSlotFromLogic(selectedCategory, idx)}
                                  className="text-destructive hover:text-destructive"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    <Button 
                      onClick={saveCategoryLogic}
                      className="w-full"
                      disabled={categorySlots[selectedCategory].length === 0}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      로직 저장
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 슬롯별 옵션 관리 */}
          <Card className="shadow-smooth">
            <CardHeader className="border-b border-border/50">
              <div className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl">슬롯별 옵션 관리</CardTitle>
                  <CardDescription className="text-muted-foreground mt-2">
                    각 슬롯 타입별로 등록된 모든 옵션을 확인하고 수정합니다.
                  </CardDescription>
                </div>
                <Button 
                  onClick={() => setIsAddDialogOpen(true)}
                  variant="default"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  새 옵션 추가
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {slotTypes?.filter(st => st.is_active).map((slotType) => {
                const slotOptions = processingOptions?.filter(opt => opt.option_type === slotType.slot_key) || [];
                
                return (
                  <Card key={slotType.id} className="border-2">
                    <CardHeader className="pb-3 bg-muted/30">
                      <CardTitle className="text-base flex items-center gap-2">
                        {getSlotBadge(slotType.slot_key)}
                        <span className="font-medium text-foreground ml-2">
                          {slotType.title || slotType.label}
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          ({slotOptions.length}개)
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {slotOptions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm">
                          {slotType.label}에 등록된 옵션이 없습니다.
                        </div>
                      ) : (
                        <DndContext
                          sensors={sensors}
                          collisionDetection={closestCenter}
                          onDragEnd={(event) => handleDragEnd(event, slotType.slot_key)}
                        >
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12"></TableHead>
                                  <TableHead>옵션 ID</TableHead>
                                  <TableHead>이름</TableHead>
                                  <TableHead>적용 두께</TableHead>
                                  <TableHead>설명</TableHead>
                                  <TableHead className="text-right">배수</TableHead>
                                  <TableHead className="text-right">기본 비용</TableHead>
                                  <TableHead>활성화</TableHead>
                                  <TableHead className="text-right">작업</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                <SortableContext
                                  items={slotOptions.map(opt => opt.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  {slotOptions.map((option) => (
                                    <SortableOptionRow
                                      key={option.id}
                                      option={option}
                                      onEdit={startEdit}
                                      onDelete={handleDelete}
                                    />
                                  ))}
                                </SortableContext>
                              </TableBody>
                            </Table>
                          </div>
                        </DndContext>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 슬롯 추가 다이얼로그 */}
      <Dialog open={isAddSlotDialogOpen} onOpenChange={setIsAddSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>새 슬롯 타입 추가</DialogTitle>
            <DialogDescription>
              새로운 슬롯 타입의 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="slot_key">슬롯 키 * (예: slot5, custom1)</Label>
              <Input
                id="slot_key"
                value={newSlotForm.slot_key || ''}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, slot_key: e.target.value })}
                placeholder="slot5"
              />
            </div>
            <div>
              <Label htmlFor="label">레이블 * (관리자 화면)</Label>
              <Input
                id="label"
                value={newSlotForm.label || ''}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, label: e.target.value })}
                placeholder="선택 5"
              />
            </div>
            <div>
              <Label htmlFor="title">제목 (견적 계산기)</Label>
              <Input
                id="title"
                value={newSlotForm.title || ''}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, title: e.target.value })}
                placeholder="추가 가공 옵션"
              />
            </div>
            <div>
              <Label htmlFor="description">설명 (견적 계산기)</Label>
              <Textarea
                id="description"
                value={newSlotForm.description || ''}
                onChange={(e) => setNewSlotForm({ ...newSlotForm, description: e.target.value })}
                placeholder="추가적인 가공 옵션을 선택하세요"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={newSlotForm.is_active}
                onCheckedChange={(checked) => setNewSlotForm({ ...newSlotForm, is_active: checked })}
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSlotDialogOpen(false)}>
              취소
            </Button>
            <Button onClick={handleAddSlot}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 슬롯 수정 다이얼로그 */}
      <Dialog open={isEditSlotDialogOpen} onOpenChange={setIsEditSlotDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>슬롯 타입 수정</DialogTitle>
            <DialogDescription>
              슬롯 타입의 정보를 수정하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_slot_key">슬롯 키</Label>
              <Input
                id="edit_slot_key"
                value={editSlotForm.slot_key || ''}
                onChange={(e) => setEditSlotForm({ ...editSlotForm, slot_key: e.target.value })}
                disabled
              />
            </div>
            <div>
              <Label htmlFor="edit_label">레이블</Label>
              <Input
                id="edit_label"
                value={editSlotForm.label || ''}
                onChange={(e) => setEditSlotForm({ ...editSlotForm, label: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_title">제목 (견적 계산기)</Label>
              <Input
                id="edit_title"
                value={editSlotForm.title || ''}
                onChange={(e) => setEditSlotForm({ ...editSlotForm, title: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_description">설명 (견적 계산기)</Label>
              <Textarea
                id="edit_description"
                value={editSlotForm.description || ''}
                onChange={(e) => setEditSlotForm({ ...editSlotForm, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editSlotForm.is_active}
                onCheckedChange={(checked) => setEditSlotForm({ ...editSlotForm, is_active: checked })}
              />
              <Label>활성화</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={cancelEditSlot}>
              취소
            </Button>
            <Button onClick={saveEditSlot}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

            <div>
              <Label htmlFor="option_type">슬롯 타입</Label>
              <Select
                value={newOptionForm.option_type}
                onValueChange={(value) => setNewOptionForm({ ...newOptionForm, option_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slotTypes?.filter(st => st.is_active).map(st => (
                    <SelectItem key={st.id} value={st.slot_key}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="multiplier">배수 (×)</Label>
                <Input
                  id="multiplier"
                  type="number"
                  step="0.1"
                  value={newOptionForm.multiplier || ''}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="예: 1.8"
                />
                <p className="text-xs text-muted-foreground mt-1">원판 가격에 곱할 배수</p>
              </div>
              <div>
                <Label htmlFor="base_cost">기본 비용 (원)</Label>
                <Input
                  id="base_cost"
                  type="number"
                  value={newOptionForm.base_cost || ''}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0"
                />
                <p className="text-xs text-muted-foreground mt-1">고정 추가 비용</p>
              </div>
            </div>

            <div>
              <Label>적용 가능한 두께</Label>
              <div className="grid grid-cols-4 gap-2 mt-2 max-h-[200px] overflow-y-auto">
                {thicknessList.map((thickness) => (
                  <div key={thickness} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`new-thickness-${thickness}`}
                      checked={newOptionForm.applicable_thicknesses?.includes(thickness) || false}
                      onChange={(e) => {
                        const currentThicknesses = newOptionForm.applicable_thicknesses || [];
                        if (e.target.checked) {
                          setNewOptionForm({
                            ...newOptionForm,
                            applicable_thicknesses: [...currentThicknesses, thickness]
                          });
                        } else {
                          setNewOptionForm({
                            ...newOptionForm,
                            applicable_thicknesses: currentThicknesses.filter(t => t !== thickness)
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`new-thickness-${thickness}`} className="text-sm font-normal cursor-pointer">
                      {thickness}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                이 옵션이 적용 가능한 원판 두께를 선택하세요 (비어있으면 모든 두께에 적용)
              </p>
            </div>

            {/* 수량 및 다중 선택 설정 */}
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">수량 및 다중 선택 설정</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="min_quantity">최소 수량</Label>
                  <Input
                    id="min_quantity"
                    type="number"
                    min="0"
                    value={newOptionForm.min_quantity ?? 0}
                    onChange={(e) => setNewOptionForm({ ...newOptionForm, min_quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="max_quantity">최대 수량</Label>
                  <Input
                    id="max_quantity"
                    type="number"
                    min="0"
                    value={newOptionForm.max_quantity ?? ''}
                    onChange={(e) => setNewOptionForm({ ...newOptionForm, max_quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="무제한"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={newOptionForm.allow_multiple ?? false}
                    onCheckedChange={(checked) => setNewOptionForm({ ...newOptionForm, allow_multiple: checked })}
                  />
                  <Label>다중 선택</Label>
                </div>
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

            <div>
              <Label htmlFor="edit_option_type">슬롯 타입</Label>
              <Select
                value={editForm.option_type}
                onValueChange={(value) => setEditForm({ ...editForm, option_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {slotTypes?.filter(st => st.is_active).map(st => (
                    <SelectItem key={st.id} value={st.slot_key}>
                      {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label htmlFor="edit_multiplier">배수 (×)</Label>
                <Input
                  id="edit_multiplier"
                  type="number"
                  step="0.1"
                  value={editForm.multiplier || ''}
                  onChange={(e) => setEditForm({ ...editForm, multiplier: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="예: 1.8"
                />
                <p className="text-xs text-muted-foreground mt-1">원판 가격에 곱할 배수</p>
              </div>
              <div>
                <Label htmlFor="edit_base_cost">기본 비용 (원)</Label>
                <Input
                  id="edit_base_cost"
                  type="number"
                  value={editForm.base_cost || ''}
                  onChange={(e) => setEditForm({ ...editForm, base_cost: e.target.value ? parseFloat(e.target.value) : undefined })}
                />
                <p className="text-xs text-muted-foreground mt-1">고정 추가 비용</p>
              </div>
            </div>

            <div>
              <Label>적용 가능한 두께</Label>
              <div className="grid grid-cols-4 gap-2 mt-2 max-h-[200px] overflow-y-auto">
                {thicknessList.map((thickness) => (
                  <div key={thickness} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`edit-thickness-${thickness}`}
                      checked={editForm.applicable_thicknesses?.includes(thickness) || false}
                      onChange={(e) => {
                        const currentThicknesses = editForm.applicable_thicknesses || [];
                        if (e.target.checked) {
                          setEditForm({
                            ...editForm,
                            applicable_thicknesses: [...currentThicknesses, thickness]
                          });
                        } else {
                          setEditForm({
                            ...editForm,
                            applicable_thicknesses: currentThicknesses.filter(t => t !== thickness)
                          });
                        }
                      }}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor={`edit-thickness-${thickness}`} className="text-sm font-normal cursor-pointer">
                      {thickness}
                    </Label>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                이 옵션이 적용 가능한 원판 두께를 선택하세요 (비어있으면 모든 두께에 적용)
              </p>
            </div>

            {/* 수량 및 다중 선택 설정 */}
            <Separator />
            <div className="space-y-4">
              <h4 className="text-sm font-semibold">수량 및 다중 선택 설정</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_min_quantity">최소 수량</Label>
                  <Input
                    id="edit_min_quantity"
                    type="number"
                    min="0"
                    value={editForm.min_quantity ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, min_quantity: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit_max_quantity">최대 수량</Label>
                  <Input
                    id="edit_max_quantity"
                    type="number"
                    min="0"
                    value={editForm.max_quantity ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, max_quantity: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="무제한"
                  />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={editForm.allow_multiple ?? false}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, allow_multiple: checked })}
                  />
                  <Label>다중 선택</Label>
                </div>
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

      {/* 옵션 삭제 확인 다이얼로그 */}
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

      {/* 슬롯 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteSlotConfirmId !== null} onOpenChange={() => setDeleteSlotConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 이 슬롯 타입이 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSlot}>삭제</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProcessingOptionsManager;
