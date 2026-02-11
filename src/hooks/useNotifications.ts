import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  type: 'password_reset' | 'pending_approval' | 'system' | 'quote_update' | 'approval_complete' | 'quote_modified' | 'leave_request' | 'leave_approved' | 'leave_rejected' | 'leave_expiry_warning' | 'leave_promotion_summary' | 'peer_feedback' | 'performance_review_summary' | 'project_mention';
  title: string;
  description: string;
  data?: Record<string, any>;
  created_at: string;
  is_read?: boolean;
  source: 'admin_generated' | 'db_stored';
}

export const useNotifications = () => {
  const { user, userRole } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

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
      .order('created_at', { ascending: false })
      .limit(50);

    if (storedNotifications) {
      storedNotifications.forEach((n: any) => {
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
    setHasViewed(false);
  }, [user, userRole]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('user-notifications')
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
    setHasViewed(true);
    // Mark all unread db-stored notifications as read
    const unreadDbIds = notifications
      .filter(n => !n.is_read && n.source === 'db_stored')
      .map(n => n.id.replace('notif-', ''));
    if (unreadDbIds.length > 0) {
      await supabase.from('notifications').update({ is_read: true }).in('id', unreadDbIds);
      setNotifications(prev => prev.map(n => n.source === 'db_stored' ? { ...n, is_read: true } : n));
    }
  }, [notifications]);

  const unviewedCount = hasViewed ? 0 : notifications.filter(n => !n.is_read).length;

  const removeNotification = useCallback(async (id: string) => {
    // If it's a stored notification, delete from DB
    if (id.startsWith('notif-')) {
      const dbId = id.replace('notif-', '');
      await supabase.from('notifications').delete().eq('id', dbId);
    }
    setNotifications(prev => prev.filter(n => n.id !== id));
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
