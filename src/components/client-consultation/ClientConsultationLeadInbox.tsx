import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Archive,
  CalendarDays,
  CheckCircle2,
  Download,
  FileText,
  FolderOpen,
  Loader2,
  Mail,
  MapPin,
  MessageSquareText,
  Package,
  Phone,
  Search,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Attachment, QuoteRecipient } from '@/contexts/QuoteContext';
import { createQuoteDraft } from '@/services/quoteDrafts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ClientLeadStatus = 'new' | 'needs_review' | 'converted' | 'closed' | 'on_hold';
type ClientLeadFilter = 'all' | ClientLeadStatus;

type ClientConsultationFile = {
  id: string;
  lead_id: string;
  file_name: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  file_size: number | null;
  created_at: string;
};

type ClientConsultationLead = {
  id: string;
  source: string;
  status: ClientLeadStatus;
  customer_company: string | null;
  customer_name: string;
  customer_position: string | null;
  customer_phone: string;
  customer_email: string | null;
  project_name: string | null;
  product_type: string | null;
  acrylic_type: string | null;
  color_name: string | null;
  color_code: string | null;
  thickness: string | null;
  sheet_size: string | null;
  quantity: string | null;
  dimensions: string | null;
  processing: string[] | null;
  inquiry_body: string;
  desired_delivery_date: string | null;
  delivery_address: string | null;
  assigned_to: string | null;
  converted_quote_id: string | null;
  converted_quote_draft_id: string | null;
  project_id: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
  files?: ClientConsultationFile[];
};

type ProfileOption = {
  id: string;
  full_name: string | null;
};

const statusOptions: Array<{ value: ClientLeadStatus; label: string }> = [
  { value: 'new', label: '신규' },
  { value: 'needs_review', label: '검토 필요' },
  { value: 'on_hold', label: '보류' },
  { value: 'converted', label: '전환 완료' },
  { value: 'closed', label: '종료' },
];

const filterOptions: Array<{ value: ClientLeadFilter; label: string }> = [
  { value: 'all', label: '전체' },
  { value: 'new', label: '신규' },
  { value: 'needs_review', label: '검토 필요' },
  { value: 'on_hold', label: '보류' },
  { value: 'converted', label: '전환 완료' },
  { value: 'closed', label: '종료' },
];

function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(date, 'yyyy.MM.dd HH:mm');
}

