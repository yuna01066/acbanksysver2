import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  CalendarDays,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Lock,
  PenLine,
  Receipt,
  User,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import EmployeeDocumentsPanel from '@/components/employee/EmployeeDocumentsPanel';
import MyAttendanceLeaveSection from '@/components/mypage/MyAttendanceLeaveSection';
import MyContractSalarySection from '@/components/mypage/MyContractSalarySection';
import MyHrTasksSection from '@/components/mypage/MyHrTasksSection';
import MyPageOverview from '@/components/mypage/MyPageOverview';
import MyProfileSelfService from '@/components/mypage/MyProfileSelfService';
import MySecuritySection from '@/components/mypage/MySecuritySection';
import MyTaxSection from '@/components/mypage/MyTaxSection';

const TAB_CONFIG = [
  { value: 'overview', label: '개요', icon: LayoutDashboard },
  { value: 'profile', label: '내 인사정보', icon: User },
  { value: 'attendance', label: '근태·연차', icon: CalendarDays },
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
  const currentTab = TAB_CONFIG.some(tab => tab.value === requestedTab) ? requestedTab : 'overview';

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
    <PageShell maxWidth="7xl" className="bg-gradient-to-br from-background via-background to-primary/5">
      <PageHeader
        title="마이페이지"
        description={`${profile?.full_name || user.email}님의 인사 정보, 근태, 계약, 문서, 연말정산, HR 요청을 한 곳에서 처리합니다.`}
        icon={<User className="h-5 w-5" />}
        actions={(
          <Button variant="outline" onClick={signOut}>
            로그아웃
          </Button>
        )}
      />

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-6">
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex h-auto w-max min-w-full justify-start gap-1 rounded-lg p-1">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-h-10 shrink-0 gap-2 whitespace-nowrap px-3 text-xs sm:text-sm"
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

        <TabsContent value="profile" className="mt-0">
          <MyProfileSelfService />
        </TabsContent>

        <TabsContent value="attendance" className="mt-0">
          <MyAttendanceLeaveSection />
        </TabsContent>

        <TabsContent value="contract" className="mt-0">
          <MyContractSalarySection />
        </TabsContent>

        <TabsContent value="documents" className="mt-0">
          <EmployeeDocumentsPanel userId={user.id} />
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
    </PageShell>
  );
};

export default MyPage;
