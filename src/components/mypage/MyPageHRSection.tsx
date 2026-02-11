import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileText, Lock, Loader2, PenLine, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import ProfileInfoCard from '@/components/ProfileInfoCard';
import EmployeeDocumentsPanel from '@/components/employee/EmployeeDocumentsPanel';
import MyContractsList from '@/components/contract/MyContractsList';
import { useYearEndTax, TAX_YEAR, STATUS_LABELS } from '@/hooks/useYearEndTax';
import TaxDependentsTab from '@/components/year-end-tax/TaxDependentsTab';
import TaxDeductionsTab from '@/components/year-end-tax/TaxDeductionsTab';
import TaxDocumentsTab from '@/components/year-end-tax/TaxDocumentsTab';
import TaxSummaryTab from '@/components/year-end-tax/TaxSummaryTab';
import { Badge } from '@/components/ui/badge';

const MyPageHRSection: React.FC = () => {
  const { user, profile } = useAuth();
  const tax = useYearEndTax(TAX_YEAR);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('새 비밀번호는 최소 6자 이상이어야 합니다.'); return; }
    if (newPassword !== confirmPassword) { toast.error('새 비밀번호가 일치하지 않습니다.'); return; }
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile?.email || '',
        password: currentPassword,
      });
      if (signInError) { toast.error('현재 비밀번호가 올바르지 않습니다.'); setChangingPassword(false); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) toast.error('비밀번호 변경에 실패했습니다: ' + updateError.message);
      else {
        toast.success('비밀번호가 성공적으로 변경되었습니다.');
        setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      }
    } catch { toast.error('비밀번호 변경 중 오류가 발생했습니다.'); }
    finally { setChangingPassword(false); }
  };

  return (
    <Tabs defaultValue="profile" className="space-y-6">
      <TabsList className="grid w-full grid-cols-5 max-w-2xl">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="contracts" className="gap-1">
          <PenLine className="h-3.5 w-3.5" />계약서
        </TabsTrigger>
        <TabsTrigger value="documents">문서함</TabsTrigger>
        <TabsTrigger value="tax" className="gap-1">
          <Receipt className="h-3.5 w-3.5" />연말정산
        </TabsTrigger>
        <TabsTrigger value="password">비밀번호</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="space-y-4">
        <ProfileInfoCard />
      </TabsContent>

      <TabsContent value="contracts" className="space-y-4">
        <MyContractsList />
      </TabsContent>

      <TabsContent value="documents" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" />내 문서함</CardTitle>
            <CardDescription>요청된 서류를 업로드하고 관리하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            {user && <EmployeeDocumentsPanel userId={user.id} />}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="tax" className="space-y-4">
        {tax.loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !tax.settlement ? (
          <Card>
            <CardHeader className="text-center">
              <CardTitle>{TAX_YEAR}년 귀속 연말정산</CardTitle>
              <CardDescription>연말정산 자료 입력을 시작하세요.</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => tax.initSettlement()} size="lg">
                <FileText className="mr-2 h-5 w-5" />
                연말정산 시작하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{TAX_YEAR}년 귀속 연말정산</h3>
              <Badge className={STATUS_LABELS[tax.settlement.status || 'not_started']?.color}>
                {STATUS_LABELS[tax.settlement.status || 'not_started']?.label}
              </Badge>
            </div>

            {tax.settlement.status === 'revision_requested' && tax.settlement.review_comment && (
              <Card className="border-orange-300 bg-orange-50">
                <CardContent className="py-3">
                  <p className="text-sm font-medium text-orange-800">📋 관리자 수정 요청</p>
                  <p className="text-sm text-orange-700 mt-1">{tax.settlement.review_comment}</p>
                </CardContent>
              </Card>
            )}

            <Tabs defaultValue="dependents" className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="dependents" className="text-xs sm:text-sm">부양가족</TabsTrigger>
                <TabsTrigger value="deductions" className="text-xs sm:text-sm">공제자료</TabsTrigger>
                <TabsTrigger value="documents" className="text-xs sm:text-sm">서류제출</TabsTrigger>
                <TabsTrigger value="summary" className="text-xs sm:text-sm">확인/제출</TabsTrigger>
              </TabsList>
              <TabsContent value="dependents">
                <TaxDependentsTab settlement={tax.settlement} dependents={tax.dependents} onAdd={tax.addDependent} onUpdate={tax.updateDependent} onDelete={tax.deleteDependent} isEditable={!tax.settlement || ['not_started','in_progress','revision_requested'].includes(tax.settlement.status)} />
              </TabsContent>
              <TabsContent value="deductions">
                <TaxDeductionsTab settlement={tax.settlement} deductionItems={tax.deductionItems} dependents={tax.dependents} onAdd={tax.addDeductionItem} onUpdate={tax.updateDeductionItem} onDelete={tax.deleteDeductionItem} isEditable={!tax.settlement || ['not_started','in_progress','revision_requested'].includes(tax.settlement.status)} />
              </TabsContent>
              <TabsContent value="documents">
                <TaxDocumentsTab settlement={tax.settlement} documents={tax.documents} onUpload={tax.uploadDocument} onDelete={tax.deleteDocument} isEditable={!tax.settlement || ['not_started','in_progress','revision_requested'].includes(tax.settlement.status)} />
              </TabsContent>
              <TabsContent value="summary">
                <TaxSummaryTab settlement={tax.settlement} dependents={tax.dependents} deductionItems={tax.deductionItems} documents={tax.documents} onUpdateSettlement={tax.updateSettlement} onSubmit={tax.submitSettlement} isEditable={!tax.settlement || ['not_started','in_progress','revision_requested'].includes(tax.settlement.status)} />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </TabsContent>

      <TabsContent value="password" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />비밀번호 변경</CardTitle>
            <CardDescription>비밀번호를 변경하려면 현재 비밀번호를 확인한 후 새 비밀번호를 입력하세요.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">현재 비밀번호</Label>
                <Input id="currentPassword" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required placeholder="현재 비밀번호 입력" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">새 비밀번호</Label>
                <Input id="newPassword" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} placeholder="새 비밀번호 (최소 6자)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={6} placeholder="새 비밀번호 다시 입력" />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">비밀번호가 일치하지 않습니다.</p>
                )}
              </div>
              <Button type="submit" variant="outline" className="w-full" disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}>
                {changingPassword ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />변경 중...</> : '비밀번호 변경'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default MyPageHRSection;
