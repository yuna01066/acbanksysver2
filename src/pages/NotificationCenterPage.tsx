import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, BellRing, CheckCheck, Loader2, RefreshCw, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  useDeleteNotifications,
  useMarkNotificationsRead,
  useNotificationCenterItems,
  type NotificationCenterRow,
} from '@/hooks/useNotificationCenter';

const TYPE_LABELS: Record<string, string> = {
  approval_request: '결재 요청',
  approval_approved: '결재 승인',
  approval_rejected: '결재 거절',
  approval_complete: '결재 완료',
  leave_request: '휴가 요청',
  leave_approved: '휴가 승인',
  leave_rejected: '휴가 거절',
  meeting_reservation: '회의 예약',
  meeting_reservation_status: '회의 예약 상태',
  public_booking_request: '공개 예약 요청',
  contract_request: '계약 요청',
  contract_signed: '계약 서명',
  contract_rejected: '계약 거절',
  contract_withdrawn: '계약 철회',
  attendance_correction_request: '근태 정정 요청',
  quote_update: '견적 변경',
  quote_modified: '견적 수정',
  system: '시스템',
};

const APPROVAL_TYPES = new Set([
  'approval_request',
  'approval_approved',
  'approval_rejected',
  'approval_complete',
  'leave_request',
  'leave_approved',
  'leave_rejected',
  'contract_signed',
  'contract_rejected',
  'contract_withdrawn',
  'meeting_reservation_status',
  'public_booking_request',
  'attendance_correction_request',
]);

function typeLabel(type: string) {
  return TYPE_LABELS[type] || type;
}

function typeVariant(type: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (type.endsWith('_rejected') || type.endsWith('_withdrawn')) return 'destructive';
  if (type.endsWith('_approved') || type.endsWith('_complete') || type.endsWith('_signed')) return 'default';
  return 'secondary';
}

const NotificationCenterPage = () => {
  const navigate = useNavigate();
  const { data: items = [], isLoading, refetch, isRefetching } = useNotificationCenterItems();
  const markRead = useMarkNotificationsRead();
  const removeItems = useDeleteNotifications();

  const [scope, setScope] = useState<'approval' | 'unread' | 'all'>('approval');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const availableTypes = useMemo(
    () => Array.from(new Set(items.map((item) => item.type))).sort(),
    [items],
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      if (scope === 'approval' && !APPROVAL_TYPES.has(item.type)) return false;
      if (scope === 'unread' && item.is_read) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!keyword) return true;
      return (
        item.title.toLowerCase().includes(keyword) ||
        item.description.toLowerCase().includes(keyword)
      );
    });
  }, [items, scope, typeFilter, search]);

  const visibleIds = filtered.map((item) => item.id);
  const selectedVisible = selected.filter((id) => visibleIds.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const unreadCount = items.filter((item) => !item.is_read).length;

  const toggleAll = () => {
    setSelected(allVisibleSelected ? [] : visibleIds);
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  };

  const handleMarkRead = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await markRead.mutateAsync(ids);
      toast.success(`${ids.length}건을 읽음으로 표시했습니다.`);
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    } catch {
      toast.error('읽음 처리에 실패했습니다.');
    }
  };

  const handleDelete = async (ids: string[]) => {
    if (ids.length === 0) return;
    try {
      await removeItems.mutateAsync(ids);
      toast.success(`${ids.length}건을 삭제했습니다.`);
      setSelected((prev) => prev.filter((id) => !ids.includes(id)));
    } catch {
      toast.error('알림 삭제에 실패했습니다.');
    }
  };

  const handleDeleteRead = async () => {
    const readIds = filtered.filter((item) => item.is_read).map((item) => item.id);
    if (readIds.length === 0) {
      toast.info('삭제할 읽은 알림이 없습니다.');
      return;
    }
    await handleDelete(readIds);
  };

  const renderRow = (item: NotificationCenterRow) => (
    <div
      key={item.id}
      className={cn(
        'flex gap-3 rounded-lg border p-3',
        item.is_read ? 'border-border bg-background' : 'border-primary/40 bg-primary/5',
      )}
    >
      <Checkbox
        checked={selected.includes(item.id)}
        onCheckedChange={() => toggleOne(item.id)}
        aria-label="알림 선택"
        className="mt-1"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={typeVariant(item.type)}>{typeLabel(item.type)}</Badge>
          {!item.is_read ? <Badge variant="outline">읽지 않음</Badge> : null}
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(item.created_at), 'yyyy-MM-dd HH:mm')}
          </span>
        </div>
        <p className="truncate text-sm font-medium">{item.title}</p>
        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{item.description}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {!item.is_read ? (
          <Button variant="ghost" size="sm" onClick={() => handleMarkRead([item.id])}>
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            읽음
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" onClick={() => handleDelete([item.id])}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          삭제
        </Button>
      </div>
    </div>
  );

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="알림"
        title="승인·거절 알림 관리"
        description="승인/거절 등 처리 알림을 한 곳에서 확인하고, 읽음 처리 또는 삭제해 알림이 쌓이지 않게 관리합니다."
        icon={<BellRing className="h-5 w-5" />}
        meta={<span className="text-xs text-muted-foreground">읽지 않은 알림 {unreadCount}건 · 전체 {items.length}건</span>}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              뒤로
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              새로고침
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Tabs value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
              <TabsList>
                <TabsTrigger value="approval">승인·거절</TabsTrigger>
                <TabsTrigger value="unread">읽지 않음</TabsTrigger>
                <TabsTrigger value="all">전체</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="제목·내용 검색"
                  className="pl-8"
                />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="유형" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 유형</SelectItem>
                  {availableTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {typeLabel(type)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAll} aria-label="전체 선택" />
              전체 선택 ({selectedVisible.length}/{visibleIds.length})
            </label>
            <Button
              variant="secondary"
              size="sm"
              disabled={selectedVisible.length === 0 || markRead.isPending}
              onClick={() => handleMarkRead(selectedVisible)}
            >
              <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
              선택 읽음
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedVisible.length === 0 || removeItems.isPending}
              onClick={() => handleDelete(selectedVisible)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              선택 삭제
            </Button>
            <Button variant="outline" size="sm" disabled={removeItems.isPending} onClick={handleDeleteRead}>
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              읽은 알림 정리
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          알림을 불러오는 중입니다.
        </p>
      ) : filtered.length === 0 ? (
        <Alert>
          <AlertDescription>조건에 맞는 알림이 없습니다.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-2">{filtered.map(renderRow)}</div>
      )}
    </PageShell>
  );
};

export default NotificationCenterPage;
