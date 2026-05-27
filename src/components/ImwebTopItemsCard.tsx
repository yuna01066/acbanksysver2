import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BarChart3, PackageCheck, Palette, RefreshCw, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TopOrderItem {
  label: string;
  quantity: number;
  amount: number;
}

interface TopOrderItemsResponse {
  success: boolean;
  days: number;
  orderCount: number;
  itemCount: number;
  lastSyncedAt: string | null;
  products: TopOrderItem[];
  materials: TopOrderItem[];
  colors: TopOrderItem[];
  error?: string;
}

const FUNCTION_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/imweb-api`;

async function getSessionToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('로그인이 필요합니다.');
  return token;
}

async function fetchTopOrderItems(days = 90): Promise<TopOrderItemsResponse> {
  const token = await getSessionToken();
  const res = await fetch(`${FUNCTION_URL}?action=top-order-items&days=${days}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || '아임웹 주문 집계를 불러오지 못했습니다.');
  return result;
}

async function syncImwebOrders() {
  const token = await getSessionToken();
  const res = await fetch(`${FUNCTION_URL}?action=sync-orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || '아임웹 주문 동기화에 실패했습니다.');
  return result;
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? `${value.toLocaleString()}개` : `${value.toLocaleString()}개`;
}

function StatList({
  title,
  icon: Icon,
  items,
  className,
}: {
  title: string;
  icon: typeof ShoppingBag;
  items: TopOrderItem[];
  className?: string;
}) {
  const maxQty = Math.max(1, ...items.map((item) => item.quantity));

  return (
    <section className={cn('rounded-xl border border-border/70 bg-background/70 p-3', className)}>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <h4 className="text-xs font-semibold text-foreground">{title}</h4>
      </div>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          집계 데이터 없음
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <div key={`${title}-${item.label}`} className="space-y-1.5">
              <div className="flex min-w-0 items-center justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium text-foreground">
                  <span className="mr-1 text-muted-foreground">{index + 1}.</span>
                  {item.label}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatQuantity(item.quantity)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary/70"
                  style={{ width: `${Math.max(8, Math.round((item.quantity / maxQty) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function ImwebTopItemsCard() {
  const { user, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canSync = isAdmin || isModerator;

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['imweb-top-order-items', 90],
    queryFn: () => fetchTopOrderItems(90),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  const lastSyncedLabel = useMemo(() => {
    if (!data?.lastSyncedAt) return '동기화 이력 없음';
    return `${formatDistanceToNow(new Date(data.lastSyncedAt), { addSuffix: true, locale: ko })} 동기화`;
  }, [data?.lastSyncedAt]);

  const handleSync = async () => {
    if (!canSync) return;
    try {
      const result = await syncImwebOrders();
      toast.success(`아임웹 주문 동기화 완료: ${result.syncedCount || 0}건`);
      await queryClient.invalidateQueries({ queryKey: ['imweb-top-order-items'] });
      await queryClient.invalidateQueries({ queryKey: ['imweb-orders'] });
    } catch (syncError) {
      toast.error(syncError instanceof Error ? syncError.message : '아임웹 주문 동기화에 실패했습니다.');
    }
  };

  if (!user) return null;

  return (
    <Card className="flex h-full w-full flex-col">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={BarChart3}
          title="인기 주문 아이템"
          subtitle="아임웹 최근 주문 기준 소재·컬러 상담 참고용"
          meta={
            data ? (
              <Badge variant="secondary" className="rounded-full px-2.5 text-xs">
                {data.days}일
              </Badge>
            ) : null
          }
          actions={
            canSync ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2 text-xs"
                onClick={handleSync}
                disabled={isFetching}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
                동기화
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 rounded-lg px-2 text-xs"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
              </Button>
            )
          }
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col pt-0">
        {isLoading ? (
          <div className="flex min-h-[280px] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            불러오는 중...
          </div>
        ) : isError ? (
          <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            <ShoppingBag className="mb-2 h-8 w-8 text-muted-foreground/35" />
            <p>아임웹 주문 집계를 불러오지 못했습니다.</p>
            <p className="mt-1 text-xs">{error instanceof Error ? error.message : '연동 상태를 확인해주세요.'}</p>
          </div>
        ) : !data || data.itemCount === 0 ? (
          <div className="flex min-h-[280px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            <ShoppingBag className="mb-2 h-8 w-8 text-muted-foreground/35" />
            최근 주문 집계 데이터가 없습니다.
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline" className="rounded-full">
                주문 {data.orderCount.toLocaleString()}건
              </Badge>
              <Badge variant="outline" className="rounded-full">
                품목 {formatQuantity(data.itemCount)}
              </Badge>
              <span>{lastSyncedLabel}</span>
            </div>
            <ScrollArea className="h-[280px]">
              <div className="space-y-3 pr-3">
                <StatList title="상품" icon={ShoppingBag} items={data.products} />
                <StatList title="소재" icon={PackageCheck} items={data.materials} />
                <StatList title="컬러" icon={Palette} items={data.colors} />
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}
