import { useEffect, useMemo, useState } from 'react';
import { addDays, format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CalendarCheck2, CheckCircle2, Clock3, Loader2, LockKeyhole, MapPin, Phone, Send, UserRound, Video } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { PublicBookingLinkPublic, PublicBookingMeetingMode, PublicBookingSlot } from '@/types/publicBooking';

const todayString = () => format(new Date(), 'yyyy-MM-dd');

function getErrorMessage(error: unknown, fallback = '예약 처리에 실패했습니다.') {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const record = error as Record<string, unknown>;
    return String(record.message || record.error || record.details || fallback);
  }
  return fallback;
}

function formatDateLabel(date: string) {
  const value = new Date(`${date}T00:00:00+09:00`);
  return Number.isNaN(value.getTime()) ? date : format(value, 'yyyy년 M월 d일 EEEE', { locale: ko });
}

const CONSULTATION_TYPES = [
  { value: 'fabrication', label: '제작 상담' },
  { value: 'design', label: '디자인 상담' },
  { value: 'sheet_purchase', label: '자재/샘플 상담' },
];

const CONTACT_PREFERENCES = [
  { value: 'any', label: '상관없음' },
  { value: 'phone', label: '전화' },
  { value: 'email', label: '이메일' },
  { value: 'kakao', label: '카카오톡' },
];

function getMeetingModeLabel(mode: PublicBookingMeetingMode) {
  if (mode === 'phone') return '전화 상담';
  if (mode === 'online') return '온라인 상담';
  return '방문 상담';
}

function getMeetingModeIcon(mode: PublicBookingMeetingMode) {
  if (mode === 'phone') return Phone;
  if (mode === 'online') return Video;
  return MapPin;
}

