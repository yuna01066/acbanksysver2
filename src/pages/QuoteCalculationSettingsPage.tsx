import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calculator,
  CheckCircle2,
  Database,
  Layers,
  ListChecks,
  Loader2,
  Package,
  Palette,
  Settings2,
  ShieldCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageShell } from '@/components/layout/PageLayout';
import { MaterialSelector } from '@/components/panel-management/MaterialSelector';
import { ProductSelector } from '@/components/panel-management/ProductSelector';
import { PanelSizeManager } from '@/components/panel-management/UnifiedSizePriceManager';
import ColorManager from '@/components/panel-management/ColorManager';
import { PanelCatalogValidationReport } from '@/components/panel-management/PanelCatalogValidationReport';
import ProcessingOptionsManager from '@/components/admin/ProcessingOptionsManager';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const TABS = [
  'flow',
  'panel-base',
  'panel-surcharges',
  'processing-options',
  'processing-logic',
  'validation',
] as const;

type QuoteCalculationTab = typeof TABS[number];

const TAB_META: Record<QuoteCalculationTab, { label: string; icon: LucideIcon; description: string }> = {
  flow: {
    label: '계산 흐름',
    icon: Calculator,
    description: '견적 계산기가 원판가, 추가금, 가공비를 합산하는 순서를 확인합니다.',
  },
  'panel-base': {
    label: '원판 기준가',
    icon: Package,
    description: '소재와 재질별 두께, 원장 사이즈, 실규격, 기준가, 활성 여부를 관리합니다.',
  },
  'panel-surcharges': {
    label: '원판 추가금',
    icon: Palette,
    description: '양면, 사틴/아스텔, 브라이트/진백, 조색비처럼 원판가에 더해지는 값을 관리합니다.',
  },
  'processing-options': {
    label: '가공 옵션',
    icon: Wrench,
    description: '정액비, 원장 배수, 추가율, 개당, m당, 코너당, 검수 필요 옵션 단가를 관리합니다.',
  },
  'processing-logic': {
    label: '가공 로직',
    icon: Settings2,
    description: '견적 계산기 슬롯, 카테고리 노출 순서, 다중 선택과 수량 입력 여부를 관리합니다.',
  },
  validation: {
    label: '검증 리포트',
    icon: ShieldCheck,
    description: '활성 원판, 컬러, 추가금 기준정보의 누락과 차단 대상을 점검합니다.',
  },
};

const POLICY_ITEMS = [
  '정3X6은 대3*6과 같은 사이즈로 취급합니다.',
  '계산기 선택지는 소3*6과 대3*6 두 가지 기준만 유지합니다.',
  '원판 기준가는 A/B 단가 중 높은 금액에 3% 버퍼를 적용합니다.',
  '원판 기준가와 추가금은 100원 단위 올림 기준으로 관리합니다.',
  '공식 단가표가 바뀌면 DB 값과 fallback 데이터가 함께 맞아야 합니다.',
];

const FLOW_STEPS = [
  {
    title: '1. 원판 기본가',
    description: '소재, 재질, 두께, 원장 사이즈로 panel_sizes 기준가를 찾습니다.',
    source: 'panel_sizes',
    icon: Package,
  },
  {
    title: '2. 원판 추가금',
    description: '양면, 사틴/아스텔, 브라이트/진백, 조색비를 선택 조합에 맞게 더합니다.',
    source: 'panel_option_surcharges · color_mixing_costs',
    icon: Layers,
  },
  {
    title: '3. 가공 옵션',
    description: '재단, CNC, 레이저, 접착, 코너 등 processing_options와 advanced settings를 적용합니다.',
    source: 'processing_options · advanced_processing_settings',
    icon: Wrench,
  },
  {
    title: '4. 노출 로직',
    description: '슬롯과 카테고리 설정으로 계산기에 어떤 옵션을 보여줄지 결정합니다.',
    source: 'slot_types · category_logic_slots',
    icon: ListChecks,
  },
];

const CHECK_CASES = [
  { label: '5T 대3*6 단면', detail: '원판 기준가 단독 검산' },
  { label: '5T 4*8 양면', detail: '원판 기준가 + 양면 추가금' },
  { label: '사틴/아스텔 허용 사이즈', detail: '생산 가능 조합만 활성 상태인지 확인' },
  { label: 'raw-only', detail: '원장 구매 문의처럼 가공 없는 견적' },
  { label: '단순 재단', detail: '원장 수량과 기본 재단비 조합' },
  { label: 'CNC/레이저 정액 공임', detail: 'fixed_fee와 검수 필요 옵션 확인' },
];

