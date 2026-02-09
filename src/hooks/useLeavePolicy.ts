import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface LeavePolicy {
  id: string;
  policy_name: string;
  description: string | null;
  grant_basis: string;
  leave_unit: string;
  allow_advance_use: boolean;
  grant_method: string;
  auto_expire_enabled: boolean;
  auto_expire_type: string;
  smart_promotion: string;
  approver_required: boolean;
  is_default: boolean;
}

const DEFAULT_POLICY: LeavePolicy = {
  id: '',
  policy_name: '기본 연차 정책',
  description: null,
  grant_basis: 'join_date',
  leave_unit: 'day',
  allow_advance_use: false,
  grant_method: 'monthly_accrual',
  auto_expire_enabled: true,
  auto_expire_type: 'annual_monthly',
  smart_promotion: 'none',
  approver_required: false,
  is_default: true,
};

export const useLeavePolicy = () => {
  const [policy, setPolicy] = useState<LeavePolicy>(DEFAULT_POLICY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      // Try to get default policy first, fallback to first policy
      const { data } = await supabase
        .from('leave_policy_settings')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .single();
      if (data) setPolicy(data as LeavePolicy);
      setLoading(false);
    };
    fetch();
  }, []);

  /** Get unit label */
  const unitLabel = policy.leave_unit === 'hour' ? '시간' : policy.leave_unit === 'half_day' ? '반차' : '일';

  /** Check if a request exceeds remaining balance (respects allow_advance_use) */
  const canRequest = (requestDays: number, remainingDays: number): boolean => {
    if (policy.allow_advance_use) return true;
    return requestDays <= remainingDays;
  };

  return { policy, loading, unitLabel, canRequest };
};
