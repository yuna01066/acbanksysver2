import { DASHBOARD_SOURCE_COLORS } from '@/utils/dashboardSemanticColors';

export type CalendarEventStatus = 'scheduled' | 'confirmed' | 'completed' | 'canceled';
export type CalendarEventVisibility = 'private' | 'busy_only' | 'title_only' | 'details';
export type CalendarSourceType =
  | 'manual'
  | 'meeting_reservation'
  | 'peer_meeting'
  | 'announcement_event'
  | 'leave'
  | 'quote'
  | 'project'
  | 'holiday'
  | 'birthday'
  | 'notion'
  | 'external_booking';
export type CalendarResourceType = 'meeting_room';
export type CalendarViewScope = 'my' | 'all' | 'team';
export type CalendarParticipantRole = 'organizer' | 'attendee' | 'assignee';
export type CalendarDeleteMode = 'cancel' | 'hard_delete';
export type CalendarTaskPriority = 'low' | 'normal' | 'high';
export type CalendarTaskStatus = 'open' | 'completed' | 'archived';
export type CalendarRecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
export type CalendarViewMode = 'month' | 'week' | 'day';
export type CalendarTeamRole = 'owner' | 'member';
export type CalendarIconType =
  | 'calendar'
  | 'quote'
  | 'delivery'
  | 'project'
  | 'meeting'
  | 'meeting_reservation'
  | 'holiday'
  | 'birthday'
  | 'leave'
  | 'event'
  | 'notion'
  | 'room';

export type InternalCalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location: string | null;
  visibility: CalendarEventVisibility;
  status: CalendarEventStatus;
  source_type: CalendarSourceType;
  source_id: string | null;
  source_subtype: string;
  source_path: string | null;
  accent: string | null;
  icon_type: CalendarIconType | null;
  recurrence_rule: CalendarRecurrenceRule | null;
  recurrence_parent_id: string | null;
  recurrence_exception_date: string | null;
  reminder_minutes: number[];
  series_event_id: string | null;
  series_starts_at: string | null;
  series_ends_at: string | null;
  occurrence_date: string | null;
  is_recurring_occurrence: boolean;
  created_by: string | null;
  created_by_name: string;
  team_department: string | null;
  client_name: string | null;
  client_contact: string | null;
  participant_ids: string[];
  participant_names: string[];
  resource_ids: string[];
  resource_names: string[];
  can_edit: boolean;
  is_redacted: boolean;
  metadata: Record<string, unknown>;
};

export type CalendarRecurrenceRule = {
  frequency: Exclude<CalendarRecurrenceFrequency, 'none'>;
  interval?: number;
  until?: string | null;
  weekdays?: number[];
};

export type CalendarTask = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  task_date: string;
  priority: CalendarTaskPriority;
  status: CalendarTaskStatus;
  linked_event_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CalendarTaskDraftPayload = {
  id?: string;
  title: string;
  description?: string | null;
  task_date: string;
  priority?: CalendarTaskPriority;
  status?: CalendarTaskStatus;
  linked_event_id?: string | null;
};

export type CalendarUserSettings = {
  user_id: string;
  default_view: CalendarViewMode;
  visible_calendar_keys: string[];
  source_filters: CalendarSourceFilter[];
  calendar_colors: Record<string, string>;
  week_starts_on: number;
  workday_start: string;
  workday_end: string;
  created_at?: string;
  updated_at?: string;
};

export type CalendarUserSettingsDraft = Partial<Omit<CalendarUserSettings, 'user_id' | 'created_at' | 'updated_at'>>;

export type CalendarDiaryEntry = {
  id: string;
  owner_id: string;
  diary_date: string;
  content: string;
  created_at: string;
  updated_at: string;
};

export type CalendarTeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: CalendarTeamRole;
  full_name: string;
  department: string | null;
  position: string | null;
};

export type CalendarTeam = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  members: CalendarTeamMember[];
};

export type CalendarTeamDraftPayload = {
  id?: string;
  name: string;
  description?: string | null;
  color?: string;
  member_ids: string[];
};

export type CalendarResource = {
  id: string;
  name: string;
  resource_type: CalendarResourceType;
  floor: string | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
};

export type CalendarSubscriptionTargetType = 'user' | 'team' | 'resource';

export type CalendarSubscription = {
  id: string;
  subscriber_id: string;
  target_type: CalendarSubscriptionTargetType;
  target_user_id: string | null;
  target_department: string | null;
  target_resource_id: string | null;
  display_name: string | null;
  color: string | null;
  is_visible: boolean;
  display_order?: number;
};

