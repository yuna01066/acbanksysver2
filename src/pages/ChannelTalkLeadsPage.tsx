import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  CheckCircle2,
  Clipboard,
  FileText,
  FolderOpen,
  Home,
  Link as LinkIcon,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type LeadStatus = 'new' | 'needs_review' | 'analyzed' | 'converted' | 'closed';

type ChannelTalkLead = {
  id: string;
  channel_talk_user_chat_id: string;
  channel_talk_user_id: string | null;
  channel_talk_message_id: string | null;
  channel_talk_file_keys: string[];
  customer_name: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  inquiry_type: string;
  status: LeadStatus | string;
  analysis: Record<string, any>;
  missing_fields: string[];
  raw_payload: Record<string, any>;
  project_id: string | null;
  assigned_to?: string | null;
  memo?: string | null;
  converted_quote_id?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectOption = {
  id: string;
  name: string;
  project_type: string | null;
  recipients?: { company_name: string | null } | null;
};

type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string | null;
};

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: '신규', className: 'border-sky-200 bg-sky-50 text-sky-700' },
  needs_review: { label: '검토 필요', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  analyzed: { label: '분석 완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  converted: { label: '전환 완료', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  closed: { label: '종료', className: 'border-muted bg-muted text-muted-foreground' },
};

const statusTabs: Array<{ value: LeadStatus | 'all'; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'needs_review', label: '검토 필요' },
  { value: 'analyzed', label: '분석 완료' },
  { value: 'converted', label: '전환 완료' },
  { value: 'closed', label: '종료' },
];

function statusInfo(status: string) {
  return STATUS_CONFIG[status as LeadStatus] || { label: status, className: 'border-muted bg-muted text-muted-foreground' };
}

function confidenceLabel(confidence?: string | null) {
  if (confidence === 'high') return { label: '신뢰도 높음', className: 'border-emerald-200 text-emerald-700' };
  if (confidence === 'medium') return { label: '신뢰도 보통', className: 'border-blue-200 text-blue-700' };
  return { label: '수동 검토', className: 'border-amber-200 text-amber-700' };
}

function joinValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function buildInternalMemo(lead: ChannelTalkLead) {
  const analysis = lead.analysis || {};
  const triage = analysis.triage || {};
  const missing = lead.missing_fields?.length ? lead.missing_fields.join(', ') : '없음';
  const files = lead.channel_talk_file_keys?.length ? lead.channel_talk_file_keys.join(', ') : '없음';

  return [
    '[아크뱅크 채널톡 문의 분석]',
    '',
    `- 리드 ID: ${lead.id}`,
    `- 고객: ${[lead.customer_company, lead.customer_name].filter(Boolean).join(' / ') || '미확인'}`,
    `- 연락처: ${lead.customer_phone || lead.customer_email || '미확인'}`,
    `- 문의 유형: ${analysis.inquiry_type || lead.inquiry_type || '미확인'}`,
    `- 추천 태그: ${joinValue(triage.recommendedTags) || '없음'}`,
    `- 누락 정보: ${missing}`,
    '',
    `- 첨부파일: ${files}`,
    `- 품목: ${analysis.item_name || '미확인'}`,
    `- 사이즈: ${analysis.dimensions || '미확인'}`,
    `- 수량: ${analysis.quantity || '미확인'}`,
    `- 소재/두께: ${[analysis.material, analysis.thickness].filter(Boolean).join(' / ') || '미확인'}`,
    `- 색상: ${analysis.color || '미확인'}`,
    `- 가공: ${joinValue(analysis.processing) || '미확인'}`,
    `- 희망 납기: ${analysis.desired_due_date || '미확인'}`,
    `- 배송/설치: ${analysis.delivery_or_installation || '미확인'}`,
    '',
    `- 요약: ${analysis.summary || '자동 요약 없음'}`,
    `- 고객 확인 질문: ${analysis.recommended_reply || '누락 정보를 확인해주세요.'}`,
  ].join('\n');
}

