import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePopbillApi } from '@/hooks/usePopbillApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  ArrowLeft, Plus, Search, RefreshCw, FileText, Send, XCircle,
  Mail, CheckCircle2, Clock, AlertTriangle, Receipt, Building2
} from 'lucide-react';

/* ── 상태 매핑 ── */
const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '임시저장', variant: 'secondary' },
  issued: { label: '발행완료', variant: 'default' },
  sent_to_nts: { label: '국세청전송', variant: 'default' },
  nts_accepted: { label: '국세청접수', variant: 'default' },
  cancelled: { label: '발행취소', variant: 'destructive' },
  failed: { label: '실패', variant: 'destructive' },
};

const TAX_TYPE_MAP: Record<string, string> = {
  taxable: '과세',
  zero_rate: '영세',
  exempt: '면세',
};

/* ── 빈 폼 초기값 ── */
const emptyInvoiceForm = {
  writeDate: format(new Date(), 'yyyyMMdd'),
  taxType: 'taxable',
  chargeDirection: 'forward',
  issueType: 'normal',
  purposeType: 'receipt',
  // 공급자
  supplierCorpNum: '',
  supplierCorpName: '',
  supplierCEOName: '',
  supplierAddr: '',
  supplierBizType: '',
  supplierBizClass: '',
  supplierContactName: '',
  supplierEmail: '',
  supplierTel: '',
  // 공급받는자
  buyerCorpNum: '',
  buyerCorpName: '',
  buyerCEOName: '',
  buyerAddr: '',
  buyerBizType: '',
  buyerBizClass: '',
  buyerContactName: '',
  buyerEmail: '',
  buyerTel: '',
  // 품목
  supplyCostTotal: 0,
  taxTotal: 0,
  totalAmount: 0,
  remark1: '',
  memo: '',
  items: [{ serialNum: 1, itemName: '', unitCost: 0, qty: 1, supplyCost: 0, tax: 0, remark: '' }],
};

type InvoiceItem = typeof emptyInvoiceForm.items[number];

