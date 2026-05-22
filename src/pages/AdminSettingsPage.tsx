import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, CalendarCheck2, Lock, Settings, Users, UserCog, Code, Wrench, HardDrive, Building2, FolderKanban, Star, Shield, Receipt, FileText, Sparkles, TrendingUp, ClipboardCheck, MessageSquareText, FileSignature } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SecretEventManager from '@/components/admin/SecretEventManager';
import SettingsChangeRequestsPanel from '@/components/admin/SettingsChangeRequestsPanel';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

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
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="Admin"
        title="관리자 설정"
        description="운영 설정은 관리자와 중간관리자가 관리하고, 고위험 변경은 관리자 승인 후 반영합니다."
        icon={<Settings className="h-5 w-5" />}
      />

      <div className="mb-6">
        <SettingsChangeRequestsPanel />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 직원 관리 Card */}
        <Card className="border-white/60 bg-card/70">
          <CardHeader>
            <BrandedCardHeader icon={Users} title="운영 검토 · 요청" />
            <CardDescription>일상 운영 검토와 마스터 전용 회사 설정 이동</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <button
              onClick={() => navigate('/review-hub')}
              className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <ClipboardCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">승인/검토 센터</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  휴가 승인, 파일 동기화, 견적 연결, 설정 변경 요청 검토
                </p>
              </div>
            </button>

            {isAdmin && (
              <button
                onClick={() => navigate('/employee-profiles?tab=contracts')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900/10 flex items-center justify-center shrink-0 mt-0.5">
                  <FileSignature className="w-4 h-4 text-slate-900" />
                </div>
                <div>
                  <p className="text-sm font-medium">전자계약 작성</p>
                  <p className="text-xs text-muted-foreground mt-0.5">계약 양식 선택, 구성원 다중 발송, 서명 내역 확인</p>
                </div>
              </button>
            )}

            {isAdmin && (
              <button
                onClick={() => navigate('/company-settings')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Building2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">회사 설정</p>
                  <p className="text-xs text-muted-foreground mt-0.5">마스터 계정 전용, 2차 비밀번호 확인 후 민감정보 관리</p>
                </div>
              </button>
            )}

              <button
                onClick={() => navigate('/review-settings')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Star className="w-4 h-4 text-yellow-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">업무평가 설정</p>
                  <p className="text-xs text-muted-foreground mt-0.5">평가 주기와 항목 운영, 평가 결과 열람은 회사 설정에서 관리</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/meeting-reservations')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <CalendarCheck2 className="w-4 h-4 text-indigo-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">미팅 예약 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">직원/클라이언트 미팅 예약 운영</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/quote-wizard')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-4 h-4 text-teal-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">견적 마법사</p>
                  <p className="text-xs text-muted-foreground mt-0.5">도면 파일 분석과 임시 견적 초안 생성</p>
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
                    <p className="text-sm font-medium">민감 권한 설정</p>
                    <p className="text-xs text-muted-foreground mt-0.5">마스터 계정 전용 회사 설정에서 기능별 접근 권한 관리</p>
                  </div>
                </button>
              )}
            </CardContent>
          </Card>

          {/* 프로젝트 관리 Card */}
          <Card className="border-white/60 bg-card/70">
            <CardHeader>
              <BrandedCardHeader icon={FolderKanban} title="프로젝트 · 시스템 관리" />
              <CardDescription>견적, 원판, 가공 가격, 외부 연동 및 시스템 설정</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <button
                onClick={() => navigate('/company-settings?tab=sensitive')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">민감정보 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">매출·인사·급여·평가 정보는 회사 설정에서 2차 확인 후 접근</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/review-hub')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">승인/검토 센터</p>
                  <p className="text-xs text-muted-foreground mt-0.5">휴가 승인, 파일 동기화, 견적 연결 확인</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/channel-talk-leads')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquareText className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-sm font-medium">채널톡 문의 분석함</p>
                  <p className="text-xs text-muted-foreground mt-0.5">도면 분석 리드 검토, 메모, 견적/프로젝트 전환</p>
                </div>
              </button>

              <button
                onClick={() => navigate('/response-assistant-management')}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors text-left"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-900/10 flex items-center justify-center shrink-0 mt-0.5">
                  <MessageSquareText className="w-4 h-4 text-slate-900" />
                </div>
                <div>
                  <p className="text-sm font-medium">상담 응대 보조 관리</p>
                  <p className="text-xs text-muted-foreground mt-0.5">AI instruction, 응대 근거, 템플릿 관리</p>
                </div>
              </button>

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
    </PageShell>
  );
};

export default AdminSettingsPage;
