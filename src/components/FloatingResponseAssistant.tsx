import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, HelpCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import jjikjjikiBase from '@/assets/hamzzi/jjikjjiki-base.png';
import jjikjjikiPeekRight from '@/assets/hamzzi/jjikjjiki-flow-peek-right.png';
import jjikjjikiHeadTilt from '@/assets/hamzzi/jjikjjiki-head-tilt-expression-256.png';
import jjikjjikiHoverBubbleSticker from '@/assets/hamzzi/jjikjjiki-hover-bubble-sticker.png';
import jjikjjikiHoverEasterEggSticker from '@/assets/hamzzi/jjikjjiki-hover-easter-egg-sticker.png';
import jjikjjikiAngryPeek from '@/assets/hamzzi/jjikjjiki-angry-peek.png';
import jjikjjikiPopupChoiceSticker from '@/assets/hamzzi/jjikjjiki-popup-choice-sticker.png';
import jjikjjikiStartSticker from '@/assets/hamzzi/jjikjjiki-start-sticker.png';
import jjikjjikiSurprised from '@/assets/hamzzi/jjikjjiki-surprised-expression-256.png';
import jjikjjikiVerySurprised from '@/assets/hamzzi/jjikjjiki-very-surprised-expression-256.png';
import jjikjjikiWalkOutSpritesheet from '@/assets/hamzzi/jjikjjiki-walk-out-spritesheet.webp';
import jjikjjikiLunchCelebration from '@/assets/hamzzi/jjikjjiki-lunch-celebration.png';
import jjikjjikiLunchSpeechSticker from '@/assets/hamzzi/jjikjjiki-lunch-speech-sticker.png';
import jjikjjikiQuoteIssuedThumbsUp from '@/assets/hamzzi/jjikjjiki-quote-issued-thumbs-up.png';
import jjikjjikiQuoteIssuedSpeechSticker from '@/assets/hamzzi/jjikjjiki-quote-issued-speech-sticker.png';
import iconLunch from '@/assets/hamzzi/icon_lunch.png';
import iconNight from '@/assets/hamzzi/icon_night.png';
import iconParty from '@/assets/hamzzi/icon_party.png';
import AssistantHomePanel from '@/components/assistant/AssistantHomePanel';
import { Button } from '@/components/ui/button';
import MeetingBookingWidget from '@/components/MeetingBookingWidget';
import QuoteWizardPanel from '@/components/QuoteWizardPanel';
import ResponseAssistantWidget from '@/components/ResponseAssistantWidget';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAssistantRole,
  resolveAssistantShortcutAccess,
  type AssistantEmbeddedTool,
  type AssistantShortcutItem,
} from '@/hooks/useAssistantShortcuts';
import { supabase } from '@/integrations/supabase/client';
import {
  HAMZZI_EVENT_SETTINGS_KEY,
  parseHamzziEventSettings,
} from '@/lib/responseAssistantDefaults';
import {
  HAMZZI_EVENT_NAME,
  registerHamzziLauncherClick,
  triggerTimedHamzziIfNeeded,
  type HamzziEventDetail,
  type HamzziEventType,
} from '@/lib/hamzziEvents';
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
type LauncherPhase = 'idle' | 'walkingOut';

type HamzziReactionConfig = {
  image: string;
  badge?: string;
  sticker?: string;
  fallbackMessage: string;
  toneClass: string;
  variant?: 'card' | 'lunch_slide';
};

type HamzziSpriteConfig = {
  image: string;
  displayWidth: number;
  displayHeight: number;
  className: string;
  label: string;
};

type HamzziReactionState = HamzziEventDetail & {
  id: number;
};

type ResponseAssistantSetting = {
  value: string;
};