/* ══════════════════════════ COMPONENT ══════════════════════════ */
const TaxInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const popbill = usePopbillApi();

  const [activeTab, setActiveTab] = useState('list');
  const [searchMonth, setSearchMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [form, setForm] = useState({ ...emptyInvoiceForm });
  const [issuing, setIssuing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [corpCheckInput, setCorpCheckInput] = useState('');
  const [corpCheckResult, setCorpCheckResult] = useState<any>(null);
  const [corpChecking, setCorpChecking] = useState(false);

  /* ── DB 조회 ── */
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['tax-invoices', searchMonth, statusFilter],
    queryFn: async () => {
      const start = `${searchMonth}-01`;
      const end = format(endOfMonth(new Date(`${searchMonth}-01`)), 'yyyy-MM-dd');
      let q = supabase
        .from('tax_invoices')
        .select('*')
        .gte('write_date', start)
        .lte('write_date', end)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        q = q.eq('status', statusFilter);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 회사정보 불러오기 (공급자 자동채움) ── */
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('company_info').select('*').limit(1).single();
      return data;
    },
  });

  /* ── 수신처 목록 ── */
  const { data: recipients = [] } = useQuery({
    queryKey: ['recipients-for-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('recipients').select('*').order('company_name');
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 신규 발행 다이얼로그 열기 ── */
  const openCreate = () => {
    const f = { ...emptyInvoiceForm };
    if (companyInfo) {
      f.supplierCorpNum = companyInfo.business_number?.replace(/-/g, '') || '';
      f.supplierCorpName = companyInfo.company_name || '';
      f.supplierCEOName = companyInfo.ceo_name || '';
      f.supplierAddr = `${companyInfo.address || ''} ${companyInfo.detail_address || ''}`.trim();
      f.supplierBizType = companyInfo.business_type || '';
      f.supplierBizClass = companyInfo.industry || '';
      f.supplierEmail = companyInfo.email || '';
      f.supplierTel = companyInfo.phone || '';
    }
    if (profile) {
      f.supplierContactName = profile.full_name;
    }
    setForm(f);
    setCreateOpen(true);
  };

  /* ── 수신처 선택 시 자동입력 ── */
  const fillBuyer = (recipientId: string) => {
    const r = recipients.find((rc: any) => rc.id === recipientId);
    if (!r) return;
    setForm(prev => ({
      ...prev,
      buyerCorpNum: r.business_registration_number?.replace(/-/g, '') || '',
      buyerCorpName: r.company_name || '',
      buyerCEOName: r.ceo_name || '',
      buyerAddr: `${r.address || ''} ${r.detail_address || ''}`.trim(),
      buyerBizType: r.business_type || '',
      buyerBizClass: r.business_class || '',
      buyerContactName: r.contact_person || '',
      buyerEmail: r.email || '',
      buyerTel: r.phone || '',
    }));
  };

  /* ── 품목 행 업데이트 ── */
  const updateItem = (idx: number, field: keyof InvoiceItem, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      (items[idx] as any)[field] = value;
      if (field === 'unitCost' || field === 'qty') {
        items[idx].supplyCost = items[idx].unitCost * items[idx].qty;
        items[idx].tax = Math.round(items[idx].supplyCost * 0.1);
      }
      const supplyCostTotal = items.reduce((s, i) => s + i.supplyCost, 0);
      const taxTotal = items.reduce((s, i) => s + i.tax, 0);
      return { ...prev, items, supplyCostTotal, taxTotal, totalAmount: supplyCostTotal + taxTotal };
    });
  };

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { serialNum: prev.items.length + 1, itemName: '', unitCost: 0, qty: 1, supplyCost: 0, tax: 0, remark: '' }],
    }));
  };

  const removeItemRow = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, serialNum: i + 1 }));
      const supplyCostTotal = items.reduce((s, i) => s + i.supplyCost, 0);
      const taxTotal = items.reduce((s, i) => s + i.tax, 0);
      return { ...prev, items, supplyCostTotal, taxTotal, totalAmount: supplyCostTotal + taxTotal };
    });
  };

  /* ── 즉시발행 ── */
  const handleIssue = async () => {
    if (!form.buyerCorpNum || !form.supplierCorpNum) {
      toast.error('공급자 및 공급받는자 사업자번호는 필수입니다.');
      return;
    }
    if (form.items.every(i => !i.itemName)) {
      toast.error('품목을 하나 이상 입력해주세요.');
      return;
    }
    setIssuing(true);
    try {
      const mgtKey = `LV${Date.now()}`;
      const taxInvoice = {
        writeDate: form.writeDate,
        chargeDirection: form.chargeDirection === 'forward' ? '정과금' : '역과금',
        issueType: form.issueType === 'normal' ? '정발행' : '역발행',
        purposeType: form.purposeType === 'receipt' ? '영수' : '청구',
        taxType: form.taxType === 'taxable' ? '과세' : form.taxType === 'zero_rate' ? '영세' : '면세',
        supplyCostTotal: String(form.supplyCostTotal),
        taxTotal: String(form.taxTotal),
        totalAmount: String(form.totalAmount),
        remark1: form.remark1,
        invoicerCorpNum: form.supplierCorpNum,
        invoicerCorpName: form.supplierCorpName,
        invoicerCEOName: form.supplierCEOName,
        invoicerAddr: form.supplierAddr,
        invoicerBizType: form.supplierBizType,
        invoicerBizClass: form.supplierBizClass,
        invoicerContactName: form.supplierContactName,
        invoicerEmail: form.supplierEmail,
        invoicerTEL: form.supplierTel,
        invoicerMgtKey: mgtKey,
        invoiceeCorpNum: form.buyerCorpNum,
        invoiceeCorpName: form.buyerCorpName,
        invoiceeCEOName: form.buyerCEOName,
        invoiceeAddr: form.buyerAddr,
        invoiceeBizType: form.buyerBizType,
        invoiceeBizClass: form.buyerBizClass,
        invoiceeContactName1: form.buyerContactName,
        invoiceeEmail1: form.buyerEmail,
        invoiceeTEL1: form.buyerTel,
        invoiceeType: '사업자',
        detailList: form.items.map(i => ({
          serialNum: i.serialNum,
          itemName: i.itemName,
          unitCost: String(i.unitCost),
          qty: String(i.qty),
          supplyCost: String(i.supplyCost),
          tax: String(i.tax),
          remark: i.remark,
        })),
      };

      const result = await popbill.registIssue(taxInvoice, form.memo);

      // DB 저장
      const { error } = await supabase.from('tax_invoices').insert({
        user_id: user!.id,
        user_name: profile?.full_name || '',
        write_date: `${form.writeDate.slice(0, 4)}-${form.writeDate.slice(4, 6)}-${form.writeDate.slice(6, 8)}`,
        tax_type: form.taxType,
        charge_direction: form.chargeDirection,
        issue_type: form.issueType,
        purpose_type: form.purposeType,
        supplier_corp_num: form.supplierCorpNum,
        supplier_corp_name: form.supplierCorpName,
        supplier_ceo_name: form.supplierCEOName,
        supplier_addr: form.supplierAddr,
        supplier_biz_type: form.supplierBizType,
        supplier_biz_class: form.supplierBizClass,
        supplier_contact_name: form.supplierContactName,
        supplier_email: form.supplierEmail,
        supplier_tel: form.supplierTel,
        buyer_corp_num: form.buyerCorpNum,
        buyer_corp_name: form.buyerCorpName,
        buyer_ceo_name: form.buyerCEOName,
        buyer_addr: form.buyerAddr,
        buyer_biz_type: form.buyerBizType,
        buyer_biz_class: form.buyerBizClass,
        buyer_contact_name: form.buyerContactName,
        buyer_email: form.buyerEmail,
        buyer_tel: form.buyerTel,
        supply_cost_total: form.supplyCostTotal,
        tax_total: form.taxTotal,
        total_amount: form.totalAmount,
        items: form.items as any,
        remark1: form.remark1,
        memo: form.memo,
        popbill_mgt_key: mgtKey,
        popbill_issue_id: result?.ntsConfirmNum || null,
        popbill_nts_confirm_num: result?.ntsConfirmNum || null,
        status: 'issued',
      });

      if (error) throw error;

      toast.success('세금계산서가 발행되었습니다.');
      setCreateOpen(false);
      refetch();
    } catch (err: any) {
      toast.error(`발행 실패: ${err.message}`);
    } finally {
      setIssuing(false);
    }
  };

  /* ── 발행취소 ── */
  const handleCancel = async (inv: any) => {
    if (!confirm('이 세금계산서를 발행 취소하시겠습니까?')) return;
    try {
      await popbill.cancelIssue('SELL', inv.popbill_mgt_key, '발행취소');
      await supabase.from('tax_invoices').update({ status: 'cancelled' }).eq('id', inv.id);
      toast.success('발행이 취소되었습니다.');
      refetch();
      setDetailOpen(false);
    } catch (err: any) {
      toast.error(`취소 실패: ${err.message}`);
    }
  };

  /* ── 상태 동기화 ── */
  const handleSyncStatus = async (inv: any) => {
    if (!inv.popbill_mgt_key) { toast.error('관리번호가 없습니다.'); return; }
    setSyncing(true);
    try {
      const info = await popbill.getInfo('SELL', inv.popbill_mgt_key);
      const stateCode = String(info?.stateCode || '');
      let newStatus = inv.status;
      if (stateCode.startsWith('3')) newStatus = 'issued';
      if (stateCode.startsWith('4')) newStatus = 'sent_to_nts';
      if (stateCode.startsWith('5')) newStatus = 'nts_accepted';
      if (stateCode === '2') newStatus = 'cancelled';

      await supabase.from('tax_invoices').update({
        status: newStatus,
        popbill_state_code: stateCode,
        popbill_state_dt: info?.stateDT || null,
        popbill_nts_confirm_num: info?.ntsconfirmNum || inv.popbill_nts_confirm_num,
      }).eq('id', inv.id);

      toast.success('상태가 동기화되었습니다.');
      refetch();
    } catch (err: any) {
      toast.error(`동기화 실패: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  /* ── 이메일 재전송 ── */
  const handleResendEmail = async (inv: any) => {
    if (!inv.buyer_email) { toast.error('수신 이메일이 없습니다.'); return; }
    try {
      await popbill.sendEmail('SELL', inv.popbill_mgt_key, inv.buyer_email);
      await supabase.from('tax_invoices').update({ email_sent: true }).eq('id', inv.id);
      toast.success('이메일이 재전송되었습니다.');
    } catch (err: any) {
      toast.error(`재전송 실패: ${err.message}`);
    }
  };

  /* ── 사업자등록상태 조회 ── */
  const handleCorpCheck = async () => {
    if (!corpCheckInput.replace(/-/g, '')) { toast.error('사업자번호를 입력해주세요.'); return; }
    setCorpChecking(true);
    try {
      const result = await popbill.checkCorpNum(corpCheckInput.replace(/-/g, ''));
      setCorpCheckResult(result);
    } catch (err: any) {
      toast.error(`조회 실패: ${err.message}`);
    } finally {
      setCorpChecking(false);
    }
  };

  /* ── 통계 ── */
  const stats = useMemo(() => {
    const total = invoices.length;
    const issued = invoices.filter((i: any) => i.status === 'issued').length;
    const nts = invoices.filter((i: any) => ['sent_to_nts', 'nts_accepted'].includes(i.status)).length;
    const cancelled = invoices.filter((i: any) => i.status === 'cancelled').length;
    const totalAmount = invoices.reduce((s: number, i: any) => s + (i.total_amount || 0), 0);
    return { total, issued, nts, cancelled, totalAmount };
  }, [invoices]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">로그인이 필요합니다.</p>
          <Button className="mt-4" onClick={() => navigate('/auth')}>로그인</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              세금계산서 관리
            </h1>
            <p className="text-sm text-muted-foreground">팝빌 연동 전자세금계산서 발행 및 조회</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> 세금계산서 발행
          </Button>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: '전체', value: stats.total, icon: FileText, color: 'text-foreground' },
            { label: '발행완료', value: stats.issued, icon: CheckCircle2, color: 'text-primary' },
            { label: '국세청전송', value: stats.nts, icon: Send, color: 'text-emerald-600' },
            { label: '취소', value: stats.cancelled, icon: XCircle, color: 'text-destructive' },
            { label: '합계금액', value: `${stats.totalAmount.toLocaleString()}원`, icon: Receipt, color: 'text-primary' },
          ].map((s, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </Card>
          ))}
        </div>

        {/* 탭 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="list">세금계산서 목록</TabsTrigger>
            <TabsTrigger value="corpcheck">사업자상태 조회</TabsTrigger>
          </TabsList>

          {/* ─── 목록 탭 ─── */}
          <TabsContent value="list">
            {/* 필터 */}
            <div className="flex flex-wrap gap-3 mb-4">
              <Input
                type="month"
                value={searchMonth}
                onChange={e => setSearchMonth(e.target.value)}
                className="w-44"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 상태</SelectItem>
                  <SelectItem value="draft">임시저장</SelectItem>
                  <SelectItem value="issued">발행완료</SelectItem>
                  <SelectItem value="sent_to_nts">국세청전송</SelectItem>
                  <SelectItem value="nts_accepted">국세청접수</SelectItem>
                  <SelectItem value="cancelled">발행취소</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            {/* 테이블 */}
            <Card>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">작성일자</TableHead>
                      <TableHead>공급받는자</TableHead>
                      <TableHead className="text-right">공급가액</TableHead>
                      <TableHead className="text-right">세액</TableHead>
                      <TableHead className="text-right">합계</TableHead>
                      <TableHead className="w-24 text-center">상태</TableHead>
                      <TableHead className="w-32 text-center">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">로딩 중...</TableCell></TableRow>
                    ) : invoices.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">세금계산서가 없습니다.</TableCell></TableRow>
                    ) : invoices.map((inv: any) => (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => { setSelectedInvoice(inv); setDetailOpen(true); }}
                      >
                        <TableCell className="text-sm">{inv.write_date}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{inv.buyer_corp_name}</div>
                          <div className="text-xs text-muted-foreground">{inv.buyer_corp_num}</div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{(inv.supply_cost_total || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{(inv.tax_total || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm font-medium">{(inv.total_amount || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                          <Badge variant={STATUS_MAP[inv.status]?.variant || 'outline'}>
                            {STATUS_MAP[inv.status]?.label || inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" title="상태 동기화" onClick={() => handleSyncStatus(inv)}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </Button>
                            {inv.status === 'issued' && (
                              <Button variant="ghost" size="icon" title="이메일 재전송" onClick={() => handleResendEmail(inv)}>
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          {/* ─── 사업자상태 조회 탭 ─── */}
          <TabsContent value="corpcheck">
            <Card className="p-6 max-w-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                사업자등록상태 조회
              </h3>
              <div className="flex gap-2 mb-4">
                <Input
                  placeholder="사업자번호 (예: 000-00-00000)"
                  value={corpCheckInput}
                  onChange={e => setCorpCheckInput(e.target.value)}
                />
                <Button onClick={handleCorpCheck} disabled={corpChecking}>
                  {corpChecking ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {corpCheckResult && (
                <div className="p-4 rounded-lg border bg-muted/30 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">사업자번호</span>
                    <span className="font-medium">{corpCheckResult.corpNum || corpCheckInput}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">상태</span>
                    <Badge variant={corpCheckResult.state === '0' ? 'default' : 'destructive'}>
                      {corpCheckResult.state === '0' ? '정상' : corpCheckResult.state === '1' ? '휴업' : corpCheckResult.state === '2' ? '폐업' : '확인불가'}
                    </Badge>
                  </div>
                  {corpCheckResult.stateDate && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">상태변경일</span>
                      <span>{corpCheckResult.stateDate}</span>
                    </div>
                  )}
                  {corpCheckResult.type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">유형</span>
                      <span>{corpCheckResult.type}</span>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ═══ 발행 다이얼로그 ═══ */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>세금계산서 발행</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* 기본정보 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">작성일자</Label>
                <Input
                  value={`${form.writeDate.slice(0, 4)}-${form.writeDate.slice(4, 6)}-${form.writeDate.slice(6, 8)}`}
                  onChange={e => setForm(f => ({ ...f, writeDate: e.target.value.replace(/-/g, '') }))}
                  type="date"
                />
              </div>
              <div>
                <Label className="text-xs">과세유형</Label>
                <Select value={form.taxType} onValueChange={v => setForm(f => ({ ...f, taxType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taxable">과세</SelectItem>
                    <SelectItem value="zero_rate">영세</SelectItem>
                    <SelectItem value="exempt">면세</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">발행유형</Label>
                <Select value={form.issueType} onValueChange={v => setForm(f => ({ ...f, issueType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">정발행</SelectItem>
                    <SelectItem value="reverse">역발행</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">영수/청구</Label>
                <Select value={form.purposeType} onValueChange={v => setForm(f => ({ ...f, purposeType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">영수</SelectItem>
                    <SelectItem value="request">청구</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* 공급자 / 공급받는자 */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* 공급자 */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm text-primary">공급자 (발행자)</h4>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">사업자번호*</Label>
                    <Input value={form.supplierCorpNum} onChange={e => setForm(f => ({ ...f, supplierCorpNum: e.target.value }))} placeholder="0000000000" />
                  </div>
                  <div>
                    <Label className="text-xs">상호</Label>
                    <Input value={form.supplierCorpName} onChange={e => setForm(f => ({ ...f, supplierCorpName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">대표자</Label>
                    <Input value={form.supplierCEOName} onChange={e => setForm(f => ({ ...f, supplierCEOName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">담당자</Label>
                    <Input value={form.supplierContactName} onChange={e => setForm(f => ({ ...f, supplierContactName: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">이메일</Label>
                    <Input value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* 공급받는자 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm text-primary">공급받는자</h4>
                  <Select onValueChange={fillBuyer}>
                    <SelectTrigger className="w-40 h-7 text-xs">
                      <SelectValue placeholder="수신처 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {recipients.map((r: any) => (
                        <SelectItem key={r.id} value={r.id}>{r.company_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">사업자번호*</Label>
                    <Input value={form.buyerCorpNum} onChange={e => setForm(f => ({ ...f, buyerCorpNum: e.target.value }))} placeholder="0000000000" />
                  </div>
                  <div>
                    <Label className="text-xs">상호</Label>
                    <Input value={form.buyerCorpName} onChange={e => setForm(f => ({ ...f, buyerCorpName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">대표자</Label>
                    <Input value={form.buyerCEOName} onChange={e => setForm(f => ({ ...f, buyerCEOName: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">담당자</Label>
                    <Input value={form.buyerContactName} onChange={e => setForm(f => ({ ...f, buyerContactName: e.target.value }))} />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs">이메일</Label>
                    <Input value={form.buyerEmail} onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* 품목 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">품목</h4>
                <Button variant="outline" size="sm" onClick={addItemRow}>+ 행추가</Button>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>품목명</TableHead>
                      <TableHead className="w-24">단가</TableHead>
                      <TableHead className="w-16">수량</TableHead>
                      <TableHead className="w-24">공급가</TableHead>
                      <TableHead className="w-24">세액</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {form.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs">{idx + 1}</TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm" value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} placeholder="품목명" />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm text-right" type="number" value={item.unitCost || ''} onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))} />
                        </TableCell>
                        <TableCell>
                          <Input className="h-8 text-sm text-right" type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} />
                        </TableCell>
                        <TableCell className="text-right text-sm">{item.supplyCost.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-sm">{item.tax.toLocaleString()}</TableCell>
                        <TableCell>
                          {form.items.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItemRow(idx)}>
                              <XCircle className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex justify-end gap-6 mt-3 text-sm">
                <span>공급가: <strong>{form.supplyCostTotal.toLocaleString()}원</strong></span>
                <span>세액: <strong>{form.taxTotal.toLocaleString()}원</strong></span>
                <span>합계: <strong className="text-primary">{form.totalAmount.toLocaleString()}원</strong></span>
              </div>
            </div>

            {/* 비고 */}
            <div>
              <Label className="text-xs">비고</Label>
              <Textarea value={form.remark1} onChange={e => setForm(f => ({ ...f, remark1: e.target.value }))} rows={2} placeholder="비고사항" />
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>취소</Button>
            <Button onClick={handleIssue} disabled={issuing}>
              {issuing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              즉시발행
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 상세 다이얼로그 ═══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedInvoice && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  세금계산서 상세
                  <Badge variant={STATUS_MAP[selectedInvoice.status]?.variant || 'outline'}>
                    {STATUS_MAP[selectedInvoice.status]?.label || selectedInvoice.status}
                  </Badge>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                {/* 기본 */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  <div className="flex justify-between"><span className="text-muted-foreground">작성일자</span><span>{selectedInvoice.write_date}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">과세유형</span><span>{TAX_TYPE_MAP[selectedInvoice.tax_type] || selectedInvoice.tax_type}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">관리번호</span><span className="font-mono text-xs">{selectedInvoice.popbill_mgt_key || '-'}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">국세청 확인번호</span><span className="font-mono text-xs">{selectedInvoice.popbill_nts_confirm_num || '-'}</span></div>
                </div>

                <Separator />

                {/* 공급자 / 공급받는자 */}
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <h5 className="font-semibold mb-2 text-xs text-muted-foreground">공급자</h5>
                    <p className="font-medium">{selectedInvoice.supplier_corp_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedInvoice.supplier_corp_num}</p>
                    <p className="text-xs">{selectedInvoice.supplier_ceo_name}</p>
                  </div>
                  <div className="p-3 rounded-lg border bg-muted/30">
                    <h5 className="font-semibold mb-2 text-xs text-muted-foreground">공급받는자</h5>
                    <p className="font-medium">{selectedInvoice.buyer_corp_name}</p>
                    <p className="text-xs text-muted-foreground">{selectedInvoice.buyer_corp_num}</p>
                    <p className="text-xs">{selectedInvoice.buyer_ceo_name}</p>
                  </div>
                </div>

                <Separator />

                {/* 금액 */}
                <div className="flex justify-end gap-6">
                  <span>공급가: <strong>{(selectedInvoice.supply_cost_total || 0).toLocaleString()}원</strong></span>
                  <span>세액: <strong>{(selectedInvoice.tax_total || 0).toLocaleString()}원</strong></span>
                  <span>합계: <strong className="text-primary">{(selectedInvoice.total_amount || 0).toLocaleString()}원</strong></span>
                </div>

                {/* 품목 */}
                {Array.isArray(selectedInvoice.items) && selectedInvoice.items.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>품목명</TableHead>
                        <TableHead className="text-right">단가</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="text-right">공급가</TableHead>
                        <TableHead className="text-right">세액</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedInvoice.items as any[]).map((item: any, i: number) => (
                        <TableRow key={i}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>{item.itemName || item.item_name || '-'}</TableCell>
                          <TableCell className="text-right">{Number(item.unitCost || item.unit_cost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{item.qty || item.quantity || 0}</TableCell>
                          <TableCell className="text-right">{Number(item.supplyCost || item.supply_cost || 0).toLocaleString()}</TableCell>
                          <TableCell className="text-right">{Number(item.tax || 0).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {selectedInvoice.remark1 && (
                  <div>
                    <span className="text-xs text-muted-foreground">비고:</span>
                    <p>{selectedInvoice.remark1}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-4 gap-2">
                <Button variant="outline" size="sm" onClick={() => handleSyncStatus(selectedInvoice)} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> 상태 동기화
                </Button>
                {selectedInvoice.status === 'issued' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => handleResendEmail(selectedInvoice)}>
                      <Mail className="h-4 w-4 mr-1" /> 이메일 재전송
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleCancel(selectedInvoice)}>
                      <XCircle className="h-4 w-4 mr-1" /> 발행취소
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TaxInvoicesPage;
