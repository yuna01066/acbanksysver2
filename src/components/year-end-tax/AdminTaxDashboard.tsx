import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, CheckCircle2, RotateCcw, Eye, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { STATUS_LABELS, TAX_YEAR, type TaxSettlement } from '@/hooks/useYearEndTax';

const AdminTaxDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [settlements, setSettlements] = useState<TaxSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState<TaxSettlement | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [detailOpen, setDetailOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('year_end_tax_settlements')
      .select('*')
      .eq('tax_year', TAX_YEAR)
      .order('user_name');
    setSettlements((data as TaxSettlement[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const filtered = settlements.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (search && !s.user_name.includes(search)) return false;
    return true;
  });

  const statusCounts = settlements.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleReview = async (settlementId: string, action: 'confirm' | 'revision') => {
    const updates: any = {};
    if (action === 'confirm') {
      updates.status = 'confirmed';
      updates.reviewed_by = user!.id;
      updates.reviewed_by_name = profile!.full_name;
      updates.reviewed_at = new Date().toISOString();
      updates.confirmed_at = new Date().toISOString();
      updates.review_comment = reviewComment || null;
    } else {
      updates.status = 'revision_requested';
      updates.reviewed_by = user!.id;
      updates.reviewed_by_name = profile!.full_name;
      updates.reviewed_at = new Date().toISOString();
      updates.review_comment = reviewComment;
    }

    const { error } = await supabase
      .from('year_end_tax_settlements')
      .update(updates)
      .eq('id', settlementId);

    if (error) {
      toast.error('처리에 실패했습니다.');
      return;
    }
    toast.success(action === 'confirm' ? '연말정산이 확정되었습니다.' : '수정 요청을 보냈습니다.');
    setDetailOpen(false);
    setReviewComment('');
    await fetchAll();
  };

  const handleFinalize = async (settlementId: string) => {
    const { error } = await supabase
      .from('year_end_tax_settlements')
      .update({ status: 'finalized' })
      .eq('id', settlementId);
    if (error) {
      toast.error('최종 확정 실패');
      return;
    }
    toast.success('최종 완료 처리되었습니다.');
    await fetchAll();
  };

  const formatAmount = (n: number) => n?.toLocaleString('ko-KR') + '원';

  return (
    <div className="space-y-4">
      {/* 현황 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="cursor-pointer" onClick={() => setFilter('all')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">전체</p>
            <p className="text-2xl font-bold">{settlements.length}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter('submitted')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">제출 완료</p>
            <p className="text-2xl font-bold text-indigo-600">{statusCounts['submitted'] || 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter('confirmed')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">확정</p>
            <p className="text-2xl font-bold text-green-600">{statusCounts['confirmed'] || 0}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer" onClick={() => setFilter('not_started')}>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">미시작</p>
            <p className="text-2xl font-bold text-gray-500">{statusCounts['not_started'] || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* 필터/검색 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> 직원별 연말정산 현황
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="이름 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-8">로딩 중...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">해당 조건의 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">총급여</TableHead>
                    <TableHead className="text-right">예상 환급/납부</TableHead>
                    <TableHead>제출일</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const si = STATUS_LABELS[s.status] || STATUS_LABELS['not_started'];
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.user_name}</TableCell>
                        <TableCell><Badge className={si.color}>{si.label}</Badge></TableCell>
                        <TableCell className="text-right">{s.total_salary ? formatAmount(s.total_salary) : '-'}</TableCell>
                        <TableCell className="text-right">
                          {s.estimated_refund ? (
                            <span className={s.estimated_refund > 0 ? 'text-green-600' : 'text-red-600'}>
                              {s.estimated_refund > 0 ? '+' : ''}{formatAmount(s.estimated_refund)}
                            </span>
                          ) : '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {s.submitted_at ? new Date(s.submitted_at).toLocaleDateString('ko-KR') : '-'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setSelectedSettlement(s); setDetailOpen(true); setReviewComment(''); }}
                          >
                            <Eye className="h-4 w-4 mr-1" /> 상세
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 상세/검토 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selectedSettlement?.user_name}님 연말정산</DialogTitle>
          </DialogHeader>
          {selectedSettlement && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">상태</span>
                  <div><Badge className={STATUS_LABELS[selectedSettlement.status]?.color}>{STATUS_LABELS[selectedSettlement.status]?.label}</Badge></div>
                </div>
                <div>
                  <span className="text-muted-foreground">총급여</span>
                  <p className="font-medium">{selectedSettlement.total_salary ? formatAmount(selectedSettlement.total_salary) : '미입력'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">기납부 소득세</span>
                  <p className="font-medium">{formatAmount(selectedSettlement.total_tax_paid)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">예상 환급/납부</span>
                  <p className={`font-medium ${selectedSettlement.estimated_refund > 0 ? 'text-green-600' : selectedSettlement.estimated_refund < 0 ? 'text-red-600' : ''}`}>
                    {selectedSettlement.estimated_refund ? formatAmount(selectedSettlement.estimated_refund) : '-'}
                  </p>
                </div>
              </div>

              {selectedSettlement.installment_enabled && (
                <p className="text-sm text-muted-foreground">분납: {selectedSettlement.installment_months}개월</p>
              )}

              {['submitted', 'review'].includes(selectedSettlement.status) && (
                <>
                  <div>
                    <Label>검토 코멘트</Label>
                    <Textarea
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="수정 요청 시 사유를 입력하세요"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => handleReview(selectedSettlement.id, 'confirm')}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-1" /> 확정
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleReview(selectedSettlement.id, 'revision')}
                      disabled={!reviewComment}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" /> 수정 요청
                    </Button>
                  </div>
                </>
              )}

              {selectedSettlement.status === 'confirmed' && (
                <Button className="w-full" variant="outline" onClick={() => handleFinalize(selectedSettlement.id)}>
                  최종 완료 처리
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminTaxDashboard;