function toQuoteDraftParams(lead: ChannelTalkLead) {
  const analysis = lead.analysis || {};
  const params = new URLSearchParams({ type: 'quote', channelLeadId: lead.id });
  if (analysis.material) params.set('material', analysis.material);
  if (analysis.thickness) params.set('thickness', analysis.thickness);
  if (analysis.color) params.set('selectedColor', analysis.color);
  if (analysis.quantity) params.set('quantity', String(analysis.quantity).replace(/[^\d]/g, '') || '1');
  if (analysis.dimensions) params.set('draftDimensions', analysis.dimensions);
  if (analysis.item_name) params.set('draftItemName', analysis.item_name);
  return `/calculator?${params.toString()}`;
}

const ChannelTalkLeadsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAdmin, isModerator, profile } = useAuth();
  const canReview = isAdmin || isModerator;
  const selectedId = searchParams.get('id');

  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');

  const { data: leads = [], isLoading } = useQuery<ChannelTalkLead[]>({
    queryKey: ['channel-talk-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_talk_quote_leads' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkLead[];
    },
    enabled: !!user && canReview,
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['channel-talk-leads-project-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, project_type, recipients(company_name)')
        .order('created_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return (data || []) as ProjectOption[];
    },
    enabled: !!user && canReview,
  });

  const { data: profiles = [] } = useQuery<ProfileOption[]>({
    queryKey: ['channel-talk-leads-profile-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_approved', true)
        .order('full_name');
      if (error) throw error;
      return (data || []) as ProfileOption[];
    },
    enabled: !!user && canReview,
  });

  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const next = { ...updates };
      if (next.status === 'closed' && !next.closed_at) next.closed_at = new Date().toISOString();
      if (next.status && next.status !== 'closed') next.closed_at = null;

      const { error } = await supabase
        .from('channel_talk_quote_leads' as any)
        .update(next)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      toast.success('리드가 업데이트되었습니다.');
    },
    onError: (error: Error) => toast.error('업데이트 실패: ' + error.message),
  });

  const createProject = useMutation({
    mutationFn: async (lead: ChannelTalkLead) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const analysis = lead.analysis || {};
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          description: projectDescription.trim() || null,
          status: 'pending',
          project_type: 'client',
          contact_name: lead.customer_name || null,
          contact_phone: lead.customer_phone || null,
          contact_email: lead.customer_email || null,
          specs: {
            source: 'channel_talk_quote_lead',
            channelTalkLeadId: lead.id,
            userChatId: lead.channel_talk_user_chat_id,
            itemName: analysis.item_name || null,
            dimensions: analysis.dimensions || null,
            quantity: analysis.quantity || null,
            material: analysis.material || null,
            thickness: analysis.thickness || null,
            color: analysis.color || null,
            processing: analysis.processing || [],
            desiredDueDate: analysis.desired_due_date || null,
            summary: analysis.summary || null,
          },
          user_id: user.id,
        } as any)
        .select('id')
        .single();
      if (error) throw error;

      const { error: leadError } = await supabase
        .from('channel_talk_quote_leads' as any)
        .update({ project_id: project.id, status: 'converted' })
        .eq('id', lead.id);
      if (leadError) throw leadError;

      return project.id as string;
    },
    onSuccess: (projectId) => {
      setProjectDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads-project-options'] });
      toast.success('프로젝트 후보가 생성되었습니다.');
      navigate(`/project-management?id=${projectId}`);
    },
    onError: (error: Error) => toast.error('프로젝트 생성 실패: ' + error.message),
  });

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== 'all' && lead.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        lead.customer_name,
        lead.customer_company,
        lead.customer_phone,
        lead.customer_email,
        lead.inquiry_type,
        lead.analysis?.item_name,
        lead.analysis?.summary,
        lead.analysis?.dimensions,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [leads, search, statusFilter]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedId) || filteredLeads[0] || null,
    [filteredLeads, leads, selectedId],
  );

  const openProjectDialog = (lead: ChannelTalkLead) => {
    const analysis = lead.analysis || {};
    setProjectName(
      analysis.item_name
        || lead.customer_company
        || lead.customer_name
        || `채널톡 문의 ${format(new Date(lead.created_at), 'MMdd HHmm')}`,
    );
    setProjectDescription(buildInternalMemo(lead));
    setProjectDialogOpen(true);
  };

  const copyMemo = async (lead: ChannelTalkLead) => {
    await navigator.clipboard.writeText(buildInternalMemo(lead));
    toast.success('채널톡 내부 메모 내용이 복사되었습니다.');
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로그인이 필요합니다.
      </div>
    );
  }

  if (!canReview) {
    return (
      <PageShell maxWidth="5xl">
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <div>
              <p className="font-semibold">접근 권한이 없습니다.</p>
              <p className="mt-1 text-sm text-muted-foreground">채널톡 분석 리드는 관리자와 중간관리자만 확인할 수 있습니다.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/')}>홈으로</Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Channel Talk"
        title="채널톡 문의 분석함"
        description="채널톡 첨부파일 자동 분석 결과를 검토하고 견적/프로젝트 업무로 연결합니다."
        icon={<MessageSquareText className="h-5 w-5" />}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
              <Home className="h-4 w-4" />
              홈
            </Button>
          </>
        )}
      />

      <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
        <div className="space-y-3">
          <SearchFilterBar className="space-y-3">
            <Tabs value={statusFilter} onValueChange={(value) => setStatusFilter(value as LeadStatus | 'all')}>
              <TabsList className="flex h-auto flex-wrap justify-start gap-1 bg-muted/60 p-1">
                {statusTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="h-8 rounded-lg px-2.5 text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="고객, 품목, 사이즈, 요약 검색"
                className="h-9 rounded-xl pl-8 text-xs"
              />
            </div>
          </SearchFilterBar>

          <div className="max-h-[calc(100vh-250px)] space-y-2 overflow-y-auto pr-1">
            {isLoading ? (
              <Card><CardContent className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
            ) : filteredLeads.length === 0 ? (
              <Card className="border-dashed"><CardContent className="py-16 text-center text-sm text-muted-foreground">조건에 맞는 리드가 없습니다.</CardContent></Card>
            ) : (
              filteredLeads.map((lead) => {
                const s = statusInfo(lead.status);
                const confidence = confidenceLabel(lead.analysis?.confidence);
                const isSelected = selectedLead?.id === lead.id;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSearchParams({ id: lead.id }, { replace: true })}
                    className={cn(
                      'w-full rounded-2xl border bg-background/80 p-3 text-left shadow-sm transition-colors hover:bg-accent/30',
                      isSelected && 'border-primary/50 bg-primary/5',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {lead.analysis?.item_name || lead.customer_company || lead.customer_name || '채널톡 견적 문의'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {[lead.customer_company, lead.customer_name, lead.customer_phone].filter(Boolean).join(' · ') || lead.channel_talk_user_chat_id}
                        </p>
                      </div>
                      <Badge variant="outline" className={cn('shrink-0 text-[10px]', s.className)}>
                        {s.label}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="outline" className={cn('text-[10px]', confidence.className)}>{confidence.label}</Badge>
                      {lead.missing_fields?.length > 0 && (
                        <Badge variant="outline" className="border-amber-200 text-amber-700 text-[10px]">
                          누락 {lead.missing_fields.length}
                        </Badge>
                      )}
                      {lead.project_id && <Badge variant="outline" className="text-[10px]">프로젝트 연결</Badge>}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                      {lead.analysis?.summary || '분석 요약이 없습니다.'}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground/70">
                      {format(new Date(lead.created_at), 'yyyy. M. d HH:mm', { locale: ko })}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <Card className="min-h-[680px] border-white/60 bg-card/75">
          {!selectedLead ? (
            <CardContent className="flex h-full min-h-[420px] flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquareText className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">확인할 채널톡 리드를 선택하세요.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b">
                <BrandedCardHeader
                  icon={MessageSquareText}
                  title={selectedLead.analysis?.item_name || selectedLead.customer_company || '채널톡 문의 분석'}
                  subtitle={`${[selectedLead.customer_company, selectedLead.customer_name].filter(Boolean).join(' / ') || '고객 미확인'} · ${format(new Date(selectedLead.created_at), 'yyyy. M. d HH:mm', { locale: ko })}`}
                  meta={<Badge variant="outline" className={statusInfo(selectedLead.status).className}>{statusInfo(selectedLead.status).label}</Badge>}
                  actions={(
                    <Button variant="outline" size="sm" onClick={() => copyMemo(selectedLead)} className="gap-1.5">
                      <Clipboard className="h-3.5 w-3.5" />
                      내부 메모 복사
                    </Button>
                  )}
                />
              </CardHeader>
              <CardContent className="grid gap-5 p-5 xl:grid-cols-[1fr_300px]">
                <ScrollArea className="max-h-[calc(100vh-250px)] pr-3">
                  <div className="space-y-5">
                    <section className="grid gap-3 sm:grid-cols-2">
                      {[
                        ['품목', selectedLead.analysis?.item_name],
                        ['사이즈', selectedLead.analysis?.dimensions],
                        ['수량', selectedLead.analysis?.quantity],
                        ['소재/두께', [selectedLead.analysis?.material, selectedLead.analysis?.thickness].filter(Boolean).join(' / ')],
                        ['색상', selectedLead.analysis?.color],
                        ['희망 납기', selectedLead.analysis?.desired_due_date],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl border bg-background/70 p-3">
                          <p className="text-[11px] text-muted-foreground">{label}</p>
                          <p className="mt-1 text-sm font-medium">{value || '미확인'}</p>
                        </div>
                      ))}
                    </section>

                    <section className="rounded-xl border bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">분석 요약</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {selectedLead.analysis?.summary || '자동 요약이 없습니다.'}
                      </p>
                    </section>

                    <section className="rounded-xl border bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">추천 질문 / 내부 참고 답변</h3>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                        {selectedLead.analysis?.recommended_reply || '누락된 정보를 고객에게 확인해주세요.'}
                      </p>
                    </section>

                    <section className="rounded-xl border bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">태그 · 누락 정보</h3>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {(selectedLead.analysis?.triage?.recommendedTags || []).map((tag: string) => (
                          <Badge key={tag} variant="secondary">{tag}</Badge>
                        ))}
                        {selectedLead.missing_fields?.map((field) => (
                          <Badge key={field} variant="outline" className="border-amber-200 text-amber-700">{field} 확인 필요</Badge>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-xl border bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">첨부파일 키</h3>
                      <div className="mt-2 space-y-1">
                        {selectedLead.channel_talk_file_keys?.length ? selectedLead.channel_talk_file_keys.map((key) => (
                          <div key={key} className="rounded-md bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">{key}</div>
                        )) : <p className="text-sm text-muted-foreground">첨부파일 키가 없습니다.</p>}
                      </div>
                    </section>

                    <section className="rounded-xl border bg-background/70 p-4">
                      <h3 className="text-sm font-semibold">원본 payload 요약</h3>
                      <pre className="mt-2 max-h-60 overflow-auto rounded-lg bg-muted/50 p-3 text-[11px] text-muted-foreground">
                        {JSON.stringify({
                          event: selectedLead.raw_payload?.event,
                          entity: selectedLead.raw_payload?.entity,
                          refers: selectedLead.raw_payload?.refers,
                        }, null, 2)}
                      </pre>
                    </section>
                  </div>
                </ScrollArea>

                <aside className="space-y-4">
                  <div className="rounded-xl border bg-background/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><UserRound className="h-4 w-4" /> 리드 관리</h3>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs">상태</Label>
                        <Select
                          value={selectedLead.status}
                          onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { status: value } })}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusTabs.filter(tab => tab.value !== 'all').map(tab => (
                              <SelectItem key={tab.value} value={tab.value}>{tab.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">담당자</Label>
                        <Select
                          value={selectedLead.assigned_to || 'none'}
                          onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { assigned_to: value === 'none' ? null : value } })}
                        >
                          <SelectTrigger className="mt-1 h-9">
                            <SelectValue placeholder="담당자 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">미지정</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || p.email || p.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">상담원 메모</Label>
                        <Textarea
                          defaultValue={selectedLead.memo || ''}
                          placeholder="내부 확인 내용, 고객 확인 사항 등을 기록하세요."
                          className="mt-1 min-h-24 text-xs"
                          onBlur={(event) => {
                            if (event.target.value !== (selectedLead.memo || '')) {
                              updateLead.mutate({ id: selectedLead.id, updates: { memo: event.target.value || null } });
                            }
                          }}
                        />
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full gap-1.5"
                        onClick={() => updateLead.mutate({ id: selectedLead.id, updates: { assigned_to: user.id, status: selectedLead.status === 'new' ? 'analyzed' : selectedLead.status } })}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        내 담당으로 지정
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-background/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FolderOpen className="h-4 w-4" /> 프로젝트 연결</h3>
                    <Select
                      value={selectedLead.project_id || 'none'}
                      onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { project_id: value === 'none' ? null : value, status: value === 'none' ? selectedLead.status : 'converted' } })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="기존 프로젝트 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">연결 안 함</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full gap-1.5"
                      onClick={() => selectedLead.project_id && navigate(`/project-management?id=${selectedLead.project_id}`)}
                      disabled={!selectedLead.project_id}
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                      연결 프로젝트 열기
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-background/70 p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Send className="h-4 w-4" /> 업무 전환</h3>
                    <div className="space-y-2">
                      <Button className="w-full gap-1.5" size="sm" onClick={() => navigate(toQuoteDraftParams(selectedLead))}>
                        <FileText className="h-3.5 w-3.5" />
                        견적 초안 만들기
                      </Button>
                      <Button variant="outline" className="w-full gap-1.5" size="sm" onClick={() => openProjectDialog(selectedLead)}>
                        <FolderOpen className="h-3.5 w-3.5" />
                        프로젝트 후보 만들기
                      </Button>
                      <Button variant="outline" className="w-full gap-1.5" size="sm" onClick={() => copyMemo(selectedLead)}>
                        <MessageSquareText className="h-3.5 w-3.5" />
                        채널톡 내부 메모 복사
                      </Button>
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      고객 자동답변은 전송하지 않습니다. 추천 답변은 내부 참고용으로만 사용합니다.
                    </p>
                  </div>
                </aside>
              </CardContent>

              <Dialog open={projectDialogOpen} onOpenChange={setProjectDialogOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>프로젝트 후보 만들기</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>프로젝트명</Label>
                      <Input value={projectName} onChange={(event) => setProjectName(event.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label>설명 / 분석 메모</Label>
                      <Textarea value={projectDescription} onChange={(event) => setProjectDescription(event.target.value)} className="mt-1 min-h-56 text-xs" />
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                      저장하면 클라이언트 프로젝트가 생성되고 이 채널톡 리드와 연결됩니다.
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>취소</Button>
                    <Button
                      onClick={() => selectedLead && createProject.mutate(selectedLead)}
                      disabled={!projectName.trim() || createProject.isPending}
                    >
                      {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      프로젝트 생성
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </Card>
      </div>
    </PageShell>
  );
};

export default ChannelTalkLeadsPage;
