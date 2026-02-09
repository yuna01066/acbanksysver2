
-- 분기별 같은 인물에게 한 개의 평가만 가능하도록 유니크 제약조건 추가
ALTER TABLE public.performance_reviews 
ADD CONSTRAINT unique_review_per_cycle_reviewer_reviewee 
UNIQUE (cycle_id, reviewer_id, reviewee_id);

-- 관리자가 발송하는 업무 평가 요약 테이블
CREATE TABLE public.performance_review_summaries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cycle_id UUID NOT NULL REFERENCES public.performance_review_cycles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL,
  reviewee_name TEXT NOT NULL,
  sent_by UUID NOT NULL,
  sent_by_name TEXT NOT NULL,
  overall_grade TEXT,
  avg_score NUMERIC,
  avg_goal_rate NUMERIC,
  category_scores JSONB DEFAULT '[]'::jsonb,
  strengths_summary TEXT,
  improvements_summary TEXT,
  general_comment TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(cycle_id, reviewee_id)
);

-- RLS 활성화
ALTER TABLE public.performance_review_summaries ENABLE ROW LEVEL SECURITY;

-- 관리자 전체 관리
CREATE POLICY "Admins can manage all summaries"
ON public.performance_review_summaries FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 중간관리자 전체 관리
CREATE POLICY "Moderators can manage all summaries"
ON public.performance_review_summaries FOR ALL
USING (has_role(auth.uid(), 'moderator'::app_role))
WITH CHECK (has_role(auth.uid(), 'moderator'::app_role));

-- 본인의 요약만 열람 가능
CREATE POLICY "Users can view their own summaries"
ON public.performance_review_summaries FOR SELECT
USING (auth.uid() = reviewee_id);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER update_performance_review_summaries_updated_at
BEFORE UPDATE ON public.performance_review_summaries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
