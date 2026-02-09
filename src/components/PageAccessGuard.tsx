import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageAccess } from '@/hooks/usePageAccess';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, ArrowLeft, Loader2 } from 'lucide-react';

interface PageAccessGuardProps {
  children: React.ReactNode;
}

const PageAccessGuard: React.FC<PageAccessGuardProps> = ({ children }) => {
  const { allowed, checking } = usePageAccess();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null; // Auth will handle redirect
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>접근 권한 없음</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              이 페이지에 대한 접근 권한이 없습니다. 관리자에게 문의하세요.
            </p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default PageAccessGuard;
