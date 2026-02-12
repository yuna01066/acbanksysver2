import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { usePopbillApi } from '@/hooks/usePopbillApi';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format, endOfMonth } from 'date-fns';
import { ArrowLeft, Plus, RefreshCw, Receipt, Building2, BarChart3, Search } from 'lucide-react';

import TaxInvoiceStats from '@/components/tax-invoice/TaxInvoiceStats';
import TaxInvoiceList from '@/components/tax-invoice/TaxInvoiceList';
import TaxInvoiceCreateDialog, { InvoiceFormData } from '@/components/tax-invoice/TaxInvoiceCreateDialog';
import TaxInvoiceDetailDialog from '@/components/tax-invoice/TaxInvoiceDetailDialog';
import TaxInvoiceMonthlyChart from '@/components/tax-invoice/TaxInvoiceMonthlyChart';
import CorpStatusCheck from '@/components/CorpStatusCheck';

const emptyForm: InvoiceFormData = {
  writeDate: format(new Date(), 'yyyyMMdd'),
  taxType: 'taxable',
  chargeDirection: 'forward',
  issueType: 'normal',
  purposeType: 'receipt',
  invoiceDirection: 'sales',
  supplierCorpNum: '', supplierCorpName: '', supplierCEOName: '', supplierAddr: '',
  supplierBizType: '', supplierBizClass: '', supplierContactName: '', supplierEmail: '', supplierTel: '', supplierHP: '',
  buyerCorpNum: '', buyerCorpName: '', buyerCEOName: '', buyerAddr: '',
  buyerBizType: '', buyerBizClass: '', buyerContactName: '', buyerEmail: '', buyerTel: '', buyerHP: '',
  supplyCostTotal: 0, taxTotal: 0, totalAmount: 0,
  remark1: '', memo: '',
  recipientId: '', projectId: '', projectName: '', quoteId: '', quoteNumber: '',
  items: [{ serialNum: 1, itemName: '', unitCost: 0, qty: 1, supplyCost: 0, tax: 0, remark: '' }],
};

const TaxInvoicesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const popbill = usePopbillApi();

  const [activeTab, setActiveTab] = useState('sales');
  const [searchMonth, setSearchMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [statusFilter, setStatusFilter] = useState('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [form, setForm] = useState<InvoiceFormData>({ ...emptyForm });
  const [issuing, setIssuing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  /* ── 세금계산서 목록 ── */
  const { data: invoices = [], isLoading, refetch } = useQuery({
    queryKey: ['tax-invoices', searchMonth, statusFilter],
    queryFn: async () => {
      const start = `${searchMonth}-01`;
      const end = format(endOfMonth(new Date(`${searchMonth}-01`)), 'yyyy-MM-dd');
      let q = supabase.from('tax_invoices').select('*')
        .gte('write_date', start).lte('write_date', end)
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 회사정보 ── */
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('company_info').select('*').limit(1).single();
      return data;
    },
  });

  /* ── 수신처 ── */
  const { data: recipients = [] } = useQuery({
    queryKey: ['recipients-for-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('recipients').select('*').order('company_name');
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 프로젝트 ── */
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-for-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name, recipient_id').order('name');
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 견적서 ── */
  const { data: quotes = [] } = useQuery({
    queryKey: ['quotes-for-tax'],
    queryFn: async () => {
      const { data } = await supabase.from('saved_quotes')
        .select('id, quote_number, recipient_company, total, items, subtotal, tax')
        .order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!user,
  });

  /* ── 발행 다이얼로그 열기 ── */
  const openCreate = (direction: 'sales' | 'purchase' = 'sales') => {
    const f = { ...emptyForm, invoiceDirection: direction };
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
    if (profile) f.supplierContactName = profile.full_name;
    setForm(f);
    setCreateOpen(true);
  };

  /* ── 수신처 자동입력 ── */
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
      buyerContactName: r.accounting_contact_person || r.contact_person || '',
      buyerEmail: r.accounting_email || r.email || '',
      buyerTel: r.accounting_phone || r.phone || '',
      recipientId,
    }));
  };

  /* ── 견적서에서 품목 가져오기 ── */
  const fillFromQuote = (quoteId: string) => {
    const q = quotes.find((qt: any) => qt.id === quoteId);
    if (!q) return;
    const quoteItems = Array.isArray(q.items) ? q.items : [];
    const items = quoteItems.map((item: any, idx: number) => ({
      serialNum: idx + 1,
      itemName: item.productName || item.itemName || item.name || '품목',
      unitCost: Number(item.unitPrice || item.unitCost || item.price || 0),
      qty: Number(item.quantity || item.qty || 1),
      supplyCost: Number(item.totalPrice || item.supplyCost || 0),
      tax: Math.round(Number(item.totalPrice || item.supplyCost || 0) * 0.1),
      remark: '',
    }));
    if (items.length === 0) items.push({ serialNum: 1, itemName: '', unitCost: 0, qty: 1, supplyCost: 0, tax: 0, remark: '' });

    const supplyCostTotal = items.reduce((s: number, i: any) => s + i.supplyCost, 0);
    const taxTotal = items.reduce((s: number, i: any) => s + i.tax, 0);

    setForm(prev => ({
      ...prev,
      quoteId,
      quoteNumber: q.quote_number || '',
      items,
      supplyCostTotal,
      taxTotal,
      totalAmount: supplyCostTotal + taxTotal,
    }));
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
          serialNum: i.serialNum, itemName: i.itemName,
          unitCost: String(i.unitCost), qty: String(i.qty),
          supplyCost: String(i.supplyCost), tax: String(i.tax), remark: i.remark,
        })),
      };

      const result = await popbill.registIssue(taxInvoice, form.memo);

      const wd = form.writeDate;
      await supabase.from('tax_invoices').insert({
        user_id: user!.id,
        user_name: profile?.full_name || '',
        invoice_direction: form.invoiceDirection,
        write_date: `${wd.slice(0, 4)}-${wd.slice(4, 6)}-${wd.slice(6, 8)}`,
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
        recipient_id: form.recipientId || null,
        recipient_name: form.buyerCorpName || null,
        project_id: form.projectId || null,
        project_name: form.projectName || null,
        quote_id: form.quoteId || null,
        quote_number: form.quoteNumber || null,
      });

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

  /* ── 엑셀 다운로드 ── */
  const handleExportExcel = (direction: 'sales' | 'purchase') => {
    const filtered = invoices.filter((i: any) => i.invoice_direction === direction || (!i.invoice_direction && direction === 'sales'));
    if (filtered.length === 0) { toast.error('다운로드할 데이터가 없습니다.'); return; }

    const headers = ['작성일자', '상태', direction === 'sales' ? '공급받는자' : '공급자', '사업자번호', '공급가액', '세액', '합계', '프로젝트', '견적번호'];
    const rows = filtered.map((inv: any) => [
      inv.write_date,
      inv.status,
      direction === 'sales' ? inv.buyer_corp_name : inv.supplier_corp_name,
      direction === 'sales' ? inv.buyer_corp_num : inv.supplier_corp_num,
      inv.supply_cost_total || 0,
      inv.tax_total || 0,
      inv.total_amount || 0,
      inv.project_name || '',
      inv.quote_number || '',
    ]);

    const csvContent = '\uFEFF' + [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `세금계산서_${direction === 'sales' ? '매출' : '매입'}_${searchMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 파일이 다운로드되었습니다.');
  };

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

  const currentDirection = activeTab === 'purchase' ? 'purchase' : 'sales';

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
            <p className="text-sm text-muted-foreground">전자세금계산서 발행·조회·관리</p>
          </div>
          <Button onClick={() => openCreate(currentDirection as any)} className="gap-2">
            <Plus className="h-4 w-4" /> 세금계산서 발행
          </Button>
        </div>

        {/* 메인 탭: 매출 / 매입 / 통계 / 사업자조회 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="sales">매출 (발행)</TabsTrigger>
            <TabsTrigger value="purchase">매입 (수취)</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1">
              <BarChart3 className="h-3.5 w-3.5" /> 통계
            </TabsTrigger>
            <TabsTrigger value="corpcheck" className="gap-1">
              <Building2 className="h-3.5 w-3.5" /> 사업자조회
            </TabsTrigger>
          </TabsList>

          {/* 매출 탭 */}
          <TabsContent value="sales">
            <div className="space-y-4">
              <TaxInvoiceStats invoices={invoices} direction="sales" />
              {/* 필터 */}
              <div className="flex flex-wrap gap-3">
                <Input type="month" value={searchMonth} onChange={e => setSearchMonth(e.target.value)} className="w-44" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
              <TaxInvoiceList
                invoices={invoices}
                isLoading={isLoading}
                direction="sales"
                onSelectInvoice={inv => { setSelectedInvoice(inv); setDetailOpen(true); }}
                onSyncStatus={handleSyncStatus}
                onResendEmail={handleResendEmail}
                onExportExcel={() => handleExportExcel('sales')}
              />
            </div>
          </TabsContent>

          {/* 매입 탭 */}
          <TabsContent value="purchase">
            <div className="space-y-4">
              <TaxInvoiceStats invoices={invoices} direction="purchase" />
              <div className="flex flex-wrap gap-3">
                <Input type="month" value={searchMonth} onChange={e => setSearchMonth(e.target.value)} className="w-44" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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
              <TaxInvoiceList
                invoices={invoices}
                isLoading={isLoading}
                direction="purchase"
                onSelectInvoice={inv => { setSelectedInvoice(inv); setDetailOpen(true); }}
                onSyncStatus={handleSyncStatus}
                onResendEmail={handleResendEmail}
                onExportExcel={() => handleExportExcel('purchase')}
              />
            </div>
          </TabsContent>

          {/* 통계 탭 */}
          <TabsContent value="stats">
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <TaxInvoiceMonthlyChart direction="sales" />
                <TaxInvoiceMonthlyChart direction="purchase" />
              </div>
            </div>
          </TabsContent>

          {/* 사업자조회 탭 */}
          <TabsContent value="corpcheck">
            <Card className="p-6 max-w-lg">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                사업자등록상태 조회
              </h3>
              <CorpStatusCheck />
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 발행 다이얼로그 */}
      <TaxInvoiceCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        form={form}
        setForm={setForm}
        recipients={recipients}
        projects={projects}
        quotes={quotes}
        onIssue={handleIssue}
        issuing={issuing}
        onFillBuyer={fillBuyer}
        onFillFromQuote={fillFromQuote}
      />

      {/* 상세 다이얼로그 */}
      <TaxInvoiceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        invoice={selectedInvoice}
        syncing={syncing}
        onSyncStatus={handleSyncStatus}
        onResendEmail={handleResendEmail}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default TaxInvoicesPage;
