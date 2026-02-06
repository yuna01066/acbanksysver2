import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface AppNotification {
  id: string;
  type: 'password_reset' | 'pending_approval';
  title: string;
  description: string;
  data?: Record<string, any>;
  created_at: string;
}

export const useNotifications = () => {
  const { user, userRole } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasViewed, setHasViewed] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!user || (userRole !== 'admin' && userRole !== 'moderator')) {
      setNotifications([]);
      return;
    }

    setLoading(true);
    const items: AppNotification[] = [];

    // Fetch pending password reset requests (admin only)
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
          });
        });
      }
    }

    // Fetch pending user approvals (admin only)
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
          });
        });
      }
    }

    items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setNotifications(items);
    setLoading(false);
  }, [user, userRole]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsViewed = useCallback(() => {
    setHasViewed(true);
  }, []);

  const unviewedCount = hasViewed ? 0 : notifications.length;

  const removeNotification = useCallback((id: string) => {
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
