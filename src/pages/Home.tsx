import { useState, useCallback } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calculator, Home as HomeIcon, Camera, MessageCircle, MessageSquareText, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, User, LogOut, Building2, FolderOpen, Package, Receipt, Landmark, Palette, Images, Loader2 } from "lucide-react";
import LoginScreen from '@/components/LoginScreen';
import DashboardCalendarPanel from '@/components/dashboard/DashboardCalendarPanel';
import DashboardQuickLinksSection, { type DashboardQuickLinkItem } from '@/components/dashboard/DashboardQuickLinksSection';
import ProjectProgressCard from '@/components/ProjectProgressCard';
import NotificationPanel from '@/components/NotificationPanel';
import DailyQuoteCard from '@/components/DailyQuoteCard';
import ActivityFeedCard from '@/components/ActivityFeedCard';
import TodayWorkCard from '@/components/TodayWorkCard';
import ChannelTalkInquiryCard from '@/components/ChannelTalkInquiryCard';
import DashboardQuoteFollowUpCard from '@/components/DashboardQuoteFollowUpCard';
import DashboardPortfolioQuickSearchCard from '@/components/DashboardPortfolioQuickSearchCard';

import { useAuth } from '@/contexts/AuthContext';
import TimeGreeting from '@/components/TimeGreeting';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import OnlineEmployeesCard from '@/components/OnlineEmployeesCard';
import MeetingRequestPopup from '@/components/MeetingRequestPopup';
import TeamChatCard from '@/components/TeamChatCard';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { isCompanyMasterEmail } from '@/lib/companyMaster';

