import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Plus, FolderOpen, FileText, ChevronDown, ChevronUp, Download } from 'lucide-react';
import MaterialOrderCard, { MaterialOrderData } from '@/components/MaterialOrderCard';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ordered: { label: '발주완료', color: 'bg-blue-500' },
  pending_delivery: { label: '입고대기', color: 'bg-amber-500' },
  delivered: { label: '입고완료', color: 'bg-emerald-500' },
  cancelled: { label: '취소', color: 'bg-destructive' },
};

const emptyForm = {
  order_date: format(new Date(), 'yyyy-MM-dd'),
  material: '',
  quality: '',
  thickness: '',
  size_name: '',
  width: 0,
  height: 0,
  quantity: 1,
  color_code: '',
  surface_type: '',
  project_id: '',
  quote_id: '',
  quote_item_summary: '',
  memo: '',
  status: 'ordered',
};

interface ImportItemForm {
  material: string;
  quality: string;
  thickness: string;
  size_name: string;
  width: number;
  height: number;
  quantity: number;
  color_code: string;
  surface_type: string;
  summary: string;
  production_note: string;
}

const MaterialOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaterialOrderData | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importSource, setImportSource] = useState<'project' | 'quote' | null>(null);
  const [selectedProjectForImport, setSelectedProjectForImport] = useState('');
  const [selectedQuoteForImport, setSelectedQuoteForImport] = useState('');
  const [importItems, setImportItems] = useState<ImportItemForm[]>([]);

  const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['material-orders', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_orders')
        .select('*, projects(id, name), saved_quotes(id, quote_number, project_name)')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        projects: d.projects ? { id: d.projects.id, project_name: d.projects.name } : null,
        saved_quotes: d.saved_quotes || null,
      })) as MaterialOrderData[];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(p => ({ id: p.id, project_name: p.name }));
    },
    enabled: !!user,
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['quotes-for-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, items')
        .order('quote_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: colorOptions = [] } = useQuery({
    queryKey: ['color-options-for-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('color_options')
        .select('color_name')
        .eq('is_active', true)
        .order('color_name');
      if (error) throw error;
      return (data || []).map(c => c.color_name);
    },
    enabled: !!user,
  });

  const MATERIAL_OPTIONS = ['아크릴 판', '제품 제작'];
  const QUALITY_OPTIONS = ['Bright (브라이트)', 'Clear (클리어)', 'Astel (아스텔)', 'Mirror (미러)', 'Astel Mirror (아스텔미러)', 'Satin (사틴)'];
  const THICKNESS_OPTIONS = ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '15T', '20T', '25T', '30T'];
  const SIZE_OPTIONS = ['3*6', '대3*6', '소3*6', '4*5', '대4*5', '4*6', '4*8', '4*10', '5*5', '5*6', '5*8', '1*2', '소1*2'];
  const SURFACE_OPTIONS = ['단면', '양면'];
  const SPECIAL_COLOR_OPTIONS = ['조색', '미정', '기타'];

  // Fetch quote items for project import
  const { data: projectQuoteItems = [] } = useQuery({
    queryKey: ['project-quote-items', selectedProjectForImport],
    queryFn: async () => {
      if (!selectedProjectForImport) return [];
      const { data: quotes } = await supabase
        .from('saved_quotes')
        .select('items')
        .eq('project_id', selectedProjectForImport);
      if (!quotes || quotes.length === 0) return [];
      const allItems: any[] = [];
      quotes.forEach(q => {
        if (Array.isArray(q.items)) allItems.push(...q.items);
      });
      return allItems.map((item: any, idx: number) => ({
        idx,
        material: item.material || item.소재 || '',
        quality: item.quality || item.품질 || '',
        thickness: item.thickness || item.두께 || '',
        size_name: item.size || item.사이즈 || item.size_name || '',
        surface: item.surface || '',
        selectedColor: item.selectedColor || item.colorType || '',
        width: item.width || item.가로 || 0,
        height: item.height || item.세로 || 0,
        quantity: item.quantity || item.수량 || 1,
        summary: `${item.material || item.소재 || ''} ${item.quality || item.품질 || ''} ${item.thickness || item.두께 || ''} ${item.size || item.사이즈 || ''}`,
      }));
    },
    enabled: !!selectedProjectForImport,
  });

  const selectedQuoteItems = useMemo(() => {
    if (!selectedQuoteForImport) return [];
    const quote = allQuotes.find(q => q.id === selectedQuoteForImport);
    if (!quote || !Array.isArray(quote.items)) return [];
    return quote.items.map((item: any, idx: number) => ({
      idx,
      material: item.material || item.소재 || '',
      quality: item.quality || item.품질 || '',
      thickness: item.thickness || item.두께 || '',
      size_name: item.size || item.사이즈 || item.size_name || '',
      surface: item.surface || '',
      selectedColor: item.selectedColor || item.colorType || '',
      width: item.width || item.가로 || 0,
      height: item.height || item.세로 || 0,
      quantity: item.quantity || item.수량 || 1,
      summary: `${item.material || item.소재 || ''} ${item.quality || item.품질 || ''} ${item.thickness || item.두께 || ''} ${item.size || item.사이즈 || ''}`,
    }));
  }, [selectedQuoteForImport, allQuotes]);

  const orderDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    orders.forEach(o => { dateMap.set(o.order_date, (dateMap.get(o.order_date) || 0) + 1); });
    return dateMap;
  }, [orders]);

  const selectedDayOrders = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return orders.filter(o => o.order_date === dateStr);
  }, [orders, selectedDate]);

  const displayOrders = showAllOrders ? orders : selectedDayOrders;

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const { error } = await supabase.from('material_orders').insert({
        order_date: data.order_date,
        material: data.material,
        quality: data.quality,
        thickness: data.thickness,
        size_name: data.size_name,
        width: data.width,
        height: data.height,
        quantity: data.quantity,
        color_code: data.color_code || null,
        surface_type: data.surface_type || null,
        project_id: data.project_id || null,
        quote_id: data.quote_id || null,
        quote_item_summary: data.quote_item_summary || null,
        memo: data.memo || null,
        status: data.status,
        user_id: user!.id,
        user_name: profile?.full_name || user!.email || '',
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-orders'] });
      toast.success('발주가 등록되었습니다.');
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('등록에 실패했습니다.'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof emptyForm> }) => {
      const { error } = await supabase.from('material_orders').update({
        ...data,
        project_id: data.project_id || null,
        quote_id: data.quote_id || null,
        quote_item_summary: data.quote_item_summary || null,
        memo: data.memo || null,
        color_code: data.color_code || null,
        surface_type: data.surface_type || null,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-orders'] });
      toast.success('수정되었습니다.');
      setDialogOpen(false);
      setEditingOrder(null);
      setForm(emptyForm);
    },
    onError: () => toast.error('수정에 실패했습니다.'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('material_orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-orders'] });
      toast.success('삭제되었습니다.');
    },
    onError: () => toast.error('삭제에 실패했습니다.'),
  });

  const handleSubmit = () => {
    if (!form.material || !form.quality || !form.thickness || !form.size_name) {
      toast.error('소재, 품질, 두께, 사이즈를 입력해주세요.');
      return;
    }
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const openEdit = (order: MaterialOrderData) => {
    setEditingOrder(order);
    setForm({
      order_date: order.order_date,
      material: order.material,
      quality: order.quality,
      thickness: order.thickness,
      size_name: order.size_name,
      width: order.width,
      height: order.height,
      quantity: order.quantity,
      color_code: (order as any).color_code || '',
      surface_type: (order as any).surface_type || '',
      project_id: order.project_id || '',
      quote_id: (order as any).quote_id || '',
      quote_item_summary: order.quote_item_summary || '',
      memo: order.memo || '',
      status: order.status,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditingOrder(null);
    setForm({ ...emptyForm, order_date: format(selectedDate, 'yyyy-MM-dd') });
    setDialogOpen(true);
  };

  const handleImportItems = () => {
    const validItems = importItems.filter(item => item.material && item.size_name);
    if (validItems.length === 0) {
      toast.error('원판 정보를 입력해주세요.');
      return;
    }
    validItems.forEach(item => {
      createMutation.mutate({
        ...emptyForm,
        order_date: format(selectedDate, 'yyyy-MM-dd'),
        material: item.material,
        quality: item.quality,
        thickness: item.thickness,
        size_name: item.size_name,
        width: item.width,
        height: item.height,
        quantity: item.quantity,
        color_code: item.color_code,
        surface_type: item.surface_type,
        memo: item.production_note || '',
        project_id: importSource === 'project' ? selectedProjectForImport : '',
        quote_id: importSource === 'quote' ? selectedQuoteForImport : '',
        quote_item_summary: item.summary,
      });
    });
    closeImportDialog();
  };

  const closeImportDialog = () => {
    setImportDialogOpen(false);
    setImportSource(null);
    setSelectedProjectForImport('');
    setSelectedQuoteForImport('');
    setImportItems([]);
  };

  const initImportItems = useCallback((items: any[]) => {
    setImportItems(items.map(item => {
      const isProductManufacturing = item.material === '제품 제작';
      // Extract surface type from quote surface field (e.g. "4*8 (1220*2420): 양면" → "양면")
      const surfaceRaw = item.surface || '';
      let surfaceType = '';
      if (surfaceRaw.includes('양면')) surfaceType = '양면';
      else if (surfaceRaw.includes('단면')) surfaceType = '단면';
      // Extract color code from quote data
      const colorCode = item.selectedColor || item.colorType || '';
      // Extract base size name (e.g. "4*8" from "4*8 (1220×2420)")
      const rawSizeName = isProductManufacturing ? '' : (item.size_name || '');
      const baseSizeName = rawSizeName.replace(/\s*\(.*\)$/, '');
      return {
        material: item.material,
        quality: item.quality,
        thickness: item.thickness,
        size_name: baseSizeName,
        width: isProductManufacturing ? 0 : (item.width || 0),
        height: isProductManufacturing ? 0 : (item.height || 0),
        quantity: item.quantity,
        color_code: colorCode,
        surface_type: surfaceType,
        summary: isProductManufacturing ? `재단 사이즈: ${item.size_name}` : item.summary,
        production_note: '',
      };
    }));
  }, []);

  const updateImportItem = (index: number, field: keyof ImportItemForm, value: string | number) => {
    setImportItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
  };

  const addManualImportItem = () => {
    setImportItems(prev => [...prev, {
      material: '', quality: '', thickness: '', size_name: '',
      width: 0, height: 0, quantity: 1, color_code: '', surface_type: '', summary: '수동 입력', production_note: '',
    }]);
  };

  const removeImportItem = (index: number) => {
    setImportItems(prev => prev.filter((_, i) => i !== index));
  };

  const canManage = isAdmin || isModerator;

  const currentReferenceItems = importSource === 'project' ? projectQuoteItems : selectedQuoteItems;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">원판 발주 관리</h1>
              <p className="text-xs text-muted-foreground">자재 발주 내역을 관리합니다</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" />
              불러오기
            </Button>
            <Button size="sm" onClick={openNew} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              수동 추가
            </Button>
          </div>
        </div>

        {/* Calendar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              locale={ko}
              className="mx-auto"
              modifiers={{ hasOrders: (date) => orderDates.has(format(date, 'yyyy-MM-dd')) }}
              modifiersClassNames={{ hasOrders: 'font-bold text-primary' }}
              components={{
                DayContent: ({ date }) => {
                  const count = orderDates.get(format(date, 'yyyy-MM-dd'));
                  return (
                    <div className="relative flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {count && <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                  );
                },
              }}
            />
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              {showAllOrders
                ? `${format(calendarMonth, 'yyyy년 M월', { locale: ko })} 전체 발주`
                : `${format(selectedDate, 'M월 d일 (EEE)', { locale: ko })} 발주`}
              <span className="ml-2 text-muted-foreground font-normal">{displayOrders.length}건</span>
            </h2>
            <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setShowAllOrders(!showAllOrders)}>
              {showAllOrders ? '선택일만' : '전체 보기'}
              {showAllOrders ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">불러오는 중...</div>
          ) : displayOrders.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              {showAllOrders ? '이번 달 발주 내역이 없습니다.' : '해당 날짜의 발주 내역이 없습니다.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {displayOrders.map(order => (
                <MaterialOrderCard
                  key={order.id}
                  order={order}
                  canManage={canManage}
                  currentUserId={user?.id}
                  onEdit={openEdit}
                  onDelete={(id) => deleteMutation.mutate(id)}
                  showDate={showAllOrders}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingOrder ? '발주 수정' : '발주 등록'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">발주일</Label>
                <Input type="date" value={form.order_date} onChange={e => setForm(f => ({ ...f, order_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">상태</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_MAP).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">소재</Label>
                <Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="예: 아크릴 판" />
              </div>
              <div>
                <Label className="text-xs">품질</Label>
                <Input value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value }))} placeholder="예: Bright (브라이트)" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">두께</Label>
                <Input value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} placeholder="예: 5T" />
              </div>
              <div>
                <Label className="text-xs">컬러 코드 (AC-)</Label>
                <Input value={form.color_code} onChange={e => setForm(f => ({ ...f, color_code: e.target.value }))} placeholder="예: AC-001" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">양단면</Label>
                <Input value={form.surface_type} onChange={e => setForm(f => ({ ...f, surface_type: e.target.value }))} placeholder="예: 단면, 양면" />
              </div>
              <div>
                <Label className="text-xs">사이즈명</Label>
                <Input value={form.size_name} onChange={e => setForm(f => ({ ...f, size_name: e.target.value }))} placeholder="예: 4x8" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">가로(mm)</Label>
                <Input type="number" value={form.width} onChange={e => setForm(f => ({ ...f, width: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">세로(mm)</Label>
                <Input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: Number(e.target.value) }))} />
              </div>
              <div>
                <Label className="text-xs">수량</Label>
                <Input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">연결 프로젝트</Label>
              <Select value={form.project_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, project_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">연결 견적서</Label>
              <Select value={form.quote_id || '__none__'} onValueChange={v => setForm(f => ({ ...f, quote_id: v === '__none__' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {allQuotes.map(q => (
                    <SelectItem key={q.id} value={q.id}>{q.quote_number} {q.project_name ? `- ${q.project_name}` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">원판 관련 참고사항</Label>
              <Textarea value={form.memo} onChange={e => setForm(f => ({ ...f, memo: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editingOrder ? '수정' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={(open) => { if (!open) closeImportDialog(); else setImportDialogOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>불러오기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Source selection */}
            {!importSource && (
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  onClick={() => setImportSource('project')}
                >
                  <FolderOpen className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">프로젝트에서</span>
                  <span className="text-[10px] text-muted-foreground text-center">프로젝트에 연결된 견적 항목을 참조합니다</span>
                </button>
                <button
                  className="flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
                  onClick={() => setImportSource('quote')}
                >
                  <FileText className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium">견적서에서</span>
                  <span className="text-[10px] text-muted-foreground text-center">특정 견적서의 항목을 참조합니다</span>
                </button>
              </div>
            )}

            {/* Project selection */}
            {importSource === 'project' && (
              <div>
                <Label className="text-xs">프로젝트 선택</Label>
                <Select value={selectedProjectForImport} onValueChange={v => { setSelectedProjectForImport(v); setImportItems([]); }}>
                  <SelectTrigger><SelectValue placeholder="프로젝트를 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Quote selection */}
            {importSource === 'quote' && (
              <div>
                <Label className="text-xs">견적서 선택</Label>
                <Select value={selectedQuoteForImport} onValueChange={v => { setSelectedQuoteForImport(v); setImportItems([]); }}>
                  <SelectTrigger><SelectValue placeholder="견적서를 선택하세요" /></SelectTrigger>
                  <SelectContent>
                    {allQuotes.map(q => (
                      <SelectItem key={q.id} value={q.id}>
                        {q.quote_number} {q.project_name ? `- ${q.project_name}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Reference items */}
            {importSource && currentReferenceItems.length > 0 && importItems.length === 0 && (() => {
              const hasProductItems = currentReferenceItems.some((item: any) => item.material === '제품 제작');
              const allProductItems = currentReferenceItems.every((item: any) => item.material === '제품 제작');
              return (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    {currentReferenceItems.length}개 견적 항목이 발견되었습니다.
                    {allProductItems ? ' (재단 사이즈 기준)' : hasProductItems ? ' (원판/재단 사이즈 혼합)' : ' (원판 사이즈 기준)'}
                  </p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {currentReferenceItems.map((item: any, i: number) => (
                      <div key={i} className="p-2 rounded-lg border text-xs bg-muted/30">
                        <div className="flex items-center gap-1.5">
                          {item.material === '제품 제작' && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 bg-amber-50 text-amber-700 border-amber-200">재단</Badge>
                          )}
                          <span className="font-medium">{item.material} {item.quality} {item.thickness}</span>
                          <span className="text-muted-foreground">{item.size_name} ×{item.quantity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hasProductItems ? (
                    <p className="text-[11px] text-muted-foreground">
                      ※ <span className="text-amber-600 font-medium">재단</span> 표시 항목은 재단 후 최종 사이즈입니다. 원판 정보를 별도로 입력해주세요.
                    </p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">
                      ※ 위 항목은 원판 사이즈 기준입니다. 필요시 수정하여 발주를 등록할 수 있습니다.
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => initImportItems(currentReferenceItems)}>
                    {hasProductItems ? '원판 정보 입력하기' : '발주 정보 확인/수정'}
                  </Button>
                </div>
              );
            })()}

            {/* No items found */}
            {importSource && (
              (importSource === 'project' && selectedProjectForImport && currentReferenceItems.length === 0 && importItems.length === 0) ||
              (importSource === 'quote' && selectedQuoteForImport && currentReferenceItems.length === 0 && importItems.length === 0)
            ) && (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-muted-foreground">견적 항목이 없습니다.</p>
                <Button variant="outline" size="sm" onClick={addManualImportItem}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  수동으로 원판 추가
                </Button>
              </div>
            )}

            {/* Import items form */}
            {importItems.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium">원판 발주 정보 입력</p>
                  <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={addManualImportItem}>
                    <Plus className="h-3 w-3" /> 항목 추가
                  </Button>
                </div>
                <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
                  {importItems.map((item, i) => (
                    <Card key={i} className="border-border/50">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">
                            {item.summary ? `참조: ${item.summary}` : `항목 ${i + 1}`}
                          </span>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeImportItem(i)}>
                            <span className="text-xs">✕</span>
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px]">소재</Label>
                            <Select value={item.material} onValueChange={v => updateImportItem(i, 'material', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>
                                {MATERIAL_OPTIONS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">품질</Label>
                            <Select value={item.quality} onValueChange={v => updateImportItem(i, 'quality', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>
                                {QUALITY_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">두께</Label>
                            <Select value={item.thickness} onValueChange={v => updateImportItem(i, 'thickness', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>
                                {THICKNESS_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <Label className="text-[10px]">컬러 코드</Label>
                            <Select value={item.color_code} onValueChange={v => updateImportItem(i, 'color_code', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent className="max-h-60">
                                {SPECIAL_COLOR_OPTIONS.map(s => (
                                  <SelectItem key={s} value={s} className="font-medium">{s}</SelectItem>
                                ))}
                                <div className="h-px bg-border my-1" />
                                {colorOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">양단면</Label>
                            <Select value={item.surface_type} onValueChange={v => updateImportItem(i, 'surface_type', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>
                                {SURFACE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">사이즈명</Label>
                            <Select value={item.size_name} onValueChange={v => updateImportItem(i, 'size_name', v)}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="선택" /></SelectTrigger>
                              <SelectContent>
                                {SIZE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px]">수량</Label>
                            <Input className="h-7 text-xs" type="number" value={item.quantity} onChange={e => updateImportItem(i, 'quantity', Number(e.target.value) || 1)} />
                          </div>
                        </div>
                        <div>
                          <Label className="text-[10px]">원판생산 참고사항</Label>
                          <Input className="h-7 text-xs" placeholder="특이사항 기재" value={item.production_note} onChange={e => updateImportItem(i, 'production_note', e.target.value)} />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Back button */}
            {importSource && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setImportSource(null); setSelectedProjectForImport(''); setSelectedQuoteForImport(''); setImportItems([]); }}>
                ← 소스 선택으로 돌아가기
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeImportDialog}>취소</Button>
            {importItems.length > 0 && (
              <Button onClick={handleImportItems} disabled={createMutation.isPending}>
                발주 등록 ({importItems.filter(it => it.material && it.size_name).length}건)
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialOrdersPage;
