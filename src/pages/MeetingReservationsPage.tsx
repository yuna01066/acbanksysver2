import { CalendarCheck2 } from 'lucide-react';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';

const MeetingReservationsPage = () => {
  return (
    <PageShell maxWidth="5xl">
      <PageHeader
        title="미팅 예약 관리"
        description="직원 미팅, 클라이언트 상담, 전사 이벤트 일정을 한 화면에서 관리합니다."
        icon={<CalendarCheck2 className="h-5 w-5" />}
      />
      <MeetingBookingWidget className="mx-auto" />
    </PageShell>
  );
};

export default MeetingReservationsPage;