function fileSizeLabel(size: number | null) {
  if (!size) return '-';
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}MB`;
  if (size >= 1024) return `${Math.round(size / 1024)}KB`;
  return `${size}B`;
}

function getLeadTitle(lead: ClientConsultationLead) {
  return lead.project_name || lead.product_type || lead.customer_company || `${lead.customer_name} 상담 문의`;
}

function statusBadgeClass(status: ClientLeadStatus) {
  switch (status) {
    case 'new':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'needs_review':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'converted':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'closed':
      return 'border-neutral-200 bg-neutral-100 text-neutral-600';
    case 'on_hold':
    default:
      return 'border-neutral-300 bg-white text-neutral-700';
  }
}

function buildQuoteRecipient(lead: ClientConsultationLead): QuoteRecipient {
  const attachments: Attachment[] = (lead.files || []).map((file) => ({
    name: file.file_name,
    path: file.storage_path,
    size: Number(file.file_size || 0),
    type: file.mime_type || 'application/octet-stream',
    storageBucket: file.storage_bucket,
    storagePath: file.storage_path,
  }));

  const memoParts = [
    lead.inquiry_body,
    lead.product_type ? `제작 품목: ${lead.product_type}` : '',
    lead.acrylic_type ? `아크릴 종류: ${lead.acrylic_type}` : '',
    lead.color_name ? `컬러: ${lead.color_name}${lead.color_code ? ` (${lead.color_code})` : ''}` : '',
    lead.thickness ? `두께: ${lead.thickness}` : '',
    lead.sheet_size ? `원장: ${lead.sheet_size}` : '',
    lead.dimensions ? `규격: ${lead.dimensions}` : '',
    lead.quantity ? `수량: ${lead.quantity}` : '',
    lead.processing?.length ? `가공: ${lead.processing.join(', ')}` : '',
    lead.files?.length ? `첨부파일: ${lead.files.map((file) => file.file_name).join(', ')}` : '',
  ].filter(Boolean);

  return {
    projectName: getLeadTitle(lead),
    quoteNumber: '',
    quoteDate: new Date(),
    validUntil: '',
    deliveryPeriod: '',
    paymentCondition: '',
    companyName: lead.customer_company || '',
    contactPerson: lead.customer_name || '',
    phoneNumber: lead.customer_phone || '',
    email: lead.customer_email || '',
    desiredDeliveryDate: lead.desired_delivery_date ? new Date(lead.desired_delivery_date) : null,
    deliveryAddress: lead.delivery_address || '',
    clientMemo: memoParts.join('\n'),
    attachments,
  };
}

const supabaseAny = supabase as any;

const ClientConsultationLeadInbox = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isModerator, isManager } = useAuth();
  const canManage = Boolean(isAdmin || isModerator || isManager);
  const [filter, setFilter] = useState<ClientLeadFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));

  const { data: leads = [], isLoading } = useQuery<ClientConsultationLead[]>({
    queryKey: ['client-consultation-leads'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('client_consultation_leads')
        .select('*, files:client_consultation_files(*)')
        .order('created_at', { ascending: false })
        .limit(240);
      if (error) throw error;
      return ((data || []) as unknown) as ClientConsultationLead[];
    },
    enabled: !!user,
  });

  const { data: profiles = [] } = useQuery<ProfileOption[]>({
    queryKey: ['client-consultation-profile-options'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_directory' as any)
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      return ((data || []) as unknown) as ProfileOption[];
    },
    enabled: !!user && canManage,
  });

  const counts = useMemo(() => {
    const next: Record<ClientLeadFilter, number> = {
      all: leads.length,
      new: 0,
      needs_review: 0,
      on_hold: 0,
      converted: 0,
      closed: 0,
    };
    leads.forEach((lead) => {
      next[lead.status] = (next[lead.status] || 0) + 1;
    });
    return next;
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (filter !== 'all' && lead.status !== filter) return false;
      if (!term) return true;
      const haystack = [
        lead.customer_company,
        lead.customer_name,
        lead.customer_phone,
        lead.customer_email,
        lead.project_name,
        lead.product_type,
        lead.acrylic_type,
        lead.dimensions,
        lead.inquiry_body,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [filter, leads, search]);

  const selectedLead = useMemo(() => {
    return leads.find((lead) => lead.id === selectedId) || filteredLeads[0] || null;
  }, [filteredLeads, leads, selectedId]);

  useEffect(() => {
    if (!selectedLead) return;
    const next = new URLSearchParams(searchParams);
    next.set('source', 'imweb');
    next.set('id', selectedLead.id);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, selectedLead, setSearchParams]);

  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const next = { ...updates };
      if (next.status === 'closed' && !next.closed_at) next.closed_at = new Date().toISOString();
      if (next.status && next.status !== 'closed') next.closed_at = null;
      const { error } = await supabaseAny.from('client_consultation_leads').update(next).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-consultation-leads'] });
      toast.success('상담 리드가 업데이트되었습니다.');
    },
    onError: (error: Error) => toast.error('업데이트 실패: ' + error.message),
  });

  const createDraft = useMutation({
    mutationFn: async (lead: ClientConsultationLead) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const draft = await createQuoteDraft({
        userId: user.id,
        title: `${getLeadTitle(lead)} 견적 초안`,
        recipient: buildQuoteRecipient(lead),
        items: [],
      });
      const { error } = await supabaseAny
        .from('client_consultation_leads')
        .update({ converted_quote_draft_id: draft.id, status: 'converted' })
        .eq('id', lead.id);
      if (error) throw error;
      return draft.id;
    },
    onSuccess: (draftId) => {
      queryClient.invalidateQueries({ queryKey: ['client-consultation-leads'] });
      toast.success('견적 초안을 만들었습니다.');
      navigate(`/quote-drafts?draftId=${draftId}`);
    },
    onError: (error: Error) => toast.error('견적 초안 생성 실패: ' + error.message),
  });

  const createProject = useMutation({
    mutationFn: async (lead: ClientConsultationLead) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: getLeadTitle(lead),
          description: lead.inquiry_body,
          status: 'pending',
          project_type: 'client',
          contact_name: lead.customer_name,
          contact_phone: lead.customer_phone,
          contact_email: lead.customer_email,
          specs: {
            source: 'client_consultation_lead',
            clientConsultationLeadId: lead.id,
            productType: lead.product_type,
            acrylicType: lead.acrylic_type,
            color: lead.color_name,
            thickness: lead.thickness,
            sheetSize: lead.sheet_size,
            quantity: lead.quantity,
            dimensions: lead.dimensions,
            processing: lead.processing || [],
            desiredDeliveryDate: lead.desired_delivery_date,
            deliveryAddress: lead.delivery_address,
            files: (lead.files || []).map((file) => ({
              name: file.file_name,
              bucket: file.storage_bucket,
              path: file.storage_path,
            })),
          },
          user_id: user.id,
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: updateError } = await supabaseAny
        .from('client_consultation_leads')
        .update({ project_id: project.id, status: 'converted' })
        .eq('id', lead.id);
      if (updateError) throw updateError;
      return project.id as string;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ['client-consultation-leads'] });
      toast.success('프로젝트 후보를 만들었습니다.');
      navigate(`/project-management?id=${projectId}`);
    },
    onError: (error: Error) => toast.error('프로젝트 생성 실패: ' + error.message),
  });

  const openFile = async (file: ClientConsultationFile) => {
    const { data, error } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 60 * 60);
    if (error || !data?.signedUrl) {
      toast.error('첨부파일 URL 생성 실패: ' + (error?.message || '알 수 없는 오류'));
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">아임웹 폼 리드</h2>
              <p className="text-xs text-muted-foreground">{filteredLeads.length}건 표시</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-full"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['client-consultation-leads'] })}
            >
              새로고침
            </Button>
          </div>
          <Tabs value={filter} onValueChange={(value) => setFilter(value as ClientLeadFilter)} className="mt-3">
            <TabsList className="grid h-auto grid-cols-3 rounded-2xl bg-neutral-100 p-1 lg:grid-cols-6">
              {filterOptions.map((option) => (
                <TabsTrigger key={option.value} value={option.value} className="rounded-xl text-xs data-[state=active]:bg-neutral-950 data-[state=active]:text-white">
                  {option.label} {counts[option.value] || 0}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객, 품목, 내용 검색"
              className="h-10 rounded-2xl pl-9 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="h-[calc(100vh-310px)] min-h-[540px]">
          <div className="space-y-2 p-3">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                조건에 맞는 아임웹 폼 리드가 없습니다.
              </div>
            ) : filteredLeads.map((lead) => {
              const selected = selectedLead?.id === lead.id;
              const assignee = lead.assigned_to ? profiles.find((profile) => profile.id === lead.assigned_to) : null;
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  className={cn(
                    'w-full rounded-2xl border p-3 text-left transition-colors hover:bg-neutral-50',
                    selected ? 'border-neutral-950 bg-neutral-50' : 'border-neutral-200 bg-white',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{getLeadTitle(lead)}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {[lead.customer_company, lead.customer_name, lead.customer_phone].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <Badge variant="outline" className={cn('shrink-0 text-[10px]', statusBadgeClass(lead.status))}>
                      {statusOptions.find((option) => option.value === lead.status)?.label || lead.status}
                    </Badge>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{lead.inquiry_body}</p>
                  <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{formatDateTime(lead.created_at)}</span>
                    <span>{assignee?.full_name || '미배정'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </section>

      <section className="min-w-0">
        {!selectedLead ? (
          <Card className="flex min-h-[520px] items-center justify-center rounded-3xl border-dashed shadow-none">
            <CardContent className="text-center text-sm text-muted-foreground">
              아임웹 폼 리드를 선택하세요.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="rounded-3xl border-neutral-200 shadow-sm">
              <CardHeader className="border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{getLeadTitle(selectedLead)}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      접수 {formatDateTime(selectedLead.created_at)} · source {selectedLead.source}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn('rounded-full px-3 py-1', statusBadgeClass(selectedLead.status))}>
                    {statusOptions.find((option) => option.value === selectedLead.status)?.label || selectedLead.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5">
                <InfoGrid
                  items={[
                    { icon: <UserCheck className="h-4 w-4" />, label: '고객', value: [selectedLead.customer_company, selectedLead.customer_name, selectedLead.customer_position].filter(Boolean).join(' · ') },
                    { icon: <Phone className="h-4 w-4" />, label: '연락처', value: selectedLead.customer_phone },
                    { icon: <Mail className="h-4 w-4" />, label: '이메일', value: selectedLead.customer_email || '-' },
                    { icon: <CalendarDays className="h-4 w-4" />, label: '희망 납기', value: selectedLead.desired_delivery_date || '-' },
                    { icon: <Package className="h-4 w-4" />, label: '제작 정보', value: [selectedLead.product_type, selectedLead.acrylic_type, selectedLead.thickness].filter(Boolean).join(' · ') || '-' },
                    { icon: <MapPin className="h-4 w-4" />, label: '납기 주소', value: selectedLead.delivery_address || '-' },
                  ]}
                />

                <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                  <p className="text-sm font-semibold">규격·수량·가공</p>
                  <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <FieldLine label="규격" value={selectedLead.dimensions || '-'} />
                    <FieldLine label="수량" value={selectedLead.quantity || '-'} />
                    <FieldLine label="원장" value={selectedLead.sheet_size || '-'} />
                    <FieldLine label="컬러" value={[selectedLead.color_name, selectedLead.color_code].filter(Boolean).join(' / ') || '-'} />
                    <FieldLine label="가공" value={selectedLead.processing?.length ? selectedLead.processing.join(', ') : '-'} />
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold">문의 내용</p>
                  <p className="mt-2 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-white p-4 text-sm leading-7 text-neutral-700">
                    {selectedLead.inquiry_body}
                  </p>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-semibold">첨부파일</p>
                    <Badge variant="outline" className="rounded-full">{selectedLead.files?.length || 0}개</Badge>
                  </div>
                  {!selectedLead.files?.length ? (
                    <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      첨부파일이 없습니다.
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {selectedLead.files.map((file) => (
                        <button
                          key={file.id}
                          type="button"
                          onClick={() => openFile(file)}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-left hover:bg-neutral-50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold">{file.file_name}</span>
                            <span className="text-xs text-muted-foreground">{fileSizeLabel(file.file_size)}</span>
                          </span>
                          <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <aside className="space-y-4">
              <Card className="rounded-3xl border-neutral-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">리드 관리</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs">상태</Label>
                    <Select
                      value={selectedLead.status}
                      onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { status: value } })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">담당자</Label>
                    <Select
                      value={selectedLead.assigned_to || 'none'}
                      onValueChange={(value) => updateLead.mutate({
                        id: selectedLead.id,
                        updates: {
                          assigned_to: value === 'none' ? null : value,
                          assigned_at: value === 'none' ? null : new Date().toISOString(),
                          assigned_by: value === 'none' ? null : user?.id,
                        },
                      })}
                      disabled={!canManage}
                    >
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue placeholder="담당자 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">미지정</SelectItem>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>{profile.full_name || profile.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">내부 메모</Label>
                    <Textarea
                      key={selectedLead.id}
                      defaultValue={selectedLead.memo || ''}
                      className="mt-1 min-h-24 rounded-xl text-xs"
                      placeholder="담당자 메모"
                      onBlur={(event) => {
                        if (event.target.value !== (selectedLead.memo || '')) {
                          updateLead.mutate({ id: selectedLead.id, updates: { memo: event.target.value || null } });
                        }
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 rounded-xl"
                    onClick={() => updateLead.mutate({
                      id: selectedLead.id,
                      updates: {
                        assigned_to: user?.id,
                        assigned_at: new Date().toISOString(),
                        assigned_by: user?.id,
                        status: selectedLead.status === 'new' ? 'needs_review' : selectedLead.status,
                      },
                    })}
                    disabled={!user || updateLead.isPending}
                  >
                    <UserCheck className="h-4 w-4" />
                    내 담당으로 지정
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">업무 전환</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    className="w-full gap-1.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800"
                    onClick={() => createDraft.mutate(selectedLead)}
                    disabled={createDraft.isPending || Boolean(selectedLead.converted_quote_draft_id)}
                  >
                    {createDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                    {selectedLead.converted_quote_draft_id ? '견적 초안 생성됨' : '견적 초안으로 전환'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 rounded-xl"
                    onClick={() => createProject.mutate(selectedLead)}
                    disabled={createProject.isPending || Boolean(selectedLead.project_id)}
                  >
                    {createProject.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
                    {selectedLead.project_id ? '프로젝트 연결됨' : '프로젝트 후보 만들기'}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 rounded-xl"
                    onClick={() => navigate(`/response-assistant?source_channel=client_form&customer_message=${encodeURIComponent(selectedLead.inquiry_body)}&customer_company=${encodeURIComponent(selectedLead.customer_company || '')}&customer_name=${encodeURIComponent(selectedLead.customer_name || '')}`)}
                  >
                    <MessageSquareText className="h-4 w-4" />
                    응대 초안 작성
                  </Button>
                  {selectedLead.converted_quote_id && (
                    <Button variant="outline" className="w-full gap-1.5 rounded-xl" onClick={() => navigate(`/saved-quotes/${selectedLead.converted_quote_id}`)}>
                      <CheckCircle2 className="h-4 w-4" />
                      발행 견적 열기
                    </Button>
                  )}
                  {selectedLead.project_id && (
                    <Button variant="outline" className="w-full gap-1.5 rounded-xl" onClick={() => navigate(`/project-management?id=${selectedLead.project_id}`)}>
                      <FolderOpen className="h-4 w-4" />
                      연결 프로젝트 열기
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    className="w-full gap-1.5 rounded-xl text-neutral-600"
                    onClick={() => updateLead.mutate({ id: selectedLead.id, updates: { status: 'closed' } })}
                    disabled={selectedLead.status === 'closed' || updateLead.isPending}
                  >
                    <Archive className="h-4 w-4" />
                    종료 처리
                  </Button>
                </CardContent>
              </Card>
            </aside>
          </div>
        )}
      </section>
    </div>
  );
};

const InfoGrid = ({ items }: { items: Array<{ label: string; value: string; icon: React.ReactNode }> }) => (
  <div className="grid gap-3 sm:grid-cols-2">
    {items.map((item) => (
      <div key={item.label} className="rounded-2xl border border-neutral-200 bg-white px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {item.icon}
          {item.label}
        </div>
        <p className="mt-1 break-words text-sm font-semibold">{item.value || '-'}</p>
      </div>
    ))}
  </div>
);

const FieldLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-2">
    <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
    <span className="min-w-0 flex-1 break-words font-medium">{value}</span>
  </div>
);

export default ClientConsultationLeadInbox;
