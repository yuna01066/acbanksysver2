import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Lock, Settings, Users, UserCog, Code, Wrench, HardDrive, Building2, BarChart3, FolderKanban, Star, Shield, Receipt, FileText, Sparkles, Monitor, TrendingUp } from "lucide-react";
import QuoteStatisticsCard from '@/components/dashboard/QuoteStatisticsCard';
import { useAuth } from "@/contexts/AuthContext";
import SecretEventManager from '@/components/admin/SecretEventManager';

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { userRole, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
    }
  }, [loading, userRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center p-4">
        <div className="text-muted-foreground">로딩 중...</div>
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
            <p className="text-sm text-muted-foreground mt-2">이 페이지에 접근할 권한이 없습니다.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
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
          <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2" size="sm">
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
        </div>

        <h1 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Settings className="w-6 h-6" />
          관리자 설정
        </h1>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 직원 관리 Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5 text-primary" />
                직원 관리
              </CardTitle>
              <CardDescription>직원 프로필, 근무 관리 및 회사 설정</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <button
                onClick={() => navigate('/employee-profiles')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <UserCog className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">구성원 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isAdmin ? '인사 정보, 근태, 휴가, 평가, 계약, 문서함, 권한 통합 관리' : '근태기록, 연차·휴가, 업무평가 열람'}
                  </p>
                </div>
              </button>

              <button
                onClick={() => navigate('/review-settings')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">업무평가 설정</p>
                  <p className="text-xs text-muted-foreground mt-0.5">평가 주기, 평가 항목 및 가중치 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/company-settings')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">회사 설정</p>
                  <p className="text-xs text-muted-foreground mt-0.5">회사 정보, 휴일, 계약서, 연차 설정</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/year-end-tax-admin')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Receipt className="w-4 h-4 text-teal-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">연말정산 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">직원 연말정산 현황 및 검토/확정</p>
                </div>
              </button>

              {isAdmin && (
                <button
                  onClick={() => navigate('/company-settings?tab=access')}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">접근 권한</p>
                    <p className="text-xs text-muted-foreground mt-0.5">기능별 민감 정보 접근 권한 관리</p>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>

          {/* 프로젝트 관리 Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FolderKanban className="w-5 h-5 text-primary" />
                프로젝트 관리
              </CardTitle>
              <CardDescription>견적, 원판, 가공 가격 및 외부 연동 관리</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <button
                onClick={() => navigate('/panel-management')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Settings className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium">원판 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">원판 사이즈, 두께, 가격 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/processing-price-management')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Wrench className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">가공 가격 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">추가 옵션 및 가공 방식 배수 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/user-statistics')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-violet-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">담당자별 통계</p>
                  <p className="text-xs text-muted-foreground mt-0.5">각 담당자별 견적 현황 및 통계 확인</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/embed-code')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Code className="w-4 h-4 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">위젯 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">외부 사이트 임베드 위젯 코드 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/quote-template-management')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">견적서 템플릿 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">견적서 양식 생성 및 구분/항목 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/storage-status')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <HardDrive className="w-4 h-4 text-pink-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">스토리지 현황</p>
                  <p className="text-xs text-muted-foreground mt-0.5">데이터 스토리지 잔여량 및 사용 현황</p>
                </div>
              </button>
            </CardContent>
          </Card>
        </div>

        {/* 견적 통계 */}
        <div className="mt-6">
          <QuoteStatisticsCard />
        </div>

        {/* 시스템 관리 Card */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Monitor className="w-5 h-5 text-primary" />
              시스템 관리
            </CardTitle>
            <CardDescription>시스템 설정 및 특수 기능 관리</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <button className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">시크릿 이벤트 관리</p>
                    <p className="text-xs text-muted-foreground mt-0.5">특정 시간/날짜에 대시보드에 표시되는 시크릿 메시지 관리</p>
                  </div>
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0">
                <SecretEventManager />
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminSettingsPage;
