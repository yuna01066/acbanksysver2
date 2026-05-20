import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, X } from 'lucide-react';
import defaultResponseAssistantIcon from '@/assets/response-assistant-default-icon.png';
import responseAssistantSpeechBubble from '@/assets/response-assistant-speech-bubble.png';
import { Button } from '@/components/ui/button';
import ResponseAssistantWidget from '@/components/ResponseAssistantWidget';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
  const { user } = useAuth();
  const [open, setOpen] = useState(readStoredOpenState);
  const [guideOpenSignal, setGuideOpenSignal] = useState(0);
  const [launcherHintVisible, setLauncherHintVisible] = useState(false);

  const isHidden = isHiddenPath(location.pathname);
  const showLauncherHint = launcherHintVisible && !open;
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

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FLOATING_RESPONSE_ASSISTANT_OPEN_KEY, open ? 'true' : 'false');
    } catch {
      // Storage can be unavailable in restricted browser modes.
    }
  }, [open]);

  if (isHidden) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 print:hidden sm:bottom-6 sm:right-6">
      {open && (
        <div className="pointer-events-auto mb-3 origin-bottom-right translate-y-0 scale-100 opacity-100 transition-all duration-200">
          <section className="flex h-[min(720px,calc(100vh-118px))] w-[min(460px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#dedede] bg-white shadow-[0_18px_58px_rgba(0,0,0,0.22)]">
            <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-white px-4 py-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <img src={responseAssistantIcon} alt="" className="h-10 w-10 object-contain drop-shadow-sm" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black leading-tight text-[#111111]">
                    상담 응대 보조
                  </p>
                  <p className="truncate text-[11px] font-semibold text-[#9e9ea0]">
                    답변 작성 · 문안 검수 · 견적 메일
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setGuideOpenSignal((signal) => signal + 1)}
                  className="h-8 w-8 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                  aria-label="상담 응대 보조 사용 방법"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  className="h-8 w-8 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                  aria-label="상담 응대 보조 닫기"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto bg-[#f5f5f5] p-3">
              <ResponseAssistantWidget
                embedded
                autoGuide={false}
                compact
                guideOpenSignal={guideOpenSignal}
                className="rounded-[24px] shadow-none"
              />
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
        <div
          className={cn(
            'pointer-events-none absolute -top-10 right-[60px] z-10 h-[148px] w-[184px] transition-all duration-300 ease-out group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:scale-100 group-focus-within:opacity-100',
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
              'absolute left-5 right-9 top-[48px] block origin-left whitespace-nowrap text-center text-[11px] font-normal leading-none text-[#111111] transition-all delay-100 duration-300 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100',
              showLauncherHint ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
            )}
          >
            상담CS를 도와드릴까요?
          </span>
        </div>

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'flex h-[88px] w-[88px] items-center justify-center bg-transparent p-0 transition-transform hover:scale-[1.04] focus-visible:outline-none focus-visible:ring-0 active:scale-95',
            open && 'scale-95',
          )}
          aria-label={open ? '상담 응대 보조 닫기' : '상담 응대 보조 열기'}
        >
          <img
            src={responseAssistantIcon}
            alt=""
            className={cn(
              'h-[82px] w-[74px] object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.24)] transition-transform',
              showLauncherHint && 'scale-105',
            )}
          />
        </button>
      </div>
    </div>
  );
};

export default FloatingResponseAssistant;