export type CalendarDirectoryUser = {
  id: string;
  full_name: string;
  department: string | null;
  position: string | null;
  avatar_url?: string | null;
};

export type CalendarEventDraftPayload = {
  id?: string;
  title: string;
  description?: string | null;
  starts_at: string;
  ends_at: string;
  all_day?: boolean;
  location?: string | null;
  visibility?: CalendarEventVisibility;
  status?: CalendarEventStatus;
  source_type?: CalendarSourceType;
  source_id?: string | null;
  source_subtype?: string;
  source_path?: string | null;
  accent?: string | null;
  icon_type?: CalendarIconType | null;
  team_department?: string | null;
  recipient_id?: string | null;
  client_name?: string | null;
  client_contact?: string | null;
  participant_ids?: string[];
  assignee_ids?: string[];
  resource_ids?: string[];
  metadata?: Record<string, unknown>;
  recurrence_rule?: CalendarRecurrenceRule | null;
  reminder_minutes?: number[];
};

export type CalendarEventDeletePayload = {
  id: string;
  mode: CalendarDeleteMode;
};

export type CalendarRoomSummaryEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
} | null;

export type CalendarRoomSummary = {
  id: string;
  name: string;
  floor: string | null;
  is_active: boolean;
  current_event: CalendarRoomSummaryEvent;
  next_event: CalendarRoomSummaryEvent;
};

export type CalendarDashboardSummary = {
  today_count: number;
  week_count: number;
  assigned_meeting_count: number;
  rooms_in_use_count: number;
  next_event: InternalCalendarEvent | null;
  rooms: CalendarRoomSummary[];
};

export const CALENDAR_STATUS_LABELS: Record<CalendarEventStatus, string> = {
  scheduled: '예정',
  confirmed: '확정',
  completed: '완료',
  canceled: '취소',
};

export const CALENDAR_VISIBILITY_LABELS: Record<CalendarEventVisibility, string> = {
  private: '비공개',
  busy_only: '바쁨만 공개',
  title_only: '제목까지 공개',
  details: '상세 공개',
};

export type CalendarSourceFilter = 'quote' | 'project' | 'meeting' | 'people' | 'room';

export const CALENDAR_SOURCE_FILTERS: Array<{
  value: CalendarSourceFilter;
  label: string;
  description: string;
}> = [
  { value: 'quote', label: '견적·납기', description: '견적 발행일과 납기 희망일' },
  { value: 'project', label: '프로젝트', description: '프로젝트와 Notion 일정' },
  { value: 'meeting', label: '미팅', description: '직원/고객/공지 미팅' },
  { value: 'people', label: '인사 일정', description: '휴가, 휴일, 생일' },
  { value: 'room', label: '회의실', description: '회의실 예약 현황' },
];

export const CALENDAR_EVENT_LEGEND: Array<{
  key: string;
  label: string;
  sourceType: CalendarSourceType;
  sourceSubtype?: string;
  iconType: CalendarIconType;
  accent: string;
}> = [
  { key: 'quote-issued', label: '견적 발행일', sourceType: 'quote', sourceSubtype: 'issued', iconType: 'quote', accent: DASHBOARD_SOURCE_COLORS['quote-issued'].accent },
  { key: 'quote-delivery', label: '납기 예정일', sourceType: 'quote', sourceSubtype: 'delivery', iconType: 'delivery', accent: DASHBOARD_SOURCE_COLORS['quote-delivery'].accent },
  { key: 'quote-delivery-completed', label: '납기 완료', sourceType: 'quote', sourceSubtype: 'delivered', iconType: 'delivery', accent: DASHBOARD_SOURCE_COLORS['quote-delivery-completed'].accent },
  { key: 'project', label: '프로젝트', sourceType: 'project', iconType: 'project', accent: DASHBOARD_SOURCE_COLORS.project.accent },
  { key: 'notion', label: 'Notion 프로젝트', sourceType: 'notion', iconType: 'notion', accent: DASHBOARD_SOURCE_COLORS.notion.accent },
  { key: 'meeting', label: '미팅', sourceType: 'peer_meeting', iconType: 'meeting', accent: DASHBOARD_SOURCE_COLORS.meeting.accent },
  { key: 'meeting-reservation', label: '미팅 예약', sourceType: 'meeting_reservation', iconType: 'meeting_reservation', accent: DASHBOARD_SOURCE_COLORS['meeting-reservation'].accent },
  { key: 'external-booking', label: '외부 예약', sourceType: 'external_booking', iconType: 'room', accent: DASHBOARD_SOURCE_COLORS.room.accent },
  { key: 'announcement-event', label: '이벤트', sourceType: 'announcement_event', iconType: 'event', accent: DASHBOARD_SOURCE_COLORS['announcement-event'].accent },
  { key: 'holiday', label: '휴일', sourceType: 'holiday', iconType: 'holiday', accent: DASHBOARD_SOURCE_COLORS.holiday.accent },
  { key: 'birthday', label: '생일', sourceType: 'birthday', iconType: 'birthday', accent: DASHBOARD_SOURCE_COLORS.birthday.accent },
  { key: 'leave', label: '휴가', sourceType: 'leave', iconType: 'leave', accent: DASHBOARD_SOURCE_COLORS.leave.accent },
];

