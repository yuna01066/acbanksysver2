import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ArrowLeft, Plus, Package, ArrowDownToLine, ArrowUpFromLine, Search, AlertTriangle } from 'lucide-react';

interface InventoryItem {
  id: string;
  panel_master_id: string;
  color_name: string;
  color_code: string | null;
  stock_ea: number;
  stock_set: number;
  min_stock_ea: number;
  min_stock_set: number;
  memo: string | null;
  created_at: string;
  updated_at: string;
  panel_masters?: { name: string; quality: string; material: string };
}

interface Transaction {
  id: string;
  inventory_id: string;
  transaction_type: string;
  quantity_ea: number;
  quantity_set: number;
  reason: string | null;
  recipient_name: string | null;
  user_id: string;
  user_name: string;
  created_at: string;
  sample_chip_inventory?: { color_name: string; panel_masters?: { name: string } };
}

const SampleChipInventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isModerator;

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);

  // Add inventory form
  const [addForm, setAddForm] = useState({
    panel_master_id: '',
    color_name: '',
    color_code: '',
    stock_ea: 0,
    stock_set: 0,
    min_stock_ea: 0,
    min_stock_set: 0,
    memo: '',
  });

  // Transaction form
  const [txForm, setTxForm] = useState({
    quantity_ea: 0,
    quantity_set: 0,
    reason: '',
    recipient_name: '',
  });

  // Fetch panel masters
  const { data: panelMasters } = useQuery({
    queryKey: ['panel-masters-for-chips'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('panel_masters')
        .select('id, name, quality, material')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch inventory
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['sample-chip-inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sample_chip_inventory')
        .select('*, panel_masters(name, quality, material)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as InventoryItem[];
    },
  });

  // Fetch transactions
  const { data: transactions } = useQuery({
    queryKey: ['sample-chip-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sample_chip_transactions')
        .select('*, sample_chip_inventory(color_name, panel_masters(name))')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Transaction[];
    },
  });

  // Add inventory mutation
  const addInventory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sample_chip_inventory')
        .insert({
          panel_master_id: addForm.panel_master_id,
          color_name: addForm.color_name,
          color_code: addForm.color_code || null,
          stock_ea: addForm.stock_ea,
          stock_set: addForm.stock_set,
          min_stock_ea: addForm.min_stock_ea,
          min_stock_set: addForm.min_stock_set,
          memo: addForm.memo || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
      setShowAddDialog(false);
      setAddForm({ panel_master_id: '', color_name: '', color_code: '', stock_ea: 0, stock_set: 0, min_stock_ea: 0, min_stock_set: 0, memo: '' });
      toast.success('샘플칩 재고가 등록되었습니다.');
    },
    onError: (err: any) => toast.error(err.message || '등록 실패'),
  });

  // Create transaction mutation
  const createTransaction = useMutation({
    mutationFn: async () => {
      if (!selectedInventory || !user || !profile) return;

      const { error: txError } = await supabase
        .from('sample_chip_transactions')
        .insert({
          inventory_id: selectedInventory.id,
          transaction_type: transactionType,
          quantity_ea: txForm.quantity_ea,
          quantity_set: txForm.quantity_set,
          reason: txForm.reason || null,
          recipient_name: txForm.recipient_name || null,
          user_id: user.id,
          user_name: profile.full_name,
        });
      if (txError) throw txError;

      // Update stock
      const newEa = transactionType === 'in'
        ? selectedInventory.stock_ea + txForm.quantity_ea
        : selectedInventory.stock_ea - txForm.quantity_ea;
      const newSet = transactionType === 'in'
        ? selectedInventory.stock_set + txForm.quantity_set
        : selectedInventory.stock_set - txForm.quantity_set;

      const { error: updateError } = await supabase
        .from('sample_chip_inventory')
        .update({ stock_ea: Math.max(0, newEa), stock_set: Math.max(0, newSet) })
        .eq('id', selectedInventory.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['sample-chip-transactions'] });
      setShowTransactionDialog(false);
      setTxForm({ quantity_ea: 0, quantity_set: 0, reason: '', recipient_name: '' });
      setSelectedInventory(null);
      toast.success(transactionType === 'in' ? '입고 처리되었습니다.' : '출고 처리되었습니다.');
    },
    onError: (err: any) => toast.error(err.message || '처리 실패'),
  });

  const filtered = useMemo(() => {
    if (!inventory) return [];
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(item =>
      item.color_name.toLowerCase().includes(term) ||
      item.panel_masters?.name.toLowerCase().includes(term) ||
      item.panel_masters?.quality.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm]);

  const lowStockItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item =>
      (item.min_stock_ea > 0 && item.stock_ea <= item.min_stock_ea) ||
      (item.min_stock_set > 0 && item.stock_set <= item.min_stock_set)
    );
  }, [inventory]);

  const openTransaction = (item: InventoryItem, type: 'in' | 'out') => {
    setSelectedInventory(item);
    setTransactionType(type);
    setTxForm({ quantity_ea: 0, quantity_set: 0, reason: '', recipient_name: '' });
    setShowTransactionDialog(true);
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
            <h1 className="text-2xl font-bold text-foreground">샘플칩 재고 관리</h1>
            <p className="text-sm text-muted-foreground">제품별/색상별 샘플칩 재고 현황 및 입출고 관리</p>
          </div>
          {canManage && (
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-1" /> 재고 등록
            </Button>
          )}
        </div>

        {/* Low stock warning */}
        {lowStockItems.length > 0 && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-destructive mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold text-sm">재고 부족 알림 ({lowStockItems.length}건)</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.map(item => (
                  <Badge key={item.id} variant="outline" className="text-destructive border-destructive/30">
                    {item.panel_masters?.name} - {item.color_name}
                    (EA: {item.stock_ea}/{item.min_stock_ea}, SET: {item.stock_set}/{item.min_stock_set})
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="inventory">
          <TabsList>
            <TabsTrigger value="inventory">
              <Package className="h-4 w-4 mr-1" /> 재고 현황
            </TabsTrigger>
            <TabsTrigger value="history">
              <ArrowDownToLine className="h-4 w-4 mr-1" /> 입출고 이력
            </TabsTrigger>
          </TabsList>

          {/* Inventory Tab */}
          <TabsContent value="inventory" className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="제품명, 색상, 품질로 검색..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>제품명</TableHead>
                      <TableHead>품질</TableHead>
                      <TableHead>색상</TableHead>
                      <TableHead>색상코드</TableHead>
                      <TableHead className="text-right">재고(EA)</TableHead>
                      <TableHead className="text-right">재고(SET)</TableHead>
                      <TableHead>메모</TableHead>
                      <TableHead className="text-center">입출고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          로딩 중...
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          {searchTerm ? '검색 결과가 없습니다.' : '등록된 재고가 없습니다.'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map(item => {
                        const lowEa = item.min_stock_ea > 0 && item.stock_ea <= item.min_stock_ea;
                        const lowSet = item.min_stock_set > 0 && item.stock_set <= item.min_stock_set;
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.panel_masters?.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.panel_masters?.quality}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {item.color_code && (
                                  <div
                                    className="w-4 h-4 rounded-full border border-border"
                                    style={{ backgroundColor: item.color_code }}
                                  />
                                )}
                                {item.color_name}
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs">{item.color_code || '-'}</TableCell>
                            <TableCell className={`text-right font-mono ${lowEa ? 'text-amber-600 font-bold' : ''}`}>
                              {item.stock_ea}
                            </TableCell>
                            <TableCell className={`text-right font-mono ${lowSet ? 'text-amber-600 font-bold' : ''}`}>
                              {item.stock_set}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-[120px] truncate">
                              {item.memo || '-'}
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => openTransaction(item, 'in')}
                                >
                                  <ArrowDownToLine className="h-3 w-3 mr-1" />입고
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  onClick={() => openTransaction(item, 'out')}
                                >
                                  <ArrowUpFromLine className="h-3 w-3 mr-1" />출고
                                </Button>
                              </div>
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

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>일시</TableHead>
                      <TableHead>유형</TableHead>
                      <TableHead>제품 / 색상</TableHead>
                      <TableHead className="text-right">수량(EA)</TableHead>
                      <TableHead className="text-right">수량(SET)</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>수령자</TableHead>
                      <TableHead>처리자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!transactions || transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          입출고 이력이 없습니다.
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map(tx => (
                        <TableRow key={tx.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            {format(new Date(tx.created_at), 'MM/dd HH:mm', { locale: ko })}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.transaction_type === 'in' ? 'default' : 'secondary'}>
                              {tx.transaction_type === 'in' ? '입고' : '출고'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {tx.sample_chip_inventory?.panel_masters?.name} - {tx.sample_chip_inventory?.color_name}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {tx.transaction_type === 'in' ? '+' : '-'}{tx.quantity_ea}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {tx.transaction_type === 'in' ? '+' : '-'}{tx.quantity_set}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">
                            {tx.reason || '-'}
                          </TableCell>
                          <TableCell className="text-sm">{tx.recipient_name || '-'}</TableCell>
                          <TableCell className="text-sm">{tx.user_name}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Inventory Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>샘플칩 재고 등록</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>제품 선택</Label>
              <Select value={addForm.panel_master_id} onValueChange={v => setAddForm(f => ({ ...f, panel_master_id: v }))}>
                <SelectTrigger><SelectValue placeholder="제품을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {panelMasters?.map(pm => (
                    <SelectItem key={pm.id} value={pm.id}>{pm.name} ({pm.quality})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>색상명</Label>
                <Input value={addForm.color_name} onChange={e => setAddForm(f => ({ ...f, color_name: e.target.value }))} placeholder="예: 화이트" />
              </div>
              <div>
                <Label>색상코드</Label>
                <Input value={addForm.color_code} onChange={e => setAddForm(f => ({ ...f, color_code: e.target.value }))} placeholder="예: #FFFFFF" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>초기 재고(EA)</Label>
                <Input type="number" value={addForm.stock_ea} onChange={e => setAddForm(f => ({ ...f, stock_ea: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>초기 재고(SET)</Label>
                <Input type="number" value={addForm.stock_set} onChange={e => setAddForm(f => ({ ...f, stock_set: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>최소 재고(EA)</Label>
                <Input type="number" value={addForm.min_stock_ea} onChange={e => setAddForm(f => ({ ...f, min_stock_ea: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>최소 재고(SET)</Label>
                <Input type="number" value={addForm.min_stock_set} onChange={e => setAddForm(f => ({ ...f, min_stock_set: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>메모</Label>
              <Textarea value={addForm.memo} onChange={e => setAddForm(f => ({ ...f, memo: e.target.value }))} placeholder="메모 입력" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>취소</Button>
            <Button
              onClick={() => addInventory.mutate()}
              disabled={!addForm.panel_master_id || !addForm.color_name || addInventory.isPending}
            >
              {addInventory.isPending ? '등록 중...' : '등록'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {transactionType === 'in' ? '입고 처리' : '출고 처리'}
              {selectedInventory && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  {selectedInventory.panel_masters?.name} - {selectedInventory.color_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedInventory && (
              <div className="flex gap-4 p-3 rounded-lg bg-muted/50 text-sm">
                <div>현재 EA: <span className="font-mono font-bold">{selectedInventory.stock_ea}</span></div>
                <div>현재 SET: <span className="font-mono font-bold">{selectedInventory.stock_set}</span></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>수량(EA)</Label>
                <Input type="number" min={0} value={txForm.quantity_ea} onChange={e => setTxForm(f => ({ ...f, quantity_ea: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>수량(SET)</Label>
                <Input type="number" min={0} value={txForm.quantity_set} onChange={e => setTxForm(f => ({ ...f, quantity_set: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>사유</Label>
              <Input value={txForm.reason} onChange={e => setTxForm(f => ({ ...f, reason: e.target.value }))} placeholder="입출고 사유" />
            </div>
            {transactionType === 'out' && (
              <div>
                <Label>수령자 / 거래처</Label>
                <Input value={txForm.recipient_name} onChange={e => setTxForm(f => ({ ...f, recipient_name: e.target.value }))} placeholder="수령자 이름 또는 거래처명" />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionDialog(false)}>취소</Button>
            <Button
              onClick={() => createTransaction.mutate()}
              disabled={(txForm.quantity_ea === 0 && txForm.quantity_set === 0) || createTransaction.isPending}
            >
              {createTransaction.isPending ? '처리 중...' : transactionType === 'in' ? '입고 확인' : '출고 확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SampleChipInventoryPage;
