import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { z } from 'zod';

const resetSchema = z.object({
  email: z.string().email('올바른 이메일 주소를 입력해주세요.'),
  fullName: z.string().min(2, '이름은 최소 2자 이상이어야 합니다.'),
  phone: z.string().min(1, '전화번호를 입력해주세요.'),
});

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      resetSchema.parse({ email, fullName, phone });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('password-reset', {
        body: { action: 'submit', email: email.trim(), full_name: fullName.trim(), phone: phone.trim() },
      });

      if (error) {
        toast.error('요청 처리 중 오류가 발생했습니다.');
      } else if (data?.error) {
        toast.error(data.error);
      } else {
        setSubmitted(true);
      }
    } catch (err) {
      toast.error('요청 처리 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/95 to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Button variant="ghost" onClick={() => navigate('/auth')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          로그인으로 돌아가기
        </Button>

        <Card>
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
              <KeyRound className="w-6 h-6 text-primary" />
            </div>
            <CardTitle className="text-xl">비밀번호 찾기</CardTitle>
            <CardDescription>
              등록된 정보를 입력하면 관리자에게 비밀번호 초기화 요청이 전송됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="text-center py-6 space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">요청이 접수되었습니다</h3>
                <p className="text-sm text-muted-foreground">
                  관리자가 요청을 확인한 후 비밀번호가 초기화됩니다.<br />
                  초기화된 비밀번호는 <strong>1234</strong> 입니다.<br />
                  로그인 후 반드시 비밀번호를 변경해주세요.
                </p>
                <Button variant="outline" className="w-full" onClick={() => navigate('/auth')}>
                  로그인 화면으로
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email">이메일 (아이디)</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-name">이름</Label>
                  <Input
                    id="reset-name"
                    type="text"
                    placeholder="홍길동"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-phone">전화번호</Label>
                  <Input
                    id="reset-phone"
                    type="tel"
                    placeholder="010-1234-5678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '요청 중...' : '비밀번호 초기화 요청'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
