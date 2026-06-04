import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Award, LogIn, LogOut, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import LocationConfirmDialog from '@/components/attendance/LocationConfirmDialog';
import {
  calculateCurrentWeekAttendanceStreak,
  getAttendanceStreakCopy,
  getWeekdayKeysThroughToday,
} from '@/utils/engagement';
import { triggerHamzzi } from '@/lib/hamzziEvents';

interface QuickAttendanceButtonProps {
  onAttendanceChanged?: () => void;
  variant?: 'default' | 'compact';
}

const QuickAttendanceButton = ({ onAttendanceChanged, variant = 'default' }: QuickAttendanceButtonProps = {}) => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'check_in' | 'check_out' | null>(null);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [attendanceStreak, setAttendanceStreak] = useState(0);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchTodayRecord = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .maybeSingle();
    setTodayRecord(data);
    setFetching(false);
  };

  const fetchAttendanceStreak = async () => {
    if (!user) return 0;

    const weekKeys = getWeekdayKeysThroughToday();
    const weekStart = weekKeys[0];
    const weekEnd = weekKeys[weekKeys.length - 1];

    if (!weekStart || !weekEnd) {
      setAttendanceStreak(0);
      return 0;
    }

    const { data, error } = await supabase
      .from('attendance_records')
      .select('date, check_in, status')
      .eq('user_id', user.id)
      .gte('date', weekStart)
      .lte('date', weekEnd);

    if (error) {
      console.warn('Attendance streak fetch failed:', error);
      setAttendanceStreak(0);
      return 0;
    }

    const streak = calculateCurrentWeekAttendanceStreak(data || []);
    setAttendanceStreak(streak);
    return streak;
  };

  useEffect(() => {
    fetchTodayRecord();
    fetchAttendanceStreak();
  }, [user]);

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve(null),
        { timeout: 5000 }
      );
    });
  };

  const isOutsideWorkplace = async (location: { lat: number; lng: number } | null): Promise<boolean> => {
    if (!location) return false;

    const { data, error } = await supabase.rpc('check_workplace_distance' as any, {
      input_lat: location.lat,
      input_lng: location.lng,
    } as any);

    if (error) {
      console.warn('Workplace distance check failed:', error);
      return false;
    }

    const result = Array.isArray(data) ? data[0] : data;
    return Boolean(result?.outside);
  };

  const handleInitiateAction = async (action: 'check_in' | 'check_out') => {
    setLoading(true);
    try {
      const location = await getLocation();
      if (await isOutsideWorkplace(location)) {
        setPendingAction(action);
        setPendingLocation(location);
        setDialogOpen(true);
        setLoading(false);
        return;
      }
      if (action === 'check_in') {
        await performCheckIn(location, null);
      } else {
        await performCheckOut(location, null);
      }
    } catch {
      setLoading(false);
    }
  };

  const performCheckIn = async (location: { lat: number; lng: number } | null, locationMemo: string | null) => {
    if (!user || !profile) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const insertData: any = {
        user_id: user.id,
        user_name: profile.full_name || user.email || '',
        date: today,
        check_in: now,
        check_in_location: location,
        status: 'present',
      };
      if (locationMemo) {
        insertData.location_memo = locationMemo;
      }
      const { error } = await supabase.from('attendance_records').insert(insertData);
      if (error) throw error;
      fetchTodayRecord();
      const streak = await fetchAttendanceStreak();
      const streakCopy = getAttendanceStreakCopy(streak);
      toast.success('출근이 기록되었습니다.', {
        description: streakCopy || undefined,
      });
      triggerHamzzi('attendance_check_in', {
        message: '출근 기록 완료. 오늘 업무 시작합니다.',
        description: streakCopy || undefined,
      });
      onAttendanceChanged?.();
    } catch (e: any) {
      toast.error('출근 기록 실패: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const performCheckOut = async (location: { lat: number; lng: number } | null, locationMemo: string | null) => {
    if (!todayRecord) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const updateData: any = {
        check_out: now,
        check_out_location: location,
        status: 'checked_out',
      };
      if (locationMemo) {
        updateData.location_memo = (todayRecord.location_memo ? todayRecord.location_memo + ' | ' : '') + `퇴근: ${locationMemo}`;
      }
      const { error } = await supabase
        .from('attendance_records')
        .update(updateData)
        .eq('id', todayRecord.id);
      if (error) throw error;
      toast.success('퇴근이 기록되었습니다.');
      triggerHamzzi('attendance_check_out');
      fetchTodayRecord();
      onAttendanceChanged?.();
    } catch (e: any) {
      toast.error('퇴근 기록 실패: ' + (e.message || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleLocationConfirm = (memo: string) => {
    setDialogOpen(false);
    if (pendingAction === 'check_in') {
      performCheckIn(pendingLocation, memo);
    } else if (pendingAction === 'check_out') {
      performCheckOut(pendingLocation, memo);
    }
    setPendingAction(null);
    setPendingLocation(null);
  };

  const handleLocationCancel = () => {
    setDialogOpen(false);
    setPendingAction(null);
    setPendingLocation(null);
    setLoading(false);
    toast.info('출퇴근 등록이 취소되었습니다.');
  };

  if (fetching) {
    return (
      <Card className="h-full w-full border-primary/10 bg-background/75 shadow-sm">
        <CardContent className={`flex items-center justify-center p-4 ${variant === 'compact' ? 'min-h-[76px]' : 'min-h-[104px]'}`}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;
  const streakCopy = checkedIn ? getAttendanceStreakCopy(attendanceStreak) : null;

  return (
    <>
      <Card className="h-full w-full border-primary/10 bg-background/75 shadow-sm">
        <CardContent className={`flex h-full items-center ${variant === 'compact' ? 'min-h-[76px] p-3' : 'min-h-[104px] p-4'}`}>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/10 ${variant === 'compact' ? 'h-9 w-9' : 'h-10 w-10'}`}>
                <Clock className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} text-primary`} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">근태 관리</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {checkedIn && (
                    <Badge variant="secondary" className="text-xs">
                      출근 {format(new Date(todayRecord.check_in), 'HH:mm')}
                    </Badge>
                  )}
                  {checkedOut && (
                    <Badge variant="outline" className="text-xs">
                      퇴근 {format(new Date(todayRecord.check_out), 'HH:mm')}
                    </Badge>
                  )}
                  {!checkedIn && (
                    <span className="text-xs text-muted-foreground">미출근</span>
                  )}
                </div>
                {streakCopy && (
                  <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                    <Award className="h-3.5 w-3.5" />
                    <span>{streakCopy}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              {!checkedIn ? (
                <Button size="sm" onClick={() => handleInitiateAction('check_in')} disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                  출근
                </Button>
              ) : !checkedOut ? (
                <Button size="sm" variant="outline" onClick={() => handleInitiateAction('check_out')} disabled={loading} className="gap-1.5">
                  {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  퇴근
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => navigate('/attendance')} className="gap-1.5 text-xs">
                  상세보기
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <LocationConfirmDialog
        open={dialogOpen}
        actionType={pendingAction || 'check_in'}
        onConfirm={handleLocationConfirm}
        onCancel={handleLocationCancel}
      />
    </>
  );
};

export default QuickAttendanceButton;
