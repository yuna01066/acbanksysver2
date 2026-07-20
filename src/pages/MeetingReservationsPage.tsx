import { CalendarCheck2, Link2 } from 'lucide-react';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import PublicBookingManagementPanel from '@/components/meeting/PublicBookingManagementPanel';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';

const MeetingReservationsPage = () => {
  const { isAdmin, isModerator } = useAuth();
  const [searchParams] = useSearchParams();
  const canManagePublicLinks = isAdmin || isModerator;
  const defaultTab = canManagePublicLinks && searchParams.get('tab') === 'public' ? 'public' : 'internal';

  return (
    <PageShell maxWidth={canManagePublicLinks ? '7xl' : '5xl'}>
      <PageHeader
        title="미팅 예약 관리"
        description="직원 미팅, 클라이언트 상담, 전사 이벤트 일정을 한 화면에서 관리합니다."
        icon={<CalendarCheck2 className="h-5 w-5" />}
      />
      {canManagePublicLinks ? (
        <Tabs defaultValue={defaultTab} className="space-y-5">
          <TabsList className="h-auto rounded-full border border-border bg-card p-1">
            <TabsTrigger value="internal" className="rounded-full px-4">
              내부 예약
            </TabsTrigger>
            <TabsTrigger value="public" className="rounded-full px-4">
              <Link2 className="mr-1.5 h-4 w-4" />
              공개 예약 링크
            </TabsTrigger>
          </TabsList>
          <TabsContent value="internal" className="mt-0">
            <MeetingBookingWidget className="mx-auto" />
          </TabsContent>
          <TabsContent value="public" className="mt-0">
            <PublicBookingManagementPanel />
          </TabsContent>
        </Tabs>
      ) : (
        <MeetingBookingWidget className="mx-auto" />
      )}
    </PageShell>
  );
};

export default MeetingReservationsPage;
