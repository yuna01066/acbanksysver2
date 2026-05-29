import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ChevronRight, HelpCircle, Loader2, RotateCcw, Settings2, X } from 'lucide-react';
import hamzziCelebration from '@/assets/hamzzi/hamzzi_celebration.png';
import hamzziCheck from '@/assets/hamzzi/hamzzi_check.png';
import hamzziCoffee from '@/assets/hamzzi/hamzzi_coffee.png';
import hamzziQuoteStreak from '@/assets/hamzzi/hamzzi_quote_streak.png';
import hamzziSleepy from '@/assets/hamzzi/hamzzi_sleepy.png';
import hamzziThinking from '@/assets/hamzzi/hamzzi_thinking.png';
import acriHeadsetBubbleSpritesheet from '@/assets/hamzzi/acri-headset-bubble-loop-spritesheet.webp';
import acriRedPencilCheckSpritesheet from '@/assets/hamzzi/acri-red-pencil-check-spritesheet.webp';
import acriWizardMagicSpritesheet from '@/assets/hamzzi/acri-wizard-magic-loop-spritesheet.webp';
import iconLunch from '@/assets/hamzzi/icon_lunch.png';
import iconNight from '@/assets/hamzzi/icon_night.png';
import iconParty from '@/assets/hamzzi/icon_party.png';
import defaultResponseAssistantIcon from '@/assets/response-assistant-default-icon.png';
import responseAssistantSpeechBubble from '@/assets/response-assistant-speech-bubble.png';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import QuoteWizardPanel from '@/components/QuoteWizardPanel';
import ResponseAssistantWidget from '@/components/ResponseAssistantWidget';
import { useAuth } from '@/contexts/AuthContext';
import { useAssistantShortcuts, type AssistantEmbeddedTool, type AssistantShortcutItem } from '@/hooks/useAssistantShortcuts';
import { useNotifications } from '@/hooks/useNotifications';
import { toneClasses, useTodayWorkItems } from '@/hooks/useTodayWorkItems';
import { supabase } from '@/integrations/supabase/client';
import {
  HAMZZI_EVENT_NAME,
  registerHamzziLauncherClick,
  triggerTimedHamzziIfNeeded,
  type HamzziEventDetail,
  type HamzziEventType,
} from '@/lib/hamzziEvents';
import { RESPONSE_ASSISTANT_ICON_SETTING_KEY } from '@/lib/responseAssistantDefaults';
import { cn } from '@/lib/utils';

const HIDDEN_PATHS = [
  '/auth',
  '/forgot-password',
  '/customer-quote',
  '/customer-quotes-summary',
  '/quote',
  '/embed-code',
];

const FLOATING_RESPONSE_ASSISTANT_OPEN_KEY = 'acbank:floating-response-assistant-open';

type AssistantTool = 'menu' | AssistantEmbeddedTool;
type SpecialistTool = AssistantEmbeddedTool;

type HamzziReactionConfig = {
  image: string;
  badge?: string;
  fallbackMessage: string;
  toneClass: string;
};

type HamzziSpriteConfig = {
  image: string;
  frameWidth: number;
  frameHeight: number;
  displayWidth: number;
  displayHeight: number;
  className: string;
  label: string;
};

const TOOL_META: Record<AssistantTool, { title: string; description: string }> = {
  menu: {
    title: '햄찌 도우미',
    description: '오늘 할 일 · 개인 바로가기',
  },
  responseAssistant: {
    title: '상담 CS',
    description: '답변 작성 · 문안 검수 · 견적 메일',
  },
  quoteWizard: {
    title: '견적 마법사',
    description: '파일 분석 · 수율 참고 · 임시 초안',
  },
  meetingBooking: {
    title: '상담/미팅 예약',
    description: '직원 미팅 · 클라이언트 상담 일정',
  },
};

