import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clipboard,
  Download,
  FileText,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Search,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type BrandingStatus = 'new' | 'reviewing' | 'responded' | 'project_candidate' | 'closed';

type BrandingIntake = {
  id: string;
  status: BrandingStatus;
  customer_company: string | null;
  customer_name: string;
  customer_position: string | null;
  customer_phone: string;
  customer_email: string | null;
  project_name: string;
  industry: string | null;
  homepage_url: string | null;
  reference_note: string | null;
  inquiry_body: string;
  package_label: string | null;
  lead_time_label: string | null;
  optimization_tier_label: string | null;
  customer_estimate_text: string | null;
  customer_message: string | null;
  internal_breakdown: string | null;
  separate_review_items: string[] | null;
  assigned_to: string | null;
  assigned_at: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

type BrandingFile = {
  id: string;
  intake_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

type BrandingEvent = {
  id: string;
  intake_id: string;
  event_type: string;
  note: string | null;
  created_at: string;
  actor_id: string | null;
};

const statusMeta: Record<BrandingStatus, { label: string; className: string }> = {
  new: { label: '신규', className: 'border-slate-950 text-slate-950' },
  reviewing: { label: '검토중', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  responded: { label: '답변완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  project_candidate: { label: '프로젝트 후보', className: 'border-violet-200 bg-violet-50 text-violet-700' },
  closed: { label: '종료', className: 'border-slate-200 bg-slate-100 text-slate-600' },
};

const statusOptions: Array<{ value: BrandingStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'reviewing', label: '검토중' },
  { value: 'responded', label: '답변완료' },
  { value: 'project_candidate', label: '프로젝트 후보' },
  { value: 'closed', label: '종료' },
];

const supabaseAny = supabase as any;

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatFileSize(size?: number | null) {
  if (!size) return '-';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(size / 1024))}KB`;
}

const BrandingIntakesPage = () => {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const [intakes, setIntakes] = useState<BrandingIntake[]>([]);
  const [files, setFiles] = useState<BrandingFile[]>([]);
  const [events, setEvents] = useState<BrandingEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<BrandingStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memoDraft, setMemoDraft] = useState('');

  const selected = useMemo(
    () => intakes.find((item) => item.id === selectedId) || intakes[0] || null,
    [intakes, selectedId],
  );

  const selectedFiles = useMemo(
    () => files.filter((file) => file.intake_id === selected?.id),
    [files, selected?.id],
  );

  const selectedEvents = useMemo(
    () => events.filter((event) => event.intake_id === selected?.id),
    [events, selected?.id],
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [intakesResult, filesResult, eventsResult] = await Promise.all([
        supabaseAny.from('branding_intakes').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAny.from('branding_intake_files').select('*').order('created_at', { ascending: false }).limit(500),
        supabaseAny.from('branding_intake_events').select('*').order('created_at', { ascending: false }).limit(500),
      ]);

      if (intakesResult.error) throw intakesResult.error;
      if (filesResult.error) throw filesResult.error;
      if (eventsResult.error) throw eventsResult.error;

      setIntakes((intakesResult.data || []) as BrandingIntake[]);
      setFiles((filesResult.data || []) as BrandingFile[]);
      setEvents((eventsResult.data || []) as BrandingEvent[]);
      if (!selectedId && intakesResult.data?.[0]?.id) setSelectedId(intakesResult.data[0].id);
    } catch (error) {
      toast({
        title: '브랜딩 접수함 로드 실패',
        description: error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    setMemoDraft(selected?.memo || '');
  }, [selected?.id, selected?.memo]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return intakes.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const text = [
        item.customer_company,
        item.customer_name,
        item.customer_phone,
        item.customer_email,
        item.project_name,
        item.industry,
        item.inquiry_body,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalizedQuery || text.includes(normalizedQuery));
    });
  }, [intakes, query, statusFilter]);

  const writeEvent = async (intakeId: string, eventType: string, note: string) => {
    const { error } = await supabaseAny.from('branding_intake_events').insert({
      intake_id: intakeId,
      event_type: eventType,
      note,
      actor_id: user?.id || null,
    });
    if (error) throw error;
  };

  const updateSelected = async (updates: Partial<BrandingIntake>, eventType: string, note: string) => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await supabaseAny
        .from('branding_intakes')
        .update(updates)
        .eq('id', selected.id);
      if (error) throw error;
      await writeEvent(selected.id, eventType, note);
      await loadData();
      toast({ title: '저장 완료', description: note });
    } catch (error) {
      toast({
        title: '저장 실패',
        description: error instanceof Error ? error.message : '변경사항을 저장하지 못했습니다.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const assignToMe = () => {
    const fullName = profile?.full_name || user?.email || '담당자';
    updateSelected(
      {
        assigned_to: user?.id || null,
        assigned_at: new Date().toISOString(),
      },
      'assigned',
      `${fullName}님에게 담당 배정되었습니다.`,
    );
  };

  const saveMemo = () => {
    updateSelected({ memo: memoDraft }, 'memo_updated', '내부 메모를 저장했습니다.');
  };

  const copyText = async (label: string, value?: string | null) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    toast({ title: '복사 완료', description: `${label}을 복사했습니다.` });
  };

  const downloadFile = async (file: BrandingFile) => {
    const { data, error } = await supabase.storage.from(file.storage_bucket).createSignedUrl(file.storage_path, 120);
    if (error || !data?.signedUrl) {
      toast({
        title: '다운로드 URL 생성 실패',
        description: error?.message || '첨부파일을 열 수 없습니다.',
        variant: 'destructive',
      });
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-20 text-slate-950">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <Sparkles className="h-3.5 w-3.5" />
              Branding
            </div>
            <h1 className="text-3xl font-black tracking-tight">브랜딩 접수함</h1>
            <p className="mt-2 text-sm text-slate-600">브랜딩 접수 위젯에서 들어온 문의만 별도로 관리합니다.</p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            새로고침
          </Button>
        </header>

        <section className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <Card className="overflow-hidden rounded-[24px] border-slate-200 shadow-sm">
            <CardHeader className="border-b bg-white">
              <CardTitle>접수 목록</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="고객, 프로젝트, 연락처 검색" />
                </div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BrandingStatus | 'all')}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="max-h-[760px] space-y-2 overflow-y-auto p-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">접수된 브랜딩 문의가 없습니다.</div>
              ) : filtered.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'w-full rounded-2xl border p-4 text-left transition hover:border-slate-950',
                    selected?.id === item.id ? 'border-slate-950 bg-white shadow-sm' : 'border-slate-200 bg-white/70',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-base font-black">{item.project_name}</div>
                      <div className="mt-1 truncate text-sm text-slate-600">{item.customer_company || item.customer_name}</div>
                    </div>
                    <Badge variant="outline" className={statusMeta[item.status]?.className}>{statusMeta[item.status]?.label || item.status}</Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.customer_estimate_text || '예상금액 미산정'}</span>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          {selected ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader className="border-b">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <CardTitle className="text-2xl">{selected.project_name}</CardTitle>
                        <p className="mt-2 text-sm text-slate-500">
                          {selected.customer_company || '회사명 미입력'} · {selected.customer_name} · {selected.customer_phone}
                        </p>
                      </div>
                      <Select
                        value={selected.status}
                        onValueChange={(value) => updateSelected({ status: value as BrandingStatus }, 'status_changed', `상태를 ${statusMeta[value as BrandingStatus]?.label || value}(으)로 변경했습니다.`)}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.filter((option) => option.value !== 'all').map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold text-slate-500">패키지</div>
                        <div className="mt-1 font-black">{selected.package_label || '-'}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold text-slate-500">납기</div>
                        <div className="mt-1 font-black">{selected.lead_time_label || '-'}</div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="text-xs font-semibold text-slate-500">예상범위</div>
                        <div className="mt-1 font-black">{selected.customer_estimate_text || '-'}</div>
                      </div>
                    </div>

                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-black">고객용 안내문</h2>
                        <Button size="sm" variant="outline" onClick={() => copyText('고객용 안내문', selected.customer_message)}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          복사
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-white p-4 font-sans text-sm leading-6 text-slate-700">{selected.customer_message || '-'}</pre>
                    </section>

                    <section>
                      <div className="mb-2 flex items-center justify-between">
                        <h2 className="text-sm font-black">내부 산정 breakdown</h2>
                        <Button size="sm" variant="outline" onClick={() => copyText('내부 산정 breakdown', selected.internal_breakdown)}>
                          <Clipboard className="mr-2 h-4 w-4" />
                          복사
                        </Button>
                      </div>
                      <pre className="whitespace-pre-wrap rounded-2xl border border-slate-200 bg-slate-950 p-4 font-sans text-sm leading-6 text-white">{selected.internal_breakdown || '-'}</pre>
                    </section>

                    <section>
                      <h2 className="mb-2 text-sm font-black">문의 내용</h2>
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-700">
                        {selected.inquiry_body}
                      </div>
                    </section>
                  </CardContent>
                </Card>
              </div>

              <aside className="space-y-5">
                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <UserCheck className="h-5 w-5" />
                      담당·메모
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button className="w-full" variant="outline" onClick={assignToMe} disabled={saving}>
                      나에게 배정
                    </Button>
                    <div className="space-y-2">
                      <Label>내부 메모</Label>
                      <Textarea value={memoDraft} onChange={(event) => setMemoDraft(event.target.value)} className="min-h-28" />
                      <Button className="w-full" onClick={saveMemo} disabled={saving}>메모 저장</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <FileText className="h-5 w-5" />
                      첨부파일
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {selectedFiles.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-5 text-center text-sm text-slate-500">첨부파일 없음</div>
                    ) : selectedFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => downloadFile(file)}
                        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm hover:border-slate-950"
                      >
                        <span className="min-w-0 truncate">{file.file_name}</span>
                        <span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          {formatFileSize(file.file_size)}
                          <Download className="h-3.5 w-3.5" />
                        </span>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                <Card className="rounded-[24px] border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageSquareText className="h-5 w-5" />
                      이력
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {selectedEvents.length === 0 ? (
                      <div className="text-sm text-slate-500">이력이 없습니다.</div>
                    ) : selectedEvents.map((event) => (
                      <div key={event.id} className="rounded-xl bg-slate-50 p-3 text-sm">
                        <div className="font-bold">{event.event_type}</div>
                        <div className="mt-1 text-slate-600">{event.note}</div>
                        <div className="mt-2 text-xs text-slate-400">{formatDate(event.created_at)}</div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : (
            <Card className="rounded-[24px] border-slate-200 shadow-sm">
              <CardContent className="flex min-h-[500px] items-center justify-center text-slate-500">
                접수 건을 선택해주세요.
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
};

export default BrandingIntakesPage;