export const DEFAULT_CALENDAR_ACCENT = '#111111';

type DeliveryCalendarEventLike = Pick<InternalCalendarEvent, 'source_type' | 'source_subtype'> & Partial<Pick<InternalCalendarEvent, 'status' | 'title' | 'metadata'>>;

export function isCompletedDeliveryCalendarEvent(event: DeliveryCalendarEventLike) {
  if (event.source_type !== 'quote') return false;

  const metadata = event.metadata && typeof event.metadata === 'object'
    ? event.metadata as Record<string, unknown>
    : {};
  const projectStage = typeof metadata.project_stage === 'string' ? metadata.project_stage : null;
  const deliveryState = typeof metadata.delivery_state === 'string' ? metadata.delivery_state : null;
  const calendarKind = typeof metadata.calendar_kind === 'string' ? metadata.calendar_kind : null;

  if (event.source_subtype === 'delivered' || event.source_subtype === 'delivery_completed') return true;
  if (event.source_subtype !== 'delivery') return false;

  return event.status === 'completed'
    || projectStage === 'delivered'
    || deliveryState === 'completed'
    || (calendarKind === 'quote_delivery' && typeof event.title === 'string' && event.title.startsWith('납기 완료'));
}

export function getCalendarEventAccent(event: Pick<InternalCalendarEvent, 'accent' | 'source_type' | 'source_subtype' | 'resource_ids'> & Partial<Pick<InternalCalendarEvent, 'status' | 'title' | 'metadata'>>) {
  if (isCompletedDeliveryCalendarEvent(event)) return DASHBOARD_SOURCE_COLORS['quote-delivery-completed'].accent;
  if (event.resource_ids.length > 0) return DASHBOARD_SOURCE_COLORS.room.accent;
  const matched = CALENDAR_EVENT_LEGEND.find((item) =>
    item.sourceType === event.source_type
    && (!item.sourceSubtype || item.sourceSubtype === event.source_subtype),
  );
  if (event.source_type !== 'manual' && matched?.accent) return matched.accent;
  return event.accent || matched?.accent || DEFAULT_CALENDAR_ACCENT;
}

export function getCalendarEventStatusLabel(event: Pick<InternalCalendarEvent, 'status' | 'source_type' | 'source_subtype'> & Partial<Pick<InternalCalendarEvent, 'title' | 'metadata'>>) {
  if (isCompletedDeliveryCalendarEvent(event)) return CALENDAR_STATUS_LABELS.completed;
  return CALENDAR_STATUS_LABELS[event.status];
}

export function getCalendarEventIconType(event: Pick<InternalCalendarEvent, 'icon_type' | 'source_type' | 'source_subtype' | 'resource_ids'>): CalendarIconType {
  if (event.icon_type) return event.icon_type;
  if (event.resource_ids.length > 0) return 'room';
  const matched = CALENDAR_EVENT_LEGEND.find((item) =>
    item.sourceType === event.source_type
    && (!item.sourceSubtype || item.sourceSubtype === event.source_subtype),
  );
  return matched?.iconType || 'calendar';
}

export function getCalendarSourceFilter(event: Pick<InternalCalendarEvent, 'source_type' | 'resource_ids' | 'icon_type'>): CalendarSourceFilter {
  if (event.resource_ids.length > 0) return 'room';
  if (event.icon_type === 'holiday' || event.icon_type === 'birthday' || event.icon_type === 'leave') return 'people';
  if (event.icon_type === 'event') return 'meeting';
  if (event.source_type === 'quote') return 'quote';
  if (event.source_type === 'project' || event.source_type === 'notion') return 'project';
  if (event.source_type === 'leave' || event.source_type === 'holiday' || event.source_type === 'birthday') return 'people';
  if (event.source_type === 'external_booking') return 'room';
  return 'meeting';
}

export function shouldShowUnspecifiedCalendarTime(event: Pick<InternalCalendarEvent, 'all_day' | 'source_type'>) {
  return event.all_day && (
    event.source_type === 'quote'
    || event.source_type === 'project'
    || event.source_type === 'notion'
  );
}