const HAMZZI_REACTION_CONFIG: Record<HamzziEventType, HamzziReactionConfig> = {
  quote_issued: {
    image: hamzziCelebration,
    badge: iconParty,
    fallbackMessage: '견적서 발행 완료. 오늘도 한 건 처리했습니다.',
    toneClass: 'border-blue-100 bg-white/95',
  },
  quote_streak_5: {
    image: hamzziQuoteStreak,
    badge: iconParty,
    fallbackMessage: '오늘 견적 페이스 좋습니다.',
    toneClass: 'border-amber-100 bg-white/95',
  },
  attendance_check_in: {
    image: hamzziCheck,
    fallbackMessage: '출근 기록 완료. 오늘 업무 시작합니다.',
    toneClass: 'border-emerald-100 bg-white/95',
  },
  attendance_check_out: {
    image: hamzziSleepy,
    fallbackMessage: '퇴근 기록 완료. 오늘 기록 저장됐습니다.',
    toneClass: 'border-slate-100 bg-white/95',
  },
  lunch_time: {
    image: hamzziCoffee,
    badge: iconLunch,
    fallbackMessage: '점심시간입니다. 잠깐 쉬어가세요.',
    toneClass: 'border-orange-100 bg-white/95',
  },
  late_night: {
    image: hamzziSleepy,
    badge: iconNight,
    fallbackMessage: '늦은 시간입니다. 마무리할 업무만 확인하세요.',
    toneClass: 'border-indigo-100 bg-white/95',
  },
  hidden_click: {
    image: hamzziThinking,
    fallbackMessage: '숨겨진 햄찌 반응을 찾았습니다.',
    toneClass: 'border-violet-100 bg-white/95',
  },
};

const HAMZZI_TOOL_SPRITES: Record<SpecialistTool, HamzziSpriteConfig> = {
  responseAssistant: {
    image: acriHeadsetBubbleSpritesheet,
    frameWidth: 320,
    frameHeight: 256,
    displayWidth: 136,
    displayHeight: 109,
    className: '-bottom-3 -right-2',
    label: '헤드셋 햄찌',
  },
  quoteWizard: {
    image: acriWizardMagicSpritesheet,
    frameWidth: 256,
    frameHeight: 256,
    displayWidth: 96,
    displayHeight: 96,
    className: '-bottom-1 -right-1',
    label: '마법사 햄찌',
  },
  meetingBooking: {
    image: acriRedPencilCheckSpritesheet,
    frameWidth: 320,
    frameHeight: 256,
    displayWidth: 136,
    displayHeight: 109,
    className: '-bottom-3 -right-2',
    label: '예약 체크 햄찌',
  },
};

const TOOL_TRANSITION_MS = 620;

const isHiddenPath = (pathname: string) => (
  HIDDEN_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
);

const readStoredOpenState = () => {
  if (typeof window === 'undefined') return false;

  try {
    return window.sessionStorage.getItem(FLOATING_RESPONSE_ASSISTANT_OPEN_KEY) === 'true';
  } catch {
    return false;
  }
};

const isSupportedIconValue = (value?: string | null) => (
  typeof value === 'string'
  && (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(value) || value.startsWith('/'))
);

