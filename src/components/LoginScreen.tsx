import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, LogIn, UserPlus, KeyRound, Mail } from 'lucide-react';
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
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: 'linear-gradient(170deg, hsl(220 10% 22%) 0%, hsl(220 12% 16%) 50%, hsl(220 10% 13%) 100%)',
      }}
    >
      <div className="w-full max-w-[360px] space-y-8">

        {/* ── Logo Section ── */}
        <div className="flex flex-col items-center gap-5">
          {/* Metallic dial-like logo container */}
          <div
            className="relative w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(165deg, hsl(220 8% 32%) 0%, hsl(220 10% 22%) 40%, hsl(220 8% 28%) 60%, hsl(220 10% 20%) 100%)',
              boxShadow: `
                0 2px 1px hsl(0 0% 100% / 0.08),
                0 -2px 1px hsl(0 0% 0% / 0.4),
                0 6px 20px hsl(0 0% 0% / 0.5),
                inset 0 1px 0 hsl(0 0% 100% / 0.06)
              `,
              border: '1px solid hsl(220 10% 26%)',
            }}
          >
            {/* Inner ring */}
            <div
              className="w-[76px] h-[76px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, hsl(220 8% 26%) 0%, hsl(220 10% 18%) 100%)',
                boxShadow: 'inset 0 2px 4px hsl(0 0% 0% / 0.3), 0 1px 0 hsl(0 0% 100% / 0.05)',
                border: '1px solid hsl(220 10% 22%)',
              }}
            >
              <img src={arcbankLogo} alt="ACBANK" className="h-10 w-10 object-contain brightness-150" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <h1
              className="text-2xl font-extrabold tracking-[0.15em]"
              style={{
                color: 'transparent',
                background: 'linear-gradient(180deg, hsl(220 6% 72%) 0%, hsl(220 8% 56%) 50%, hsl(220 6% 64%) 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 -1px 0 hsl(0 0% 100% / 0.1)) drop-shadow(0 2px 2px hsl(0 0% 0% / 0.4))',
              }}
            >
              ACBANK
            </h1>
            <p className="text-[10px] tracking-[0.25em] uppercase" style={{ color: 'hsl(220 8% 48%)' }}>
              Management System
            </p>
          </div>
        </div>

        {/* ── Login Form Area ── */}
        <div
          className="rounded-2xl p-5 space-y-5"
          style={{
            background: 'linear-gradient(180deg, hsl(220 10% 20%) 0%, hsl(220 12% 16%) 100%)',
            boxShadow: `
              0 1px 0 hsl(0 0% 100% / 0.04),
              0 -1px 0 hsl(0 0% 0% / 0.3),
              0 8px 24px hsl(0 0% 0% / 0.4),
              inset 0 1px 0 hsl(0 0% 100% / 0.04)
            `,
            border: '1px solid hsl(220 10% 22%)',
          }}
        >
          {pendingApproval && (
            <Alert className="bg-warning/10 border-warning/30 rounded-xl">
              <Clock className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning text-xs">
                관리자의 승인을 기다리고 있습니다.
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold tracking-[0.15em] uppercase pl-1" style={{ color: 'hsl(220 8% 50%)' }}>
                Email
              </label>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'linear-gradient(180deg, hsl(220 12% 12%) 0%, hsl(220 12% 15%) 100%)',
                  boxShadow: 'inset 0 2px 4px hsl(0 0% 0% / 0.3), inset 0 1px 2px hsl(0 0% 0% / 0.2), 0 1px 0 hsl(0 0% 100% / 0.04)',
                  border: '1px solid hsl(220 12% 18%)',
                }}
              >
                <Mail className="w-4 h-4 shrink-0" style={{ color: 'hsl(220 8% 40%)' }} />
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'hsl(220 6% 80%)', caretColor: 'hsl(215 80% 60%)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold tracking-[0.15em] uppercase pl-1" style={{ color: 'hsl(220 8% 50%)' }}>
                Password
              </label>
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl"
                style={{
                  background: 'linear-gradient(180deg, hsl(220 12% 12%) 0%, hsl(220 12% 15%) 100%)',
                  boxShadow: 'inset 0 2px 4px hsl(0 0% 0% / 0.3), inset 0 1px 2px hsl(0 0% 0% / 0.2), 0 1px 0 hsl(0 0% 100% / 0.04)',
                  border: '1px solid hsl(220 12% 18%)',
                }}
              >
                <KeyRound className="w-4 h-4 shrink-0" style={{ color: 'hsl(220 8% 40%)' }} />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-transparent text-sm outline-none"
                  style={{ color: 'hsl(220 6% 80%)', caretColor: 'hsl(215 80% 60%)' }}
                />
              </div>
            </div>

            {/* Login button – convex metal pill */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
              style={{
                background: 'linear-gradient(180deg, hsl(220 8% 38%) 0%, hsl(220 10% 26%) 100%)',
                color: 'hsl(220 6% 82%)',
                boxShadow: `
                  0 2px 1px hsl(0 0% 100% / 0.08),
                  0 -2px 1px hsl(0 0% 0% / 0.3),
                  0 4px 12px hsl(0 0% 0% / 0.35)
                `,
                border: '1px solid hsl(220 10% 30%)',
              }}
            >
              <LogIn className="w-4 h-4" />
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>

          {/* Separator – subtle groove */}
          <div
            className="h-px mx-4"
            style={{
              background: 'linear-gradient(90deg, transparent, hsl(0 0% 0% / 0.4), transparent)',
              boxShadow: '0 1px 0 hsl(0 0% 100% / 0.04)',
            }}
          />

          {/* Bottom actions – small circular controls */}
          <div className="flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(165deg, hsl(220 8% 32%) 0%, hsl(220 10% 22%) 50%, hsl(220 8% 26%) 100%)',
                  boxShadow: '0 2px 1px hsl(0 0% 100% / 0.06), 0 -1px 1px hsl(0 0% 0% / 0.3), 0 4px 8px hsl(0 0% 0% / 0.3)',
                  border: '1px solid hsl(220 10% 26%)',
                }}
              >
                <KeyRound className="w-4 h-4" style={{ color: 'hsl(220 8% 58%)' }} />
              </div>
              <span className="text-[9px] font-medium" style={{ color: 'hsl(220 8% 48%)' }}>비밀번호 찾기</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/auth')}
              className="flex flex-col items-center gap-1.5 group"
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                style={{
                  background: 'linear-gradient(165deg, hsl(220 8% 32%) 0%, hsl(220 10% 22%) 50%, hsl(220 8% 26%) 100%)',
                  boxShadow: '0 2px 1px hsl(0 0% 100% / 0.06), 0 -1px 1px hsl(0 0% 0% / 0.3), 0 4px 8px hsl(0 0% 0% / 0.3)',
                  border: '1px solid hsl(220 10% 26%)',
                }}
              >
                <UserPlus className="w-4 h-4" style={{ color: 'hsl(220 8% 58%)' }} />
              </div>
              <span className="text-[9px] font-medium" style={{ color: 'hsl(220 8% 48%)' }}>회원가입</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[9px] text-center tracking-[0.2em]" style={{ color: 'hsl(220 8% 35%)' }}>
          © 2025 ACBANK. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
