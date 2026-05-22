import React, { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  Building2,
  Check,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Pencil,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import AvatarUpload from '@/components/employee/AvatarUpload';
import LaborLawPanel from '@/components/employee/LaborLawPanel';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  DIRECT_PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  ProfileChangeRequest,
  useMyHrProfile,
  useProfileChangeRequests,
  useProfileChangeReviewQueue,
} from '@/hooks/useHrSelfService';

type DirectFieldKey = (typeof DIRECT_PROFILE_FIELDS)[number];

const directFieldGroups: Array<{
  title: string;
  icon: React.ReactNode;
  fields: Array<{ key: DirectFieldKey; label: string; type?: string }>;
}> = [
  {
    title: '연락처',
    icon: <User className="h-4 w-4" />,
    fields: [
      { key: 'nickname', label: '닉네임' },
      { key: 'phone', label: '휴대전화' },
      { key: 'personal_email', label: '개인 이메일', type: 'email' },
    ],
  },
  {
    title: '주소',
    icon: <Building2 className="h-4 w-4" />,
    fields: [
      { key: 'address', label: '주소' },
      { key: 'detail_address', label: '상세주소' },
      { key: 'zipcode', label: '우편번호' },
    ],
  },
  {
    title: '급여계좌',
    icon: <CreditCard className="h-4 w-4" />,
    fields: [
      { key: 'bank_name', label: '은행명' },
      { key: 'bank_account', label: '계좌번호' },
    ],
  },
];

const requestableFields = [
  'full_name',
  'employee_number',
  'department',
  'position',
  'job_title',
  'job_group',
  'rank_title',
  'rank_level',
  'join_date',
  'group_join_date',
  'join_type',
  'work_type',
  'work_hours_per_week',
  'overtime_policy',
  'salary_info',
  'wage_contract',
  'leave_policy',
  'holidays',
  'leave_history',
  'awards',
  'disciplinary',
  'career_history',
  'education',
  'special_notes',
  'family_info',
];

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return '미입력';
  if (typeof value === 'number') return String(value);
  return String(value);
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '';

const InfoLine = ({ label, value }: { label: string; value: unknown }) => (
  <div className="grid grid-cols-[108px,1fr] gap-3 py-2 text-sm">
    <span className="text-muted-foreground">{label}</span>
    <span className="min-w-0 whitespace-pre-line font-medium">{formatValue(value)}</span>
  </div>
);

