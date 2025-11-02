
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Code, Settings, Lock, Wrench } from "lucide-react";

const ADMIN_PASSWORD = "4999";

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // 세션 스토리지에서 인증 상태 확인
    const authStatus = sessionStorage.getItem('admin_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem('admin_authenticated', 'true');
      setError('');
    } else {
      setError('비밀번호가 올바르지 않습니다.');
      setPassword('');
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>관리자 인증</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              관리자 설정에 접근하려면 비밀번호를 입력하세요.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <Input
                  type="password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="text-center"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-destructive mt-2">{error}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate('/')}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  돌아가기
                </Button>
                <Button type="submit" className="flex-1">
                  확인
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6">
      <Card className="w-full max-w-4xl mx-auto border-border/50 shadow-smooth animate-fade-up">
        <CardHeader className="text-center pb-8 border-b border-border/50">
          <div className="flex justify-between items-center mb-6">
            <Button 
              onClick={() => navigate('/')}
              variant="outline"
              size="sm"
              className="animate-fade-up"
            >
              <ArrowLeft className="w-4 h-4" />
              홈으로
            </Button>
          </div>
          <CardTitle className="flex items-center justify-center gap-3 mb-3">
            <Settings className="w-7 h-7 text-primary" />
            <div className="text-2xl">
              <span className="font-bold">관리자 설정</span>
            </div>
          </CardTitle>
          <p className="text-body text-muted-foreground">계산기 관리 및 설정</p>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
          <div className="grid gap-4">
            <div className="border rounded-3xl p-6 bg-card/60 backdrop-blur-sm hover:bg-accent/5 hover:shadow-smooth transition-all duration-300">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-lg">
                <Code className="w-5 h-5 text-primary" />
                위젯 관리
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                외부 사이트에 임베드할 수 있는 위젯 코드를 관리합니다.
              </p>
              <Button
                onClick={() => navigate('/embed-code')}
                variant="outline"
                className="w-full"
              >
                <Code className="w-4 h-4 mr-2" />
                위젯 코드 생성
              </Button>
            </div>
            
            <div className="border rounded-3xl p-6 bg-card/60 backdrop-blur-sm hover:bg-accent/5 hover:shadow-smooth transition-all duration-300">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-primary" />
                원판 관리
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                원판 사이즈, 두께, 가격을 관리합니다. 견적 계산기와 수율 계산기에서 공유됩니다.
              </p>
              <Button
                onClick={() => navigate('/panel-management')}
                variant="outline"
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                원판 관리
              </Button>
            </div>

            <div className="border rounded-3xl p-6 bg-card/60 backdrop-blur-sm hover:bg-accent/5 hover:shadow-smooth transition-all duration-300">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-lg">
                <Wrench className="w-5 h-5 text-primary" />
                가공 가격 관리
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                추가 옵션 및 가공 방식의 배수와 활성화 상태를 관리합니다.
              </p>
              <Button
                onClick={() => navigate('/processing-price-management')}
                variant="outline"
                className="w-full"
              >
                <Wrench className="w-4 h-4 mr-2" />
                가공 가격 설정
              </Button>
            </div>
            
            <div className="border rounded-3xl p-6 bg-card/60 backdrop-blur-sm hover:bg-accent/5 hover:shadow-smooth transition-all duration-300">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-lg">
                <Settings className="w-5 h-5 text-primary" />
                가격 관리 (구버전)
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                제품별 가격을 설정하고 관리합니다.
              </p>
              <Button
                onClick={() => navigate('/price-management')}
                variant="outline"
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                가격 설정
              </Button>
            </div>
            
            <div className="border rounded-3xl p-6 bg-muted/30 backdrop-blur-sm">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-lg text-muted-foreground">
                <Settings className="w-5 h-5" />
                사용자 관리
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                사용자 권한 및 접근을 관리합니다. (준비중)
              </p>
              <Button
                variant="outline"
                disabled
                className="w-full"
              >
                <Settings className="w-4 h-4 mr-2" />
                사용자 설정 (준비중)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettingsPage;
