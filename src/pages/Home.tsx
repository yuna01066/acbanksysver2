import { useState, useCallback } from 'react';
import type { ComponentType } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Instagram, MessageCircle, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, User, LogOut, Megaphone, Building2, Clock, CalendarDays, FolderOpen, Star, Package, Receipt, Landmark, Palette } from "lucide-react";
import LoginScreen from '@/components/LoginScreen';
import DashboardCalendar from '@/components/DashboardCalendar';
import ProjectProgressCard from '@/components/ProjectProgressCard';
import NotificationPanel from '@/components/NotificationPanel';
import AnnouncementCard from '@/components/AnnouncementCard';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import DailyQuoteCard from '@/components/DailyQuoteCard';
import ActivityFeedCard from '@/components/ActivityFeedCard';
import TodayWorkCard from '@/components/TodayWorkCard';

import { useAuth } from '@/contexts/AuthContext';
import TimeGreeting from '@/components/TimeGreeting';
import OnlineEmployeesCard from '@/components/OnlineEmployeesCard';
import MeetingRequestPopup from '@/components/MeetingRequestPopup';
import TeamChatCard from '@/components/TeamChatCard';
import { useNotifications } from '@/hooks/useNotifications';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';

type DashboardLink = {
  title: string;
  icon: ComponentType<{ className?: string }>;
  description: string;
  url?: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  action: () => void;
};

const Home = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, isAdmin, isModerator } = useAuth();
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
    { title: "홈페이지", icon: HomeIcon, action: () => window.open("https://acbank.co.kr", "_blank") },
    { title: "팀 채팅", icon: MessageCircle, action: () => navigate("/team-chat") },
    { title: "인스타그램", icon: Instagram, action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank") },
    { title: "아크뱅크 노션", icon: BookOpen, action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank") },
  ];

  const links: DashboardLink[] = [{
    title: "공지사항",
    icon: Megaphone,
    description: "공지사항 게시판",
    url: "/announcements",
    requiresAuth: true,
    action: () => navigate("/announcements")
  }, {
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
              <button onClick={() => navigate('/team-chat')} title="팀챗"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/75 shadow-sm backdrop-blur transition-colors hover:bg-accent/40 active:scale-95">
                <MessageCircle className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={() => navigate('/my-page')} title="마이페이지"
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
            <TodayWorkCard notifications={notifications} />
            <DashboardCalendar />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnnouncementCard />
              <ActivityFeedCard />
              <ProjectProgressCard />
            </div>
          </div>

          {/* Online Employees & Team Chat */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <OnlineEmployeesCard />
            <TeamChatCard />
          </div>

          {/* Links Grid */}
          {(() => {
            const secondaryLinks: DashboardLink[] = [
              { title: "샘플칩 관리", icon: Palette, description: "샘플칩 재고 관리", requiresAuth: true, action: () => navigate("/sample-chip-inventory") },
              { title: "박람회 관리", icon: Landmark, description: "박람회 일정·준비·상담 관리", requiresAuth: true, action: () => navigate("/exhibition-management") },
              { title: "세금계산서 관리", icon: Receipt, description: "세금계산서 발행·조회", requiresAuth: true, action: () => navigate("/tax-invoices") },
            ];

            const byTitle = new Map(links.map((link) => [link.title, link]));
            const secondaryByTitle = new Map(secondaryLinks.map((link) => [link.title, link]));
            const pickLinks = (titles: string[]) => titles
              .map((title) => byTitle.get(title) || secondaryByTitle.get(title))
              .filter(Boolean) as DashboardLink[];

            const linkGroups = [
              { title: "업무", items: pickLinks(["공지사항", "근태 관리", "연차 관리", "업무 평가"]) },
              { title: "견적 · 프로젝트", items: pickLinks(["고객사 관리", "프로젝트 관리", "원판 발주 관리", "수율 계산기", "견적 계산기", "발행 견적서 확인"]) },
              { title: "관리", items: pickLinks(["샘플칩 관리", "박람회 관리", "세금계산서 관리", "관리자 설정"]) },
              { title: "외부", items: pickLinks(["클라이언트 상담폼"]) },
            ].filter((group) => group.items.length > 0);

            const renderCard = (item: DashboardLink, key: string) => {
              const Icon = item.icon;
              const isLocked = item.requiresAuth && !user;
              const isAdminOnly = item.requiresAdmin && !isAdmin && !isModerator;

              return (
                <div
                  key={key}
                  className={cn(
                    "group relative flex min-h-[92px] cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-background/75 p-3 text-left shadow-sm backdrop-blur transition-colors hover:bg-accent/35 sm:p-4",
                    (isLocked || isAdminOnly) ? "opacity-50 cursor-not-allowed" : ""
                  )}
                  onClick={() => {
                    if (isLocked) { toast.error('로그인이 필요한 서비스입니다.'); navigate('/auth'); return; }
                    if (isAdminOnly) { toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.'); return; }
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
                  <div className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/10 bg-primary/10 text-primary transition-colors",
                    (isLocked || isAdminOnly) && "border-border bg-muted/50 text-muted-foreground"
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
      <MeetingRequestPopup />
    </div>
  );
};
export default Home;
