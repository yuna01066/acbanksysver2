import React, { useMemo, useState } from 'react';
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
import { Plus, RefreshCw, Receipt, Building2, BarChart3, AlertTriangle } from 'lucide-react';

import TaxInvoiceStats from '@/components/tax-invoice/TaxInvoiceStats';
import TaxInvoiceList from '@/components/tax-invoice/TaxInvoiceList';
import TaxInvoiceCreateDialog, { InvoiceFormData } from '@/components/tax-invoice/TaxInvoiceCreateDialog';
import TaxInvoiceDetailDialog from '@/components/tax-invoice/TaxInvoiceDetailDialog';
import TaxInvoiceMonthlyChart from '@/components/tax-invoice/TaxInvoiceMonthlyChart';
import CorpStatusCheck from '@/components/CorpStatusCheck';
import {
  TaxInvoiceSyncRequiredError,
  createPopbillMgtKey,
  isKnownPopbillStateCode,
  mapPopbillStateCode,
  mergeTaxInvoiceRows,
  requiresTaxInvoiceSync,
  runTrackedTaxInvoiceCancellation,
  runTrackedTaxInvoiceIssue,
} from '@/services/taxInvoiceReliability';

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
  const [cancellingInvoiceId, setCancellingInvoiceId] = useState<string | null>(null);

  /* ── 세금계산서 목록 ── */
  const {
    data: filteredInvoices = [],
    isLoading: isFilteredInvoicesLoading,
    refetch: refetchInvoices,
  } = useQuery({
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

  /* ── 필터와 무관한 미해결 팝빌 작업 ── */
  const {
    data: unresolvedOperations = [],
    isLoading: isUnresolvedOperationsLoading,
    isSuccess: unresolvedOperationsReady,
    isError: unresolvedOperationsFailed,
    refetch: refetchUnresolvedOperations,
  } = useQuery({
    queryKey: ['tax-invoice-unresolved-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tax_invoices')
        .select('*')
        .in('sync_status', ['pending', 'required'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const invoices = useMemo(
    () => mergeTaxInvoiceRows(filteredInvoices, unresolvedOperations),
    [filteredInvoices, unresolvedOperations],
  );
  const hasUnresolvedOperations = unresolvedOperations.length > 0;
  const canStartIssue = unresolvedOperationsReady && !hasUnresolvedOperations;
  const isLoading = isFilteredInvoicesLoading || isUnresolvedOperationsLoading;

  const refetchTaxInvoiceQueries = async () => {
    await Promise.all([refetchInvoices(), refetchUnresolvedOperations()]);
  };

  /* ── 회사정보 ── */
  const { data: companyInfo } = useQuery({
    queryKey: ['company-info-tax'],
    queryFn: async () => {
      const { data } = await (supabase.from('company_public_info' as any) as any).select('*').limit(1).single();
      return data as any;
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
  const openCreate = () => {
    if (!canStartIssue) {
      toast.error('미해결 팝빌 작업을 먼저 상태 동기화해주세요.');
      return;
    }
    const f: InvoiceFormData = {
      ...emptyForm,
      invoiceDirection: 'sales',
      issueType: 'normal',
    };
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
    if (form.invoiceDirection !== 'sales' || form.issueType !== 'normal') {
      toast.error('이번 릴리스에서는 매출 정발행만 지원합니다.');
      return;
    }
    if (!canStartIssue) {
      toast.error('미해결 팝빌 작업을 먼저 상태 동기화해주세요.');
      return;
    }
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
      const mgtKey = createPopbillMgtKey();
      const taxInvoice = {
        writeDate: form.writeDate,
        chargeDirection: form.chargeDirection === 'forward' ? '정과금' : '역과금',
        issueType: '정발행',
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
      const wd = form.writeDate;
      const trackingRecord = {
        user_id: user!.id,
        user_name: profile?.full_name || '',
        invoice_direction: 'sales',
        write_date: `${wd.slice(0, 4)}-${wd.slice(4, 6)}-${wd.slice(6, 8)}`,
        tax_type: form.taxType,
        charge_direction: form.chargeDirection,
        issue_type: 'normal',
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
        status: 'draft',
        sync_status: 'pending',
        pending_operation: 'issue',
        sync_error: null,
        recipient_id: form.recipientId || null,
        recipient_name: form.buyerCorpName || null,
        project_id: form.projectId || null,
        project_name: form.projectName || null,
        quote_id: form.quoteId || null,
        quote_number: form.quoteNumber || null,
      };
      let trackingId: string | null = null;

      await runTrackedTaxInvoiceIssue({
        managementKey: mgtKey,
        createTrackingRecord: async () => {
          const { data, error } = await supabase
            .from('tax_invoices')
            .insert(trackingRecord)
            .select('id')
            .single();
          if (error) throw new Error(`내부 발행 추적 준비 실패: ${error.message}`);
          trackingId = data.id;
          return data;
        },
        issueExternal: () => popbill.registIssue(taxInvoice, form.memo),
        markIssued: async (result) => {
          if (!trackingId) throw new Error('내부 발행 추적번호가 없습니다.');
          const { error } = await supabase
            .from('tax_invoices')
            .update({
              popbill_issue_id: result?.ntsConfirmNum || null,
              popbill_nts_confirm_num: result?.ntsConfirmNum || null,
              status: 'issued',
              sync_status: 'synced',
              pending_operation: null,
              sync_error: null,
              external_action_at: new Date().toISOString(),
            })
            .eq('id', trackingId)
            .eq('popbill_mgt_key', mgtKey)
            .select('id')
            .single();
          if (error) throw new Error(`내부 발행 상태 저장 실패: ${error.message}`);
        },
        markSyncRequired: async (message, externalSucceeded) => {
          if (!trackingId) return;
          const { error } = await supabase
            .from('tax_invoices')
            .update({
              sync_status: 'required',
              pending_operation: 'issue',
              sync_error: message,
              external_action_at: externalSucceeded ? new Date().toISOString() : null,
            })
            .eq('id', trackingId)
            .select('id')
            .single();
          if (error) throw new Error(`복구 상태 기록 실패: ${error.message}`);
        },
      });

      toast.success('세금계산서가 발행되었습니다.');
      setCreateOpen(false);
      await refetchTaxInvoiceQueries();
    } catch (error: unknown) {
      if (error instanceof TaxInvoiceSyncRequiredError) {
        setCreateOpen(false);
        toast.error(`${error.message} 재발행하지 말고 목록의 상태 동기화를 실행하세요.`, {
          duration: 12000,
        });
        await refetchTaxInvoiceQueries();
      } else {
        const message = error instanceof Error ? error.message : '알 수 없는 오류';
        toast.error(`발행 준비 실패: ${message}`);
      }
    } finally {
      setIssuing(false);
    }
  };

  /* ── 발행취소 ── */
  const handleCancel = async (inv: any) => {
    if (!inv.popbill_mgt_key) { toast.error('관리번호가 없습니다.'); return; }
    if (requiresTaxInvoiceSync(inv.sync_status)) {
      toast.error('먼저 상태 동기화를 완료해주세요.');
      return;
    }
    if (!confirm('이 세금계산서를 발행 취소하시겠습니까?')) return;
    setCancellingInvoiceId(inv.id);
    try {
      await runTrackedTaxInvoiceCancellation({
        managementKey: inv.popbill_mgt_key,
        markCancellationPending: async () => {
          const { error } = await supabase
            .from('tax_invoices')
            .update({
              sync_status: 'pending',
              pending_operation: 'cancel',
              sync_error: null,
            })
            .eq('id', inv.id)
            .eq('sync_status', 'synced')
            .select('id')
            .single();
          if (error) throw new Error(`취소 추적 준비 실패: ${error.message}`);
        },
        cancelExternal: () => popbill.cancelIssue('SELL', inv.popbill_mgt_key, '발행취소'),
        markCancelled: async () => {
          const { error } = await supabase
            .from('tax_invoices')
            .update({
              status: 'cancelled',
              sync_status: 'synced',
              pending_operation: null,
              sync_error: null,
              external_action_at: new Date().toISOString(),
            })
            .eq('id', inv.id)
            .eq('popbill_mgt_key', inv.popbill_mgt_key)
            .select('id')
            .single();
          if (error) throw new Error(`내부 취소 상태 저장 실패: ${error.message}`);
        },
        markSyncRequired: async (message, externalSucceeded) => {
          const { error } = await supabase
            .from('tax_invoices')
            .update({
              sync_status: 'required',
              pending_operation: 'cancel',
              sync_error: message,
              external_action_at: externalSucceeded ? new Date().toISOString() : inv.external_action_at,
            })
            .eq('id', inv.id)
            .select('id')
            .single();
          if (error) throw new Error(`복구 상태 기록 실패: ${error.message}`);
        },
      });
      toast.success('발행이 취소되었습니다.');
      await refetchTaxInvoiceQueries();
      setDetailOpen(false);
    } catch (error: unknown) {
      if (error instanceof TaxInvoiceSyncRequiredError) {
        setDetailOpen(false);
        toast.error(`${error.message} 재취소하지 말고 상태 동기화를 실행하세요.`, {
          duration: 12000,
        });
        await refetchTaxInvoiceQueries();
      } else {
        const message = error instanceof Error ? error.message : '알 수 없는 오류';
        toast.error(`취소 준비 실패: ${message}`);
      }
    } finally {
      setCancellingInvoiceId(null);
    }
  };

  /* ── 상태 동기화 ── */
  const handleSyncStatus = async (inv: any) => {
    if (!inv.popbill_mgt_key) { toast.error('관리번호가 없습니다.'); return; }
    setSyncing(true);
    try {
      const info = await popbill.getInfo('SELL', inv.popbill_mgt_key);
      const stateCode = String(info?.stateCode || '');
      if (!isKnownPopbillStateCode(stateCode)) {
        throw new Error(`확인할 수 없는 팝빌 상태코드입니다: ${stateCode || '없음'}`);
      }
      const newStatus = mapPopbillStateCode(stateCode, inv.status);
      const { data, error } = await supabase.from('tax_invoices').update({
          status: newStatus,
          popbill_state_code: stateCode,
          popbill_state_dt: info?.stateDT || null,
          popbill_nts_confirm_num: info?.ntsconfirmNum || inv.popbill_nts_confirm_num,
          sync_status: 'synced',
          pending_operation: null,
          sync_error: null,
        })
        .eq('id', inv.id)
        .select('*')
        .single();
      if (error) throw new Error(`팝빌 조회 후 내부 저장 실패: ${error.message}`);
      setSelectedInvoice(data);
      toast.success('상태가 동기화되었습니다.');
      await refetchTaxInvoiceQueries();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류';
      toast.error(`동기화 실패: ${message}`);
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
    const filtered = filteredInvoices.filter((i: any) => i.invoice_direction === direction || (!i.invoice_direction && direction === 'sales'));
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Receipt className="h-6 w-6 text-primary" />
              세금계산서 관리
            </h1>
            <p className="text-sm text-muted-foreground">전자세금계산서 발행·조회·관리</p>
          </div>
          {activeTab === 'sales' && (
            <Button
              onClick={openCreate}
              className="gap-2"
              disabled={!canStartIssue}
              title={canStartIssue ? '매출 세금계산서 정발행' : '미해결 팝빌 작업을 먼저 동기화해주세요.'}
            >
              <Plus className="h-4 w-4" /> 매출 세금계산서 발행
            </Button>
          )}
        </div>

        {(!unresolvedOperationsReady || hasUnresolvedOperations) && (
          <Card className="mb-4 border-amber-300 bg-amber-50/80 p-4 text-amber-950">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-1">
                <p className="font-semibold">신규 발행 전 팝빌 상태 확인이 필요합니다.</p>
                <p className="text-sm leading-relaxed">
                  {isUnresolvedOperationsLoading
                    ? '전체 기간의 미해결 작업을 확인하고 있습니다.'
                    : unresolvedOperationsFailed
                      ? '미해결 작업 조회에 실패해 안전을 위해 신규 발행을 차단했습니다. 새로고침 후 다시 확인해주세요.'
                      : `미해결 작업 ${unresolvedOperations.length}건이 있습니다. 기간·상태 필터와 관계없이 아래 매출/매입 목록에 표시되며, 각 행의 상태 동기화를 먼저 실행해주세요.`}
                </p>
              </div>
            </div>
          </Card>
        )}

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
              <TaxInvoiceStats invoices={filteredInvoices} direction="sales" />
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
                <Button variant="outline" size="icon" onClick={() => void refetchTaxInvoiceQueries()}>
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
              <Card className="border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-950">
                매입 세금계산서는 팝빌 수취 내역 조회 전용입니다. 이번 릴리스에서는 신규 매입 발행을 지원하지 않습니다.
              </Card>
              <TaxInvoiceStats invoices={filteredInvoices} direction="purchase" />
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
                <Button variant="outline" size="icon" onClick={() => void refetchTaxInvoiceQueries()}>
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
        cancelling={cancellingInvoiceId === selectedInvoice?.id}
        onSyncStatus={handleSyncStatus}
        onResendEmail={handleResendEmail}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default TaxInvoicesPage;
