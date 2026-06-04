import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { triggerDailyHamzzi } from '@/lib/hamzziEvents';
import { cn } from '@/lib/utils';

const quotes = [
  { text: "성공은 매일 반복하는 작은 노력의 합이다.", author: "로버트 콜리어" },
  { text: "오늘 할 수 있는 일을 내일로 미루지 마라.", author: "벤자민 프랭클린" },
  { text: "위대한 일은 작은 일들의 연속으로 이루어진다.", author: "빈센트 반 고흐" },
  { text: "시작이 반이다.", author: "아리스토텔레스" },
  { text: "꿈을 꾸는 것만으로는 부족하다. 행동하라.", author: "월트 디즈니" },
  { text: "실패는 성공의 어머니다.", author: "토마스 에디슨" },
  { text: "열정 없이 이루어진 위대한 일은 없다.", author: "랄프 왈도 에머슨" },
  { text: "오늘이라는 날은 다시 오지 않는다.", author: "단테" },
  { text: "할 수 있다고 믿으면 이미 반은 이룬 것이다.", author: "시어도어 루스벨트" },
  { text: "작은 기회로부터 위대한 업적이 시작된다.", author: "데모스테네스" },
  { text: "노력은 배신하지 않는다.", author: "격언" },
  { text: "매일 조금씩 나아지면 된다.", author: "존 우든" },
  { text: "포기하지 않으면 실패는 없다.", author: "격언" },
  { text: "지금 이 순간이 가장 좋은 시작이다.", author: "격언" },
  { text: "변화를 원한다면 스스로 변화가 되어라.", author: "마하트마 간디" },
  { text: "목표를 향해 한 걸음씩 나아가라.", author: "공자" },
  { text: "인내는 쓰지만 그 열매는 달다.", author: "장 자크 루소" },
  { text: "어려운 일이 있어야 강해진다.", author: "세네카" },
  { text: "오늘의 나는 어제보다 나은 사람이다.", author: "격언" },
  { text: "좋은 습관이 좋은 인생을 만든다.", author: "격언" },
  { text: "행동이 모든 성공의 기본 열쇠이다.", author: "파블로 피카소" },
  { text: "과거에 얽매이지 말고 미래를 향해 나아가라.", author: "격언" },
  { text: "진정한 실패는 도전하지 않는 것이다.", author: "격언" },
  { text: "꾸준함은 천재를 이긴다.", author: "격언" },
  { text: "웃는 얼굴에 행운이 찾아온다.", author: "격언" },
  { text: "감사하는 마음이 풍요를 부른다.", author: "격언" },
  { text: "오늘도 최선을 다하는 당신이 멋집니다.", author: "격언" },
  { text: "함께하면 더 멀리 갈 수 있다.", author: "아프리카 속담" },
  { text: "성장은 편안한 영역 밖에서 시작된다.", author: "격언" },
  { text: "작은 성취를 축하하라, 큰 성공으로 이어진다.", author: "격언" },
  { text: "긍정적인 생각이 긍정적인 결과를 만든다.", author: "격언" },
];

const checkpoints = [
  '오늘 처리할 일 중 하나를 먼저 닫기',
  '납기 예정 건을 먼저 확인하기',
  '발행 견적 중 답변 필요한 건 확인하기',
  '채널톡 문의 중 미배정 건 정리하기',
  '포트폴리오 사례 하나를 상담에 활용하기',
];

const getDateKey = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const DailyQuoteCard: React.FC = () => {
  const [revealed, setRevealed] = useState(false);
  const [autoHint, setAutoHint] = useState(false);

  const todayQuote = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    return quotes[dayOfYear % quotes.length];
  }, []);

  const todayCheckpoint = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    return checkpoints[dayOfYear % checkpoints.length];
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `acbank:dashboard-quote-hint:${getDateKey()}`;
    try {
      if (window.localStorage.getItem(key) === 'true') return;
      window.localStorage.setItem(key, 'true');
      setAutoHint(true);
      const timer = window.setTimeout(() => setAutoHint(false), 2400);
      return () => window.clearTimeout(timer);
    } catch {
      // Ignore restricted storage modes.
    }
  }, []);

  const handleReveal = () => {
    const nextRevealed = !revealed;
    setRevealed(nextRevealed);
    setAutoHint(false);
    if (nextRevealed) {
      triggerDailyHamzzi('dashboard-checkpoint', 'dashboard_checkpoint', {
        message: '오늘 체크포인트를 열었습니다.',
        description: todayCheckpoint,
        durationMs: 3200,
      });
    }
  };

  return (
    <Card
      className={cn(
        'dashboard-quote-card h-full w-full cursor-pointer rounded-2xl border-border bg-card shadow-none outline-none',
        revealed && 'dashboard-quote-card--revealed',
        autoHint && 'dashboard-quote-card--hint',
      )}
      role="button"
      tabIndex={0}
      onClick={handleReveal}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleReveal();
        }
      }}
      aria-expanded={revealed}
    >
      <CardContent className="flex h-full min-h-[132px] items-center p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="mb-2 text-sm font-semibold text-foreground">오늘의 한 줄</p>
            <p className="text-sm leading-relaxed text-foreground">"{todayQuote.text}"</p>
            <p className="mt-2 text-xs text-muted-foreground">— {todayQuote.author}</p>
            <div
              className="dashboard-checkpoint mt-3 overflow-hidden rounded-lg border border-border bg-muted/35 px-3 text-xs text-muted-foreground"
              data-open={revealed ? 'true' : 'false'}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-foreground" />
                <span className="font-semibold text-foreground">오늘의 체크포인트</span>
              </div>
              <p className="mt-1 leading-relaxed">{todayCheckpoint}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyQuoteCard;
