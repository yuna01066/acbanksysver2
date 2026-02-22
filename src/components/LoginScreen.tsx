import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock, LogIn, UserPlus, KeyRound, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';

const loginSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다.')
});

const LoginScreen = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const [logoSpinning, setLogoSpinning] = useState(false);
  const [neonActive, setNeonActive] = useState(false);

  const handleLogoClick = useCallback(() => {
    if (logoSpinning) return;
    setLogoSpinning(true);
    setTheme(theme === 'dark' ? 'light' : 'dark');
    toast(theme === 'dark' ? '☀️ 라이트 모드로 전환!' : '🌙 다크 모드로 전환!', { duration: 1500 });
    setTimeout(() => setLogoSpinning(false), 700);
  }, [logoSpinning, theme, setTheme]);

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
    setNeonActive(true);
    setTimeout(() => setNeonActive(false), 5000);
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

  const isDark = theme === 'dark';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden bg-[hsl(220,10%,91%)] dark:bg-[hsl(230,18%,7%)]">
      {/* Light mode gradient bg */}
      <div className="absolute inset-0 pointer-events-none dark:hidden" aria-hidden="true"
        style={{ background: 'linear-gradient(170deg, hsl(220 12% 93%) 0%, hsl(220 10% 91%) 50%, hsl(220 10% 89%) 100%)' }} />
      {/* Dark mode ambient glow */}
      <div className="absolute inset-0 pointer-events-none hidden dark:block" aria-hidden="true">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(170deg, hsl(230 18% 7%) 0%, hsl(240 16% 10%) 50%, hsl(230 18% 8%) 100%)' }} />
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-[0.12]"
          style={{ background: 'radial-gradient(circle, hsl(280 60% 35%) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute top-[5%] right-[-10%] w-[45%] h-[50%] rounded-full opacity-[0.10]"
          style={{ background: 'radial-gradient(circle, hsl(250 55% 40%) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute bottom-[-5%] left-[25%] w-[40%] h-[40%] rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, hsl(215 60% 35%) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      </div>

      <div className="w-full max-w-[380px] space-y-8 relative z-10">

        {/* ── Logo: metal embossed style matching dashboard ── */}
        <div className="flex flex-col items-center gap-4">
          <div className="inline-block logo-neon-wrap rounded-[24px] p-[5px]" onClick={handleLogoClick}>
            <div
              className={cn(
                "px-10 py-3 rounded-[20px] logo-metal cursor-pointer select-none",
                logoSpinning && "logo-spin-3d"
              )}
              style={{
                boxShadow: isDark
                  ? '0 2px 1px hsl(0 0% 100% / 0.05), 0 -2px 1px hsl(0 0% 0% / 0.4), 0 6px 16px hsl(220 20% 0% / 0.4)'
                  : '0 2px 1px hsl(0 0% 100% / 1), 0 -2px 1px hsl(0 0% 0% / 0.1), 0 6px 16px hsl(220 20% 0% / 0.12), inset 0 1px 2px hsl(0 0% 100% / 0.5), inset 0 -1px 2px hsl(0 0% 0% / 0.08)',
              }}
            >
              <h1 className="text-[38px] font-black leading-none tracking-[3px] skeuo-engraved">
                ACBANK
              </h1>
            </div>
          </div>

          <p className="text-[11px] font-medium tracking-[0.22em] uppercase text-[hsl(220,8%,42%)] dark:text-[hsl(220,10%,58%)]">
            Management System
          </p>
        </div>

        {/* ── Form card ── */}
        <div
          className="rounded-[24px] px-7 py-8 space-y-6"
          style={{
            background: isDark
              ? 'linear-gradient(180deg, hsl(230 14% 14%) 0%, hsl(230 14% 10%) 100%)'
              : 'linear-gradient(180deg, hsl(220 12% 95%) 0%, hsl(220 12% 90%) 100%)',
            boxShadow: isDark
              ? '0 2px 1px hsl(0 0% 100% / 0.04), 0 -1px 1px hsl(0 0% 0% / 0.3), 0 8px 20px hsl(220 20% 0% / 0.4)'
              : '0 2px 1px hsl(0 0% 100% / 0.8), 0 -1px 1px hsl(0 0% 0% / 0.04), 0 8px 20px hsl(220 20% 0% / 0.08)',
            border: isDark
              ? '1px solid hsl(230 14% 20%)'
              : '1px solid hsl(220 12% 88%)',
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
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase pl-1 text-[hsl(220,10%,30%)] dark:text-[hsl(220,10%,68%)]">Email</label>
              <div
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, hsl(220 12% 8%) 0%, hsl(220 12% 12%) 100%)'
                    : 'linear-gradient(180deg, hsl(220 12% 86%) 0%, hsl(220 12% 90%) 100%)',
                  boxShadow: isDark
                    ? 'inset 0 2px 3px hsl(0 0% 0% / 0.3), inset 0 1px 1px hsl(0 0% 0% / 0.2), 0 1px 0 hsl(0 0% 100% / 0.04)'
                    : 'inset 0 2px 3px hsl(0 0% 0% / 0.08), inset 0 1px 1px hsl(0 0% 0% / 0.05), 0 1px 0 hsl(0 0% 100% / 0.7)',
                  border: isDark
                    ? '1px solid hsl(220 12% 14%)'
                    : '1px solid hsl(220 12% 84%)',
                }}
              >
                <Mail className="w-[18px] h-[18px] shrink-0 text-[hsl(220,8%,48%)] dark:text-[hsl(220,10%,50%)]" />
                <input
                  id="email" type="email" placeholder="your@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} required
                  className="w-full bg-transparent text-[14px] tracking-[-0.01em] outline-none placeholder:text-muted-foreground/40 text-[hsl(220,10%,25%)] dark:text-[hsl(0,0%,90%)]"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.08em] uppercase pl-1 text-[hsl(220,10%,30%)] dark:text-[hsl(220,10%,68%)]">Password</label>
              <div
                className="flex items-center gap-3 px-4 py-3.5 rounded-xl"
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, hsl(220 12% 8%) 0%, hsl(220 12% 12%) 100%)'
                    : 'linear-gradient(180deg, hsl(220 12% 86%) 0%, hsl(220 12% 90%) 100%)',
                  boxShadow: isDark
                    ? 'inset 0 2px 3px hsl(0 0% 0% / 0.3), inset 0 1px 1px hsl(0 0% 0% / 0.2), 0 1px 0 hsl(0 0% 100% / 0.04)'
                    : 'inset 0 2px 3px hsl(0 0% 0% / 0.08), inset 0 1px 1px hsl(0 0% 0% / 0.05), 0 1px 0 hsl(0 0% 100% / 0.7)',
                  border: isDark
                    ? '1px solid hsl(220 12% 14%)'
                    : '1px solid hsl(220 12% 84%)',
                }}
              >
                <KeyRound className="w-[18px] h-[18px] shrink-0 text-[hsl(220,8%,48%)] dark:text-[hsl(220,10%,50%)]" />
                <input
                  id="password" type="password"
                  value={password} onChange={(e) => setPassword(e.target.value)} required
                  className="w-full bg-transparent text-[14px] tracking-[-0.01em] outline-none text-[hsl(220,10%,25%)] dark:text-[hsl(0,0%,90%)]"
                />
              </div>
            </div>

            {/* Login button */}
            <div className="pt-1">
              <button
                type="submit" disabled={loading}
                className={cn("w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-semibold tracking-[-0.01em] transition-all duration-200 active:scale-[0.98] disabled:opacity-40", neonActive && "login-neon-active")}
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, hsl(220 12% 22%) 0%, hsl(220 12% 14%) 100%)'
                    : 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
                  boxShadow: isDark
                    ? '0 2px 1px hsl(0 0% 100% / 0.06), 0 -2px 1px hsl(0 0% 0% / 0.3), 0 4px 10px hsl(220 20% 0% / 0.4)'
                    : '0 2px 1px hsl(0 0% 100% / 1), 0 -2px 1px hsl(0 0% 0% / 0.06), 0 4px 10px hsl(220 20% 0% / 0.1)',
                  border: isDark
                    ? '1px solid hsl(220 12% 20%)'
                    : '1px solid hsl(220 12% 86%)',
                  color: isDark ? 'hsl(0 0% 88%)' : 'hsl(220 12% 22%)',
                }}
              >
                <LogIn className="w-[18px] h-[18px]" />
                {loading ? '로그인 중...' : '로그인'}
              </button>
            </div>
          </form>

          {/* Divider groove */}
          <div className="mx-2 h-px" style={{
            background: isDark
              ? 'linear-gradient(90deg, transparent, hsl(220 14% 24%), transparent)'
              : 'linear-gradient(90deg, transparent, hsl(220 12% 82%), transparent)',
            boxShadow: isDark
              ? '0 1px 0 hsl(0 0% 100% / 0.04)'
              : '0 1px 0 hsl(0 0% 100% / 0.5)',
          }} />

          {/* Bottom circular actions */}
          <div className="flex items-center justify-center gap-10 pt-1">
            <button type="button" onClick={() => navigate('/forgot-password')} className="flex flex-col items-center gap-2 group">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, hsl(220 12% 22%) 0%, hsl(220 12% 14%) 100%)'
                    : 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
                  boxShadow: isDark
                    ? '0 2px 1px hsl(0 0% 100% / 0.04), 0 -1px 1px hsl(0 0% 0% / 0.3), 0 4px 8px hsl(220 20% 0% / 0.4)'
                    : '0 2px 1px hsl(0 0% 100% / 0.9), 0 -1px 1px hsl(0 0% 0% / 0.06), 0 4px 8px hsl(220 20% 0% / 0.08)',
                  border: isDark
                    ? '1px solid hsl(220 12% 20%)'
                    : '1px solid hsl(220 12% 86%)',
                }}
              >
                <KeyRound className="w-[18px] h-[18px] text-[hsl(220,8%,50%)] dark:text-[hsl(220,10%,55%)]" />
              </div>
              <span className="text-[10px] font-medium tracking-[-0.01em] text-[hsl(220,8%,50%)] dark:text-[hsl(220,10%,55%)]">비밀번호 찾기</span>
            </button>

            <button type="button" onClick={() => navigate('/auth')} className="flex flex-col items-center gap-2 group">
              <div
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95"
                style={{
                  background: isDark
                    ? 'linear-gradient(180deg, hsl(220 12% 22%) 0%, hsl(220 12% 14%) 100%)'
                    : 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
                  boxShadow: isDark
                    ? '0 2px 1px hsl(0 0% 100% / 0.04), 0 -1px 1px hsl(0 0% 0% / 0.3), 0 4px 8px hsl(220 20% 0% / 0.4)'
                    : '0 2px 1px hsl(0 0% 100% / 0.9), 0 -1px 1px hsl(0 0% 0% / 0.06), 0 4px 8px hsl(220 20% 0% / 0.08)',
                  border: isDark
                    ? '1px solid hsl(220 12% 20%)'
                    : '1px solid hsl(220 12% 86%)',
                }}
              >
                <UserPlus className="w-[18px] h-[18px] text-[hsl(220,8%,50%)] dark:text-[hsl(220,10%,55%)]" />
              </div>
              <span className="text-[10px] font-medium tracking-[-0.01em] text-[hsl(220,8%,50%)] dark:text-[hsl(220,10%,55%)]">회원가입</span>
            </button>
          </div>
        </div>

        <p className="text-[10px] text-center font-medium tracking-[0.18em] text-[hsl(220,8%,62%)] dark:text-[hsl(220,10%,45%)]">
          © 2025 ACBANK. ALL RIGHTS RESERVED.
        </p>
      </div>
    </div>
  );
};

export default LoginScreen;
