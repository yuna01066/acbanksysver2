import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, LogIn, UserPlus, KeyRound } from 'lucide-react';
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: 'linear-gradient(165deg, hsl(220 14% 93%) 0%, hsl(220 12% 88%) 40%, hsl(220 14% 91%) 70%, hsl(220 12% 86%) 100%)',
      }}
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo area – raised metal plate */}
        <div className="flex flex-col items-center gap-4">
          <div className="skeuo-metal p-5 rounded-full"
            style={{
              boxShadow: '0 4px 2px hsl(0 0% 100% / 0.7), 0 -3px 2px hsl(0 0% 0% / 0.08), 0 8px 20px hsl(220 20% 0% / 0.12)',
            }}
          >
            <img src={arcbankLogo} alt="ACBANK" className="h-14 w-14 object-contain" />
          </div>
          <h1 className="text-3xl skeuo-engraved">ACBANK</h1>
          <p className="text-xs text-muted-foreground tracking-widest uppercase">Internal Management System</p>
        </div>

        {/* Login card – plastic raised surface */}
        <div className="skeuo-card p-6 space-y-5">
          {pendingApproval && (
            <Alert className="skeuo-inset border-warning/40 bg-warning/5">
              <Clock className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning text-sm">
                관리자의 승인을 기다리고 있습니다.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email input – inset field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold text-muted-foreground tracking-wide uppercase pl-1">이메일</label>
              <div className="skeuo-inset px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-muted-foreground/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </div>

            {/* Password input – inset field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-semibold text-muted-foreground tracking-wide uppercase pl-1">비밀번호</label>
              <div className="skeuo-inset px-4 py-3 flex items-center gap-3">
                <KeyRound className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
              </div>
            </div>

            {/* Login button – primary plastic */}
            <button
              type="submit"
              disabled={loading}
              className="skeuo-primary w-full py-3 px-6 flex items-center justify-center gap-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <LogIn className="w-4 h-4" />
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(220 14% 80%), transparent)' }} />
          </div>

          {/* Bottom actions – plastic pill buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="skeuo-plastic flex-1 py-2.5 px-4 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              비밀번호 찾기
            </button>
            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="skeuo-plastic flex-1 py-2.5 px-4 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5"
            >
              <UserPlus className="w-3.5 h-3.5" />
              회원가입
            </button>
          </div>
        </div>

        <p className="text-[10px] text-center text-muted-foreground/60 tracking-wider">
          © 2025 ACBANK. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
