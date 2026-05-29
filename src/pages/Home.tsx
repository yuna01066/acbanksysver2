import { lazy, Suspense, useState, useCallback } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Instagram, MessageCircle, MessageSquareText, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, User, LogOut, Building2, Clock, CalendarDays, FolderOpen, Star, Package, Receipt, Landmark, Palette, Images, Loader2 } from "lucide-react";
import LoginScreen from '@/components/LoginScreen';
import NotificationPanel from '@/components/NotificationPanel';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import DailyQuoteCard from '@/components/DailyQuoteCard';

import { useAuth } from '@/contexts/AuthContext';
import TimeGreeting from '@/components/TimeGreeting';
import { useNotifications } from '@/hooks/useNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { isCompanyMasterEmail } from '@/lib/companyMaster';

const DashboardCalendarPanel = lazy(() => import('@/components/dashboard/DashboardCalendarPanel'));
const ProjectProgressCard = lazy(() => import('@/components/ProjectProgressCard'));
const ActivityFeedCard = lazy(() => import('@/components/ActivityFeedCard'));
const TodayWorkCard = lazy(() => import('@/components/TodayWorkCard'));
const ChannelTalkInquiryCard = lazy(() => import('@/components/ChannelTalkInquiryCard'));
const DashboardMeetingBookingCard = lazy(() => import('@/components/DashboardMeetingBookingCard'));
const ImwebTopItemsCard = lazy(() => import('@/components/ImwebTopItemsCard'));
const OnlineEmployeesCard = lazy(() => import('@/components/OnlineEmployeesCard'));
const MeetingRequestPopup = lazy(() => import('@/components/MeetingRequestPopup'));
const TeamChatCard = lazy(() => import('@/components/TeamChatCard'));

const DashboardCardFallback = ({ className = '' }: { className?: string }) => (
  <div className={cn('min-h-[180px] rounded-2xl border border-border/70 bg-background/75 shadow-sm backdrop-blur', className)}>
    <div className="h-full animate-pulse rounded-2xl bg-muted/30" />
  </div>
);

const preloadDashboardRoute = (url?: string) => {
  if (!url || /^https?:\/\//i.test(url)) return;

  const path = url.split('?')[0];
  switch (path) {
    case '/attendance':
      void import('@/pages/AttendancePage');
      break;
    case '/leave-management':
      void import('@/pages/LeaveManagementPage');
      break;
    case '/recipients':
      void import('@/pages/RecipientManagementPage');
      break;
    case '/project-management':
      void import('@/pages/ProjectManagementPage');
      break;
    case '/material-orders':
      void import('@/pages/MaterialOrdersPage');
      break;
    case '/calculator':
      void import('@/pages/Calculator');
      break;
    case '/saved-quotes':
      void import('@/pages/SavedQuotesPage');
      break;
    case '/performance-review':
      void import('@/pages/PerformanceReviewPage');
      break;
    case '/channel-talk-leads':
      void import('@/pages/ChannelTalkLeadsPage');
      break;
    case '/admin-settings':
      void import('@/pages/AdminSettingsPage');
      break;
    case '/company-settings':
      void import('@/pages/CompanySettingsPage');
      break;
    case '/sample-chip-inventory':
      void import('@/pages/SampleChipInventoryPage');
      break;
    case '/portfolio':
      void import('@/pages/PortfolioPage');
      break;
    case '/references':
      void import('@/pages/ReferencePage');
      break;
    case '/exhibition-management':
      void import('@/pages/ExhibitionManagementPage');
      break;
    case '/tax-invoices':
      void import('@/pages/TaxInvoicesPage');
      break;
    case '/team-chat':
      void import('@/pages/TeamChatPage');
      break;
    case '/my-page':
      void import('@/pages/MyPage');
      break;
    case '/calendar':
      void import('@/pages/CalendarPage');
      break;
    default:
      break;
  }
};

type DashboardLink = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  url?: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  requiresMaster?: boolean;
  action: () => void;
};

