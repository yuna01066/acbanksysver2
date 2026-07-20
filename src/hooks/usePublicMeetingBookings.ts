import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  PublicBookingLinkDraft,
  PublicBookingLinkRow,
  PublicBookingRequestRow,
} from '@/types/publicBooking';

const supabaseAny = supabase as any;

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

async function buildLinkPayload(draft: PublicBookingLinkDraft, userId?: string | null) {
  const payload: Record<string, unknown> = {
    slug: draft.slug.trim().toLowerCase(),
    link_type: draft.link_type,
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    is_active: draft.is_active,
    allowed_resource_ids: draft.allowed_resource_ids,
    allowed_weekdays: draft.allowed_weekdays,
    start_time: normalizeTime(draft.start_time),
    end_time: normalizeTime(draft.end_time),
    slot_minutes: draft.slot_minutes,
    duration_minutes: draft.duration_minutes,
    buffer_minutes: draft.buffer_minutes,
    min_notice_minutes: draft.min_notice_minutes,
    max_days_ahead: draft.max_days_ahead,
    requires_approval: draft.requires_approval,
    notify_user_ids: draft.notify_user_ids,
    updated_at: new Date().toISOString(),
  };

  if (!draft.id && userId) payload.created_by = userId;
  if (draft.access_code?.trim()) payload.access_code_hash = await sha256Hex(draft.access_code.trim());
  if (draft.clear_access_code) payload.access_code_hash = null;

  return payload;
}

export function generatePublicBookingSlug(prefix: string) {
  const cleanPrefix = prefix
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24) || 'booking';
  const randomPart = crypto.getRandomValues(new Uint32Array(2));
  return `${cleanPrefix}-${Array.from(randomPart).map((value) => value.toString(36)).join('')}`.slice(0, 72);
}

export function getPublicBookingErrorMessage(error: unknown, fallback = '예약 처리에 실패했습니다.') {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return String(record.message || record.error || record.details || fallback);
  }
  return fallback;
}

export function usePublicBookingLinks(enabled = true) {
  return useQuery<PublicBookingLinkRow[]>({
    queryKey: ['public-booking-links'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('public_booking_links')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as PublicBookingLinkRow[];
    },
    enabled,
  });
}

export function usePublicBookingRequests(enabled = true) {
  return useQuery<PublicBookingRequestRow[]>({
    queryKey: ['public-booking-requests'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('public_booking_requests')
        .select(`
          *,
          public_booking_links (
            id,
            slug,
            title,
            link_type,
            requires_approval
          ),
          calendar_resources:resource_id (
            id,
            name,
            floor
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as PublicBookingRequestRow[];
    },
    enabled,
  });
}

export function useSavePublicBookingLink(userId?: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (draft: PublicBookingLinkDraft) => {
      if (!draft.title.trim()) throw new Error('링크 이름을 입력해주세요.');
      if (!draft.slug.trim()) throw new Error('공개 링크 주소를 입력해주세요.');
      if (draft.allowed_resource_ids.length === 0) throw new Error('회의실을 1개 이상 선택해주세요.');
      if (draft.allowed_weekdays.length === 0) throw new Error('예약 가능한 요일을 선택해주세요.');

      const payload = await buildLinkPayload(draft, userId);
      const request = draft.id
        ? supabaseAny.from('public_booking_links').update(payload).eq('id', draft.id)
        : supabaseAny.from('public_booking_links').insert(payload);
      const { data, error } = await request.select('*').single();
      if (error) throw error;
      return data as PublicBookingLinkRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-booking-links'] });
    },
  });
}

export function useConfirmPublicBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reviewNote }: { requestId: string; reviewNote?: string }) => {
      const { data, error } = await supabase.functions.invoke('public-meeting-booking', {
        body: {
          action: 'confirm-request',
          requestId,
          reviewNote: reviewNote || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return data as { eventId: string; status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-booking-requests'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-meeting-booking-card'] });
    },
  });
}

export function useRejectPublicBookingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, reviewNote }: { requestId: string; reviewNote: string }) => {
      const { data, error } = await supabase.functions.invoke('public-meeting-booking', {
        body: {
          action: 'reject-request',
          requestId,
          reviewNote,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      return data as { status: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-booking-requests'] });
    },
  });
}
