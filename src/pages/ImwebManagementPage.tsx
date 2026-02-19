import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, RefreshCw, Package, ShoppingCart, History,
  Search, Wifi, WifiOff, Edit2, Check, Link2, Unlink
} from 'lucide-react';

const ImwebManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isModerator;

  const [searchTerm, setSearchTerm] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [editStock, setEditStock] = useState<{ prodNo: string; name: string; qty: number } | null>(null);
  const [newStockQty, setNewStockQty] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [connecting, setConnecting] = useState(false);

  // Check for OAuth callback params
  useEffect(() => {
    if (searchParams.get('imweb_connected') === 'true') {
      toast.success('아임웹 연결이 완료되었습니다!');
      queryClient.invalidateQueries({ queryKey: ['imweb-connection'] });
      // Clean up URL
      window.history.replaceState({}, '', '/imweb-management');
    }
    const error = searchParams.get('imweb_error');
    if (error) {
      toast.error(`아임웹 연결 실패: ${error}`);
      window.history.replaceState({}, '', '/imweb-management');
    }
  }, [searchParams]);

  // Check connection status
  const { data: connectionInfo, isLoading: connectionLoading } = useQuery({
    queryKey: ['imweb-connection'],
    queryFn: async () => {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/imweb-api?action=check-connection`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return res.json();
    },
  });

  const isConnected = connectionInfo?.connected === true;

  // Start OAuth flow
  const startOAuth = async () => {
    setConnecting(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/imweb-api?action=get-auth-url`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ appOrigin: window.location.origin }),
        }
      );
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast.error(data.error || '인가 URL 생성 실패');
      }
    } catch (err: any) {
      toast.error(err.message || '연결 실패');
    } finally {
      setConnecting(false);
    }
  };

  // Disconnect
  const disconnect = async () => {
    if (!confirm('아임웹 연결을 해제하시겠습니까?')) return;
    try {
      await callImwebApi('disconnect');
      toast.success('아임웹 연결이 해제되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['imweb-connection'] });
    } catch (err: any) {
      toast.error(err.message || '연결 해제 실패');
    }
  };

  const testConnection = async () => {
    setConnectionStatus('testing');
    try {
      const res = await fetch(
        `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/imweb-api?action=test`,
        {
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const result = await res.json();
      if (res.ok && result.success) {
        setConnectionStatus('ok');
        toast.success(`연결 성공! ${result.message}`);
      } else {
        setConnectionStatus('error');
        toast.error(result.error || '연결 실패');
      }
    } catch (err: any) {
      setConnectionStatus('error');
      toast.error(err.message || '연결 실패');
    }
  };

  const callImwebApi = async (action: string, body?: Record<string, unknown>) => {
    const session = (await supabase.auth.getSession()).data.session;
    if (!session) throw new Error('로그인이 필요합니다');

    const res = await fetch(
      `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/imweb-api?action=${action}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : '{}',
      }
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'API 호출 실패');
    return result;
  };

  const syncProducts = async () => {
    setSyncing('products');
    try {
      const result = await callImwebApi('sync-products');
      toast.success(`상품 동기화 완료: ${result.syncedCount}건`);
      queryClient.invalidateQueries({ queryKey: ['imweb-products'] });
      queryClient.invalidateQueries({ queryKey: ['imweb-sync-logs'] });
    } catch (err: any) {
      toast.error(err.message || '동기화 실패');
    } finally {
      setSyncing(null);
    }
  };

  const syncOrders = async () => {
    setSyncing('orders');
    try {
      const result = await callImwebApi('sync-orders');
      toast.success(`주문 동기화 완료: ${result.syncedCount}건`);
      queryClient.invalidateQueries({ queryKey: ['imweb-orders'] });
      queryClient.invalidateQueries({ queryKey: ['imweb-sync-logs'] });
    } catch (err: any) {
      toast.error(err.message || '동기화 실패');
    } finally {
      setSyncing(null);
    }
  };

  const updateStock = async () => {
    if (!editStock) return;
    try {
      await callImwebApi('update-stock', {
        prodNo: editStock.prodNo,
        stockQty: newStockQty,
      });
      toast.success('재고 수량이 업데이트되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['imweb-products'] });
      setEditStock(null);
    } catch (err: any) {
      toast.error(err.message || '업데이트 실패');
    }
  };

  // Fetch products
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['imweb-products', searchTerm],
    queryFn: async () => {
      let query = supabase.from('imweb_products').select('*').order('name');
      if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch orders
  const { data: orders, isLoading: ordersLoading } = useQuery({
    queryKey: ['imweb-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imweb_orders').select('*').order('order_date', { ascending: false }).limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch sync logs
  const { data: syncLogs } = useQuery({
    queryKey: ['imweb-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('imweb_sync_logs').select('*').order('started_at', { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const statusLabel = (status: string) => {
    const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      sale: { label: '판매중', variant: 'default' },
      soldout: { label: '품절', variant: 'destructive' },
      nosale: { label: '판매중지', variant: 'secondary' },
      ordered: { label: '주문완료', variant: 'default' },
      paid: { label: '결제완료', variant: 'default' },
      shipping: { label: '배송중', variant: 'secondary' },
      delivered: { label: '배송완료', variant: 'outline' },
      cancelled: { label: '취소', variant: 'destructive' },
      running: { label: '진행중', variant: 'secondary' },
      success: { label: '성공', variant: 'default' },
      error: { label: '오류', variant: 'destructive' },
    };
    return map[status] || { label: status, variant: 'outline' as const };
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">로그인이 필요합니다.</p>
          <Button onClick={() => navigate('/auth')}>로그인</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">아임웹 연동 관리</h1>
            <p className="text-sm text-muted-foreground">상품 조회, 재고 동기화, 주문 내역 관리</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected ? (
              <>
                <Badge variant="default" className="gap-1">
                  <Wifi className="h-3 w-3" /> 연결됨
                </Badge>
                <Button variant="outline" size="sm" onClick={testConnection} disabled={connectionStatus === 'testing'}>
                  {connectionStatus === 'testing' ? (
                    <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Wifi className="h-4 w-4 mr-1" />
                  )}
                  연결 테스트
                </Button>
                {canManage && (
                  <Button variant="ghost" size="sm" onClick={disconnect} className="text-destructive">
                    <Unlink className="h-4 w-4 mr-1" /> 해제
                  </Button>
                )}
              </>
            ) : (
              <Button onClick={startOAuth} disabled={connecting || connectionLoading}>
                {connecting ? (
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4 mr-1" />
                )}
                아임웹 연결
              </Button>
            )}
          </div>
        </div>

        {/* Not connected state */}
        {!isConnected && !connectionLoading && (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <WifiOff className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">아임웹 연결이 필요합니다</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md">
                아임웹 Ground API(OAuth 2.0)를 사용하여 상품, 주문 데이터를 동기화합니다.
                아래 버튼을 눌러 아임웹 계정을 연결해주세요.
              </p>
              <Button onClick={startOAuth} disabled={connecting} size="lg">
                {connecting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Link2 className="h-4 w-4 mr-2" />}
                아임웹 연결하기
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Connected - show tabs */}
        {(isConnected || connectionLoading) && (
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products">
                <Package className="h-4 w-4 mr-1" /> 상품 목록
              </TabsTrigger>
              <TabsTrigger value="orders">
                <ShoppingCart className="h-4 w-4 mr-1" /> 주문 내역
              </TabsTrigger>
              <TabsTrigger value="logs">
                <History className="h-4 w-4 mr-1" /> 동기화 이력
              </TabsTrigger>
            </TabsList>

            {/* Products Tab */}
            <TabsContent value="products" className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="상품명, 카테고리 검색..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
                {canManage && (
                  <Button onClick={syncProducts} disabled={!!syncing}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncing === 'products' ? 'animate-spin' : ''}`} />
                    상품 동기화
                  </Button>
                )}
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이미지</TableHead>
                        <TableHead>상품명</TableHead>
                        <TableHead>카테고리</TableHead>
                        <TableHead className="text-right">가격</TableHead>
                        <TableHead className="text-right">재고</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="text-xs text-muted-foreground">마지막 동기화</TableHead>
                        {canManage && <TableHead className="text-center">재고 수정</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {productsLoading ? (
                        <TableRow>
                          <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                            로딩 중...
                          </TableCell>
                        </TableRow>
                      ) : !products || products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={canManage ? 8 : 7} className="text-center py-8 text-muted-foreground">
                            {searchTerm ? '검색 결과가 없습니다.' : '동기화된 상품이 없습니다. "상품 동기화" 버튼을 눌러주세요.'}
                          </TableCell>
                        </TableRow>
                      ) : (
                        products.map(prod => {
                          const s = statusLabel(prod.status || 'sale');
                          return (
                            <TableRow key={prod.id}>
                              <TableCell>
                                {prod.image_url ? (
                                  <img src={prod.image_url} alt={prod.name} className="w-10 h-10 object-cover rounded" />
                                ) : (
                                  <div className="w-10 h-10 bg-muted rounded flex items-center justify-center">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-medium max-w-[200px] truncate">{prod.name}</TableCell>
                              <TableCell className="text-muted-foreground text-sm">{prod.category || '-'}</TableCell>
                              <TableCell className="text-right font-mono">
                                {prod.price ? `₩${Number(prod.price).toLocaleString()}` : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                {prod.stock_qty === -1 ? '무제한' : prod.stock_qty}
                              </TableCell>
                              <TableCell>
                                <Badge variant={s.variant}>{s.label}</Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {prod.synced_at
                                  ? format(new Date(prod.synced_at), 'MM/dd HH:mm', { locale: ko })
                                  : '-'}
                              </TableCell>
                              {canManage && (
                                <TableCell className="text-center">
                                  {prod.stock_qty !== -1 && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-7"
                                      onClick={() => {
                                        setEditStock({
                                          prodNo: prod.imweb_prod_no,
                                          name: prod.name,
                                          qty: prod.stock_qty ?? 0,
                                        });
                                        setNewStockQty(prod.stock_qty ?? 0);
                                      }}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders" className="space-y-4">
              <div className="flex items-center gap-2 justify-end">
                {canManage && (
                  <Button onClick={syncOrders} disabled={!!syncing}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${syncing === 'orders' ? 'animate-spin' : ''}`} />
                    주문 동기화
                  </Button>
                )}
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>주문번호</TableHead>
                        <TableHead>주문일</TableHead>
                        <TableHead>주문자</TableHead>
                        <TableHead>연락처</TableHead>
                        <TableHead className="text-right">금액</TableHead>
                        <TableHead>상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            로딩 중...
                          </TableCell>
                        </TableRow>
                      ) : !orders || orders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            동기화된 주문이 없습니다. "주문 동기화" 버튼을 눌러주세요.
                          </TableCell>
                        </TableRow>
                      ) : (
                        orders.map(order => {
                          const s = statusLabel(order.order_status || 'ordered');
                          return (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono text-sm">{order.imweb_order_no}</TableCell>
                              <TableCell className="text-sm">
                                {order.order_date
                                  ? format(new Date(order.order_date), 'yyyy-MM-dd HH:mm', { locale: ko })
                                  : '-'}
                              </TableCell>
                              <TableCell>{order.buyer_name || '-'}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {order.buyer_phone || order.buyer_email || '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono">
                                ₩{Number(order.total_price).toLocaleString()}
                              </TableCell>
                              <TableCell>
                                <Badge variant={s.variant}>{s.label}</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>
            </TabsContent>

            {/* Sync Logs Tab */}
            <TabsContent value="logs">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">동기화 이력</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>일시</TableHead>
                          <TableHead>유형</TableHead>
                          <TableHead>상태</TableHead>
                          <TableHead className="text-right">전체/동기화</TableHead>
                          <TableHead>오류</TableHead>
                          <TableHead>처리자</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {!syncLogs || syncLogs.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              동기화 이력이 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : (
                          syncLogs.map(log => {
                            const s = statusLabel(log.status);
                            return (
                              <TableRow key={log.id}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {format(new Date(log.started_at), 'MM/dd HH:mm:ss', { locale: ko })}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {log.sync_type === 'products' ? '상품' : log.sync_type === 'orders' ? '주문' : log.sync_type}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant={s.variant}>{s.label}</Badge>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {log.total_count} / {log.synced_count}
                                </TableCell>
                                <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                                  {log.error_message || '-'}
                                </TableCell>
                                <TableCell className="text-sm">{log.user_name}</TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Edit Stock Dialog */}
      <Dialog open={!!editStock} onOpenChange={() => setEditStock(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>재고 수량 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{editStock?.name}</p>
            <div>
              <Label>현재 재고: {editStock?.qty}개</Label>
            </div>
            <div>
              <Label>변경 수량</Label>
              <Input
                type="number"
                min={0}
                value={newStockQty}
                onChange={e => setNewStockQty(Number(e.target.value))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStock(null)}>취소</Button>
            <Button onClick={updateStock}>
              <Check className="h-4 w-4 mr-1" /> 수정
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImwebManagementPage;
