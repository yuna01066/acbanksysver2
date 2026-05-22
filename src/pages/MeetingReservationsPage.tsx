import { CalendarCheck2 } from 'lucide-react';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';

const MeetingReservationsPage = () => {
  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="미팅 예약 관리"
        description="직원 미팅과 클라이언트 미팅 예약을 공지사항과 분리해 관리합니다."
        icon={<CalendarCheck2 className="h-5 w-5" />}
      />
      <MeetingBookingWidget className="mx-auto" />
    </PageShell>
  );
};

export default MeetingReservationsPage;
