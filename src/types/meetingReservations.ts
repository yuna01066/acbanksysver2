import type { LucideIcon } from 'lucide-react';
import {
  Building2,
  CalendarCheck2,
  Factory,
  Handshake,
  MapPin,
  MessageSquare,
  Store,
  UserRound,
  UsersRound,
} from 'lucide-react';

export type MeetingAudienceType = 'employee' | 'client';
export type EmployeeMeetingType = 'one_on_one' | 'all_hands' | 'team';
export type ClientMeetingType =
  | 'showroom_visit'
  | 'production_consulting'
  | 'external_meeting'
  | 'exhibition_onsite'
  | 'other';
export type MeetingReservationStatus = 'scheduled' | 'confirmed' | 'completed' | 'canceled';

export type MeetingOption<T extends string> = {
  value: T;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const MEETING_AUDIENCE_OPTIONS: MeetingOption<MeetingAudienceType>[] = [
  {
    value: 'employee',
    label: '직원',
    description: '내부 1:1, 전체, 팀별 회의',
    icon: UsersRound,
  },
  {
    value: 'client',
    label: '클라이언트',
    description: '방문, 상담, 외부 미팅 관리',
    icon: Building2,
  },
];

export const EMPLOYEE_MEETING_OPTIONS: MeetingOption<EmployeeMeetingType>[] = [
  {
    value: 'one_on_one',
    label: '1:1',
    description: '개별 면담 또는 업무 협의',
    icon: UserRound,
  },
  {
    value: 'all_hands',
    label: '전체 회의',
    description: '전 직원 대상 공유 회의',
    icon: UsersRound,
  },
  {
    value: 'team',
    label: '팀별 회의',
    description: '부서 또는 프로젝트 단위 회의',
    icon: MessageSquare,
  },
];

export const CLIENT_MEETING_OPTIONS: MeetingOption<ClientMeetingType>[] = [
  {
    value: 'showroom_visit',
    label: '쇼룸 방문',
    description: '쇼룸 내방 상담 및 제품 확인',
    icon: Store,
  },
  {
    value: 'production_consulting',
    label: '제작 상담',
    description: '제작 방식, 견적, 사양 상담',
    icon: Factory,
  },
  {
    value: 'external_meeting',
    label: '외부 미팅',
    description: '클라이언트 현장 또는 외부 장소',
    icon: MapPin,
  },
  {
    value: 'exhibition_onsite',
    label: '박람회 현장 상담',
    description: '박람회 부스 현장 예약',
    icon: Handshake,
  },
  {
    value: 'other',
    label: '기타 미팅',
    description: '분류되지 않은 클라이언트 미팅',
    icon: CalendarCheck2,
  },
];

export const MEETING_STATUS_LABELS: Record<MeetingReservationStatus, string> = {
  scheduled: '예약',
  confirmed: '확정',
  completed: '완료',
  canceled: '취소',
};

export const MEETING_STATUS_CLASSES: Record<MeetingReservationStatus, string> = {
  scheduled: 'border-[#cacacb] bg-[#fafafa] text-[#39393b]',
  confirmed: 'border-[#111111] bg-[#111111] text-white',
  completed: 'border-emerald-600 bg-emerald-50 text-emerald-700',
  canceled: 'border-red-600 bg-red-50 text-red-700',
};

export const getMeetingTypeLabel = (
  audienceType: MeetingAudienceType,
  employeeMeetingType?: EmployeeMeetingType | null,
  clientMeetingType?: ClientMeetingType | null,
) => {
  if (audienceType === 'employee') {
    return EMPLOYEE_MEETING_OPTIONS.find((option) => option.value === employeeMeetingType)?.label || '직원 미팅';
  }

  return CLIENT_MEETING_OPTIONS.find((option) => option.value === clientMeetingType)?.label || '클라이언트 미팅';
};
