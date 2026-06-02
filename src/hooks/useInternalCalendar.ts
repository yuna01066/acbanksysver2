import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, endOfMonth, format, startOfMonth } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import type {
  CalendarDashboardSummary,
  CalendarDirectoryUser,
  CalendarEventDeletePayload,
  CalendarEventDraftPayload,
  CalendarResource,
  CalendarSubscription,
  CalendarViewScope,
  InternalCalendarEvent,
} from '@/types/internalCalendar';
import {
  DEFAULT_CALENDAR_ACCENT,
  getCalendarEventAccent,
  getCalendarEventIconType,
  type CalendarIconType,
  type CalendarSourceType,
} from '@/types/internalCalendar';

const supabaseAny = supabase as any;

export const toSeoulDateTime = (date: string, time: string) => `${date}T${time}:00+09:00`;

export const addMinutesToClockTime = (time: string, minutes: number) => {
  const [hour, minute] = time.split(':').map(Number);
  const date = new Date(2000, 0, 1, hour || 0, minute || 0);
  date.setMinutes(date.getMinutes() + minutes);
  return format(date, 'HH:mm');
};

export const getCalendarMonthRange = (month: Date) => ({
  rangeStart: startOfMonth(month).toISOString(),
  rangeEnd: addDays(endOfMonth(month), 1).toISOString(),
});

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeSourceType(value: unknown): CalendarSourceType {
  const sourceType = String(value || 'manual');
  if (
    sourceType === 'manual'
    || sourceType === 'meeting_reservation'
    || sourceType === 'peer_meeting'
    || sourceType === 'announcement_event'
    || sourceType === 'leave'
    || sourceType === 'quote'
    || sourceType === 'project'
    || sourceType === 'holiday'
    || sourceType === 'birthday'
    || sourceType === 'notion'
  ) {
    return sourceType;
  }
  return 'manual';
}

function getManualEventPresentation(sourceType: CalendarSourceType, metadata: Record<string, unknown>) {
  if (sourceType !== 'manual') {
    return {};
  }

  if (metadata.calendar_kind === 'holiday') {
    return { accent: '#ef4444', icon_type: 'holiday' as CalendarIconType, source_subtype: 'holiday' };
  }

  if (metadata.calendar_kind === 'event') {
    return { accent: '#10b981', icon_type: 'event' as CalendarIconType, source_subtype: 'event' };
  }

  return {};
}

function normalizeCalendarEvent(raw: any): InternalCalendarEvent {
  const sourceType = safeSourceType(raw?.source_type);
  const metadata = raw?.metadata && typeof raw.metadata === 'object' ? raw.metadata : {};
  const manualPresentation = getManualEventPresentation(sourceType, metadata);
  const rawSourceSubtype = raw?.source_subtype || '';
  const sourceSubtype = rawSourceSubtype && rawSourceSubtype !== 'default'
    ? rawSourceSubtype
    : manualPresentation.source_subtype || rawSourceSubtype || 'default';
  const resourceIds = Array.isArray(raw?.resource_ids) ? raw.resource_ids : [];
  const createdBy = raw?.created_by ? String(raw.created_by) : null;
  const rawParticipantIds = Array.isArray(raw?.participant_ids) ? raw.participant_ids.map(String) : [];
  const rawParticipantNames = Array.isArray(raw?.participant_names) ? raw.participant_names.map(String) : [];
  const participantEntries = rawParticipantIds
    .map((id, index) => ({ id, name: rawParticipantNames[index] }))
    .filter(({ id }) => !createdBy || id !== createdBy);
  const participantIds = participantEntries.map(({ id }) => id);
  const participantNames = rawParticipantIds.length > 0
    ? participantEntries.map(({ name }) => name).filter(Boolean)
    : rawParticipantNames.filter((name) => name !== raw?.created_by_name);
  const normalized = {
    id: String(raw?.id || crypto.randomUUID()),
    title: String(raw?.title || '일정'),
    description: raw?.description ?? null,
    starts_at: String(raw?.starts_at),
    ends_at: String(raw?.ends_at),
    all_day: Boolean(raw?.all_day),
    location: raw?.location ?? null,
    visibility: raw?.visibility || 'title_only',
    status: raw?.status || 'scheduled',
    source_type: sourceType,
    source_id: raw?.source_id ?? null,
    source_subtype: sourceSubtype,
    source_path: raw?.source_path ?? null,
    accent: manualPresentation.accent || raw?.accent || null,
    icon_type: (manualPresentation.icon_type || raw?.icon_type || null) as CalendarIconType | null,
    created_by: raw?.created_by ?? null,
    created_by_name: raw?.created_by_name || '시스템',
    team_department: raw?.team_department ?? null,
    client_name: raw?.client_name ?? null,
    client_contact: raw?.client_contact ?? null,
    participant_ids: participantIds,
    participant_names: participantNames,
    resource_ids: resourceIds,
    resource_names: Array.isArray(raw?.resource_names) ? raw.resource_names : [],
    can_edit: Boolean(raw?.can_edit) && (sourceType === 'manual' || sourceType === 'meeting_reservation'),
    is_redacted: Boolean(raw?.is_redacted),
    metadata,
  } as InternalCalendarEvent;

  return {
    ...normalized,
    accent: normalized.accent || getCalendarEventAccent(normalized) || DEFAULT_CALENDAR_ACCENT,
    icon_type: normalized.icon_type || getCalendarEventIconType(normalized),
  };
}

