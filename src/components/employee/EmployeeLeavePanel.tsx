import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, CalendarDays, ChevronLeft, ChevronRight, Check, X, Plus, Pencil } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface LeaveRequest {
  id: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number;
  status: string;
  reason: string | null;
  created_at: string;
  approved_by_name: string | null;
  reject_reason: string | null;
  user_name?: string;
}

interface Props {
  userId: string;
}

const leaveTypeMap: Record<string, string> = {
  annual: '연차',
  half_day: '반차',
  half_day_am: '오전 반차',
  half_day_pm: '오후 반차',
  sick: '병가',
  special: '특별휴가',
  personal: '경조사',
  unpaid: '무급휴가',
  other: '기타',
};

const statusStyles: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '대기중', variant: 'outline' },
  approved: { label: '승인', variant: 'default' },
  rejected: { label: '반려', variant: 'destructive' },
  cancelled: { label: '취소', variant: 'secondary' },
};

const EmployeeLeavePanel: React.FC<Props> = ({ userId }) => {
  const { isAdmin, isModerator, user, profile } = useAuth();
  const canManage = isAdmin || isModerator;
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [processing, setProcessing] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LeaveRequest | null>(null);

  // Add/Edit form state
  const [formLeaveType, setFormLeaveType] = useState('annual');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  const fetchRequests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('user_id', userId)
      .gte('start_date', `${currentYear}-01-01`)
      .lte('start_date', `${currentYear}-12-31`)
      .order('start_date', { ascending: false });

    if (!error && data) setRequests(data as LeaveRequest[]);
    setLoading(false);
  };

  useEffect(() => { fetchRequests(); }, [userId, currentYear]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    const { error } = await supabase.from('leave_requests').update({
      status: 'approved', approved_by: user?.id, approved_by_name: profile?.full_name || '', approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error('승인 실패');
    else { toast.success('휴가가 승인되었습니다.'); fetchRequests(); }
    setProcessing(null);
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    const { error } = await supabase.from('leave_requests').update({
      status: 'rejected', approved_by: user?.id, approved_by_name: profile?.full_name || '', approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error('반려 실패');
    else { toast.success('휴가가 반려되었습니다.'); fetchRequests(); }
    setProcessing(null);
  };

  const openAddDialog = () => {
    setEditingRequest(null);
    setFormLeaveType('annual');
    setFormStartDate(format(new Date(), 'yyyy-MM-dd'));
    setFormEndDate(format(new Date(), 'yyyy-MM-dd'));
    setFormReason('');
    setAddDialogOpen(true);
  };

  const openEditDialog = (req: LeaveRequest) => {
    setEditingRequest(req);
    setFormLeaveType(req.leave_type);
    setFormStartDate(req.start_date);
    setFormEndDate(req.end_date);
    setFormReason(req.reason || '');
    setEditDialogOpen(true);
  };

  const handleEditLeave = async () => {
    if (!editingRequest || !formStartDate || !formEndDate) { toast.warning('날짜를 입력해주세요.'); return; }
    setFormSaving(true);
    try {
      const days = formLeaveType.startsWith('half_day') ? 0.5 : differenceInDays(new Date(formEndDate), new Date(formStartDate)) + 1;
      const { error } = await supabase.from('leave_requests').update({
        leave_type: formLeaveType,
        start_date: formStartDate,
        end_date: formEndDate,
        days,
        reason: formReason || null,
      }).eq('id', editingRequest.id);
      if (error) throw error;
      toast.success('휴가가 수정되었습니다.');
      setEditDialogOpen(false);
      fetchRequests();
    } catch (e: any) {
      toast.error('수정 실패: ' + (e.message || ''));
    } finally {
      setFormSaving(false);
    }
  };

  const handleAddLeave = async () => {
    if (!formStartDate || !formEndDate) { toast.warning('날짜를 입력해주세요.'); return; }
    setFormSaving(true);
    try {
      // Fetch the employee's name
      const { data: empProfile } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      const empName = empProfile?.full_name || '';

      const days = formLeaveType.startsWith('half_day') ? 0.5 : differenceInDays(new Date(formEndDate), new Date(formStartDate)) + 1;
      const { error } = await supabase.from('leave_requests').insert({
        user_id: userId,
        user_name: empName,
        leave_type: formLeaveType,
        start_date: formStartDate,
        end_date: formEndDate,
        days,
        reason: formReason || null,
        status: 'approved',
        approved_by: user?.id,
        approved_by_name: profile?.full_name || '',
        approved_at: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success('휴가가 추가되었습니다.');
      setAddDialogOpen(false);
      fetchRequests();
    } catch (e: any) {
      toast.error('추가 실패: ' + (e.message || ''));
    } finally {
      setFormSaving(false);
    }
  };

  const totalUsed = requests.filter(r => r.status === 'approved').reduce((sum, r) => sum + r.days, 0);
  const totalPending = requests.filter(r => r.status === 'pending').reduce((sum, r) => sum + r.days, 0);

  return (
    <div className="py-4 space-y-6">
      {/* Year Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentYear(y => y - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="text-sm font-semibold">{currentYear}년</h3>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentYear(y => y + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        {canManage && (
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={openAddDialog}>
            <Plus className="h-3.5 w-3.5" /> 수동 추가
          </Button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">사용 완료</p>
          <p className="text-lg font-bold">{totalUsed}일</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">승인 대기</p>
          <p className="text-lg font-bold text-amber-600">{totalPending}일</p>
        </div>
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <p className="text-xs text-muted-foreground">총 신청</p>
          <p className="text-lg font-bold">{requests.length}건</p>
        </div>
      </div>

      {/* Leave List */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-20" />
          해당 연도의 휴가 신청 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => {
            const st = statusStyles[r.status] || { label: r.status, variant: 'outline' as const };
            return (
              <div key={r.id} className="border rounded-lg p-3 hover:bg-accent/30 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{leaveTypeMap[r.leave_type] || r.leave_type}</span>
                      <Badge variant={st.variant} className="text-[10px]">{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">{r.days}일</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(r.start_date), 'M/d (EEE)', { locale: ko })}
                      {r.start_date !== r.end_date && ` ~ ${format(new Date(r.end_date), 'M/d (EEE)', { locale: ko })}`}
                    </p>
                    {r.reason && <p className="text-xs text-muted-foreground">사유: {r.reason}</p>}
                    {r.approved_by_name && r.status !== 'pending' && <p className="text-xs text-muted-foreground">처리자: {r.approved_by_name}</p>}
                    {r.reject_reason && <p className="text-xs text-destructive">반려 사유: {r.reject_reason}</p>}
                  </div>
                  {canManage && r.status === 'pending' && (
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => handleApprove(r.id)} disabled={processing === r.id}>
                        {processing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} 승인
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive" onClick={() => handleReject(r.id)} disabled={processing === r.id}>
                        <X className="h-3 w-3" /> 반려
                      </Button>
                    </div>
                  )}
                  {canManage && r.status === 'approved' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 shrink-0" onClick={() => openEditDialog(r)}>
                      <Pencil className="h-3 w-3" /> 수정
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Leave Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>휴가 수동 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">휴가 유형</Label>
              <Select value={formLeaveType} onValueChange={setFormLeaveType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">연차</SelectItem>
                  <SelectItem value="half_day_am">오전 반차</SelectItem>
                  <SelectItem value="half_day_pm">오후 반차</SelectItem>
                  <SelectItem value="sick">병가</SelectItem>
                  <SelectItem value="special">특별휴가</SelectItem>
                  <SelectItem value="personal">경조사</SelectItem>
                  <SelectItem value="unpaid">무급휴가</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">시작일</Label>
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">종료일</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">사유</Label>
              <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="사유를 입력하세요" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">관리자가 수동으로 추가하는 휴가는 즉시 '승인' 상태로 등록됩니다.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
              <Button onClick={handleAddLeave} disabled={formSaving}>
                {formSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                추가
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Leave Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>승인된 휴가 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-sm">휴가 유형</Label>
              <Select value={formLeaveType} onValueChange={setFormLeaveType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">연차</SelectItem>
                  <SelectItem value="half_day_am">오전 반차</SelectItem>
                  <SelectItem value="half_day_pm">오후 반차</SelectItem>
                  <SelectItem value="sick">병가</SelectItem>
                  <SelectItem value="special">특별휴가</SelectItem>
                  <SelectItem value="personal">경조사</SelectItem>
                  <SelectItem value="unpaid">무급휴가</SelectItem>
                  <SelectItem value="other">기타</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">시작일</Label>
                <Input type="date" value={formStartDate} onChange={(e) => setFormStartDate(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm">종료일</Label>
                <Input type="date" value={formEndDate} onChange={(e) => setFormEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm">사유</Label>
              <Textarea value={formReason} onChange={(e) => setFormReason(e.target.value)} placeholder="사유를 입력하세요" className="mt-1" />
            </div>
            <p className="text-xs text-muted-foreground">승인된 휴가의 날짜, 유형, 사유를 수정할 수 있습니다.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>취소</Button>
              <Button onClick={handleEditLeave} disabled={formSaving}>
                {formSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                저장
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmployeeLeavePanel;
