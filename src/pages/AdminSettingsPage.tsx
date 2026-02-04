
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Code, Settings, Lock, Wrench, UserCog, Link } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { userRole, loading } = useAuth();

  useEffect(() => {
    if (!loading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
    }
  }, [loading, userRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="text-muted-foreground">로딩 중...</div>
        </div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'moderator') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>접근 권한 없음</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              이 페이지에 접근할 권한이 없습니다.
            </p>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => navigate('/')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              홈으로 돌아가기
            </Button>
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
                  <Wrench className="w-4 h-4" />
                  가공 가격 관리
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  추가 옵션 및 가공 방식의 배수와 활성화 상태를 관리합니다.
                </p>
                <Button
                  onClick={() => navigate('/processing-price-management')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4" />
                  가공 가격 설정
                </Button>
              </div>
              
              <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  담당자별 통계
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  각 담당자별 견적 현황 및 통계를 확인합니다.
                </p>
                <Button
                  onClick={() => navigate('/user-statistics')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <UserCog className="w-4 h-4" />
                  통계 보기
                </Button>
              </div>
              
              <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <UserCog className="w-4 h-4" />
                  담당자 관리
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  사용자 계정 및 권한을 관리합니다.
                </p>
                <Button
                  onClick={() => navigate('/user-management')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <UserCog className="w-4 h-4" />
                  담당자 관리
                </Button>
              </div>

              <div className="border rounded-lg p-4 bg-card hover:bg-accent/5 transition-colors">
                <h3 className="font-medium mb-2 flex items-center gap-2">
                  <Link className="w-4 h-4" />
                  Pluuug 연동
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Pluuug와 고객, 견적서, 계약, 정산 데이터를 동기화합니다.
                </p>
                <Button
                  onClick={() => navigate('/pluuug-integration')}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Link className="w-4 h-4" />
                  Pluuug 연동
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
