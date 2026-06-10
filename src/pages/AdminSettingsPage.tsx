import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  Briefcase,
  Building2,
  CalendarCheck2,
  ClipboardCheck,
  Code,
  FileSignature,
  FileText,
  HardDrive,
  Images,
  Landmark,
  Lock,
  LockKeyhole,
  MessageSquareText,
  Package,
  Palette,
  Receipt,
  Search,
  Settings,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth, ROLE_LABELS } from '@/contexts/AuthContext';
import SecretEventManager from '@/components/admin/SecretEventManager';
import SettingsChangeRequestsPanel from '@/components/admin/SettingsChangeRequestsPanel';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { isCompanyMasterEmail } from '@/lib/companyMaster';
import { cn } from '@/lib/utils';

type AdminFeatureCategory = 'approval' | 'people' | 'quote' | 'sales' | 'system';
type AdminFeatureAccess = 'admin-or-moderator' | 'admin' | 'master';
type AdminFeatureDialog = 'settings-requests' | 'secret-event';

type AdminFeatureItem = {
  id: string;
  title: string;
  description: string;
  category: AdminFeatureCategory;
  icon: LucideIcon;
  keywords: string;
  access: AdminFeatureAccess;
  priority: number;
  path?: string;
  dialog?: AdminFeatureDialog;
  badge?: string;
};

const CATEGORY_META: Record<AdminFeatureCategory, { label: string; description: string }> = {
  approval: { label: '승인·검토', description: '대기 중인 운영 검토와 승인 흐름' },
  people: { label: '인사·계약', description: '구성원, 전자계약, 평가 운영' },
  quote: { label: '견적·제작', description: '견적 작성과 제작 단가 설정' },
  sales: { label: '고객·영업', description: '고객 접점과 외부 운영 도구' },
  system: { label: '시스템·권한', description: '민감정보, 권한, 데이터 관리' },
};

const ACCESS_LABELS: Record<AdminFeatureAccess, string> = {
  'admin-or-moderator': '관리자·중간관리자',
  admin: '관리자',
  master: '마스터',
};

