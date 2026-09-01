import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type NotificationCenterRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  description: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
};

const QUERY_KEY = ['notification-center'];

export function useNotificationCenterItems(enabled = true) {
  const { user } = useAuth();
  return useQuery<NotificationCenterRow[]>({
    queryKey: [...QUERY_KEY, user?.id ?? 'anon'],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('notifications')
        .select('id, user_id, type, title, description, data, is_read, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data || []) as NotificationCenterRow[];
    },
    enabled: enabled && !!user,
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteNotifications() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from('notifications').delete().in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