function eventOverlapsRange(startsAt: string, endsAt: string, rangeStart: string, rangeEnd: string) {
  return new Date(startsAt).getTime() < new Date(rangeEnd).getTime()
    && new Date(endsAt).getTime() > new Date(rangeStart).getTime();
}

function withCalendarTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2500): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]);
}

async function fetchBirthdayEvents(rangeStart: string, rangeEnd: string): Promise<InternalCalendarEvent[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, birthday')
    .eq('is_approved', true)
    .not('birthday', 'is', null);
  if (error) return [];

  const rangeStartDate = new Date(rangeStart);
  const rangeEndDate = new Date(rangeEnd);
  const events: InternalCalendarEvent[] = [];
  const startYear = rangeStartDate.getFullYear() - 1;
  const endYear = rangeEndDate.getFullYear() + 1;

  (data || []).forEach((profile) => {
    if (!profile.birthday) return;
    const parts = profile.birthday.split('-').map(Number);
    const month = parts.length >= 3 ? parts[1] : parts[0];
    const day = parts.length >= 3 ? parts[2] : parts[1];
    if (!month || !day) return;

    for (let year = startYear; year <= endYear; year += 1) {
      const birthdayDate = new Date(year, month - 1, day);
      if (Number.isNaN(birthdayDate.getTime())) continue;
      const dateString = format(birthdayDate, 'yyyy-MM-dd');
      const startsAt = toSeoulDateTime(dateString, '00:00');
      const endsAt = toSeoulDateTime(format(addDays(birthdayDate, 1), 'yyyy-MM-dd'), '00:00');
      if (!eventOverlapsRange(startsAt, endsAt, rangeStart, rangeEnd)) continue;

      events.push(normalizeCalendarEvent({
        id: `birthday-${profile.id}-${year}`,
        title: `생일 · ${profile.full_name}`,
        starts_at: startsAt,
        ends_at: endsAt,
        all_day: true,
        visibility: 'details',
        status: 'confirmed',
        source_type: 'birthday',
        source_id: profile.id,
        source_subtype: 'birthday',
        accent: '#ec4899',
        icon_type: 'birthday',
        created_by: profile.id,
        created_by_name: profile.full_name,
        can_edit: false,
        metadata: { calendar_kind: 'birthday' },
      }));
    }
  });

  return events;
}

async function fetchNotionEvents(rangeStart: string, rangeEnd: string, scope: CalendarViewScope): Promise<InternalCalendarEvent[]> {
  try {
    const [{ data: authData }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.functions.invoke('notion-projects'),
    ]);
    if (error) return [];

    const userId = authData.user?.id;
    let currentUserName = '';
    if (scope === 'my' && userId) {
      const { data: profile } = await supabase
        .from('profile_directory')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle();
      currentUserName = profile?.full_name || '';
    }

    return ((data?.projects || []) as any[])
      .filter((project) => {
        if (scope !== 'my') return true;
        if (!currentUserName) return false;
        const assigneeNames = [project.assignee, ...(Array.isArray(project.assigneeList) ? project.assigneeList : [])].filter(Boolean);
        return assigneeNames.some((name) => String(name).includes(currentUserName) || currentUserName.includes(String(name)));
      })
      .flatMap((project) => {
        const dateValue = project.date || project.startDate || project.createdDate;
        if (!dateValue) return [];
        const startDate = new Date(dateValue);
        if (Number.isNaN(startDate.getTime())) return [];
        const endDate = project.endDate ? new Date(project.endDate) : startDate;
        const normalizedEndDate = Number.isNaN(endDate.getTime()) || endDate < startDate ? startDate : endDate;
        const startsAt = toSeoulDateTime(format(startDate, 'yyyy-MM-dd'), '00:00');
        const endsAt = toSeoulDateTime(format(addDays(normalizedEndDate, 1), 'yyyy-MM-dd'), '00:00');
        if (!eventOverlapsRange(startsAt, endsAt, rangeStart, rangeEnd)) return [];

        return normalizeCalendarEvent({
          id: `notion-${project.id}`,
          title: `Notion · ${project.title || 'Untitled'}`,
          starts_at: startsAt,
          ends_at: endsAt,
          all_day: true,
          visibility: 'title_only',
          status: 'scheduled',
          source_type: 'notion',
          source_id: UUID_PATTERN.test(project.id) ? project.id : null,
          source_subtype: project.status || 'project',
          source_path: project.url || null,
          accent: '#7c3aed',
          icon_type: 'notion',
          created_by: null,
          created_by_name: project.assignee || 'Notion',
          participant_names: Array.isArray(project.assigneeList) ? project.assigneeList : [project.assignee].filter(Boolean),
          can_edit: false,
          metadata: {
            notion_id: project.id,
            status: project.status,
            assignee: project.assignee,
            calendar_kind: 'notion_project',
          },
        });
      });
  } catch {
    return [];
  }
}

