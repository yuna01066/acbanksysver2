import React, { useState, useEffect, useRef } from 'react';
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
  variant?: 'default' | 'compact' | 'inline';
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
  const attendanceFetchErrorShownRef = useRef(false);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAttendanceRecordForDate = async () => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  };

  const isDuplicateAttendanceError = (error: any) => {
    const message = String(error?.message || '');
    return error?.code === '23505' || message.includes('duplicate key') || message.includes('attendance_records_user_id_date');
  };

  const fetchTodayRecord = async () => {
    if (!user) return;
    setFetching(true);
    try {
      const data = await fetchAttendanceRecordForDate();
      attendanceFetchErrorShownRef.current = false;
      setTodayRecord(data);
    } catch (error: any) {
      console.warn('Today attendance fetch failed:', error);
      setTodayRecord(null);
      if (!attendanceFetchErrorShownRef.current) {
        toast.error('오늘 출퇴근 기록을 불러오지 못했습니다.', {
          description: error.message,
        });
        attendanceFetchErrorShownRef.current = true;
      }
    } finally {
      setFetching(false);
    }
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
      const existingRecord = await fetchAttendanceRecordForDate();
      if (existingRecord?.check_in) {
        setTodayRecord(existingRecord);
        toast.info(existingRecord.check_out ? '오늘 퇴근까지 완료된 기록이 있습니다.' : '오늘 출근 기록이 이미 있습니다.');
        return;
      }

      const now = new Date().toISOString();
      const recordData: any = {
        check_in: now,
        check_in_location: location,
        status: 'present',
      };
      if (locationMemo) {
        recordData.location_memo = locationMemo;
      }
      const { error } = existingRecord
        ? await supabase.from('attendance_records').update(recordData).eq('id', existingRecord.id)
        : await supabase.from('attendance_records').insert({
          ...recordData,
          user_id: user.id,
          user_name: profile.full_name || user.email || '',
          date: today,
        });
      if (error) {
        if (isDuplicateAttendanceError(error)) {
          const latestRecord = await fetchAttendanceRecordForDate();
          setTodayRecord(latestRecord);
          toast.info('오늘 출근 기록이 이미 있습니다.');
          return;
        }
        throw error;
      }
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
    if (variant === 'inline') {
      return (
        <div className="flex min-h-10 w-full items-center justify-center rounded-lg border border-border bg-muted/30 px-3 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <Card className="h-full w-full border-border bg-white shadow-none dark:bg-background">
        <CardContent className={`flex items-center justify-center p-4 ${variant === 'compact' ? 'min-h-[76px]' : 'min-h-[104px]'}`}>
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const checkedIn = !!todayRecord?.check_in;
  const checkedOut = !!todayRecord?.check_out;
  const streakCopy = checkedIn ? getAttendanceStreakCopy(attendanceStreak) : null;

  if (variant === 'inline') {
    const primaryCopy = !checkedIn ? '미출근' : checkedOut ? '퇴근 완료' : '근무 중';
    const timeCopy = !checkedIn
      ? '출근 등록이 필요합니다'
      : checkedOut
        ? `퇴근 ${format(new Date(todayRecord.check_out), 'HH:mm')}`
        : `출근 ${format(new Date(todayRecord.check_in), 'HH:mm')}`;

    return (
      <>
        <div className="flex w-full min-w-[220px] items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2 text-left dark:bg-background sm:min-w-[260px]">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">근태 관리</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${!checkedIn ? 'bg-red-500' : checkedOut ? 'bg-muted-foreground/50' : 'bg-green-500'}`} />
              <span className="truncate text-sm font-semibold text-foreground">{primaryCopy}</span>
            </div>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{timeCopy}</p>
          </div>
          <div className="shrink-0">
            {!checkedIn ? (
              <Button size="sm" onClick={() => handleInitiateAction('check_in')} disabled={loading} className="h-8 rounded-full bg-foreground px-3 text-xs text-background hover:bg-foreground/90">
                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogIn className="mr-1.5 h-3.5 w-3.5" />}
                출근
              </Button>
            ) : !checkedOut ? (
              <Button size="sm" variant="outline" onClick={() => handleInitiateAction('check_out')} disabled={loading} className="h-8 rounded-full border-border px-3 text-xs">
                {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <LogOut className="mr-1.5 h-3.5 w-3.5" />}
                퇴근
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => navigate('/attendance')} className="h-8 rounded-full px-3 text-xs">
                상세
              </Button>
            )}
          </div>
        </div>

        <LocationConfirmDialog
          open={dialogOpen}
          actionType={pendingAction || 'check_in'}
          onConfirm={handleLocationConfirm}
          onCancel={handleLocationCancel}
        />
      </>
    );
  }

  return (
    <>
      <Card className="h-full w-full border-border bg-white shadow-none dark:bg-background">
        <CardContent className={`flex h-full items-center ${variant === 'compact' ? 'min-h-[76px] p-3' : 'min-h-[104px] p-4'}`}>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`flex shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 ${variant === 'compact' ? 'h-9 w-9' : 'h-10 w-10'}`}>
                <Clock className={`${variant === 'compact' ? 'h-4 w-4' : 'h-5 w-5'} text-foreground`} />
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
                <Button size="sm" onClick={() => handleInitiateAction('check_in')} disabled={loading} className="gap-1.5 rounded-full bg-foreground text-background hover:bg-foreground/90">
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