const Home = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, isAdmin, isModerator, loading: authLoading } = useAuth();
  const isMaster = isCompanyMasterEmail(user?.email || profile?.email);
  const { theme, setTheme } = useTheme();
  const [logoSpinning, setLogoSpinning] = useState(false);
  const { notifications, unviewedCount, markAsViewed, removeNotification, refresh: refreshNotifications } = useNotifications();

  const handleLogoClick = useCallback(() => {
    if (logoSpinning) return;
    setLogoSpinning(true);
    
    // Play a subtle click sound
    try {
      const AudioContextCtor = window.AudioContext
        || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioContextCtor) {
        const audioCtx = new AudioContextCtor();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) { /* audio not supported */ }

    // Toggle theme after half rotation
    setTimeout(() => {
      setTheme(theme === 'dark' ? 'light' : 'dark');
      toast(theme === 'dark' ? '☀️ 라이트 모드로 전환!' : '🌙 다크 모드로 전환!', { duration: 1500 });
    }, 300);

    setTimeout(() => setLogoSpinning(false), 700);
  }, [logoSpinning, theme, setTheme]);
  const { data: activeCycle } = useQuery({
    queryKey: ['active-review-cycle'],
    queryFn: async () => {
      const { data } = await supabase
        .from('performance_review_cycles')
        .select('title')
        .eq('status', 'active')
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const quickLinks: DashboardLink[] = [
    { title: "홈페이지", description: "", icon: HomeIcon, url: "https://acbank.co.kr", action: () => window.open("https://acbank.co.kr", "_blank") },
    { title: "팀 채팅", description: "", icon: MessageCircle, url: "/team-chat", action: () => navigate("/team-chat") },
    { title: "인스타그램", description: "", icon: Instagram, url: "https://www.instagram.com/acbank.co.kr/", action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank") },
    { title: "아크뱅크 노션", description: "", icon: BookOpen, url: "https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank") },
  ];

  const links: DashboardLink[] = [{
    title: "근태 관리",
    icon: Clock,
    description: "출퇴근 기록 및 휴가 관리",
    url: "/attendance",
    requiresAuth: true,
    action: () => navigate("/attendance")
  }, {
    title: "연차 관리",
    icon: CalendarDays,
    description: "연차 신청/승인/잔여일수 관리",
    url: "/leave-management",
    requiresAuth: true,
    action: () => navigate("/leave-management")
  }, {
    title: "고객사 관리",
    icon: Building2,
    description: "거래처 정보 관리",
    url: "/recipients",
    requiresAuth: true,
    action: () => navigate("/recipients")
  }, {
    title: "프로젝트 관리",
    icon: FolderOpen,
    description: "프로젝트별 견적·고객 연결",
    url: "/project-management",
    requiresAuth: true,
    action: () => navigate("/project-management")
  }, {
    title: "원판 발주 관리",
    icon: Package,
    description: "자재 발주 내역 관리",
    url: "/material-orders",
    requiresAuth: true,
    action: () => navigate("/material-orders")
  }, {
    title: "수율 계산기",
    icon: TrendingUp,
    description: "패널 수율 최적화",
    url: "/calculator?type=yield",
    requiresAuth: true,
    action: () => navigate("/calculator?type=yield")
  }, {
    title: "견적 계산기",
    icon: Calculator,
    description: "스마트 판재 견적",
    url: "/calculator?type=quote",
    requiresAuth: true,
    action: () => navigate("/calculator?type=quote")
  }, {
    title: "발행 견적서 확인",
    icon: FileSpreadsheet,
    description: "저장된 견적서 관리",
    url: "/saved-quotes",
    requiresAuth: true,
    action: () => navigate("/saved-quotes")
  }, {
    title: "클라이언트 상담폼",
    icon: FileText,
    description: "상담 신청하기",
    url: "https://acbank.co.kr/acbankform",
    requiresAuth: true,
    action: () => window.open("https://acbank.co.kr/acbankform", "_blank")
  }, {
    title: "업무 평가",
    icon: Star,
    description: activeCycle ? `진행중: ${activeCycle.title}` : "직원 업무 평가 작성",
    url: "/performance-review",
    requiresAuth: true,
    action: () => navigate("/performance-review")
  }, {
    title: "채널톡 문의 분석함",
    icon: MessageSquareText,
    description: "AI 분석 문의 확인",
    url: "/channel-talk-leads",
    requiresAuth: true,
    action: () => navigate("/channel-talk-leads")
  }, {
    title: "관리자 설정",
    icon: Settings,
    description: "가격 및 옵션 관리",
    url: "/admin-settings",
    requiresAuth: true,
    requiresAdmin: true,
    action: () => {
      if (isAdmin || isModerator) {
        navigate("/admin-settings");
      } else {
        toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.');
      }
    }
  }];

  const handleCardClick = (link: DashboardLink) => {
    if (link.requiresAuth && !user) {
      toast.error('로그인이 필요한 서비스입니다.');
      navigate('/auth');
      return;
    }
    link.action();
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-transparent px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">로그인 상태를 확인하고 있습니다.</p>
      </div>
    );
  }

  // If not logged in, show login page
  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-6 sm:py-10">
        <div className="mx-auto max-w-7xl">
          {/* Top Bar */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <NotificationPanel
                notifications={notifications}
                unviewedCount={unviewedCount}
                onMarkViewed={markAsViewed}
                onRemove={removeNotification}
                onRefresh={refreshNotifications}
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => navigate('/team-chat')}
                onMouseEnter={() => preloadDashboardRoute('/team-chat')}
                onFocus={() => preloadDashboardRoute('/team-chat')}
                onPointerDown={() => preloadDashboardRoute('/team-chat')}
                title="팀챗"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/75 shadow-sm backdrop-blur transition-colors hover:bg-accent/40 active:scale-95">
                <MessageCircle className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button
                onClick={() => navigate('/my-page')}
                onMouseEnter={() => preloadDashboardRoute('/my-page')}
                onFocus={() => preloadDashboardRoute('/my-page')}
                onPointerDown={() => preloadDashboardRoute('/my-page')}
                title="마이페이지"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/75 shadow-sm backdrop-blur transition-colors hover:bg-accent/40 active:scale-95">
                <User className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={signOut}
                className="flex h-10 shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/75 px-3 text-[13px] font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:bg-accent/40 active:scale-95 sm:px-4">
                <LogOut className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">로그아웃</span>
              </button>
            </div>
          </div>

          {/* Header – subtle metal logo, kept from the original tone */}
          <div className="mb-6 space-y-2 text-center animate-fade-up sm:mb-8">
            <div className="inline-block logo-neon-wrap rounded-[22px] p-[4px]" onClick={handleLogoClick}>
              <div
                className={cn(
                  "cursor-pointer select-none rounded-[18px] px-8 py-2.5 logo-metal sm:px-12",
                  logoSpinning && "logo-spin-3d"
                )}
              >
                <h1 className="bg-gradient-to-b from-slate-600 to-slate-900 bg-clip-text text-3xl font-black leading-none tracking-[3px] text-transparent dark:from-slate-200 dark:to-slate-500 sm:text-[36px]">
                  ACBANK
                </h1>
              </div>
            </div>
            <p className="text-[11px] sm:text-[12px] font-medium tracking-[0.22em] uppercase" style={{ color: 'hsl(220 8% 42%)' }}>Management System</p>
          </div>

          <div className="mb-6 space-y-4 sm:space-y-5">
            {/* Quick icon links */}
            <div className="flex justify-center sm:justify-end">
              <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-background/70 p-1.5 shadow-sm backdrop-blur">
                {quickLinks.map((ql, i) => {
                  const QIcon = ql.icon;
                  return (
                    <button
                      key={i}
                      onClick={ql.action}
                      onMouseEnter={() => preloadDashboardRoute(ql.url)}
                      onFocus={() => preloadDashboardRoute(ql.url)}
                      onPointerDown={() => preloadDashboardRoute(ql.url)}
                      className="group flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent/45 hover:text-foreground sm:px-3"
                      title={ql.title}
                    >
                      <QIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span>{ql.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <TimeGreeting name={profile?.full_name || user.email?.split('@')[0] || '사용자'} avatarUrl={profile?.avatar_url} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <QuickAttendanceButton />
                <DailyQuoteCard />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)_minmax(320px,0.9fr)]">
              <Suspense fallback={<DashboardCardFallback className="min-h-[260px]" />}>
                <TodayWorkCard notifications={notifications} />
              </Suspense>
              <Suspense fallback={<DashboardCardFallback className="min-h-[260px]" />}>
                <DashboardMeetingBookingCard />
              </Suspense>
              <Suspense fallback={<DashboardCardFallback className="min-h-[260px]" />}>
                <ChannelTalkInquiryCard />
              </Suspense>
            </div>
            <Suspense fallback={<DashboardCardFallback className="min-h-[520px]" />}>
              <DashboardCalendarPanel />
            </Suspense>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Suspense fallback={<DashboardCardFallback />}>
                <ImwebTopItemsCard />
              </Suspense>
              <Suspense fallback={<DashboardCardFallback />}>
                <ActivityFeedCard />
              </Suspense>
              <Suspense fallback={<DashboardCardFallback />}>
                <ProjectProgressCard />
              </Suspense>
            </div>
          </div>

          {/* Checked-in staff and team chat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <Suspense fallback={<DashboardCardFallback className="min-h-[360px]" />}>
              <OnlineEmployeesCard />
            </Suspense>
            <Suspense fallback={<DashboardCardFallback className="min-h-[360px]" />}>
              <TeamChatCard />
            </Suspense>
          </div>

          {/* Links Grid */}
          {(() => {
            const secondaryLinks: DashboardLink[] = [
              { title: "회사 설정", icon: Building2, description: "마스터 전용 민감정보 관리", url: "/company-settings", requiresAuth: true, requiresMaster: true, action: () => navigate("/company-settings") },
              { title: "샘플칩 관리", icon: Palette, description: "샘플칩 재고 관리", url: "/sample-chip-inventory", requiresAuth: true, action: () => navigate("/sample-chip-inventory") },
              { title: "포트폴리오", icon: Images, description: "인테리어·제작가공 사진 열람", url: "/portfolio", requiresAuth: true, action: () => navigate("/portfolio") },
              { title: "레퍼런스", icon: Images, description: "상담용 이미지·메모 열람", url: "/references", requiresAuth: true, action: () => navigate("/references") },
              { title: "박람회 관리", icon: Landmark, description: "박람회 일정·준비·상담 관리", url: "/exhibition-management", requiresAuth: true, action: () => navigate("/exhibition-management") },
              { title: "세금계산서 관리", icon: Receipt, description: "세금계산서 발행·조회", url: "/tax-invoices", requiresAuth: true, action: () => navigate("/tax-invoices") },
            ];

            const byTitle = new Map(links.map((link) => [link.title, link]));
            const secondaryByTitle = new Map(secondaryLinks.map((link) => [link.title, link]));
            const pickLinks = (titles: string[]) => titles
              .map((title) => byTitle.get(title) || secondaryByTitle.get(title))
              .filter(Boolean) as DashboardLink[];

            const linkGroups = [
              { title: "업무", items: pickLinks(["근태 관리", "연차 관리", "업무 평가"]) },
              { title: "견적 · 프로젝트", items: pickLinks(["고객사 관리", "프로젝트 관리", "원판 발주 관리", "수율 계산기", "견적 계산기", "발행 견적서 확인"]) },
              { title: "관리", items: pickLinks(["채널톡 문의 분석함", "샘플칩 관리", "포트폴리오", "레퍼런스", "박람회 관리", "세금계산서 관리", "관리자 설정", "회사 설정"]) },
              { title: "외부", items: pickLinks(["클라이언트 상담폼"]) },
            ].filter((group) => group.items.length > 0);

            const renderCard = (item: DashboardLink, key: string) => {
              const Icon = item.icon;
              const isLocked = item.requiresAuth && !user;
              const isAdminOnly = item.requiresAdmin && !isAdmin && !isModerator;
              const isMasterOnly = item.requiresMaster && !isMaster;

              return (
                <div
                  key={key}
                  className={cn(
                    "group relative flex min-h-[92px] cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-background/75 p-3 text-left shadow-sm backdrop-blur transition-colors hover:bg-accent/35 sm:p-4",
                    (isLocked || isAdminOnly || isMasterOnly) ? "opacity-50 cursor-not-allowed" : ""
                  )}
                  onMouseEnter={() => preloadDashboardRoute(item.url)}
                  onFocus={() => preloadDashboardRoute(item.url)}
                  onPointerDown={() => preloadDashboardRoute(item.url)}
                  onClick={() => {
                    if (isLocked) { toast.error('로그인이 필요한 서비스입니다.'); navigate('/auth'); return; }
                    if (isAdminOnly) { toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.'); return; }
                    if (isMasterOnly) { toast.error('마스터 계정만 접근할 수 있습니다.'); return; }
                    item.action();
                  }}
                >
                  {isLocked && (
                    <div className="absolute right-3 top-3">
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">로그인 필요</Badge>
                    </div>
                  )}
                  {isAdminOnly && (
                    <div className="absolute right-3 top-3">
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">관리자 전용</Badge>
                    </div>
                  )}
                  {isMasterOnly && (
                    <div className="absolute right-3 top-3">
                      <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-[10px]">마스터 전용</Badge>
                    </div>
                  )}
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-primary transition-colors",
                    (isLocked || isAdminOnly || isMasterOnly) && "border-border bg-muted/50 text-muted-foreground"
                  )}>
                    {Icon && <Icon className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 pr-12 sm:pr-14">
                    <h3 className="truncate text-sm font-semibold leading-5 text-foreground">{item.title}</h3>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              );
            };

            return (
              <div className="mt-6 space-y-5">
                {linkGroups.map((group) => (
                  <section key={group.title} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-px flex-1 bg-border/60" />
                      <h2 className="shrink-0 text-xs font-semibold text-muted-foreground">{group.title}</h2>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {group.items.map((item) => renderCard(item, `${group.title}-${item.title}`))}
                    </div>
                  </section>
                ))}
              </div>
            );
          })()}

          {/* Footer */}
          <div className="mt-16 text-center space-y-4">
            <div className="glass-surface rounded-2xl p-5">
              <p className="text-[12px] text-muted-foreground leading-relaxed">
                본 프로그램은 아크뱅크 내부용 시스템 프로그램으로, 무단 복제 및 배포, 유출을 금지하고 있습니다.<br />
                위반 시 법적인 책임을 질 수 있습니다.
              </p>
            </div>
            <p className="text-[10px] font-medium tracking-[0.18em] text-muted-foreground">
              © 2025 ACBANK. ALL RIGHTS RESERVED.
            </p>
          </div>
        </div>
      </div>
      <Suspense fallback={null}>
        <MeetingRequestPopup />
      </Suspense>
    </div>
  );
};
export default Home;
