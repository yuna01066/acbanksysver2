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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ArrowLeft, Clock, LogIn, LogOut, MapPin, CalendarDays, Plus, Loader2, Check, X, BarChart3, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AttendanceEditDialog from '@/components/attendance/AttendanceEditDialog';

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

  // Stats
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

        <Tabs defaultValue="attendance">
          <TabsList className="mb-4">
            <TabsTrigger value="attendance"><Clock className="w-4 h-4 mr-1" />출퇴근 기록</TabsTrigger>
            <TabsTrigger value="leave"><CalendarDays className="w-4 h-4 mr-1" />휴가 관리</TabsTrigger>
          </TabsList>

          <TabsContent value="attendance">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">
                  {format(selectedMonth, 'yyyy년 M월', { locale: ko })} 출퇴근 기록
                </CardTitle>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() - 1))}>◀</Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date())}>오늘</Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedMonth(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1))}>▶</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
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
                      {monthlyRecords.length === 0 ? (
                        <TableRow><TableCell colSpan={adminTab === 'all' ? 6 : 5} className="text-center py-8 text-muted-foreground">기록이 없습니다</TableCell></TableRow>
                      ) : (
                        monthlyRecords.map((r: any) => (
                          <TableRow key={r.id}>
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
                        ))
                      )}
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
