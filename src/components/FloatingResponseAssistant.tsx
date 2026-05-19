import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Maximize2, MessageSquareText, X } from 'lucide-react';
import responseAssistantIcon from '@/assets/bongsun-icon.png';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
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

const FloatingResponseAssistant: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const isResponseAssistantDemo = location.pathname === '/response-assistant';

  const isHidden = loading
    || (!user && !isResponseAssistantDemo)
    || HIDDEN_PATHS.some((path) => location.pathname.startsWith(path));

  if (isHidden) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 print:hidden sm:bottom-6 sm:right-6">
      <div
        className={cn(
          'mb-3 origin-bottom-right transition-all duration-200',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-4 scale-95 opacity-0',
        )}
      >
        <section className="flex h-[min(720px,calc(100vh-118px))] w-[min(440px,calc(100vw-24px))] flex-col overflow-hidden rounded-[28px] border border-[#dedede] bg-white shadow-[0_18px_58px_rgba(0,0,0,0.22)]">
          <header className="flex items-center justify-between gap-3 border-b border-[#e5e5e5] bg-white px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dedede] bg-[#f5f5f5]">
                <img src={responseAssistantIcon} alt="" className="h-9 w-9 object-cover" />
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
                onClick={() => navigate('/response-assistant')}
                className="h-8 w-8 rounded-full text-[#707072] hover:bg-[#f5f5f5]"
                aria-label="상담 응대 보조 전체 화면으로 열기"
              >
                <Maximize2 className="h-4 w-4" />
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
            <ResponseAssistantWidget embedded autoGuide={false} className="rounded-[24px] shadow-none" />
          </div>
        </section>
      </div>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'group ml-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border border-[#dedede] bg-white shadow-[0_10px_28px_rgba(0,0,0,0.22)] transition-transform hover:scale-[1.04] active:scale-95',
          open && 'scale-95',
        )}
        aria-label={open ? '상담 응대 보조 닫기' : '상담 응대 보조 열기'}
      >
        <span className="relative flex h-[60px] w-[60px] items-center justify-center overflow-hidden rounded-full bg-[#f5f5f5]">
          <img src={responseAssistantIcon} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
          {!open && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#111111]">
              <MessageSquareText className="h-2.5 w-2.5 text-white" />
            </span>
          )}
        </span>
      </button>
    </div>
  );
};

export default FloatingResponseAssistant;
