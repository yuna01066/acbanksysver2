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

  /* ── shared inline style helpers ── */
  const bg = 'hsl(220 10% 91%)';

  const insetField = {
    background: 'linear-gradient(180deg, hsl(220 12% 86%) 0%, hsl(220 12% 90%) 100%)',
    boxShadow: 'inset 0 2px 3px hsl(0 0% 0% / 0.08), inset 0 1px 1px hsl(0 0% 0% / 0.05), 0 1px 0 hsl(0 0% 100% / 0.7)',
    border: '1px solid hsl(220 12% 84%)',
  } as const;

  const convexBtn = {
    background: 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
    boxShadow: '0 2px 1px hsl(0 0% 100% / 1), 0 -2px 1px hsl(0 0% 0% / 0.06), 0 4px 10px hsl(220 20% 0% / 0.1)',
    border: '1px solid hsl(220 12% 86%)',
  } as const;

  const circleBtn = {
    background: 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
    boxShadow: '0 2px 1px hsl(0 0% 100% / 0.9), 0 -1px 1px hsl(0 0% 0% / 0.06), 0 4px 8px hsl(220 20% 0% / 0.08)',
    border: '1px solid hsl(220 12% 86%)',
  } as const;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: `linear-gradient(170deg, hsl(220 12% 93%) 0%, ${bg} 50%, hsl(220 10% 89%) 100%)` }}
    >
      <div className="w-full max-w-[380px] space-y-8">

        {/* ── Logo: large convex dial ── */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-[120px] h-[120px] rounded-full flex items-center justify-center"
            style={{
              background: 'linear-gradient(155deg, hsl(220 8% 96%) 0%, hsl(220 10% 86%) 40%, hsl(220 8% 92%) 60%, hsl(220 10% 84%) 100%)',
              boxShadow: '0 3px 2px hsl(0 0% 100% / 0.8), 0 -3px 2px hsl(0 0% 0% / 0.06), 0 8px 24px hsl(220 20% 0% / 0.12)',
              border: '1px solid hsl(220 10% 88%)',
            }}
          >
            <div
              className="w-[92px] h-[92px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, hsl(220 10% 94%) 0%, hsl(220 12% 88%) 100%)',
                boxShadow: 'inset 0 2px 4px hsl(0 0% 0% / 0.06), 0 1px 0 hsl(0 0% 100% / 0.6)',
                border: '1px solid hsl(220 10% 86%)',
              }}
            >
              <img src={arcbankLogo} alt="ACBANK" className="h-11 w-11 object-contain" />
            </div>
          </div>

          <div className="text-center space-y-1.5">
            <h1 className="text-[34px] font-extrabold tracking-[0.18em] skeuo-engraved leading-none">ACBANK</h1>
            <p className="text-[11px] font-medium tracking-[0.22em] uppercase" style={{ color: 'hsl(220 8% 42%)' }}>
              Management System
            </p>
          </div>
        </div>

        {/* ── Form card: soft raised surface ── */}
        <div
          className="rounded-[24px] px-7 py-8 space-y-6"
          style={{
            background: 'linear-gradient(180deg, hsl(220 12% 95%) 0%, hsl(220 12% 90%) 100%)',
            boxShadow: '0 2px 1px hsl(0 0% 100% / 0.8), 0 -1px 1px hsl(0 0% 0% / 0.04), 0 8px 20px hsl(220 20% 0% / 0.08)',
            border: '1px solid hsl(220 12% 88%)',
          }}
        >
          {pendingApproval && (
            <Alert className="bg-warning/10 border-warning/30 rounded-xl">
              <Clock className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning text-xs">관리자의 승인을 기다리고 있습니다.</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase pl-1" style={{ color: 'hsl(220 10% 30%)' }}>Email</label>
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={insetField}>
                <Mail className="w-[18px] h-[18px] shrink-0" style={{ color: 'hsl(220 8% 48%)' }} />
                <input
                  id="email" type="email" placeholder="your@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full bg-transparent text-[14px] tracking-[-0.01em] outline-none placeholder:text-muted-foreground/40"
                  style={{ color: 'hsl(220 10% 25%)' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase pl-1" style={{ color: 'hsl(220 10% 30%)' }}>Password</label>
              <div className="flex items-center gap-3 px-4 py-3.5 rounded-xl" style={insetField}>
                <KeyRound className="w-[18px] h-[18px] shrink-0" style={{ color: 'hsl(220 8% 48%)' }} />
                <input
                  id="password" type="password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full bg-transparent text-[14px] tracking-[-0.01em] outline-none"
                  style={{ color: 'hsl(220 10% 25%)' }}
                />
              </div>
            </div>

            {/* Login – convex plastic pill */}
            <div className="pt-1">
              <button
                type="submit" disabled={loading}
                className="w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-semibold tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] disabled:opacity-40"
                style={{
                  ...convexBtn,
                  color: 'hsl(220 12% 22%)',
                }}
              >
                <LogIn className="w-[18px] h-[18px]" />
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </div>
          </form>

          {/* Divider groove */}
          <div className="mx-2 h-px" style={{ background: 'linear-gradient(90deg, transparent, hsl(220 12% 82%), transparent)', boxShadow: '0 1px 0 hsl(0 0% 100% / 0.5)' }} />

          {/* Bottom circular actions */}
          <div className="flex items-center justify-center gap-10 pt-1">
            <button type="button" onClick={() => navigate('/forgot-password')} className="flex flex-col items-center gap-2 group">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                style={circleBtn}
              >
                <KeyRound className="w-[18px] h-[18px]" style={{ color: 'hsl(220 8% 50%)' }} />
              </div>
              <span className="text-[10px] font-medium tracking-[-0.01em]" style={{ color: 'hsl(220 8% 50%)' }}>비밀번호 찾기</span>
            </button>

            <button type="button" onClick={() => navigate('/auth')} className="flex flex-col items-center gap-2 group">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                style={circleBtn}
              >
                <UserPlus className="w-[18px] h-[18px]" style={{ color: 'hsl(220 8% 50%)' }} />
              </div>
              <span className="text-[10px] font-medium tracking-[-0.01em]" style={{ color: 'hsl(220 8% 50%)' }}>회원가입</span>
            </button>
          </div>
        </div>

        <p className="text-[10px] text-center font-medium tracking-[0.18em]" style={{ color: 'hsl(220 8% 62%)' }}>
          © 2025 ACBANK. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
