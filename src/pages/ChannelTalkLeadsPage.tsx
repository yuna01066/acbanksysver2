import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Archive,
  Bell,
  Bot,
  Circle,
  Clipboard,
  FileText,
  FolderOpen,
  Hash,
  Inbox,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  UserCheck,
  UserRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';
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

type LeadStatus =
  | 'new'
  | 'needs_review'
  | 'reply_draft'
  | 'waiting_customer'
  | 'analyzed'
  | 'converted'
  | 'closed'
  | 'on_hold';

type InboxTab = 'active' | 'waiting' | 'hold' | 'closed';
type QuickFilter = 'all' | 'unread' | 'mine' | 'unassigned' | 'closed';

type LeadAnalysis = {
  inquiry_type?: string | null;
  item_name?: string | null;
  dimensions?: string | null;
  quantity?: string | null;
  material?: string | null;
  thickness?: string | null;
  color?: string | null;
  processing?: string[] | null;
  desired_due_date?: string | null;
  delivery_or_installation?: string | null;
  confidence?: string | null;
  missing_fields?: string[];
  summary?: string | null;
  recommended_reply?: string | null;
  source_body?: string | null;
  triage?: {
    recommendedTags?: string[];
  };
  [key: string]: unknown;
};

type JsonRecord = Record<string, unknown>;

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
  analysis: LeadAnalysis;
  missing_fields: string[];
  raw_payload: JsonRecord;
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
};

type ChannelTalkMessage = {
  id: string;
  lead_id: string | null;
  user_chat_id: string;
  message_id: string | null;
  sender_type: string;
  message_type: string;
  body: string | null;
  file_keys: string[];
  received_at: string;
};

type ReplyDraft = {
  id: string;
  lead_id: string;
  created_by: string;
  updated_by: string | null;
  sent_by: string | null;
  body: string;
  status: 'draft' | 'reviewed' | 'sent' | 'discarded' | string;
  sent_at: string | null;
  channel_message_id: string | null;
  created_at: string;
};

type ActionLog = {
  id: string;
  lead_id: string | null;
  action: string;
  status: 'success' | 'failed' | string;
  sender_name: string | null;
  visible_sender_name: string | null;
  channel_message_id: string | null;
  error_message: string | null;
  created_at: string;
};

type SavedQuoteOption = {
  id: string;
  quote_number: string;
  project_name: string | null;
  recipient_company: string | null;
  recipient_name: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  total: number;
  quote_date: string;
  project_stage: string;
};

const STATUS_CONFIG: Record<LeadStatus, { label: string; className: string }> = {
  new: { label: '신규', className: 'border-neutral-300 bg-white text-neutral-950' },
  needs_review: { label: '검토 필요', className: 'border-neutral-300 bg-neutral-100 text-neutral-900' },
  reply_draft: { label: '답변 초안', className: 'border-neutral-300 bg-neutral-50 text-neutral-800' },
  waiting_customer: { label: '고객 답변 대기', className: 'border-neutral-950 bg-neutral-950 text-white' },
  analyzed: { label: '분석 완료', className: 'border-neutral-400 bg-white text-neutral-900' },
  converted: { label: '전환 완료', className: 'border-neutral-950 bg-neutral-900 text-white' },
  closed: { label: '종료', className: 'border-neutral-200 bg-neutral-100 text-neutral-500' },
  on_hold: { label: '보류', className: 'border-neutral-300 bg-neutral-200 text-neutral-800' },
};

const inboxTabs: Array<{ value: InboxTab; label: string }> = [
  { value: 'active', label: '진행중' },
  { value: 'waiting', label: '답변대기' },
  { value: 'hold', label: '보류' },
  { value: 'closed', label: '종료' },
];

const statusOptions: Array<{ value: LeadStatus; label: string }> = [
  { value: 'new', label: '신규' },
  { value: 'needs_review', label: '검토 필요' },
  { value: 'analyzed', label: '분석 완료' },
  { value: 'reply_draft', label: '답변 초안' },
  { value: 'waiting_customer', label: '고객 답변 대기' },
  { value: 'on_hold', label: '보류' },
  { value: 'converted', label: '전환 완료' },
  { value: 'closed', label: '종료' },
];

function statusInfo(status: string) {
  return STATUS_CONFIG[status as LeadStatus] || { label: status, className: 'border-muted bg-muted text-muted-foreground' };
}

function confidenceLabel(confidence?: string | null) {
  if (confidence === 'high') return { label: '신뢰도 높음', className: 'border-neutral-900 bg-white text-neutral-950' };
  if (confidence === 'medium') return { label: '신뢰도 보통', className: 'border-neutral-300 bg-white text-neutral-700' };
  if (confidence === 'low') return { label: '신뢰도 낮음', className: 'border-neutral-300 bg-neutral-100 text-neutral-800' };
  return { label: '수동 검토', className: 'border-neutral-300 bg-white text-neutral-700' };
}

