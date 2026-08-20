import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, RotateCcw, Search } from 'lucide-react';

import HomeLogoButton from '@/components/HomeLogoButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePopbillApi } from '@/hooks/usePopbillApi';
import { isKnownPopbillStateCode, mapPopbillStateCode } from '@/services/taxInvoiceReliability';

interface ReliabilityRow {
  id: string;
  popbill_mgt_key: string | null;
  status: string | null;
  sync_status: string | null;
  pending_operation: string | null;
  sync_error: string | null;
  external_action_at: string | null;
  popbill_state_code: string | null;
  buyer_corp_name: string | null;
  recipient_name: string | null;
  project_name: string | null;
  quote_number: string | null;
  total_amount: number | null;
  write_date: string | null;
  created_at: string | null;
  updated_at: string | null;
  user_name: string | null;
}

type SyncFilter = 'unresolved' | 'required' | 'pending' | 'synced' | 'all';
type OperationFilter = 'all' | 'issue' | 'cancel';

const SYNC_LABEL: Record<string, string> = {
  synced: '동기화 완료',
  pending: '처리 중',
  required: '동기화 필요',
};

const OPERATION_LABEL: Record<string, string> = {
  issue: '발행',
  cancel: '발행취소',
};

const syncBadge = (syncStatus: string | null) => {
  if (syncStatus === 'required') return <Badge variant="destructive">동기화 필요</Badge>;
  if (syncStatus === 'pending') return <Badge className="bg-amber-500 hover:bg-amber-500">처리 중</Badge>;
  return <Badge variant="secondary">동기화 완료</Badge>;
};

const fmt = (value: string | null) => (value ? format(new Date(value), 'yyyy-MM-dd HH:mm') : '-');

