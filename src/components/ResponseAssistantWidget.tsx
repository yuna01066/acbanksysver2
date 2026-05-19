import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleDollarSign, Clipboard, ClipboardPaste, Clock3, EyeOff, Gamepad2, MessageSquareText, MousePointerClick, Ruler, ShieldCheck, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tone = 'firm' | 'soft' | 'concise';
type WidgetMode = 'reply' | 'review' | 'quoteEmail';
type ReplyInputSource = 'scenario' | 'manual';

type Scenario = {
  label: string;
  message: string;
  context: string;
  icon: React.ComponentType<{ className?: string }>;
};

const scenarios: Scenario[] = [
  {
    label: '가격항의',
    message: '[고객명/고객사]에서 견적 금액이 예상보다 높아 진행이 어렵다는 의견을 주셨습니다. 이전에 확인한 시장 단가와 차이가 있어 산출 기준 설명이 필요한 상황입니다.',
    context: '[요청 사양] 기준으로 산출된 금액입니다. [가격 산정 근거]를 바탕으로 안내하고, 사양 변경 시 조정 가능 여부를 함께 검토할 수 있습니다.',
    icon: CircleDollarSign,
  },
  {
    label: '납기문의',
    message: '[고객명/고객사]에서 빠른 제작 가능 여부와 희망 납기 내 수령 가능 여부를 문의했습니다. 정확한 일정 안내와 진행 조건 확인이 필요합니다.',
    context: '제작 일정은 [사양 확정일], [선입금/발주 시점], 자재 수급, 가공 난이도에 따라 달라집니다. 무리한 확답보다 가능한 일정과 대안을 함께 제시합니다.',
    icon: Clock3,
  },
  {
    label: '사양 미확정',
    message: '[고객명/고객사]에서 이미지나 간단한 설명만으로 대략 견적을 문의했습니다. 제작 사양이 확정되지 않아 추가 확인이 필요한 상황입니다.',
    context: '정확한 견적 산출을 위해 [사이즈], [수량], [소재/두께], [색상], [가공 방식], [희망 납기], [배송/설치 여부] 확인이 필요합니다.',
    icon: Ruler,
  },
];

const toneLabels: Record<Tone, string> = {
  firm: '정중·단호',
  soft: '부드럽게',
  concise: '간결하게',
};

const MANUAL_REPLY_DRAFT_KEY = 'acbank-response-tool-manual-reply-draft';
const MANUAL_REPLY_DRAFT_TTL_MS = 30 * 60 * 1000;
const GUIDE_HIDDEN_UNTIL_KEY = 'acbank-response-tool-guide-hidden-until';
const GUIDE_HIDE_MS = 30 * 24 * 60 * 60 * 1000;

type ManualReplyDraft = {
  message: string;
  context: string;
  tone: Tone;
  savedAt: number;
};

