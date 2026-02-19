import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { ArrowLeft, Plus, Package, ArrowDownToLine, ArrowUpFromLine, Search, AlertTriangle, Upload, Download, ChevronDown, ChevronRight } from 'lucide-react';
import { ExcelUploadDialog } from '@/components/sample-chip/ExcelUploadDialog';
import { downloadInventoryExcel, downloadExcelTemplate } from '@/components/sample-chip/excelDownload';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface InventoryItem {
  id: string;
  panel_master_id: string;
  color_name: string;
  color_code: string | null;
  group_name: string | null;
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

const InlineStockCell: React.FC<{
  item: InventoryItem;
  onSave: (id: string, value: number) => void;
}> = ({ item, onSave }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(item.stock_ea));

  const handleSave = () => {
    const num = parseInt(value) || 0;
    if (num !== item.stock_ea) {
      onSave(item.id, Math.max(0, num));
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <Input
        type="number"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 h-7 text-right font-mono text-sm"
        autoFocus
        min={0}
      />
    );
  }

  const lowEa = item.min_stock_ea > 0 && item.stock_ea <= item.min_stock_ea;
  return (
    <button
      onClick={() => { setValue(String(item.stock_ea)); setEditing(true); }}
      className={`font-mono text-sm px-2 py-1 rounded hover:bg-muted transition-colors cursor-text ${lowEa ? 'text-amber-600 font-bold' : ''}`}
    >
      {item.stock_ea}
    </button>
  );
};

const SampleChipInventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const canManage = isAdmin || isModerator;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<'in' | 'out'>('in');
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [showExcelUpload, setShowExcelUpload] = useState(false);

  const [addForm, setAddForm] = useState({
    panel_master_id: '',
    color_name: '',
    color_code: '',
    group_name: '',
    stock_ea: 0,
    min_stock_ea: 0,
    memo: '',
  });

  const [txForm, setTxForm] = useState({
    quantity_ea: 0,
    reason: '',
    recipient_name: '',
  });

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

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['sample-chip-inventory'],
    queryFn: async () => {
      let allData: InventoryItem[] = [];
      let from = 0;
      const pageSize = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('sample_chip_inventory')
          .select('*, panel_masters(name, quality, material)')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allData = allData.concat(data as InventoryItem[]);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      return allData;
    },
  });

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

  const addInventory = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('sample_chip_inventory')
        .insert({
          panel_master_id: addForm.panel_master_id,
          color_name: addForm.color_name,
          color_code: addForm.color_code || null,
          group_name: addForm.group_name || null,
          stock_ea: addForm.stock_ea,
          stock_set: 0,
          min_stock_ea: addForm.min_stock_ea,
          min_stock_set: 0,
          memo: addForm.memo || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
      setShowAddDialog(false);
      setAddForm({ panel_master_id: '', color_name: '', color_code: '', group_name: '', stock_ea: 0, min_stock_ea: 0, memo: '' });
      toast.success('샘플칩 재고가 등록되었습니다.');
    },
    onError: (err: any) => toast.error(err.message || '등록 실패'),
  });

  const updateStockInline = useCallback(async (id: string, newEa: number) => {
    const { error } = await supabase
      .from('sample_chip_inventory')
      .update({ stock_ea: newEa })
      .eq('id', id);
    if (error) {
      toast.error('재고 수정 실패');
      return;
    }
    queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
    toast.success('재고가 수정되었습니다.');
  }, [queryClient]);

  const createTransaction = useMutation({
    mutationFn: async () => {
      if (!selectedInventory || !user || !profile) return;

      const { error: txError } = await supabase
        .from('sample_chip_transactions')
        .insert({
          inventory_id: selectedInventory.id,
          transaction_type: transactionType,
          quantity_ea: txForm.quantity_ea,
          quantity_set: 0,
          reason: txForm.reason || null,
          recipient_name: txForm.recipient_name || null,
          user_id: user.id,
          user_name: profile.full_name,
        });
      if (txError) throw txError;

      const newEa = transactionType === 'in'
        ? selectedInventory.stock_ea + txForm.quantity_ea
        : selectedInventory.stock_ea - txForm.quantity_ea;

      const { error: updateError } = await supabase
        .from('sample_chip_inventory')
        .update({ stock_ea: Math.max(0, newEa) })
        .eq('id', selectedInventory.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample-chip-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['sample-chip-transactions'] });
      setShowTransactionDialog(false);
      setTxForm({ quantity_ea: 0, reason: '', recipient_name: '' });
      setSelectedInventory(null);
      toast.success(transactionType === 'in' ? '입고 처리되었습니다.' : '출고 처리되었습니다.');
    },
    onError: (err: any) => toast.error(err.message || '처리 실패'),
  });

  const extractCategory = useCallback((memo: string | null): string => {
    if (!memo) return '미분류';
    const match = memo.match(/카테고리:\s*([^,\s]+(?:,[^,\s]+)*)/);
    if (!match) return '미분류';
    // Return first category if multiple
    return match[1].split(',')[0].trim() || '미분류';
  }, []);

  const getItemCategory = useCallback((item: InventoryItem): string => {
    return item.group_name || extractCategory(item.memo);
  }, [extractCategory]);

  const groups = useMemo(() => {
    if (!inventory) return [];
    const groupSet = new Set<string>();
    inventory.forEach(item => {
      groupSet.add(getItemCategory(item));
    });
    return Array.from(groupSet).sort((a, b) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b, 'ko');
    });
  }, [inventory, getItemCategory]);

  const filtered = useMemo(() => {
    if (!inventory) return [];
    let items = inventory;
    if (selectedGroup !== 'all') {
      items = items.filter(item => getItemCategory(item) === selectedGroup);
    }
    if (!searchTerm) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      item.color_name.toLowerCase().includes(term) ||
      item.color_code?.toLowerCase().includes(term) ||
      item.panel_masters?.name.toLowerCase().includes(term) ||
      item.panel_masters?.quality.toLowerCase().includes(term)
    );
  }, [inventory, searchTerm, selectedGroup, getItemCategory]);

  const groupedFiltered = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    filtered.forEach(item => {
      const g = getItemCategory(item);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(item);
    });
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === '미분류') return 1;
      if (b === '미분류') return -1;
      return a.localeCompare(b, 'ko');
    });
  }, [filtered, getItemCategory]);

  const toggleGroup = (g: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g);
      else next.add(g);
      return next;
    });
  };

  const lowStockItems = useMemo(() => {
    if (!inventory) return [];
    return inventory.filter(item =>
      item.min_stock_ea > 0 && item.stock_ea <= item.min_stock_ea
    );
  }, [inventory]);

  const openTransaction = (item: InventoryItem, type: 'in' | 'out') => {
    setSelectedInventory(item);
    setTransactionType(type);
    setTxForm({ quantity_ea: 0, reason: '', recipient_name: '' });
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
            <p className="text-sm text-muted-foreground">
              전체 <span className="font-semibold text-foreground">{inventory?.length || 0}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={downloadInventoryExcel}>
              <Download className="h-4 w-4 mr-1" /> 엑셀 다운로드
            </Button>
            {canManage && (
              <>
                <Button variant="outline" size="sm" onClick={() => setShowExcelUpload(true)}>
                  <Upload className="h-4 w-4 mr-1" /> 엑셀 업로드
                </Button>
                <Button size="sm" onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-1" /> 재고 등록
                </Button>
              </>
            )}
          </div>
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
                    {item.color_name} (재고: {item.stock_ea} / 최소: {item.min_stock_ea})
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

          <TabsContent value="inventory" className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="상품명, 상품코드를 검색해 보세요."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="그룹 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 그룹</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <Card className="p-8 text-center text-muted-foreground">로딩 중...</Card>
            ) : groupedFiltered.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                {searchTerm ? '검색 결과가 없습니다.' : '등록된 재고가 없습니다.'}
              </Card>
            ) : (
              <div className="space-y-3">
                {groupedFiltered.map(([groupName, items]) => {
                  const isCollapsed = collapsedGroups.has(groupName);
                  return (
                    <Card key={groupName}>
                      <button
                        onClick={() => toggleGroup(groupName)}
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                      >
                        {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        <span className="font-semibold text-sm">{groupName}</span>
                        <Badge variant="secondary" className="ml-1 text-xs">{items.length}</Badge>
                      </button>
                      {!isCollapsed && (
                        <div className="overflow-x-auto border-t">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-16">번호</TableHead>
                                <TableHead>상품명</TableHead>
                                <TableHead>상품코드</TableHead>
                                <TableHead className="text-right w-24">재고</TableHead>
                                <TableHead>메모</TableHead>
                                <TableHead className="w-20 text-center">수정일</TableHead>
                                <TableHead className="text-center w-28">입출고</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item, idx) => (
                                <TableRow key={item.id}>
                                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                                  <TableCell className="font-medium">{item.color_name}</TableCell>
                                  <TableCell className="text-muted-foreground text-sm">{item.color_code || '-'}</TableCell>
                                  <TableCell className="text-right">
                                    <InlineStockCell item={item} onSave={updateStockInline} />
                                  </TableCell>
                                  <TableCell className="text-muted-foreground text-xs max-w-[150px] truncate">
                                    {item.memo || '-'}
                                  </TableCell>
                                  <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                                    {format(new Date(item.updated_at), 'yyyy-MM-dd')}
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransaction(item, 'in')}>
                                        <ArrowDownToLine className="h-3 w-3 mr-1" />입고
                                      </Button>
                                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openTransaction(item, 'out')}>
                                        <ArrowUpFromLine className="h-3 w-3 mr-1" />출고
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
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
                      <TableHead>상품명</TableHead>
                      <TableHead className="text-right">수량(EA)</TableHead>
                      <TableHead>사유</TableHead>
                      <TableHead>수령자</TableHead>
                      <TableHead>처리자</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!transactions || transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                            {tx.sample_chip_inventory?.color_name}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {tx.transaction_type === 'in' ? '+' : '-'}{tx.quantity_ea}
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
                <Input value={addForm.color_code} onChange={e => setAddForm(f => ({ ...f, color_code: e.target.value }))} placeholder="예: AC-C001" />
              </div>
            </div>
            <div>
              <Label>그룹</Label>
              <Input value={addForm.group_name} onChange={e => setAddForm(f => ({ ...f, group_name: e.target.value }))} placeholder="예: 아크릴, 강화유리" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>초기 재고(EA)</Label>
                <Input type="number" value={addForm.stock_ea} onChange={e => setAddForm(f => ({ ...f, stock_ea: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label>최소 재고(EA)</Label>
                <Input type="number" value={addForm.min_stock_ea} onChange={e => setAddForm(f => ({ ...f, min_stock_ea: parseInt(e.target.value) || 0 }))} />
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
                  {selectedInventory.color_name}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedInventory && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                현재 재고: <span className="font-mono font-bold">{selectedInventory.stock_ea} EA</span>
              </div>
            )}
            <div>
              <Label>수량(EA)</Label>
              <Input type="number" min={0} value={txForm.quantity_ea} onChange={e => setTxForm(f => ({ ...f, quantity_ea: parseInt(e.target.value) || 0 }))} />
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
              disabled={txForm.quantity_ea === 0 || createTransaction.isPending}
            >
              {createTransaction.isPending ? '처리 중...' : transactionType === 'in' ? '입고 확인' : '출고 확인'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExcelUploadDialog open={showExcelUpload} onOpenChange={setShowExcelUpload} />
    </div>
  );
};

export default SampleChipInventoryPage;