const TOOL_META: Record<AssistantTool, { title: string; description: string }> = {
  menu: {
    title: '찍찍이 도우미',
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
    image: jjikjjikiSurprised,
    badge: iconParty,
    fallbackMessage: '견적서 발행 완료. 오늘도 한 건 처리했습니다.',
    toneClass: 'border-blue-100 bg-white/95',
  },
  quote_streak_5: {
    image: jjikjjikiVerySurprised,
    badge: iconParty,
    fallbackMessage: '오늘 견적 페이스 좋습니다.',
    toneClass: 'border-amber-100 bg-white/95',
  },
  attendance_check_in: {
    image: jjikjjikiBase,
    fallbackMessage: '출근 기록 완료. 오늘 업무 시작합니다.',
    toneClass: 'border-emerald-100 bg-white/95',
  },
  attendance_check_out: {
    image: jjikjjikiHeadTilt,
    fallbackMessage: '퇴근 기록 완료. 오늘 기록 저장됐습니다.',
    toneClass: 'border-slate-100 bg-white/95',
  },
  lunch_time: {
    image: jjikjjikiLunchCelebration,
    badge: iconLunch,
    sticker: jjikjjikiLunchSpeechSticker,
    fallbackMessage: '점심시간입니다. 잠깐 쉬어가세요.',
    toneClass: 'border-orange-100 bg-white/95',
    variant: 'lunch_slide',
  },
  late_night: {
    image: jjikjjikiHeadTilt,
    badge: iconNight,
    fallbackMessage: '늦은 시간입니다. 마무리할 업무만 확인하세요.',
    toneClass: 'border-indigo-100 bg-white/95',
  },
  hidden_click: {
    image: jjikjjikiVerySurprised,
    fallbackMessage: '숨겨진 찍찍이 반응을 찾았습니다.',
    toneClass: 'border-violet-100 bg-white/95',
  },
  work_complete: {
    image: jjikjjikiBase,
    badge: iconParty,
    fallbackMessage: '오늘 근무 흐름이 완료됐습니다.',
    toneClass: 'border-zinc-200 bg-white/95',
  },
  delivery_complete: {
    image: jjikjjikiSurprised,
    badge: iconParty,
    fallbackMessage: '납기 완료 처리됐습니다.',
    toneClass: 'border-emerald-100 bg-white/95',
  },
  dashboard_checkpoint: {
    image: jjikjjikiHeadTilt,
    fallbackMessage: '오늘 체크포인트를 열었습니다.',
    toneClass: 'border-slate-200 bg-white/95',
  },
};

const HAMZZI_TOOL_SPRITES: Record<SpecialistTool, HamzziSpriteConfig> = {
  responseAssistant: {
    image: jjikjjikiHeadTilt,
    displayWidth: 92,
    displayHeight: 92,
    className: '-bottom-1 -right-1',
    label: '상담 찍찍이',
  },
  quoteWizard: {
    image: jjikjjikiSurprised,
    displayWidth: 92,
    displayHeight: 92,
    className: '-bottom-1 -right-1',
    label: '견적 찍찍이',
  },
  meetingBooking: {
    image: jjikjjikiBase,
    displayWidth: 92,
    displayHeight: 92,
    className: '-bottom-1 -right-1',
    label: '예약 찍찍이',
  },
};

const TOOL_TRANSITION_MS = 620;
const LAUNCHER_WALK_DURATION_MS = 1560;
const LAUNCHER_MENU_OPEN_DELAY_MS = 3000;
const LAUNCHER_WALK_FRAME_DISPLAY = 132;
const LAUNCHER_WALK_FRAME_COUNT = 21;
const LAUNCHER_WALK_CSS_STEPS = 20;
const LAUNCHER_EASTER_EGG_HOVER_THRESHOLD = 5;
const LAUNCHER_EASTER_EGG_DISPLAY_MS = 1800;
const LAUNCHER_WALK_STAGE_STYLE = {
  '--hamzzi-launcher-walk-size': `${LAUNCHER_WALK_FRAME_DISPLAY}px`,
  '--hamzzi-launcher-walk-sheet-width': `${LAUNCHER_WALK_FRAME_DISPLAY * LAUNCHER_WALK_FRAME_COUNT}px`,
  '--hamzzi-launcher-walk-end-x': `${-LAUNCHER_WALK_FRAME_DISPLAY * LAUNCHER_WALK_CSS_STEPS}px`,
  '--hamzzi-launcher-walk-duration': `${LAUNCHER_WALK_DURATION_MS}ms`,
  '--hamzzi-launcher-phase-duration': `${LAUNCHER_MENU_OPEN_DELAY_MS}ms`,
} as React.CSSProperties;
const LAUNCHER_WALK_SPRITE_STYLE = {
  backgroundImage: `url(${jjikjjikiWalkOutSpritesheet})`,
} as React.CSSProperties;

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

