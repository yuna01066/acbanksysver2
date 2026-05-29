import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type EmployeeWorkStatus = 'available' | 'busy' | 'focusing' | 'meeting';

export const EMPLOYEE_WORK_STATUS_STORAGE_KEY = 'acbank.employeeWorkStatus';

export const EMPLOYEE_WORK_STATUS_CONFIG: Record<
  EmployeeWorkStatus,
  { label: string; dotClassName: string; textClassName: string }
> = {
  available: { label: '여유', dotClassName: 'bg-emerald-500', textClassName: 'text-emerald-700' },
  busy: { label: '바쁨', dotClassName: 'bg-rose-500', textClassName: 'text-rose-700' },
  focusing: { label: '집중 중', dotClassName: 'bg-amber-500', textClassName: 'text-amber-700' },
  meeting: { label: '미팅 중', dotClassName: 'bg-violet-500', textClassName: 'text-violet-700' },
};

const HEARTBEAT_INTERVAL_MS = 45_000;

export function getStoredEmployeeWorkStatus(): EmployeeWorkStatus {
  if (typeof window === 'undefined') return 'available';

  const stored = window.localStorage.getItem(EMPLOYEE_WORK_STATUS_STORAGE_KEY);
  return stored && stored in EMPLOYEE_WORK_STATUS_CONFIG
    ? (stored as EmployeeWorkStatus)
    : 'available';
}

export function setStoredEmployeeWorkStatus(status: EmployeeWorkStatus) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(EMPLOYEE_WORK_STATUS_STORAGE_KEY, status);
}

const sendHeartbeat = async () => {
  const workStatus = getStoredEmployeeWorkStatus();
  await supabase.rpc('upsert_employee_online_heartbeat' as any, {
    _work_status: workStatus,
    _user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  } as any);
};

const EmployeeOnlineHeartbeat = () => {
  const { user, isApproved, loading } = useAuth();

  useEffect(() => {
    if (loading || !user || isApproved === false) return;

    let active = true;
    const heartbeat = () => {
      if (!active) return;
      void sendHeartbeat();
    };
    const markOffline = () => {
      void supabase.rpc('mark_employee_offline' as any);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') heartbeat();
    };

    heartbeat();
    const intervalId = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', markOffline);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', markOffline);
      markOffline();
    };
  }, [isApproved, loading, user]);

  return null;
};

export default EmployeeOnlineHeartbeat;
