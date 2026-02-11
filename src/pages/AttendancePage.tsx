import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Clock, LogIn, LogOut, MapPin, CalendarDays, Plus, Loader2, Check, X, BarChart3, Pencil, CalendarRange, Search, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AttendanceEditDialog from '@/components/attendance/AttendanceEditDialog';
import AttendanceCalendarView from '@/components/attendance/AttendanceCalendarView';
import ScrollTimePicker from '@/components/ui/scroll-time-picker';
import AttendanceDashboard from '@/components/attendance/AttendanceDashboard';

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

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
  }, [authLoading, user, navigate]);

  const today = format(new Date(), 'yyyy-MM-dd');

  // Today's attendance record
  const { data: todayRecord, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today', user?.id, today],
    queryFn: async () => {
      const { data } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('user_id', user!.id)
        .eq('date', today)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  // Monthly attendance
  const monthStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data: monthlyRecords = [] } = useQuery({
    queryKey: ['attendance-monthly', adminTab === 'all' ? 'all' : user?.id, monthStart],
    queryFn: async () => {
      let query = supabase
        .from('attendance_records')
        .select('*')
        .gte('date', monthStart)
        .lte('date', monthEnd)
        .order('date', { ascending: false });
      if (adminTab !== 'all') query = query.eq('user_id', user!.id);
      const { data } = await query;
      return data || [];
    },
    enabled: !!user,
  });

  // Employee list for manual registration
  const { data: employees = [] } = useQuery({
    queryKey: ['all-employees-for-attendance'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, department').eq('is_approved', true).order('full_name');
      return data || [];
    },
    enabled: !!user && (isAdmin || isModerator),
  });

  // Leave requests
  const { data: leaveRequests = [] } = useQuery({
    queryKey: ['leave-requests', adminTab === 'all' ? 'all' : user?.id],
    queryFn: async () => {
      let query = supabase.from('leave_requests').select('*').order('created_at', { ascending: false });
      if (adminTab !== 'all') query = query.eq('user_id', user!.id);
      const { data } = await query;
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

  const checkInMutation = useMutation({
    mutationFn: async () => {
      const location = await getLocation();
      const { error } = await supabase.from('attendance_records').insert({
        user_id: user!.id,
        user_name: profile?.full_name || user!.email || '',
        check_in: new Date().toISOString(),
        check_in_location: location,
        date: today,
        status: 'checked_in',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('출근이 기록되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    },
    onError: (err: any) => toast.error('출근 기록 실패: ' + err.message),
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      const location = await getLocation();
      const { error } = await supabase
        .from('attendance_records')
        .update({
          check_out: new Date().toISOString(),
          check_out_location: location,
          status: 'checked_out',
        })
        .eq('id', todayRecord!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('퇴근이 기록되었습니다.');
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    },
    onError: (err: any) => toast.error('퇴근 기록 실패: ' + err.message),
  });

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
      const { error } = await supabase.from('attendance_records').insert({
        user_id: manualForm.userId,
        user_name: manualForm.userName,
        date: manualForm.date,
        check_in: checkIn,
        check_out: checkOut,
        status: checkOut ? 'checked_out' : 'checked_in',
        memo: manualForm.memo || null,
      });
      if (error) throw error;
      toast.success('근태 기록이 등록되었습니다.');
      setManualDialogOpen(false);
      setManualForm({ userId: '', userName: '', date: '', checkIn: '09:00', checkOut: '18:00', status: 'checked_out', memo: '' });
      queryClient.invalidateQueries({ queryKey: ['attendance-monthly'] });
    } catch (e: any) {
      toast.error('등록 실패: ' + (e.message || ''));
    } finally {
      setManualSaving(false);
    }
  };


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


  const totalWorkDays = monthlyRecords.filter((r: any) => r.status === 'checked_out' && (adminTab === 'all' || r.user_id === user?.id)).length;
  const totalHours = monthlyRecords
    .filter((r: any) => r.work_hours && (adminTab === 'all' || r.user_id === user?.id))
    .reduce((sum: number, r: any) => sum + Number(r.work_hours || 0), 0);
  const avgHours = totalWorkDays > 0 ? (totalHours / totalWorkDays).toFixed(1) : '0';
  const approvedLeaves = leaveRequests.filter((l: any) => l.status === 'approved').reduce((sum: number, l: any) => sum + Number(l.days), 0);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  const isCheckedIn = todayRecord && !todayRecord.check_out;
  const isCheckedOut = todayRecord && todayRecord.check_out;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <div className="w-full max-w-6xl mx-auto">
        <div className="mb-6 flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/')} size="sm" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
          <Button variant="outline" onClick={() => navigate('/leave-management')} size="sm" className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4" />
            연차 관리
          </Button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            근태 관리
          </h1>
          {(isAdmin || isModerator) && (
            <div className="flex gap-2">
              <Button variant={adminTab === 'my' ? 'default' : 'outline'} size="sm" onClick={() => setAdminTab('my')}>내 기록</Button>
              <Button variant={adminTab === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setAdminTab('all')}>전체 직원</Button>
              {adminTab === 'all' && (
                <Button variant="outline" size="sm" className="gap-1" onClick={() => setManualDialogOpen(true)}>
                  <Plus className="w-4 h-4" />수동 등록
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Check In/Out Card */}
        {adminTab === 'my' && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <p className="text-lg font-semibold">{format(new Date(), 'yyyy년 M월 d일 (EEEE)', { locale: ko })}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {isCheckedOut
                      ? `✅ 퇴근 완료 (${format(new Date(todayRecord.check_in), 'HH:mm')} ~ ${format(new Date(todayRecord.check_out), 'HH:mm')})`
                      : isCheckedIn
                        ? `🟢 출근 중 (${format(new Date(todayRecord.check_in), 'HH:mm')} ~)`
                        : '⏳ 아직 출근 기록이 없습니다'}
                  </p>
                  {todayRecord?.check_in_location && (
                    <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      출근 위치 기록됨
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {!todayRecord && (
                    <Button onClick={() => checkInMutation.mutate()} disabled={checkInMutation.isPending || gettingLocation} className="gap-2">
                      {(checkInMutation.isPending || gettingLocation) ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                      출근하기
                    </Button>
                  )}
                  {isCheckedIn && (
                    <Button onClick={() => checkOutMutation.mutate()} disabled={checkOutMutation.isPending || gettingLocation} variant="destructive" className="gap-2">
                      {(checkOutMutation.isPending || gettingLocation) ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                      퇴근하기
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalWorkDays}</p>
              <p className="text-xs text-muted-foreground">출근일수</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{totalHours.toFixed(1)}</p>
              <p className="text-xs text-muted-foreground">총 근무시간</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{avgHours}</p>
              <p className="text-xs text-muted-foreground">일평균(시간)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{approvedLeaves}</p>
              <p className="text-xs text-muted-foreground">사용 휴가(일)</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View - below stats */}
        {(isAdmin || isModerator) && adminTab === 'all' && (
          <div className="mb-6">
            <AttendanceCalendarView
              onDateSelect={(date: string) => {
                setFilterDate(date);
                setSelectedMonth(new Date(date));
              }}
              selectedDate={filterDate}
            />
          </div>
        )}

        <Tabs defaultValue={((isAdmin || isModerator) && adminTab === 'all') ? 'dashboard' : 'attendance'}>
          <TabsList className="mb-4">
            {(isAdmin || isModerator) && adminTab === 'all' && (
              <TabsTrigger value="dashboard"><LayoutDashboard className="w-4 h-4 mr-1" />근태 대시보드</TabsTrigger>
            )}
            <TabsTrigger value="attendance"><Clock className="w-4 h-4 mr-1" />출퇴근 기록</TabsTrigger>
            <TabsTrigger value="leave"><CalendarDays className="w-4 h-4 mr-1" />휴가 관리</TabsTrigger>
          </TabsList>

          {(isAdmin || isModerator) && adminTab === 'all' && (
            <TabsContent value="dashboard">
              <AttendanceDashboard />
            </TabsContent>
          )}

          <TabsContent value="attendance">
            <Card>
               <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">
                  {filterDate
                    ? `${format(new Date(filterDate), 'yyyy년 M월 d일 (EEE)', { locale: ko })} 출퇴근 기록`
                    : `${format(selectedMonth, 'yyyy년 M월', { locale: ko })} 출퇴근 기록`
                  }
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Search className="w-3.5 h-3.5 text-muted-foreground" />
                    <Input
                      type="date"
                      value={filterDate}
                      onChange={(e) => setFilterDate(e.target.value)}
                      className="h-8 w-[140px] text-xs"
                      placeholder="날짜 선택"
                    />
                    {filterDate && (
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setFilterDate('')}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}>◀</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date())}>오늘</Button>
                    <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}>▶</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Bulk action bar */}
                {(isAdmin || isModerator) && adminTab === 'all' && selectedIds.size > 0 && (
                  <div className="mb-4 p-3 border rounded-lg bg-muted/50 flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="text-xs">{selectedIds.size}명 선택</Badge>
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
                    <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>
                      선택 해제
                    </Button>
                  </div>
                )}
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {(isAdmin || isModerator) && adminTab === 'all' && (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={(() => {
                                const filtered = filterDate ? monthlyRecords.filter((r: any) => r.date === filterDate) : monthlyRecords;
                                return filtered.length > 0 && filtered.every((r: any) => selectedIds.has(r.id));
                              })()}
                              onCheckedChange={(checked) => {
                                const filtered = filterDate ? monthlyRecords.filter((r: any) => r.date === filterDate) : monthlyRecords;
                                if (checked) {
                                  setSelectedIds(new Set(filtered.map((r: any) => r.id)));
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
                        {(isAdmin || isModerator) && adminTab === 'all' && <TableHead>수정</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = filterDate
                          ? monthlyRecords.filter((r: any) => r.date === filterDate)
                          : monthlyRecords;
                        if (filtered.length === 0) return (
                          <TableRow><TableCell colSpan={adminTab === 'all' ? 8 : 5} className="text-center py-8 text-muted-foreground">{filterDate ? `${filterDate}의 기록이 없습니다` : '기록이 없습니다'}</TableCell></TableRow>
                        );
                        return filtered.map((r: any) => (
                          <TableRow key={r.id} className={selectedIds.has(r.id) ? 'bg-primary/5' : ''}>
                            {(isAdmin || isModerator) && adminTab === 'all' && (
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
                              <Badge variant="outline" className="text-xs">
                                {r.status === 'checked_out' ? '완료' : (r.status === 'checked_in' || r.status === 'present') ? '근무 중' : r.status}
                              </Badge>
                            </TableCell>
                            {(isAdmin || isModerator) && adminTab === 'all' && (
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0"
                                  onClick={() => { setEditRecord(r); setEditDialogOpen(true); }}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ));
                      })()}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">휴가 신청 내역</CardTitle>
                <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1"><Plus className="w-4 h-4" />휴가 신청</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>휴가 신청</DialogTitle></DialogHeader>
                    <div className="space-y-4 mt-2">
                      <div>
                        <label className="text-sm font-medium">종류</label>
                        <Select value={leaveForm.leaveType} onValueChange={(v) => setLeaveForm(f => ({ ...f, leaveType: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {LEAVE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium">시작일</label>
                          <Input type="date" value={format(leaveForm.startDate, 'yyyy-MM-dd')} onChange={(e) => setLeaveForm(f => ({ ...f, startDate: new Date(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="text-sm font-medium">종료일</label>
                          <Input type="date" value={format(leaveForm.endDate, 'yyyy-MM-dd')} onChange={(e) => setLeaveForm(f => ({ ...f, endDate: new Date(e.target.value) }))} />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium">사유</label>
                        <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm(f => ({ ...f, reason: e.target.value }))} placeholder="휴가 사유를 입력하세요" />
                      </div>
                      <Button onClick={() => submitLeaveMutation.mutate()} disabled={submitLeaveMutation.isPending} className="w-full">
                        {submitLeaveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        신청하기
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
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
                        {(isAdmin || isModerator) && adminTab === 'all' && <TableHead>처리</TableHead>}
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
                              {(isAdmin || isModerator) && adminTab === 'all' && (
                                <TableCell>
                                  {l.status === 'pending' && (
                                    <div className="flex gap-1">
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-green-600" onClick={() => handleLeaveAction(l.id, 'approved')}>
                                        <Check className="w-4 h-4" />
                                      </Button>
                                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => handleLeaveAction(l.id, 'rejected')}>
                                        <X className="w-4 h-4" />
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
  );
};

export default AttendancePage;