const FloatingResponseAssistant: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, isAdmin } = useAuth();
  const [open, setOpen] = useState(readStoredOpenState);
  const [activeTool, setActiveTool] = useState<AssistantTool>('menu');
  const [guideOpenSignal, setGuideOpenSignal] = useState(0);
  const [launcherHintVisible, setLauncherHintVisible] = useState(false);
  const [transitionTool, setTransitionTool] = useState<SpecialistTool | null>(null);
  const [hamzziReaction, setHamzziReaction] = useState<(HamzziEventDetail & { id: number }) | null>(null);
  const hamzziTimerRef = useRef<number | null>(null);
  const toolTransitionTimerRef = useRef<number | null>(null);

  const isHidden = isHiddenPath(location.pathname);
  const hamzziReactionConfig = hamzziReaction ? HAMZZI_REACTION_CONFIG[hamzziReaction.type] : null;
  const showHamzziReaction = Boolean(hamzziReaction && hamzziReactionConfig);
  const showLauncherHint = launcherHintVisible && !open && !showHamzziReaction;
  const { data: iconSetting } = useQuery({
    queryKey: ['response-assistant-launcher-icon'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_assistant_settings')
        .select('value')
        .eq('key', RESPONSE_ASSISTANT_ICON_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return data?.value || '';
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const responseAssistantIcon = isSupportedIconValue(iconSetting) ? iconSetting : defaultResponseAssistantIcon;
  const toolMeta = TOOL_META[activeTool];
  const activeSpriteTool = transitionTool ?? (activeTool === 'menu' ? null : activeTool);

  const closeAssistant = () => {
    if (toolTransitionTimerRef.current) {
      window.clearTimeout(toolTransitionTimerRef.current);
      toolTransitionTimerRef.current = null;
    }
    setOpen(false);
    setActiveTool('menu');
    setTransitionTool(null);
  };

  const returnToToolMenu = () => {
    if (toolTransitionTimerRef.current) {
      window.clearTimeout(toolTransitionTimerRef.current);
      toolTransitionTimerRef.current = null;
    }
    setTransitionTool(null);
    setActiveTool('menu');
  };

  const handleToolSelect = (tool: SpecialistTool) => {
    if (toolTransitionTimerRef.current) {
      window.clearTimeout(toolTransitionTimerRef.current);
    }
    setLauncherHintVisible(false);
    setTransitionTool(tool);
    setActiveTool('menu');
    toolTransitionTimerRef.current = window.setTimeout(() => {
      setActiveTool(tool);
      setTransitionTool(null);
      toolTransitionTimerRef.current = null;
    }, TOOL_TRANSITION_MS);
  };

  const handleLauncherClick = () => {
    registerHamzziLauncherClick();
    if (open) {
      closeAssistant();
      return;
    }
    setActiveTool('menu');
    setOpen(true);
  };

  const openQuoteWizardFullPage = isAdmin ? () => {
    closeAssistant();
    navigate('/quote-wizard');
  } : undefined;

  const handleShortcutSelect = (shortcut: AssistantShortcutItem) => {
    setLauncherHintVisible(false);
    if (shortcut.target === 'tool' && shortcut.tool) {
      handleToolSelect(shortcut.tool);
      return;
    }
    closeAssistant();
    if (shortcut.target === 'route' && shortcut.path) {
      navigate(shortcut.path);
      return;
    }
    if (shortcut.target === 'external' && shortcut.externalUrl) {
      window.open(shortcut.externalUrl, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FLOATING_RESPONSE_ASSISTANT_OPEN_KEY, open ? 'true' : 'false');
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }, [open]);

  useEffect(() => {
    const handleHamzziEvent = (event: Event) => {
      const detail = (event as CustomEvent<HamzziEventDetail>).detail;
      if (!detail?.type || !HAMZZI_REACTION_CONFIG[detail.type]) return;

      if (hamzziTimerRef.current) {
        window.clearTimeout(hamzziTimerRef.current);
      }

      setHamzziReaction({ ...detail, id: Date.now() });
      hamzziTimerRef.current = window.setTimeout(() => {
        setHamzziReaction(null);
        hamzziTimerRef.current = null;
      }, detail.durationMs ?? 4800);
    };

    window.addEventListener(HAMZZI_EVENT_NAME, handleHamzziEvent);
    return () => {
      window.removeEventListener(HAMZZI_EVENT_NAME, handleHamzziEvent);
      if (hamzziTimerRef.current) window.clearTimeout(hamzziTimerRef.current);
      if (toolTransitionTimerRef.current) window.clearTimeout(toolTransitionTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!user || isHidden) return;
    const timeout = window.setTimeout(() => triggerTimedHamzziIfNeeded(), 1200);
    return () => window.clearTimeout(timeout);
  }, [isHidden, location.pathname, user]);

  if (loading || !user || isHidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden sm:bottom-6 sm:right-6">
      {open && (
        <div className="pointer-events-auto mb-3 origin-bottom-right translate-y-0 scale-100 opacity-100 transition-all duration-200">
          <section className="flex h-[min(720px,calc(100vh-118px))] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#dedede] bg-white shadow-[0_18px_58px_rgba(0,0,0,0.22)]">
            <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                {activeTool !== 'menu' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={returnToToolMenu}
                    className="h-8 w-8 shrink-0 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                    aria-label="도구 선택으로 돌아가기"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <img src={responseAssistantIcon} alt="" className="h-10 w-10 object-contain drop-shadow-sm" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight text-[#111111]">
                    {toolMeta.title}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-[#9e9ea0]">
                    {toolMeta.description}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {activeTool === 'responseAssistant' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setGuideOpenSignal((signal) => signal + 1)}
                    className="h-8 w-8 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                    aria-label="상담 CS 사용 방법"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={closeAssistant}
                  className="h-8 w-8 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                  aria-label="햄찌 도우미 닫기"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] p-3">
              {activeTool === 'menu' && (
                <AssistantHomePanel onSelectShortcut={handleShortcutSelect} isTransitioning={Boolean(transitionTool)} />
              )}
              {activeTool === 'responseAssistant' && (
                <ResponseAssistantWidget
                  embedded
                  autoGuide={false}
                  compact
                  guideOpenSignal={guideOpenSignal}
                  className="rounded-[24px] shadow-none"
                />
              )}
              {activeTool === 'quoteWizard' && (
                <QuoteWizardPanel
                  embedded
                  compact
                  onOpenFullPage={openQuoteWizardFullPage}
                  className="pb-1"
                />
              )}
              {activeTool === 'meetingBooking' && (
                <MeetingBookingWidget
                  compactLayout
                  showHeader={false}
                  defaultAudienceType="client"
                  maxItems={6}
                  title="상담/미팅 예약"
                  description="직원 미팅과 클라이언트 상담 일정을 빠르게 예약합니다."
                  className="max-w-full overflow-hidden rounded-[24px] border-0 shadow-none"
                />
              )}
            </div>
          </section>
        </div>
      )}

      <div
        className="pointer-events-auto group relative ml-auto flex h-[88px] w-[88px] items-center justify-center"
        onMouseEnter={() => setLauncherHintVisible(true)}
        onMouseLeave={() => setLauncherHintVisible(false)}
        onFocus={() => setLauncherHintVisible(true)}
        onBlur={() => setLauncherHintVisible(false)}
      >
        {showHamzziReaction && hamzziReaction && hamzziReactionConfig && (
          <div
            key={hamzziReaction.id}
            className="pointer-events-none absolute bottom-[76px] right-0 z-30 w-[min(300px,calc(100vw-24px))] translate-y-0 opacity-100 transition-all duration-200"
            aria-live="polite"
          >
            <div className={cn(
              'hamzzi-reaction-card relative flex items-center gap-3 rounded-[24px] border px-3 py-3 shadow-[0_18px_45px_rgba(15,23,42,0.14)] backdrop-blur-md',
              hamzziReactionConfig.toneClass,
            )}>
              <span className="relative flex h-16 w-16 shrink-0 items-end justify-center overflow-visible rounded-2xl bg-gradient-to-b from-white to-slate-50/70">
                <img
                  src={hamzziReactionConfig.image}
                  alt=""
                  className="hamzzi-reaction-image h-[70px] w-[70px] object-contain drop-shadow-[0_8px_14px_rgba(15,23,42,0.13)]"
                />
                {hamzziReactionConfig.badge && (
                  <img
                    src={hamzziReactionConfig.badge}
                    alt=""
                    className="hamzzi-reaction-badge absolute -right-2 -top-2 h-7 w-7 object-contain"
                  />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-bold leading-snug text-slate-900">
                  {hamzziReaction.message || hamzziReactionConfig.fallbackMessage}
                </span>
                {hamzziReaction.description && (
                  <span className="mt-1 block text-[11px] font-medium leading-snug text-slate-500">
                    {hamzziReaction.description}
                  </span>
                )}
              </span>
            </div>
          </div>
        )}

        <div
          className={cn(
            'pointer-events-none absolute bottom-[42px] right-[44px] z-10 h-[120px] w-[150px] origin-bottom-right transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:scale-100 group-focus-within:opacity-100',
            showLauncherHint ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-3 scale-95 opacity-0',
            open && 'hidden',
          )}
          aria-hidden="true"
        >
          <img
            src={responseAssistantSpeechBubble}
            alt=""
            className="absolute inset-0 h-full w-full object-fill drop-shadow-[0_12px_20px_rgba(0,0,0,0.08)]"
          />
          <span
            className={cn(
              'absolute left-2.5 right-6 top-[41px] block origin-left whitespace-nowrap text-center text-[10px] font-normal leading-none text-[#111111] transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
              showLauncherHint ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
            )}
          >
            어떤 업무를 도와드릴까요?
          </span>
        </div>

        <button
          type="button"
          onClick={handleLauncherClick}
          className={cn(
            'relative z-20 flex h-[88px] w-[88px] items-center justify-center overflow-visible bg-transparent p-0 transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-0 active:scale-95',
            open && 'scale-95',
          )}
          aria-label={open ? '햄찌 도우미 닫기' : '햄찌 도우미 열기'}
        >
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out',
              activeSpriteTool ? 'translate-x-10 scale-90 opacity-0' : 'translate-x-0 scale-100 opacity-100',
              transitionTool && 'hamzzi-helper-default-exit',
            )}
          >
            <img
              src={responseAssistantIcon}
              alt=""
              className={cn(
                'h-[82px] w-[74px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)] transition-transform',
                showLauncherHint && 'scale-105',
              )}
            />
          </span>
          {activeSpriteTool && (
            <HamzziToolSprite
              key={`${activeSpriteTool}-${transitionTool ? 'enter' : 'active'}`}
              tool={activeSpriteTool}
              entering={Boolean(transitionTool)}
            />
          )}
        </button>
      </div>
    </div>
  );
};

const HamzziToolSprite = ({ tool, entering }: { tool: SpecialistTool; entering: boolean }) => {
  const config = HAMZZI_TOOL_SPRITES[tool];
  const spriteStyle = {
    '--hamzzi-helper-frame-width': `${config.displayWidth}px`,
    '--hamzzi-helper-frame-height': `${config.displayHeight}px`,
    '--hamzzi-helper-sheet-width': `${config.displayWidth * 8}px`,
    '--hamzzi-helper-end-x': `${-config.displayWidth * 8}px`,
    backgroundImage: `url(${config.image})`,
  } as React.CSSProperties;

  return (
    <span
      className={cn(
        'pointer-events-none absolute z-10 flex items-center justify-center',
        config.className,
        entering ? 'hamzzi-helper-specialist-enter' : 'opacity-100',
      )}
      aria-label={config.label}
      role="img"
    >
      {entering && (
        <span
          className={cn(
            'hamzzi-helper-transition-glow',
            tool === 'quoteWizard' ? 'hamzzi-helper-transition-glow--magic' : 'hamzzi-helper-transition-glow--cs',
          )}
          aria-hidden="true"
        />
      )}
      <span className="hamzzi-helper-sprite-frame" style={spriteStyle} />
    </span>
  );
};

const AssistantHomePanel = ({
  onSelectShortcut,
  isTransitioning,
}: {
  onSelectShortcut: (shortcut: AssistantShortcutItem) => void;
  isTransitioning: boolean;
}) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { notifications } = useNotifications();
  const { items, urgentCount, todayCount, isLoading } = useTodayWorkItems(notifications);
  const { selectedShortcuts, isLoading: shortcutsLoading } = useAssistantShortcuts();
  const visibleItems = items.slice(0, 7);

  return (
    <>
      <div className="space-y-3 rounded-[24px] bg-white p-3 shadow-none">
        <section className="rounded-[20px] border border-[#ececec] bg-[#fafafa] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-[#111111]">오늘 우선 확인</p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#707072]">
                알림, 일정, 승인, 납기 업무를 모아 보여드립니다.
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#111111]" />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[#dedede] bg-white px-3 py-2">
              <p className="text-base font-black text-[#111111]">{items.length}</p>
              <p className="text-[10px] font-semibold text-[#707072]">전체</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2">
              <p className="text-base font-black text-amber-700">{urgentCount}</p>
              <p className="text-[10px] font-semibold text-amber-700">긴급</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-2">
              <p className="text-base font-black text-blue-700">{todayCount}</p>
              <p className="text-[10px] font-semibold text-blue-700">오늘</p>
            </div>
          </div>
        </section>

        <section className="rounded-[20px] border border-[#ececec] bg-white p-3">
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center rounded-2xl bg-[#fafafa] text-xs font-semibold text-[#707072]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              오늘 할 일을 불러오는 중
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedede] bg-[#fafafa] px-4 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
              <p className="text-sm font-black text-[#111111]">지금 바로 처리할 일이 없습니다.</p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#707072]">필요한 기능은 아래 바로가기에서 시작하세요.</p>
            </div>
          ) : (
            <div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className="group grid w-full grid-cols-[auto,1fr,auto] items-center gap-2 rounded-2xl border border-[#ececec] bg-[#fafafa] p-3 text-left transition hover:border-[#cacacb] hover:bg-white"
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border', toneClasses(item.tone))}>
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-xs font-black text-[#111111]">{item.title}</span>
                      <Badge variant="outline" className="h-5 shrink-0 rounded-full px-1.5 text-[9px]">
                        {item.label}
                      </Badge>
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-medium text-[#707072]">{item.description}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-[#9e9ea0] transition group-hover:text-[#111111]" />
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[20px] border border-[#ececec] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#111111]">내 바로가기</p>
              <p className="text-[11px] font-semibold text-[#9e9ea0]">자주 쓰는 기능을 햄찌 첫 화면에 고정합니다.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-8 rounded-full px-2.5 text-xs font-bold"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              설정
            </Button>
          </div>

          {shortcutsLoading ? (
            <div className="flex h-24 items-center justify-center rounded-2xl bg-[#fafafa] text-xs font-semibold text-[#707072]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              바로가기 불러오는 중
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {selectedShortcuts.map((shortcut) => {
                const ShortcutIcon = shortcut.icon;
                return (
                  <button
                    key={shortcut.id}
                    type="button"
                    onClick={() => onSelectShortcut(shortcut)}
                    disabled={isTransitioning}
                    className="min-h-[86px] rounded-2xl border border-[#dedede] bg-[#fafafa] p-3 text-left transition hover:border-[#cacacb] hover:bg-white disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedede] bg-white text-[#111111]">
                      <ShortcutIcon className="h-4 w-4" />
                    </span>
                    <span className="mt-2 block truncate text-xs font-black text-[#111111]">{shortcut.label}</span>
                    <span className="mt-0.5 block line-clamp-2 text-[10px] font-semibold leading-4 text-[#707072]">
                      {shortcut.description}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AssistantShortcutSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};

const AssistantShortcutSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const {
    availableShortcuts,
    shortcutIds,
    roleDefaultIds,
    saveShortcutOrder,
    resetToRoleDefault,
  } = useAssistantShortcuts();
  const [draftIds, setDraftIds] = useState<string[]>(shortcutIds);
  const selectedIdSet = useMemo(() => new Set(draftIds), [draftIds]);
  const saving = saveShortcutOrder.isPending || resetToRoleDefault.isPending;

  useEffect(() => {
    if (open) setDraftIds(shortcutIds);
  }, [open, shortcutIds]);

  const toggleShortcut = (id: string) => {
    setDraftIds((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const moveShortcut = (id: string, direction: -1 | 1) => {
    setDraftIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await saveShortcutOrder.mutateAsync(draftIds);
      onOpenChange(false);
    } catch {
      // Mutation already shows a toast.
    }
  };

  const handleReset = () => {
    setDraftIds(roleDefaultIds);
    resetToRoleDefault.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[24px] border-[#dedede] bg-white p-0">
        <DialogHeader className="border-b border-[#ececec] px-5 py-4 text-left">
          <DialogTitle className="text-base font-black text-[#111111]">햄찌 바로가기 설정</DialogTitle>
          <DialogDescription className="text-xs font-medium leading-5 text-[#707072]">
            자주 쓰는 기능을 선택하고 위아래 버튼으로 첫 화면 순서를 조정하세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 p-4">
          {availableShortcuts.map((shortcut) => {
            const ShortcutIcon = shortcut.icon;
            const selected = selectedIdSet.has(shortcut.id);
            const orderIndex = draftIds.indexOf(shortcut.id);
            return (
              <div
                key={shortcut.id}
                className={cn(
                  'grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-2xl border p-3',
                  selected ? 'border-[#111111] bg-[#fafafa]' : 'border-[#ececec] bg-white',
                )}
              >
                <Checkbox
                  checked={selected}
                  onCheckedChange={() => toggleShortcut(shortcut.id)}
                  aria-label={`${shortcut.label} 바로가기 선택`}
                />
                <button
                  type="button"
                  onClick={() => toggleShortcut(shortcut.id)}
                  className="grid min-w-0 grid-cols-[auto,1fr] items-center gap-2 text-left"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedede] bg-white text-[#111111]">
                    <ShortcutIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-[#111111]">{shortcut.label}</span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#707072]">{shortcut.description}</span>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!selected || orderIndex <= 0}
                    onClick={() => moveShortcut(shortcut.id, -1)}
                    className="h-8 w-8 rounded-full"
                    aria-label={`${shortcut.label} 위로 이동`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!selected || orderIndex < 0 || orderIndex >= draftIds.length - 1}
                    onClick={() => moveShortcut(shortcut.id, 1)}
                    className="h-8 w-8 rounded-full"
                    aria-label={`${shortcut.label} 아래로 이동`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-[#ececec] p-4 sm:justify-between sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            className="rounded-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            기본값 복구
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || draftIds.length === 0}
            className="rounded-full bg-[#111111] text-white hover:bg-[#39393b]"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FloatingResponseAssistant;
