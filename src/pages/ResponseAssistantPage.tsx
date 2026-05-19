import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Clipboard,
  Home,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ResponseAssistantWidget from '@/components/ResponseAssistantWidget';

type SourceChannel = 'email' | 'channel_talk' | 'kakao' | 'sms' | 'phone' | 'other';
type ToneKey = 'firm' | 'soft' | 'concise';
type RiskLevel = 'normal' | 'review_recommended' | 'review_required';

type KnowledgeItem = {
  id: string;
  title: string;
  category: string;
  content: string;
};

type QuoteOption = {
  id: string;
  quote_number: string;
  recipient_company: string | null;
  project_name: string | null;
  total: number;
};

type ProjectOption = {
  id: string;
  name: string;
  status: string;
  contact_name: string | null;
};

type ResponseCase = {
  id: string;
  source_channel: string;
  customer_company: string | null;
  customer_name: string | null;
  customer_message: string;
  inquiry_type: string;
  status: string;
  risk_level: RiskLevel | string;
  review_required: boolean;
  final_response: string | null;
  created_at: string;
};

type ResponseDraft = {
  id: string;
  case_id: string;
  selected_tone: ToneKey | string;
  drafts_by_tone: Record<string, string>;
  summary: string | null;
  persuasion_points: string[];
  empathy_points: string[];
  avoid_phrases: string[];
  ai_risk_level: RiskLevel | string;
  review_required: boolean;
  final_text: string | null;
  is_used: boolean;
  created_at: string;
};

type GeneratedResult = {
  case: ResponseCase;
  draft: ResponseDraft;
};

const channelOptions: Array<{ value: SourceChannel; label: string }> = [
  { value: 'email', label: '회사 이메일' },
  { value: 'channel_talk', label: '채널톡' },
  { value: 'kakao', label: '카카오톡' },
  { value: 'sms', label: '문자' },
  { value: 'phone', label: '전화 메모' },
  { value: 'other', label: '기타' },
];

const inquiryOptions = [
  { value: 'quote', label: '일반 견적 문의' },
  { value: 'price_objection', label: '가격/단가 항의' },
  { value: 'complaint', label: '컴플레인' },
  { value: 'schedule', label: '납기/일정 문의' },
  { value: 'policy', label: '정책/환불/취소 문의' },
  { value: 'general', label: '기타 상담' },
];

const toneLabels: Record<ToneKey, string> = {
  firm: '정중하고 단호함',
  soft: '부드럽고 양보형',
  concise: '간결한 실무형',
};

