import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock, LogIn, LogOut, MapPin, CalendarDays, Plus, Loader2, Check, X, BarChart3, Pencil, Search, AlertTriangle, Trash2, ChevronLeft, ChevronRight, CalendarCheck, Timer, Palmtree, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { triggerHamzzi } from '@/lib/hamzziEvents';
import AttendanceEditDialog from '@/components/attendance/AttendanceEditDialog';
import AttendanceCalendarView from '@/components/attendance/AttendanceCalendarView';
import LocationConfirmDialog from '@/components/attendance/LocationConfirmDialog';
import ScrollTimePicker from '@/components/ui/scroll-time-picker';
import AttendanceDashboard from '@/components/attendance/AttendanceDashboard';
import OvertimeDetectionPanel from '@/components/attendance/OvertimeDetectionPanel';
import MonthlyAttendanceReport from '@/components/attendance/MonthlyAttendanceReport';
import DepartmentWorkPatternAnalysis from '@/components/attendance/DepartmentWorkPatternAnalysis';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';

const LEAVE_TYPES = [
  { value: 'annual', label: '연차' },
  { value: 'half_day', label: '반차' },
  { value: 'sick', label: '병가' },
  { value: 'personal', label: '경조사' },
  { value: 'other', label: '기타' },
];

const LEAVE_STATUS = {
  pending: { label: '대기중', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  approved: { label: '승인', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  rejected: { label: '거부', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
};

type AttendanceAction = 'check_in' | 'check_out';
type AttendanceLocation = { lat: number; lng: number } | null;

const ATTENDANCE_STATUS_META: Record<string, { label: string; className: string }> = {
  checked_out: {
    label: '퇴근 완료',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  checked_in: {
    label: '근무 중',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  present: {
    label: '근무 중',
    className: 'border-sky-200 bg-sky-50 text-sky-700',
  },
  absent: {
    label: '결근',
    className: 'border-red-200 bg-red-50 text-red-700',
  },
  late: {
    label: '지각',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  early_leave: {
    label: '조퇴',
    className: 'border-orange-200 bg-orange-50 text-orange-700',
  },
};

const getAttendanceStatusMeta = (status?: string | null) => {
  if (!status) {
    return {
      label: '미기록',
      className: 'border-border bg-muted/50 text-muted-foreground',
    };
  }

  return ATTENDANCE_STATUS_META[status] || {
    label: status,
    className: 'border-border bg-muted/50 text-muted-foreground',
  };
};

const getQueryErrorMessage = (error: unknown) => {
  if (!error) return '';
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    return String((error as { message?: unknown }).message || '알 수 없는 오류');
  }
  return String(error);
};

const isDuplicateAttendanceError = (error: any) => {
  const message = String(error?.message || '');
  return error?.code === '23505' || message.includes('duplicate key') || message.includes('attendance_records_user_id_date');
};

const AttendancePage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, isModerator, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [gettingLocation, setGettingLocation] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ leaveType: 'annual', startDate: new Date(), endDate: new Date(), reason: '' });
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [adminTab, setAdminTab] = useState('my');
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [filterDate, setFilterDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCheckIn, setBulkCheckIn] = useState('');
  const [bulkCheckOut, setBulkCheckOut] = useState('');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ userId: '', userName: '', date: '', checkIn: '09:00', checkOut: '18:00', status: 'checked_out', memo: '' });
  const [manualSaving, setManualSaving] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [pendingAttendanceAction, setPendingAttendanceAction] = useState<AttendanceAction | null>(null);
  const [pendingLocation, setPendingLocation] = useState<AttendanceLocation>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const today = format(new Date(), 'yyyy-MM-dd');

  const fetchAttendanceRecordForDate = async (userId: string, date: string) => {
    const { data, error } = await supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    return data?.[0] || null;
  };

  // Today's attendance record
  const { data: todayRecord, isLoading: todayLoading, error: todayRecordError } = useQuery({
    queryKey: ['attendance-today', user?.id, today],
    queryFn: async () => {
      return fetchAttendanceRecordForDate(user!.id, today);
    },
    enabled: !!user,
  });

  // Monthly attendance
  const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: monthlyRecords = [], error: monthlyRecordsError } = useQuery({
    queryKey: ['attendance-monthly', adminTab === 'all' ? 'all' : user?.id, monthStart],
    queryFn: async () => {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (adminTab !== 'all') query = query.eq('user_id', user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Employee list for manual registration
  const { data: employees = [], error: employeesError } = useQuery({
    queryKey: ['all-employees-for-attendance'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('profile_directory' as any) as any).select('id, full_name, department').order('full_name');
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && (isAdmin || isModerator),
  });

  // Leave requests
  const { data: leaveRequests = [], error: leaveRequestsError } = useQuery({
    queryKey: ['leave-requests', adminTab === 'all' ? 'all' : user?.id],
    queryFn: async () => {
      let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
      if (adminTab !== 'all') query = query.eq('user_id', user!.id);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const getLocation = (): Promise<{ lat: number; lng: number } | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        toast.warning('위치 서비스를 지원하지 않는 브라우저입니다.');
        resolve(null);
        return;
      }
      setGettingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGettingLocation(false);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {
          setGettingLocation(false);
          toast.warning('위치 정보를 가져올 수 없습니다. 위치 없이 기록됩니다.');
          resolve(null);
        },
        { timeout: 10000 }
      );
    });
  };

  const isOutsideWorkplace = async (location: AttendanceLocation): Promise<boolean> => {
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

  const checkInMutation = useMutation({
    mutationFn: async ({ location, locationMemo }: { location: AttendanceLocation; locationMemo?: string | null }) => {
      const existingRecord = await fetchAttendanceRecordForDate(user!.id, today);
      if (existingRecord?.check_in) {
        return { alreadyRecorded: true, checkedOut: Boolean(existingRecord.check_out) };
      }

      const checkInData: any = {
        check_in: new Date().toISOString(),
        check_in_location: location,
        location_memo: locationMemo || null,
        status: 'checked_in',
      };

      const { error } = existingRecord
        ? await supabase.from('attendance_records').update(checkInData).eq('id', existingRecord.id)
        : await supabase.from('attendance_records').insert({
          ...checkInData,
          user_id: user!.id,
          user_name: profile?.full_name || user!.email || '',
          date: today,
        });
      if (error) {
        if (isDuplicateAttendanceError(error)) {
          return { alreadyRecorded: true, checkedOut: false };
        }
        throw error;
      }
      return { alreadyRecorded: false, checkedOut: false };
    },
    onSuccess: (result) => {
      if (result?.alreadyRecorded) {
        toast.info(result.checkedOut ? '오늘 퇴근까지 완료된 기록이 있습니다.' : '오늘 출근 기록이 이미 있습니다.');
        queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
        queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
        return;
      }
      toast.success('출근이 기록되었습니다.');
      triggerHamzzi('attendance_check_in');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
      queryClient.invalidateQueries({ queryKey: ['employee-online-status'] });
    },
    onError: (err: any) => toast.error('출근 기록 실패: ' + err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: async ({ location, locationMemo }: { location: AttendanceLocation; locationMemo?: string | null }) => {
      const updateData: any = {
        check_out: new Date().toISOString(),
        check_out_location: location,
        status: 'checked_out',
      };

      if (locationMemo) {
        updateData.location_memo = (todayRecord?.location_memo ? `${todayRecord.location_memo} | ` : '') + `퇴근: ${locationMemo}`;
      }

      const { error } = await supabase
        .from('attendance_records')
        .update(updateData)
        .eq('id', todayRecord!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('퇴근이 기록되었습니다.');
      triggerHamzzi('attendance_check_out');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
      queryClient.invalidateQueries({ queryKey: ['employee-online-status'] });
    },
    onError: (err: any) => toast.error('퇴근 기록 실패: ' + err.message),
  });

  const handleAttendanceAction = async (action: AttendanceAction) => {
    const location = await getLocation();
    if (await isOutsideWorkplace(location)) {
      setPendingAttendanceAction(action);
      setPendingLocation(location);
      setLocationDialogOpen(true);
      return;
    }

    if (action === 'check_in') {
      checkInMutation.mutate({ location, locationMemo: null });
    } else {
      checkOutMutation.mutate({ location, locationMemo: null });
    }
  };

  const handleLocationConfirm = (memo: string) => {
    setLocationDialogOpen(false);
    if (pendingAttendanceAction === 'check_in') {
      checkInMutation.mutate({ location: pendingLocation, locationMemo: memo });
    } else if (pendingAttendanceAction === 'check_out') {
      checkOutMutation.mutate({ location: pendingLocation, locationMemo: memo });
    }
    setPendingAttendanceAction(null);
    setPendingLocation(null);
  };

  const handleLocationCancel = () => {
    setLocationDialogOpen(false);
    setPendingAttendanceAction(null);
    setPendingLocation(null);
    toast.info('출퇴근 등록이 취소되었습니다.');
  };

  const submitLeaveMutation = useMutation({
    mutationFn: async () => {
      const days = leaveForm.leaveType === 'half_day'
        ? 0.5
        : differenceInDays(leaveForm.endDate, leaveForm.startDate) + 1;
      const { error } = await supabase.from('leave_requests').insert({
        user_id: user!.id,
        user_name: profile?.full_name || '',
        leave_type: leaveForm.leaveType,
        start_date: format(leaveForm.startDate, 'yyyy-MM-dd'),
        end_date: format(leaveForm.endDate, 'yyyy-MM-dd'),
        days,
        reason: leaveForm.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('휴가 신청이 완료되었습니다.');
      setLeaveDialogOpen(false);
      setLeaveForm({ leaveType: 'annual', startDate: new Date(), endDate: new Date(), reason: '' });
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    },
    onError: (err: any) => toast.error('신청 실패: ' + err.message),
  });

  const handleLeaveAction = async (id: string, action: 'approved' | 'rejected', rejectReason?: string) => {
    const { error } = await supabase.from('leave_requests').update({
      status: action,
      approved_by: user!.id,
      approved_by_name: profile?.full_name || '',
      approved_at: new Date().toISOString(),
      reject_reason: rejectReason || null,
    }).eq('id', id);
    if (error) {
      toast.error('처리 실패');
    } else {
      toast.success(action === 'approved' ? '승인되었습니다.' : '거부되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
    }
  };

  const handleManualAttendanceAdd = async () => {
    if (!manualForm.userId || !manualForm.date) { toast.warning('직원과 날짜를 선택해주세요.'); return; }
    setManualSaving(true);
    try {
      const checkIn = manualForm.checkIn ? new Date(`${manualForm.date}T${manualForm.checkIn}:00+09:00`).toISOString() : null;
      const checkOut = manualForm.checkOut ? new Date(`${manualForm.date}T${manualForm.checkOut}:00+09:00`).toISOString() : null;
      const existingRecord = await fetchAttendanceRecordForDate(manualForm.userId, manualForm.date);
      const manualData = {
        user_name: manualForm.userName,
        check_in: checkIn,
        check_out: checkOut,
        status: checkOut ? 'checked_out' : 'checked_in',
        memo: manualForm.memo || null,
      };
      const { error } = existingRecord
        ? await supabase.from('attendance_records').update(manualData).eq('id', existingRecord.id)
        : await supabase.from('attendance_records').insert({
          ...manualData,
          user_id: manualForm.userId,
          date: manualForm.date,
        });
      if (error) {
        if (isDuplicateAttendanceError(error)) {
          throw new Error('이미 같은 직원의 해당 날짜 근태 기록이 있습니다. 새로고침 후 기존 기록을 수정해주세요.');
        }
        throw error;
      }
      toast.success(existingRecord ? '기존 근태 기록이 업데이트되었습니다.' : '근태 기록이 등록되었습니다.');
      setManualDialogOpen(false);
      setManualForm({ userId: '', userName: '', date: '', checkIn: '09:00', checkOut: '18:00', status: 'checked_out', memo: '' });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    } catch (e: any) {
      toast.error('등록 실패: ' + (e.message || ''));
    } finally {
      setManualSaving(false);
    }
  };


  const handleBulkTimeUpdate = async () => {
    if (selectedIds.size === 0) { toast.warning('직원을 선택해주세요.'); return; }
    if (!bulkCheckIn && !bulkCheckOut) { toast.warning('출근 또는 퇴근 시간을 입력해주세요.'); return; }
    setBulkProcessing(true);
    let errorCount = 0;
    for (const id of selectedIds) {
      const record = monthlyRecords.find((r: any) => r.id === id);
      if (!record) continue;
      const updates: any = {};
      if (bulkCheckIn) {
        updates.check_in = new Date(`${record.date}T${bulkCheckIn}:00+09:00`).toISOString();
        updates.status = 'checked_in';
      }
      if (bulkCheckOut) {
        updates.check_out = new Date(`${record.date}T${bulkCheckOut}:00+09:00`).toISOString();
        updates.status = 'checked_out';
      }
      const { error } = await supabase.from('attendance_records').update(updates).eq('id', id);
      if (error) errorCount++;
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    setBulkCheckIn('');
    setBulkCheckOut('');
    queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    if (errorCount > 0) toast.error(`${errorCount}건 처리 실패`);
    else toast.success(`${selectedIds.size}명의 시간이 일괄 수정되었습니다.`);
  };
  const handleDeleteRecord = async (recordId: string) => {
    if (!confirm('해당 근태 기록을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('attendance_records').delete().eq('id', recordId);
    if (error) { toast.error('삭제 실패: ' + error.message); return; }
    toast.success('근태 기록이 삭제되었습니다.');
    queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) { toast.warning('직원을 선택해주세요.'); return; }
    if (!confirm(`선택한 ${selectedIds.size}건의 근태 기록을 삭제하시겠습니까?`)) return;
    setBulkProcessing(true);
    let errorCount = 0;
    for (const id of selectedIds) {
      const { error } = await supabase.from('attendance_records').delete().eq('id', id);
      if (error) errorCount++;
    }
    setBulkProcessing(false);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
    if (errorCount > 0) toast.error(`${errorCount}건 삭제 실패`);
    else toast.success(`${selectedIds.size}건이 삭제되었습니다.`);
  };


  const totalWorkDays = monthlyRecords.filter((r: any) => r.status === 'checked_out' && (adminTab === 'all' || r.user_id === user?.id)).length;
  const totalHours = monthlyRecords
    .filter((r: any) => r.work_hours && (adminTab === 'all' || r.user_id === user?.id))
    .reduce((sum: number, r: any) => sum + Number(r.work_hours || 0), 0);
  const avgHours = totalWorkDays > 0 ? (totalHours / totalWorkDays).toFixed(1) : '0';
  const approvedLeaves = leaveRequests.filter((l: any) => l.status === 'approved').reduce((sum: number, l: any) => sum + Number(l.days), 0);
  const canManageAttendance = isAdmin || isModerator;
  const filteredRecords = filterDate
    ? monthlyRecords.filter((r: any) => r.date === filterDate)
    : monthlyRecords;
  const pendingLeaveCount = leaveRequests.filter((l: any) => l.status === 'pending').length;
  const activeTodayCount = monthlyRecords.filter((r: any) => r.date === today && (r.status === 'checked_in' || r.status === 'present')).length;
  const loadError = todayRecordError || monthlyRecordsError || employeesError || leaveRequestsError;
  const monthLabel = format(selectedMonth, 'yyyy년 M월', { locale: ko });
  const isCheckedIn = todayRecord && !todayRecord.check_out;
  const isCheckedOut = todayRecord && todayRecord.check_out;
  const todayStatusMeta = isCheckedOut
    ? getAttendanceStatusMeta('checked_out')
    : isCheckedIn
      ? getAttendanceStatusMeta('checked_in')
      : getAttendanceStatusMeta(null);
  const summaryCards = [
    {
      label: adminTab === 'all' ? '완료 기록' : '출근일수',
      value: totalWorkDays,
      helper: adminTab === 'all' ? `${monthLabel} 퇴근 완료 기록` : `${monthLabel} 퇴근 완료일`,
      icon: CalendarCheck,
    },
    {
      label: '총 근무시간',
      value: totalHours.toFixed(1),
      helper: adminTab === 'all' ? '전체 기록 합계' : '내 월간 합계',
      icon: Timer,
    },
    {
      label: '일평균',
      value: avgHours,
      helper: '퇴근 완료 기록 기준',
      icon: Clock,
    },
    {
      label: adminTab === 'all' ? '승인 휴가' : '사용 휴가',
      value: approvedLeaves,
      helper: pendingLeaveCount > 0 ? `승인 대기 ${pendingLeaveCount}건` : '승인된 휴가 일수',
      icon: Palmtree,
    },
  ];

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background p-4 sm:p-6">
        <div className="w-full max-w-7xl mx-auto space-y-5">
          <header className="rounded-lg border border-border bg-card p-4 shadow-none">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
                  <Clock className="h-6 w-6 text-muted-foreground" />
                  근태 관리
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {monthLabel} · {adminTab === 'all' ? '전체 직원 기준' : profile?.full_name || user?.email || '내 기록'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {canManageAttendance && (
                  <div className="inline-flex rounded-full border border-border bg-muted/40 p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-8 rounded-full px-4 text-sm',
                        adminTab === 'my'
                          ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setAdminTab('my')}
                    >
                      내 근태
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'h-8 rounded-full px-4 text-sm',
                        adminTab === 'all'
                          ? 'bg-foreground text-background hover:bg-foreground/90 hover:text-background'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setAdminTab('all')}
                    >
                      전체 직원
                    </Button>
                  </div>
                )}
                <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5" onClick={() => setLeaveDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  휴가 신청
                </Button>
                <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5" onClick={() => navigate('/leave-management')}>
                  <CalendarDays className="h-4 w-4" />
                  연차 관리
                </Button>
                {canManageAttendance && adminTab === 'all' && (
                  <Button variant="outline" size="sm" className="h-9 rounded-full gap-1.5" onClick={() => setManualDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    수동 등록
                  </Button>
                )}
              </div>
            </div>
          </header>

          {loadError && (
            <Card className="border-destructive/30 bg-destructive/5 shadow-none">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-destructive">근태 데이터를 불러오지 못했습니다.</p>
                  <p className="mt-1 break-words text-xs text-muted-foreground">
                    {getQueryErrorMessage(loadError)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    데이터가 삭제된 것은 아닐 수 있습니다. 권한 또는 RLS 정책 오류를 확인해주세요.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {adminTab === 'my' && (
            <Card className="border-border shadow-none">
              <CardContent className="p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={cn('rounded-full px-3 py-1 text-xs', todayStatusMeta.className)}>
                        {todayStatusMeta.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko })}
                      </span>
                    </div>
                    <div>
                      <p className="text-xl font-semibold text-foreground">
                        {isCheckedOut
                          ? '오늘 근무를 마쳤습니다'
                          : isCheckedIn
                            ? '현재 근무 중입니다'
                            : '아직 출근 기록이 없습니다'}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <p className="text-xs">출근</p>
                          <p className="font-semibold text-foreground">
                            {todayRecord?.check_in ? format(new Date(todayRecord.check_in), 'HH:mm') : '-'}
                          </p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <p className="text-xs">퇴근</p>
                          <p className="font-semibold text-foreground">
                            {todayRecord?.check_out ? format(new Date(todayRecord.check_out), 'HH:mm') : '-'}
                          </p>
                        </div>
                        <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
                          <p className="text-xs">근무시간</p>
                          <p className="font-semibold text-foreground">
                            {todayRecord?.work_hours ? `${Number(todayRecord.work_hours).toFixed(1)}h` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {todayRecord?.check_in_location && (
                        <a
                          href={`https://maps.google.com/?q=${(todayRecord.check_in_location as any).lat},${(todayRecord.check_in_location as any).lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <MapPin className="h-3 w-3" />
                          출근 위치
                        </a>
                      )}
                      {todayRecord?.check_out_location && (
                        <a
                          href={`https://maps.google.com/?q=${(todayRecord.check_out_location as any).lat},${(todayRecord.check_out_location as any).lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <MapPin className="h-3 w-3" />
                          퇴근 위치
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    {!todayRecord && (
                      <Button onClick={() => handleAttendanceAction('check_in')} disabled={checkInMutation.isPending || gettingLocation || todayLoading} className="h-10 rounded-full gap-2 px-5">
                        {(checkInMutation.isPending || gettingLocation) ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        출근하기
                      </Button>
                    )}
                    {isCheckedIn && (
                      <Button onClick={() => handleAttendanceAction('check_out')} disabled={checkOutMutation.isPending || gettingLocation} variant="destructive" className="h-10 rounded-full gap-2 px-5">
                        {(checkOutMutation.isPending || gettingLocation) ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                        퇴근하기
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {summaryCards.map((card) => {
              const Icon = card.icon;
              return (
                <Card key={card.label} className="border-border shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{card.label}</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{card.value}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{card.helper}</p>
                      </div>
                      <div className="rounded-md border border-border bg-muted/30 p-2 text-muted-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {canManageAttendance && adminTab === 'all' && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">운영 인사이트</h2>
                  <p className="text-sm text-muted-foreground">근무 누락, 지각, 초과근무, 휴가 승인 대기를 먼저 확인합니다.</p>
                </div>
                <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                  <Users className="mr-1 h-3 w-3" />
                  근무 중 {activeTodayCount}명
                </Badge>
              </div>
              <AttendanceDashboard />
            </section>
          )}

          {canManageAttendance && adminTab === 'all' && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">월간 현황</h2>
                  <p className="text-sm text-muted-foreground">날짜를 선택하면 아래 상세 기록과 미출근 직원 목록이 함께 필터링됩니다.</p>
                </div>
                {filterDate && (
                  <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={() => setFilterDate('')}>
                    선택 해제
                  </Button>
                )}
              </div>
              <AttendanceCalendarView
                onDateSelect={(date: string) => {
                  setFilterDate(date);
                  if (date) {
                    setSelectedMonth(new Date(date));
                  }
                }}
                selectedDate={filterDate}
              />
            </section>
          )}

          <Tabs key={adminTab} defaultValue="attendance" className="space-y-4">
            <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-full border border-border bg-muted/30 p-1">
              <TabsTrigger value="attendance" className="rounded-full px-4">
                <Clock className="mr-1 h-4 w-4" />
                상세 기록
              </TabsTrigger>
              <TabsTrigger value="leave" className="rounded-full px-4">
                <CalendarDays className="mr-1 h-4 w-4" />
                휴가 관리
              </TabsTrigger>
              {canManageAttendance && adminTab === 'all' && (
                <>
                  <TabsTrigger value="overtime" className="rounded-full px-4">
                    <AlertTriangle className="mr-1 h-4 w-4" />
                    초과근무
                  </TabsTrigger>
                  <TabsTrigger value="monthly-report" className="rounded-full px-4">
                    <BarChart3 className="mr-1 h-4 w-4" />
                    월별 리포트
                  </TabsTrigger>
                  <TabsTrigger value="dept-analysis" className="rounded-full px-4">
                    <BarChart3 className="mr-1 h-4 w-4" />
                    부서 분석
                  </TabsTrigger>
                </>
              )}
            </TabsList>

            {canManageAttendance && adminTab === 'all' && (
              <TabsContent value="overtime">
                <OvertimeDetectionPanel />
              </TabsContent>
            )}

            {canManageAttendance && adminTab === 'all' && (
              <TabsContent value="monthly-report">
                <MonthlyAttendanceReport />
              </TabsContent>
            )}

            {canManageAttendance && adminTab === 'all' && (
              <TabsContent value="dept-analysis">
                <DepartmentWorkPatternAnalysis />
              </TabsContent>
            )}

            <TabsContent value="attendance" className="mt-0 space-y-4">
            {canManageAttendance && adminTab === 'all' && filterDate && (() => {
              const recordedUserIds = new Set(monthlyRecords.filter((r: any) => r.date === filterDate).map((r: any) => r.user_id));
              const missingEmployees = employees.filter((e: any) => !recordedUserIds.has(e.id));
              if (missingEmployees.length === 0) return null;
              return (
                <Card className="border-border bg-muted/20 shadow-none">
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        미출근 직원 {missingEmployees.length}명
                      </div>
                      <Badge variant="outline" className="rounded-full text-xs">
                        {format(new Date(filterDate), 'M월 d일 EEE', { locale: ko })}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                      {missingEmployees.map((emp: any) => (
                        <Button
                          key={emp.id}
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-full text-xs gap-1.5 bg-card"
                          onClick={() => {
                            setManualForm({
                              userId: emp.id,
                              userName: emp.full_name || '',
                              date: filterDate,
                              checkIn: '09:00',
                              checkOut: '18:00',
                              status: 'checked_out',
                              memo: '',
                            });
                            setManualDialogOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          {emp.full_name}{emp.department ? ` (${emp.department})` : ''}
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="border-border shadow-none">
              <CardHeader className="gap-3 pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <BrandedCardHeader
                    icon={Clock}
                    title={
                      filterDate
                        ? `${format(new Date(filterDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })} 출퇴근 기록`
                        : `${monthLabel} 출퇴근 기록`
                    }
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-1">
                      <Search className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="h-7 w-[142px] border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
                        placeholder="날짜 선택"
                      />
                      {filterDate && (
                        <Button variant="ghost" size="sm" className="h-6 w-6 rounded-full p-0" onClick={() => setFilterDate('')}>
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                    <div className="flex items-center rounded-full border border-border bg-muted/30 p-1">
                      <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setSelectedMonth(new Date())}>
                        오늘
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 rounded-full p-0" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {filteredRecords.length}건
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {canManageAttendance && adminTab === 'all' && selectedIds.size > 0 && (
                  <div className="sticky top-2 z-10 mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/95 p-3 shadow-sm backdrop-blur">
                    <Badge variant="secondary" className="rounded-full text-xs">{selectedIds.size}건 선택</Badge>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">출근:</label>
                      <ScrollTimePicker value={bulkCheckIn} onChange={setBulkCheckIn} className="h-8 text-xs" placeholder="출근 시간" />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground">퇴근:</label>
                      <ScrollTimePicker value={bulkCheckOut} onChange={setBulkCheckOut} className="h-8 text-xs" placeholder="퇴근 시간" />
                    </div>
                    <Button size="sm" className="h-8 text-xs gap-1" onClick={handleBulkTimeUpdate} disabled={bulkProcessing}>
                      {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      일괄 적용
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 text-xs gap-1" onClick={handleBulkDelete} disabled={bulkProcessing}>
                      {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      일괄 삭제
                    </Button>
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
                      선택 해제
                    </Button>
                  </div>
                )}
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {canManageAttendance && adminTab === 'all' && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={filteredRecords.length > 0 && filteredRecords.every((r: any) => selectedIds.has(r.id))}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedIds(new Set(filteredRecords.map((r: any) => r.id)));
                                } else {
                                  setSelectedIds(new Set());
                                }
                              }}
                            />
                          </TableHead>
                        )}
                        <TableHead>날짜</TableHead>
                        {adminTab === 'all' && <TableHead>이름</TableHead>}
                        <TableHead>출근</TableHead>
                        <TableHead>퇴근</TableHead>
                        <TableHead>근무시간</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead>위치</TableHead>
                        {canManageAttendance && adminTab === 'all' && <TableHead className="text-right">관리</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        if (filteredRecords.length === 0) return (
                          <TableRow><TableCell colSpan={adminTab === 'all' ? 9 : 6} className="text-center py-8 text-muted-foreground">{filterDate ? `${filterDate}의 기록이 없습니다` : '기록이 없습니다'}</TableCell></TableRow>
                        );
                        return filteredRecords.map((r: any) => {
                          const statusMeta = getAttendanceStatusMeta(r.status);
                          return (
                          <TableRow key={r.id} className={cn('hover:bg-muted/30', selectedIds.has(r.id) && 'bg-muted/50')}>
                            {canManageAttendance && adminTab === 'all' && (
                              <TableCell>
                                <Checkbox
                                  checked={selectedIds.has(r.id)}
                                  onCheckedChange={(checked) => {
                                    const next = new Set(selectedIds);
                                    if (checked) next.add(r.id); else next.delete(r.id);
                                    setSelectedIds(next);
                                  }}
                                />
                              </TableCell>
                            )}
                            <TableCell className="font-medium">{format(new Date(r.date), 'M/d (EEE)', { locale: ko })}</TableCell>
                            {adminTab === 'all' && <TableCell>{r.user_name}</TableCell>}
                            <TableCell>{r.check_in ? format(new Date(r.check_in), 'HH:mm') : '-'}</TableCell>
                            <TableCell>{r.check_out ? format(new Date(r.check_out), 'HH:mm') : '-'}</TableCell>
                            <TableCell>{r.work_hours ? `${Number(r.work_hours).toFixed(1)}h` : '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn('rounded-full text-xs', statusMeta.className)}>
                                {statusMeta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                {r.check_in_location && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={`https://maps.google.com/?q=${(r.check_in_location as any).lat},${(r.check_in_location as any).lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                                      >
                                        <MapPin className="h-3.5 w-3.5" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>출근 위치</TooltipContent>
                                  </Tooltip>
                                )}
                                {r.check_out_location && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a
                                        href={`https://maps.google.com/?q=${(r.check_out_location as any).lat},${(r.check_out_location as any).lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                                      >
                                        <LogOut className="h-3.5 w-3.5" />
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>퇴근 위치</TooltipContent>
                                  </Tooltip>
                                )}
                                {!r.check_in_location && !r.check_out_location && (
                                  <span className="text-xs text-muted-foreground">-</span>
                                )}
                              </div>
                            </TableCell>
                            {canManageAttendance && adminTab === 'all' && (
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-full p-0"
                                        onClick={() => { setEditRecord(r); setEditDialogOpen(true); }}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>근태 수정</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-8 w-8 rounded-full p-0 text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteRecord(r.id)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>기록 삭제</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                        });
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="mt-0">
            <Card className="border-border shadow-none">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <BrandedCardHeader icon={CalendarDays} title="휴가 신청 내역" />
                <Button size="sm" className="rounded-full gap-1" onClick={() => setLeaveDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  휴가 신청
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {adminTab === 'all' && <TableHead>이름</TableHead>}
                        <TableHead>종류</TableHead>
                        <TableHead>기간</TableHead>
                        <TableHead>일수</TableHead>
                        <TableHead>사유</TableHead>
                        <TableHead>상태</TableHead>
                        {canManageAttendance && adminTab === 'all' && <TableHead className="text-right">처리</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leaveRequests.length === 0 ? (
                        <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">신청 내역이 없습니다</TableCell></TableRow>
                      ) : (
                        leaveRequests.map((l: any) => {
                          const statusInfo = LEAVE_STATUS[l.status as keyof typeof LEAVE_STATUS] || LEAVE_STATUS.pending;
                          return (
                            <TableRow key={l.id}>
                              {adminTab === 'all' && <TableCell className="font-medium">{l.user_name}</TableCell>}
                              <TableCell>{LEAVE_TYPES.find(t => t.value === l.leave_type)?.label || l.leave_type}</TableCell>
                              <TableCell className="text-xs">{l.start_date} ~ {l.end_date}</TableCell>
                              <TableCell>{l.days}일</TableCell>
                              <TableCell className="max-w-[150px] truncate text-xs">{l.reason || '-'}</TableCell>
                              <TableCell>
                                <Badge className={cn('text-xs', statusInfo.color)}>{statusInfo.label}</Badge>
                              </TableCell>
                              {canManageAttendance && adminTab === 'all' && (
                                <TableCell className="text-right">
                                  {l.status === 'pending' && (
                                    <div className="flex justify-end gap-1">
                                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-full p-0 text-emerald-600" onClick={() => handleLeaveAction(l.id, 'approved')}>
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-8 w-8 rounded-full p-0 text-red-600" onClick={() => handleLeaveAction(l.id, 'rejected')}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>휴가 신청</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">종류</label>
              <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm(f => ({ ...f, leaveType: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">시작일</label>
                <Input type="date" value={format(leaveForm.startDate, 'yyyy-MM-dd')} onChange={(e) => setLeaveForm(f => ({ ...f, startDate: new Date(e.target.value) }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">종료일</label>
                <Input type="date" value={format(leaveForm.endDate, 'yyyy-MM-dd')} onChange={(e) => setLeaveForm(f => ({ ...f, endDate: new Date(e.target.value) }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">사유</label>
              <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="휴가 사유를 입력하세요" className="mt-1" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLeaveDialogOpen(false)}>취소</Button>
              <Button onClick={() => submitLeaveMutation.mutate()} disabled={submitLeaveMutation.isPending}>
                {submitLeaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                신청
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Attendance Registration Dialog */}
      <Dialog open={manualDialogOpen} onOpenChange={setManualDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>근태 수동 등록</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">직원 선택</label>
              <Select value={manualForm.userId} onValueChange={(v) => {
                const emp = employees.find((e: any) => e.id === v);
                setManualForm(f => ({ ...f, userId: v, userName: emp?.full_name || '' }));
              }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="직원을 선택하세요" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.full_name}{e.department ? ` (${e.department})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">날짜</label>
              <Input type="date" value={manualForm.date} onChange={(e) => setManualForm(f => ({ ...f, date: e.target.value }))} className="mt-1" max={format(new Date(), 'yyyy-MM-dd')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">출근 시간</label>
                <ScrollTimePicker value={manualForm.checkIn} onChange={(v) => setManualForm(f => ({ ...f, checkIn: v }))} className="mt-1 w-full h-9 text-sm" placeholder="출근 시간" />
              </div>
              <div>
                <label className="text-sm font-medium">퇴근 시간</label>
                <ScrollTimePicker value={manualForm.checkOut} onChange={(v) => setManualForm(f => ({ ...f, checkOut: v }))} className="mt-1 w-full h-9 text-sm" placeholder="퇴근 시간" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">메모</label>
              <Textarea value={manualForm.memo} onChange={(e) => setManualForm(f => ({ ...f, memo: e.target.value }))} placeholder="수동 등록 사유를 입력하세요" className="mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setManualDialogOpen(false)}>취소</Button>
              <Button onClick={handleManualAttendanceAdd} disabled={manualSaving}>
                {manualSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                등록
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <LocationConfirmDialog
        open={locationDialogOpen}
        actionType={pendingAttendanceAction || 'check_in'}
        onConfirm={handleLocationConfirm}
        onCancel={handleLocationCancel}
      />

      <AttendanceEditDialog
        record={editRecord}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
          queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
        }}
      />
    </div>
    </TooltipProvider>
  );
};

export default AttendancePage;
