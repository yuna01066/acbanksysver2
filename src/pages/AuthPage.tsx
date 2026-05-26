import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2 } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import HomeLogoButton from '@/components/HomeLogoButton';
import LoginScreen from '@/components/LoginScreen';

const signupSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.'),
  confirmPassword: z.string(),
  fullName: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.')
}).refine((data) => data.password === data.confirmPassword, {
  message: '비밀번호가 일치하지 않습니다.',
  path: ['confirmPassword']
});

const AuthPage = () => {
  const { signUp } = useAuth();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  );
  const [signupComplete, setSignupComplete] = useState(false);
  
  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  
  // Signup form
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      signupSchema.parse({ 
        email: signupEmail, 
        password: signupPassword, 
        confirmPassword,
        fullName 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }
    
    setLoading(true);
    const { error } = await signUp(signupEmail, signupPassword, fullName);
    
    if (error) {
      if (error.message.includes('User already registered')) {
        toast.error('이미 등록된 이메일 주소입니다.');
      } else {
        toast.error('회원가입에 실패했습니다. 다시 시도해주세요.');
      }
    } else {
      setSignupComplete(true);
    }
    
    setLoading(false);
  };

  if (activeTab === 'login' && !signupComplete) {
    return (
      <LoginScreen
        redirectTo={redirectTo}
        initialEmail={loginEmail}
        onSignupClick={() => setActiveTab('signup')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <HomeLogoButton className="mb-4" />

        <Card>
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl skeuo-engraved">ACBANK</CardTitle>
            <CardDescription>
              계정에 로그인하거나 새로 만들어보세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signupComplete ? (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">회원가입이 완료되었습니다!</h3>
                <p className="text-sm text-muted-foreground">
                  관리자의 승인 후 로그인이 가능합니다.<br />
                  승인이 완료되면 로그인해주세요.
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    setSignupComplete(false);
                    setActiveTab('login');
                    setLoginEmail(signupEmail);
                  }}
                >
                  로그인 화면으로
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">이름</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="홍길동"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">이메일</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">비밀번호</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">비밀번호 확인</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '가입 중...' : '회원가입'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => setActiveTab('login')}
                >
                  로그인으로 돌아가기
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                  가입 후 관리자 승인이 필요합니다.
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthPage;