const STATUS_ITEMS = [
  { label: '계산식', value: '유지' },
  { label: '저장 위치', value: '기존 DB' },
  { label: '적용 기준', value: '신규 견적' },
  { label: '가격 정책', value: 'AB+3%' },
];

const getTab = (value: string | null): QuoteCalculationTab => (
  TABS.includes(value as QuoteCalculationTab) ? value as QuoteCalculationTab : 'flow'
);

const FormulaPolicyCard = () => (
  <Card className="rounded-lg border-border bg-white shadow-none">
    <CardHeader className="px-4 pb-2 pt-4">
      <CardTitle className="flex items-center gap-2 text-sm">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        현재 가격 정책
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-2 px-4 pb-4">
      {POLICY_ITEMS.map((item) => (
        <div key={item} className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" />
          <span>{item}</span>
        </div>
      ))}
    </CardContent>
  </Card>
);

const RepresentativeCheckPanel = () => (
  <Card className="rounded-lg border-border bg-white shadow-none">
    <CardHeader className="px-4 pb-2 pt-4">
      <CardTitle className="flex items-center gap-2 text-sm">
        <ListChecks className="h-4 w-4 text-muted-foreground" />
        저장 전 대표 검산
      </CardTitle>
    </CardHeader>
    <CardContent className="px-4 pb-4">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {CHECK_CASES.map((item) => (
          <div key={item.label} className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <div className="text-sm font-semibold text-foreground">{item.label}</div>
            <div className="mt-1 text-xs text-muted-foreground">{item.detail}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        단가를 바꾼 뒤에는 이 대표 케이스와 `/calculator?type=quote` 계산 결과가 의도대로 바뀌었는지 확인한 후 운영에 반영하세요.
      </div>
    </CardContent>
  </Card>
);

const FlowOverview = () => (
  <div className="space-y-4">
    <Card className="rounded-lg border-border bg-white shadow-none">
      <CardContent className="divide-y divide-border p-0">
      {FLOW_STEPS.map((step) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="grid gap-3 px-4 py-3 md:grid-cols-[180px_1fr_auto] md:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white">
                <Icon className="h-3.5 w-3.5 text-foreground" />
              </div>
              <div className="text-sm font-semibold">{step.title}</div>
            </div>
            <div className="text-xs leading-5 text-muted-foreground">{step.description}</div>
            <Badge variant="outline" className="w-fit rounded-full text-[11px]">
                {step.source}
              </Badge>
          </div>
        );
      })}
      </CardContent>
    </Card>
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <FormulaPolicyCard />
      <RepresentativeCheckPanel />
    </div>
  </div>
);

type SelectedMaterial = { id: string; name: string } | null;
type SelectedProduct = { id: string; name: string } | null;

const PanelCatalogSettings = ({ mode }: { mode: 'base' | 'surcharge' }) => {
  const [selectedMaterial, setSelectedMaterial] = useState<SelectedMaterial>(null);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct>(null);

  const intro = useMemo(() => (
    mode === 'base'
      ? {
          title: '원판 기준가 관리 순서',
          description: '소재와 재질을 먼저 선택하면 두께×사이즈 matrix에서 기준가, 실규격, 활성 여부를 수정할 수 있습니다.',
          badge: 'panel_sizes',
        }
      : {
          title: '추가금 관리 순서',
          description: '같은 matrix 안에서 양면, 사틴/아스텔, 안료, 조색비처럼 원판가에 더해지는 항목을 함께 확인합니다.',
          badge: 'panel_option_surcharges · color_mixing_costs',
        }
  ), [mode]);

  const handleSelectMaterial = (id: string, name: string) => {
    setSelectedMaterial({ id, name });
    setSelectedProduct(null);
  };

  const handleSelectProduct = (id: string, name: string) => {
    setSelectedProduct({ id, name });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 rounded-lg border border-border bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold">{intro.title}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground">{intro.description}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="w-fit rounded-full">{intro.badge}</Badge>
          <Badge variant="secondary" className="w-fit rounded-full">기존 견적 미변경</Badge>
        </div>
      </div>

      {!selectedMaterial && (
        <MaterialSelector
          onSelectMaterial={handleSelectMaterial}
          selectedMaterialId={selectedMaterial?.id || null}
          variant="compact"
        />
      )}

      {selectedMaterial && !selectedProduct && (
        <ProductSelector
          materialId={selectedMaterial.id}
          materialName={selectedMaterial.name}
          onSelectProduct={handleSelectProduct}
          onBack={() => setSelectedMaterial(null)}
          selectedProductId={selectedProduct?.id || null}
          variant="compact"
        />
      )}

      {selectedProduct && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="rounded-full">{selectedMaterial?.name}</Badge>
              <Badge variant="outline" className="rounded-full">{selectedProduct.name}</Badge>
              {mode === 'surcharge' && (
                <Badge variant="outline" className="rounded-full">추가금/조색비 확인</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
              <ArrowLeft className="h-4 w-4" />
              재질 선택
            </Button>
          </div>
          <PanelSizeManager
            qualityId={selectedProduct.id}
            qualityName={selectedProduct.name}
            onBack={() => setSelectedProduct(null)}
          />
          {mode === 'surcharge' && (
            <ColorManager qualityId={selectedProduct.id} />
          )}
        </div>
      )}
    </div>
  );
};

const QuoteCalculationSettingsPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isModerator, loading } = useAuth();
  const activeTab = getTab(searchParams.get('tab'));

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: getTab(value) });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || (!isAdmin && !isModerator)) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-sm border-border bg-white shadow-none">
          <CardContent className="p-6 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="mt-4 text-base font-semibold">관리자 권한이 필요합니다.</div>
            <p className="mt-2 text-sm text-muted-foreground">
              견적 계산 설정은 관리자와 중간관리자만 변경할 수 있습니다.
            </p>
            <Button className="mt-5 w-full" variant="outline" onClick={() => navigate('/')}>
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell maxWidth="full" contentClassName="max-w-[1480px] space-y-4">
      <header className="border-b border-border pb-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Calculator className="h-3.5 w-3.5" />
              Quote Calculation
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-normal text-foreground sm:text-[28px]">
              견적 계산 설정
            </h1>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">
              원판 기준가, 추가금, 가공 옵션과 계산기 노출 로직을 현재 산식 흐름에 맞춰 관리합니다.
            </p>
          </div>
          <Button variant="outline" size="sm" className="w-fit rounded-full shadow-none" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="h-4 w-4" />
            관리자 설정
          </Button>
        </div>
      </header>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-white px-4 py-3 shadow-none lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Database className="h-4 w-4 text-muted-foreground" />
            운영 단가 설정
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {STATUS_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-4 rounded-full border border-border bg-muted/20 px-3 py-1.5 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold text-foreground">{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
          <TabsList className="flex h-auto justify-start gap-1 overflow-x-auto rounded-full border border-border bg-white p-1 shadow-none">
            {TABS.map((tab) => {
              const meta = TAB_META[tab];
              const Icon = meta.icon;
              return (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className={cn(
                    'shrink-0 rounded-full px-3 py-2 text-xs data-[state=active]:bg-foreground data-[state=active]:text-background',
                    'data-[state=active]:shadow-none'
                  )}
                >
                  <Icon className="mr-1.5 h-3.5 w-3.5" />
                  {meta.label}
                </TabsTrigger>
              );
            })}
          </TabsList>

          <section className="flex flex-col gap-2 border-b border-border pb-3 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="text-base font-semibold">{TAB_META[activeTab].label}</div>
                <div className="mt-1 text-sm leading-5 text-muted-foreground">{TAB_META[activeTab].description}</div>
              </div>
              <Badge variant="outline" className="w-fit rounded-full">
                저장 전 대표 검산 권장
              </Badge>
          </section>

          <TabsContent value="flow" className="mt-0">
            <FlowOverview />
          </TabsContent>
          <TabsContent value="panel-base" className="mt-0">
            <PanelCatalogSettings mode="base" />
          </TabsContent>
          <TabsContent value="panel-surcharges" className="mt-0">
            <PanelCatalogSettings mode="surcharge" />
          </TabsContent>
          <TabsContent value="processing-options" className="mt-0">
            <ProcessingOptionsManager defaultTab="advanced" visibleTabs={['advanced']} />
          </TabsContent>
          <TabsContent value="processing-logic" className="mt-0">
            <ProcessingOptionsManager defaultTab="logic" visibleTabs={['logic']} />
          </TabsContent>
          <TabsContent value="validation" className="mt-0">
            <div className="space-y-4">
              <RepresentativeCheckPanel />
              <PanelCatalogValidationReport />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageShell>
  );
};

export default QuoteCalculationSettingsPage;