type QuickIconLink = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
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
      toast(theme === 'dark' ? '라이트 모드로 전환했습니다.' : '다크 모드로 전환했습니다.', { duration: 1500 });
    }, 300);

    setTimeout(() => setLogoSpinning(false), 700);
  }, [logoSpinning, theme, setTheme]);
  const quickLinks: QuickIconLink[] = [
    { title: "홈페이지", description: "", icon: HomeIcon, action: () => window.open("https://acbank.co.kr", "_blank") },
    { title: "팀 채팅", description: "", icon: MessageCircle, action: () => navigate("/team-chat") },
    { title: "인스타그램", description: "", icon: Camera, action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank") },
    { title: "아크뱅크 노션", description: "", icon: BookOpen, action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank") },
  ];

  const dashboardLinks: DashboardQuickLinkItem[] = [{
    id: "customers",
    title: "고객사 관리",
    icon: Building2,
    description: "거래처 정보 관리",
    path: "/recipients",
    category: "quote-project",
    priority: 10,
    requiresAuth: true,
    action: () => navigate("/recipients")
  }, {
    id: "projects",
    title: "프로젝트 관리",
    icon: FolderOpen,
    description: "프로젝트별 견적·고객 연결",
    path: "/project-management",
    category: "quote-project",
    priority: 20,
    requiresAuth: true,
    action: () => navigate("/project-management")
  }, {
    id: "material-orders",
    title: "원판 발주 관리",
    icon: Package,
    description: "자재 발주 내역 관리",
    path: "/material-orders",
    category: "quote-project",
    priority: 30,
    requiresAuth: true,
    action: () => navigate("/material-orders")
  }, {
    id: "yield-calculator",
    title: "수율 계산기",
    icon: TrendingUp,
    description: "패널 수율 최적화",
    path: "/calculator?type=yield",
    category: "quote-project",
    priority: 40,
    requiresAuth: true,
    action: () => navigate("/calculator?type=yield")
  }, {
    id: "quote-calculator",
    title: "견적 계산기",
    icon: Calculator,
    description: "스마트 판재 견적",
    path: "/calculator?type=quote",
    category: "quote-project",
    priority: 50,
    requiresAuth: true,
    action: () => navigate("/calculator?type=quote")
  }, {
    id: "saved-quotes",
    title: "발행 견적서 확인",
    icon: FileSpreadsheet,
    description: "저장된 견적서 관리",
    path: "/saved-quotes",
    category: "quote-project",
    priority: 60,
    requiresAuth: true,
    action: () => navigate("/saved-quotes")
  }, {
    id: "customer-consultation-form",
    title: "클라이언트 상담폼",
    icon: FileText,
    description: "상담 신청하기",
    path: "/client-consultation-widget?source=imweb-acbankform",
    category: "external",
    priority: 10,
    requiresAuth: true,
    action: () => navigate("/client-consultation-widget?source=imweb-acbankform")
  }, {
    id: "channel-talk-leads",
    title: "채널톡 문의 분석함",
    icon: MessageSquareText,
    description: "AI 분석 문의 확인",
    path: "/channel-talk-leads",
    category: "management",
    priority: 10,
    requiresAuth: true,
    action: () => navigate("/channel-talk-leads")
  }, {
    id: "admin-settings",
    title: "관리자 설정",
    icon: Settings,
    description: "가격 및 옵션 관리",
    path: "/admin-settings",
    category: "management",
    priority: 80,
    requiresAuth: true,
    requiresAdmin: true,
    action: () => {
      if (isAdmin || isModerator) {
        navigate("/admin-settings");
      } else {
        toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.');
      }
    }
  }, {
    id: "company-settings",
    title: "회사 설정",
    icon: Building2,
    description: "마스터 전용 민감정보 관리",
    path: "/company-settings",
    category: "management",
    priority: 90,
    requiresAuth: true,
    requiresMaster: true,
    action: () => navigate("/company-settings")
  }, {
    id: "sample-chip-inventory",
    title: "샘플칩 관리",
    icon: Palette,
    description: "샘플칩 재고 관리",
    path: "/sample-chip-inventory",
    category: "management",
    priority: 20,
    requiresAuth: true,
    action: () => navigate("/sample-chip-inventory")
  }, {
    id: "portfolio",
    title: "포트폴리오",
    icon: Images,
    description: "인테리어·제작가공 사진 열람",
    path: "/portfolio",
    category: "management",
    priority: 30,
    requiresAuth: true,
    action: () => navigate("/portfolio")
  }, {
    id: "references",
    title: "레퍼런스",
    icon: Images,
    description: "상담용 이미지·메모 열람",
    path: "/references",
    category: "management",
    priority: 40,
    requiresAuth: true,
    action: () => navigate("/references")
  }, {
    id: "exhibition-management",
    title: "박람회 관리",
    icon: Landmark,
    description: "박람회 일정·준비·상담 관리",
    path: "/exhibition-management",
    category: "management",
    priority: 50,
    requiresAuth: true,
    action: () => navigate("/exhibition-management")
  }, {
    id: "tax-invoices",
    title: "세금계산서 관리",
    icon: Receipt,
    description: "세금계산서 발행·조회",
    path: "/tax-invoices",
    category: "management",
    priority: 60,
    requiresAuth: true,
    action: () => navigate("/tax-invoices")
  }];

  if (authLoading && user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-transparent px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">로그인 상태를 확인하고 있습니다.</p>
      </div>
    );
  }

  // If not logged in, keep the login page reachable even while session restore is slow.
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
              <button onClick={() => navigate('/team-chat')} title="팀챗"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-none transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
                <MessageCircle className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={() => navigate('/my-page')} title="마이페이지"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-none transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20">
                <User className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={signOut}
                className="flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-muted-foreground shadow-none transition-colors hover:border-foreground/20 hover:bg-muted hover:text-foreground active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:px-4">
                <LogOut className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">로그아웃</span>
              </button>
            </div>
          </div>

          {/* Header */}
          <div className="mb-6 space-y-2 text-center animate-fade-up sm:mb-8">
            <div className="inline-block rounded-lg border border-border bg-card px-1 py-1 shadow-none" onClick={handleLogoClick}>
              <div
                className={cn(
                  "cursor-pointer select-none rounded-md px-8 py-2.5 transition-colors hover:bg-muted sm:px-12",
                  logoSpinning && "logo-spin-3d"
                )}
              >
                <h1 className="text-3xl font-black leading-none tracking-[3px] text-foreground sm:text-[36px]">
                  ACBANK
                </h1>
              </div>
            </div>
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-[12px]">Management System</p>
          </div>

          <div className="mb-6 space-y-4 sm:space-y-5">
            {/* Quick icon links */}
            <div className="flex justify-center sm:justify-end">
              <div className="flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-full border border-border bg-card p-1.5 shadow-none">
                {quickLinks.map((ql, i) => {
                  const QIcon = ql.icon;
                  return (
                    <button
                      key={i}
                      onClick={ql.action}
                      className="group flex h-9 items-center gap-2 rounded-full px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/20 sm:px-3"
                      title={ql.title}
                    >
                      <QIcon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
                      <span>{ql.title}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <TimeGreeting
                name={profile?.full_name || user.email?.split('@')[0] || '사용자'}
                avatarUrl={profile?.avatar_url}
                attendanceAction={<QuickAttendanceButton variant="inline" />}
              />

              <DailyQuoteCard />
            </div>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)_minmax(320px,0.9fr)]">
              <TodayWorkCard notifications={notifications} />
              <DashboardQuoteFollowUpCard />
              <ChannelTalkInquiryCard />
            </div>
            <DashboardCalendarPanel />
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <DashboardPortfolioQuickSearchCard />
              <ActivityFeedCard />
              <ProjectProgressCard />
            </div>
          </div>

          {/* Checked-in staff and team chat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <OnlineEmployeesCard />
            <TeamChatCard />
          </div>

          <DashboardQuickLinksSection
            items={dashboardLinks}
            isAuthenticated={Boolean(user)}
            isAdmin={isAdmin}
            isModerator={isModerator}
            isMaster={isMaster}
          />

          {/* Footer */}
          <div className="mt-16 text-center space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 shadow-none">
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
      <MeetingRequestPopup />
    </div>
  );
};
export default Home;
