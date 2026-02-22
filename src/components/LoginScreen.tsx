import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import arcbankLogo from '@/assets/arcbank-logo.png';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.')
});

const LoginScreen = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPendingApproval(false);

    try {
      loginSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);
    const { error } = await signIn(email, password);

    if (error) {
      if (error.message === 'PENDING_APPROVAL') {
        setPendingApproval(true);
      } else if (error.message.includes('Invalid login credentials')) {
        toast.error('이메일 또는 비밀번호가 올바르지 않습니다.');
      } else {
        toast.error('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-background">
      <div className="w-full max-w-sm space-y-10">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <img src={arcbankLogo} alt="ACBANK" className="h-16 w-auto" />
          <h1 className="text-3xl font-bold tracking-wider text-foreground" style={{ fontFamily: 'Horizon, sans-serif' }}>
            ACBANK
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {pendingApproval && (
            <Alert className="border-warning bg-warning/10">
              <Clock className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                관리자의 승인을 기다리고 있습니다.
              </AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">이메일</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </Button>
          <div className="flex justify-between text-sm">
            <Button type="button" variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => navigate('/forgot-password')}>
              비밀번호 찾기
            </Button>
            <Button type="button" variant="link" className="text-muted-foreground p-0 h-auto" onClick={() => navigate('/auth')}>
              회원가입
            </Button>
          </div>
        </form>

        <p className="text-xs text-center text-muted-foreground">
          @2025 ACBANK. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
