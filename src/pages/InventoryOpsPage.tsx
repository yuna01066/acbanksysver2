import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, isValid, parseISO, subDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  Boxes,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  PackageCheck,
  PackageOpen,
  RefreshCw,
  Search,
  Settings,
  ShoppingCart,
  UserRound,
  Warehouse,
} from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getSupabaseFunctionUrl } from '@/lib/supabaseFunctions';
import { cn } from '@/lib/utils';

const IMWEB_API_URL = getSupabaseFunctionUrl('imweb-api');
const db = supabase as any;

type InventorySourceType = 'imweb_product' | 'sample_chip' | 'material_order' | 'panel_catalog';
type ProductMappingType = Exclude<InventorySourceType, 'imweb_product'> | 'external_only';
type ImwebOrderLinkStatus = 'unlinked' | 'linked_recipient' | 'quote_created' | 'project_created' | 'archived';
type InventoryAlertType = 'low_stock' | 'out_of_stock' | 'inbound_pending' | 'unmapped_product';

type ImwebOrderLink = {
  id?: string;
  imweb_order_no: string;
  recipient_id?: string | null;
  quote_id?: string | null;
  project_id?: string | null;
  assigned_to?: string | null;
  link_status?: ImwebOrderLinkStatus;
  due_date?: string | null;
  memo?: string | null;
};

type ImwebOrder = {
  id?: string;
  imweb_order_no: string;
  order_date?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_phone?: string | null;
  total_price?: number | null;
  order_status?: string | null;
  items?: unknown;
  synced_at?: string | null;
  link?: ImwebOrderLink | null;
};

type ImwebProduct = {
  id?: string;
  imweb_prod_no: string;
  name: string;
  category?: string | null;
  price?: number | null;
  stock_qty?: number | null;
  status?: string | null;
  synced_at?: string | null;
};

type ProductMapping = {
  id?: string;
  imweb_product_id?: string | null;
  imweb_prod_no: string;
  inventory_source_type: ProductMappingType;
  sample_chip_inventory_id?: string | null;
  material_order_id?: string | null;
  panel_size_id?: string | null;
  external_label?: string | null;
  min_stock_qty?: number | null;
  reorder_qty?: number | null;
  auto_stock_sync?: boolean | null;
  memo?: string | null;
};

type SampleChipItem = {
  id: string;
  color_name: string;
  color_code?: string | null;
  stock_ea: number;
  min_stock_ea: number;
  stock_set: number;
  min_stock_set: number;
  panel_masters?: { name?: string; quality?: string; material?: string } | null;
};

type MaterialOrder = {
  id: string;
  material: string;
  quality: string;
  thickness: string;
  size_name: string;
  width: number;
  height: number;
  quantity: number;
  status: string;
  order_date: string;
  user_name?: string | null;
  memo?: string | null;
};

type InventoryOpsData = {
  orders: ImwebOrder[];
  products: ImwebProduct[];
  links: ImwebOrderLink[];
  mappings: ProductMapping[];
  sampleChips: SampleChipItem[];
  sampleTransactions: any[];
  materialOrders: MaterialOrder[];
  syncLogs: any[];
  profiles: any[];
  recipients: any[];
  projects: any[];
  quotes: any[];
  panelSizes: any[];
  actionLogs: any[];
};

type SelectedDetail =
  | { type: 'order'; data: ImwebOrder }
  | { type: 'product'; data: ImwebProduct }
  | { type: 'sample'; data: SampleChipItem }
  | { type: 'material'; data: MaterialOrder }
  | { type: 'mapping'; data: ProductMapping }
  | { type: 'log'; data: any };

const emptyData: InventoryOpsData = {
  orders: [],
  products: [],
  links: [],
  mappings: [],
  sampleChips: [],
  sampleTransactions: [],
  materialOrders: [],
  syncLogs: [],
  profiles: [],
  recipients: [],
  projects: [],
  quotes: [],
  panelSizes: [],
  actionLogs: [],
};

