export type DashboardSourceKey =
  | 'quote-issued'
  | 'quote-delivery'
  | 'quote-delivery-completed'
  | 'project'
  | 'notion'
  | 'meeting'
  | 'meeting-reservation'
  | 'announcement-event'
  | 'holiday'
  | 'birthday'
  | 'leave'
  | 'channel-talk'
  | 'approval'
  | 'hr'
  | 'calendar'
  | 'room'
  | 'system';

export type DashboardStatusTone = 'danger' | 'warning' | 'primary' | 'neutral' | 'success';

export const DASHBOARD_SOURCE_COLORS: Record<DashboardSourceKey, {
  label: string;
  accent: string;
  dotClassName: string;
}> = {
  'quote-issued': { label: '견적 발행', accent: '#2563eb', dotClassName: 'bg-blue-500' },
  'quote-delivery': { label: '납기 예정', accent: '#f97316', dotClassName: 'bg-orange-500' },
  'quote-delivery-completed': { label: '납기 완료', accent: '#059669', dotClassName: 'bg-emerald-600' },
  project: { label: '프로젝트', accent: '#7c3aed', dotClassName: 'bg-violet-600' },
  notion: { label: 'Notion', accent: '#71717a', dotClassName: 'bg-zinc-500' },
  meeting: { label: '미팅', accent: '#b45309', dotClassName: 'bg-amber-700' },
  'meeting-reservation': { label: '미팅 예약', accent: '#0284c7', dotClassName: 'bg-sky-600' },
  'announcement-event': { label: '이벤트', accent: '#0891b2', dotClassName: 'bg-cyan-600' },
  holiday: { label: '휴일', accent: '#ef4444', dotClassName: 'bg-red-500' },
  birthday: { label: '생일', accent: '#ec4899', dotClassName: 'bg-pink-500' },
  leave: { label: '휴가', accent: '#14b8a6', dotClassName: 'bg-teal-500' },
  'channel-talk': { label: '채널톡 문의', accent: '#0d9488', dotClassName: 'bg-teal-600' },
  approval: { label: '승인/검토', accent: '#d97706', dotClassName: 'bg-amber-600' },
  hr: { label: '인사 업무', accent: '#14b8a6', dotClassName: 'bg-teal-500' },
  calendar: { label: '일정/할 일', accent: '#52525b', dotClassName: 'bg-zinc-500' },
  room: { label: '회의실', accent: '#4b5563', dotClassName: 'bg-gray-600' },
  system: { label: '시스템', accent: '#64748b', dotClassName: 'bg-slate-500' },
};

export function getDashboardSourceColor(sourceKey: DashboardSourceKey) {
  return DASHBOARD_SOURCE_COLORS[sourceKey].accent;
}

export function getDashboardSourceDotClass(sourceKey?: DashboardSourceKey | null) {
  if (!sourceKey) return DASHBOARD_SOURCE_COLORS.system.dotClassName;
  return DASHBOARD_SOURCE_COLORS[sourceKey]?.dotClassName || DASHBOARD_SOURCE_COLORS.system.dotClassName;
}

export function getDashboardSourceLabel(sourceKey?: DashboardSourceKey | null) {
  if (!sourceKey) return DASHBOARD_SOURCE_COLORS.system.label;
  return DASHBOARD_SOURCE_COLORS[sourceKey]?.label || DASHBOARD_SOURCE_COLORS.system.label;
}

export function getDashboardStatusDotClass(tone: DashboardStatusTone) {
  switch (tone) {
    case 'danger':
      return 'bg-red-500';
    case 'warning':
      return 'bg-amber-500';
    case 'success':
      return 'bg-emerald-500';
    case 'primary':
      return 'bg-foreground';
    default:
      return 'bg-muted-foreground';
  }
}

export function getDashboardSourceKeyForCalendarEvent(event: {
  source_type?: string | null;
  source_subtype?: string | null;
  status?: string | null;
  title?: string | null;
  icon_type?: string | null;
  resource_ids?: string[] | null;
  metadata?: Record<string, unknown> | null;
}): DashboardSourceKey {
  if (event.resource_ids?.length) return 'room';
  const metadata = event.metadata && typeof event.metadata === 'object' ? event.metadata : {};
  const projectStage = typeof metadata.project_stage === 'string' ? metadata.project_stage : null;
  const deliveryState = typeof metadata.delivery_state === 'string' ? metadata.delivery_state : null;
  const calendarKind = typeof metadata.calendar_kind === 'string' ? metadata.calendar_kind : null;
  const isCompletedDelivery = event.source_type === 'quote'
    && (
      event.source_subtype === 'delivery_completed'
      || event.source_subtype === 'delivered'
      || (
        event.source_subtype === 'delivery'
        && (
          event.status === 'completed'
          || projectStage === 'delivered'
          || deliveryState === 'completed'
          || (calendarKind === 'quote_delivery' && typeof event.title === 'string' && event.title.startsWith('납기 완료'))
        )
      )
    );
  if (isCompletedDelivery) return 'quote-delivery-completed';
  if (event.source_type === 'quote' && event.source_subtype === 'delivery') return 'quote-delivery';
  if (event.source_type === 'quote') return 'quote-issued';
  if (event.source_type === 'project') return 'project';
  if (event.source_type === 'notion') return 'notion';
  if (event.source_type === 'meeting_reservation') return 'meeting-reservation';
  if (event.source_type === 'peer_meeting') return 'meeting';
  if (event.source_type === 'announcement_event') return 'announcement-event';
  if (event.source_type === 'holiday' || event.icon_type === 'holiday') return 'holiday';
  if (event.source_type === 'birthday' || event.icon_type === 'birthday') return 'birthday';
  if (event.source_type === 'leave' || event.icon_type === 'leave') return 'leave';
  return 'calendar';
}
