import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  BarChart3,
  Building2,
  Calendar,
  CalendarDays,
  FileSignature,
  FileText,
  Receipt,
  Shield,
  Star,
  UserCog,
} from 'lucide-react';
import CompanyInfoForm from '@/components/company/CompanyInfoForm';
import CompanyHolidayManager from '@/components/company/CompanyHolidayManager';
import CompanySettingsGuard from '@/components/company/CompanySettingsGuard';
import ContractTemplateSettings from '@/components/contract/ContractTemplateSettings';
import LeavePolicySettings from '@/components/leave/LeavePolicySettings';
import FeatureAccessManager from '@/components/company/FeatureAccessManager';
import QuoteDefaultTextSettings from '@/components/company/QuoteDefaultTextSettings';
import { COMPANY_MASTER_EMAIL } from '@/lib/companyMaster';

type SensitiveLink = {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SENSITIVE_LINKS: SensitiveLink[] = [
  {
    title: '매출·수익성',
    description: '매출, 비용, 견적 통계와 경영 대시보드',
    path: '/business-dashboard',
    icon: BarChart3,
  },
  {
    title: '직원 개인정보',
    description: '인사 정보, 근태, 휴가, 문서함, 계정 권한',
    path: '/employee-profiles',
    icon: UserCog,
  },
  {
    title: '급여·전자계약',
    description: '근로계약 작성, 서명 이력, 급여 관련 문서',
    path: '/employee-profiles?tab=contracts',
    icon: FileSignature,
  },
  {
    title: '업무역량·평가',
    description: '평가 주기, 평가 결과, 경위서와 평가 이력',
    path: '/review-settings?tab=history',
    icon: Star,
  },
  {
    title: '연말정산·세금',
    description: '직원 연말정산 검토, 확정, 세금계산서 관리',
    path: '/year-end-tax-admin',
    icon: Receipt,
  },
  {
    title: '민감 권한',
    description: '기능별 최소 역할과 민감 정보 접근 권한',
    path: '/company-settings?tab=access',
    icon: Shield,
  },
];

const CompanySettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const defaultTab = searchParams.get('tab') || 'sensitive';

  return (
    <CompanySettingsGuard>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin-settings')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Company Master</p>
                <h1 className="text-2xl font-bold">회사 설정</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {COMPANY_MASTER_EMAIL} 마스터 계정으로만 접근 가능한 민감정보 관리 콘솔입니다.
                </p>
              </div>
            </div>
          </div>

          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList className="flex h-auto flex-wrap justify-start">
              <TabsTrigger value="sensitive" className="gap-1.5">
                <Shield className="h-4 w-4" /> 민감정보
              </TabsTrigger>
              <TabsTrigger value="access" className="gap-1.5">
                <Shield className="h-4 w-4" /> 접근 권한
              </TabsTrigger>
              <TabsTrigger value="info" className="gap-1.5">
                <Building2 className="h-4 w-4" /> 회사 정보
              </TabsTrigger>
              <TabsTrigger value="holidays" className="gap-1.5">
                <CalendarDays className="h-4 w-4" /> 쉬는 날
              </TabsTrigger>
              <TabsTrigger value="contracts" className="gap-1.5">
                <FileSignature className="h-4 w-4" /> 계약서 양식
              </TabsTrigger>
              <TabsTrigger value="leave" className="gap-1.5">
                <Calendar className="h-4 w-4" /> 연차 정책
              </TabsTrigger>
              <TabsTrigger value="quote-text" className="gap-1.5">
                <FileText className="h-4 w-4" /> 견적서 문구
              </TabsTrigger>
            </TabsList>

            <TabsContent value="sensitive">
              <Card>
                <CardHeader>
                  <CardTitle>민감정보 관리 바로가기</CardTitle>
                  <CardDescription>
                    매출, 인사, 급여/계약, 평가처럼 회사 운영상 민감도가 높은 화면은 마스터 확인 이후 이 영역에서 접근합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-2">
                    {SENSITIVE_LINKS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.path}
                          type="button"
                          onClick={() => navigate(item.path)}
                          className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent/40"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold">{item.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="access">
              <div className="mb-4">
                <p className="text-sm text-muted-foreground">
                  각 기능에 접근할 수 있는 <strong>최소 역할</strong>을 설정합니다. 민감 권한 변경은 회사 설정에서만 처리합니다.
                </p>
              </div>
              <FeatureAccessManager />
            </TabsContent>

            <TabsContent value="info">
              <CompanyInfoForm />
            </TabsContent>
            <TabsContent value="holidays">
              <CompanyHolidayManager />
            </TabsContent>
            <TabsContent value="contracts">
              <ContractTemplateSettings />
            </TabsContent>
            <TabsContent value="leave">
              <LeavePolicySettings />
            </TabsContent>
            <TabsContent value="quote-text">
              <QuoteDefaultTextSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </CompanySettingsGuard>
  );
};

export default CompanySettingsPage;