const PublicBookingPage = () => {
  const { slug = '' } = useParams();
  const [link, setLink] = useState<PublicBookingLinkPublic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSlotsLoading, setIsSlotsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [date, setDate] = useState(todayString());
  const [accessCode, setAccessCode] = useState('');
  const [slots, setSlots] = useState<PublicBookingSlot[]>([]);
  const [selectedSlotKey, setSelectedSlotKey] = useState('');
  const [form, setForm] = useState({
    requesterName: '',
    companyName: '',
    phone: '',
    email: '',
    consultationType: 'fabrication',
    projectName: '',
    desiredDeliveryDate: '',
    contactPreference: 'any',
    purpose: '',
    notes: '',
    privacyConsent: false,
  });
  const [result, setResult] = useState<{ status: string; requiresApproval: boolean } | null>(null);

  const selectedSlot = useMemo(
    () => slots.find((slot) => `${slot.meetingMode}:${slot.resourceId || 'none'}:${slot.time}` === selectedSlotKey) || null,
    [selectedSlotKey, slots],
  );

  const isConsultation = link?.linkType === 'consultation_booking';

  useEffect(() => {
    let mounted = true;
    const loadLink = async () => {
      setIsLoading(true);
      setError('');
      try {
        const { data, error: invokeError } = await supabase.functions.invoke('public-meeting-booking', {
          body: { action: 'get-link', slug },
        });
        if (invokeError) throw invokeError;
        if (data?.error) throw new Error(String(data.error));
        if (mounted) setLink(data.link as PublicBookingLinkPublic);
      } catch (nextError) {
        if (mounted) setError(getErrorMessage(nextError, '예약 링크를 불러오지 못했습니다.'));
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    loadLink();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const loadAvailability = async () => {
    if (!link) return;
    setIsSlotsLoading(true);
    setError('');
    setSelectedSlotKey('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('public-meeting-booking', {
        body: {
          action: 'get-availability',
          slug,
          date,
          accessCode,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      setSlots(((data.slots || []) as PublicBookingSlot[]).map((slot) => ({
        ...slot,
        meetingMode: slot.meetingMode || 'visit',
        resourceId: slot.resourceId || null,
        resourceName: slot.resourceName || getMeetingModeLabel(slot.meetingMode || 'visit'),
      })));
    } catch (nextError) {
      setSlots([]);
      setError(getErrorMessage(nextError, '예약 가능 시간을 불러오지 못했습니다.'));
    } finally {
      setIsSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (!link || result) return;
    if (link.requiresAccessCode && !accessCode.trim()) {
      setSlots([]);
      return;
    }
    loadAvailability();
  }, [link, date, accessCode, result]);

  const updateForm = (key: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!link || !selectedSlot) return;
    if (!form.requesterName.trim()) {
      setError('예약자 이름을 입력해주세요.');
      return;
    }
    if (!form.purpose.trim()) {
      setError(isConsultation ? '상담 내용을 입력해주세요.' : '예약 목적을 입력해주세요.');
      return;
    }
    if (isConsultation && !form.phone.trim()) {
      setError('상담 예약에는 연락처가 필요합니다.');
      return;
    }
    if (isConsultation && !form.privacyConsent) {
      setError('개인정보 수집 및 이용에 동의해주세요.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('public-meeting-booking', {
        body: {
          action: 'create-request',
          slug,
          date,
          time: selectedSlot.time,
          resourceId: selectedSlot.resourceId,
          meetingMode: selectedSlot.meetingMode,
          assignedTo: selectedSlot.assignedTo || null,
          accessCode,
          submissionToken: `${slug}:${selectedSlot.startsAt}:${form.phone}:${form.requesterName}`.slice(0, 160),
          ...form,
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(String(data.error));
      setResult({ status: String(data.status), requiresApproval: Boolean(data.requiresApproval) });
    } catch (nextError) {
      setError(getErrorMessage(nextError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-6">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          예약 링크를 확인하고 있습니다.
        </div>
      </main>
    );
  }

  if (!link || error && !link) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f8] p-6">
        <div className="w-full max-w-lg rounded-lg border border-border bg-card p-8 text-center shadow-none">
          <CalendarCheck2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold text-foreground">예약 링크를 사용할 수 없습니다.</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error || '링크가 만료되었거나 비활성화되었습니다.'}</p>
        </div>
      </main>
    );
  }

  if (result) {
    return (
      <main className="min-h-screen bg-[#f5f6f8] px-4 py-8 text-foreground sm:px-6">
        <section className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-8 text-center shadow-none">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold">
            {result.requiresApproval ? '예약 요청이 접수되었습니다.' : '예약이 확정되었습니다.'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {result.requiresApproval
              ? isConsultation
                ? '담당자가 상담 내용과 시간을 확인한 뒤 확정합니다.'
                : '담당자가 회의실 가능 여부와 내용을 확인한 뒤 확정합니다.'
              : isConsultation
              ? '선택한 시간으로 상담 예약이 내부 캘린더에 반영되었습니다.'
              : '선택한 시간으로 회의실 예약이 내부 캘린더에 반영되었습니다.'}
          </p>
          {selectedSlot && (
            <div className="mt-6 rounded-lg border border-border bg-muted/30 p-4 text-left">
              <p className="text-sm font-semibold">{formatDateLabel(date)}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {getMeetingModeLabel(selectedSlot.meetingMode)} / {selectedSlot.resourceName} / {selectedSlot.label}
              </p>
            </div>
          )}
        </section>
      </main>
    );
  }

  const maxDate = link.rules.maxDaysAhead ? format(addDays(new Date(), link.rules.maxDaysAhead), 'yyyy-MM-dd') : undefined;

  return (
    <main className="min-h-screen bg-[#f5f6f8] px-4 py-8 text-foreground sm:px-6">
      <section className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <aside className="rounded-lg border border-border bg-card p-5 shadow-none">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-background">
              <CalendarCheck2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <Badge variant="outline" className="rounded-full">
                {link.linkType === 'partner_room' ? '공유 회의실 예약' : isConsultation ? '고객 상담 예약' : '고객 미팅 요청'}
              </Badge>
              <h1 className="mt-3 text-2xl font-bold leading-tight">{link.title}</h1>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {link.description || (link.requiresApproval ? '예약 요청 후 담당자가 확인합니다.' : '빈 시간은 바로 예약 확정됩니다.')}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 text-sm">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold">예약 가능 시간</p>
              <p className="mt-1 text-muted-foreground">
                {link.rules.startTime} - {link.rules.endTime} / {link.rules.durationMinutes}분 단위
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold">회의실</p>
              <p className="mt-1 text-muted-foreground">
                {isConsultation
                  ? link.meetingModes.map((mode) => getMeetingModeLabel(mode)).join(', ')
                  : link.resources.map((resource) => resource.name).join(', ') || '설정된 회의실 없음'}
              </p>
            </div>
            {isConsultation && link.meetingModes.includes('visit') && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="font-semibold">방문 상담 회의실</p>
                <p className="mt-1 text-muted-foreground">
                  {link.resources.map((resource) => resource.name).join(', ') || '설정된 회의실 없음'}
                </p>
              </div>
            )}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold">처리 방식</p>
              <p className="mt-1 text-muted-foreground">
                {link.requiresApproval ? '관리자 확인 후 확정' : '빈 시간 자동 확정'}
              </p>
            </div>
          </div>
        </aside>

        <section className="rounded-lg border border-border bg-card p-5 shadow-none">
          <div className="grid gap-5">
            {link.requiresAccessCode && (
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="text-sm font-semibold">접근 코드</Label>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="accessCode"
                    value={accessCode}
                    onChange={(event) => setAccessCode(event.target.value)}
                    placeholder="전달받은 코드를 입력해주세요"
                    className="h-11 rounded-lg pl-9"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-sm font-semibold">날짜</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  min={todayString()}
                  max={maxDate}
                  onChange={(event) => setDate(event.target.value)}
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-sm font-semibold">예약 가능 시간</Label>
                  {isSlotsLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                <div className="grid max-h-48 gap-2 overflow-auto rounded-lg border border-border bg-muted/20 p-2 sm:grid-cols-2">
                  {slots.length > 0 ? slots.map((slot) => {
                    const key = `${slot.meetingMode}:${slot.resourceId || 'none'}:${slot.time}`;
                    const selected = selectedSlotKey === key;
                    const ModeIcon = getMeetingModeIcon(slot.meetingMode);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedSlotKey(key)}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                          selected
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card hover:border-foreground/30',
                        )}
                      >
                        <span className="flex items-center gap-2 font-semibold">
                          <Clock3 className="h-3.5 w-3.5" />
                          {slot.label}
                        </span>
                        <span className={cn('mt-1 flex items-center gap-1 text-xs', selected ? 'text-background/70' : 'text-muted-foreground')}>
                          <ModeIcon className="h-3 w-3" />
                          {isConsultation ? `${getMeetingModeLabel(slot.meetingMode)} · ${slot.resourceName}` : slot.resourceName}
                        </span>
                      </button>
                    );
                  }) : (
                    <div className="col-span-full rounded-lg border border-dashed border-border bg-card p-4 text-center text-sm text-muted-foreground">
                      {link.requiresAccessCode && !accessCode.trim() ? '접근 코드를 입력하면 시간을 확인할 수 있습니다.' : '선택한 날짜에 예약 가능한 시간이 없습니다.'}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {isConsultation && (
              <div className="grid gap-3 rounded-lg border border-border bg-muted/20 p-3">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">상담 유형</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONSULTATION_TYPES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => updateForm('consultationType', item.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm font-semibold',
                          form.consultationType === item.value
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card text-foreground',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="projectName" className="text-sm font-semibold">프로젝트명</Label>
                    <Input
                      id="projectName"
                      value={form.projectName}
                      onChange={(event) => updateForm('projectName', event.target.value)}
                      placeholder="예: 아크릴 진열대 제작"
                      className="h-11 rounded-lg"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desiredDeliveryDate" className="text-sm font-semibold">희망 납기일</Label>
                    <Input
                      id="desiredDeliveryDate"
                      type="date"
                      value={form.desiredDeliveryDate}
                      min={todayString()}
                      onChange={(event) => updateForm('desiredDeliveryDate', event.target.value)}
                      className="h-11 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">선호 연락 방식</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONTACT_PREFERENCES.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => updateForm('contactPreference', item.value)}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm',
                          form.contactPreference === item.value
                            ? 'border-foreground bg-foreground text-background'
                            : 'border-border bg-card text-foreground',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterName" className="text-sm font-semibold">예약자 이름</Label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="requesterName"
                    value={form.requesterName}
                    onChange={(event) => updateForm('requesterName', event.target.value)}
                    placeholder="성함"
                    className="h-11 rounded-lg pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-sm font-semibold">회사명</Label>
                <Input
                  id="companyName"
                  value={form.companyName}
                  onChange={(event) => updateForm('companyName', event.target.value)}
                  placeholder="회사 또는 단체명"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold">연락처</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(event) => updateForm('phone', event.target.value)}
                  placeholder="010-0000-0000"
                  className="h-11 rounded-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">이메일</Label>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm('email', event.target.value)}
                  placeholder="name@example.com"
                  className="h-11 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purpose" className="text-sm font-semibold">{isConsultation ? '상담 내용' : '예약 목적'}</Label>
              <Textarea
                id="purpose"
                value={form.purpose}
                onChange={(event) => updateForm('purpose', event.target.value)}
                placeholder={isConsultation ? '제작 품목, 수량, 사이즈, 상담받고 싶은 내용을 적어주세요.' : '미팅 목적, 참석 인원, 필요한 준비 사항을 적어주세요.'}
                className="min-h-24 rounded-lg"
              />
            </div>

            {isConsultation && (
              <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/20 p-3 text-sm">
                <Checkbox
                  checked={form.privacyConsent}
                  onCheckedChange={(checked) => updateForm('privacyConsent', Boolean(checked))}
                />
                <span className="leading-6 text-muted-foreground">
                  상담 예약 처리를 위해 이름, 연락처, 회사명, 상담 내용을 수집하고 내부 상담 리드로 저장하는 데 동의합니다.
                </span>
              </label>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-semibold">추가 메모</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(event) => updateForm('notes', event.target.value)}
                placeholder="기타 요청사항"
                className="min-h-20 rounded-lg"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              onClick={submit}
              disabled={!selectedSlot || isSubmitting}
              className="h-12 rounded-full bg-foreground text-background hover:bg-foreground/90"
            >
              {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
              {isConsultation
                ? link.requiresApproval ? '상담 예약 요청 보내기' : '상담 예약 확정하기'
                : link.requiresApproval ? '예약 요청 보내기' : '예약 확정하기'}
            </Button>
          </div>
        </section>
      </section>
    </main>
  );
};

export default PublicBookingPage;
