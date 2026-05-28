import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { FileText, CheckCircle2, XCircle, Loader2, Clock, PenLine, Download, ShieldCheck, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ContractPreviewDialog from './ContractPreviewDialog';
import SignaturePad from './SignaturePad';
import type { EmploymentContract } from '@/hooks/useContracts';
import { createContractPdfBlob } from '@/utils/contractPdf';
import { contractSignaturePlaceholder, injectCompanySealIntoRenderedHtml, injectSignatureIntoRenderedHtml } from '@/utils/contractRenderer';
import { getDownloadUrl } from '@/services/documentFiles';

const CONTRACT_TYPES: Record<string, string> = {
  regular: '정규직',
  fixed_term: '기간제',
  part_time: '파트타임',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft: { label: '임시저장', icon: <Clock className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' },
  requested: { label: '서명 대기', icon: <PenLine className="h-3.5 w-3.5" />, className: 'bg-primary/10 text-primary' },
  opened: { label: '검토 완료', icon: <Eye className="h-3.5 w-3.5" />, className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  signed: { label: '서명 완료', icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '거절됨', icon: <XCircle className="h-3.5 w-3.5" />, className: 'bg-destructive/10 text-destructive' },
};

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
);

function dataUrlToBlob(dataUrl: string) {
  const [meta, base64] = dataUrl.split(',');
  const mime = meta.match(/data:(.*);base64/)?.[1] || 'application/octet-stream';
  const binary = atob(base64 || '');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadContractFile(path: string, blob: Blob, contentType: string) {
  const { error } = await supabase.storage
    .from('employee-contracts')
    .upload(path, blob, { upsert: false, contentType });
  if (error) throw error;
}

const MyContractsList: React.FC = () => {
  const { user, session, profile } = useAuth();
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewContract, setPreviewContract] = useState<EmploymentContract | null>(null);
  const [signingContract, setSigningContract] = useState<EmploymentContract | null>(null);
  const [rejectingContract, setRejectingContract] = useState<EmploymentContract | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [signaturePreviewConfirmed, setSignaturePreviewConfirmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const openedEventsRef = useRef<Set<string>>(new Set());

  const fetchMyContracts = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('employment_contracts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setContracts(data as EmploymentContract[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchMyContracts();
  }, [fetchMyContracts]);

  const invokeAction = async (body: Record<string, unknown>, token = session?.access_token) => {
    const { data, error } = await supabase.functions.invoke('contract-actions', {
      body,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (error || data?.error) throw new Error(error?.message || data?.error || '계약 처리에 실패했습니다.');
    return data;
  };

  const handlePreview = async (contract: EmploymentContract) => {
    setPreviewContract(contract);
    if (contract.status !== 'requested' || openedEventsRef.current.has(contract.id)) return;
    openedEventsRef.current.add(contract.id);
    try {
      await invokeAction({ action: 'opened', contractId: contract.id });
      setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, status: c.status === 'requested' ? 'opened' : c.status, opened_at: c.opened_at || new Date().toISOString() } : c));
    } catch {
      // Opening the preview should not block reading the contract.
    }
  };

  const resetSignForm = () => {
    setConfirmName('');
    setPassword('');
    setAgreed(false);
    setSignatureDataUrl(null);
    setSignaturePreviewConfirmed(false);
  };

  const handleSignatureChange = (dataUrl: string | null) => {
    setSignatureDataUrl(dataUrl);
    setSignaturePreviewConfirmed(false);
  };

  const handleSign = async () => {
    if (!signingContract || !user || !profile) return;
    if (!signingContract.opened_at && signingContract.status !== 'opened') {
      toast.error('계약서를 먼저 검토한 뒤 서명할 수 있습니다.');
      return;
    }
    if (!agreed) { toast.error('계약 내용 확인 및 전자서명 동의가 필요합니다.'); return; }
    if (confirmName.trim() !== (profile.full_name || '').trim()) {
      toast.error('성명이 프로필 이름과 일치하지 않습니다.');
      return;
    }
    if (!signatureDataUrl) { toast.error('손서명을 입력해주세요.'); return; }
    if (!signaturePreviewConfirmed) { toast.error('서명 미리보기를 확인해주세요.'); return; }
    if (!password) { toast.error('비밀번호를 입력해주세요.'); return; }

    setProcessing(true);
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password,
      });
      if (signInError) {
        toast.error('비밀번호가 올바르지 않습니다.');
        setProcessing(false);
        return;
      }

      const timestamp = Date.now();
      const basePath = `${user.id}/${signingContract.id}`;
      const signaturePath = `${basePath}/signature-${timestamp}.png`;
      const pdfPath = `${basePath}/contract-${timestamp}.pdf`;

      await uploadContractFile(signaturePath, dataUrlToBlob(signatureDataUrl), 'image/png');

      const companySealUrl = signingContract.company_seal_storage_path
        ? await getDownloadUrl({
          storageProvider: 'supabase_storage',
          storageBucket: 'employee-contracts',
          storagePath: signingContract.company_seal_storage_path,
        }).catch(() => null)
        : null;
      const sealedHtml = injectCompanySealIntoRenderedHtml(
        signingContract.rendered_html || `<article class="contract-document"><h1>전자계약서</h1><p>${signingContract.user_name}님의 계약서입니다.</p><p>${contractSignaturePlaceholder()}</p></article>`,
        companySealUrl,
      );
      const signedHtml = injectSignatureIntoRenderedHtml(sealedHtml, signatureDataUrl);
      const pdfBlob = await createContractPdfBlob(signedHtml);
      await uploadContractFile(pdfPath, pdfBlob, 'application/pdf');

      await invokeAction({
        action: 'signed',
        contractId: signingContract.id,
        signedByName: confirmName.trim(),
        signatureStoragePath: signaturePath,
        signedPdfStoragePath: pdfPath,
      }, signInData.session?.access_token || session?.access_token);

      toast.success('계약서에 서명했습니다.');
      setSigningContract(null);
      resetSignForm();
      await fetchMyContracts();
    } catch (error: unknown) {
      toast.error('서명 실패: ' + getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingContract || !user) return;
    if (rejectReason.trim().length < 5) {
      toast.error('거절 사유를 5자 이상 입력해주세요.');
      return;
    }
    setProcessing(true);
    try {
      await invokeAction({
        action: 'rejected',
        contractId: rejectingContract.id,
        reason: rejectReason,
      });
      toast.success('계약서를 거절했습니다.');
      setRejectingContract(null);
      setRejectReason('');
      await fetchMyContracts();
    } catch (error: unknown) {
      toast.error('거절 실패: ' + getErrorMessage(error));
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = async (contract: EmploymentContract) => {
    if (!contract.signed_pdf_storage_path) return;
    try {
      const url = await getDownloadUrl({
        storageProvider: 'supabase_storage',
        storageBucket: 'employee-contracts',
        storagePath: contract.signed_pdf_storage_path,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
      await invokeAction({ action: 'downloaded', contractId: contract.id });
    } catch (error: unknown) {
      toast.error('PDF 열기 실패: ' + getErrorMessage(error));
    }
  };

  const pendingContracts = useMemo(() => contracts.filter(c => ['requested', 'opened'].includes(c.status)), [contracts]);
  const otherContracts = useMemo(() => contracts.filter(c => !['requested', 'opened'].includes(c.status)), [contracts]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {pendingContracts.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-primary">
              <PenLine className="h-5 w-5" />
              서명 대기 중인 계약서
            </CardTitle>
            <CardDescription>{pendingContracts.length}건의 계약서가 서명을 기다리고 있습니다.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingContracts.map(contract => (
              <Card key={contract.id} className="border-primary/20 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge className="text-xs bg-primary/10 text-primary border-0 gap-1">
                          <PenLine className="h-3 w-3" />서명 대기
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(contract.created_at), 'yyyy.MM.dd', { locale: ko })}
                        </span>
                      </div>
                      <p className="font-medium">
                        {contract.template_snapshot?.name || `${CONTRACT_TYPES[contract.contract_type] || contract.contract_type} 계약서`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        계약기간: {contract.contract_start_date || '-'} ~ {contract.contract_end_date || '무기한'}
                        {contract.annual_salary && ` · 연봉 ${contract.annual_salary.toLocaleString()}원`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handlePreview(contract)}>
                        검토
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => setRejectingContract(contract)}>
                        거절
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        disabled={!contract.opened_at && contract.status !== 'opened'}
                        onClick={() => { setSigningContract(contract); resetSignForm(); }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        서명
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            내 계약서
          </CardTitle>
          <CardDescription>
            {contracts.length === 0 ? '아직 계약서가 없습니다.' : `총 ${contracts.length}건의 계약서`}
          </CardDescription>
        </CardHeader>
        {otherContracts.length > 0 && (
          <CardContent className="space-y-3">
            {otherContracts.map(contract => {
              const statusConfig = STATUS_CONFIG[contract.status] || STATUS_CONFIG.draft;
              return (
                <div key={contract.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={`text-xs border-0 gap-1 ${statusConfig.className}`}>
                        {statusConfig.icon}
                        {statusConfig.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(contract.created_at), 'yyyy.MM.dd', { locale: ko })}
                      </span>
                    </div>
                    <p className="font-medium text-sm">
                      {contract.template_snapshot?.name || `${CONTRACT_TYPES[contract.contract_type] || contract.contract_type} 계약서`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {contract.contract_start_date || '-'} ~ {contract.contract_end_date || '무기한'}
                      {contract.signed_at && ` · 서명일: ${format(new Date(contract.signed_at), 'yyyy.MM.dd')}`}
                      {contract.rejected_reason && ` · 거절 사유: ${contract.rejected_reason}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(contract)}>
                      보기
                    </Button>
                    {contract.signed_pdf_storage_path && (
                      <Button variant="outline" size="sm" className="gap-1" onClick={() => handleDownload(contract)}>
                        <Download className="h-3.5 w-3.5" />
                        PDF
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      <ContractPreviewDialog
        open={!!previewContract}
        onOpenChange={open => { if (!open) setPreviewContract(null); }}
        contract={previewContract}
      />

      <Dialog open={!!signingContract} onOpenChange={(open) => { if (!open) { setSigningContract(null); resetSignForm(); } }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              전자서명 확인
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {signingContract && (
              <div className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <p><span className="font-medium text-foreground">문서명</span> {signingContract.template_snapshot?.name || `${CONTRACT_TYPES[signingContract.contract_type] || signingContract.contract_type} 계약서`}</p>
                  <p><span className="font-medium text-foreground">발송일</span> {signingContract.requested_at ? format(new Date(signingContract.requested_at), 'yyyy.MM.dd') : '-'}</p>
                  <p><span className="font-medium text-foreground">계약기간</span> {signingContract.contract_start_date || '-'} ~ {signingContract.contract_end_date || '무기한'}</p>
                  <p><span className="font-medium text-foreground">회사 직인</span> {signingContract.company_seal_included ? '포함' : '미포함'}</p>
                </div>
              </div>
            )}
            <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
              서명하면 최종 PDF가 생성되어 보관되며, 서명 시각·IP·브라우저 정보가 감사기록에 저장됩니다.
            </div>
            <div className="flex items-start gap-2">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(Boolean(v))} id="contract-agree" />
              <Label htmlFor="contract-agree" className="text-sm leading-relaxed">
                계약서를 충분히 검토했으며 전자서명으로 계약 의사를 표시하는 데 동의합니다.
              </Label>
            </div>
            <div className="space-y-1.5">
              <Label>성명 재입력</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={profile?.full_name || '성명'} />
            </div>
            <div className="space-y-1.5">
              <Label>비밀번호 재확인</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="현재 비밀번호" />
            </div>
            <div className="space-y-1.5">
              <Label>손서명</Label>
              <SignaturePad onChange={handleSignatureChange} />
            </div>
            {signatureDataUrl && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-foreground">서명 미리보기</p>
                    <p className="text-xs text-muted-foreground">이 이미지가 계약서 서명란에 삽입됩니다.</p>
                  </div>
                  <div className="flex h-16 items-center justify-center rounded-md border bg-white px-4 sm:w-48">
                    <img src={signatureDataUrl} alt="입력한 손서명 미리보기" className="max-h-12 max-w-full object-contain" />
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={signaturePreviewConfirmed}
                    onCheckedChange={(v) => setSignaturePreviewConfirmed(Boolean(v))}
                    id="contract-signature-preview-confirm"
                  />
                  <Label htmlFor="contract-signature-preview-confirm" className="text-sm leading-relaxed">
                    미리보기와 같이 서명이 계약서에 삽입되는 것을 확인합니다.
                  </Label>
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setSigningContract(null); resetSignForm(); }} disabled={processing}>
                취소
              </Button>
              <Button onClick={handleSign} disabled={processing} className="bg-green-600 hover:bg-green-700 text-white">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                서명 완료
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!rejectingContract} onOpenChange={() => { setRejectingContract(null); setRejectReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계약서를 거절하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>거절 사유를 입력해주세요.</AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="거절 사유를 입력하세요..."
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReject}
              disabled={processing || rejectReason.trim().length < 5}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              거절하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyContractsList;