const ADMIN_FEATURES: AdminFeatureItem[] = [
  {
    id: 'settings-change-requests',
    title: '설정 변경 승인 요청',
    description: '중간관리자가 요청한 고위험 설정 변경을 검토하고 반영합니다.',
    category: 'approval',
    icon: Shield,
    keywords: '설정 변경 승인 요청 review approval settings change',
    access: 'admin-or-moderator',
    priority: 10,
    dialog: 'settings-requests',
    badge: '검토',
  },
  {
    id: 'review-hub',
    title: '승인/검토 센터',
    description: '휴가 승인, 파일 동기화, 견적 연결, 설정 변경 요청을 확인합니다.',
    category: 'approval',
    icon: ClipboardCheck,
    keywords: '승인 검토 휴가 파일 동기화 견적 연결 review hub approval',
    access: 'admin-or-moderator',
    priority: 20,
    path: '/review-hub',
  },
  {
    id: 'employee-profiles',
    title: '직원 관리',
    description: '구성원 프로필, 권한, 인사 문서와 직원 상태를 관리합니다.',
    category: 'people',
    icon: Users,
    keywords: '직원 구성원 권한 인사 employee profile user management',
    access: 'admin',
    priority: 10,
    path: '/employee-profiles',
  },
  {
    id: 'electronic-contracts',
    title: '전자계약 작성',
    description: '계약 양식 선택, 구성원 다중 발송, 서명 내역을 확인합니다.',
    category: 'people',
    icon: FileSignature,
    keywords: '전자계약 계약 서명 발송 contract signature employee',
    access: 'admin',
    priority: 20,
    path: '/employee-profiles?tab=contracts',
    badge: '계약',
  },
  {
    id: 'pay-statements',
    title: '급여명세 발행',
    description: '직원별 월 급여명세를 작성, 발행, 회수하고 열람 이력을 확인합니다.',
    category: 'people',
    icon: Receipt,
    keywords: '급여명세 급여 발행 payroll pay statement salary',
    access: 'admin-or-moderator',
    priority: 25,
    path: '/employee-profiles?tab=pay-statements',
    badge: '급여',
  },
  {
    id: 'review-settings',
    title: '업무평가 설정',
    description: '평가 주기, 항목, 평가 운영 기준을 설정합니다.',
    category: 'people',
    icon: Star,
    keywords: '업무 평가 평가주기 평가항목 review settings performance',
    access: 'admin-or-moderator',
    priority: 30,
    path: '/review-settings',
  },
  {
    id: 'quote-wizard',
    title: '견적 마법사',
    description: '도면 파일 분석과 임시 견적 초안을 생성합니다.',
    category: 'quote',
    icon: Sparkles,
    keywords: '견적 마법사 도면 분석 파일 quote wizard drawing',
    access: 'admin',
    priority: 10,
    path: '/quote-wizard',
  },
  {
    id: 'panel-management',
    title: '원판 관리',
    description: '원판 사이즈, 두께, 컬러, 기준 단가를 관리합니다.',
    category: 'quote',
    icon: Palette,
    keywords: '원판 관리 컬러 사이즈 두께 panel price acrylic',
    access: 'admin',
    priority: 20,
    path: '/panel-management',
  },
  {
    id: 'processing-price-management',
    title: '가공 가격 관리',
    description: '추가 옵션과 가공 방식별 배수, 가격 규칙을 관리합니다.',
    category: 'quote',
    icon: Wrench,
    keywords: '가공 가격 옵션 배수 processing price option',
    access: 'admin',
    priority: 30,
    path: '/processing-price-management',
  },
  {
    id: 'quote-template-management',
    title: '견적서 템플릿 관리',
    description: '견적서 양식, 구분, 항목 표시 규칙을 관리합니다.',
    category: 'quote',
    icon: FileText,
    keywords: '견적서 템플릿 양식 quote template document',
    access: 'admin',
    priority: 40,
    path: '/quote-template-management',
  },
  {
    id: 'channel-talk-leads',
    title: '채널톡 문의 분석함',
    description: '도면 분석 리드, 고객 메모, 견적/프로젝트 전환을 처리합니다.',
    category: 'sales',
    icon: MessageSquareText,
    keywords: '채널톡 문의 리드 도면 분석 channel talk leads',
    access: 'admin-or-moderator',
    priority: 10,
    path: '/channel-talk-leads',
  },
  {
    id: 'response-assistant-management',
    title: '상담 응대 보조 관리',
    description: 'AI instruction, 응대 근거, 답변 템플릿을 관리합니다.',
    category: 'sales',
    icon: MessageSquareText,
    keywords: '상담 응대 보조 AI instruction prompt response assistant',
    access: 'admin',
    priority: 20,
    path: '/response-assistant-management',
  },
  {
    id: 'embed-code',
    title: '위젯 관리',
    description: '외부 사이트에 삽입할 견적·응대 위젯 코드를 관리합니다.',
    category: 'sales',
    icon: Code,
    keywords: '위젯 임베드 코드 embed widget',
    access: 'admin-or-moderator',
    priority: 30,
    path: '/embed-code',
  },
  {
    id: 'branding-intakes',
    title: '브랜딩 접수 관리',
    description: '브랜딩 접수 위젯 문의와 고객용 안내문, 내부 산정 내역을 관리합니다.',
    category: 'sales',
    icon: Sparkles,
    keywords: '브랜딩 접수 관리 예상금액 branding intake',
    access: 'admin-or-moderator',
    priority: 35,
    path: '/branding-intakes',
    badge: '브랜딩',
  },
  {
    id: 'meeting-reservations',
    title: '미팅 예약 관리',
    description: '직원/클라이언트 미팅 예약과 상담 일정을 운영합니다.',
    category: 'sales',
    icon: CalendarCheck2,
    keywords: '미팅 예약 회의 meeting reservation',
    access: 'admin-or-moderator',
    priority: 40,
    path: '/meeting-reservations',
  },
  {
    id: 'tax-invoices',
    title: '세금계산서 관리',
    description: '세금계산서 발행, 조회, 운영 상태를 관리합니다.',
    category: 'sales',
    icon: Receipt,
    keywords: '세금계산서 계산서 발행 tax invoice',
    access: 'admin',
    priority: 50,
    path: '/tax-invoices',
  },
  {
    id: 'sample-chip-inventory',
    title: '샘플칩 관리',
    description: '샘플칩 재고와 색상 운영 데이터를 관리합니다.',
    category: 'sales',
    icon: Package,
    keywords: '샘플칩 재고 sample chip inventory',
    access: 'admin-or-moderator',
    priority: 60,
    path: '/sample-chip-inventory',
  },
  {
    id: 'portfolio',
    title: '포트폴리오',
    description: '인테리어·제작가공 사진 자료를 열람하고 관리합니다.',
    category: 'sales',
    icon: Images,
    keywords: '포트폴리오 사진 제작 가공 portfolio images',
    access: 'admin-or-moderator',
    priority: 70,
    path: '/portfolio',
  },
  {
    id: 'exhibition-management',
    title: '박람회 관리',
    description: '박람회 일정, 준비 항목, 상담 운영을 관리합니다.',
    category: 'sales',
    icon: Landmark,
    keywords: '박람회 전시 상담 exhibition management',
    access: 'admin-or-moderator',
    priority: 80,
    path: '/exhibition-management',
  },
  {
    id: 'company-settings',
    title: '회사 설정',
    description: '회사 정보, 직인, 민감 설정을 2차 확인 후 관리합니다.',
    category: 'system',
    icon: Building2,
    keywords: '회사 설정 회사정보 직인 company settings master',
    access: 'master',
    priority: 10,
    path: '/company-settings',
    badge: '마스터',
  },
  {
    id: 'sensitive-access',
    title: '민감 권한 설정',
    description: '기능별 접근 권한과 회사 설정 접근 범위를 관리합니다.',
    category: 'system',
    icon: LockKeyhole,
    keywords: '민감 권한 접근 권한 access permission sensitive',
    access: 'master',
    priority: 20,
    path: '/company-settings?tab=access',
  },
  {
    id: 'sensitive-info',
    title: '민감정보 관리',
    description: '매출·인사·급여·평가 정보 접근을 보호된 영역에서 관리합니다.',
    category: 'system',
    icon: TrendingUp,
    keywords: '민감정보 매출 인사 급여 평가 sensitive information',
    access: 'master',
    priority: 30,
    path: '/company-settings?tab=sensitive',
  },
  {
    id: 'storage-status',
    title: '스토리지 현황',
    description: '데이터 스토리지 잔여량과 파일 사용 현황을 확인합니다.',
    category: 'system',
    icon: HardDrive,
    keywords: '스토리지 저장소 데이터 파일 storage status',
    access: 'admin',
    priority: 40,
    path: '/storage-status',
  },
  {
    id: 'business-dashboard',
    title: '경영 대시보드',
    description: '매출, 비용, 수익성 지표를 관리자 관점에서 확인합니다.',
    category: 'system',
    icon: Briefcase,
    keywords: '경영 대시보드 매출 비용 수익 business dashboard',
    access: 'admin',
    priority: 50,
    path: '/business-dashboard',
  },
  {
    id: 'secret-event',
    title: '시크릿 이벤트 관리',
    description: '특정 시간/날짜에 표시되는 대시보드 메시지를 관리합니다.',
    category: 'system',
    icon: Sparkles,
    keywords: '시크릿 이벤트 대시보드 메시지 secret event',
    access: 'admin',
    priority: 60,
    dialog: 'secret-event',
  },
  {
    id: 'error-logs',
    title: '클라이언트 오류 로그',
    description: '사용자 화면에서 발생한 JS 오류와 미처리 예외를 조회합니다.',
    category: 'system',
    icon: AlertTriangle,
    keywords: '오류 로그 에러 error log client 추적',
    access: 'admin',
    priority: 70,
    path: '/error-logs',
  },
];

