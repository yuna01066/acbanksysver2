import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles } from 'lucide-react';

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

const DailyQuoteCard: React.FC = () => {
  const todayQuote = useMemo(() => {
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    return quotes[dayOfYear % quotes.length];
  }, []);

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/20 to-primary/20 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold mb-1">오늘의 명언</p>
            <p className="text-sm leading-relaxed">"{todayQuote.text}"</p>
            <p className="text-xs text-muted-foreground mt-1">— {todayQuote.author}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DailyQuoteCard;
