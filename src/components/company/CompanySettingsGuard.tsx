import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Building2, Loader2, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  COMPANY_MASTER_EMAIL,
  COMPANY_SETTINGS_REAUTH_TTL_MS,
  companySettingsReauthKey,
  isCompanyMasterEmail,
} from '@/lib/companyMaster';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CompanySettingsGuardProps {
  children: React.ReactNode;
}

const CompanySettingsGuard: React.FC<CompanySettingsGuardProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [password, setPassword] = useState('');
  const [reauthenticated, setReauthenticated] = useState(false);
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const isMaster = useMemo(
    () => isCompanyMasterEmail(user?.email || profile?.email),
    [profile?.email, user?.email],
  );

  useEffect(() => {
    if (loading) return;

    if (!user || !isMaster) {
      setChecking(false);
      setReauthenticated(false);
      return;
    }

    const stored = window.sessionStorage.getItem(companySettingsReauthKey(user.id));
    const lastVerifiedAt = stored ? Number(stored) : 0;
    const stillValid = Number.isFinite(lastVerifiedAt)
      && Date.now() - lastVerifiedAt < COMPANY_SETTINGS_REAUTH_TTL_MS;

    setReauthenticated(stillValid);
    setChecking(false);
  }, [isMaster, loading, user]);

  const handleReauthenticate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user || !isMaster) return;
    const trimmedPassword = password.trim();
    if (!trimmedPassword) {
      toast.error('마스터 계정 비밀번호를 입력해주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: COMPANY_MASTER_EMAIL,
        password: trimmedPassword,
      });
      if (error) throw error;

      window.sessionStorage.setItem(companySettingsReauthKey(user.id), String(Date.now()));
      setPassword('');
      setReauthenticated(true);
      toast.success('회사 설정 접근이 확인되었습니다.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '비밀번호 확인에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isMaster) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>마스터 계정 전용</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">
              회사 설정은 {COMPANY_MASTER_EMAIL} 계정으로만 접근할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/admin-settings')} className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              관리자 설정으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!reauthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <LockKeyhole className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              회사 설정 2차 확인
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              매출, 직원 개인정보, 평가, 급여/계약 정보가 포함되어 있어 마스터 계정 비밀번호를 다시 확인합니다.
            </p>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                확인 후 15분 동안만 이 브라우저 세션에서 회사 설정을 열 수 있습니다.
              </AlertDescription>
            </Alert>
            <form className="space-y-4" onSubmit={handleReauthenticate}>
              <div className="space-y-2">
                <Label htmlFor="company-master-email">마스터 계정</Label>
                <Input id="company-master-email" value={COMPANY_MASTER_EMAIL} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-master-password">비밀번호</Label>
                <Input
                  id="company-master-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" variant="outline" onClick={() => navigate('/admin-settings')}>
                  취소
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  확인
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default CompanySettingsGuard;