function getActionDisplay(action: string) {
  if (action === 'send_customer_reply') return { label: '고객 답장', className: 'border-neutral-950 bg-neutral-950 text-white' };
  if (action === 'send_private_note') return { label: '내부 메모', className: 'border-amber-300 bg-amber-50 text-amber-900' };
  if (action === 'refresh_messages') return { label: '메시지 동기화', className: 'border-neutral-300 bg-white text-neutral-700' };
  if (action === 'mark_lead_closed') return { label: '상담 종료', className: 'border-neutral-300 bg-neutral-100 text-neutral-700' };
  return { label: action, className: 'border-neutral-300 bg-white text-neutral-700' };
}

function getInboxTab(status: string): InboxTab {
  if (status === 'waiting_customer') return 'waiting';
  if (status === 'on_hold') return 'hold';
  if (status === 'closed' || status === 'converted') return 'closed';
  return 'active';
}

function joinValue(value: unknown) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'string') return value;
  return '';
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return format(new Date(value), 'M.d HH:mm', { locale: ko });
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function normalizeText(value?: string | null) {
  return (value || '').trim().toLowerCase();
}

function normalizePhone(value?: string | null) {
  return (value || '').replace(/[^\d]/g, '');
}

function getLeadTitle(lead: ChannelTalkLead) {
  return lead.analysis?.item_name || lead.customer_company || lead.customer_name || '채널톡 문의';
}

function getLeadCustomerLabel(lead: ChannelTalkLead) {
  return [lead.customer_company, lead.customer_name].filter(Boolean).join(' / ') || lead.channel_talk_user_chat_id;
}

function getLeadContact(lead: ChannelTalkLead) {
  return lead.customer_phone || lead.customer_email || lead.channel_talk_user_id || '연락처 미확인';
}

function getMessagePreview(lead: ChannelTalkLead, message?: ChannelTalkMessage | null) {
  return message?.body || lead.analysis?.source_body || lead.analysis?.summary || '저장된 메시지 요약이 없습니다.';
}

function isUnreadLike(lead: ChannelTalkLead, message?: ChannelTalkMessage | null) {
  if (lead.status === 'new' || lead.status === 'needs_review') return true;
  return message?.sender_type === 'user' && getInboxTab(lead.status) !== 'waiting' && getInboxTab(lead.status) !== 'closed';
}