export function useCalendarEvents({
  rangeStart,
  rangeEnd,
  scope = 'my',
  includeCanceled = false,
  enabled = true,
}: {
  rangeStart: string;
  rangeEnd: string;
  scope?: CalendarViewScope;
  includeCanceled?: boolean;
  enabled?: boolean;
}) {
  return useQuery<InternalCalendarEvent[]>({
    queryKey: ['calendar-events', rangeStart, rangeEnd, scope, includeCanceled],
    queryFn: async () => {
      const [{ data, error }, birthdayEvents, notionEvents] = await Promise.all([
        supabaseAny.rpc('get_calendar_events', {
          range_start: rangeStart,
          range_end: rangeEnd,
          filters: { scope, includeCanceled },
        }),
        withCalendarTimeout(fetchBirthdayEvents(rangeStart, rangeEnd), []),
        withCalendarTimeout(fetchNotionEvents(rangeStart, rangeEnd, scope), []),
      ]);
      if (error) throw error;
      return [
        ...(data || []).map(normalizeCalendarEvent),
        ...birthdayEvents,
        ...notionEvents,
      ].sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    },
    enabled,
    retry: 1,
    staleTime: 60 * 1000,
  });
}

export function useCalendarDashboardSummary({
  rangeStart,
  rangeEnd,
  scope = 'my',
  enabled = true,
}: {
  rangeStart: string;
  rangeEnd: string;
  scope?: CalendarViewScope;
  enabled?: boolean;
}) {
  return useQuery<CalendarDashboardSummary>({
    queryKey: ['calendar-dashboard-summary', rangeStart, rangeEnd, scope],
    queryFn: async () => {
      const { data, error } = await supabaseAny.rpc('get_calendar_dashboard_summary', {
        range_start: rangeStart,
        range_end: rangeEnd,
        scope,
      });
      if (error) throw error;
      return {
        today_count: Number(data?.today_count || 0),
        week_count: Number(data?.week_count || 0),
        assigned_meeting_count: Number(data?.assigned_meeting_count || 0),
        rooms_in_use_count: Number(data?.rooms_in_use_count || 0),
        next_event: data?.next_event || null,
        rooms: data?.rooms || [],
      } as CalendarDashboardSummary;
    },
    enabled,
    refetchInterval: false,
    staleTime: 30 * 1000,
  });
}

export function useCalendarResources() {
  return useQuery<CalendarResource[]>({
    queryKey: ['calendar-resources'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('calendar_resources')
        .select('id, name, resource_type, floor, description, is_active, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarResource[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarDirectory() {
  return useQuery<CalendarDirectoryUser[]>({
    queryKey: ['calendar-directory-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_directory')
        .select('id, full_name, department, position, avatar_url')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarDirectoryUser[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCalendarSubscriptions(userId?: string | null) {
  return useQuery<CalendarSubscription[]>({
    queryKey: ['calendar-subscriptions', userId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('calendar_subscriptions')
        .select('*')
        .eq('subscriber_id', userId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as CalendarSubscription[];
    },
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CalendarEventDraftPayload) => {
      const { data, error } = await supabaseAny.rpc('create_calendar_event', { payload });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CalendarEventDraftPayload & { id: string }) => {
      const { data, error } = await supabaseAny.rpc('update_calendar_event', { payload });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CalendarEventDeletePayload) => {
      const { data, error } = await supabaseAny.rpc('delete_calendar_event', { payload });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-meeting-reservations'] });
    },
  });
}