const TaxInvoiceReliabilityPage = () => {
  const { user } = useAuth();
  const popbill = usePopbillApi();
  const [syncFilter, setSyncFilter] = useState<SyncFilter>('unresolved');
  const [operationFilter, setOperationFilter] = useState<OperationFilter>('all');
  const [search, setSearch] = useState('');
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['tax-invoice-reliability', syncFilter],
    queryFn: async () => {
      let q = supabase
        .from('tax_invoices')
        .select(
          'id, popbill_mgt_key, status, sync_status, pending_operation, sync_error, external_action_at, popbill_state_code, buyer_corp_name, recipient_name, project_name, quote_number, total_amount, write_date, created_at, updated_at, user_name',
        )
        .order('updated_at', { ascending: false })
        .limit(300);

      if (syncFilter === 'unresolved') q = q.in('sync_status', ['pending', 'required']);
      else if (syncFilter !== 'all') q = q.eq('sync_status', syncFilter);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ReliabilityRow[];
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (operationFilter !== 'all' && (row.pending_operation ?? '') !== operationFilter) return false;
      if (!keyword) return true;
      return [
        row.popbill_mgt_key,
        row.buyer_corp_name,
        row.recipient_name,
        row.project_name,
        row.quote_number,
        row.sync_error,
        row.user_name,
      ]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(keyword));
    });
  }, [rows, operationFilter, search]);

  const stats = useMemo(() => {
    const required = rows.filter((r) => r.sync_status === 'required').length;
    const pending = rows.filter((r) => r.sync_status === 'pending').length;
    const withError = rows.filter((r) => !!r.sync_error).length;
    const externalDone = rows.filter((r) => r.sync_status !== 'synced' && !!r.external_action_at).length;
    return { required, pending, withError, externalDone };
  }, [rows]);

  const handleSync = async (row: ReliabilityRow) => {
    if (!row.popbill_mgt_key) {
      toast.error('관리번호가 없어 동기화할 수 없습니다.');
      return;
    }
    setSyncingId(row.id);
    try {
      const info = await popbill.getInfo('SELL', row.popbill_mgt_key);
      const stateCode = String(info?.stateCode || '');
      if (!isKnownPopbillStateCode(stateCode)) {
        throw new Error(`확인할 수 없는 팝빌 상태코드입니다: ${stateCode || '없음'}`);
      }
      const newStatus = mapPopbillStateCode(stateCode, row.status ?? 'issued');
      const { error } = await supabase
        .from('tax_invoices')
        .update({
          status: newStatus,
          popbill_state_code: stateCode,
          popbill_state_dt: info?.stateDT || null,
          sync_status: 'synced',
          pending_operation: null,
          sync_error: null,
        })
        .eq('id', row.id)
        .select('id')
        .single();
      if (error) throw new Error(`내부 상태 저장 실패: ${error.message}`);
      toast.success(`관리번호 ${row.popbill_mgt_key} 상태를 동기화했습니다.`);
      await refetch();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`동기화 실패: ${message}`);
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 p-3">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <HomeLogoButton />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold">세금계산서 신뢰성 모니터</h1>
            <p className="text-sm text-muted-foreground">
              팝빌 발행·취소 처리 중 발생한 오류와 내부 상태 동기화가 필요한 건을 조회하고 재동기화합니다.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4" /> 동기화 필요
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.required}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
                <Clock className="h-4 w-4" /> 처리 중
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.pending}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">오류 메시지 보유</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.withError}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">팝빌 처리 완료·내부 미반영</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">{stats.externalDone}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">조회 조건</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Select value={syncFilter} onValueChange={(v) => setSyncFilter(v as SyncFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="unresolved">미해결 (처리 중 + 동기화 필요)</SelectItem>
                <SelectItem value="required">동기화 필요</SelectItem>
                <SelectItem value="pending">처리 중</SelectItem>
                <SelectItem value="synced">동기화 완료</SelectItem>
                <SelectItem value="all">전체</SelectItem>
              </SelectContent>
            </Select>
            <Select value={operationFilter} onValueChange={(v) => setOperationFilter(v as OperationFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">작업 전체</SelectItem>
                <SelectItem value="issue">발행</SelectItem>
                <SelectItem value="cancel">발행취소</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="관리번호 / 거래처 / 오류 메시지 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              대상 {filtered.length}건
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">불러오는 중...</p>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-sm text-muted-foreground">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                조건에 해당하는 건이 없습니다.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>동기화 상태</TableHead>
                    <TableHead>작업</TableHead>
                    <TableHead>관리번호</TableHead>
                    <TableHead>거래처 / 프로젝트</TableHead>
                    <TableHead>문서 상태</TableHead>
                    <TableHead>팝빌 처리 시각</TableHead>
                    <TableHead>최근 갱신</TableHead>
                    <TableHead>오류 메시지</TableHead>
                    <TableHead className="text-right">재동기화</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => (
                    <TableRow key={row.id} className={row.sync_status === 'required' ? 'bg-destructive/5' : undefined}>
                      <TableCell>{syncBadge(row.sync_status)}</TableCell>
                      <TableCell className="text-xs">
                        {row.pending_operation ? OPERATION_LABEL[row.pending_operation] ?? row.pending_operation : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.popbill_mgt_key || '-'}</TableCell>
                      <TableCell className="text-xs">
                        <div>{row.buyer_corp_name || row.recipient_name || '-'}</div>
                        <div className="text-muted-foreground">
                          {row.project_name || row.quote_number || ''}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.status || '-'}
                        {row.popbill_state_code ? ` (${row.popbill_state_code})` : ''}
                      </TableCell>
                      <TableCell className="text-xs">{fmt(row.external_action_at)}</TableCell>
                      <TableCell className="text-xs">{fmt(row.updated_at || row.created_at)}</TableCell>
                      <TableCell className="max-w-[280px] text-xs text-destructive">
                        {row.sync_error || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!row.popbill_mgt_key || syncingId === row.id}
                          onClick={() => handleSync(row)}
                        >
                          <RotateCcw className={`mr-1 h-3 w-3 ${syncingId === row.id ? 'animate-spin' : ''}`} />
                          상태 동기화
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">처리 원칙</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            <p>· “동기화 필요”는 팝빌 처리 결과와 내부 상태가 어긋난 상태입니다. 재발행/재취소 대신 반드시 상태 동기화를 먼저 실행하세요.</p>
            <p>· “팝빌 처리 완료·내부 미반영”은 국세청 전송은 진행된 건이므로 중복 발행 위험이 가장 큽니다.</p>
            <p>· 상태 동기화는 팝빌 조회 결과({SYNC_LABEL.synced} 기준)로 문서 상태를 덮어씁니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TaxInvoiceReliabilityPage;