function matchesLeadQuote(lead: ChannelTalkLead, quote: SavedQuoteOption) {
  const leadCompany = normalizeText(lead.customer_company);
  const leadName = normalizeText(lead.customer_name);
  const leadEmail = normalizeText(lead.customer_email);
  const leadPhone = normalizePhone(lead.customer_phone);

  if (leadPhone && normalizePhone(quote.recipient_phone) === leadPhone) return true;
  if (leadEmail && normalizeText(quote.recipient_email) === leadEmail) return true;
  if (leadCompany && normalizeText(quote.recipient_company).includes(leadCompany)) return true;
  if (leadName && normalizeText(quote.recipient_name).includes(leadName)) return true;
  return false;
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

function toResponseAssistantParams(lead: ChannelTalkLead) {
  const analysis = lead.analysis || {};
  const params = new URLSearchParams({
    source_channel: 'channel_talk',
    channel_lead_id: lead.id,
    external_thread_id: lead.channel_talk_user_chat_id,
    inquiry_type: 'quote',
    customer_message: [
      analysis.summary && `[문의 요약]\n${analysis.summary}`,
      analysis.recommended_reply && `[기존 추천 질문]\n${analysis.recommended_reply}`,
      analysis.item_name && `[품목]\n${analysis.item_name}`,
      analysis.dimensions && `[사이즈]\n${analysis.dimensions}`,
      analysis.quantity && `[수량]\n${analysis.quantity}`,
    ].filter(Boolean).join('\n\n') || buildInternalMemo(lead),
    internal_context: buildInternalMemo(lead),
  });
  if (lead.channel_talk_message_id) params.set('external_message_id', lead.channel_talk_message_id);
  if (lead.customer_company) params.set('customer_company', lead.customer_company);
  if (lead.customer_name) params.set('customer_name', lead.customer_name);
  if (lead.customer_phone || lead.customer_email) params.set('customer_contact', lead.customer_phone || lead.customer_email || '');
  if (lead.project_id) params.set('related_project_id', lead.project_id);
  if (lead.converted_quote_id) params.set('related_quote_id', lead.converted_quote_id);
  return `/response-assistant?${params.toString()}`;
}

const ChannelTalkLeadsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAdmin, isModerator, isManager, isEmployee, isApproved, profile } = useAuth();
  const canReview = isApproved && (isAdmin || isModerator || isManager || isEmployee);
  const selectedId = searchParams.get('id');

  const [activeTab, setActiveTab] = useState<InboxTab>('active');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [search, setSearch] = useState('');
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendMode, setSendMode] = useState<'private' | 'customer'>('customer');
  const [sendDraftId, setSendDraftId] = useState<string | null>(null);
  const [sendBody, setSendBody] = useState('');
  const [replyComposer, setReplyComposer] = useState('');
  const [closeAfterSend, setCloseAfterSend] = useState(false);
  const autoRefreshedLeadIds = useRef<Set<string>>(new Set());

  const { data: leads = [], isLoading } = useQuery<ChannelTalkLead[]>({
    queryKey: ['channel-talk-leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_talk_quote_leads')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(240);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkLead[];
    },
    enabled: !!user,
  });

  const leadIds = useMemo(() => leads.map((lead) => lead.id), [leads]);

  const { data: recentMessages = [] } = useQuery<ChannelTalkMessage[]>({
    queryKey: ['channel-talk-recent-messages', leadIds.join('|')],
    queryFn: async () => {
      if (leadIds.length === 0) return [];
      const { data, error } = await supabase
        .from('channel_talk_messages' as any)
        .select('id, lead_id, user_chat_id, message_id, sender_type, message_type, body, file_keys, received_at')
        .in('lead_id', leadIds)
        .order('received_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkMessage[];
    },
    enabled: !!user && leadIds.length > 0,
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
        .from('profile_directory' as any)
        .select('id, full_name')
        .order('full_name');
      if (error) throw error;
      return ((data || []) as unknown) as ProfileOption[];
    },
    enabled: !!user && canReview,
  });

  const { data: messages = [] } = useQuery<ChannelTalkMessage[]>({
    queryKey: ['channel-talk-messages', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from('channel_talk_messages' as any)
        .select('id, lead_id, user_chat_id, message_id, sender_type, message_type, body, file_keys, received_at')
        .eq('lead_id', selectedId)
        .order('received_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkMessage[];
    },
    enabled: !!user && !!selectedId,
  });

  const { data: drafts = [] } = useQuery<ReplyDraft[]>({
    queryKey: ['channel-talk-reply-drafts', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from('channel_talk_reply_drafts' as any)
        .select('id, lead_id, created_by, updated_by, sent_by, body, status, sent_at, channel_message_id, created_at')
        .eq('lead_id', selectedId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as ReplyDraft[];
    },
    enabled: !!user && !!selectedId,
  });

  const { data: actionLogs = [] } = useQuery<ActionLog[]>({
    queryKey: ['channel-talk-action-logs', selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data, error } = await supabase
        .from('channel_talk_action_logs' as any)
        .select('id, lead_id, action, status, sender_name, visible_sender_name, channel_message_id, error_message, created_at')
        .eq('lead_id', selectedId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return ((data || []) as unknown) as ActionLog[];
    },
    enabled: !!user && !!selectedId,
  });

  const latestMessageByLeadId = useMemo(() => {
    const map = new Map<string, ChannelTalkMessage>();
    recentMessages.forEach((message) => {
      if (message.lead_id && !map.has(message.lead_id)) {
        map.set(message.lead_id, message);
      }
    });
    return map;
  }, [recentMessages]);

  const filteredLeads = useMemo(() => {
    const term = search.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const latest = latestMessageByLeadId.get(lead.id);
        if (getInboxTab(lead.status) !== activeTab) return false;
        if (quickFilter === 'unread' && !isUnreadLike(lead, latest)) return false;
        if (quickFilter === 'mine' && lead.assigned_to !== user?.id) return false;
        if (quickFilter === 'unassigned' && lead.assigned_to) return false;
        if (quickFilter === 'closed' && getInboxTab(lead.status) !== 'closed') return false;
        if (!term) return true;
        const haystack = [
          lead.customer_name,
          lead.customer_company,
          lead.customer_phone,
          lead.customer_email,
          lead.inquiry_type,
          lead.analysis?.item_name,
          lead.analysis?.summary,
          lead.analysis?.source_body,
          latest?.body,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        const aDate = latestMessageByLeadId.get(a.id)?.received_at || a.updated_at || a.created_at;
        const bDate = latestMessageByLeadId.get(b.id)?.received_at || b.updated_at || b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [activeTab, latestMessageByLeadId, leads, quickFilter, search, user?.id]);

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedId) || filteredLeads[0] || null,
    [filteredLeads, leads, selectedId],
  );

  const { data: recentQuotes = [] } = useQuery<SavedQuoteOption[]>({
    queryKey: ['channel-talk-related-quotes', selectedLead?.id],
    queryFn: async () => {
      if (!selectedLead) return [];
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, recipient_name, recipient_phone, recipient_email, total, quote_date, project_stage')
        .order('quote_date', { ascending: false })
        .limit(120);
      if (error) throw error;
      return (((data || []) as unknown) as SavedQuoteOption[])
        .filter((quote) => matchesLeadQuote(selectedLead, quote))
        .slice(0, 5);
    },
    enabled: !!user && !!selectedLead,
  });

  const inboxCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = {
      all: leads.length,
      unread: 0,
      mine: 0,
      unassigned: 0,
      closed: 0,
    };
    leads.forEach((lead) => {
      const latest = latestMessageByLeadId.get(lead.id);
      if (isUnreadLike(lead, latest)) counts.unread += 1;
      if (lead.assigned_to === user?.id) counts.mine += 1;
      if (!lead.assigned_to) counts.unassigned += 1;
      if (getInboxTab(lead.status) === 'closed') counts.closed += 1;
    });
    return counts;
  }, [latestMessageByLeadId, leads, user?.id]);

  const currentLeadMessage = selectedLead ? latestMessageByLeadId.get(selectedLead.id) : null;
  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()),
    [messages],
  );
  const lastCustomerMessage = messages.find((message) => message.sender_type === 'user') || null;
  const lastSendLog = actionLogs.find((log) => log.action === 'send_customer_reply' && log.status === 'success') || null;
  const selectedAssignee = selectedLead?.assigned_to ? profiles.find((p) => p.id === selectedLead.assigned_to) : null;
  const senderDisplayName = profile?.full_name || user?.email || '아크뱅크 담당자';

  const updateLead = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const next = { ...updates };
      if (next.status === 'closed' && !next.closed_at) next.closed_at = new Date().toISOString();
      if (next.status && next.status !== 'closed') next.closed_at = null;

      const { error } = await supabase
        .from('channel_talk_quote_leads')
        .update(next)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      toast.success('상담 정보가 업데이트되었습니다.');
    },
    onError: (error: Error) => toast.error('업데이트 실패: ' + error.message),
  });

  const createReplyDraft = useMutation({
    mutationFn: async ({ lead, body }: { lead: ChannelTalkLead; body?: string }) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const draftBody = body?.trim() || lead.analysis?.recommended_reply || '문의 내용 확인했습니다. 필요한 정보를 확인 후 안내드리겠습니다.';
      const { error } = await supabase
        .from('channel_talk_reply_drafts' as any)
        .insert({
          lead_id: lead.id,
          created_by: user.id,
          updated_by: user.id,
          body: draftBody,
          status: 'draft',
        });
      if (error) throw error;
      const { error: leadError } = await supabase
        .from('channel_talk_quote_leads')
        .update({ status: 'reply_draft' })
        .eq('id', lead.id);
      if (leadError) throw leadError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-reply-drafts', selectedId] });
      toast.success('응대 초안을 저장했습니다.');
    },
    onError: (error: Error) => toast.error('초안 저장 실패: ' + error.message),
  });

  const channelAction = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.functions.invoke('channel-talk-actions', {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-recent-messages'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-messages', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-reply-drafts', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-action-logs', selectedId] });
      setSendDialogOpen(false);
      setSendDraftId(null);
      setSendBody('');
      if (variables.action === 'send_customer_reply') setReplyComposer('');
      toast.success(variables.action === 'refresh_messages' ? '채널톡 메시지를 동기화했습니다.' : '채널톡 액션을 처리했습니다.');
    },
    onError: (error: Error) => toast.error('채널톡 액션 실패: ' + error.message),
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
        })
        .select('id')
        .single();
      if (error) throw error;

      const { error: leadError } = await supabase
        .from('channel_talk_quote_leads')
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

  useEffect(() => {
    if (!selectedLead) {
      setReplyComposer('');
      return;
    }
    setReplyComposer(selectedLead.analysis?.recommended_reply || '');
  }, [selectedLead?.id, selectedLead?.analysis?.recommended_reply]);

  useEffect(() => {
    if (!selectedId && filteredLeads[0]) {
      setSearchParams({ id: filteredLeads[0].id }, { replace: true });
    }
  }, [filteredLeads, selectedId, setSearchParams]);

  useEffect(() => {
    if (!selectedLead || autoRefreshedLeadIds.current.has(selectedLead.id)) return;
    autoRefreshedLeadIds.current.add(selectedLead.id);
    supabase.functions
      .invoke('channel-talk-actions', {
        body: { action: 'refresh_messages', leadId: selectedLead.id },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          console.warn('Channel Talk auto refresh failed', error || data?.error);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['channel-talk-recent-messages'] });
        queryClient.invalidateQueries({ queryKey: ['channel-talk-messages', selectedLead.id] });
        queryClient.invalidateQueries({ queryKey: ['channel-talk-action-logs', selectedLead.id] });
      });
  }, [queryClient, selectedLead]);

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

  const openSendDialog = (mode: 'private' | 'customer', lead: ChannelTalkLead, draft?: ReplyDraft, bodyOverride?: string) => {
    setSendMode(mode);
    setSendDraftId(draft?.id || null);
    setSendBody(bodyOverride || draft?.body || (mode === 'private' ? buildInternalMemo(lead) : replyComposer || lead.analysis?.recommended_reply || ''));
    setCloseAfterSend(false);
    setSendDialogOpen(true);
  };

  const runRefreshSelected = () => {
    if (!selectedLead) return;
    channelAction.mutate({ action: 'refresh_messages', leadId: selectedLead.id });
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        로그인이 필요합니다.
      </div>
    );
  }

  return (
    <PageShell maxWidth="full">
      <PageHeader
        eyebrow="Channel Talk"
        title="채널톡 상담 인박스"
        description={canReview
          ? '채널톡 문의를 내부 시스템에서 확인하고, 고객 답장·내부 메모·견적/프로젝트 연결까지 처리합니다.'
          : '승인된 내부 직원만 채널톡 상담 인박스를 사용할 수 있습니다.'}
        icon={<Inbox className="h-5 w-5" />}
      />

      <div className="grid gap-4 xl:grid-cols-[72px_360px_minmax(0,1fr)_330px]">
        <aside className="rounded-3xl border border-neutral-200 bg-white p-2 shadow-sm">
          <div className="space-y-2">
            {[
              { value: 'all' as QuickFilter, label: '전체', icon: Inbox, count: inboxCounts.all },
              { value: 'unread' as QuickFilter, label: '미확인', icon: Bell, count: inboxCounts.unread },
              { value: 'mine' as QuickFilter, label: '내 담당', icon: UserCheck, count: inboxCounts.mine },
              { value: 'unassigned' as QuickFilter, label: '미배정', icon: Circle, count: inboxCounts.unassigned },
              { value: 'closed' as QuickFilter, label: '종료', icon: Archive, count: inboxCounts.closed },
            ].map((item) => {
              const Icon = item.icon;
              const selected = quickFilter === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => {
                    setQuickFilter(item.value);
                    if (item.value === 'closed') setActiveTab('closed');
                  }}
                  className={cn(
                    'flex w-full flex-col items-center gap-1 rounded-2xl px-1 py-2 text-[10px] text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-950',
                    selected && 'bg-neutral-950 text-white shadow-sm hover:bg-neutral-900 hover:text-white',
                  )}
                  title={item.label}
                >
                  <Icon className="h-4 w-4" />
                  <span className="leading-none">{item.label}</span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[10px]', selected ? 'bg-white/20' : 'bg-neutral-100 text-neutral-700')}>
                    {item.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="rounded-3xl border border-neutral-200 bg-white shadow-sm">
          <div className="border-b p-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold">수신 상담</h2>
                <p className="text-xs text-muted-foreground">{filteredLeads.length}건 표시</p>
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => {
                  queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
                  queryClient.invalidateQueries({ queryKey: ['channel-talk-recent-messages'] });
                }}
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as InboxTab)} className="mt-3">
              <TabsList className="grid h-9 grid-cols-4 rounded-2xl bg-neutral-100 p-1">
                {inboxTabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="rounded-xl text-xs data-[state=active]:bg-neutral-950 data-[state=active]:text-white">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <SearchFilterBar className="mt-3 p-0 shadow-none">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="고객, 품목, 대화 검색"
                  className="h-9 rounded-xl pl-8 text-xs"
                />
              </div>
            </SearchFilterBar>
          </div>

          <ScrollArea className="h-[calc(100vh-260px)] min-h-[520px]">
            <div className="space-y-1 p-2">
              {isLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  조건에 맞는 상담이 없습니다.
                </div>
              ) : filteredLeads.map((lead) => {
                const latest = latestMessageByLeadId.get(lead.id);
                const s = statusInfo(lead.status);
                const confidence = confidenceLabel(lead.analysis?.confidence);
                const isSelected = selectedLead?.id === lead.id;
                const assignee = lead.assigned_to ? profiles.find((p) => p.id === lead.assigned_to) : null;
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSearchParams({ id: lead.id }, { replace: true })}
                  className={cn(
                    'w-full rounded-2xl border border-transparent p-3 text-left transition-colors hover:bg-neutral-50',
                    isSelected && 'border-neutral-950/30 bg-neutral-50 shadow-sm',
                  )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-950">
                        {(lead.customer_name || lead.customer_company || 'C').slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{getLeadTitle(lead)}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDateTime(latest?.received_at || lead.updated_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{getLeadCustomerLabel(lead)}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getMessagePreview(lead, latest)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn('h-5 text-[10px]', s.className)}>{s.label}</Badge>
                          <Badge variant="outline" className={cn('h-5 text-[10px]', confidence.className)}>{confidence.label}</Badge>
                          {lead.missing_fields?.length > 0 && (
                            <Badge variant="outline" className="h-5 border-neutral-300 bg-neutral-100 text-[10px] text-neutral-800">
                              누락 {lead.missing_fields.length}
                            </Badge>
                          )}
                          <span className="ml-auto truncate text-[10px] text-muted-foreground">
                            {assignee?.full_name || '미배정'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </section>

        <Card className="flex h-[calc(100vh-170px)] min-h-[680px] flex-col overflow-hidden rounded-3xl border-neutral-200 bg-white shadow-sm">
          {!selectedLead ? (
            <CardContent className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageSquareText className="mb-3 h-10 w-10 opacity-30" />
              <p className="text-sm">상담을 선택하세요.</p>
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-lg font-semibold">{getLeadTitle(selectedLead)}</h2>
                      <Badge variant="outline" className={statusInfo(selectedLead.status).className}>
                        {statusInfo(selectedLead.status).label}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {getLeadCustomerLabel(selectedLead)} · {getLeadContact(selectedLead)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-9 gap-1.5 rounded-full" onClick={runRefreshSelected} disabled={channelAction.isPending}>
                      <RefreshCw className={cn('h-3.5 w-3.5', channelAction.isPending && 'animate-spin')} />
                      동기화
                    </Button>
                    {canReview && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 gap-1.5 rounded-full"
                        onClick={() => updateLead.mutate({ id: selectedLead.id, updates: { assigned_to: user.id, status: selectedLead.status === 'new' ? 'analyzed' : selectedLead.status } })}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        나에게 배정
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <ScrollArea className="min-h-0 flex-1 px-5 py-4">
                {orderedMessages.length === 0 ? (
                  <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-2xl border border-dashed bg-background/60 text-center text-sm text-muted-foreground">
                    <MessageCircle className="mb-3 h-10 w-10 opacity-30" />
                    <p>저장된 대화가 없습니다.</p>
                    <p className="mt-1 text-xs">동기화를 실행하거나 새 채널톡 웹훅을 기다려주세요.</p>
                  </div>
                ) : (
                  <div className="space-y-3 pb-2">
                    {orderedMessages.map((message) => {
                      const isCustomer = message.sender_type === 'user';
                      const isPrivateNote = message.message_type === 'private_note';
                      const isBot = message.sender_type === 'bot' || message.sender_type === 'system';
                      const isStaffReply = !isCustomer && !isBot && !isPrivateNote;

                      if (isPrivateNote) {
                        return (
                          <div key={message.id} className="mx-auto max-w-[88%] rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-medium">
                              <Badge variant="outline" className="h-5 border-amber-400 bg-amber-100 text-[10px] text-amber-950">
                                내부용
                              </Badge>
                              <span className="text-amber-800">고객 비노출 · {formatDateTime(message.received_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body || '본문 없음'}</p>
                          </div>
                        );
                      }

                      return (
                        <div key={message.id} className={cn('flex', isCustomer ? 'justify-start' : 'justify-end')}>
                          <div className={cn(
                            'max-w-[78%] rounded-3xl border px-4 py-3 shadow-sm',
                            isCustomer
                              ? 'rounded-bl-md border-neutral-200 bg-white text-neutral-950'
                              : isBot
                                ? 'rounded-br-md border-neutral-200 bg-neutral-100 text-neutral-900'
                                : 'rounded-br-md border-neutral-950 bg-neutral-950 text-white',
                          )}>
                            <div className={cn(
                              'mb-1 flex flex-wrap items-center gap-1.5 text-[11px]',
                              isStaffReply ? 'text-white/70' : 'text-neutral-500',
                            )}>
                              <Badge
                                variant="outline"
                                className={cn(
                                  'h-5 text-[10px]',
                                  isCustomer && 'border-neutral-300 bg-white text-neutral-700',
                                  isBot && 'border-neutral-300 bg-white text-neutral-700',
                                  isStaffReply && 'border-white/30 bg-white/10 text-white',
                                )}
                              >
                                {isCustomer ? '고객' : isBot ? '고객 노출 · BOT' : '실제 발송 · ACBANK'}
                              </Badge>
                              {message.file_keys?.length > 0 && (
                                <Badge
                                  variant="secondary"
                                  className={cn('h-5 text-[10px]', isStaffReply && 'bg-white/15 text-white hover:bg-white/20')}
                                >
                                  첨부 {message.file_keys.length}
                                </Badge>
                              )}
                              <span>{formatDateTime(message.received_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.body || '본문 없음'}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>

              <div className="border-t border-neutral-200 bg-white p-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted-foreground">
                    채널톡에는 <span className="font-medium text-neutral-950">ACBANK</span>로 전송됩니다. 실제 전송자 {senderDisplayName}은 내부 로그에만 남습니다.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => setReplyComposer(selectedLead.analysis?.recommended_reply || '')}
                    >
                      추천 답변
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 rounded-full"
                      onClick={() => createReplyDraft.mutate({ lead: selectedLead, body: replyComposer })}
                      disabled={!canReview || !replyComposer.trim() || createReplyDraft.isPending}
                    >
                      초안 저장
                    </Button>
                  </div>
                </div>
                <Textarea
                  value={replyComposer}
                  onChange={(event) => setReplyComposer(event.target.value)}
                  className="min-h-24 rounded-2xl border-neutral-300 bg-white text-sm focus-visible:ring-neutral-950"
                  placeholder="고객에게 보낼 답변을 작성하세요."
                />
                <div className="mt-3 flex flex-wrap justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 rounded-full border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                    onClick={() => openSendDialog('private', selectedLead, undefined, replyComposer || buildInternalMemo(selectedLead))}
                    disabled={!canReview}
                  >
                    <MessageSquareText className="h-3.5 w-3.5" />
                    내부용 메모 전송
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-full bg-neutral-950 text-white hover:bg-neutral-800"
                    onClick={() => openSendDialog('customer', selectedLead, undefined, replyComposer)}
                    disabled={!canReview || !replyComposer.trim()}
                  >
                    <Send className="h-3.5 w-3.5" />
                    채널톡 답장 전송
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>

        <aside className="space-y-4">
          {!selectedLead ? (
            <Card className="rounded-3xl border-dashed">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">상담을 선택하면 고객 정보가 표시됩니다.</CardContent>
            </Card>
          ) : (
            <>
              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <UserRound className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">고객 정보</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {[
                    ['고객', getLeadCustomerLabel(selectedLead)],
                    ['연락처', selectedLead.customer_phone || '미확인'],
                    ['이메일', selectedLead.customer_email || '미확인'],
                    ['UserChat', selectedLead.channel_talk_user_chat_id],
                  ].map(([label, value]) => (
                    <div key={label} className="flex gap-3 rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2">
                      <span className="w-16 shrink-0 text-xs text-muted-foreground">{label}</span>
                      <span className="min-w-0 flex-1 break-all font-medium">{value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">상담 관리</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {canReview ? (
                    <>
                      <div>
                        <Label className="text-xs">상태</Label>
                        <Select
                          value={selectedLead.status}
                          onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { status: value } })}
                        >
                          <SelectTrigger className="mt-1 h-9 rounded-xl">
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
                          onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { assigned_to: value === 'none' ? null : value } })}
                        >
                          <SelectTrigger className="mt-1 h-9 rounded-xl">
                            <SelectValue placeholder="담당자 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">미지정</SelectItem>
                            {profiles.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || p.id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">내부 메모</Label>
                        <Textarea
                          key={selectedLead.id}
                          defaultValue={selectedLead.memo || ''}
                          placeholder="상담 진행 메모"
                          className="mt-1 min-h-20 rounded-xl text-xs"
                          onBlur={(event) => {
                            if (event.target.value !== (selectedLead.memo || '')) {
                              updateLead.mutate({ id: selectedLead.id, updates: { memo: event.target.value || null } });
                            }
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">읽기 전용 계정입니다.</p>
                  )}
                  <div className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                    담당자: <span className="font-medium text-foreground">{selectedAssignee?.full_name || '미지정'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">AI 요약</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className={confidenceLabel(selectedLead.analysis?.confidence).className}>
                      {confidenceLabel(selectedLead.analysis?.confidence).label}
                    </Badge>
                    {selectedLead.missing_fields?.length > 0 && (
                      <Badge variant="outline" className="border-neutral-300 bg-neutral-100 text-neutral-800">누락 {selectedLead.missing_fields.length}</Badge>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                    {selectedLead.analysis?.summary || selectedLead.analysis?.source_body || '자동 요약이 없습니다.'}
                  </p>
                  <div className="grid gap-2 text-xs">
                    {[
                      ['품목', selectedLead.analysis?.item_name],
                      ['사이즈', selectedLead.analysis?.dimensions],
                      ['수량', selectedLead.analysis?.quantity],
                      ['소재/두께', [selectedLead.analysis?.material, selectedLead.analysis?.thickness].filter(Boolean).join(' / ')],
                      ['가공', joinValue(selectedLead.analysis?.processing)],
                      ['희망 납기', selectedLead.analysis?.desired_due_date],
                    ].map(([label, value]) => (
                      <div key={label} className="flex gap-2">
                        <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
                        <span className="font-medium">{value || '미확인'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">최근 견적</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentQuotes.length === 0 ? (
                    <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">연결 가능한 최근 견적이 없습니다.</p>
                  ) : recentQuotes.map((quote) => (
                    <button
                      key={quote.id}
                      type="button"
                      onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                      className="w-full rounded-xl border border-neutral-200 bg-white p-3 text-left hover:bg-neutral-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium">{quote.project_name || quote.recipient_company || quote.quote_number}</span>
                        <span className="shrink-0 text-xs font-semibold">{formatCurrency(quote.total)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">No. {quote.quote_number} · {quote.quote_date}</p>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">업무 연결</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {canReview && (
                    <Select
                      value={selectedLead.project_id || 'none'}
                      onValueChange={(value) => updateLead.mutate({ id: selectedLead.id, updates: { project_id: value === 'none' ? null : value, status: value === 'none' ? selectedLead.status : 'converted' } })}
                    >
                      <SelectTrigger className="h-9 rounded-xl">
                        <SelectValue placeholder="기존 프로젝트 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">프로젝트 미연결</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => selectedLead.project_id && navigate(`/project-management?id=${selectedLead.project_id}`)} disabled={!selectedLead.project_id}>
                    <LinkIcon className="h-3.5 w-3.5" />
                    연결 프로젝트 열기
                  </Button>
                  <Button size="sm" className="w-full gap-1.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800" onClick={() => navigate(toQuoteDraftParams(selectedLead))}>
                    <FileText className="h-3.5 w-3.5" />
                    견적 초안 만들기
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => navigate(toResponseAssistantParams(selectedLead))}>
                    <Send className="h-3.5 w-3.5" />
                    응대 초안 만들기
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => openProjectDialog(selectedLead)}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    프로젝트 후보 만들기
                  </Button>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-neutral-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-neutral-950" />
                    <h3 className="text-sm font-semibold">전송 이력 · 첨부</h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {actionLogs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">전송 이력이 없습니다.</p>
                    ) : actionLogs.slice(0, 4).map((log) => {
                      const actionDisplay = getActionDisplay(log.action);
                      return (
                        <div key={log.id} className="rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className={cn('h-5 text-[10px]', actionDisplay.className)}>
                              {actionDisplay.label}
                            </Badge>
                            <Badge variant={log.status === 'success' ? 'secondary' : 'destructive'} className="h-5 text-[10px]">{log.status}</Badge>
                          </div>
                          <p className="mt-1 text-muted-foreground">
                            {log.sender_name || '미기록'} · {formatDateTime(log.created_at)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1">
                    {selectedLead.channel_talk_file_keys?.length ? selectedLead.channel_talk_file_keys.map((key) => (
                      <div key={key} className="truncate rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1 font-mono text-[10px] text-muted-foreground">{key}</div>
                    )) : <p className="text-xs text-muted-foreground">첨부파일 키가 없습니다.</p>}
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => copyMemo(selectedLead)}>
                    <Clipboard className="h-3.5 w-3.5" />
                    분석 메모 복사
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </aside>
      </div>

      {canReview && selectedLead && (
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
                저장하면 클라이언트 프로젝트가 생성되고 이 채널톡 상담과 연결됩니다.
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProjectDialogOpen(false)}>취소</Button>
              <Button
                onClick={() => selectedLead && createProject.mutate(selectedLead)}
                disabled={!projectName.trim() || createProject.isPending}
                className="bg-neutral-950 text-white hover:bg-neutral-800"
              >
                {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                프로젝트 생성
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canReview && selectedLead && (
        <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{sendMode === 'private' ? '채널톡 내부 메모 전송' : '채널톡 고객 답장 전송'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className={cn(
                'rounded-lg border p-3 text-xs leading-relaxed',
                sendMode === 'customer'
                  ? 'border-neutral-950 bg-neutral-950 text-white'
                  : 'border-amber-300 bg-amber-50 text-amber-900',
              )}>
                {sendMode === 'customer'
                  ? `고객에게 실제로 보이는 메시지입니다. 채널톡 표시 발신자는 ACBANK이며, 실제 전송자 ${senderDisplayName}은 내부 전송 이력에만 기록됩니다.`
                  : '채널톡 상담원만 보는 private/silent 내부 메모로 전송됩니다.'}
              </div>
              <div>
                <Label>전송 내용</Label>
                <Textarea
                  value={sendBody}
                  onChange={(event) => setSendBody(event.target.value)}
                  className="mt-1 min-h-52 text-sm"
                  placeholder="채널톡으로 보낼 내용을 입력하세요."
                />
              </div>
              {sendMode === 'customer' && (
                <div className="space-y-2">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                    고객에게는 작성한 본문만 전송됩니다. 담당자명은 고객 본문에 자동 추가되지 않습니다.
                  </div>
                  <label className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={closeAfterSend}
                      onChange={(event) => setCloseAfterSend(event.target.checked)}
                      className="h-4 w-4"
                    />
                    전송 후 상담을 종료 상태로 변경
                  </label>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSendDialogOpen(false)}>취소</Button>
              <Button
                onClick={() => selectedLead && channelAction.mutate({
                  action: sendMode === 'private' ? 'send_private_note' : 'send_customer_reply',
                  leadId: selectedLead.id,
                  body: sendBody,
                  draftId: sendDraftId,
                  closeLead: closeAfterSend,
                })}
                disabled={!sendBody.trim() || channelAction.isPending}
                className="gap-1.5 bg-neutral-950 text-white hover:bg-neutral-800"
              >
                {channelAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                전송
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PageShell>
  );
};

export default ChannelTalkLeadsPage;