function getResponseToolStorage() {
  if (typeof window === 'undefined') return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readManualReplyDraft() {
  const storage = getResponseToolStorage();
  if (!storage) return null;

  try {
    const rawDraft = storage.getItem(MANUAL_REPLY_DRAFT_KEY);
    if (!rawDraft) return null;

    const draft = JSON.parse(rawDraft) as Partial<ManualReplyDraft>;
    const savedAt = typeof draft.savedAt === 'number' ? draft.savedAt : 0;

    if (!savedAt || Date.now() - savedAt > MANUAL_REPLY_DRAFT_TTL_MS) {
      storage.removeItem(MANUAL_REPLY_DRAFT_KEY);
      return null;
    }

    return {
      message: typeof draft.message === 'string' ? draft.message : '',
      context: typeof draft.context === 'string' ? draft.context : '',
      tone: draft.tone === 'soft' || draft.tone === 'concise' || draft.tone === 'firm' ? draft.tone : 'firm',
      savedAt,
    };
  } catch {
    storage.removeItem(MANUAL_REPLY_DRAFT_KEY);
    return null;
  }
}

function writeManualReplyDraft(draft: Omit<ManualReplyDraft, 'savedAt'>) {
  const storage = getResponseToolStorage();
  if (!storage) return;

  const hasContent = draft.message.trim() || draft.context.trim();
  if (!hasContent) {
    storage.removeItem(MANUAL_REPLY_DRAFT_KEY);
    return;
  }

  try {
    storage.setItem(MANUAL_REPLY_DRAFT_KEY, JSON.stringify({
      ...draft,
      savedAt: Date.now(),
    }));
  } catch {
    storage.removeItem(MANUAL_REPLY_DRAFT_KEY);
  }
}

function isGuideHiddenForNow() {
  const storage = getResponseToolStorage();
  if (!storage) return false;

  const rawHiddenUntil = storage.getItem(GUIDE_HIDDEN_UNTIL_KEY);
  const hiddenUntil = rawHiddenUntil ? Number(rawHiddenUntil) : 0;

  if (!hiddenUntil || Number.isNaN(hiddenUntil)) {
    storage.removeItem(GUIDE_HIDDEN_UNTIL_KEY);
    return false;
  }

  if (Date.now() > hiddenUntil) {
    storage.removeItem(GUIDE_HIDDEN_UNTIL_KEY);
    return false;
  }

  return true;
}

function hideGuideFor30Days() {
  const storage = getResponseToolStorage();
  if (!storage) return;

  try {
    storage.setItem(GUIDE_HIDDEN_UNTIL_KEY, String(Date.now() + GUIDE_HIDE_MS));
  } catch {
    storage.removeItem(GUIDE_HIDDEN_UNTIL_KEY);
  }
}

const guideSteps: Array<{
  step: string;
  title: string;
  action: string;
  description: string;
  mode?: WidgetMode;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    step: '01',
    title: '받은 문의 입력',
    action: '붙여넣기 또는 상황 버튼 선택',
    description: '고객 원문과 내부 근거를 넣으면 톤별 답변 초안이 바로 바뀝니다.',
    mode: 'reply',
    icon: ClipboardPaste,
  },
  {
    step: '02',
    title: '발송 전 문안 검수',
    action: '보내려는 문안 붙여넣기',
    description: '위험 표현을 확인하고 정중·단호, 부드럽게, 간결하게 버전을 비교합니다.',
    mode: 'review',
    icon: ShieldCheck,
  },
  {
    step: '03',
    title: '견적 메일 작성',
    action: '[] 항목만 채우기',
    description: '고객사, 담당자, 견적 주요 내용을 넣으면 발송용 메일이 완성됩니다.',
    mode: 'quoteEmail',
    icon: Clipboard,
  },
  {
    step: '04',
    title: '복사 후 직접 발송',
    action: '직원이 최종 확인 후 사용',
    description: '자동 발송하지 않고 기존 이메일, 카카오, 문자, 채널톡에 붙여넣어 사용합니다.',
    icon: MousePointerClick,
  },
];

const modeMeta: Record<WidgetMode, { step: string; title: string; description: string }> = {
  reply: {
    step: '1',
    title: '답변 작성',
    description: '받은 문의와 내부 근거로 응대 초안을 만듭니다.',
  },
  review: {
    step: '2',
    title: '문안 검수',
    description: '보내기 전 문안을 톤별로 다듬고 위험 표현을 확인합니다.',
  },
  quoteEmail: {
    step: '3',
    title: '견적 메일',
    description: '견적서 발송용 이메일 템플릿을 빠르게 작성합니다.',
  },
};

