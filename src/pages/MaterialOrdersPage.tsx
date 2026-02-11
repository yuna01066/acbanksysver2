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
import { format, isSameDay, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Plus, Package, FolderOpen, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  ordered: { label: '발주완료', color: 'bg-blue-500' },
  pending_delivery: { label: '입고대기', color: 'bg-amber-500' },
  delivered: { label: '입고완료', color: 'bg-emerald-500' },
  cancelled: { label: '취소', color: 'bg-destructive' },
};

interface MaterialOrder {
  id: string;
  order_date: string;
  material: string;
  quality: string;
  thickness: string;
  size_name: string;
  width: number;
  height: number;
  quantity: number;
  project_id: string | null;
  quote_item_summary: string | null;
  user_id: string;
  user_name: string;
  memo: string | null;
  status: string;
  created_at: string;
  projects?: { id: string; project_name: string } | null;
}

const emptyForm = {
  order_date: format(new Date(), 'yyyy-MM-dd'),
  material: '',
  quality: '',
  thickness: '',
  size_name: '',
  width: 0,
  height: 0,
  quantity: 1,
  project_id: '',
  quote_item_summary: '',
  memo: '',
  status: 'ordered',
};

const MaterialOrdersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<MaterialOrder | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showAllOrders, setShowAllOrders] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedProjectForImport, setSelectedProjectForImport] = useState('');

  // Fetch orders for current month
  const monthStart = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['material-orders', monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('material_orders')
        .select('*, projects(id, name)')
        .gte('order_date', monthStart)
        .lte('order_date', monthEnd)
        .order('order_date', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Map name to project_name for our interface
      return (data || []).map((d: any) => ({
        ...d,
        projects: d.projects ? { id: d.projects.id, project_name: d.projects.name } : null,
      })) as MaterialOrder[];
    },
    enabled: !!user,
  });

  // Fetch projects for linking
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

  // Fetch quote items for import
  const { data: projectQuoteItems = [] } = useQuery({
    queryKey: ['project-quote-items', selectedProjectForImport],
    queryFn: async () => {
      if (!selectedProjectForImport) return [];
      // Get quotes linked to this project
      const { data: quotes } = await supabase
        .from('saved_quotes')
        .select('items')
        .eq('project_id', selectedProjectForImport);
      if (!quotes || quotes.length === 0) return [];

      // Merge all items from all linked quotes
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
        width: item.width || item.가로 || 0,
        height: item.height || item.세로 || 0,
        quantity: item.quantity || item.수량 || 1,
        summary: `${item.material || item.소재 || ''} ${item.quality || item.품질 || ''} ${item.thickness || item.두께 || ''} ${item.size || item.사이즈 || ''}`,
      }));
    },
    enabled: !!selectedProjectForImport,
  });

  // Calendar day markers
  const orderDates = useMemo(() => {
    const dateMap = new Map<string, number>();
    orders.forEach(o => {
      const d = o.order_date;
      dateMap.set(d, (dateMap.get(d) || 0) + 1);
    });
    return dateMap;
  }, [orders]);

  const selectedDayOrders = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    return orders.filter(o => o.order_date === dateStr);
  }, [orders, selectedDate]);

  const displayOrders = showAllOrders ? orders : selectedDayOrders;

  // Mutations
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
        project_id: data.project_id || null,
        quote_item_summary: data.quote_item_summary || null,
        memo: data.memo || null,
        status: data.status,
        user_id: user!.id,
        user_name: profile?.full_name || user!.email || '',
      });
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
        quote_item_summary: data.quote_item_summary || null,
        memo: data.memo || null,
      }).eq('id', id);
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

  const openEdit = (order: MaterialOrder) => {
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
      project_id: order.project_id || '',
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

  const handleImportItems = (items: typeof projectQuoteItems) => {
    items.forEach(item => {
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
        project_id: selectedProjectForImport,
        quote_item_summary: item.summary,
      });
    });
    setImportDialogOpen(false);
    setSelectedProjectForImport('');
  };

  const canManage = isAdmin || isModerator;

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
              <FolderOpen className="h-3.5 w-3.5" />
              견적서 불러오기
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
              modifiers={{
                hasOrders: (date) => orderDates.has(format(date, 'yyyy-MM-dd')),
              }}
              modifiersClassNames={{
                hasOrders: 'font-bold text-primary',
              }}
              components={{
                DayContent: ({ date }) => {
                  const dateStr = format(date, 'yyyy-MM-dd');
                  const count = orderDates.get(dateStr);
                  return (
                    <div className="relative flex flex-col items-center">
                      <span>{date.getDate()}</span>
                      {count && (
                        <span className="absolute -bottom-1 w-1.5 h-1.5 rounded-full bg-primary" />
                      )}
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
                : `${format(selectedDate, 'M월 d일 (EEE)', { locale: ko })} 발주`
              }
              <span className="ml-2 text-muted-foreground font-normal">{displayOrders.length}건</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1"
              onClick={() => setShowAllOrders(!showAllOrders)}
            >
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
            displayOrders.map(order => {
              const st = STATUS_MAP[order.status] || STATUS_MAP.ordered;
              return (
                <Card key={order.id} className="group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Package className="h-4 w-4 text-primary shrink-0" />
                          <span className="font-medium text-sm">
                            {order.material} {order.quality} {order.thickness}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {order.size_name}
                          </Badge>
                          <Badge className={cn('text-[10px] px-1.5 py-0 text-white', st.color)}>
                            {st.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{order.width}×{order.height}mm</span>
                          <span>수량: {order.quantity}장</span>
                          {showAllOrders && <span>{format(new Date(order.order_date), 'M/d')}</span>}
                        </div>
                        {order.projects && (
                          <button
                            className="flex items-center gap-1 text-xs text-primary hover:underline"
                            onClick={() => navigate(`/project-management?project=${order.projects!.id}`)}
                          >
                            <FolderOpen className="h-3 w-3" />
                            {order.projects.project_name}
                          </button>
                        )}
                        {order.memo && (
                          <p className="text-xs text-muted-foreground truncate">{order.memo}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(canManage || order.user_id === user?.id) && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(order)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(order.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
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
                <Input value={form.material} onChange={e => setForm(f => ({ ...f, material: e.target.value }))} placeholder="예: 알루미늄" />
              </div>
              <div>
                <Label className="text-xs">품질</Label>
                <Input value={form.quality} onChange={e => setForm(f => ({ ...f, quality: e.target.value }))} placeholder="예: 일반" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">두께</Label>
                <Input value={form.thickness} onChange={e => setForm(f => ({ ...f, thickness: e.target.value }))} placeholder="예: 3T" />
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
              <Select value={form.project_id} onValueChange={v => setForm(f => ({ ...f, project_id: v }))}>
                <SelectTrigger><SelectValue placeholder="선택 (선택사항)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">없음</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">메모</Label>
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

      {/* Import from Quote Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>견적서에서 불러오기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">프로젝트 선택</Label>
              <Select value={selectedProjectForImport} onValueChange={setSelectedProjectForImport}>
                <SelectTrigger><SelectValue placeholder="프로젝트를 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {projectQuoteItems.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                <p className="text-xs text-muted-foreground">{projectQuoteItems.length}개 항목이 발견되었습니다.</p>
                {projectQuoteItems.map((item, i) => (
                  <div key={i} className="p-2 rounded-lg border text-xs">
                    <span className="font-medium">{item.material} {item.quality} {item.thickness}</span>
                    <span className="ml-2 text-muted-foreground">{item.size_name} ×{item.quantity}</span>
                  </div>
                ))}
              </div>
            ) : selectedProjectForImport ? (
              <p className="text-xs text-muted-foreground text-center py-4">연결된 견적서가 없거나 원판 항목이 없습니다.</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setImportDialogOpen(false); setSelectedProjectForImport(''); }}>취소</Button>
            <Button
              disabled={projectQuoteItems.length === 0}
              onClick={() => handleImportItems(projectQuoteItems)}
            >
              전체 추가 ({projectQuoteItems.length}건)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MaterialOrdersPage;
