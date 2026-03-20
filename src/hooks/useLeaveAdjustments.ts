import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeaveAdjustment {
  id: string;
  user_id: string;
  user_name: string;
  adjustment_type: string;
  days: number;
  leave_category: string;
  reason: string | null;
  granted_by: string;
  granted_by_name: string;
  effective_date: string;
  expires_at: string | null;
  created_at: string;
}

export const useLeaveAdjustments = (userId?: string) => {
  const [adjustments, setAdjustments] = useState<LeaveAdjustment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('leave_adjustments')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;
    if (data) setAdjustments(data as LeaveAdjustment[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchAdjustments();
  }, [fetchAdjustments]);

  /** Calculate net adjustment days for a user, optionally by category */
  const getNetAdjustment = (uid: string, category?: string): number => {
    return adjustments
      .filter(a => {
        if (a.user_id !== uid) return false;
        if (category && a.leave_category !== category) return false;
        // Check expiration
        if (a.expires_at && new Date(a.expires_at) < new Date()) return false;
        // Check effective date
        if (new Date(a.effective_date) > new Date()) return false;
        return true;
      })
      .reduce((sum, a) => {
        return sum + (a.adjustment_type === 'grant' ? Number(a.days) : -Number(a.days));
      }, 0);
  };

  const deleteAdjustment = async (id: string) => {
    const { error } = await supabase.from('leave_adjustments').delete().eq('id', id);
    if (!error) await fetchAdjustments();
    return error;
  };

  return { adjustments, loading, refresh: fetchAdjustments, getNetAdjustment, deleteAdjustment };
};
