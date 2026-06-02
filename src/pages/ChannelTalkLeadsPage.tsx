import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
  Archive,
  AtSign,
  Bell,
  Bot,
  ChevronDown,
  Circle,
  Clipboard,
  FilePlus,
  FileText,
  FolderOpen,
  Hash,
  Inbox,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Sparkles,
  Type,
  UserCheck,
  UserRound,
  Wand2,
  X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
type ConversationStatus = 'active' | 'waiting_customer' | 'on_hold' | 'closed';
type ComposerMode = 'customer' | 'private';

type ComposerAttachmentLink = {
  id: string;
  name: string;
  url: string;
};

type ComposerButtonLink = {
  id: string;
  title: string;
  url: string;
};

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
  conversation_id?: string | null;
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

type ChannelTalkConversation = {
  id: string;
  user_chat_id: string;
  channel_talk_user_id: string | null;
  customer_name: string | null;
  customer_company: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  status: ConversationStatus | string;
  assigned_to: string | null;
  assigned_at: string | null;
  assigned_by: string | null;
  memo: string | null;
  close_reason: string | null;
  last_message_at: string | null;
  last_customer_message_at: string | null;
  last_staff_reply_at: string | null;
  latest_lead_id: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

type ConversationRead = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
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
  conversation_id: string | null;
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
  conversation_id: string | null;
  lead_id: string | null;
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
  conversation_id: string | null;
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

const CONVERSATION_STATUS_CONFIG: Record<ConversationStatus, { label: string; className: string }> = {
  active: { label: '진행중', className: 'border-neutral-950 bg-neutral-950 text-white' },
  waiting_customer: { label: '답변대기', className: 'border-neutral-300 bg-white text-neutral-950' },
  on_hold: { label: '보류', className: 'border-neutral-300 bg-neutral-100 text-neutral-800' },
  closed: { label: '종료', className: 'border-neutral-200 bg-neutral-100 text-neutral-500' },
};

const inboxTabs: Array<{ value: InboxTab; label: string }> = [
  { value: 'active', label: '진행중' },
  { value: 'waiting', label: '답변대기' },
  { value: 'hold', label: '보류' },
  { value: 'closed', label: '종료' },
];

const internalMemoTemplates = [
  '도면/PDF 미리보기 추가 요청 필요',
  '사이즈·수량 확인 필요',
  '납기 가능 여부 내부 확인 필요',
  '견적 가능성 높음. 담당자 배정 후 응대',
];

const replyTemplates = [
  {
    id: 'greeting-basic',
    tag: '#첫인사_기본',
    title: '첫인사 기본',
    body: '안녕하세요. 아크뱅크입니다.\n문의주신 내용 확인했습니다. 정확한 안내를 위해 필요한 정보를 확인 후 답변드리겠습니다.',
  },
  {
    id: 'greeting-delay',
    tag: '#첫인사_응답지연',
    title: '첫인사 응답지연',
    body: '안녕하세요. 아크뱅크입니다.\n답변이 늦어 죄송합니다. 문의주신 내용 확인 후 최대한 빠르게 안내드리겠습니다.',
  },
  {
    id: 'request-drawing',
    tag: '#정보요청_도면',
    title: '도면/이미지 요청',
    body: '정확한 견적을 위해 제작 도면 또는 참고 이미지를 함께 보내주세요.\n가능하면 사이즈, 수량, 두께, 색상 정보도 같이 전달 부탁드립니다.',
  },
  {
    id: 'request-size',
    tag: '#정보요청_사이즈수량',
    title: '사이즈/수량 요청',
    body: '정확한 견적을 위해 제작 사이즈, 수량, 두께, 색상 정보를 알려주세요.\n가공 방식이나 납기 희망일이 있으시면 함께 전달 부탁드립니다.',
  },
  {
    id: 'closing-basic',
    tag: '#끝인사_기본',
    title: '끝인사 기본',
    body: '안내드린 내용이 도움이 되었길 바랍니다.\n이후에도 궁금한 점 있으시면 언제든지 말씀해주세요.',
  },
  {
    id: 'closing-long-wait',
    tag: '#끝인사_장기미응답',
    title: '끝인사 장기미응답',
    body: '추가 확인이 필요하시면 언제든지 말씀해주세요.\n자료가 준비되면 이어서 확인 후 안내드리겠습니다.',
  },
];

const emojiOptions = ['🙂', '😊', '👍', '🙏', '🙇', '✅', '📎', '📐', '📝', '⏰', '🚚', '✨'];

const conversationStatusOptions: Array<{ value: ConversationStatus; label: string }> = [
  { value: 'active', label: '진행중' },
  { value: 'waiting_customer', label: '고객 답변 대기' },
  { value: 'on_hold', label: '보류' },
  { value: 'closed', label: '종료' },
];

function statusInfo(status: string) {
  return STATUS_CONFIG[status as LeadStatus] || { label: status, className: 'border-muted bg-muted text-muted-foreground' };
}

function conversationStatusInfo(status: string) {
  return CONVERSATION_STATUS_CONFIG[status as ConversationStatus] || { label: status, className: 'border-muted bg-muted text-muted-foreground' };
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
  if (action === 'assign_conversation') return { label: '담당 변경', className: 'border-neutral-300 bg-neutral-100 text-neutral-900' };
  if (action === 'mark_conversation_read') return { label: '읽음 처리', className: 'border-neutral-300 bg-white text-neutral-700' };
  if (action === 'close_conversation') return { label: '상담 종료', className: 'border-neutral-300 bg-neutral-100 text-neutral-700' };
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

function getConversationTitle(conversation: ChannelTalkConversation, lead?: ChannelTalkLead | null) {
  return lead?.analysis?.item_name
    || conversation.customer_company
    || conversation.customer_name
    || lead?.customer_company
    || lead?.customer_name
    || '채널톡 상담';
}

function getConversationCustomerLabel(conversation: ChannelTalkConversation, lead?: ChannelTalkLead | null) {
  return [
    conversation.customer_company || lead?.customer_company,
    conversation.customer_name || lead?.customer_name,
  ].filter(Boolean).join(' / ') || conversation.user_chat_id;
}

function getConversationContact(conversation: ChannelTalkConversation, lead?: ChannelTalkLead | null) {
  return conversation.customer_phone
    || conversation.customer_email
    || lead?.customer_phone
    || lead?.customer_email
    || conversation.channel_talk_user_id
    || '연락처 미확인';
}

function getConversationMessagePreview(
  conversation: ChannelTalkConversation,
  lead?: ChannelTalkLead | null,
  message?: ChannelTalkMessage | null,
) {
  return message?.body || lead?.analysis?.source_body || lead?.analysis?.summary || conversation.memo || '저장된 메시지 요약이 없습니다.';
}

function isUnreadConversation(
  conversation: ChannelTalkConversation,
  message?: ChannelTalkMessage | null,
  read?: ConversationRead | null,
) {
  if (conversation.status === 'closed') return false;
  const customerTime = conversation.last_customer_message_at || (message?.sender_type === 'user' ? message.received_at : null);
  if (!customerTime) return false;
  if (!read?.last_read_at) return true;
  return new Date(customerTime).getTime() > new Date(read.last_read_at).getTime();
}

function replyDelayLabel(conversation: ChannelTalkConversation) {
  if (conversation.status === 'closed' || !conversation.last_customer_message_at) return null;
  const customerAt = new Date(conversation.last_customer_message_at).getTime();
  const staffAt = conversation.last_staff_reply_at ? new Date(conversation.last_staff_reply_at).getTime() : 0;
  if (staffAt >= customerAt) return null;
  const minutes = (Date.now() - customerAt) / 60000;
  if (minutes >= 120) return '2시간+ 지연';
  if (minutes >= 30) return '30분+ 지연';
  return null;
}

function matchesConversationQuote(conversation: ChannelTalkConversation, lead: ChannelTalkLead | null, quote: SavedQuoteOption) {
  const company = normalizeText(conversation.customer_company || lead?.customer_company);
  const name = normalizeText(conversation.customer_name || lead?.customer_name);
  const email = normalizeText(conversation.customer_email || lead?.customer_email);
  const phone = normalizePhone(conversation.customer_phone || lead?.customer_phone);

  if (phone && normalizePhone(quote.recipient_phone) === phone) return true;
  if (email && normalizeText(quote.recipient_email) === email) return true;
  if (company && normalizeText(quote.recipient_company).includes(company)) return true;
  if (name && normalizeText(quote.recipient_name).includes(name)) return true;
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

function getTemplateQuery(value: string, cursorPosition: number | null | undefined) {
  const cursor = cursorPosition ?? value.length;
  const textBeforeCursor = value.slice(0, cursor);
  const match = textBeforeCursor.match(/#[^\s#]*$/);
  return match ? match[0].slice(1).toLowerCase() : null;
}

function replaceTemplateTrigger(value: string, cursorPosition: number | null | undefined, body: string) {
  const cursor = cursorPosition ?? value.length;
  const before = value.slice(0, cursor);
  const after = value.slice(cursor);
  const nextBefore = before.replace(/#[^\s#]*$/, body);
  return `${nextBefore}${after}`;
}

function hasTemplateSignature(value: string) {
  return /#[^\s#]*$/.test(value);
}

const ChannelTalkLeadsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAdmin, isModerator, isManager, isEmployee, isApproved, profile } = useAuth();
  const canReview = isApproved && (isAdmin || isModerator || isManager || isEmployee);
  const selectedParamId = searchParams.get('conversationId') || searchParams.get('id');
  const legacyLeadIdParam = searchParams.get('id');

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
  const [composerMode, setComposerMode] = useState<ComposerMode>('customer');
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [templateQuery, setTemplateQuery] = useState('');
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState(0);
  const [composerAttachmentLinks, setComposerAttachmentLinks] = useState<ComposerAttachmentLink[]>([]);
  const [composerButtons, setComposerButtons] = useState<ComposerButtonLink[]>([]);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [buttonDialogOpen, setButtonDialogOpen] = useState(false);
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [buttonTitle, setButtonTitle] = useState('');
  const [buttonUrl, setButtonUrl] = useState('');
  const [closeAfterSend, setCloseAfterSend] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [pendingAssignConversation, setPendingAssignConversation] = useState<ChannelTalkConversation | null>(null);
  const autoRefreshedConversationIds = useRef<Set<string>>(new Set());
  const composerRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: conversations = [], isLoading: isConversationsLoading } = useQuery<ChannelTalkConversation[]>({
    queryKey: ['channel-talk-conversations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('channel_talk_conversations' as any)
        .select('*')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(240);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkConversation[];
    },
    enabled: !!user,
  });

  const conversationIds = useMemo(() => conversations.map((conversation) => conversation.id), [conversations]);

  const { data: reads = [] } = useQuery<ConversationRead[]>({
    queryKey: ['channel-talk-conversation-reads', user?.id, conversationIds.join('|')],
    queryFn: async () => {
      if (!user || conversationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('channel_talk_conversation_reads' as any)
        .select('conversation_id, user_id, last_read_at')
        .eq('user_id', user.id)
        .in('conversation_id', conversationIds);
      if (error) throw error;
      return ((data || []) as unknown) as ConversationRead[];
    },
    enabled: !!user && conversationIds.length > 0,
  });

  const { data: leads = [], isLoading: isLeadsLoading } = useQuery<ChannelTalkLead[]>({
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

  const { data: recentMessages = [] } = useQuery<ChannelTalkMessage[]>({
    queryKey: ['channel-talk-recent-messages', conversationIds.join('|')],
    queryFn: async () => {
      if (conversationIds.length === 0) return [];
      const { data, error } = await supabase
        .from('channel_talk_messages' as any)
        .select('id, conversation_id, lead_id, user_chat_id, message_id, sender_type, message_type, body, file_keys, received_at')
        .in('conversation_id', conversationIds)
        .order('received_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkMessage[];
    },
    enabled: !!user && conversationIds.length > 0,
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

  const leadsById = useMemo(() => {
    const map = new Map<string, ChannelTalkLead>();
    leads.forEach((lead) => map.set(lead.id, lead));
    return map;
  }, [leads]);

  const leadsByConversationId = useMemo(() => {
    const map = new Map<string, ChannelTalkLead[]>();
    leads.forEach((lead) => {
      if (!lead.conversation_id) return;
      const current = map.get(lead.conversation_id) || [];
      current.push(lead);
      map.set(lead.conversation_id, current);
    });
    map.forEach((items) => items.sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime()));
    return map;
  }, [leads]);

  const readByConversationId = useMemo(() => {
    const map = new Map<string, ConversationRead>();
    reads.forEach((read) => map.set(read.conversation_id, read));
    return map;
  }, [reads]);

  const resolvedConversationId = useMemo(() => {
    if (!selectedParamId) return null;
    if (conversations.some((conversation) => conversation.id === selectedParamId)) return selectedParamId;
    const legacyLead = leadsById.get(selectedParamId);
    return legacyLead?.conversation_id || null;
  }, [conversations, leadsById, selectedParamId]);

  const { data: messages = [] } = useQuery<ChannelTalkMessage[]>({
    queryKey: ['channel-talk-messages', resolvedConversationId],
    queryFn: async () => {
      if (!resolvedConversationId) return [];
      const { data, error } = await supabase
        .from('channel_talk_messages' as any)
        .select('id, conversation_id, lead_id, user_chat_id, message_id, sender_type, message_type, body, file_keys, received_at')
        .eq('conversation_id', resolvedConversationId)
        .order('received_at', { ascending: false })
        .limit(150);
      if (error) throw error;
      return ((data || []) as unknown) as ChannelTalkMessage[];
    },
    enabled: !!user && !!resolvedConversationId,
  });

  const { data: drafts = [] } = useQuery<ReplyDraft[]>({
    queryKey: ['channel-talk-reply-drafts', resolvedConversationId],
    queryFn: async () => {
      if (!resolvedConversationId) return [];
      const { data, error } = await supabase
        .from('channel_talk_reply_drafts' as any)
        .select('id, conversation_id, lead_id, created_by, updated_by, sent_by, body, status, sent_at, channel_message_id, created_at')
        .eq('conversation_id', resolvedConversationId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown) as ReplyDraft[];
    },
    enabled: !!user && !!resolvedConversationId,
  });

  const { data: actionLogs = [] } = useQuery<ActionLog[]>({
    queryKey: ['channel-talk-action-logs', resolvedConversationId],
    queryFn: async () => {
      if (!resolvedConversationId) return [];
      const { data, error } = await supabase
        .from('channel_talk_action_logs' as any)
        .select('id, conversation_id, lead_id, action, status, sender_name, visible_sender_name, channel_message_id, error_message, created_at')
        .eq('conversation_id', resolvedConversationId)
        .order('created_at', { ascending: false })
        .limit(80);
      if (error) throw error;
      return ((data || []) as unknown) as ActionLog[];
    },
    enabled: !!user && !!resolvedConversationId,
  });

  const latestMessageByConversationId = useMemo(() => {
    const map = new Map<string, ChannelTalkMessage>();
    recentMessages.forEach((message) => {
      if (message.conversation_id && !map.has(message.conversation_id)) {
        map.set(message.conversation_id, message);
      }
    });
    return map;
  }, [recentMessages]);

  const duplicateContactKeys = useMemo(() => {
    const counts = new Map<string, number>();
    conversations.forEach((conversation) => {
      const phone = normalizePhone(conversation.customer_phone);
      const email = normalizeText(conversation.customer_email);
      const key = phone ? `phone:${phone}` : email ? `email:${email}` : '';
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        const relatedLeads = leadsByConversationId.get(conversation.id) || [];
        const lead = relatedLeads[0] || null;
        const latest = latestMessageByConversationId.get(conversation.id);
        const read = readByConversationId.get(conversation.id);
        if (getInboxTab(conversation.status) !== activeTab) return false;
        if (quickFilter === 'unread' && !isUnreadConversation(conversation, latest, read)) return false;
        if (quickFilter === 'mine' && conversation.assigned_to !== user?.id) return false;
        if (quickFilter === 'unassigned' && conversation.assigned_to) return false;
        if (quickFilter === 'closed' && getInboxTab(conversation.status) !== 'closed') return false;
        if (!term) return true;
        const haystack = [
          conversation.customer_name,
          conversation.customer_company,
          conversation.customer_phone,
          conversation.customer_email,
          conversation.user_chat_id,
          lead?.inquiry_type,
          lead?.analysis?.item_name,
          lead?.analysis?.summary,
          lead?.analysis?.source_body,
          latest?.body,
        ].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(term);
      })
      .sort((a, b) => {
        const aDate = latestMessageByConversationId.get(a.id)?.received_at || a.last_message_at || a.updated_at || a.created_at;
        const bDate = latestMessageByConversationId.get(b.id)?.received_at || b.last_message_at || b.updated_at || b.created_at;
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      });
  }, [activeTab, conversations, latestMessageByConversationId, leadsByConversationId, quickFilter, readByConversationId, search, user?.id]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === resolvedConversationId) || filteredConversations[0] || null,
    [conversations, filteredConversations, resolvedConversationId],
  );

  const selectedConversationLeads = useMemo(
    () => selectedConversation ? (leadsByConversationId.get(selectedConversation.id) || []) : [],
    [leadsByConversationId, selectedConversation],
  );

  const selectedLead = useMemo(
    () => {
      if (!selectedConversation) return null;
      if (selectedConversation.latest_lead_id) {
        const latest = leadsById.get(selectedConversation.latest_lead_id);
        if (latest) return latest;
      }
      return selectedConversationLeads[0] || null;
    },
    [leadsById, selectedConversation, selectedConversationLeads],
  );

  const { data: recentQuotes = [] } = useQuery<SavedQuoteOption[]>({
    queryKey: ['channel-talk-related-quotes', selectedConversation?.id],
    queryFn: async () => {
      if (!selectedConversation) return [];
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, recipient_company, recipient_name, recipient_phone, recipient_email, total, quote_date, project_stage')
        .order('quote_date', { ascending: false })
        .limit(120);
      if (error) throw error;
      return (((data || []) as unknown) as SavedQuoteOption[])
        .filter((quote) => matchesConversationQuote(selectedConversation, selectedLead, quote))
        .slice(0, 5);
    },
    enabled: !!user && !!selectedConversation,
  });

  const inboxCounts = useMemo(() => {
    const counts: Record<QuickFilter, number> = {
      all: conversations.length,
      unread: 0,
      mine: 0,
      unassigned: 0,
      closed: 0,
    };
    conversations.forEach((conversation) => {
      const latest = latestMessageByConversationId.get(conversation.id);
      const read = readByConversationId.get(conversation.id);
      if (isUnreadConversation(conversation, latest, read)) counts.unread += 1;
      if (conversation.assigned_to === user?.id) counts.mine += 1;
      if (!conversation.assigned_to) counts.unassigned += 1;
      if (getInboxTab(conversation.status) === 'closed') counts.closed += 1;
    });
    return counts;
  }, [conversations, latestMessageByConversationId, readByConversationId, user?.id]);

  const orderedMessages = useMemo(
    () => [...messages].sort((a, b) => new Date(a.received_at).getTime() - new Date(b.received_at).getTime()),
    [messages],
  );
  const selectedAssignee = selectedConversation?.assigned_to ? profiles.find((p) => p.id === selectedConversation.assigned_to) : null;
  const senderDisplayName = profile?.full_name || user?.email || '아크뱅크 담당자';

  const filteredReplyTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    if (!query) return replyTemplates;
    return replyTemplates.filter((template) => {
      const haystack = `${template.tag} ${template.title} ${template.body}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [templateQuery]);

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

  const updateConversation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const next = { ...updates };
      if (next.status === 'closed' && !next.closed_at) next.closed_at = new Date().toISOString();
      if (next.status && next.status !== 'closed') next.closed_at = null;

      const { error } = await supabase
        .from('channel_talk_conversations' as any)
        .update(next)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channel-talk-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      toast.success('상담 정보가 업데이트되었습니다.');
    },
    onError: (error: Error) => toast.error('상담 업데이트 실패: ' + error.message),
  });

  const createReplyDraft = useMutation({
    mutationFn: async ({ lead, conversation, body }: { lead: ChannelTalkLead; conversation: ChannelTalkConversation; body?: string }) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const draftBody = body?.trim() || lead.analysis?.recommended_reply || '문의 내용 확인했습니다. 필요한 정보를 확인 후 안내드리겠습니다.';
      const { error } = await supabase
        .from('channel_talk_reply_drafts' as any)
        .insert({
          conversation_id: conversation.id,
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
      queryClient.invalidateQueries({ queryKey: ['channel-talk-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-reply-drafts', resolvedConversationId] });
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
      queryClient.invalidateQueries({ queryKey: ['channel-talk-conversations'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-conversation-reads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-leads'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-recent-messages'] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-messages', resolvedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-reply-drafts', resolvedConversationId] });
      queryClient.invalidateQueries({ queryKey: ['channel-talk-action-logs', resolvedConversationId] });
      setSendDialogOpen(false);
      setSendDraftId(null);
      setSendBody('');
      if (variables.action === 'send_customer_reply') {
        setReplyComposer('');
        setComposerAttachmentLinks([]);
        setComposerButtons([]);
      }
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
    if (legacyLeadIdParam && resolvedConversationId && legacyLeadIdParam !== resolvedConversationId) {
      setSearchParams({ conversationId: resolvedConversationId }, { replace: true });
      return;
    }
    if (!selectedParamId && filteredConversations[0]) {
      setSearchParams({ conversationId: filteredConversations[0].id }, { replace: true });
    }
  }, [filteredConversations, legacyLeadIdParam, resolvedConversationId, selectedParamId, setSearchParams]);

  useEffect(() => {
    if (!selectedConversation || autoRefreshedConversationIds.current.has(selectedConversation.id)) return;
    autoRefreshedConversationIds.current.add(selectedConversation.id);
    supabase.functions
      .invoke('channel-talk-actions', {
        body: { action: 'refresh_messages', conversationId: selectedConversation.id, leadId: selectedLead?.id },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          console.warn('Channel Talk auto refresh failed', error || data?.error);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['channel-talk-conversations'] });
        queryClient.invalidateQueries({ queryKey: ['channel-talk-recent-messages'] });
        queryClient.invalidateQueries({ queryKey: ['channel-talk-messages', selectedConversation.id] });
        queryClient.invalidateQueries({ queryKey: ['channel-talk-action-logs', selectedConversation.id] });
      });
  }, [queryClient, selectedConversation, selectedLead?.id]);

  useEffect(() => {
    if (!selectedConversation || !user) return;
    supabase.functions
      .invoke('channel-talk-actions', {
        body: { action: 'mark_conversation_read', conversationId: selectedConversation.id },
      })
      .then(({ data, error }) => {
        if (error || data?.error) {
          console.warn('Channel Talk mark read failed', error || data?.error);
          return;
        }
        queryClient.invalidateQueries({ queryKey: ['channel-talk-conversation-reads'] });
      });
  }, [queryClient, selectedConversation?.id, user]);

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

  const openSendDialog = (mode: 'private' | 'customer', lead: ChannelTalkLead, draft?: ReplyDraft, bodyOverride?: string, closeAfter = false) => {
    setSendMode(mode);
    setSendDraftId(draft?.id || null);
    setSendBody(bodyOverride || draft?.body || (mode === 'private' ? buildInternalMemo(lead) : replyComposer || lead.analysis?.recommended_reply || ''));
    setCloseAfterSend(closeAfter);
    setSendDialogOpen(true);
  };

  const handleComposerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.target.value;
    setReplyComposer(value);
    const query = getTemplateQuery(value, event.target.selectionStart);
    if (query !== null) {
      setTemplateQuery(query);
      setSelectedTemplateIndex(0);
      setTemplateMenuOpen(true);
      return;
    }
    setTemplateMenuOpen(false);
  };

  const insertComposerText = (text: string) => {
    const textarea = composerRef.current;
    const current = replyComposer;
    const start = textarea?.selectionStart ?? current.length;
    const end = textarea?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${text}${current.slice(end)}`;
    setReplyComposer(next);
    requestAnimationFrame(() => {
      textarea?.focus();
      const cursor = start + text.length;
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const insertReplyTemplate = (template: typeof replyTemplates[number]) => {
    const textarea = composerRef.current;
    const cursor = textarea?.selectionStart ?? replyComposer.length;
    const next = hasTemplateSignature(replyComposer.slice(0, cursor))
      ? replaceTemplateTrigger(replyComposer, cursor, template.body)
      : [replyComposer.trim(), template.body].filter(Boolean).join('\n\n');
    setReplyComposer(next);
    setTemplateMenuOpen(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      const nextCursor = next.length;
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
      event.preventDefault();
      applyRecommendedReply();
      return;
    }
    if (templateMenuOpen && filteredReplyTemplates.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedTemplateIndex((index) => (index + 1) % filteredReplyTemplates.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedTemplateIndex((index) => (index - 1 + filteredReplyTemplates.length) % filteredReplyTemplates.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        insertReplyTemplate(filteredReplyTemplates[selectedTemplateIndex] || filteredReplyTemplates[0]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setTemplateMenuOpen(false);
      }
    }
  };

  const applyRecommendedReply = () => {
    const fallback = composerMode === 'private'
      ? selectedLead ? buildInternalMemo(selectedLead) : '상담 검토가 필요합니다.'
      : selectedLead?.analysis?.recommended_reply || '문의 내용 확인했습니다. 필요한 정보를 확인 후 안내드리겠습니다.';
    setReplyComposer((current) => [current.trim(), fallback].filter(Boolean).join('\n\n'));
    requestAnimationFrame(() => composerRef.current?.focus());
  };

  const openComposerSendDialog = (mode: ComposerMode = composerMode, closeConversation = false) => {
    if (!selectedLead) return;
    openSendDialog(
      mode === 'private' ? 'private' : 'customer',
      selectedLead,
      undefined,
      replyComposer || (mode === 'private' ? buildInternalMemo(selectedLead) : selectedLead.analysis?.recommended_reply || ''),
      closeConversation,
    );
  };

  const addAttachmentLink = () => {
    const url = attachmentUrl.trim();
    if (!/^https?:\/\//i.test(url)) {
      toast.error('첨부 링크는 http 또는 https URL이어야 합니다.');
      return;
    }
    setComposerAttachmentLinks((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: attachmentName.trim() || '첨부 링크',
        url,
      },
    ].slice(0, 5));
    setAttachmentName('');
    setAttachmentUrl('');
    setAttachmentDialogOpen(false);
  };

  const addComposerButton = () => {
    const url = buttonUrl.trim();
    if (!buttonTitle.trim()) {
      toast.error('버튼 이름을 입력해주세요.');
      return;
    }
    if (!/^https?:\/\//i.test(url)) {
      toast.error('버튼 링크는 http 또는 https URL이어야 합니다.');
      return;
    }
    if (composerButtons.length >= 2) {
      toast.error('버튼은 최대 2개까지 추가할 수 있습니다.');
      return;
    }
    setComposerButtons((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        title: buttonTitle.trim(),
        url,
      },
    ].slice(0, 2));
    setButtonTitle('');
    setButtonUrl('');
    setButtonDialogOpen(false);
  };

  const handleAssignConversation = (conversation: ChannelTalkConversation, force = false) => {
    if (!user) return;
    if (conversation.assigned_to && conversation.assigned_to !== user.id && !force) {
      setPendingAssignConversation(conversation);
      setAssignDialogOpen(true);
      return;
    }
    channelAction.mutate({
      action: 'assign_conversation',
      conversationId: conversation.id,
      leadId: selectedLead?.id,
      force,
    });
  };

  const runRefreshSelected = () => {
    if (!selectedConversation) return;
    channelAction.mutate({ action: 'refresh_messages', conversationId: selectedConversation.id, leadId: selectedLead?.id });
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
                <p className="text-xs text-muted-foreground">{filteredConversations.length}건 표시</p>
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
              {isConversationsLoading || isLeadsLoading ? (
                <div className="flex h-40 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredConversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  조건에 맞는 상담이 없습니다.
                </div>
              ) : filteredConversations.map((conversation) => {
                const relatedLeads = leadsByConversationId.get(conversation.id) || [];
                const lead = relatedLeads[0] || null;
                const latest = latestMessageByConversationId.get(conversation.id);
                const s = conversationStatusInfo(conversation.status);
                const confidence = confidenceLabel(lead?.analysis?.confidence);
                const isSelected = selectedConversation?.id === conversation.id;
                const assignee = conversation.assigned_to ? profiles.find((p) => p.id === conversation.assigned_to) : null;
                const missingCount = relatedLeads.reduce((sum, item) => sum + (item.missing_fields?.length || 0), 0);
                const phone = normalizePhone(conversation.customer_phone);
                const email = normalizeText(conversation.customer_email);
                const duplicateKey = phone ? `phone:${phone}` : email ? `email:${email}` : '';
                const hasPotentialDuplicate = duplicateKey && (duplicateContactKeys.get(duplicateKey) || 0) > 1;
                const delayLabel = replyDelayLabel(conversation);
                return (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => setSearchParams({ conversationId: conversation.id }, { replace: true })}
                  className={cn(
                    'w-full rounded-2xl border border-transparent p-3 text-left transition-colors hover:bg-neutral-50',
                    isSelected && 'border-neutral-950/30 bg-neutral-50 shadow-sm',
                  )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-sm font-semibold text-neutral-950">
                        {(conversation.customer_name || conversation.customer_company || lead?.customer_name || lead?.customer_company || 'C').slice(0, 1)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold">{getConversationTitle(conversation, lead)}</p>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatDateTime(latest?.received_at || conversation.last_message_at || conversation.updated_at)}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{getConversationCustomerLabel(conversation, lead)}</p>
                        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {getConversationMessagePreview(conversation, lead, latest)}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className={cn('h-5 text-[10px]', s.className)}>{s.label}</Badge>
                          {lead && <Badge variant="outline" className={cn('h-5 text-[10px]', confidence.className)}>{confidence.label}</Badge>}
                          {relatedLeads.length > 1 && (
                            <Badge variant="outline" className="h-5 border-neutral-300 bg-white text-[10px] text-neutral-700">
                              AI {relatedLeads.length}건
                            </Badge>
                          )}
                          {missingCount > 0 && (
                            <Badge variant="outline" className="h-5 border-neutral-300 bg-neutral-100 text-[10px] text-neutral-800">
                              누락 {missingCount}
                            </Badge>
                          )}
                          {hasPotentialDuplicate && (
                            <Badge variant="outline" className="h-5 border-neutral-300 bg-white text-[10px] text-neutral-700">
                              잠재 중복
                            </Badge>
                          )}
                          {delayLabel && (
                            <Badge variant="outline" className="h-5 border-red-300 bg-red-50 text-[10px] text-red-700">
                              {delayLabel}
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
          {!selectedConversation ? (
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
                      <h2 className="truncate text-lg font-semibold">{getConversationTitle(selectedConversation, selectedLead)}</h2>
                      <Badge variant="outline" className={conversationStatusInfo(selectedConversation.status).className}>
                        {conversationStatusInfo(selectedConversation.status).label}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {getConversationCustomerLabel(selectedConversation, selectedLead)} · {getConversationContact(selectedConversation, selectedLead)}
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
                        onClick={() => handleAssignConversation(selectedConversation)}
                      >
                        <UserCheck className="h-3.5 w-3.5" />
                        담당하기
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
                <div className={cn(
                  'relative rounded-3xl border-2 bg-white p-3 shadow-sm transition-colors',
                  composerMode === 'private' ? 'border-amber-300' : 'border-neutral-950',
                )}>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex rounded-2xl bg-neutral-100 p-1 text-sm font-semibold">
                      <button
                        type="button"
                        onClick={() => setComposerMode('customer')}
                        className={cn(
                          'rounded-xl px-3 py-1.5 transition-colors',
                          composerMode === 'customer' ? 'bg-white text-neutral-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-950',
                        )}
                      >
                        고객응대
                      </button>
                      <button
                        type="button"
                        onClick={() => setComposerMode('private')}
                        className={cn(
                          'rounded-xl px-3 py-1.5 transition-colors',
                          composerMode === 'private' ? 'bg-amber-100 text-amber-950 shadow-sm' : 'text-neutral-500 hover:text-neutral-950',
                        )}
                      >
                        내부대화
                      </button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {composerMode === 'customer'
                        ? '채널톡에는 ACBANK로 전송됩니다. 실제 전송자는 내부 로그에만 남습니다.'
                        : '내부용 · 고객 비노출 메모로 전송됩니다.'}
                    </p>
                  </div>

                  {templateMenuOpen && filteredReplyTemplates.length > 0 && (
                    <div className="absolute bottom-[calc(100%-86px)] left-4 z-20 grid w-[min(720px,calc(100%-2rem))] grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
                      <div className="max-h-64 overflow-y-auto border-r border-neutral-100 p-2">
                        {filteredReplyTemplates.map((template, index) => (
                          <button
                            key={template.id}
                            type="button"
                            onMouseDown={(event) => {
                              event.preventDefault();
                              insertReplyTemplate(template);
                            }}
                            className={cn(
                              'block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors',
                              index === selectedTemplateIndex ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-700 hover:bg-neutral-50',
                            )}
                          >
                            {template.tag}
                          </button>
                        ))}
                      </div>
                      <div className="max-h-64 overflow-y-auto p-4">
                        <p className="text-xs font-semibold text-neutral-500">
                          {filteredReplyTemplates[selectedTemplateIndex]?.title || filteredReplyTemplates[0]?.title}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                          {filteredReplyTemplates[selectedTemplateIndex]?.body || filteredReplyTemplates[0]?.body}
                        </p>
                      </div>
                    </div>
                  )}

                  <Textarea
                    ref={composerRef}
                    value={replyComposer}
                    onChange={handleComposerChange}
                    onKeyDown={handleComposerKeyDown}
                    className="min-h-28 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0"
                    placeholder={composerMode === 'customer'
                      ? '무엇을 써볼까요? #으로 템플릿, ⌘+J로 추천 답변'
                      : '내부 검토 메모를 작성하세요. 고객에게 보이지 않습니다.'}
                  />

                  {(composerAttachmentLinks.length > 0 || composerButtons.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {composerAttachmentLinks.map((link) => (
                        <span
                          key={link.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs text-neutral-700"
                        >
                          <Paperclip className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{link.name}</span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900"
                            onClick={() => setComposerAttachmentLinks((current) => current.filter((item) => item.id !== link.id))}
                            title="첨부 링크 제거"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                      {composerButtons.map((button) => (
                        <span
                          key={button.id}
                          className="inline-flex max-w-full items-center gap-2 rounded-full border border-neutral-900 bg-white px-3 py-1.5 text-xs font-medium text-neutral-950"
                        >
                          <FilePlus className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{button.title}</span>
                          <button
                            type="button"
                            className="rounded-full p-0.5 text-neutral-400 hover:bg-neutral-200 hover:text-neutral-900"
                            onClick={() => setComposerButtons((current) => current.filter((item) => item.id !== button.id))}
                            title="버튼 제거"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <TooltipProvider>
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3">
                      <div className="flex items-center gap-1 text-neutral-500">
                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                  <Plus className="h-5 w-5" />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>추가</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="start" side="top" className="w-80 rounded-2xl p-2">
                            <button
                              type="button"
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-neutral-50"
                              onClick={() => setAttachmentDialogOpen(true)}
                            >
                              <span className="rounded-xl bg-neutral-100 p-2">
                                <Paperclip className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold">파일 및 이미지</span>
                                <span className="text-xs text-muted-foreground">Drive, 첨부 파일, 이미지 URL을 메시지에 추가</span>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-neutral-50"
                              onClick={() => setButtonDialogOpen(true)}
                            >
                              <span className="rounded-xl bg-neutral-100 p-2">
                                <FilePlus className="h-4 w-4" />
                              </span>
                              <span>
                                <span className="block text-sm font-semibold">버튼</span>
                                <span className="text-xs text-muted-foreground">외부 링크 버튼을 최대 2개까지 추가</span>
                              </span>
                            </button>
                          </PopoverContent>
                        </Popover>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl"
                              onClick={() => insertComposerText('안녕하세요. 아크뱅크입니다.\n')}
                            >
                              <Type className="h-5 w-5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>기본 인사 삽입</TooltipContent>
                        </Tooltip>

                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                  <Smile className="h-5 w-5" />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>이모티콘</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="start" side="top" className="w-64 rounded-2xl">
                            <div className="grid grid-cols-6 gap-1">
                              {emojiOptions.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  className="rounded-xl p-2 text-xl hover:bg-neutral-100"
                                  onClick={() => insertComposerText(emoji)}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                  <AtSign className="h-5 w-5" />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>내부 멘션</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="start" side="top" className="w-64 rounded-2xl p-2">
                            <p className="px-2 pb-2 text-xs font-semibold text-muted-foreground">내부 메모용 멘션</p>
                            <div className="max-h-56 overflow-y-auto">
                              {profiles.slice(0, 20).map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  className="block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-neutral-50"
                                  onClick={() => insertComposerText(`@${p.full_name || p.id} `)}
                                >
                                  {p.full_name || p.id}
                                </button>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>

                        <Popover>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <PopoverTrigger asChild>
                                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                                  <Hash className="h-5 w-5" />
                                </Button>
                              </PopoverTrigger>
                            </TooltipTrigger>
                            <TooltipContent>응대 템플릿</TooltipContent>
                          </Tooltip>
                          <PopoverContent align="start" side="top" className="w-80 rounded-2xl p-2">
                            {replyTemplates.map((template) => (
                              <button
                                key={template.id}
                                type="button"
                                className="block w-full rounded-xl px-3 py-2 text-left hover:bg-neutral-50"
                                onClick={() => insertReplyTemplate(template)}
                              >
                                <span className="block text-sm font-semibold">{template.tag}</span>
                                <span className="line-clamp-1 text-xs text-muted-foreground">{template.body}</span>
                              </button>
                            ))}
                          </PopoverContent>
                        </Popover>

                        <div className="mx-1 h-6 w-px bg-neutral-200" />

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 rounded-xl"
                              onClick={applyRecommendedReply}
                              disabled={!selectedLead && composerMode === 'customer'}
                            >
                              <Wand2 className="h-5 w-5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>AI 추천문 삽입</TooltipContent>
                        </Tooltip>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-xl"
                          onClick={() => selectedLead && createReplyDraft.mutate({ lead: selectedLead, conversation: selectedConversation, body: replyComposer })}
                          disabled={!canReview || !selectedLead || !replyComposer.trim() || createReplyDraft.isPending}
                        >
                          초안 저장
                        </Button>
                        <div className="flex overflow-hidden rounded-xl">
                          <Button
                            size="sm"
                            className={cn(
                              'h-10 rounded-none rounded-l-xl px-5 text-white',
                              composerMode === 'private' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-neutral-950 hover:bg-neutral-800',
                            )}
                            onClick={() => openComposerSendDialog(composerMode)}
                            disabled={!canReview || !selectedLead || (!replyComposer.trim() && composerMode === 'customer')}
                          >
                            <Send className="mr-1.5 h-4 w-4" />
                            {composerMode === 'private' ? '내부 전송' : '전송'}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                size="sm"
                                className={cn(
                                  'h-10 rounded-none rounded-r-xl border-l border-white/20 px-2 text-white',
                                  composerMode === 'private' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-neutral-950 hover:bg-neutral-800',
                                )}
                                disabled={!canReview || !selectedLead}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-2xl">
                              <DropdownMenuItem onClick={() => openComposerSendDialog('customer')}>
                                고객에게 답장 전송
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openComposerSendDialog('private')}>
                                내부용 메모 전송
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => openComposerSendDialog('customer', true)}>
                                전송 후 상담 종료
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            </>
          )}
        </Card>

        <aside className="space-y-4">
          {!selectedConversation ? (
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
                    ['고객', getConversationCustomerLabel(selectedConversation, selectedLead)],
                    ['연락처', selectedConversation.customer_phone || selectedLead?.customer_phone || '미확인'],
                    ['이메일', selectedConversation.customer_email || selectedLead?.customer_email || '미확인'],
                    ['UserChat', selectedConversation.user_chat_id],
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
                          value={selectedConversation.status}
                          onValueChange={(value) => updateConversation.mutate({ id: selectedConversation.id, updates: { status: value } })}
                        >
                          <SelectTrigger className="mt-1 h-9 rounded-xl">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {conversationStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">담당자</Label>
                        <Select
                          value={selectedConversation.assigned_to || 'none'}
                          onValueChange={(value) => updateConversation.mutate({ id: selectedConversation.id, updates: { assigned_to: value === 'none' ? null : value, assigned_at: value === 'none' ? null : new Date().toISOString(), assigned_by: value === 'none' ? null : user.id } })}
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
                          key={selectedConversation.id}
                          defaultValue={selectedConversation.memo || ''}
                          placeholder="상담 진행 메모"
                          className="mt-1 min-h-20 rounded-xl text-xs"
                          onBlur={(event) => {
                            if (event.target.value !== (selectedConversation.memo || '')) {
                              updateConversation.mutate({ id: selectedConversation.id, updates: { memo: event.target.value || null } });
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
                  {!selectedLead ? (
                    <p className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
                      이 상담에 연결된 AI 분석 리드가 없습니다.
                    </p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className={confidenceLabel(selectedLead.analysis?.confidence).className}>
                          {confidenceLabel(selectedLead.analysis?.confidence).label}
                        </Badge>
                        {selectedConversationLeads.length > 1 && (
                          <Badge variant="outline" className="border-neutral-300 bg-white text-neutral-700">
                            분석 {selectedConversationLeads.length}건
                          </Badge>
                        )}
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
                    </>
                  )}
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
                      value={selectedLead?.project_id || 'none'}
                      onValueChange={(value) => selectedLead && updateLead.mutate({ id: selectedLead.id, updates: { project_id: value === 'none' ? null : value, status: value === 'none' ? selectedLead.status : 'converted' } })}
                      disabled={!selectedLead}
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
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => selectedLead?.project_id && navigate(`/project-management?id=${selectedLead.project_id}`)} disabled={!selectedLead?.project_id}>
                    <LinkIcon className="h-3.5 w-3.5" />
                    연결 프로젝트 열기
                  </Button>
                  <Button size="sm" className="w-full gap-1.5 rounded-xl bg-neutral-950 text-white hover:bg-neutral-800" onClick={() => selectedLead && navigate(toQuoteDraftParams(selectedLead))} disabled={!selectedLead}>
                    <FileText className="h-3.5 w-3.5" />
                    견적 초안 만들기
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => selectedLead && navigate(toResponseAssistantParams(selectedLead))} disabled={!selectedLead}>
                    <Send className="h-3.5 w-3.5" />
                    응대 초안 만들기
                  </Button>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => selectedLead && openProjectDialog(selectedLead)} disabled={!selectedLead}>
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
                    {selectedLead?.channel_talk_file_keys?.length ? selectedLead.channel_talk_file_keys.map((key) => (
                      <div key={key} className="truncate rounded-lg border border-neutral-100 bg-neutral-50 px-2 py-1 font-mono text-[10px] text-muted-foreground">{key}</div>
                    )) : <p className="text-xs text-muted-foreground">첨부파일 키가 없습니다.</p>}
                  </div>
                  <Button variant="outline" size="sm" className="w-full gap-1.5 rounded-xl" onClick={() => selectedLead && copyMemo(selectedLead)} disabled={!selectedLead}>
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

      {canReview && pendingAssignConversation && (
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>상담 담당자 변경</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                현재 <span className="font-semibold">
                  {profiles.find((p) => p.id === pendingAssignConversation.assigned_to)?.full_name || '다른 담당자'}
                </span>
                가 담당 중입니다.
              </p>
              <p className="text-muted-foreground">이 상담의 메인 담당자를 나에게 변경할까요?</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>취소</Button>
              <Button
                className="bg-neutral-950 text-white hover:bg-neutral-800"
                onClick={() => {
                  handleAssignConversation(pendingAssignConversation, true);
                  setAssignDialogOpen(false);
                }}
                disabled={channelAction.isPending}
              >
                {channelAction.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                나에게 변경
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canReview && (
        <Dialog open={attachmentDialogOpen} onOpenChange={setAttachmentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>파일 및 이미지 링크 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                현재는 URL 첨부 방식입니다. Drive 파일, 이미지, PDF 링크를 넣으면 고객 메시지 하단에 첨부 링크로 표시됩니다.
              </div>
              <div>
                <Label>표시 이름</Label>
                <Input
                  value={attachmentName}
                  onChange={(event) => setAttachmentName(event.target.value)}
                  className="mt-1"
                  placeholder="예: 제작 도면 PDF"
                />
              </div>
              <div>
                <Label>파일/이미지 URL</Label>
                <Input
                  value={attachmentUrl}
                  onChange={(event) => setAttachmentUrl(event.target.value)}
                  className="mt-1"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAttachmentDialogOpen(false)}>취소</Button>
              <Button
                className="bg-neutral-950 text-white hover:bg-neutral-800"
                onClick={addAttachmentLink}
                disabled={!attachmentUrl.trim() || composerAttachmentLinks.length >= 5}
              >
                추가
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canReview && (
        <Dialog open={buttonDialogOpen} onOpenChange={setButtonDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>메시지 버튼 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                고객 메시지에는 외부 링크 버튼을 최대 2개까지 함께 전송할 수 있습니다.
              </div>
              <div>
                <Label>버튼 이름</Label>
                <Input
                  value={buttonTitle}
                  onChange={(event) => setButtonTitle(event.target.value)}
                  className="mt-1"
                  placeholder="예: 견적서 보기"
                />
              </div>
              <div>
                <Label>버튼 링크</Label>
                <Input
                  value={buttonUrl}
                  onChange={(event) => setButtonUrl(event.target.value)}
                  className="mt-1"
                  placeholder="https://..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setButtonDialogOpen(false)}>취소</Button>
              <Button
                className="bg-neutral-950 text-white hover:bg-neutral-800"
                onClick={addComposerButton}
                disabled={!buttonTitle.trim() || !buttonUrl.trim() || composerButtons.length >= 2}
              >
                추가
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
                  {(composerAttachmentLinks.length > 0 || composerButtons.length > 0) && (
                    <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-muted-foreground">
                      {composerAttachmentLinks.length > 0 && (
                        <p>첨부 링크 {composerAttachmentLinks.length}개는 본문 하단에 링크로 추가됩니다.</p>
                      )}
                      {composerButtons.length > 0 && (
                        <p>버튼 {composerButtons.length}개는 채널톡 메시지 버튼으로 함께 전송됩니다.</p>
                      )}
                    </div>
                  )}
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
                  conversationId: selectedConversation?.id,
                  leadId: selectedLead.id,
                  body: sendBody,
                  draftId: sendDraftId,
                  closeLead: closeAfterSend,
                  buttons: sendMode === 'customer' ? composerButtons.map((button) => ({ title: button.title, url: button.url })) : [],
                  attachmentLinks: composerAttachmentLinks.map((link) => ({ name: link.name, url: link.url })),
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
