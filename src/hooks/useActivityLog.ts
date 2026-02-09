import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type ActivityActionType = 'quote_created' | 'quote_updated' | 'stage_changed' | 'quote_deleted';

export const useActivityLog = () => {
  const { user, profile } = useAuth();

  const logActivity = async (
    actionType: ActivityActionType,
    targetId: string | null,
    targetName: string,
    metadata?: Record<string, any>
  ) => {
    if (!user || !profile) return;

    try {
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        user_name: profile.full_name || user.email || '알 수 없음',
        action_type: actionType,
        target_id: targetId,
        target_name: targetName,
        metadata: metadata || {},
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  return { logActivity };
};
