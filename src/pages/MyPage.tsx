import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  Briefcase,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  PenLine,
  Receipt,
  User,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageLayout';
import EmployeeDocumentsPanel from '@/components/employee/EmployeeDocumentsPanel';
import MyAttendanceLeaveSection from '@/components/mypage/MyAttendanceLeaveSection';
import MyCalendarDiarySection from '@/components/mypage/MyCalendarDiarySection';
import MyContractSalarySection from '@/components/mypage/MyContractSalarySection';
import MyPageBusinessSection from '@/components/mypage/MyPageBusinessSection';
import MyHrTasksSection from '@/components/mypage/MyHrTasksSection';
import { MyPageSectionHeader } from '@/components/mypage/MyPageLayout';
import MyPageOverview from '@/components/mypage/MyPageOverview';
import MyProfileSelfService from '@/components/mypage/MyProfileSelfService';
import MySecuritySection from '@/components/mypage/MySecuritySection';
import MyTaxSection from '@/components/mypage/MyTaxSection';

const TAB_CONFIG = [
  { value: 'overview', label: '개요', icon: LayoutDashboard },
  { value: 'diary', label: '일정·다이어리', icon: CalendarDays },
  { value: 'profile', label: '내 정보', icon: User },
  { value: 'attendance', label: '근태·연차', icon: CalendarDays },
  { value: 'business', label: '업무·평가', icon: Briefcase },
  { value: 'contract', label: '계약·급여', icon: PenLine },
  { value: 'documents', label: '문서함', icon: FileText },
  { value: 'tax', label: '연말정산', icon: Receipt },
  { value: 'tasks', label: '교육·온보딩', icon: GraduationCap },
  { value: 'security', label: '보안', icon: Lock },
];

const MyPage = () => {
  const { user, profile, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') || 'overview';
  const normalizedTab = requestedTab === 'hr'
    ? searchParams.get('hrTab') === 'contracts'
      ? 'contract'
      : 'profile'
    : requestedTab;
  const currentTab = TAB_CONFIG.some(tab => tab.value === normalizedTab) ? normalizedTab : 'overview';

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  if (authLoading || !user) {
    return <div className="min-h-screen flex items-center justify-center">로딩 중...</div>;
  }

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <PageShell maxWidth="7xl" className="bg-muted/20">
      <div className="space-y-5">
        <div className="rounded-xl border bg-background px-5 py-4 shadow-none">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-normal">마이페이지</h1>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">
                  {profile?.full_name || user.email}님의 근태, 계약, 문서, 연말정산, HR 요청을 한 곳에서 처리합니다.
                </p>
              </div>
            </div>
            <Button variant="outline" className="h-10 shrink-0 rounded-full px-5" onClick={signOut}>
              로그아웃
            </Button>
          </div>
        </div>

        <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-5">
          <div className="sticky top-2 z-20 overflow-x-auto rounded-xl border bg-background/95 p-1 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 bg-transparent p-0">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="min-h-9 shrink-0 gap-2 rounded-lg px-3 text-xs font-medium data-[state=active]:bg-muted data-[state=active]:shadow-none sm:text-sm"
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0">
            <MyPageOverview />
          </TabsContent>

          <TabsContent value="diary" className="mt-0">
            <MyCalendarDiarySection />
          </TabsContent>

          <TabsContent value="profile" className="mt-0">
            <MyProfileSelfService />
          </TabsContent>

          <TabsContent value="attendance" className="mt-0">
            <MyAttendanceLeaveSection />
          </TabsContent>

          <TabsContent value="business" className="mt-0">
            <MyPageBusinessSection />
          </TabsContent>

          <TabsContent value="contract" className="mt-0">
            <MyContractSalarySection />
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <div className="space-y-4">
              <MyPageSectionHeader
                title="문서함"
                description="제출 필요 문서와 제출 완료 문서를 확인하고 업로드합니다."
                icon={<FileText className="h-4 w-4" />}
              />
              <EmployeeDocumentsPanel userId={user.id} />
            </div>
          </TabsContent>

          <TabsContent value="tax" className="mt-0">
            <MyTaxSection />
          </TabsContent>

          <TabsContent value="tasks" className="mt-0">
            <MyHrTasksSection />
          </TabsContent>

          <TabsContent value="security" className="mt-0">
            <MySecuritySection />
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
};

export default MyPage;
