
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Code, Settings, Lock, Wrench } from "lucide-react";
import ProcessingOptionsManager from "@/components/admin/ProcessingOptionsManager";

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
            size="sm"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
        </div>
        
        <Card className="w-full">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Settings className="w-6 h-6" />
              관리자 설정
            </CardTitle>
            <p className="text-muted-foreground">
              계산기 관리 및 설정을 할 수 있습니다.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="shortcuts" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="shortcuts">빠른 설정</TabsTrigger>
                <TabsTrigger value="processing">가공 가격 관리</TabsTrigger>
              </TabsList>

              <TabsContent value="shortcuts" className="space-y-4 mt-6">
                <div className="grid gap-4">
                  <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Code className="w-4 h-4" />
                      위젯 관리
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      외부 사이트에 임베드할 수 있는 위젯 코드를 관리합니다.
                    </p>
                    <Button
                      onClick={() => navigate('/embed-code')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      위젯 코드 생성
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      원판 관리
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      원판 사이즈, 두께, 가격을 관리합니다. 견적 계산기와 수율 계산기에서 공유됩니다.
                    </p>
                    <Button
                      onClick={() => navigate('/panel-management')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      원판 관리
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                    <h3 className="font-medium mb-2 flex items-center gap-2">
                      <Settings className="w-4 h-4" />
                      가격 관리 (구버전)
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      제품별 가격을 설정하고 관리합니다.
                    </p>
                    <Button
                      onClick={() => navigate('/price-management')}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      가격 설정
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4 bg-muted/50">
                    <h3 className="font-medium mb-2 flex items-center gap-2 text-muted-foreground">
                      <Settings className="w-4 h-4" />
                      사용자 관리
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      사용자 권한 및 접근을 관리합니다. (준비중)
                    </p>
                    <Button
                      variant="outline"
                      disabled
                      className="flex items-center gap-2"
                    >
                      <Settings className="w-4 h-4" />
                      사용자 설정 (준비중)
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="processing" className="mt-6">
                <ProcessingOptionsManager />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