const CATEGORY_ORDER: AdminFeatureCategory[] = ['approval', 'people', 'quote', 'sales', 'system'];
const QUICK_ACTION_IDS = ['review-hub', 'electronic-contracts', 'quote-wizard', 'company-settings'];

function includesQuery(feature: AdminFeatureItem, query: string) {
  const categoryLabel = CATEGORY_META[feature.category].label;
  return `${feature.title} ${feature.description} ${feature.keywords} ${categoryLabel}`
    .toLowerCase()
    .includes(query);
}

const AdminSettingsPage = () => {
  const navigate = useNavigate();
  const { user, userRole, isAdmin, loading } = useAuth();
  const [activeCategory, setActiveCategory] = useState<AdminFeatureCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const isMaster = isCompanyMasterEmail(user?.email);

  useEffect(() => {
    if (!loading && userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
    }
  }, [loading, userRole, navigate]);

  const canAccessFeature = (feature: AdminFeatureItem) => {
    if (feature.access === 'admin-or-moderator') return userRole === 'admin' || userRole === 'moderator';
    if (feature.access === 'admin') return isAdmin;
    return isMaster;
  };

  const sortedFeatures = useMemo(
    () => [...ADMIN_FEATURES].sort((a, b) => a.category.localeCompare(b.category) || a.priority - b.priority),
    [],
  );

  const filteredFeatures = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return sortedFeatures.filter((feature) => {
      const categoryMatches = activeCategory === 'all' || feature.category === activeCategory;
      const queryMatches = query.length === 0 || includesQuery(feature, query);
      return categoryMatches && queryMatches;
    });
  }, [activeCategory, searchQuery, sortedFeatures]);

  const featureStats = useMemo(() => {
    const accessible = ADMIN_FEATURES.filter(canAccessFeature).length;
    return {
      total: ADMIN_FEATURES.length,
      accessible,
      locked: ADMIN_FEATURES.length - accessible,
    };
  }, [isAdmin, isMaster, userRole]);

  const quickActions = useMemo(
    () => QUICK_ACTION_IDS
      .map((id) => ADMIN_FEATURES.find((feature) => feature.id === id))
      .filter((feature): feature is AdminFeatureItem => Boolean(feature)),
    [],
  );

  const renderDialogContent = (dialog: AdminFeatureDialog) => {
    if (dialog === 'settings-requests') {
      return <SettingsChangeRequestsPanel />;
    }

    return <SecretEventManager />;
  };

  const renderFeatureTile = (feature: AdminFeatureItem, compact = false) => {
    const Icon = feature.icon;
    const locked = !canAccessFeature(feature);
    const tile = (
      <button
        type="button"
        disabled={locked}
        onClick={() => {
          if (!locked && feature.path) navigate(feature.path);
        }}
        className={cn(
          'group flex w-full items-start gap-3 rounded-lg border border-border bg-white p-3 text-left transition-colors',
          'hover:border-foreground/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'min-h-[88px]' : 'min-h-[112px]',
          locked && 'cursor-not-allowed opacity-55 hover:border-border hover:bg-white',
        )}
      >
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">{feature.title}</span>
            {feature.badge && (
              <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                {feature.badge}
              </Badge>
            )}
            {locked && (
              <Badge variant="secondary" className="rounded-full px-2 py-0 text-[10px]">
                잠김
              </Badge>
            )}
          </span>
          <span className="mt-1 line-clamp-2 block text-xs leading-5 text-muted-foreground">
            {feature.description}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{CATEGORY_META[feature.category].label}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              {locked && <Lock className="h-3 w-3" />}
              {ACCESS_LABELS[feature.access]}
            </span>
          </span>
        </span>
      </button>
    );

    if (!feature.dialog || locked) return tile;

    return (
      <Dialog>
        <DialogTrigger asChild>{tile}</DialogTrigger>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto p-0">
          {renderDialogContent(feature.dialog)}
        </DialogContent>
      </Dialog>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    );
  }

  if (userRole !== 'admin' && userRole !== 'moderator') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <Card className="w-full max-w-md border-border bg-white shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>접근 권한 없음</CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">이 페이지에 접근할 권한이 없습니다.</p>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full rounded-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              홈으로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <PageShell maxWidth="7xl" className="bg-white">
      <PageHeader
        eyebrow="Admin"
        title="관리자 설정"
        description="운영 기능을 업무 도메인별로 찾고, 고위험 설정 변경은 승인 흐름으로 검토합니다."
        icon={<Settings className="h-5 w-5" />}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-foreground px-3 py-1 text-background hover:bg-foreground">
              현재 역할 {userRole ? ROLE_LABELS[userRole] : '미확인'}
            </Badge>
            {isMaster && (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                마스터 계정
              </Badge>
            )}
          </div>
        )}
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/25 p-4">
          <p className="text-xs font-medium text-muted-foreground">전체 기능</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{featureStats.total}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/25 p-4">
          <p className="text-xs font-medium text-muted-foreground">접근 가능</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{featureStats.accessible}</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/25 p-4">
          <p className="text-xs font-medium text-muted-foreground">권한 필요</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{featureStats.locked}</p>
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <SettingsChangeRequestsPanel variant="compact" maxItems={3} />
        <Card className="border-border bg-white shadow-none">
          <CardHeader className="p-4 pb-3">
            <CardTitle className="text-base">빠른 작업</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-1">
            {quickActions.map((feature) => (
              <React.Fragment key={feature.id}>
                {renderFeatureTile(feature, true)}
              </React.Fragment>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="rounded-lg border border-border bg-white p-3 shadow-none sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={cn(
                'h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors',
                activeCategory === 'all'
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-white text-muted-foreground hover:text-foreground',
              )}
            >
              전체
            </button>
            {CATEGORY_ORDER.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition-colors',
                  activeCategory === category
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border bg-white text-muted-foreground hover:text-foreground',
                )}
              >
                {CATEGORY_META[category].label}
              </button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="기능, 키워드 검색"
              className="h-10 rounded-full border-border bg-white pl-9 text-sm"
            />
          </div>
        </div>
      </section>

      {filteredFeatures.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center">
          <p className="text-sm font-medium text-foreground">검색 결과가 없습니다.</p>
          <p className="mt-1 text-xs text-muted-foreground">검색어를 줄이거나 다른 분류를 선택해보세요.</p>
        </div>
      ) : activeCategory === 'all' && searchQuery.trim().length === 0 ? (
        <div className="space-y-6">
          {CATEGORY_ORDER.map((category) => {
            const categoryFeatures = filteredFeatures.filter((feature) => feature.category === category);
            if (categoryFeatures.length === 0) return null;

            return (
              <section key={category} className="space-y-3">
                <div className="flex flex-col gap-1 border-b border-border pb-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{CATEGORY_META[category].label}</h2>
                    <p className="text-xs text-muted-foreground">{CATEGORY_META[category].description}</p>
                  </div>
                  <Badge variant="outline" className="w-fit rounded-full">
                    {categoryFeatures.length}개
                  </Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {categoryFeatures.map((feature) => (
                    <React.Fragment key={feature.id}>
                      {renderFeatureTile(feature)}
                    </React.Fragment>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex items-end justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {activeCategory === 'all' ? '검색 결과' : CATEGORY_META[activeCategory].label}
              </h2>
              <p className="text-xs text-muted-foreground">
                {activeCategory === 'all' ? '입력한 검색어와 일치하는 기능입니다.' : CATEGORY_META[activeCategory].description}
              </p>
            </div>
            <Badge variant="outline" className="rounded-full">
              {filteredFeatures.length}개
            </Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredFeatures.map((feature) => (
              <React.Fragment key={feature.id}>
                {renderFeatureTile(feature)}
              </React.Fragment>
            ))}
          </div>
        </section>
      )}
    </PageShell>
  );
};

export default AdminSettingsPage;