const linkStatusMeta: Record<ImwebOrderLinkStatus, { label: string; className: string }> = {
  unlinked: { label: '미연결', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  linked_recipient: { label: '고객 연결', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  quote_created: { label: '견적 연결', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  project_created: { label: '프로젝트 연결', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  archived: { label: '보관', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

const sourceTypeLabel: Record<ProductMappingType, string> = {
  sample_chip: '샘플칩',
  material_order: '원판 발주',
  panel_catalog: '원판 기준정보',
  external_only: '외부 상품',
};

const alertLabel: Record<InventoryAlertType, string> = {
  low_stock: '재고 부족',
  out_of_stock: '품절',
  inbound_pending: '입고 대기',
  unmapped_product: '미매핑 상품',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const parsed = parseISO(value);
  if (!isValid(parsed)) return '-';
  return format(parsed, 'M월 d일 HH:mm', { locale: ko });
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  const parsed = parseISO(value);
  if (!isValid(parsed)) return value;
  return format(parsed, 'yyyy.MM.dd', { locale: ko });
}

function formatCurrency(value?: number | null) {
  return `${Number(value || 0).toLocaleString('ko-KR')}원`;
}

function normalizeStatus(status?: string | null) {
  return String(status || '').toLowerCase();
}

function statusBadge(status?: string | null) {
  const normalized = normalizeStatus(status);
  if (['delivered', 'complete', 'completed', 'received'].some((token) => normalized.includes(token))) {
    return { label: '완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  }
  if (['cancel', 'refund', 'failed'].some((token) => normalized.includes(token))) {
    return { label: '취소/환불', className: 'border-red-200 bg-red-50 text-red-700' };
  }
  if (['paid', 'ordered', 'shipping', 'ready'].some((token) => normalized.includes(token))) {
    return { label: status || '진행중', className: 'border-blue-200 bg-blue-50 text-blue-700' };
  }
  return { label: status || '미확인', className: 'border-border bg-white text-muted-foreground' };
}

function isPendingOrder(order: ImwebOrder) {
  const normalized = normalizeStatus(order.order_status);
  return !['delivered', 'complete', 'completed', 'cancel', 'refund', 'failed'].some((token) => normalized.includes(token));
}

function isInboundPending(order: MaterialOrder) {
  const normalized = normalizeStatus(order.status);
  return !['received', 'delivered', 'complete', 'completed', 'cancel'].some((token) => normalized.includes(token));
}

function orderItems(items: unknown) {
  return Array.isArray(items) ? items as any[] : [];
}

function itemLabel(item: any) {
  return item?.name || item?.prodName || item?.productName || item?.itemName || '상품명 미확인';
}

function itemQty(item: any) {
  return Number(item?.quantity ?? item?.qty ?? item?.count ?? item?.itemCount ?? 1) || 1;
}

function includesSearch(...values: unknown[]) {
  const text = values.join(' ').toLowerCase();
  return (query: string) => !query || text.includes(query);
}

function profileName(profiles: any[], id?: string | null) {
  if (!id) return '-';
  return profiles.find((profile) => profile.id === id)?.full_name || '담당자 미확인';
}

function linkedLabel(rows: any[], id?: string | null, field = 'name') {
  if (!id) return '-';
  const row = rows.find((item) => item.id === id);
  if (!row) return '연결 항목 미확인';
  return row[field] || row.company_name || row.quote_number || row.color_name || row.name || id;
}

const InventoryOpsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAdmin, isModerator } = useAuth();
  const canManage = isAdmin || isModerator;
  const [activeTab, setActiveTab] = useState('orders');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('30');
  const [selectedDetail, setSelectedDetail] = useState<SelectedDetail | null>(null);
  const [linkOrder, setLinkOrder] = useState<ImwebOrder | null>(null);
  const [mappingProduct, setMappingProduct] = useState<ImwebProduct | null>(null);
  const [stockProduct, setStockProduct] = useState<ImwebProduct | null>(null);
  const [stockQty, setStockQty] = useState('');
  const [linkDraft, setLinkDraft] = useState({
    recipientId: '',
    quoteId: '',
    projectId: '',
    assignedTo: '',
    dueDate: '',
    memo: '',
  });
  const [mappingDraft, setMappingDraft] = useState({
    inventorySourceType: 'external_only' as ProductMappingType,
    sampleChipInventoryId: '',
    materialOrderId: '',
    panelSizeId: '',
    externalLabel: '',
    minStockQty: '0',
    reorderQty: '0',
    autoStockSync: 'false',
    memo: '',
  });

  const callImwebApi = async (action: string, body?: Record<string, unknown>) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('로그인이 필요합니다.');

    const res = await fetch(`${IMWEB_API_URL}?action=${action}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body || {}),
    });
    const result = await res.json();
    if (!res.ok) {
      const err: Error & { notConnected?: boolean } = new Error(result.error || '아임웹 API 호출에 실패했습니다.');
      if (result.notConnected) err.notConnected = true;
      throw err;
    }
    return result;
  };

  const { data: imwebConnection } = useQuery({
    queryKey: ['imweb-connection-status', user?.id],
    enabled: Boolean(user) && canManage,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) return { connected: false };
      const res = await fetch(`${IMWEB_API_URL}?action=check-connection`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json().catch(() => ({ connected: false }));
      return { connected: Boolean(json?.connected) };
    },
  });
  const isImwebConnected = imwebConnection?.connected === true;

  const { data = emptyData, isLoading } = useQuery({
    queryKey: ['inventory-ops', canManage, user?.id, dateRange],
    enabled: Boolean(user),
    queryFn: async (): Promise<InventoryOpsData> => {
      if (!canManage) {
        const assigned = await callImwebApi('assigned-orders');
        return {
          ...emptyData,
          orders: assigned.orders || [],
        };
      }

      const since = subDays(new Date(), Number(dateRange || 30)).toISOString();

      const [
        ordersRes,
        productsRes,
        mappingsRes,
        sampleChipsRes,
        sampleTransactionsRes,
        materialOrdersRes,
        syncLogsRes,
        profilesRes,
        recipientsRes,
        projectsRes,
        quotesRes,
        panelSizesRes,
        actionLogsRes,
      ] = await Promise.all([
        db.from('imweb_orders').select('*').gte('order_date', since).order('order_date', { ascending: false }).limit(500),
        db.from('imweb_products').select('*').order('name', { ascending: true }).limit(500),
        db.from('imweb_product_mappings').select('*').order('updated_at', { ascending: false }).limit(500),
        db.from('sample_chip_inventory').select('*, panel_masters(name, quality, material)').order('color_name', { ascending: true }).limit(500),
        db.from('sample_chip_transactions').select('*, sample_chip_inventory(color_name)').order('created_at', { ascending: false }).limit(80),
        db.from('material_orders').select('*').order('order_date', { ascending: false }).limit(200),
        db.from('imweb_sync_logs').select('*').order('started_at', { ascending: false }).limit(80),
        db.from('profiles').select('id, full_name, department, position').order('full_name', { ascending: true }).limit(200),
        db.from('recipients').select('id, company_name, contact_person, phone, email').order('company_name', { ascending: true }).limit(200),
        db.from('projects').select('id, name, status, recipient_id').order('updated_at', { ascending: false }).limit(200),
        db.from('saved_quotes').select('id, quote_number, recipient_company, recipient_name, total, quote_date').order('quote_date', { ascending: false }).limit(200),
        db.from('panel_sizes').select('id, width, height, thickness, panel_masters(name, material, quality)').limit(500),
        db.from('inventory_action_logs').select('*').order('created_at', { ascending: false }).limit(80),
      ]);

      const results = [
        ordersRes,
        productsRes,
        mappingsRes,
        sampleChipsRes,
        sampleTransactionsRes,
        materialOrdersRes,
        syncLogsRes,
        profilesRes,
        recipientsRes,
        projectsRes,
        quotesRes,
        panelSizesRes,
        actionLogsRes,
      ];
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      const linksRes = ordersRes.data?.length
        ? await db.from('imweb_order_links').select('*').in('imweb_order_no', ordersRes.data.map((order: ImwebOrder) => order.imweb_order_no))
        : { data: [], error: null };
      if (linksRes.error) throw linksRes.error;

      const linkMap = new Map((linksRes.data || []).map((link: ImwebOrderLink) => [link.imweb_order_no, link]));
      const orders = (ordersRes.data || []).map((order: ImwebOrder) => ({
        ...order,
        link: linkMap.get(order.imweb_order_no) || null,
      }));

      return {
        orders,
        products: productsRes.data || [],
        links: linksRes.data || [],
        mappings: mappingsRes.data || [],
        sampleChips: sampleChipsRes.data || [],
        sampleTransactions: sampleTransactionsRes.data || [],
        materialOrders: materialOrdersRes.data || [],
        syncLogs: syncLogsRes.data || [],
        profiles: profilesRes.data || [],
        recipients: recipientsRes.data || [],
        projects: projectsRes.data || [],
        quotes: quotesRes.data || [],
        panelSizes: panelSizesRes.data || [],
        actionLogs: actionLogsRes.data || [],
      };
    },
  });

  const syncOrdersMutation = useMutation({
    mutationFn: async () => callImwebApi('sync-orders-incremental', { days: Number(dateRange || 30) }),
    onSuccess: (result) => {
      toast.success(`주문 동기화 완료: ${result.syncedCount || 0}건`);
      queryClient.invalidateQueries({ queryKey: ['inventory-ops'] });
    },
    onError: (error: Error & { notConnected?: boolean }) => {
      if (error.notConnected) {
        toast.error('아임웹 연결이 필요합니다. 연동 설정 페이지로 이동합니다.');
        navigate('/imweb-management');
        return;
      }
      toast.error(error.message);
    },
  });

  const linkMutation = useMutation({
    mutationFn: async () => {
      if (!linkOrder) throw new Error('주문을 선택해주세요.');
      return callImwebApi('link-order', {
        orderNo: linkOrder.imweb_order_no,
        recipientId: linkDraft.recipientId || null,
        quoteId: linkDraft.quoteId || null,
        projectId: linkDraft.projectId || null,
        assignedTo: linkDraft.assignedTo || null,
        dueDate: linkDraft.dueDate || null,
        memo: linkDraft.memo || null,
      });
    },
    onSuccess: () => {
      toast.success('주문 연결 정보가 저장되었습니다.');
      setLinkOrder(null);
      queryClient.invalidateQueries({ queryKey: ['inventory-ops'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mappingMutation = useMutation({
    mutationFn: async () => {
      if (!mappingProduct) throw new Error('상품을 선택해주세요.');
      const sourceType = mappingDraft.inventorySourceType;
      if (sourceType === 'sample_chip' && !mappingDraft.sampleChipInventoryId) throw new Error('샘플칩을 선택해주세요.');
      if (sourceType === 'material_order' && !mappingDraft.materialOrderId) throw new Error('원판 발주를 선택해주세요.');
      if (sourceType === 'panel_catalog' && !mappingDraft.panelSizeId) throw new Error('원판 기준정보를 선택해주세요.');
      const payload = {
        imweb_product_id: mappingProduct.id || null,
        imweb_prod_no: mappingProduct.imweb_prod_no,
        inventory_source_type: sourceType,
        sample_chip_inventory_id: sourceType === 'sample_chip' ? mappingDraft.sampleChipInventoryId || null : null,
        material_order_id: sourceType === 'material_order' ? mappingDraft.materialOrderId || null : null,
        panel_size_id: sourceType === 'panel_catalog' ? mappingDraft.panelSizeId || null : null,
        external_label: sourceType === 'external_only' ? mappingDraft.externalLabel || mappingProduct.name : null,
        min_stock_qty: Number(mappingDraft.minStockQty || 0),
        reorder_qty: Number(mappingDraft.reorderQty || 0),
        auto_stock_sync: mappingDraft.autoStockSync === 'true',
        memo: mappingDraft.memo || null,
        created_by: user?.id,
      };
      const { error } = await db.from('imweb_product_mappings').upsert(payload, { onConflict: 'imweb_prod_no' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('상품 매핑이 저장되었습니다.');
      setMappingProduct(null);
      queryClient.invalidateQueries({ queryKey: ['inventory-ops'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stockMutation = useMutation({
    mutationFn: async () => {
      if (!stockProduct) throw new Error('상품을 선택해주세요.');
      return callImwebApi('update-product-stock', {
        prodNo: stockProduct.imweb_prod_no,
        stockQty: Number(stockQty || 0),
      });
    },
    onSuccess: () => {
      toast.success('아임웹 상품 재고를 수정했습니다.');
      setStockProduct(null);
      queryClient.invalidateQueries({ queryKey: ['inventory-ops'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const mappingMap = useMemo(
    () => new Map(data.mappings.map((mapping) => [mapping.imweb_prod_no, mapping])),
    [data.mappings],
  );

  const searchQuery = searchTerm.trim().toLowerCase();

  const filteredOrders = useMemo(() => {
    return data.orders.filter((order) => {
      const statusMatch = statusFilter === 'all' || normalizeStatus(order.order_status).includes(statusFilter);
      const queryMatch = includesSearch(
        order.imweb_order_no,
        order.buyer_name,
        order.buyer_email,
        order.buyer_phone,
        order.link?.memo,
      )(searchQuery);
      return statusMatch && queryMatch;
    });
  }, [data.orders, searchQuery, statusFilter]);

  const filteredProducts = useMemo(() => {
    return data.products.filter((product) => includesSearch(product.name, product.category, product.imweb_prod_no)(searchQuery));
  }, [data.products, searchQuery]);

  const lowStockAlerts = useMemo(() => {
    const imwebLow = data.products.filter((product) => {
      const mapping = mappingMap.get(product.imweb_prod_no);
      const stock = Number(product.stock_qty ?? -1);
      return stock >= 0 && stock <= Number(mapping?.min_stock_qty ?? 0);
    });
    const sampleLow = data.sampleChips.filter((item) => item.stock_ea <= item.min_stock_ea || item.stock_set <= item.min_stock_set);
    return { imwebLow, sampleLow, total: imwebLow.length + sampleLow.length };
  }, [data.products, data.sampleChips, mappingMap]);

  const unmappedCount = useMemo(
    () => data.products.filter((product) => !mappingMap.has(product.imweb_prod_no)).length,
    [data.products, mappingMap],
  );

  const pendingInbound = useMemo(
    () => data.materialOrders.filter(isInboundPending),
    [data.materialOrders],
  );

  const summaries = useMemo(() => {
    const newOrders = data.orders.filter((order) => !order.link || order.link.link_status === 'unlinked').length;
    const pendingOrders = data.orders.filter(isPendingOrder).length;
    const latestLog = data.syncLogs[0];
    return [
      { label: '신규 주문', value: newOrders, hint: '내부 연결 전 주문', icon: ShoppingCart },
      { label: '배송/제작 대기', value: pendingOrders, hint: '완료 전 주문', icon: Clock3 },
      { label: '재고 부족', value: lowStockAlerts.total + unmappedCount, hint: `미매핑 ${unmappedCount}건 포함`, icon: AlertTriangle },
      { label: '입고 대기', value: pendingInbound.length, hint: '원판 발주 미완료', icon: Warehouse },
      { label: '동기화 상태', value: latestLog?.status === 'success' ? '정상' : latestLog?.status || '없음', hint: latestLog ? formatDateTime(latestLog.completed_at || latestLog.started_at) : '로그 없음', icon: RefreshCw },
    ];
  }, [data.orders, data.syncLogs, lowStockAlerts.total, pendingInbound.length, unmappedCount]);

  const openLinkDialog = (order: ImwebOrder) => {
    setLinkOrder(order);
    setLinkDraft({
      recipientId: order.link?.recipient_id || '',
      quoteId: order.link?.quote_id || '',
      projectId: order.link?.project_id || '',
      assignedTo: order.link?.assigned_to || '',
      dueDate: order.link?.due_date || '',
      memo: order.link?.memo || '',
    });
  };

  const openMappingDialog = (product: ImwebProduct) => {
    const mapping = mappingMap.get(product.imweb_prod_no);
    setMappingProduct(product);
    setMappingDraft({
      inventorySourceType: mapping?.inventory_source_type || 'external_only',
      sampleChipInventoryId: mapping?.sample_chip_inventory_id || '',
      materialOrderId: mapping?.material_order_id || '',
      panelSizeId: mapping?.panel_size_id || '',
      externalLabel: mapping?.external_label || product.name,
      minStockQty: String(mapping?.min_stock_qty ?? 0),
      reorderQty: String(mapping?.reorder_qty ?? 0),
      autoStockSync: mapping?.auto_stock_sync ? 'true' : 'false',
      memo: mapping?.memo || '',
    });
  };

  const renderStatus = (status?: string | null) => {
    const meta = statusBadge(status);
    return <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[11px]', meta.className)}>{meta.label}</Badge>;
  };

  const renderLinkStatus = (link?: ImwebOrderLink | null) => {
    const meta = linkStatusMeta[link?.link_status || 'unlinked'];
    return <Badge variant="outline" className={cn('rounded-full px-2 py-0.5 text-[11px]', meta.className)}>{meta.label}</Badge>;
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md border-border bg-white shadow-none">
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">로그인이 필요합니다.</p>
            <Button onClick={() => navigate('/auth')} className="rounded-full">로그인</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white p-4 sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="h-8 rounded-full px-2 text-xs">
              <ArrowLeft className="mr-1 h-4 w-4" />
              홈
            </Button>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/30 text-foreground">
                <PackageCheck className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">재고·주문 센터</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  아임웹 주문, 상품 재고, 샘플칩 재고, 원판 입고 흐름을 한 화면에서 확인합니다.
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => navigate('/imweb-management')}
            >
              <Settings className="mr-2 h-4 w-4" />
              아임웹 연동 설정
            </Button>
            {canManage && (
              <Button
                className="rounded-full bg-foreground text-background hover:bg-foreground/90"
                onClick={() => syncOrdersMutation.mutate()}
                disabled={syncOrdersMutation.isPending}
              >
                {syncOrdersMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                주문 증분 동기화
              </Button>
            )}
          </div>
        </header>

        {!canManage && (
          <Card className="border-border bg-muted/20 shadow-none">
            <CardContent className="flex items-start gap-3 p-4">
              <UserRound className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="text-sm text-muted-foreground">
                담당자로 지정된 아임웹 주문만 표시합니다. 고객 전화번호와 이메일은 마스킹됩니다.
              </div>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {summaries.map((summary) => {
            const Icon = summary.icon;
            return (
              <Card key={summary.label} className="border-border bg-white shadow-none">
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/25">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">{summary.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{summary.value}</p>
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">{summary.hint}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="border-border bg-white shadow-none">
            <CardHeader className="border-b border-border p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="h-auto flex-wrap justify-start rounded-full border border-border bg-white p-1">
                    <TabsTrigger value="orders" className="rounded-full px-3 py-1.5 text-xs">주문 유입</TabsTrigger>
                    <TabsTrigger value="stock" className="rounded-full px-3 py-1.5 text-xs">재고 현황</TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-full px-3 py-1.5 text-xs">입출고</TabsTrigger>
                    <TabsTrigger value="inbound" className="rounded-full px-3 py-1.5 text-xs">입고 예정</TabsTrigger>
                    <TabsTrigger value="mappings" className="rounded-full px-3 py-1.5 text-xs" disabled={!canManage}>상품 매핑</TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-full px-3 py-1.5 text-xs">동기화 로그</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_160px_140px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="주문번호, 고객, 상품, 색상 검색"
                    className="h-10 rounded-full border-border bg-white pl-9"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 rounded-full border-border bg-white">
                    <SelectValue placeholder="상태" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 상태</SelectItem>
                    <SelectItem value="ordered">주문/결제</SelectItem>
                    <SelectItem value="shipping">배송/제작</SelectItem>
                    <SelectItem value="delivered">완료</SelectItem>
                    <SelectItem value="cancel">취소/환불</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={dateRange} onValueChange={setDateRange} disabled={!canManage}>
                  <SelectTrigger className="h-10 rounded-full border-border bg-white">
                    <SelectValue placeholder="기간" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">최근 7일</SelectItem>
                    <SelectItem value="30">최근 30일</SelectItem>
                    <SelectItem value="90">최근 90일</SelectItem>
                    <SelectItem value="365">최근 1년</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  재고·주문 데이터를 불러오는 중입니다.
                </div>
              ) : (
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsContent value="orders" className="m-0">
                    <OrdersTable
                      orders={filteredOrders}
                      profiles={data.profiles}
                      canManage={canManage}
                      onSelect={(order) => setSelectedDetail({ type: 'order', data: order })}
                      onLink={openLinkDialog}
                      renderStatus={renderStatus}
                      renderLinkStatus={renderLinkStatus}
                    />
                  </TabsContent>

                  <TabsContent value="stock" className="m-0">
                    <StockTable
                      products={filteredProducts}
                      mappings={mappingMap}
                      sampleChips={data.sampleChips}
                      onSelect={setSelectedDetail}
                      onMap={canManage ? openMappingDialog : undefined}
                      onStockEdit={canManage ? (product) => {
                        setStockProduct(product);
                        setStockQty(String(product.stock_qty ?? 0));
                      } : undefined}
                    />
                  </TabsContent>

                  <TabsContent value="transactions" className="m-0">
                    <TransactionsTable transactions={data.sampleTransactions} logs={data.actionLogs} onSelect={(row) => setSelectedDetail({ type: 'log', data: row })} />
                  </TabsContent>

                  <TabsContent value="inbound" className="m-0">
                    <InboundTable materialOrders={data.materialOrders} onSelect={(row) => setSelectedDetail({ type: 'material', data: row })} renderStatus={renderStatus} />
                  </TabsContent>

                  <TabsContent value="mappings" className="m-0">
                    <MappingTable
                      products={filteredProducts}
                      mappings={mappingMap}
                      sampleChips={data.sampleChips}
                      materialOrders={data.materialOrders}
                      panelSizes={data.panelSizes}
                      onSelect={(mapping) => setSelectedDetail({ type: 'mapping', data: mapping })}
                      onMap={openMappingDialog}
                    />
                  </TabsContent>

                  <TabsContent value="logs" className="m-0">
                    <SyncLogsTable logs={data.syncLogs} actionLogs={data.actionLogs} onSelect={(row) => setSelectedDetail({ type: 'log', data: row })} />
                  </TabsContent>
                </Tabs>
              )}
            </CardContent>
          </Card>

          <DetailPanel
            selected={selectedDetail}
            data={data}
            canManage={canManage}
            onClose={() => setSelectedDetail(null)}
            onLink={(order) => openLinkDialog(order)}
          />
        </section>
      </div>

      <Dialog open={Boolean(linkOrder)} onOpenChange={(open) => !open && setLinkOrder(null)}>
        <DialogContent className="max-w-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>아임웹 주문 연결</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="font-semibold text-foreground">{linkOrder?.imweb_order_no}</div>
              <div className="mt-1 text-muted-foreground">{linkOrder?.buyer_name || '고객명 미확인'} · {formatCurrency(linkOrder?.total_price)}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldSelect label="고객사" value={linkDraft.recipientId} onChange={(value) => setLinkDraft((prev) => ({ ...prev, recipientId: value }))} placeholder="고객사 선택">
                <SelectItem value="__none">선택 안 함</SelectItem>
                {data.recipients.map((recipient) => (
                  <SelectItem key={recipient.id} value={recipient.id}>{recipient.company_name}</SelectItem>
                ))}
              </FieldSelect>
              <FieldSelect label="담당자" value={linkDraft.assignedTo} onChange={(value) => setLinkDraft((prev) => ({ ...prev, assignedTo: value }))} placeholder="담당자 선택">
                <SelectItem value="__none">선택 안 함</SelectItem>
                {data.profiles.map((profile) => (
                  <SelectItem key={profile.id} value={profile.id}>{profile.full_name}</SelectItem>
                ))}
              </FieldSelect>
              <FieldSelect label="견적서" value={linkDraft.quoteId} onChange={(value) => setLinkDraft((prev) => ({ ...prev, quoteId: value }))} placeholder="견적서 선택">
                <SelectItem value="__none">선택 안 함</SelectItem>
                {data.quotes.map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>{quote.quote_number} · {quote.recipient_company || quote.recipient_name || '수신처 미확인'}</SelectItem>
                ))}
              </FieldSelect>
              <FieldSelect label="프로젝트" value={linkDraft.projectId} onChange={(value) => setLinkDraft((prev) => ({ ...prev, projectId: value }))} placeholder="프로젝트 선택">
                <SelectItem value="__none">선택 안 함</SelectItem>
                {data.projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                ))}
              </FieldSelect>
              <div className="space-y-2">
                <Label>납기 예정일</Label>
                <Input
                  type="date"
                  value={linkDraft.dueDate}
                  onChange={(event) => setLinkDraft((prev) => ({ ...prev, dueDate: event.target.value }))}
                  className="rounded-lg border-border bg-white"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>운영 메모</Label>
                <Textarea
                  value={linkDraft.memo}
                  onChange={(event) => setLinkDraft((prev) => ({ ...prev, memo: event.target.value }))}
                  className="min-h-20 rounded-lg border-border bg-white"
                  placeholder="제작 요청, 고객 특이사항, 재고 확인 메모"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setLinkOrder(null)}>취소</Button>
            <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={() => linkMutation.mutate()} disabled={linkMutation.isPending}>
              {linkMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              연결 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(mappingProduct)} onOpenChange={(open) => !open && setMappingProduct(null)}>
        <DialogContent className="max-w-2xl border-border bg-white">
          <DialogHeader>
            <DialogTitle>상품 재고 매핑</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
              <div className="font-semibold text-foreground">{mappingProduct?.name}</div>
              <div className="mt-1 text-muted-foreground">상품번호 {mappingProduct?.imweb_prod_no} · 현재 재고 {mappingProduct?.stock_qty ?? '미확인'}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <FieldSelect
                label="매핑 유형"
                value={mappingDraft.inventorySourceType}
                onChange={(value) => setMappingDraft((prev) => ({ ...prev, inventorySourceType: value as ProductMappingType }))}
                placeholder="유형 선택"
              >
                <SelectItem value="sample_chip">샘플칩</SelectItem>
                <SelectItem value="material_order">원판 발주</SelectItem>
                <SelectItem value="panel_catalog">원판 기준정보</SelectItem>
                <SelectItem value="external_only">외부 상품</SelectItem>
              </FieldSelect>
              {mappingDraft.inventorySourceType === 'sample_chip' && (
                <FieldSelect label="샘플칩" value={mappingDraft.sampleChipInventoryId} onChange={(value) => setMappingDraft((prev) => ({ ...prev, sampleChipInventoryId: value }))} placeholder="샘플칩 선택">
                  {data.sampleChips.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.color_name}</SelectItem>
                  ))}
                </FieldSelect>
              )}
              {mappingDraft.inventorySourceType === 'material_order' && (
                <FieldSelect label="원판 발주" value={mappingDraft.materialOrderId} onChange={(value) => setMappingDraft((prev) => ({ ...prev, materialOrderId: value }))} placeholder="발주 선택">
                  {data.materialOrders.map((order) => (
                    <SelectItem key={order.id} value={order.id}>{order.material} {order.thickness} · {order.quantity}장</SelectItem>
                  ))}
                </FieldSelect>
              )}
              {mappingDraft.inventorySourceType === 'panel_catalog' && (
                <FieldSelect label="원판 기준정보" value={mappingDraft.panelSizeId} onChange={(value) => setMappingDraft((prev) => ({ ...prev, panelSizeId: value }))} placeholder="기준정보 선택">
                  {data.panelSizes.map((size) => (
                    <SelectItem key={size.id} value={size.id}>{size.panel_masters?.name || '원판'} · {size.width}x{size.height} · {size.thickness}</SelectItem>
                  ))}
                </FieldSelect>
              )}
              {mappingDraft.inventorySourceType === 'external_only' && (
                <div className="space-y-2">
                  <Label>외부 상품 라벨</Label>
                  <Input value={mappingDraft.externalLabel} onChange={(event) => setMappingDraft((prev) => ({ ...prev, externalLabel: event.target.value }))} className="rounded-lg border-border bg-white" />
                </div>
              )}
              <div className="space-y-2">
                <Label>재고 부족 기준</Label>
                <Input type="number" min="0" value={mappingDraft.minStockQty} onChange={(event) => setMappingDraft((prev) => ({ ...prev, minStockQty: event.target.value }))} className="rounded-lg border-border bg-white" />
              </div>
              <div className="space-y-2">
                <Label>권장 입고 수량</Label>
                <Input type="number" min="0" value={mappingDraft.reorderQty} onChange={(event) => setMappingDraft((prev) => ({ ...prev, reorderQty: event.target.value }))} className="rounded-lg border-border bg-white" />
              </div>
              <FieldSelect label="자동 재고 동기화" value={mappingDraft.autoStockSync} onChange={(value) => setMappingDraft((prev) => ({ ...prev, autoStockSync: value }))} placeholder="선택">
                <SelectItem value="false">수동 확인</SelectItem>
                <SelectItem value="true">동기화 후보</SelectItem>
              </FieldSelect>
              <div className="space-y-2 md:col-span-2">
                <Label>메모</Label>
                <Textarea value={mappingDraft.memo} onChange={(event) => setMappingDraft((prev) => ({ ...prev, memo: event.target.value }))} className="min-h-20 rounded-lg border-border bg-white" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setMappingProduct(null)}>취소</Button>
            <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={() => mappingMutation.mutate()} disabled={mappingMutation.isPending}>
              {mappingMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              매핑 저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(stockProduct)} onOpenChange={(open) => !open && setStockProduct(null)}>
        <DialogContent className="max-w-sm border-border bg-white">
          <DialogHeader>
            <DialogTitle>아임웹 재고 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium text-foreground">{stockProduct?.name}</p>
            <div className="space-y-2">
              <Label>재고 수량</Label>
              <Input type="number" value={stockQty} onChange={(event) => setStockQty(event.target.value)} className="rounded-lg border-border bg-white" />
            </div>
            <p className="text-xs text-muted-foreground">아임웹 상품 재고가 실제로 수정됩니다. 배송/환불 처리는 아임웹 관리자에서 진행하세요.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setStockProduct(null)}>취소</Button>
            <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={() => stockMutation.mutate()} disabled={stockMutation.isPending}>
              {stockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

function FieldSelect({
  label,
  value,
  onChange,
  placeholder,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value || '__none'} onValueChange={(nextValue) => onChange(nextValue === '__none' ? '' : nextValue)}>
        <SelectTrigger className="rounded-lg border-border bg-white">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </div>
  );
}

function OrdersTable({
  orders,
  profiles,
  canManage,
  onSelect,
  onLink,
  renderStatus,
  renderLinkStatus,
}: {
  orders: ImwebOrder[];
  profiles: any[];
  canManage: boolean;
  onSelect: (order: ImwebOrder) => void;
  onLink: (order: ImwebOrder) => void;
  renderStatus: (status?: string | null) => React.ReactNode;
  renderLinkStatus: (link?: ImwebOrderLink | null) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead className="min-w-[150px]">주문</TableHead>
            <TableHead className="min-w-[180px]">고객</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>연결</TableHead>
            <TableHead className="min-w-[130px]">담당/납기</TableHead>
            <TableHead className="text-right">금액</TableHead>
            <TableHead className="w-[120px] text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="h-40 text-center text-sm text-muted-foreground">표시할 주문이 없습니다.</TableCell>
            </TableRow>
          ) : orders.map((order) => (
            <TableRow key={order.imweb_order_no} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect(order)}>
              <TableCell>
                <div className="font-mono text-xs font-semibold text-foreground">{order.imweb_order_no}</div>
                <div className="mt-1 text-xs text-muted-foreground">{formatDateTime(order.order_date)}</div>
              </TableCell>
              <TableCell>
                <div className="truncate text-sm font-medium text-foreground">{order.buyer_name || '고객명 미확인'}</div>
                <div className="truncate text-xs text-muted-foreground">{order.buyer_phone || order.buyer_email || '-'}</div>
              </TableCell>
              <TableCell>{renderStatus(order.order_status)}</TableCell>
              <TableCell>{renderLinkStatus(order.link)}</TableCell>
              <TableCell>
                <div className="text-xs text-foreground">{profileName(profiles, order.link?.assigned_to)}</div>
                <div className="text-xs text-muted-foreground">납기 {formatDate(order.link?.due_date)}</div>
              </TableCell>
              <TableCell className="text-right text-sm font-semibold">{formatCurrency(order.total_price)}</TableCell>
              <TableCell className="text-right">
                {canManage ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 rounded-full"
                    onClick={(event) => {
                      event.stopPropagation();
                      onLink(order);
                    }}
                  >
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    연결
                  </Button>
                ) : (
                  <Badge variant="outline" className="rounded-full">담당</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StockTable({
  products,
  mappings,
  sampleChips,
  onSelect,
  onMap,
  onStockEdit,
}: {
  products: ImwebProduct[];
  mappings: Map<string, ProductMapping>;
  sampleChips: SampleChipItem[];
  onSelect: (selected: SelectedDetail) => void;
  onMap?: (product: ImwebProduct) => void;
  onStockEdit?: (product: ImwebProduct) => void;
}) {
  return (
    <div className="grid gap-4 p-4 xl:grid-cols-2">
      <Card className="border-border bg-white shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">아임웹 상품 재고</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[560px] overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead>상품</TableHead>
                <TableHead>재고</TableHead>
                <TableHead>매핑</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const mapping = mappings.get(product.imweb_prod_no);
                const stock = Number(product.stock_qty ?? -1);
                const isLow = stock >= 0 && stock <= Number(mapping?.min_stock_qty ?? 0);
                return (
                  <TableRow key={product.imweb_prod_no} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect({ type: 'product', data: product })}>
                    <TableCell>
                      <div className="max-w-[280px] truncate text-sm font-medium">{product.name}</div>
                      <div className="text-xs text-muted-foreground">{product.category || product.imweb_prod_no}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('rounded-full', isLow ? 'border-red-200 bg-red-50 text-red-700' : 'border-border bg-white')}>
                        {stock < 0 ? '미확인' : `${stock}개`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {mapping ? (
                        <Badge variant="outline" className="rounded-full">{sourceTypeLabel[mapping.inventory_source_type]}</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">{alertLabel.unmapped_product}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {onMap && (
                          <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={(event) => { event.stopPropagation(); onMap(product); }}>매핑</Button>
                        )}
                        {onStockEdit && (
                          <Button variant="ghost" size="sm" className="h-8 rounded-full" onClick={(event) => { event.stopPropagation(); onStockEdit(product); }}>재고</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-none">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm">샘플칩 재고</CardTitle>
        </CardHeader>
        <CardContent className="max-h-[560px] overflow-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20">
                <TableHead>색상</TableHead>
                <TableHead>EA</TableHead>
                <TableHead>SET</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleChips.map((item) => {
                const low = item.stock_ea <= item.min_stock_ea || item.stock_set <= item.min_stock_set;
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect({ type: 'sample', data: item })}>
                    <TableCell>
                      <div className="text-sm font-medium">{item.color_name}</div>
                      <div className="text-xs text-muted-foreground">{item.panel_masters?.name || '-'}</div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{item.stock_ea}</TableCell>
                    <TableCell className="font-mono text-sm">{item.stock_set}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('rounded-full', low ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                        {low ? alertLabel.low_stock : '정상'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function TransactionsTable({ transactions, logs, onSelect }: { transactions: any[]; logs: any[]; onSelect: (row: any) => void }) {
  const rows = [
    ...transactions.map((row) => ({ ...row, kind: 'sample' })),
    ...logs.map((row) => ({ ...row, kind: 'action' })),
  ].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead>일시</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>내용</TableHead>
            <TableHead>수량/대상</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={4} className="h-40 text-center text-sm text-muted-foreground">입출고 기록이 없습니다.</TableCell></TableRow>
          ) : rows.map((row, index) => (
            <TableRow key={`${row.kind}-${row.id || index}`} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect(row)}>
              <TableCell className="text-xs">{formatDateTime(row.created_at)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="rounded-full">{row.kind === 'sample' ? '샘플칩' : '운영 로그'}</Badge>
              </TableCell>
              <TableCell className="text-sm">{row.memo || row.action_type || row.transaction_type || '-'}</TableCell>
              <TableCell className="text-sm">{row.quantity_ea ? `${row.quantity_ea} EA` : row.target_type || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function InboundTable({
  materialOrders,
  onSelect,
  renderStatus,
}: {
  materialOrders: MaterialOrder[];
  onSelect: (row: MaterialOrder) => void;
  renderStatus: (status?: string | null) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead>발주일</TableHead>
            <TableHead>자재</TableHead>
            <TableHead>사이즈</TableHead>
            <TableHead>수량</TableHead>
            <TableHead>상태</TableHead>
            <TableHead>담당</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materialOrders.map((order) => (
            <TableRow key={order.id} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect(order)}>
              <TableCell className="text-xs">{formatDate(order.order_date)}</TableCell>
              <TableCell>
                <div className="text-sm font-medium">{order.material}</div>
                <div className="text-xs text-muted-foreground">{order.quality} · {order.thickness}</div>
              </TableCell>
              <TableCell className="text-sm">{order.size_name || `${order.width}x${order.height}`}</TableCell>
              <TableCell className="font-mono text-sm">{order.quantity}</TableCell>
              <TableCell>{renderStatus(order.status)}</TableCell>
              <TableCell className="text-sm">{order.user_name || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function MappingTable({
  products,
  mappings,
  sampleChips,
  materialOrders,
  panelSizes,
  onSelect,
  onMap,
}: {
  products: ImwebProduct[];
  mappings: Map<string, ProductMapping>;
  sampleChips: SampleChipItem[];
  materialOrders: MaterialOrder[];
  panelSizes: any[];
  onSelect: (mapping: ProductMapping) => void;
  onMap: (product: ImwebProduct) => void;
}) {
  const sourceName = (mapping?: ProductMapping) => {
    if (!mapping) return '-';
    if (mapping.inventory_source_type === 'sample_chip') return linkedLabel(sampleChips, mapping.sample_chip_inventory_id, 'color_name');
    if (mapping.inventory_source_type === 'material_order') return linkedLabel(materialOrders, mapping.material_order_id, 'material');
    if (mapping.inventory_source_type === 'panel_catalog') {
      const panel = panelSizes.find((item) => item.id === mapping.panel_size_id);
      return panel ? `${panel.panel_masters?.name || '원판'} ${panel.width}x${panel.height}` : '원판 기준정보';
    }
    return mapping.external_label || '외부 상품';
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead>아임웹 상품</TableHead>
            <TableHead>매핑 유형</TableHead>
            <TableHead>내부 연결</TableHead>
            <TableHead>기준</TableHead>
            <TableHead className="text-right">액션</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const mapping = mappings.get(product.imweb_prod_no);
            return (
              <TableRow key={product.imweb_prod_no} className="cursor-pointer hover:bg-muted/25" onClick={() => mapping && onSelect(mapping)}>
                <TableCell>
                  <div className="max-w-[320px] truncate text-sm font-medium">{product.name}</div>
                  <div className="text-xs text-muted-foreground">{product.imweb_prod_no}</div>
                </TableCell>
                <TableCell>
                  {mapping ? <Badge variant="outline" className="rounded-full">{sourceTypeLabel[mapping.inventory_source_type]}</Badge> : <Badge variant="outline" className="rounded-full border-amber-200 bg-amber-50 text-amber-700">미매핑</Badge>}
                </TableCell>
                <TableCell className="text-sm">{sourceName(mapping)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">부족 {mapping?.min_stock_qty ?? 0} · 입고 {mapping?.reorder_qty ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={(event) => { event.stopPropagation(); onMap(product); }}>설정</Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function SyncLogsTable({ logs, actionLogs, onSelect }: { logs: any[]; actionLogs: any[]; onSelect: (row: any) => void }) {
  const rows = [
    ...logs.map((row) => ({ ...row, log_type: 'sync' })),
    ...actionLogs.map((row) => ({ ...row, log_type: 'action', started_at: row.created_at })),
  ].sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead>일시</TableHead>
            <TableHead>유형</TableHead>
            <TableHead>상태/액션</TableHead>
            <TableHead>처리</TableHead>
            <TableHead>담당</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.log_type}-${row.id || index}`} className="cursor-pointer hover:bg-muted/25" onClick={() => onSelect(row)}>
              <TableCell className="text-xs">{formatDateTime(row.started_at || row.created_at)}</TableCell>
              <TableCell><Badge variant="outline" className="rounded-full">{row.log_type === 'sync' ? '동기화' : '운영'}</Badge></TableCell>
              <TableCell className="text-sm">{row.status || row.action_type}</TableCell>
              <TableCell className="text-sm">{row.synced_count ?? row.target_type ?? '-'}</TableCell>
              <TableCell className="text-sm">{row.user_name || row.actor_name || '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DetailPanel({
  selected,
  data,
  canManage,
  onClose,
  onLink,
}: {
  selected: SelectedDetail | null;
  data: InventoryOpsData;
  canManage: boolean;
  onClose: () => void;
  onLink: (order: ImwebOrder) => void;
}) {
  if (!selected) {
    return (
      <Card className="min-h-[420px] border-border bg-white shadow-none">
        <CardContent className="flex h-full min-h-[420px] flex-col items-center justify-center p-6 text-center">
          <Boxes className="mb-3 h-9 w-9 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">상세 항목을 선택하세요.</p>
          <p className="mt-1 text-xs text-muted-foreground">주문, 상품, 발주, 로그를 선택하면 원본 정보와 연결 상태가 표시됩니다.</p>
        </CardContent>
      </Card>
    );
  }

  const rows: Array<[string, React.ReactNode]> = [];
  let title = '';
  let icon: React.ReactNode = <FileText className="h-4 w-4" />;
  let actions: React.ReactNode = null;

  if (selected.type === 'order') {
    const order = selected.data;
    const items = orderItems(order.items);
    title = `주문 ${order.imweb_order_no}`;
    icon = <ShoppingCart className="h-4 w-4" />;
    rows.push(['고객', order.buyer_name || '-']);
    rows.push(['연락처', order.buyer_phone || order.buyer_email || '-']);
    rows.push(['금액', formatCurrency(order.total_price)]);
    rows.push(['주문일', formatDateTime(order.order_date)]);
    rows.push(['담당자', profileName(data.profiles, order.link?.assigned_to)]);
    rows.push(['고객사', linkedLabel(data.recipients, order.link?.recipient_id, 'company_name')]);
    rows.push(['견적서', linkedLabel(data.quotes, order.link?.quote_id, 'quote_number')]);
    rows.push(['프로젝트', linkedLabel(data.projects, order.link?.project_id, 'name')]);
    rows.push(['납기 예정', formatDate(order.link?.due_date)]);
    rows.push(['상품', items.length > 0 ? items.map((item) => `${itemLabel(item)} x ${itemQty(item)}`).slice(0, 6).join('\n') : '-']);
    rows.push(['메모', order.link?.memo || '-']);
    actions = canManage ? (
      <div className="grid gap-2">
        <Button className="rounded-full bg-foreground text-background hover:bg-foreground/90" onClick={() => onLink(order)}>
          <Link2 className="mr-2 h-4 w-4" />
          연결 정보 수정
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => window.open('/saved-quotes', '_self')}>견적서 확인</Button>
          <Button variant="outline" className="rounded-full" onClick={() => window.open('/project-management', '_self')}>프로젝트 확인</Button>
        </div>
      </div>
    ) : null;
  }

  if (selected.type === 'product') {
    const product = selected.data;
    const mapping = data.mappings.find((item) => item.imweb_prod_no === product.imweb_prod_no);
    title = product.name;
    icon = <PackageOpen className="h-4 w-4" />;
    rows.push(['상품번호', product.imweb_prod_no]);
    rows.push(['카테고리', product.category || '-']);
    rows.push(['가격', formatCurrency(product.price)]);
    rows.push(['재고', product.stock_qty ?? '미확인']);
    rows.push(['상태', product.status || '-']);
    rows.push(['매핑', mapping ? sourceTypeLabel[mapping.inventory_source_type] : '미매핑']);
    rows.push(['동기화', formatDateTime(product.synced_at)]);
  }

  if (selected.type === 'sample') {
    const item = selected.data;
    title = item.color_name;
    icon = <PaletteIcon />;
    rows.push(['원판', item.panel_masters?.name || '-']);
    rows.push(['EA 재고', `${item.stock_ea} / 최소 ${item.min_stock_ea}`]);
    rows.push(['SET 재고', `${item.stock_set} / 최소 ${item.min_stock_set}`]);
    rows.push(['컬러코드', item.color_code || '-']);
  }

  if (selected.type === 'material') {
    const order = selected.data;
    title = `${order.material} ${order.thickness}`;
    icon = <Warehouse className="h-4 w-4" />;
    rows.push(['품질', order.quality]);
    rows.push(['사이즈', `${order.size_name || ''} ${order.width}x${order.height}`]);
    rows.push(['수량', order.quantity]);
    rows.push(['상태', order.status]);
    rows.push(['발주일', formatDate(order.order_date)]);
    rows.push(['담당', order.user_name || '-']);
    rows.push(['메모', order.memo || '-']);
  }

  if (selected.type === 'mapping') {
    const mapping = selected.data;
    title = `매핑 ${mapping.imweb_prod_no}`;
    icon = <ArrowUpDown className="h-4 w-4" />;
    rows.push(['유형', sourceTypeLabel[mapping.inventory_source_type]]);
    rows.push(['재고 부족 기준', mapping.min_stock_qty ?? 0]);
    rows.push(['권장 입고 수량', mapping.reorder_qty ?? 0]);
    rows.push(['자동 동기화 후보', mapping.auto_stock_sync ? '예' : '아니오']);
    rows.push(['메모', mapping.memo || '-']);
  }

  if (selected.type === 'log') {
    const log = selected.data;
    title = log.sync_type || log.action_type || '운영 로그';
    icon = <CheckCircle2 className="h-4 w-4" />;
    rows.push(['상태', log.status || log.action_type || '-']);
    rows.push(['처리 시각', formatDateTime(log.completed_at || log.created_at || log.started_at)]);
    rows.push(['처리 건수', log.synced_count ?? '-']);
    rows.push(['담당', log.user_name || log.actor_name || '-']);
    rows.push(['오류', log.error_message || '-']);
  }

  return (
    <Card className="border-border bg-white shadow-none xl:sticky xl:top-4">
      <CardHeader className="border-b border-border p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/25">{icon}</span>
            <CardTitle className="line-clamp-2 text-base">{title}</CardTitle>
          </div>
          <Button variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs" onClick={onClose}>닫기</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-border bg-muted/15 p-3">
              <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
              <div className="mt-1 whitespace-pre-wrap text-sm text-foreground">{value}</div>
            </div>
          ))}
        </div>
        {actions}
        <Button variant="outline" className="w-full rounded-full" onClick={() => window.open('/imweb-management', '_self')}>
          <ExternalLink className="mr-2 h-4 w-4" />
          아임웹 연동 관리로 이동
        </Button>
      </CardContent>
    </Card>
  );
}

function PaletteIcon() {
  return <PackageCheck className="h-4 w-4" />;
}

export default InventoryOpsPage;
