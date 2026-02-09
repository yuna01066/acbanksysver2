import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { FileText, Lock, Loader2, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import ProfileInfoCard from '@/components/ProfileInfoCard';
import EmployeeDocumentsPanel from '@/components/employee/EmployeeDocumentsPanel';
import MyContractsList from '@/components/contract/MyContractsList';

const MyPageHRSection: React.FC = () => {
  const { user, profile } = useAuth();
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
      <TabsList className="grid w-full grid-cols-4 max-w-2xl">
        <TabsTrigger value="profile">프로필</TabsTrigger>
        <TabsTrigger value="contracts" className="gap-1">
          <PenLine className="h-3.5 w-3.5" />계약서
        </TabsTrigger>
        <TabsTrigger value="documents">문서함</TabsTrigger>
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