function detectRisk(message: string) {
  if (/법적|소송|환불|배상|책임|신고|고발/.test(message)) return { label: '검수 필요', className: 'border-red-200 bg-red-50 text-red-700' };
  if (/비싸|가격|단가|항의|불만|거래할 수 없는|납득|터무니/.test(message)) return { label: '검수 권장', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { label: '일반', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
}

function buildDraft(message: string, context: string, tone: Tone) {
  const isPrice = /비싸|가격|단가|견적|거래할 수 없는|평균/.test(message);
  const isSchedule = /납기|빨리|이번 주|급/.test(message);

  if (tone === 'concise') {
    return [
      '안녕하세요.',
      '',
      '문의 주신 내용 확인했습니다.',
      isPrice
        ? '이번 견적은 평균 단가라기보다 요청 사양과 제작 방식 기준으로 산출된 금액입니다.'
        : isSchedule
          ? '납기는 제작 사양 확정 후 정확히 안내드릴 수 있습니다.'
          : '정확한 검토를 위해 제작 조건을 몇 가지 확인 부탁드립니다.',
      context ? `내부 산정 기준상 ${context} 부분이 반영되어 있습니다.` : '',
      '',
      '가능한 조정 방향이 있다면 함께 검토드리겠습니다.',
      '감사합니다.',
    ].filter(Boolean).join('\n');
  }

  if (tone === 'soft') {
    return [
      '안녕하세요.',
      '',
      '먼저 검토 의견 주셔서 감사합니다. 말씀 주신 부분처럼 금액이나 일정이 부담스럽게 느껴지실 수 있다는 점 충분히 이해하고 있습니다.',
      '',
      isPrice
        ? '다만 이번 금액은 일반적인 평균 단가라기보다는 요청 주신 사양과 제작 방식에 따라 산출된 금액입니다.'
        : isSchedule
          ? '다만 제작 품질과 일정 안정성을 함께 고려해야 해서, 확정 전 무리하게 가능 여부를 말씀드리기보다는 조건 확인 후 정확히 안내드리는 것이 좋을 것 같습니다.'
          : '현재 정보만으로는 정확한 단가 안내가 어려워, 몇 가지 조건을 확인한 뒤 검토드리는 것이 좋을 것 같습니다.',
      context ? `특히 ${context} 부분이 산정에 영향을 주고 있습니다.` : '',
      '',
      '조건 조정으로 비용이나 일정을 맞출 수 있는 방향이 있다면 저희도 함께 검토해 보겠습니다.',
      '감사합니다.',
    ].filter(Boolean).join('\n');
  }

  return [
    '안녕하세요.',
    '',
    '문의 주신 내용 확인했습니다. 말씀 주신 우려는 충분히 이해하고 있습니다.',
    '',
    isPrice
      ? '다만 이번 견적은 시장의 평균 단가로 단순 비교하기보다는, 요청 주신 사양과 제작 방식 기준으로 산출된 금액으로 봐주시는 것이 맞습니다.'
      : isSchedule
        ? '다만 납기는 제작 사양 확정, 자재 수급, 가공 방식에 따라 달라질 수 있어 현재 단계에서 확정 안내드리기는 어렵습니다.'
        : '정확한 견적 검토를 위해서는 제작 사양이 먼저 확정되어야 합니다.',
    context ? `내부 산정 기준상 ${context} 내용이 반영되어 있습니다.` : '',
    '',
    '가능한 범위에서 조정할 수 있는 사양이나 대안이 있다면 함께 검토드리겠습니다.',
    '감사합니다.',
  ].filter(Boolean).join('\n');
}

function reviewOutgoingText(text: string) {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let reviewed = text.trim();

  if (!reviewed) {
    return {
      issues,
      suggestions,
      reviewed: '',
    };
  }

  const replacements: Array<[RegExp, string, string]> = [
    [/터무니없(?:는|습니다)?/g, '산정 기준과 차이가 있습니다', '감정적으로 들릴 수 있는 표현을 객관적인 기준 표현으로 바꿉니다.'],
    [/불가능합니다/g, '현재 조건에서는 진행이 어렵습니다', '단정적인 거절보다 조건 기준의 어려움으로 설명합니다.'],
    [/안 됩니다/g, '진행이 어렵습니다', '상대가 거절당한다고 느끼는 표현을 완화합니다.'],
    [/무조건/g, '현재 확인된 기준으로는', '확정·절대 표현은 분쟁 가능성이 있어 줄입니다.'],
    [/당연히/g, '해당 기준상', '상대의 이해 부족처럼 들릴 수 있는 표현을 피합니다.'],
    [/저희도 어쩔 수 없습니다/g, '내부 기준상 조정 가능한 범위를 확인해 보겠습니다', '책임 회피처럼 보이는 표현을 대안 제시로 바꿉니다.'],
  ];

  replacements.forEach(([pattern, replacement, reason]) => {
    if (pattern.test(reviewed)) {
      issues.push(reason);
      reviewed = reviewed.replace(pattern, replacement);
    }
  });

  if (!/감사|검토|문의|말씀/.test(reviewed)) {
    suggestions.push('첫 문장에 검토 감사 또는 문의 확인 문구를 넣으면 응대 톤이 부드러워집니다.');
    reviewed = `문의 주신 내용 확인했습니다.\n\n${reviewed}`;
  }

  if (/비싸|단가|가격|견적/.test(reviewed) && !/사양|산정|기준|공정|원자재/.test(reviewed)) {
    suggestions.push('가격 관련 답변에는 단순 방어보다 사양, 공정, 원자재 등 산정 근거를 함께 넣는 것이 좋습니다.');
  }

  if (!/조정|대안|검토|확인/.test(reviewed)) {
    suggestions.push('마지막에 조정 가능 범위나 다음 확인 사항을 제시하면 대화가 닫히지 않습니다.');
    reviewed = `${reviewed}\n\n조정 가능한 사양이나 대안이 있다면 함께 검토드리겠습니다.`;
  }

  return {
    issues: [...new Set(issues)],
    suggestions: [...new Set(suggestions)],
    reviewed,
  };
}

function buildReviewedTone(baseText: string, tone: Tone) {
  const { reviewed } = reviewOutgoingText(baseText);
  const body = reviewed || '검수할 문안을 입력하세요.';

  if (tone === 'concise') {
    return body
      .replace('문의 주신 내용 확인했습니다.\n\n', '안녕하세요.\n문의 주신 내용 확인했습니다.\n')
      .replace('조정 가능한 사양이나 대안이 있다면 함께 검토드리겠습니다.', '조정 가능한 사양이 있다면 검토드리겠습니다.')
      .replace(/\n{3,}/g, '\n\n');
  }

  if (tone === 'soft') {
    return [
      '안녕하세요.',
      '',
      '먼저 문의 주시고 검토 의견 전달해 주셔서 감사합니다.',
      body
        .replace(/^안녕하세요\.\n?/, '')
        .replace(/^문의 주신 내용 확인했습니다\.\n\n?/, '')
        .trim(),
      '',
      '고객님 입장에서 부담되실 수 있는 부분은 충분히 이해하고 있으며, 가능한 범위에서 대안을 함께 확인해 보겠습니다.',
      '감사합니다.',
    ].filter(Boolean).join('\n');
  }

  return [
    '안녕하세요.',
    '',
    body
      .replace(/^안녕하세요\.\n?/, '')
      .replace(/^문의 주신 내용 확인했습니다\.\n\n?/, '문의 주신 내용 확인했습니다.\n\n')
      .trim(),
    '',
    '다만 최종 진행 가능 여부는 확정 사양과 내부 기준에 따라 검토 후 안내드리겠습니다.',
    '감사합니다.',
  ].filter(Boolean).join('\n');
}

function buildQuoteEmail(input: {
  company: string;
  contact: string;
  quoteSummary: string;
  note: string;
}) {
  const greetingName = input.contact.trim() || '[고객 담당자명]';
  return [
    `${greetingName} 안녕하세요.`,
    '아크뱅크 담당자 [직원이름]입니다.',
    '',
    `[${input.company.trim() || '고객사명'}]에서 문의 주신 내용 기준으로 견적서 전달드립니다.`,
    '',
    input.quoteSummary.trim()
      ? `[견적 주요 내용]\n${input.quoteSummary.trim()}`
      : '[견적 주요 내용]\n- 품목: \n- 수량: \n- 제작 사양: ',
    '',
    input.note.trim()
      ? `[참고 사항]\n${input.note.trim()}`
      : '[참고 사항]\n제작 일정은 [사양 확정일] 및 [결제/발주 진행 시점]에 따라 달라질 수 있습니다.',
    '',
    '견적서 확인 후 궁금하신 점이나 조정이 필요한 사양이 있으시면 편하게 말씀 부탁드립니다.',
    '견적 내용 확인 후 진행을 희망하실 경우, 선입금 진행과 함께 회신 주시면 제작 가능 일정 및 이후 절차를 이어서 안내드리겠습니다.',
    '',
    '감사합니다.',
    '아크뱅크 [직원이름] 드림',
  ].join('\n');
}

type ResponseAssistantWidgetProps = {
  className?: string;
  embedded?: boolean;
  autoGuide?: boolean;
};

const ResponseAssistantWidget: React.FC<ResponseAssistantWidgetProps> = ({ className, embedded = false, autoGuide = true }) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<WidgetMode>('reply');
  const [message, setMessage] = useState(scenarios[0].message);
  const [context, setContext] = useState('');
  const [tone, setTone] = useState<Tone>('firm');
  const [replyInputSource, setReplyInputSource] = useState<ReplyInputSource>('scenario');
  const [reviewTone, setReviewTone] = useState<Tone>('firm');
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStep, setGuideStep] = useState(0);
  const [outgoingText, setOutgoingText] = useState('');
  const [quoteCompany, setQuoteCompany] = useState('[고객사명]');
  const [quoteContact, setQuoteContact] = useState('[고객 담당자명]님');
  const [quoteSummary, setQuoteSummary] = useState('- 품목: [품목명]\n- 수량: [수량]\n- 제작 사양: [주요 제작 사양]');
  const [quoteNote, setQuoteNote] = useState('견적 금액은 [요청 사양]과 [제작 방식] 기준으로 산출되었습니다. 사양 변경이 필요한 경우 조정 가능 여부를 함께 검토드릴 수 있습니다.');

  const risk = useMemo(() => detectRisk(message), [message]);
  const draft = useMemo(() => buildDraft(message, context, tone), [message, context, tone]);
  const review = useMemo(() => reviewOutgoingText(outgoingText), [outgoingText]);
  const reviewedToneText = useMemo(() => buildReviewedTone(outgoingText, reviewTone), [outgoingText, reviewTone]);
  const quoteEmail = useMemo(() => buildQuoteEmail({
    company: quoteCompany,
    contact: quoteContact,
    quoteSummary,
    note: quoteNote,
  }), [quoteCompany, quoteContact, quoteSummary, quoteNote]);

  useEffect(() => {
    if (replyInputSource !== 'manual') return;

    writeManualReplyDraft({ message, context, tone });
  }, [context, message, replyInputSource, tone]);

  useEffect(() => {
    if (!autoGuide) return;
    if (isGuideHiddenForNow()) return;

    const guideTimer = window.setTimeout(() => {
      setGuideOpen(true);
    }, 650);

    return () => window.clearTimeout(guideTimer);
  }, [autoGuide]);

  const currentGuideStep = guideSteps[guideStep];
  const CurrentGuideIcon = currentGuideStep.icon;

  const openFullAssistant = () => {
    const params = new URLSearchParams({
      source_channel: 'email',
      inquiry_type: /가격|단가|견적|비싸/.test(message) ? 'price_objection' : 'general',
      customer_message: message,
      internal_context: context,
    });
    navigate(`/response-assistant?${params.toString()}`);
  };

  const copyDraft = async () => {
    const text = mode === 'reply' ? draft : mode === 'review' ? reviewedToneText : quoteEmail;
    await navigator.clipboard.writeText(text);
    toast.success(mode === 'reply' ? '위젯 초안이 복사되었습니다.' : mode === 'review' ? '검수된 문안이 복사되었습니다.' : '견적 발송 이메일이 복사되었습니다.');
  };

  const startManualReplyInput = () => {
    const savedDraft = readManualReplyDraft();

    setReplyInputSource('manual');

    if (savedDraft && (savedDraft.message.trim() || savedDraft.context.trim())) {
      setMessage(savedDraft.message);
      setContext(savedDraft.context);
      setTone(savedDraft.tone);
      toast.success('작성 중이던 내용을 불러왔습니다.');
      return;
    }

    setMessage('');
    setContext('');
    setTone('firm');
    toast.success('받은 내용을 직접 입력할 수 있게 비웠습니다.');
  };

  const openGuide = () => {
    setGuideStep(0);
    setGuideOpen(true);
  };

  const closeGuideFor30Days = () => {
    hideGuideFor30Days();
    setGuideOpen(false);
    toast.success('30일간 사용 방법 자동 안내를 숨깁니다.');
  };

  const moveToGuideMode = () => {
    if (currentGuideStep.mode) {
      setMode(currentGuideStep.mode);
    }
    setGuideOpen(false);
  };

  const inputClass = 'resize-none rounded-2xl border-[#dedede] bg-white text-[13px] leading-relaxed text-[#111111] shadow-none placeholder:text-[#9e9ea0] focus-visible:ring-1 focus-visible:ring-[#111111] focus-visible:ring-offset-0';
  const outputClass = 'whitespace-pre-wrap rounded-2xl border border-[#dedede] bg-white p-4 text-[13px] leading-relaxed text-[#111111]';
  const softPanelClass = 'rounded-2xl border border-[#e5e5e5] bg-white p-4';
  const tabClass = 'rounded-full px-3 py-1.5 text-xs font-semibold text-[#707072] data-[state=active]:bg-[#111111] data-[state=active]:text-white data-[state=active]:shadow-none';

  return (
    <>
    <Card className={cn('overflow-hidden rounded-[28px] border border-[#dedede] bg-white shadow-[0_2px_10px_rgba(0,0,0,0.04)]', className)}>
      <CardContent className="space-y-5 p-0">
        <div className="border-b border-[#dedede] px-4 py-7 text-center">
          <div className="space-y-2 text-center">
            <p
              className="text-[30px] font-black uppercase leading-none tracking-[-0.01em] text-[#111111] sm:text-[38px]"
              style={{ fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Arial Black", sans-serif', fontWeight: 900 }}
            >
              ACBANK
            </p>
            <p
              className="text-[15px] font-semibold uppercase leading-none tracking-[0.08em] text-[#111111] sm:text-[17px]"
              style={{ fontFamily: '"Apple SD Gothic Neo", "Pretendard", "Noto Sans KR", sans-serif' }}
            >
              RESPONSE TOOL
            </p>
          </div>
          <button
            type="button"
            onClick={openGuide}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-full border border-[#dedede] bg-[#fafafa] px-5 text-sm font-bold text-[#39393b] transition-colors hover:border-[#111111] hover:bg-white"
          >
            <Gamepad2 className="h-4 w-4" />
            사용 방법
          </button>
        </div>

        <div className="px-4 text-center sm:px-7">
          <h3 className="text-xl font-black tracking-tight text-[#111111] sm:text-2xl">
            상담 응대 시작하기
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-xs font-bold leading-relaxed text-[#707072] sm:text-sm">
            받은 문의, 발송 전 문안, 견적 메일을 한 화면에서 빠르게 작성하고 비교합니다.
          </p>
        </div>

        <Tabs value={mode} onValueChange={(value) => setMode(value as WidgetMode)} className="px-4 sm:px-7">
          <TabsList className="grid h-auto gap-2 rounded-2xl border border-[#dedede] bg-[#f5f5f5] p-2 sm:grid-cols-2">
            {(Object.keys(modeMeta) as WidgetMode[]).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="group block h-auto rounded-xl border border-[#e5e5e5] bg-white p-3 text-left shadow-none transition-colors data-[state=active]:border-[#111111] data-[state=active]:bg-white data-[state=active]:shadow-none"
              >
                <span className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#8f8f8f] text-sm font-black text-white group-data-[state=active]:bg-[#111111]">
                    {modeMeta[key].step}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black leading-tight text-[#39393b] group-data-[state=active]:text-[#111111]">
                      {modeMeta[key].title}
                    </span>
                    <span className="mt-1 block whitespace-nowrap text-[10px] font-bold leading-tight text-[#9e9ea0] group-data-[state=active]:text-[#707072]">
                      {modeMeta[key].description}
                    </span>
                  </span>
                </span>
              </TabsTrigger>
            ))}
            <div className="flex min-h-[86px] items-start gap-3 rounded-xl border border-dashed border-[#cacacb] bg-white/55 p-3 text-left opacity-70">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d8d8d8] text-sm font-black text-white">
                4
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight text-[#9e9ea0]">
                  추가 예정
                </span>
                <span className="mt-1 block whitespace-nowrap text-[10px] font-bold leading-tight text-[#b1b1b3]">
                  다음 응대 기능을 이 영역에 추가합니다.
                </span>
              </span>
            </div>
          </TabsList>

          <TabsContent value="reply" className="mt-4 space-y-4">
            <div className="rounded-[18px] border border-[#dedede] bg-[#fafafa] p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedede] bg-white">
                    <MessageSquareText className="h-4 w-4 text-[#111111]" />
                  </span>
                  <p className="text-sm font-black text-[#39393b]">받은 내용 입력</p>
                </div>
                <Badge variant="outline" className={cn('shrink-0 rounded-full border-[#cacacb] bg-white px-2.5 py-1 text-[10px]', risk.className)}>
                  {risk.label}
                </Badge>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={startManualReplyInput}
                  className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-[#cacacb] bg-white px-2.5 text-[11px] font-semibold text-[#39393b] transition-colors hover:border-[#111111] hover:bg-[#f5f5f5]"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f5f5] text-[#39393b] group-hover:bg-[#111111] group-hover:text-white">
                    <ClipboardPaste className="h-3 w-3" />
                  </span>
                  <span>받은 내용 붙여넣기</span>
                </button>
                {scenarios.map((scenario) => {
                  const Icon = scenario.icon;
                  return (
                    <button
                      key={scenario.label}
                      type="button"
                      className="group inline-flex h-8 items-center gap-1.5 rounded-full border border-[#cacacb] bg-white px-2.5 text-[11px] font-semibold text-[#39393b] transition-colors hover:border-[#111111] hover:bg-[#f5f5f5]"
                      onClick={() => {
                        setReplyInputSource('scenario');
                        setMessage(scenario.message);
                        setContext(scenario.context);
                        setTone('firm');
                      }}
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#f5f5f5] text-[#39393b] group-hover:bg-[#111111] group-hover:text-white">
                        <Icon className="h-3 w-3" />
                      </span>
                      <span>{scenario.label}</span>
                    </button>
                  );
                })}
              </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  className={cn(inputClass, 'min-h-28')}
                  placeholder="고객 문의 원문"
                />
                <Textarea
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  className={cn(inputClass, 'min-h-20')}
                  placeholder="내부 근거 메모"
                />
              </div>

              <div className="space-y-2">
                <Tabs value={tone} onValueChange={(value) => setTone(value as Tone)}>
                  <TabsList className="grid h-auto grid-cols-3 gap-1 rounded-full bg-[#f5f5f5] p-1">
                    {(Object.keys(toneLabels) as Tone[]).map((key) => (
                      <TabsTrigger key={key} value={key} className={tabClass}>
                        {toneLabels[key]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value={tone} className="mt-2">
                    <div className={cn(outputClass, 'min-h-48')}>
                      {draft}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            </div>
          </TabsContent>

          <TabsContent value="review" className="mt-4">
            <div className="rounded-[18px] border border-[#dedede] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[#39393b]">발송 전 문안 검수</p>
              <Badge variant="outline" className="rounded-full border-[#cacacb] bg-white px-2.5 py-1 text-[10px] text-[#707072]">
                톤별 비교
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Textarea
                value={outgoingText}
                onChange={(event) => setOutgoingText(event.target.value)}
                className={cn(inputClass, 'min-h-64')}
                placeholder="고객에게 보내기 전 문안을 붙여넣으세요."
              />
              <div className="space-y-3">
                <Tabs value={reviewTone} onValueChange={(value) => setReviewTone(value as Tone)}>
                  <TabsList className="grid h-auto grid-cols-3 gap-1 rounded-full bg-[#f5f5f5] p-1">
                    {(Object.keys(toneLabels) as Tone[]).map((key) => (
                      <TabsTrigger key={key} value={key} className={tabClass}>
                        {toneLabels[key]}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <TabsContent value={reviewTone} className="mt-2">
                    <div className={cn(outputClass, 'min-h-40')}>
                      {reviewedToneText}
                    </div>
                  </TabsContent>
                </Tabs>
                <div className="grid gap-2">
                  <div className={softPanelClass}>
                    <p className="text-[11px] font-semibold text-[#707072]">주의할 표현</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.issues.length ? review.issues.map((item) => (
                        <Badge key={item} variant="outline" className="rounded-full border-[#cacacb] bg-white text-[10px] text-[#39393b]">{item}</Badge>
                      )) : <span className="text-xs text-[#707072]">큰 위험 표현은 보이지 않습니다.</span>}
                    </div>
                  </div>
                  <div className={softPanelClass}>
                    <p className="text-[11px] font-semibold text-[#707072]">보완 제안</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {review.suggestions.length ? review.suggestions.map((item) => (
                        <Badge key={item} variant="outline" className="rounded-full border-[#cacacb] bg-white text-[10px] text-[#39393b]">{item}</Badge>
                      )) : <span className="text-xs text-[#707072]">현재 문안 흐름이 무난합니다.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </TabsContent>

          <TabsContent value="quoteEmail" className="mt-4">
            <div className="rounded-[18px] border border-[#dedede] bg-[#fafafa] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm font-black text-[#39393b]">견적 발송 정보</p>
              <Badge variant="outline" className="rounded-full border-[#cacacb] bg-white px-2.5 py-1 text-[10px] text-[#707072]">
                [] 항목 수정
              </Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Textarea
                    value={quoteCompany}
                    onChange={(event) => setQuoteCompany(event.target.value)}
                    className={cn(inputClass, 'min-h-16')}
                    placeholder="고객사"
                  />
                  <Textarea
                    value={quoteContact}
                    onChange={(event) => setQuoteContact(event.target.value)}
                    className={cn(inputClass, 'min-h-16')}
                    placeholder="담당자 호칭"
                  />
                </div>
                <Textarea
                  value={quoteSummary}
                  onChange={(event) => setQuoteSummary(event.target.value)}
                  className={cn(inputClass, 'min-h-32')}
                  placeholder="견적 주요 내용"
                />
                <Textarea
                  value={quoteNote}
                  onChange={(event) => setQuoteNote(event.target.value)}
                  className={cn(inputClass, 'min-h-24')}
                  placeholder="참고 사항"
                />
              </div>
              <div className={cn(outputClass, 'min-h-72')}>
                {quoteEmail}
              </div>
            </div>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex flex-col items-center gap-3 px-4 pb-7 pt-1 sm:px-7">
          <Button type="button" onClick={copyDraft} className="h-14 min-w-[240px] gap-2 rounded-full bg-[#111111] px-8 text-base font-black text-white shadow-none hover:bg-[#111111]/80">
            <Clipboard className="h-4 w-4" />
            {mode === 'reply' ? '초안 복사' : mode === 'review' ? '검수 문안 복사' : '이메일 템플릿 복사'}
          </Button>
          {!embedded && (
            <Button type="button" variant="outline" onClick={openFullAssistant} className="h-10 gap-2 rounded-full border-[#cacacb] bg-white px-5 text-sm font-bold text-[#9e9ea0] shadow-none hover:bg-[#f5f5f5]">
              <Sparkles className="h-4 w-4" />
              정식 생성으로 열기
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
    <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
      <DialogContent className="max-h-[92vh] overflow-hidden rounded-[28px] border-[#dedede] bg-white p-0 shadow-[0_18px_60px_rgba(0,0,0,0.18)] sm:max-w-[720px]">
        <DialogHeader className="border-b border-[#e5e5e5] px-5 py-5 text-center sm:px-7 sm:text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#111111] text-white shadow-[0_0_0_8px_rgba(17,17,17,0.06)]">
            <Gamepad2 className="h-5 w-5" />
          </div>
          <DialogTitle className="text-center text-2xl font-black tracking-tight text-[#111111]">
            사용 방법 가이드
          </DialogTitle>
          <DialogDescription className="mx-auto max-w-md text-center text-xs font-semibold leading-relaxed text-[#707072]">
            게임 튜토리얼처럼 단계별로 눌러보며 상담 응대 흐름을 확인합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto bg-[#f5f5f5] px-5 py-5 sm:px-7">
          <div className="rounded-3xl border border-[#dedede] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#111111] text-sm font-black text-white">
                  <span className="absolute inset-0 rounded-full bg-[#111111] opacity-20 animate-ping" />
                  <span className="relative">{currentGuideStep.step}</span>
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#9e9ea0]">
                    Mission Step
                  </p>
                  <p className="mt-1 text-lg font-black leading-tight text-[#111111]">
                    {currentGuideStep.title}
                  </p>
                </div>
              </div>
              <span className="hidden rounded-full border border-[#dedede] bg-[#fafafa] px-3 py-1 text-[11px] font-bold text-[#707072] sm:inline-flex">
                {guideStep + 1} / {guideSteps.length}
              </span>
            </div>

            <div className="mt-4 rounded-2xl border border-[#e5e5e5] bg-[#fafafa] p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#dedede] bg-white">
                  <CurrentGuideIcon className="h-4 w-4 text-[#111111]" />
                </span>
                <div>
                  <p className="text-sm font-black text-[#39393b]">{currentGuideStep.action}</p>
                  <p className="mt-1 text-xs font-semibold leading-relaxed text-[#707072]">
                    {currentGuideStep.description}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-4 gap-2">
              {guideSteps.map((step, index) => (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => setGuideStep(index)}
                  className={cn(
                    'h-2 rounded-full transition-colors',
                    index === guideStep ? 'bg-[#111111]' : 'bg-[#dedede] hover:bg-[#9e9ea0]',
                  )}
                  aria-label={`${step.title} 단계 보기`}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {guideSteps.map((step, index) => {
              const Icon = step.icon;
              return (
                <button
                  key={step.step}
                  type="button"
                  onClick={() => setGuideStep(index)}
                  className={cn(
                    'flex items-start gap-3 rounded-2xl border bg-white p-3 text-left transition-colors',
                    index === guideStep ? 'border-[#111111]' : 'border-[#e5e5e5] hover:border-[#cacacb]',
                  )}
                >
                  <span className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                    index === guideStep ? 'bg-[#111111] text-white' : 'bg-[#f5f5f5] text-[#707072]',
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-black text-[#39393b]">{step.step}. {step.title}</span>
                    <span className="mt-1 block text-[11px] font-semibold leading-snug text-[#9e9ea0]">{step.action}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#e5e5e5] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button
            type="button"
            variant="outline"
            onClick={closeGuideFor30Days}
            className="h-10 gap-2 rounded-full border-[#cacacb] bg-white px-4 text-xs font-bold text-[#707072] shadow-none hover:bg-[#f5f5f5]"
          >
            <EyeOff className="h-4 w-4" />
            30일간 보지 않기
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuideStep((step) => Math.max(0, step - 1))}
              disabled={guideStep === 0}
              className="h-10 w-10 rounded-full border-[#cacacb] bg-white p-0 shadow-none disabled:opacity-35"
              aria-label="이전 단계"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {guideStep < guideSteps.length - 1 ? (
              <Button
                type="button"
                onClick={() => setGuideStep((step) => Math.min(guideSteps.length - 1, step + 1))}
                className="h-10 gap-2 rounded-full bg-[#111111] px-5 text-sm font-black text-white shadow-none hover:bg-[#111111]/80"
              >
                다음
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={moveToGuideMode}
                className="h-10 gap-2 rounded-full bg-[#111111] px-5 text-sm font-black text-white shadow-none hover:bg-[#111111]/80"
              >
                시작하기
                <MousePointerClick className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
};

export default ResponseAssistantWidget;
