
-- Performance review cycles (quarterly periods)
CREATE TABLE public.performance_review_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  quarter integer NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  title text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, quarter)
);

ALTER TABLE public.performance_review_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review cycles" ON public.performance_review_cycles FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage review cycles" ON public.performance_review_cycles FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));
CREATE POLICY "Authenticated users can read active cycles" ON public.performance_review_cycles FOR SELECT USING (auth.uid() IS NOT NULL);

-- Performance review scoring categories
CREATE TABLE public.performance_review_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  weight numeric NOT NULL DEFAULT 1,
  display_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_review_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage review categories" ON public.performance_review_categories FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage review categories" ON public.performance_review_categories FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));
CREATE POLICY "Anyone can read review categories" ON public.performance_review_categories FOR SELECT USING (true);

-- Individual review submissions
CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.performance_review_cycles(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL,
  reviewee_id uuid NOT NULL,
  reviewer_name text NOT NULL,
  reviewee_name text NOT NULL,
  reviewer_type text NOT NULL DEFAULT 'peer',
  overall_grade text,
  goal_achievement_rate numeric,
  strengths text,
  improvements text,
  general_comment text,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all reviews" ON public.performance_reviews FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all reviews" ON public.performance_reviews FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));
CREATE POLICY "Users can manage their own reviews" ON public.performance_reviews FOR ALL USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);
CREATE POLICY "Users can view reviews about them" ON public.performance_reviews FOR SELECT USING (auth.uid() = reviewee_id AND status = 'submitted');

-- Per-category scores within a review
CREATE TABLE public.performance_review_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.performance_reviews(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.performance_review_categories(id) ON DELETE CASCADE,
  score integer NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 10),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.performance_review_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all scores" ON public.performance_review_scores FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Moderators can manage all scores" ON public.performance_review_scores FOR ALL USING (has_role(auth.uid(), 'moderator')) WITH CHECK (has_role(auth.uid(), 'moderator'));
CREATE POLICY "Reviewers can manage their scores" ON public.performance_review_scores FOR ALL USING (
  EXISTS (SELECT 1 FROM public.performance_reviews r WHERE r.id = review_id AND r.reviewer_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.performance_reviews r WHERE r.id = review_id AND r.reviewer_id = auth.uid())
);
CREATE POLICY "Reviewees can view submitted scores" ON public.performance_review_scores FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.performance_reviews r WHERE r.id = review_id AND r.reviewee_id = auth.uid() AND r.status = 'submitted')
);

-- Insert default evaluation categories
INSERT INTO public.performance_review_categories (name, description, weight, display_order) VALUES
  ('업무 수행 능력', '담당 업무에 대한 전문성과 실행력', 2, 1),
  ('협업 및 커뮤니케이션', '팀원과의 소통, 협력, 갈등 해결 능력', 1.5, 2),
  ('책임감 및 성실성', '업무에 대한 책임감, 시간 준수, 꼼꼼함', 1.5, 3),
  ('문제 해결 능력', '예상치 못한 상황에 대한 대처 및 해결 능력', 1, 4),
  ('리더십 / 팔로워십', '팀을 이끌거나 따르는 능력', 1, 5),
  ('성장 및 자기 개발', '새로운 기술 습득, 자기 발전 노력', 1, 6);
