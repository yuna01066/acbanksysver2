import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { readAllRows } from '@/lib/readAllRows';
import { refreshAttendanceLeave } from '@/lib/attendanceLeaveQueries';
import { AttendanceCorrection, submitAttendanceCorrection, cancelAttendanceCorrection, reviewAttendanceCorrection } from '@/services/attendanceCorrections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

const statusLabels: Record<string, string> = { pending: '처리 대기', handled: '정정 완료', rejected: '반려', cancelled: '철회' };
const typeLabels: Record<string, string> = { both: '출퇴근', check_in: '출근', check_out: '퇴근', memo: '메모' };
const time = (value: string | null | undefined) => value ? format(new Date(value), 'MM.dd HH:mm') : '없음';
const errorMessage = (error: unknown) => (error as { message?: string })?.message || '처리하지 못했습니다. 다시 시도해 주세요.';

export default function AttendanceCorrections({ admin = false, focusedRequestId }: { admin?: boolean; focusedRequestId?: string }) {
  const { user, isAdmin, isModerator } = useAuth();
  const canReview = admin && (isAdmin || isModerator);
  const client = useQueryClient();
  const [params, setParams] = useSearchParams();
  const lock = useRef(false);
  const openedRequest = useRef<string>();
  const [showAll, setShowAll] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [review, setReview] = useState<AttendanceCorrection | null>(null);
  const closeReview = () => {
    setReview(null);
    const next = new URLSearchParams(params);
    next.delete('request');
    setParams(next);
  };
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), type: 'both', checkIn: '', checkOut: '', reason: '' });
  const query = useQuery({
    queryKey: ['attendance-corrections', user?.id, canReview ? 'all' : 'my'],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from('attendance_correction_requests').select('*').order('created_at', { ascending: false }).order('id');
      if (!canReview) q = q.eq('user_id', user!.id);
      return readAllRows<AttendanceCorrection>(q);
    },
  });
  const original = useQuery({
    queryKey: ['attendance-correction-original', review?.id, review?.updated_at],
    enabled: !!review && canReview,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from('attendance_records').select('id, updated_at, check_in, check_out, status, memo')
        .eq('user_id', review!.user_id).eq('date', review!.date).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!focusedRequestId) { openedRequest.current = undefined; setReview(null); return; }
    if (openedRequest.current === focusedRequestId) return;
    if (!canReview) {
      if (query.data?.some(r => r.id === focusedRequestId)) {
        openedRequest.current = focusedRequestId;
        document.getElementById('attendance-correction-' + focusedRequestId)?.scrollIntoView({ block: 'center' });
      }
      return;
    }
    const request = query.data?.find(r => r.id === focusedRequestId);
    if (request) { openedRequest.current = focusedRequestId; setReview(request); setNote(''); setSaveError(''); }
  }, [focusedRequestId, canReview, query.data]);
  const run = async (action: () => Promise<unknown>, done?: () => void) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setSaveError('');
    try {
      await action();
      await refreshAttendanceLeave(client);
      toast.success('요청이 처리되었습니다.');
      done?.();
    } catch (error) { setSaveError(errorMessage(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  const requests = (query.data || []).filter(r => !canReview || showAll || r.status === 'pending' || r.id === focusedRequestId);
  return (
    <section className="space-y-4" aria-label="근태 정정 요청">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">근태 정정 요청</h2>
        {canReview ? <Button variant="outline" aria-pressed={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? '대기 요청만 보기' : '처리 이력 포함'}</Button>
          : <Button variant="outline" onClick={() => { setNewOpen(true); setSaveError(''); }}>정정 신청</Button>}
      </div>
      {saveError && !newOpen && !review && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
      {query.error ? <div role="alert">정정 요청을 불러오지 못했습니다. <Button variant="outline" onClick={() => void query.refetch()}>다시 시도</Button></div>
        : query.isLoading ? <p role="status">정정 요청을 불러오는 중…</p>
        : requests.length === 0 ? <p className="py-5 text-sm text-muted-foreground">{canReview ? '처리할 정정 요청이 없습니다.' : '신청한 정정 요청이 없습니다.'}</p>
        : <div className="divide-y rounded-lg border">{requests.map(request => (
          <div key={request.id} id={'attendance-correction-' + request.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0 text-sm">
              <p className="font-medium">{canReview ? request.user_name + ' · ' : ''}{request.date} · {typeLabels[request.request_type]} 정정</p>
              <p className="text-muted-foreground">{statusLabels[request.status]} · {request.reason}</p>
              {request.handled_memo && <p className="mt-1">처리 사유: {request.handled_memo}</p>}
              {request.handled_at && <p className="text-xs text-muted-foreground">{time(request.handled_at)}</p>}
            </div>
            {canReview ? <Button variant="outline" onClick={() => {
              setReview(request); setNote(''); setSaveError('');
              const next = new URLSearchParams(params);
              next.set('request', request.id); next.set('kind', 'attendance');
              setParams(next);
            }}>검토·이력</Button>
              : request.status === 'pending' && <Button variant="outline" disabled={busy} onClick={() => void run(() => cancelAttendanceCorrection(request.id))}>신청 철회</Button>}
          </div>
        ))}</div>}

      <Dialog open={newOpen} onOpenChange={open => !busy && setNewOpen(open)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          <DialogHeader><DialogTitle>근태 정정 신청</DialogTitle><DialogDescription>관리자 승인 후 근태 기록에 반영됩니다. 시간은 한국 표준시 기준입니다.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            void run(() => submitAttendanceCorrection({
              date: form.date, requestType: form.type, reason: form.reason,
              checkIn: ['both', 'check_in'].includes(form.type) && form.checkIn ? new Date(form.checkIn + ':00+09:00').toISOString() : null,
              checkOut: ['both', 'check_out'].includes(form.type) && form.checkOut ? new Date(form.checkOut + ':00+09:00').toISOString() : null,
            }), () => { setNewOpen(false); setForm({ date: form.date, type: 'both', checkIn: '', checkOut: '', reason: '' }); });
          }}>
            <div><Label htmlFor="correction-date">근무일</Label><Input id="correction-date" type="date" required max={format(new Date(), 'yyyy-MM-dd')} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label htmlFor="correction-type">정정 유형</Label><select id="correction-type" className="h-11 w-full rounded-md border bg-background px-3" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(typeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
            {['both', 'check_in'].includes(form.type) && <div><Label htmlFor="correction-in">변경할 출근 시각</Label><Input id="correction-in" type="datetime-local" required value={form.checkIn} onChange={e => setForm({ ...form, checkIn: e.target.value })} /></div>}
            {['both', 'check_out'].includes(form.type) && <div><Label htmlFor="correction-out">변경할 퇴근 시각</Label><Input id="correction-out" type="datetime-local" required value={form.checkOut} onChange={e => setForm({ ...form, checkOut: e.target.value })} /></div>}
            <div><Label htmlFor="correction-reason">신청 사유 (3자 이상)</Label><Textarea id="correction-reason" required minLength={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
            <Button type="submit" disabled={busy}>{busy ? '신청 중…' : '정정 신청'}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!review} onOpenChange={open => !busy && !open && closeReview()}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>근태 정정 검토</DialogTitle><DialogDescription>{review?.user_name} · {review?.date} · {review && statusLabels[review.status]}</DialogDescription></DialogHeader>
          <p className="text-sm">{review?.reason}</p>
          {original.isLoading ? <p role="status">원본 기록 확인 중…</p> : original.error ? <div role="alert">원본 조회 실패 <Button variant="outline" onClick={() => void original.refetch()}>다시 시도</Button></div> : <>
            <dl className="space-y-2 text-sm tabular-nums">
              <div><dt className="text-muted-foreground">현재 기록</dt><dd>출근 {time(original.data?.check_in)} / 퇴근 {time(original.data?.check_out)}</dd></div>
              <div><dt className="text-muted-foreground">요청한 변경</dt><dd>출근 {time(review?.requested_check_in)} / 퇴근 {time(review?.requested_check_out)} (미지정 항목 유지)</dd></div>
            </dl>
            {review?.status === 'pending' && <>
              <Label htmlFor="correction-review-note">처리 사유 (3자 이상)</Label>
              <Textarea id="correction-review-note" value={note} onChange={e => setNote(e.target.value)} />
              <div className="flex gap-2">
                <Button disabled={busy || note.trim().length < 3 || original.isFetching} onClick={() => void run(() => reviewAttendanceCorrection(review, 'handled', note, original.data || null), closeReview)}>승인·근태 반영</Button>
                <Button variant="outline" disabled={busy || note.trim().length < 3 || original.isFetching} onClick={() => void run(() => reviewAttendanceCorrection(review, 'rejected', note, original.data || null), closeReview)}>반려</Button>
              </div>
            </>}
          </>}
          {review?.handled_memo && <p className="text-sm">처리 사유: {review.handled_memo}</p>}
          {(!!review?.attendance_before || !!review?.attendance_after) && <details className="text-sm">
            <summary>변경 전후 이력</summary>
            <dl className="mt-2 space-y-2">{([['변경 전', review.attendance_before], ['변경 후', review.attendance_after]] as const).map(([label, raw]) => {
              const record = raw as Record<string, string | null> | null;
              return <div key={label}><dt className="font-medium">{label}</dt><dd>{record ? <>출근 {time(record.check_in)} / 퇴근 {time(record.check_out)}<p className="whitespace-pre-wrap text-muted-foreground">{record.memo}</p></> : '기록 없음'}</dd></div>;
            })}</dl>
          </details>}
          {saveError && <div role="alert" className="text-sm text-destructive">{saveError}<Button variant="outline" onClick={() => { void original.refetch(); void query.refetch().then(result => { const latest = result.data?.find(r => r.id === review?.id); if (latest) setReview(latest); }); }}>최신 기록 다시 확인</Button></div>}
        </DialogContent>
      </Dialog>
    </section>
  );
}