const prefersReducedMotion = () => (
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

const isSpecialistTool = (tool: AssistantTool): tool is SpecialistTool => (
  tool !== 'menu'
);

const FloatingResponseAssistant: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, isAdmin, isModerator, isManager } = useAuth();
  const [open, setOpen] = useState(readStoredOpenState);
  const [activeTool, setActiveTool] = useState<AssistantTool>('menu');
  const [guideOpenSignal, setGuideOpenSignal] = useState(0);
  const [launcherPhase, setLauncherPhase] = useState<LauncherPhase>('idle');
  const [transitionTool, setTransitionTool] = useState<SpecialistTool | null>(null);
  const [hamzziReaction, setHamzziReaction] = useState<HamzziReactionState | null>(null);
  const [launcherHoverCount, setLauncherHoverCount] = useState(0);
  const [showLauncherEasterEgg, setShowLauncherEasterEgg] = useState(false);
  const hamzziTimerRef = useRef<number | null>(null);
  const launcherTimerRef = useRef<number | null>(null);
  const launcherEasterEggTimerRef = useRef<number | null>(null);
  const toolTransitionTimerRef = useRef<number | null>(null);

  const { data: hamzziEventSetting, isLoading: hamzziEventSettingLoading } = useQuery<ResponseAssistantSetting | null>({
    queryKey: ['response-assistant-setting', HAMZZI_EVENT_SETTINGS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_assistant_settings')
        .select('value')
        .eq('key', HAMZZI_EVENT_SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ResponseAssistantSetting | null;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const isHidden = isHiddenPath(location.pathname);
  const hamzziReactionConfig = hamzziReaction ? HAMZZI_REACTION_CONFIG[hamzziReaction.type] : null;
  const showHamzziReaction = Boolean(hamzziReaction && hamzziReactionConfig);
  const showLunchReaction = Boolean(showHamzziReaction && hamzziReaction?.type === 'lunch_time');
  const showQuoteIssuedReaction = Boolean(showHamzziReaction && hamzziReaction?.type === 'quote_issued');
  const showStickerHamzziReaction = showLunchReaction || showQuoteIssuedReaction;
  const launcherIcon = open ? jjikjjikiHeadTilt : jjikjjikiPeekRight;
  const showLauncherWalkOut = !open && launcherPhase === 'walkingOut';
  const toolMeta = TOOL_META[activeTool];
  const activeSpriteTool = transitionTool ?? (isSpecialistTool(activeTool) ? activeTool : null);
  const hamzziEventSettings = useMemo(
    () => parseHamzziEventSettings(hamzziEventSetting?.value),
    [hamzziEventSetting?.value],
  );
  const assistantRole = useMemo(
    () => getAssistantRole(isAdmin, isModerator, isManager),
    [isAdmin, isManager, isModerator],
  );

  const closeAssistant = () => {
    if (launcherTimerRef.current) {
      window.clearTimeout(launcherTimerRef.current);
      launcherTimerRef.current = null;
    }
    if (launcherEasterEggTimerRef.current) {
      window.clearTimeout(launcherEasterEggTimerRef.current);
      launcherEasterEggTimerRef.current = null;
    }
    if (toolTransitionTimerRef.current) {
      window.clearTimeout(toolTransitionTimerRef.current);
      toolTransitionTimerRef.current = null;
    }
    setOpen(false);
    setActiveTool('menu');
    setLauncherPhase('idle');
    setTransitionTool(null);
    setShowLauncherEasterEgg(false);
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
    setTransitionTool(tool);
    setActiveTool('menu');
    toolTransitionTimerRef.current = window.setTimeout(() => {
      setActiveTool(tool);
      setTransitionTool(null);
      toolTransitionTimerRef.current = null;
    }, TOOL_TRANSITION_MS);
  };

  const handleLauncherClick = () => {
    if (launcherPhase === 'walkingOut') return;

    registerHamzziLauncherClick();
    if (open) {
      closeAssistant();
      return;
    }

    setActiveTool('menu');

    if (prefersReducedMotion()) {
      setOpen(true);
      return;
    }

    setLauncherPhase('walkingOut');
    launcherTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      setLauncherPhase('idle');
      launcherTimerRef.current = null;
    }, LAUNCHER_MENU_OPEN_DELAY_MS);
  };

  const handleLauncherHover = () => {
    if (open || showLauncherWalkOut || activeSpriteTool || showHamzziReaction) return;

    setLauncherHoverCount((count) => {
      const nextCount = count + 1;
      if (nextCount < LAUNCHER_EASTER_EGG_HOVER_THRESHOLD) return nextCount;

      if (launcherEasterEggTimerRef.current) {
        window.clearTimeout(launcherEasterEggTimerRef.current);
      }
      setShowLauncherEasterEgg(true);
      launcherEasterEggTimerRef.current = window.setTimeout(() => {
        setShowLauncherEasterEgg(false);
        launcherEasterEggTimerRef.current = null;
      }, LAUNCHER_EASTER_EGG_DISPLAY_MS);

      return 0;
    });
  };

  const openQuoteWizardFullPage = isAdmin ? () => {
    closeAssistant();
    navigate('/quote-wizard');
  } : undefined;

  const handleShortcutSelect = (shortcut: AssistantShortcutItem) => {
    const access = resolveAssistantShortcutAccess(shortcut, { role: assistantRole });
    if (access.state !== 'enabled') {
      toast.error(access.reason || '현재 권한으로 사용할 수 없는 기능입니다.');
      return;
    }

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
      const managedSetting = detail.type in hamzziEventSettings
        ? hamzziEventSettings[detail.type as keyof typeof hamzziEventSettings]
        : null;
      if (!detail.preview && managedSetting?.enabled === false) return;
      const durationMs = detail.durationMs ?? managedSetting?.duration_ms ?? 4800;

      if (hamzziTimerRef.current) {
        window.clearTimeout(hamzziTimerRef.current);
      }

      setHamzziReaction({
        ...detail,
        message: detail.message || managedSetting?.message,
        description: detail.description || managedSetting?.description,
        durationMs,
        id: Date.now(),
      });
      hamzziTimerRef.current = window.setTimeout(() => {
        setHamzziReaction(null);
        hamzziTimerRef.current = null;
      }, durationMs);
    };

    window.addEventListener(HAMZZI_EVENT_NAME, handleHamzziEvent);
    return () => {
      window.removeEventListener(HAMZZI_EVENT_NAME, handleHamzziEvent);
      if (hamzziTimerRef.current) window.clearTimeout(hamzziTimerRef.current);
      if (launcherTimerRef.current) window.clearTimeout(launcherTimerRef.current);
      if (launcherEasterEggTimerRef.current) window.clearTimeout(launcherEasterEggTimerRef.current);
      if (toolTransitionTimerRef.current) window.clearTimeout(toolTransitionTimerRef.current);
    };
  }, [hamzziEventSettings]);

  useEffect(() => {
    if (!user || isHidden || hamzziEventSettingLoading) return;
    const timeout = window.setTimeout(() => {
      triggerTimedHamzziIfNeeded(new Date(), hamzziEventSettings);
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, [hamzziEventSettingLoading, hamzziEventSettings, isHidden, location.pathname, user]);

  if (loading || !user || isHidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-0 z-40 print:hidden sm:bottom-6 sm:right-0">
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
                  <img src={jjikjjikiHeadTilt} alt="" className="h-10 w-10 object-contain drop-shadow-sm" />
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
                  aria-label="찍찍이 도우미 닫기"
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

      <div className="pointer-events-auto group relative ml-auto flex h-[88px] w-[88px] items-center justify-center">
        {showLunchReaction && hamzziReaction && (
          <div
            key={`lunch-${hamzziReaction.id}`}
            className="jjikjjiki-lunch-reaction-stage"
            aria-live="polite"
          >
            <img
              src={jjikjjikiLunchCelebration}
              alt=""
              className="jjikjjiki-lunch-character"
              aria-hidden="true"
            />
            <img
              src={jjikjjikiLunchSpeechSticker}
              alt={hamzziReaction.message || hamzziEventSettings.lunch_time.message}
              className="jjikjjiki-lunch-speech-sticker"
            />
            <span className="sr-only">{hamzziReaction.message || hamzziEventSettings.lunch_time.message}</span>
          </div>
        )}

        {showQuoteIssuedReaction && hamzziReaction && (
          <div
            key={`quote-${hamzziReaction.id}`}
            className="jjikjjiki-quote-reaction-stage"
            aria-live="polite"
          >
            <img
              src={jjikjjikiQuoteIssuedThumbsUp}
              alt=""
              className="jjikjjiki-quote-character"
              aria-hidden="true"
            />
            <img
              src={jjikjjikiQuoteIssuedSpeechSticker}
              alt={hamzziReaction.message || hamzziReactionConfig?.fallbackMessage}
              className="jjikjjiki-quote-speech-sticker"
            />
            <span className="sr-only">{hamzziReaction.message || hamzziReactionConfig?.fallbackMessage}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleLauncherClick}
          onMouseEnter={handleLauncherHover}
          onFocus={handleLauncherHover}
          disabled={launcherPhase === 'walkingOut'}
          className="jjikjjiki-launcher-button group relative z-20 flex h-[104px] w-[104px] items-center justify-center overflow-visible bg-transparent p-0 transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-0 active:scale-95"
          aria-label={open ? '찍찍이 도우미 닫기' : launcherPhase === 'walkingOut' ? '찍찍이가 걸어나오는 중' : '찍찍이 도우미 열기'}
        >
          {!open && !showLauncherWalkOut && !activeSpriteTool && !showHamzziReaction && !showLauncherEasterEgg && (
            <img
              src={jjikjjikiHoverBubbleSticker}
              alt=""
              className="jjikjjiki-launcher-hover-bubble"
              aria-hidden="true"
            />
          )}
          {showLauncherEasterEgg && !open && !showLauncherWalkOut && !activeSpriteTool && !showHamzziReaction && (
            <span className="jjikjjiki-launcher-angry-easter-stage" aria-hidden="true">
              <span className="jjikjjiki-launcher-angry-crop">
                <img
                  src={jjikjjikiAngryPeek}
                  alt=""
                  className="jjikjjiki-launcher-angry-character"
                />
              </span>
              <img
                src={jjikjjikiHoverEasterEggSticker}
                alt=""
                className="jjikjjiki-launcher-easter-egg-sticker"
              />
            </span>
          )}
          {open && !showLauncherWalkOut && !activeSpriteTool && !showHamzziReaction && (
            <img
              src={jjikjjikiPopupChoiceSticker}
              alt=""
              className="jjikjjiki-popup-choice-sticker"
              aria-hidden="true"
            />
          )}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center transition-all duration-300 ease-out',
              activeSpriteTool ? 'translate-x-10 scale-90 opacity-0' : 'translate-x-0 scale-100 opacity-100',
              transitionTool && 'hamzzi-helper-default-exit',
              showLauncherWalkOut && 'hamzzi-launcher-walk-out',
              showHamzziReaction && !open && !showLauncherWalkOut && !activeSpriteTool && 'jjikjjiki-lunch-peek-exit',
              showLauncherEasterEgg && !open && !showLauncherWalkOut && !activeSpriteTool && 'jjikjjiki-easter-peek-exit',
            )}
          >
            {showLauncherWalkOut ? (
              <span
                className="jjikjjiki-walk-out-stage -translate-x-14"
                style={LAUNCHER_WALK_STAGE_STYLE}
                aria-hidden="true"
              >
                <span className="jjikjjiki-walk-out" style={LAUNCHER_WALK_SPRITE_STYLE} />
                <img
                  src={jjikjjikiStartSticker}
                  alt=""
                  className="jjikjjiki-walk-start-sticker"
                  aria-hidden="true"
                />
                <img
                  src={jjikjjikiHeadTilt}
                  alt=""
                  className="jjikjjiki-walk-tilt-reveal"
                  aria-hidden="true"
                />
              </span>
            ) : (
              <img
                src={launcherIcon}
                alt=""
                className={cn(
                  'object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)] transition-transform',
                  open
                    ? 'h-[146px] w-[146px] max-w-none -translate-x-4 -translate-y-5'
                    : 'h-[112px] w-[106px] max-w-none -translate-x-3 -translate-y-2 object-right group-hover:scale-[1.08] group-focus:scale-[1.08] group-focus-visible:scale-[1.08]',
                )}
              />
            )}
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
      <img
        src={config.image}
        alt=""
        className="object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.22)]"
        style={{ width: config.displayWidth, height: config.displayHeight }}
      />
    </span>
  );
};

export default FloatingResponseAssistant;
