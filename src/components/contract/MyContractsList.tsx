import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { FileText, CheckCircle2, XCircle, Loader2, Clock, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import ContractPreviewDialog from './ContractPreviewDialog';
import type { EmploymentContract } from '@/hooks/useContracts';

const CONTRACT_TYPES: Record<string, string> = {
  regular: '정규직',
  fixed_term: '기간제',
  part_time: '파트타임',
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  draft: { label: '임시저장', icon: <Clock className="h-3.5 w-3.5" />, className: 'bg-muted text-muted-foreground' },
  requested: { label: '서명 대기', icon: <PenLine className="h-3.5 w-3.5" />, className: 'bg-primary/10 text-primary' },
  signed: { label: '서명 완료', icon: <CheckCircle2 className="h-3.5 w-3.5" />, className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '거절됨', icon: <XCircle className="h-3.5 w-3.5" />, className: 'bg-destructive/10 text-destructive' },
};

const MyContractsList: React.FC = () => {
  const { user, profile } = useAuth();
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewContract, setPreviewContract] = useState<EmploymentContract | null>(null);
  const [signingContract, setSigningContract] = useState<EmploymentContract | null>(null);
  const [rejectingContract, setRejectingContract] = useState<EmploymentContract | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchMyContracts = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('employment_contracts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setContracts(data as EmploymentContract[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchMyContracts();
  }, [user]);

  const handleSign = async () => {
    if (!signingContract || !user) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('employment_contracts')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
        })
        .eq('id', signingContract.id)
        .eq('user_id', user.id);
      if (error) throw error;

      // Send notification to the requester
      if (signingContract.requested_by) {
        await supabase.from('notifications').insert({
          user_id: signingContract.requested_by,
          type: 'system',
          title: '계약서 서명 완료',
          description: `${profile?.full_name || user.email}님이 근로계약서에 서명했습니다.`,
          data: { contract_id: signingContract.id },
        });
      }

      toast.success('계약서에 서명했습니다.');
      setSigningContract(null);
      fetchMyContracts();
    } catch (e: any) {
      toast.error('서명 실패: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!rejectingContract || !user) return;
    setProcessing(true);
    try {
      const { error } = await supabase
        .from('employment_contracts')
        .update({
          status: 'rejected',
          notes: rejectReason || '거절됨',
        })
        .eq('id', rejectingContract.id)
        .eq('user_id', user.id);
      if (error) throw error;

      // Notify the requester
      if (rejectingContract.requested_by) {
        await supabase.from('notifications').insert({
          user_id: rejectingContract.requested_by,
          type: 'system',
          title: '계약서 거절',
          description: `${profile?.full_name || user.email}님이 근로계약서를 거절했습니다.${rejectReason ? ` 사유: ${rejectReason}` : ''}`,
          data: { contract_id: rejectingContract.id },
        });
      }

      toast.success('계약서를 거절했습니다.');
      setRejectingContract(null);
      setRejectReason('');
      fetchMyContracts();
    } catch (e: any) {
      toast.error('거절 실패: ' + e.message);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  const pendingContracts = contracts.filter(c => c.status === 'requested');
  const otherContracts = contracts.filter(c => c.status !== 'requested');

  return (
    <div className="space-y-6">
      {/* Pending contracts requiring action */}
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
                      <p className="font-medium">{CONTRACT_TYPES[contract.contract_type] || contract.contract_type} 근로계약서</p>
                      <p className="text-sm text-muted-foreground">
                        계약기간: {contract.contract_start_date || '-'} ~ {contract.contract_end_date || '무기한'}
                        {contract.annual_salary && ` · 연봉 ${contract.annual_salary.toLocaleString()}원`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button variant="outline" size="sm" onClick={() => setPreviewContract(contract)}>
                        검토
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectingContract(contract)}
                      >
                        거절
                      </Button>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => setSigningContract(contract)}
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

      {/* All contracts history */}
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
                    <p className="font-medium text-sm">{CONTRACT_TYPES[contract.contract_type] || contract.contract_type} 근로계약서</p>
                    <p className="text-xs text-muted-foreground">
                      {contract.contract_start_date || '-'} ~ {contract.contract_end_date || '무기한'}
                      {contract.signed_at && ` · 서명일: ${format(new Date(contract.signed_at), 'yyyy.MM.dd')}`}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPreviewContract(contract)}>
                    보기
                  </Button>
                </div>
              );
            })}
          </CardContent>
        )}
      </Card>

      {/* Contract Preview */}
      <ContractPreviewDialog
        open={!!previewContract}
        onOpenChange={open => { if (!open) setPreviewContract(null); }}
        contract={previewContract}
      />

      {/* Sign confirmation */}
      <AlertDialog open={!!signingContract} onOpenChange={() => setSigningContract(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계약서에 서명하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              서명하면 계약 내용에 동의하는 것으로 간주됩니다. 서명 전에 계약서를 충분히 검토해주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSign}
              disabled={processing}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              서명하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject dialog */}
      <AlertDialog open={!!rejectingContract} onOpenChange={() => { setRejectingContract(null); setRejectReason(''); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계약서를 거절하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>거절 사유를 입력해주세요 (선택사항).</AlertDialogDescription>
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
              disabled={processing}
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
