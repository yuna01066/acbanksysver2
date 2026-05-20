import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, X } from 'lucide-react';
import responseAssistantIcon from '@/assets/bongsun-face.png';
import { Button } from '@/components/ui/button';
import ResponseAssistantWidget from '@/components/ResponseAssistantWidget';
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

const FloatingResponseAssistant: React.FC = () => {
  const location = useLocation();
  const [open, setOpen] = useState(readStoredOpenState);
  const [guideOpenSignal, setGuideOpenSignal] = useState(0);
  const [launcherHintVisible, setLauncherHintVisible] = useState(false);

  const isHidden = isHiddenPath(location.pathname);
  const showLauncherHint = launcherHintVisible && !open;

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
        className="pointer-events-auto relative ml-auto flex h-[88px] w-[88px] items-center justify-center"
        onMouseEnter={() => setLauncherHintVisible(true)}
        onMouseLeave={() => setLauncherHintVisible(false)}
        onFocus={() => setLauncherHintVisible(true)}
        onBlur={() => setLauncherHintVisible(false)}
      >
        <div
          className={cn(
            'pointer-events-none absolute right-[72px] top-1 z-10 min-w-[166px] whitespace-nowrap rounded-2xl border border-[#dedede] bg-white px-3.5 py-2 text-center text-xs font-normal leading-none text-[#111111] shadow-[0_12px_30px_rgba(0,0,0,0.14)] transition-all duration-300 ease-out before:absolute before:-right-2 before:top-1/2 before:h-4 before:w-4 before:-translate-y-1/2 before:rotate-45 before:border-r before:border-t before:border-[#dedede] before:bg-white',
            showLauncherHint ? 'translate-x-0 scale-100 opacity-100' : 'translate-x-3 scale-95 opacity-0',
            open && 'hidden',
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              'block origin-left transition-all delay-100 duration-300',
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