const riskConfig: Record<string, { label: string; className: string }> = {
  normal: { label: '일반', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  review_recommended: { label: '검수 권장', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  review_required: { label: '검수 필요', className: 'border-red-200 bg-red-50 text-red-700' },
};

function riskInfo(risk: string) {
  return riskConfig[risk] || riskConfig.normal;
}

function param(searchParams: URLSearchParams, key: string) {
  return searchParams.get(key) || '';
}

const ResponseAssistantPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, profile, isAdmin, isModerator } = useAuth();
  const canManageKnowledge = isAdmin || isModerator;

  const [sourceChannel, setSourceChannel] = useState<SourceChannel>((param(searchParams, 'source_channel') as SourceChannel) || 'email');
  const [customerCompany, setCustomerCompany] = useState(param(searchParams, 'customer_company'));
  const [customerName, setCustomerName] = useState(param(searchParams, 'customer_name'));
  const [customerContact, setCustomerContact] = useState(param(searchParams, 'customer_contact'));
  const [inquiryType, setInquiryType] = useState(param(searchParams, 'inquiry_type') || 'price_objection');
  const [customerMessage, setCustomerMessage] = useState(param(searchParams, 'customer_message'));
  const [internalContext, setInternalContext] = useState(param(searchParams, 'internal_context'));
  const [relatedQuoteId, setRelatedQuoteId] = useState(param(searchParams, 'related_quote_id') || 'none');
  const [relatedProjectId, setRelatedProjectId] = useState(param(searchParams, 'related_project_id') || 'none');
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<string[]>([]);
  const [activeTone, setActiveTone] = useState<ToneKey>('firm');
  const [editableFinalText, setEditableFinalText] = useState('');
  const [generated, setGenerated] = useState<GeneratedResult | null>(null);

  const { data: knowledgeItems = [] } = useQuery<KnowledgeItem[]>({
    queryKey: ['response-knowledge-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_knowledge_items')
        .select('id, title, category, content')
        .eq('is_active', true)
        .order('category')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as KnowledgeItem[];
    },
    enabled: !!user,
  });

  const { data: quotes = [] } = useQuery<QuoteOption[]>({
    queryKey: ['response-assistant-quotes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, recipient_company, project_name, total')
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []) as QuoteOption[];
    },
    enabled: !!user,
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['response-assistant-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, contact_name')
        .order('updated_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return (data || []) as ProjectOption[];
    },
    enabled: !!user,
  });

  const { data: recentCases = [] } = useQuery<ResponseCase[]>({
    queryKey: ['response-cases-recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_cases')
        .select('id, source_channel, customer_company, customer_name, customer_message, inquiry_type, status, risk_level, review_required, final_response, created_at')
        .order('created_at', { ascending: false })
        .limit(12);
      if (error) throw error;
      return ((data || []) as unknown) as ResponseCase[];
    },
    enabled: !!user,
  });

  const defaultKnowledgeIds = useMemo(
    () => knowledgeItems.filter((item) => ['pricing', 'processing', 'complaint'].includes(item.category)).map((item) => item.id),
    [knowledgeItems],
  );

  React.useEffect(() => {
    if (selectedKnowledgeIds.length === 0 && defaultKnowledgeIds.length > 0) {
      setSelectedKnowledgeIds(defaultKnowledgeIds);
    }
  }, [defaultKnowledgeIds, selectedKnowledgeIds.length]);

  const selectedDraftText = generated?.draft.drafts_by_tone?.[activeTone] || '';
  const selectedRisk = generated ? riskInfo(generated.case.risk_level) : null;

  const generateDraft = useMutation({
    mutationFn: async () => {
      if (!customerMessage.trim()) throw new Error('고객 원문을 입력해주세요.');
      const { data, error } = await supabase.functions.invoke('generate-response-draft', {
        body: {
          knowledgeItemIds: selectedKnowledgeIds,
          caseInput: {
            source_channel: sourceChannel,
            external_thread_id: param(searchParams, 'external_thread_id') || null,
            external_message_id: param(searchParams, 'external_message_id') || null,
            customer_company: customerCompany.trim() || null,
            customer_name: customerName.trim() || null,
            customer_contact: customerContact.trim() || null,
            inquiry_type: inquiryType,
            customer_message: customerMessage.trim(),
            internal_context: internalContext.trim() || null,
            related_quote_id: relatedQuoteId === 'none' ? null : relatedQuoteId,
            related_project_id: relatedProjectId === 'none' ? null : relatedProjectId,
            assigned_to: user?.id || null,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as GeneratedResult;
    },
    onSuccess: (result) => {
      setGenerated(result);
      const nextText = result.draft.drafts_by_tone?.firm || '';
      setActiveTone('firm');
      setEditableFinalText(nextText);
      queryClient.invalidateQueries({ queryKey: ['response-cases-recent'] });
      toast.success('응대 초안이 생성되었습니다.');
    },
    onError: (error: Error) => toast.error('초안 생성 실패: ' + error.message),
  });

  const saveFinal = useMutation({
    mutationFn: async ({ status, isUsed }: { status: string; isUsed: boolean }) => {
      if (!generated) throw new Error('저장할 초안이 없습니다.');
      const finalText = editableFinalText.trim() || selectedDraftText;
      const [{ error: caseError }, { error: draftError }] = await Promise.all([
        supabase
          .from('response_cases')
          .update({ status, final_response: finalText })
          .eq('id', generated.case.id),
        supabase
          .from('response_drafts')
          .update({ selected_tone: activeTone, final_text: finalText, is_used: isUsed })
          .eq('id', generated.draft.id),
      ]);
      if (caseError) throw caseError;
      if (draftError) throw draftError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-cases-recent'] });
      toast.success('상담 응대 기록이 저장되었습니다.');
    },
    onError: (error: Error) => toast.error('저장 실패: ' + error.message),
  });

  const copyText = async () => {
    const text = editableFinalText.trim() || selectedDraftText;
    if (!text) return;
    await navigator.clipboard.writeText(text);
    toast.success('답변 초안이 복사되었습니다.');
  };

  if (!user) {
    return (
      <PageShell maxWidth="5xl">
        <PageHeader
          eyebrow="Response Assistant"
          title="상담 응대 보조"
          description="로그인 전에도 샘플 위젯으로 응대 초안을 바로 테스트할 수 있습니다."
          icon={<MessageSquareText className="h-5 w-5" />}
          actions={(
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/')} className="gap-2">
                <Home className="h-4 w-4" />
                홈
              </Button>
              <Button size="sm" onClick={() => navigate('/auth')}>
                로그인
              </Button>
            </>
          )}
        />
        <ResponseAssistantWidget embedded />
        <Card className="border-dashed">
          <CardContent className="p-5 text-sm leading-relaxed text-muted-foreground">
            위젯은 브라우저 안에서 바로 동작합니다. AI 생성, 상담 기록 저장, 견적/프로젝트 연결 기능은 로그인 후 사용할 수 있습니다.
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Response Assistant"
        title="상담 응대 보조"
        description="고객 문의 원문과 내부 근거를 바탕으로 직원이 검토 후 사용할 답변 초안을 생성합니다."
        icon={<MessageSquareText className="h-5 w-5" />}
        meta={(
          <>
            <Badge variant="outline">자동 발송 없음</Badge>
            <Badge variant="outline">위험도별 검수</Badge>
            <Badge variant="outline">{profile?.full_name || user.email}</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              이전
            </Button>
            {canManageKnowledge && (
              <Button variant="outline" size="sm" onClick={() => navigate('/response-assistant-management')} className="gap-2">
                <ShieldAlert className="h-4 w-4" />
                관리
              </Button>
            )}
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-5">
          <ResponseAssistantWidget embedded />

          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={Sparkles}
                title="상담 내용 입력"
                subtitle="이메일, 채널톡, 카카오톡, 문자, 전화 메모를 그대로 붙여넣어도 됩니다."
              />
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <Label className="text-xs">상담 채널</Label>
                  <Select value={sourceChannel} onValueChange={(value) => setSourceChannel(value as SourceChannel)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {channelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">문의 유형</Label>
                  <Select value={inquiryType} onValueChange={setInquiryType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {inquiryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">고객 연락처</Label>
                  <Input value={customerContact} onChange={(event) => setCustomerContact(event.target.value)} placeholder="이메일/전화번호/카톡명" className="mt-1" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">고객사</Label>
                  <Input value={customerCompany} onChange={(event) => setCustomerCompany(event.target.value)} placeholder="예: 서울신라호텔" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">고객 담당자</Label>
                  <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="예: 정효진 팀장님" className="mt-1" />
                </div>
              </div>

              <div>
                <Label className="text-xs">고객 원문</Label>
                <Textarea
                  value={customerMessage}
                  onChange={(event) => setCustomerMessage(event.target.value)}
                  placeholder="고객이 보낸 이메일, 채팅, 문자 내용 또는 전화 상담 메모를 입력하세요."
                  className="mt-1 min-h-52 leading-relaxed"
                />
              </div>

              <div>
                <Label className="text-xs">내부 근거 메모</Label>
                <Textarea
                  value={internalContext}
                  onChange={(event) => setInternalContext(event.target.value)}
                  placeholder="예: 원자재 20% 상승, 무기포 접착은 일반 접착 대비 약 3배, 사양 변경 시 단가 조정 가능..."
                  className="mt-1 min-h-28 leading-relaxed"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs">관련 견적서</Label>
                  <Select value={relatedQuoteId} onValueChange={setRelatedQuoteId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="관련 견적 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">연결 안 함</SelectItem>
                      {quotes.map((quote) => (
                        <SelectItem key={quote.id} value={quote.id}>
                          {quote.quote_number} · {quote.recipient_company || quote.project_name || '고객 미확인'} · ₩{Math.round(quote.total || 0).toLocaleString()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">관련 프로젝트</Label>
                  <Select value={relatedProjectId} onValueChange={setRelatedProjectId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="관련 프로젝트 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">연결 안 함</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name} · {project.contact_name || project.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border bg-background/70 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">사용할 응대 근거</h3>
                    <p className="text-xs text-muted-foreground">선택하지 않으면 활성화된 기본 근거가 사용됩니다.</p>
                  </div>
                  {canManageKnowledge && (
                    <Badge variant="outline" className="text-[10px]">관리자 등록 자료</Badge>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  {knowledgeItems.map((item) => (
                    <label key={item.id} className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card/70 p-3 hover:bg-accent/30">
                      <Checkbox
                        checked={selectedKnowledgeIds.includes(item.id)}
                        onCheckedChange={(checked) => {
                          setSelectedKnowledgeIds((prev) => checked
                            ? [...new Set([...prev, item.id])]
                            : prev.filter((id) => id !== item.id));
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{item.content}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                size="lg"
                className="w-full gap-2"
                disabled={generateDraft.isPending || !customerMessage.trim()}
                onClick={() => generateDraft.mutate()}
              >
                {generateDraft.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                응대 초안 생성
              </Button>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={ShieldAlert}
                title="생성 결과"
                subtitle="직원이 검토 후 복사해 사용합니다."
                meta={selectedRisk && <Badge variant="outline" className={selectedRisk.className}>{selectedRisk.label}</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              {!generated ? (
                <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                  고객 원문과 내부 근거를 입력한 뒤 초안을 생성하세요.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border bg-background/70 p-3">
                    <p className="text-xs font-semibold text-muted-foreground">내부 요약</p>
                    <p className="mt-1 text-sm leading-relaxed">{generated.draft.summary}</p>
                  </div>

                  <Tabs value={activeTone} onValueChange={(value) => {
                    const tone = value as ToneKey;
                    setActiveTone(tone);
                    setEditableFinalText(generated.draft.drafts_by_tone?.[tone] || '');
                  }}>
                    <TabsList className="grid h-auto grid-cols-3">
                      {(Object.keys(toneLabels) as ToneKey[]).map((tone) => (
                        <TabsTrigger key={tone} value={tone} className="text-xs">{toneLabels[tone]}</TabsTrigger>
                      ))}
                    </TabsList>
                    {(Object.keys(toneLabels) as ToneKey[]).map((tone) => (
                      <TabsContent key={tone} value={tone} className="mt-3">
                        <Textarea
                          value={editableFinalText}
                          onChange={(event) => setEditableFinalText(event.target.value)}
                          className="min-h-72 leading-relaxed"
                        />
                      </TabsContent>
                    ))}
                  </Tabs>

                  <div className="grid gap-3">
                    {[
                      ['핵심 설득 근거', generated.draft.persuasion_points],
                      ['감정 완화 포인트', generated.draft.empathy_points],
                      ['피해야 할 표현', generated.draft.avoid_phrases],
                    ].map(([title, items]) => (
                      <div key={title as string} className="rounded-xl border bg-background/70 p-3">
                        <p className="text-xs font-semibold text-muted-foreground">{title as string}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {((items as string[]) || []).length ? (items as string[]).map((item) => (
                            <Badge key={item} variant="outline" className="text-[10px]">{item}</Badge>
                          )) : <span className="text-xs text-muted-foreground">없음</span>}
                        </div>
                      </div>
                    ))}
                  </div>

                  {generated.case.review_required && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">
                      이 상담은 검수 필요로 분류되었습니다. 발송 전 관리자 또는 팀장 확인을 권장합니다.
                    </div>
                  )}

                  <div className="grid gap-2">
                    <Button onClick={copyText} className="gap-2">
                      <Clipboard className="h-4 w-4" />
                      초안 복사
                    </Button>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        onClick={() => saveFinal.mutate({ status: 'final_saved', isUsed: false })}
                        disabled={saveFinal.isPending}
                        className="gap-2"
                      >
                        <Save className="h-4 w-4" />
                        최종 문안 저장
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => saveFinal.mutate({ status: 'sent', isUsed: true })}
                        disabled={saveFinal.isPending}
                        className="gap-2"
                      >
                        <Send className="h-4 w-4" />
                        발송 완료
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => saveFinal.mutate({ status: 'needs_review', isUsed: false })}
                      disabled={saveFinal.isPending}
                      className="gap-2"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      추가 검수 필요로 표시
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b py-4">
              <BrandedCardHeader icon={RefreshCw} title="최근 응대 기록" subtitle="내가 작성했거나 배정된 상담 케이스" />
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[360px]">
                <div className="space-y-2 p-3">
                  {recentCases.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">저장된 응대 기록이 없습니다.</div>
                  ) : recentCases.map((item) => {
                    const risk = riskInfo(item.risk_level);
                    return (
                      <div key={item.id} className="rounded-xl border bg-background/70 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">
                              {item.customer_company || item.customer_name || '고객 미확인'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{item.customer_message}</p>
                          </div>
                          <Badge variant="outline" className={cn('shrink-0 text-[10px]', risk.className)}>{risk.label}</Badge>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{channelOptions.find((option) => option.value === item.source_channel)?.label || item.source_channel}</span>
                          <span>{new Date(item.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PageShell>
  );
};

export default ResponseAssistantPage;
