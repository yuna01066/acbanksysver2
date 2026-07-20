import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface AppNotification {
  id: string;
  type: 'password_reset' | 'pending_approval' | 'system' | 'quote_update' | 'approval_complete' | 'quote_modified' | 'leave_request' | 'leave_approved' | 'leave_rejected' | 'leave_expiry_warning' | 'leave_promotion_summary' | 'attendance_correction_request' | 'peer_feedback' | 'performance_review_summary' | 'project_mention' | 'channel_talk_quote_lead' | 'client_consultation_lead' | 'meeting_reservation' | 'meeting_reservation_status' | 'public_booking_request' | 'contract_request' | 'contract_signed' | 'contract_rejected' | 'contract_withdrawn' | 'approval_request' | 'approval_approved' | 'approval_rejected';
  title: string;
  description: string;
  data?: Record<string, any>;
  created_at: string;
  is_read?: boolean;
  source: 'admin_generated' | 'db_stored';
}

type MeetingNotificationType = 'meeting_reservation' | 'meeting_reservation_status';

type MeetingReservationNotificationState = {
  id: string;
  meeting_date: string;
  start_time: string;
  end_time: string | null;
  status: string;
};

const MEETING_NOTIFICATION_TYPES = new Set<string>(['meeting_reservation', 'meeting_reservation_status']);
const supabaseAny = supabase as any;

function getMeetingReservationId(notification: any) {
  const data = notification?.data;
  if (!data || typeof data !== 'object') return null;
  const reservationId = data.meetingReservationId;
  return typeof reservationId === 'string' && reservationId.length > 0 ? reservationId : null;
}

function getMeetingEndAt(reservation: MeetingReservationNotificationState) {
  const startAt = new Date(`${reservation.meeting_date}T${reservation.start_time || '00:00'}:00+09:00`);
  const explicitEndAt = reservation.end_time
    ? new Date(`${reservation.meeting_date}T${reservation.end_time}:00+09:00`)
    : null;

  if (explicitEndAt && !Number.isNaN(explicitEndAt.getTime()) && explicitEndAt > startAt) {
    return explicitEndAt;
  }

  if (!Number.isNaN(startAt.getTime())) {
    const fallbackEndAt = new Date(startAt);
    fallbackEndAt.setMinutes(fallbackEndAt.getMinutes() + 60);
    return fallbackEndAt;
  }

  return new Date(`${reservation.meeting_date}T23:59:59+09:00`);
}

function isMeetingNotificationType(type: string): type is MeetingNotificationType {
  return MEETING_NOTIFICATION_TYPES.has(type);
}

export const useNotifications = () => {
  const { user, userRole } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const items: AppNotification[] = [];

    // Admin-only: Fetch pending password reset requests
    if (userRole === 'admin') {
      const { data: resetRequests } = await supabase
        .from('password_reset_requests')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (resetRequests) {
        resetRequests.forEach((req: any) => {
          items.push({
            id: `reset-${req.id}`,
            type: 'password_reset',
            title: '비밀번호 초기화 요청',
            description: `${req.full_name} (${req.email})님이 비밀번호 초기화를 요청했습니다.`,
            data: { requestId: req.id, email: req.email, full_name: req.full_name, phone: req.phone },
            created_at: req.created_at,
            source: 'admin_generated',
          });
        });
      }
    }

    // Admin-only: Fetch pending user approvals
    if (userRole === 'admin') {
      const { data: pendingUsers } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_approved', false)
        .order('created_at', { ascending: false });

      if (pendingUsers) {
        pendingUsers.forEach((profile: any) => {
          items.push({
            id: `approval-${profile.id}`,
            type: 'pending_approval',
            title: '신규 가입 승인 대기',
            description: `${profile.full_name} (${profile.email})님의 가입 승인이 필요합니다.`,
            data: { userId: profile.id, email: profile.email, full_name: profile.full_name },
            created_at: profile.created_at,
            source: 'admin_generated',
          });
        });
      }
    }

    // All users: Fetch stored notifications from notifications table
    const { data: storedNotifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (storedNotifications) {
      const meetingReservationIds = Array.from(
        new Set(
          storedNotifications
            .filter((n: any) => isMeetingNotificationType(n.type))
            .map(getMeetingReservationId)
            .filter(Boolean),
        ),
      ) as string[];

      const meetingReservationsById = new Map<string, MeetingReservationNotificationState>();
      let canEvaluateMeetingNotifications = true;
      if (meetingReservationIds.length > 0) {
        const { data: meetingReservations, error: meetingReservationsError } = await supabaseAny
          .from('meeting_reservations')
          .select('id, meeting_date, start_time, end_time, status')
          .in('id', meetingReservationIds);

        if (meetingReservationsError) {
          canEvaluateMeetingNotifications = false;
        } else {
          (meetingReservations || []).forEach((reservation: MeetingReservationNotificationState) => {
            meetingReservationsById.set(reservation.id, reservation);
          });
        }
      }

      const staleNotificationIds: string[] = [];
      const activeStoredNotifications = storedNotifications.filter((n: any) => {
        if (!isMeetingNotificationType(n.type) || !canEvaluateMeetingNotifications) return true;

        const reservationId = getMeetingReservationId(n);
        if (!reservationId) return true;

        const reservation = meetingReservationsById.get(reservationId);
        const isStale =
          !reservation
          || reservation.status === 'completed'
          || reservation.status === 'canceled'
          || getMeetingEndAt(reservation).getTime() <= Date.now();

        if (isStale) staleNotificationIds.push(n.id);
        return !isStale;
      });

      if (staleNotificationIds.length > 0) {
        await supabase.from('notifications').update({ is_read: true }).in('id', staleNotificationIds);
      }

      activeStoredNotifications.forEach((n: any) => {
        items.push({
          id: `notif-${n.id}`,
          type: n.type,
          title: n.title,
          description: n.description,
          data: n.data || {},
          created_at: n.created_at,
          is_read: n.is_read,
          source: 'db_stored',
        });
      });
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(items);
    setLoading(false);
  }, [user, userRole]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`user-notifications-${user.id}`, { config: { private: true } })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const markAsViewed = useCallback(async () => {
    const unreadDbIds = notifications
      .filter(n => !n.is_read && n.source === 'db_stored')
      .map(n => n.id.replace('notif-', ''));
    if (unreadDbIds.length === 0) return;

    const previousNotifications = notifications;
    setNotifications(prev => prev.filter(n => !(n.source === 'db_stored' && !n.is_read)));

    const { error } = await supabase.from('notifications').delete().in('id', unreadDbIds);
    if (error) {
      setNotifications(previousNotifications);
      toast.error('알림 정리에 실패했습니다.');
    }
  }, [notifications]);

  const unviewedCount = notifications.filter(n => !n.is_read).length;

  const removeNotification = useCallback(async (id: string) => {
    try {
      if (id.startsWith('notif-')) {
        const dbId = id.replace('notif-', '');
        const { error } = await supabase.from('notifications').delete().eq('id', dbId);
        if (error) throw error;
      }
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch {
      toast.error('알림 정리에 실패했습니다.');
    }
  }, []);

  return {
    notifications,
    unviewedCount,
    loading,
    markAsViewed,
    removeNotification,
    refresh: fetchNotifications,
  };
};