function RequestSummary({ request }: { request: ProfileChangeRequest }) {
  const entries = Object.entries(request.changes || {}).filter(([key]) => key !== '_reason');
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant={request.status === 'pending' ? 'default' : 'outline'}>
          {request.status === 'pending' ? '승인 대기' : request.status === 'approved' ? '승인' : request.status === 'rejected' ? '반려' : '취소'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(request.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
        </span>
      </div>
      <div className="space-y-1 text-sm">
        {entries.map(([key, value]) => (
          <p key={key}>
            <span className="text-muted-foreground">{PROFILE_FIELD_LABELS[key] || key}</span>
            <span className="ml-2 font-medium">{formatValue(value)}</span>
          </p>
        ))}
        {typeof request.changes?._reason === 'string' && request.changes._reason && (
          <p className="text-xs text-muted-foreground">사유: {request.changes._reason}</p>
        )}
        {request.review_comment && (
          <p className="text-xs text-destructive">검토 의견: {request.review_comment}</p>
        )}
      </div>
    </div>
  );
}

const ProfileChangeReviewQueue: React.FC = () => {
  const { isAdmin, isModerator } = useAuth();
  const canReview = isAdmin || isModerator;
  const { data: queue = [], isLoading, reviewRequest } = useProfileChangeReviewQueue(canReview);
  const [rejecting, setRejecting] = useState<ProfileChangeRequest | null>(null);
  const [rejectComment, setRejectComment] = useState('');

  if (!canReview) return null;

  const approve = async (request: ProfileChangeRequest) => {
    try {
      await reviewRequest.mutateAsync({ requestId: request.id, status: 'approved' });
      toast.success('인사 정보 변경을 승인했습니다.');
    } catch (error: unknown) {
      toast.error('승인 실패: ' + getErrorMessage(error));
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    try {
      await reviewRequest.mutateAsync({ requestId: rejecting.id, status: 'rejected', comment: rejectComment });
      toast.success('인사 정보 변경 요청을 반려했습니다.');
      setRejecting(null);
      setRejectComment('');
    } catch (error: unknown) {
      toast.error('반려 실패: ' + getErrorMessage(error));
    }
  };

  return (
    <>
      <Card className="border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-primary" />
            인사정보 변경 요청 검토
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : queue.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              승인 대기 중인 변경 요청이 없습니다.
            </div>
          ) : (
            queue.map((request) => (
              <div key={request.id} className="rounded-lg border p-4">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold">{request.profile?.full_name || '직원'}</p>
                    <p className="text-xs text-muted-foreground">
                      {request.profile?.department || '부서 미등록'}
                      {request.profile?.position ? ` · ${request.profile.position}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(request.created_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </span>
                </div>
                <RequestSummary request={request} />
                <div className="mt-3 flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRejecting(request)}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    반려
                  </Button>
                  <Button size="sm" onClick={() => approve(request)} disabled={reviewRequest.isPending}>
                    <Check className="mr-1 h-3.5 w-3.5" />
                    승인
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!rejecting} onOpenChange={(open) => { if (!open) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>변경 요청 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder="반려 사유를 입력하세요." />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRejecting(null)}>취소</Button>
              <Button variant="destructive" onClick={reject} disabled={reviewRequest.isPending}>반려</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const MyProfileSelfService: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useMyHrProfile();
  const { data: changeRequests = [], createRequest, cancelRequest } = useProfileChangeRequests();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<DirectFieldKey, string>>({
    nickname: '',
    phone: '',
    personal_email: '',
    address: '',
    detail_address: '',
    zipcode: '',
    bank_name: '',
    bank_account: '',
    avatar_url: '',
  });
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestField, setRequestField] = useState('department');
  const [requestValue, setRequestValue] = useState('');
  const [requestReason, setRequestReason] = useState('');

  const pendingRequests = changeRequests.filter((request) => request.status === 'pending');

  const readonlySections = useMemo(() => {
    if (!profile) return [];
    return [
      {
        title: '조직 · 직무',
        icon: <Building2 className="h-4 w-4" />,
        rows: [
          ['부서', profile.department],
          ['직책', profile.position],
          ['직무', profile.job_title],
          ['직군', profile.job_group],
          ['직위', profile.rank_title],
          ['직급', profile.rank_level],
        ],
      },
      {
        title: '입사 · 근무',
        icon: <Clock className="h-4 w-4" />,
        rows: [
          ['사번', profile.employee_number],
          ['입사일', profile.join_date ? format(new Date(profile.join_date), 'yyyy년 M월 d일', { locale: ko }) : null],
          ['근무 유형', profile.work_type],
          ['주당 근무시간', profile.work_hours_per_week ? `주 ${profile.work_hours_per_week}시간` : null],
          ['초과근무 정책', profile.overtime_policy],
        ],
      },
      {
        title: '급여 · 계약 · 휴가 정책',
        icon: <FileText className="h-4 w-4" />,
        rows: [
          ['급여 지급', profile.salary_info],
          ['임금 계약', profile.wage_contract],
          ['휴가 정책', profile.leave_policy],
          ['쉬는 날', profile.holidays],
          ['휴직 이력', profile.leave_history],
        ],
      },
      {
        title: '기타 인사 정보',
        icon: <AlertTriangle className="h-4 w-4" />,
        rows: [
          ['수상', profile.awards],
          ['징계', profile.disciplinary],
          ['경력', profile.career_history],
          ['학력', profile.education],
          ['특이사항', profile.special_notes],
          ['가족', profile.family_info],
        ],
      },
    ];
  }, [profile]);

  const startEdit = () => {
    if (!profile) return;
    setEditValues({
      nickname: profile.nickname || '',
      phone: profile.phone || '',
      personal_email: profile.personal_email || '',
      address: profile.address || '',
      detail_address: profile.detail_address || '',
      zipcode: profile.zipcode || '',
      bank_name: profile.bank_name || '',
      bank_account: profile.bank_account || '',
      avatar_url: profile.avatar_url || '',
    });
    setEditing(true);
  };

  const saveDirectFields = async () => {
    if (!user || !profile) return;
    const updates: Record<string, string | null> = {};
    DIRECT_PROFILE_FIELDS.forEach((field) => {
      if (field === 'avatar_url') return;
      const nextValue = editValues[field] || '';
      const oldValue = String(profile[field] || '');
      if (nextValue !== oldValue) updates[field] = nextValue || null;
    });

    if (Object.keys(updates).length === 0) {
      toast.info('변경된 직접 수정 항목이 없습니다.');
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
      if (error) throw error;
      toast.success('내 정보가 저장되었습니다.');
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['my-hr-profile', user.id] });
    } catch (error: unknown) {
      toast.error('저장 실패: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const submitChangeRequest = async () => {
    if (!requestField || !requestValue.trim()) {
      toast.warning('변경할 항목과 요청 값을 입력해주세요.');
      return;
    }
    try {
      const value = requestField === 'work_hours_per_week' ? Number(requestValue) : requestValue.trim();
      await createRequest.mutateAsync({
        [requestField]: value,
        ...(requestReason.trim() ? { _reason: requestReason.trim() } : {}),
      });
      toast.success('인사 정보 변경 요청을 접수했습니다.');
      setRequestOpen(false);
      setRequestValue('');
      setRequestReason('');
    } catch (error: unknown) {
      toast.error('요청 실패: ' + getErrorMessage(error));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!profile || !user) return null;

  return (
    <>
      <div className="space-y-6">
        <Card className="border">
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <AvatarUpload
                  userId={user.id}
                  avatarUrl={profile.avatar_url || null}
                  name={profile.full_name}
                  size="lg"
                  editable
                  onUploaded={() => queryClient.invalidateQueries({ queryKey: ['my-hr-profile', user.id] })}
                />
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl">{profile.full_name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {profile.department || '부서 미등록'}
                    {profile.position ? ` · ${profile.position}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {!editing ? (
                  <Button variant="outline" size="sm" onClick={startEdit}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    직접 수정
                  </Button>
                ) : (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
                      취소
                    </Button>
                    <Button size="sm" onClick={saveDirectFields} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}
                      저장
                    </Button>
                  </>
                )}
                <Button size="sm" onClick={() => setRequestOpen(true)}>
                  변경 요청
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>직접 수정 가능 범위</AlertTitle>
              <AlertDescription>
                연락처, 주소, 급여계좌, 프로필 사진은 즉시 수정됩니다. 조직, 직무, 입사, 근무, 급여·계약, 징계 등 인사 기준 정보는 변경 요청 후 관리자 승인이 필요합니다.
              </AlertDescription>
            </Alert>

            <div className="grid gap-4 lg:grid-cols-3">
              {directFieldGroups.map((group) => (
                <div key={group.title} className="rounded-lg border p-4">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    {group.icon}
                    {group.title}
                  </h3>
                  <div className="space-y-3">
                    {group.fields.map((field) => (
                      <div key={field.key}>
                        <Label className="text-xs text-muted-foreground">{field.label}</Label>
                        {editing ? (
                          <Input
                            type={field.type || 'text'}
                            value={editValues[field.key] || ''}
                            onChange={(event) => setEditValues((prev) => ({ ...prev, [field.key]: event.target.value }))}
                            className="mt-1 h-9 text-sm"
                          />
                        ) : (
                          <p className="mt-1 min-h-9 rounded-md bg-muted/30 px-3 py-2 text-sm font-medium">
                            {formatValue(profile[field.key])}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            {readonlySections.map((section) => (
              <Card key={section.title} className="border">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    {section.icon}
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="divide-y">
                    {section.rows.map(([label, value]) => (
                      <InfoLine key={label} label={label} value={value} />
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">근로기준법 적용</CardTitle>
              </CardHeader>
              <CardContent>
                <LaborLawPanel joinDate={profile.join_date || ''} weeklyWorkHours={profile.work_hours_per_week || 40} />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="border">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  변경 요청 내역
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {changeRequests.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                    접수된 변경 요청이 없습니다.
                  </div>
                ) : (
                  changeRequests.slice(0, 6).map((request) => (
                    <div key={request.id} className="space-y-2">
                      <RequestSummary request={request} />
                      {request.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs text-muted-foreground"
                          onClick={() => cancelRequest.mutate(request.id)}
                        >
                          요청 취소
                        </Button>
                      )}
                    </div>
                  ))
                )}
                {pendingRequests.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    승인 대기 중인 요청 {pendingRequests.length}건이 있습니다.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <ProfileChangeReviewQueue />
      </div>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>인사 정보 변경 요청</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>변경 항목</Label>
              <Select value={requestField} onValueChange={(value) => { setRequestField(value); setRequestValue(''); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {requestableFields.map((field) => (
                    <SelectItem key={field} value={field}>
                      {PROFILE_FIELD_LABELS[field] || field}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>요청 값</Label>
              {['salary_info', 'wage_contract', 'leave_policy', 'overtime_policy', 'holidays', 'leave_history', 'awards', 'disciplinary', 'career_history', 'education', 'special_notes', 'family_info'].includes(requestField) ? (
                <Textarea value={requestValue} onChange={(event) => setRequestValue(event.target.value)} rows={4} placeholder="변경 요청 내용을 입력하세요." />
              ) : (
                <Input
                  type={requestField.includes('date') ? 'date' : requestField === 'work_hours_per_week' ? 'number' : 'text'}
                  value={requestValue}
                  onChange={(event) => setRequestValue(event.target.value)}
                  placeholder="변경 요청 값을 입력하세요."
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>요청 사유</Label>
              <Textarea value={requestReason} onChange={(event) => setRequestReason(event.target.value)} rows={3} placeholder="관리자가 확인할 수 있도록 사유를 남겨주세요." />
            </div>
            <Separator />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRequestOpen(false)}>취소</Button>
              <Button onClick={submitChangeRequest} disabled={createRequest.isPending}>
                {createRequest.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                요청 접수
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MyProfileSelfService;
