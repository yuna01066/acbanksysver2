import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, RefreshCw, Upload, Check, X, Search, Edit2, Save, Trash2, ArrowRightLeft, FileText, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { usePluuugApi, type PluuugEstimateItem, type PluuugEstimateItemClassification } from '@/hooks/usePluuugApi';
import { PROCESSING_TO_PLUUUG_ITEM, MATERIAL_TO_PLUUUG_ITEM, LOCAL_QUALITY_DISPLAY_NAMES } from '@/utils/pluuugEstimateItemMapping';
import { 
  registerAllLocalOptionsToPlluug, 
  updatePluuugEstimateItem,
  syncLocalFormatToPluuug,
  generateMappingCodeUpdate,
  getLocalFormatPreview,
  getAllLocalOptions,
  getLocalMaterialOptions,
  type RegisteredEstimateItem
} from '@/utils/pluuugEstimateItemSync';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditingItem {
  id: number;
  title: string;
  description: string;
  unit: string;
  unitCost: string;
  classificationId: number;
}

const EstimateItemSyncPanel: React.FC = () => {
  const pluuugApi = usePluuugApi();
  const [items, setItems] = useState<PluuugEstimateItem[]>([]);
  const [classifications, setClassifications] = useState<PluuugEstimateItemClassification[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClassification, setSelectedClassification] = useState<string>('all');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [registrationResult, setRegistrationResult] = useState<{
    registered: RegisteredEstimateItem[];
    skipped: string[];
    errors: { optionId: string; error: string }[];
  } | null>(null);
  const [syncResult, setSyncResult] = useState<{
    updated: { optionId: string; pluuugItemId: number; title: string }[];
    skipped: string[];
    errors: { optionId: string; error: string }[];
  } | null>(null);

  // 로컬 양식 미리보기
  const [showLocalPreview, setShowLocalPreview] = useState(false);
  const localFormatPreview = getLocalFormatPreview();
  const localOptions = getAllLocalOptions();
  const materialOptions = getLocalMaterialOptions();

  // 편집 모달 상태
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // 초기 데이터 로드
  const loadData = async () => {
    const [classResult, itemResult] = await Promise.all([
      pluuugApi.getEstimateItemClassifications(),
      pluuugApi.getEstimateItems()
    ]);

    if (classResult.data?.results) {
      setClassifications(classResult.data.results);
    }

    if (itemResult.data?.results) {
      setItems(itemResult.data.results);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 로컬 옵션 ID 매핑 확인
  const getLocalOptionId = (item: PluuugEstimateItem): string | null => {
    // 재질 매핑 확인
    for (const [quality, id] of Object.entries(MATERIAL_TO_PLUUUG_ITEM)) {
      if (id === item.id) return `material:${quality}`;
    }
    
    // 가공 옵션 매핑 확인
    for (const [optionId, info] of Object.entries(PROCESSING_TO_PLUUUG_ITEM)) {
      if (info.pluuugItemId === item.id) return optionId;
    }
    
    return null;
  };

  // 로컬 미매핑 항목 확인
  const getUnmappedLocalOptions = (): string[] => {
    return Object.entries(PROCESSING_TO_PLUUUG_ITEM)
      .filter(([_, info]) => !info.pluuugItemId)
      .map(([optionId]) => optionId);
  };

  // 매핑된 항목 개수
  const getMappedCount = (): number => {
    return Object.entries(PROCESSING_TO_PLUUUG_ITEM)
      .filter(([_, info]) => info.pluuugItemId)
      .length;
  };

  // 일괄 등록
  const handleBulkRegister = async () => {
    setIsRegistering(true);
    setRegistrationResult(null);
    try {
      const result = await registerAllLocalOptionsToPlluug();
      setRegistrationResult(result);
      
      if (result.registered.length > 0) {
        toast.success(`${result.registered.length}개 항목이 Pluuug에 등록되었습니다`);
        
        // 매핑 코드 생성 및 콘솔 출력
        const mappingCode = generateMappingCodeUpdate(result.registered);
        console.log('\n===== 매핑 테이블 업데이트 코드 =====');
        console.log(mappingCode);
        console.log('=====================================\n');
        
        // 목록 새로고침
        await loadData();
      }
      
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length}개 항목 등록 실패`);
      }
    } catch (err: any) {
      toast.error(`등록 오류: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  // 로컬 양식을 Pluuug에 적용
  const handleSyncLocalFormat = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const result = await syncLocalFormatToPluuug();
      setSyncResult(result);
      
      if (result.updated.length > 0) {
        toast.success(`${result.updated.length}개 항목이 로컬 양식으로 업데이트되었습니다`);
        await loadData();
      }
      
      if (result.skipped.length > 0) {
        toast.info(`${result.skipped.length}개 항목은 Pluuug ID가 없어 스킵되었습니다`);
      }
      
      if (result.errors.length > 0) {
        toast.error(`${result.errors.length}개 항목 업데이트 실패`);
        console.error('Sync errors:', result.errors);
      }
    } catch (err: any) {
      toast.error(`동기화 오류: ${err.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 항목 편집 시작
  const handleEditItem = (item: PluuugEstimateItem) => {
    setEditingItem({
      id: item.id,
      title: item.title,
      description: item.description || '',
      unit: item.unit,
      unitCost: item.unitCost,
      classificationId: item.classification.id
    });
  };

  // 항목 저장
  const handleSaveItem = async () => {
    if (!editingItem) return;
    
    setIsSaving(true);
    try {
      const result = await updatePluuugEstimateItem(editingItem.id, {
        title: editingItem.title,
        description: editingItem.description,
        unit: editingItem.unit,
        unitCost: editingItem.unitCost,
        classification: { id: editingItem.classificationId }
      });
      
      if (result.success) {
        toast.success('항목이 업데이트되었습니다');
        setEditingItem(null);
        await loadData();
      } else {
        toast.error(`업데이트 실패: ${result.error}`);
      }
    } catch (err: any) {
      toast.error(`오류: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 항목 삭제
  const handleDeleteItem = async (itemId: number) => {
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;
    
    const result = await pluuugApi.deleteEstimateItem(itemId);
    if (result.status === 200 || result.status === 204) {
      toast.success('항목이 삭제되었습니다');
      await loadData();
    } else {
      toast.error(`삭제 실패: ${result.error}`);
    }
  };

  // 필터링된 항목
  const filteredItems = items.filter(item => {
    const matchesSearch = searchQuery === '' ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesClassification = selectedClassification === 'all' ||
      item.classification.id.toString() === selectedClassification;
    
    return matchesSearch && matchesClassification;
  });

  // 분류별 그룹핑
  const groupedItems = classifications
    .filter(cls => selectedClassification === 'all' || cls.id.toString() === selectedClassification)
    .map(cls => ({
      classification: cls,
      items: filteredItems.filter(item => item.classification.id === cls.id)
    }))
    .filter(group => group.items.length > 0);

  const unmappedOptions = getUnmappedLocalOptions();
  const mappedCount = getMappedCount();

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle>Pluuug 견적 항목 동기화</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              로컬 가공 옵션을 Pluuug estimate.item으로 등록하고 양식을 동기화합니다
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={loadData} 
              disabled={pluuugApi.loading}
              size="sm"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${pluuugApi.loading ? 'animate-spin' : ''}`} />
              새로고침
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLocalPreview(true)}
              size="sm"
            >
              <Eye className="w-4 h-4 mr-2" />
              로컬 양식 미리보기
            </Button>
          </div>
        </div>

        {/* 동기화 상태 요약 */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-xs">
            <FileText className="w-3 h-3 mr-1" />
            로컬 옵션: {Object.keys(PROCESSING_TO_PLUUUG_ITEM).length}개
          </Badge>
          <Badge variant="default" className="text-xs">
            <Check className="w-3 h-3 mr-1" />
            매핑됨: {mappedCount}개
          </Badge>
          {unmappedOptions.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              미등록: {unmappedOptions.length}개
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            Pluuug 항목: {items.length}개
          </Badge>
        </div>

        {/* 액션 버튼 */}
        <div className="flex flex-wrap gap-2">
          {unmappedOptions.length > 0 && (
            <Button 
              onClick={handleBulkRegister}
              disabled={isRegistering}
              size="sm"
            >
              {isRegistering ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-2" />
              )}
              로컬 옵션 일괄 등록 ({unmappedOptions.length}개)
            </Button>
          )}
          {mappedCount > 0 && (
            <Button 
              onClick={handleSyncLocalFormat}
              disabled={isSyncing}
              variant="secondary"
              size="sm"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ArrowRightLeft className="w-4 h-4 mr-2" />
              )}
              Pluuug에 로컬 양식 적용 ({mappedCount}개)
            </Button>
          )}
        </div>

        {/* 필터 영역 */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="항목명 또는 설명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedClassification} onValueChange={setSelectedClassification}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="분류 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 분류</SelectItem>
              {classifications.map((cls) => (
                <SelectItem key={cls.id} value={cls.id.toString()}>
                  {cls.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 등록 결과 표시 */}
        {registrationResult && (
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">등록 결과</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default">
                <Check className="w-3 h-3 mr-1" />
                등록됨: {registrationResult.registered.length}
              </Badge>
              <Badge variant="secondary">
                스킵됨: {registrationResult.skipped.length}
              </Badge>
              {registrationResult.errors.length > 0 && (
                <Badge variant="destructive">
                  <X className="w-3 h-3 mr-1" />
                  오류: {registrationResult.errors.length}
                </Badge>
              )}
            </div>
            {registrationResult.registered.length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                💡 매핑 코드가 콘솔에 출력되었습니다. 개발자 도구에서 확인하세요.
              </p>
            )}
          </div>
        )}

        {/* 동기화 결과 표시 */}
        {syncResult && (
          <div className="p-4 rounded-lg bg-muted/50">
            <h4 className="font-medium mb-2">양식 적용 결과</h4>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="default">
                <Check className="w-3 h-3 mr-1" />
                업데이트됨: {syncResult.updated.length}
              </Badge>
              <Badge variant="secondary">
                스킵됨: {syncResult.skipped.length}
              </Badge>
              {syncResult.errors.length > 0 && (
                <Badge variant="destructive">
                  <X className="w-3 h-3 mr-1" />
                  오류: {syncResult.errors.length}
                </Badge>
              )}
            </div>
            {syncResult.updated.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p>업데이트된 항목:</p>
                <ul className="list-disc list-inside mt-1">
                  {syncResult.updated.slice(0, 5).map((item) => (
                    <li key={item.optionId}>{item.title} (ID: {item.pluuugItemId})</li>
                  ))}
                  {syncResult.updated.length > 5 && (
                    <li>... 외 {syncResult.updated.length - 5}개</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Loader2 className="w-12 h-12 mx-auto mb-4 opacity-30 animate-spin" />
            <p>데이터를 불러오는 중...</p>
          </div>
        ) : groupedItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>검색 조건에 맞는 항목이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {groupedItems.map(({ classification, items: classItems }) => (
              <div key={classification.id} className="border rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 p-3 bg-muted">
                  <Badge variant="outline" className="text-xs">
                    ID: {classification.id}
                  </Badge>
                  <span className="font-semibold text-sm">{classification.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({classItems.length}개)
                  </span>
                </div>
                <div className="divide-y">
                  {classItems.map((item) => {
                    const localId = getLocalOptionId(item);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-3 hover:bg-accent/30 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs shrink-0">
                              ID: {item.id}
                            </Badge>
                            <span className="font-medium text-sm">{item.title}</span>
                            {localId && (
                              <Badge variant="default">
                                <Check className="w-3 h-3 mr-1" />
                                {localId}
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <Badge variant="outline" className="text-xs">
                            {item.unit}
                          </Badge>
                          {item.unitCost !== '0.00' && (
                            <span className="text-xs text-muted-foreground">
                              ₩{parseFloat(item.unitCost).toLocaleString()}
                            </span>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditItem(item)}
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* 편집 모달 */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>항목 편집</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <div className="space-y-4">
              <div>
                <Label>제목</Label>
                <Input
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                />
              </div>
              <div>
                <Label>설명</Label>
                <Input
                  value={editingItem.description}
                  onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>단위</Label>
                  <Input
                    value={editingItem.unit}
                    onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  />
                </div>
                <div>
                  <Label>단가</Label>
                  <Input
                    value={editingItem.unitCost}
                    onChange={(e) => setEditingItem({ ...editingItem, unitCost: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>분류</Label>
                <Select
                  value={editingItem.classificationId.toString()}
                  onValueChange={(v) => setEditingItem({ ...editingItem, classificationId: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {classifications.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              취소
            </Button>
            <Button onClick={handleSaveItem} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 로컬 양식 미리보기 모달 */}
      <Dialog open={showLocalPreview} onOpenChange={setShowLocalPreview}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>로컬 견적서 양식 미리보기</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="processing" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="processing">가공 옵션</TabsTrigger>
              <TabsTrigger value="materials">재질</TabsTrigger>
            </TabsList>
            <TabsContent value="processing">
              <ScrollArea className="h-[50vh]">
                <div className="space-y-4 pr-4">
                  {localFormatPreview.map((group) => (
                    <div key={group.category} className="border rounded-lg overflow-hidden">
                      <div className="p-3 bg-muted font-semibold text-sm">
                        {group.category}
                      </div>
                      <div className="divide-y">
                        {group.items.map((item) => (
                          <div key={item.optionId} className="p-3 flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-sm">{item.title}</span>
                                {item.hasPluuugId ? (
                                  <Badge variant="default" className="text-xs">
                                    <Check className="w-3 h-3 mr-1" />
                                    매핑됨
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-xs">
                                    미등록
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                로컬 표시: {item.localTitle} | 단위: {item.unit}
                              </p>
                              {item.description && (
                                <p className="text-xs text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
            <TabsContent value="materials">
              <ScrollArea className="h-[50vh]">
                <div className="border rounded-lg overflow-hidden">
                  <div className="p-3 bg-muted font-semibold text-sm">
                    재질 (Materials)
                  </div>
                  <div className="divide-y">
                    {materialOptions.map((material) => (
                      <div key={material.qualityId} className="p-3 flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{material.displayName}</span>
                            <Badge variant="default" className="text-xs">
                              <Check className="w-3 h-3 mr-1" />
                              ID: {material.pluuugItemId}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            품질 ID: {material.qualityId}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLocalPreview(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default EstimateItemSyncPanel;
