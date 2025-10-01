-- 원판 재질 타입
CREATE TYPE panel_material AS ENUM ('acrylic', 'pet');

-- 원판 품질 타입
CREATE TYPE panel_quality AS ENUM ('glossy-color', 'glossy-standard', 'astel-color', 'satin-color');

-- 원판 마스터 테이블 (재질, 품질별 기본 정보)
CREATE TABLE public.panel_masters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material panel_material NOT NULL,
  quality panel_quality NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(material, quality)
);

-- 원판 사이즈 정보 테이블
CREATE TABLE public.panel_sizes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_master_id UUID REFERENCES public.panel_masters(id) ON DELETE CASCADE NOT NULL,
  thickness TEXT NOT NULL, -- '10T', '15T' 등
  size_name TEXT NOT NULL, -- '3*6', '4*8' 등
  actual_width INTEGER NOT NULL, -- 실제 가로 크기 (mm)
  actual_height INTEGER NOT NULL, -- 실제 세로 크기 (mm)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(panel_master_id, thickness, size_name)
);

-- 원판 가격 테이블
CREATE TABLE public.panel_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_size_id UUID REFERENCES public.panel_sizes(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  effective_from TIMESTAMP WITH TIME ZONE DEFAULT now(),
  effective_to TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 색상 믹싱 비용 테이블
CREATE TABLE public.color_mixing_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  panel_master_id UUID REFERENCES public.panel_masters(id) ON DELETE CASCADE NOT NULL,
  thickness TEXT NOT NULL,
  cost DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(panel_master_id, thickness)
);

-- RLS 활성화
ALTER TABLE public.panel_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.panel_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.color_mixing_costs ENABLE ROW LEVEL SECURITY;

-- 모든 사용자가 읽을 수 있도록 (견적/수율 계산에 필요)
CREATE POLICY "Anyone can read panel masters"
  ON public.panel_masters FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read panel sizes"
  ON public.panel_sizes FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read panel prices"
  ON public.panel_prices FOR SELECT
  USING (true);

CREATE POLICY "Anyone can read color mixing costs"
  ON public.color_mixing_costs FOR SELECT
  USING (true);

-- 관리자만 수정 가능 (나중에 관리자 role 추가 시 수정)
CREATE POLICY "Authenticated users can manage panel masters"
  ON public.panel_masters FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage panel sizes"
  ON public.panel_sizes FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage panel prices"
  ON public.panel_prices FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage color mixing costs"
  ON public.color_mixing_costs FOR ALL
  USING (auth.uid() IS NOT NULL);

-- 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 각 테이블에 트리거 추가
CREATE TRIGGER update_panel_masters_updated_at
  BEFORE UPDATE ON public.panel_masters
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_panel_sizes_updated_at
  BEFORE UPDATE ON public.panel_sizes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_panel_prices_updated_at
  BEFORE UPDATE ON public.panel_prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_color_mixing_costs_updated_at
  BEFORE UPDATE ON public.color_mixing_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 인덱스 추가 (성능 향상)
CREATE INDEX idx_panel_sizes_master_id ON public.panel_sizes(panel_master_id);
CREATE INDEX idx_panel_prices_size_id ON public.panel_prices(panel_size_id);
CREATE INDEX idx_panel_prices_effective ON public.panel_prices(effective_from, effective_to);
CREATE INDEX idx_color_mixing_costs_master_id ON public.color_mixing_costs(panel_master_id);