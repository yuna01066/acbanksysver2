import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Instagram, MessageCircle, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, User, LogOut, Megaphone, Building2, Clock, CalendarDays, FolderOpen, Star, Package, Receipt, Landmark, Palette, Sun, Moon } from "lucide-react";
import LoginScreen from '@/components/LoginScreen';
import DashboardCalendar from '@/components/DashboardCalendar';
import ProjectProgressCard from '@/components/ProjectProgressCard';
import NotificationPanel from '@/components/NotificationPanel';
import AnnouncementCard from '@/components/AnnouncementCard';
import QuickAttendanceButton from '@/components/QuickAttendanceButton';
import DailyQuoteCard from '@/components/DailyQuoteCard';
import ActivityFeedCard from '@/components/ActivityFeedCard';
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

const Home = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, isAdmin, isModerator } = useAuth();
  const { theme, setTheme } = useTheme();
  const { notifications, unviewedCount, markAsViewed, removeNotification, refresh: refreshNotifications } = useNotifications();
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

  const quickLinks = [
    { title: "홈페이지", icon: HomeIcon, action: () => window.open("https://acbank.co.kr", "_blank") },
    { title: "팀 채팅", icon: MessageCircle, action: () => navigate("/team-chat") },
    { title: "인스타그램", icon: Instagram, action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank") },
    { title: "아크뱅크 노션", icon: BookOpen, action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank") },
  ];

  const links = [{
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

  const handleCardClick = (link: typeof links[0]) => {
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

  /* ── Shared skeuomorphic inline styles ── */
  const pageBg = { background: 'linear-gradient(170deg, hsl(220 12% 93%) 0%, hsl(220 10% 91%) 50%, hsl(220 10% 89%) 100%)' };

  const cardSurface = {
    background: 'linear-gradient(180deg, hsl(220 12% 95%) 0%, hsl(220 12% 90%) 100%)',
    boxShadow: '0 2px 1px hsl(0 0% 100% / 0.8), 0 -1px 1px hsl(0 0% 0% / 0.04), 0 8px 20px hsl(220 20% 0% / 0.08)',
    border: '1px solid hsl(220 12% 88%)',
  } as const;

  const circleBtn = {
    background: 'linear-gradient(180deg, hsl(220 10% 97%) 0%, hsl(220 12% 88%) 100%)',
    boxShadow: '0 2px 1px hsl(0 0% 100% / 0.9), 0 -1px 1px hsl(0 0% 0% / 0.06), 0 4px 8px hsl(220 20% 0% / 0.08)',
    border: '1px solid hsl(220 12% 86%)',
  } as const;

  const iconBox = {
    background: 'linear-gradient(180deg, hsl(220 10% 96%) 0%, hsl(220 12% 89%) 100%)',
    boxShadow: '0 2px 1px hsl(0 0% 100% / 0.7), 0 -1px 1px hsl(0 0% 0% / 0.05), 0 3px 6px hsl(220 20% 0% / 0.06)',
    border: '1px solid hsl(220 12% 87%)',
  } as const;

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#f8f8fa] dark:bg-[hsl(230,18%,7%)]">
      {/* Light mode fluid gradient background */}
      <div className="absolute inset-0 pointer-events-none dark:hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.18]"
          style={{ background: 'radial-gradient(circle, hsl(300 40% 85%) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-[10%] right-[-15%] w-[55%] h-[55%] rounded-full opacity-[0.15]"
          style={{ background: 'radial-gradient(circle, hsl(260 50% 82%) 0%, transparent 70%)', filter: 'blur(90px)' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[50%] h-[50%] rounded-full opacity-[0.14]"
          style={{ background: 'radial-gradient(circle, hsl(220 55% 82%) 0%, transparent 70%)', filter: 'blur(80px)' }} />
        <div className="absolute top-[50%] left-[50%] w-[40%] h-[40%] rounded-full opacity-[0.10] -translate-x-1/2 -translate-y-1/2"
          style={{ background: 'radial-gradient(circle, hsl(280 45% 80%) 0%, transparent 70%)', filter: 'blur(70px)' }} />
      </div>
      {/* Dark mode ambient glow background – subtle, premium */}
      <div className="absolute inset-0 pointer-events-none hidden dark:block" aria-hidden="true">
        <div className="absolute top-[-15%] left-[-5%] w-[50%] h-[50%] rounded-full opacity-[0.12]"
          style={{ background: 'radial-gradient(circle, hsl(280 60% 35%) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute top-[5%] right-[-10%] w-[45%] h-[50%] rounded-full opacity-[0.10]"
          style={{ background: 'radial-gradient(circle, hsl(250 55% 40%) 0%, transparent 70%)', filter: 'blur(100px)' }} />
        <div className="absolute bottom-[-5%] left-[25%] w-[40%] h-[40%] rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, hsl(215 60% 35%) 0%, transparent 70%)', filter: 'blur(90px)' }} />
      </div>
      <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-16">
        <div className="max-w-6xl mx-auto">
          {/* Top Bar */}
          <div className="flex justify-between items-center gap-4 mb-8">
            <div>
              <NotificationPanel
                notifications={notifications}
                unviewedCount={unviewedCount}
                onMarkViewed={markAsViewed}
                onRemove={removeNotification}
                onRefresh={refreshNotifications}
              />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => navigate('/team-chat')} title="팀챗"
                className="w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-transform active:scale-95 hover:scale-105">
                <MessageCircle className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} title="테마 전환"
                className="w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-transform active:scale-95 hover:scale-105">
                {theme === 'dark' ? <Sun className="h-[18px] w-[18px] text-muted-foreground" /> : <Moon className="h-[18px] w-[18px] text-muted-foreground" />}
              </button>
              <button onClick={() => navigate('/my-page')} title="마이페이지"
                className="w-10 h-10 rounded-full glass-pill flex items-center justify-center transition-transform active:scale-95 hover:scale-105">
                <User className="h-[18px] w-[18px] text-muted-foreground" />
              </button>
              <button onClick={signOut}
                className="h-10 px-4 rounded-full glass-pill flex items-center gap-2 text-[13px] font-medium text-muted-foreground transition-transform active:scale-95 hover:scale-105">
                <LogOut className="h-4 w-4" />
                로그아웃
              </button>
            </div>
          </div>

          {/* Header – metal embossed button style (kept skeuomorphic) */}
          <div className="text-center mb-8 sm:mb-14 animate-fade-up space-y-3">
            <div className="inline-block">
              <div
                className="px-10 sm:px-14 py-3 sm:py-4 rounded-[20px]"
                style={{
                  background: 'linear-gradient(165deg, hsl(220 6% 92%) 0%, hsl(220 8% 82%) 35%, hsl(220 6% 90%) 50%, hsl(220 8% 84%) 65%, hsl(220 6% 80%) 100%)',
                  boxShadow: '0 2px 1px hsl(0 0% 100% / 1), 0 -2px 1px hsl(0 0% 0% / 0.1), 0 6px 16px hsl(220 20% 0% / 0.1)',
                  border: '1px solid hsl(220 8% 84%)',
                }}
              >
                <h1 className="text-3xl sm:text-[42px] font-black leading-none tracking-[1px]" style={{ color: 'hsl(220 10% 28%)', fontFamily: "'Pretendard Variable', Pretendard, sans-serif", textShadow: 'inset 0 0 0 transparent, 0 1px 2px hsl(0 0% 0% / 0.25), 0 0 6px hsl(0 0% 0% / 0.15)' }}>ACBANK</h1>
              </div>
            </div>
            <p className="text-[12px] sm:text-[13px] font-medium tracking-[0.2em] uppercase" style={{ color: 'hsl(220 8% 42%)' }}>아크뱅크 내부 관리 시스템</p>
          </div>

          <div className="mb-6 space-y-5">
            {/* Quick icon links */}
            <div className="flex justify-center sm:justify-end gap-4 flex-wrap">
              {quickLinks.map((ql, i) => {
                const QIcon = ql.icon;
                return (
                  <button key={i} onClick={ql.action} className="flex flex-col items-center gap-1.5 group" title={ql.title}>
                    <div className="w-11 h-11 rounded-full glass-surface flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-smooth">
                      <QIcon className="h-[18px] w-[18px] text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">{ql.title}</span>
                  </button>
                );
              })}
            </div>

            <TimeGreeting name={profile?.full_name || user.email?.split('@')[0] || '사용자'} avatarUrl={profile?.avatar_url} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <QuickAttendanceButton />
              <DailyQuoteCard />
            </div>
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
            const sideCards: (null | { title: string; icon: any; description: string; requiresAuth: boolean; action: () => void })[] = [
              { title: "샘플칩 관리", icon: Palette, description: "샘플칩 재고 관리", requiresAuth: true, action: () => navigate("/sample-chip-inventory") },
              { title: "박람회 관리", icon: Landmark, description: "박람회 일정·준비·상담 관리", requiresAuth: true, action: () => navigate("/exhibition-management") },
              { title: "세금계산서 관리", icon: Receipt, description: "세금계산서 발행·조회", requiresAuth: true, action: () => navigate("/tax-invoices") },
            ];

            const cols = 3;
            const totalRows = Math.ceil(links.length / cols);

            const renderCard = (item: { title: string; icon: any; description: string; requiresAuth?: boolean; action: () => void; requiresAdmin?: boolean }, key: string) => {
              const Icon = item.icon;
              const isLocked = item.requiresAuth && !user;
              const isAdminOnly = (item as any).requiresAdmin && !isAdmin && !isModerator;

              return (
                <div
                  key={key}
                  className={cn(
                    "glass-card p-5 sm:p-7 text-center cursor-pointer group relative",
                    (isLocked || isAdminOnly) ? "opacity-50 cursor-not-allowed" : ""
                  )}
                  onClick={() => {
                    if (isLocked) { toast.error('로그인이 필요한 서비스입니다.'); navigate('/auth'); return; }
                    if (isAdminOnly) { toast.error('관리자 또는 중간관리자만 접근할 수 있습니다.'); return; }
                    item.action();
                  }}
                >
                  {isLocked && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="text-xs glass-pill px-2 py-0.5">로그인 필요</Badge>
                    </div>
                  )}
                  {isAdminOnly && (
                    <div className="absolute top-3 right-3">
                      <Badge variant="secondary" className="text-xs glass-pill px-2 py-0.5">관리자 전용</Badge>
                    </div>
                  )}
                  <div className="mb-3 sm:mb-4 flex justify-center">
                    <div className={cn(
                      "w-11 h-11 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300",
                      (isLocked || isAdminOnly) ? "glass-surface" : "glass-surface group-hover:shadow-smooth group-hover:scale-110"
                    )}>
                      {Icon && <Icon className={cn("w-5 h-5 sm:w-6 sm:h-6", (isLocked || isAdminOnly) ? "text-muted-foreground" : "text-primary")} />}
                    </div>
                  </div>
                  <h3 className="text-[13px] sm:text-[15px] font-semibold tracking-[-0.01em] mb-0.5 sm:mb-1 truncate">{item.title}</h3>
                  <p className="text-[11px] sm:text-[12px] text-muted-foreground line-clamp-2">{item.description}</p>
                </div>
              );
            };

            return (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
                {Array.from({ length: totalRows }).flatMap((_, r) => {
                  const rowItems: React.ReactNode[] = [];
                  for (let c = 0; c < cols; c++) {
                    const index = r * cols + c;
                    if (index < links.length) {
                      rowItems.push(renderCard(links[index], `link-${index}`));
                    } else {
                      rowItems.push(<div key={`empty-main-${r}-${c}`} />);
                    }
                  }
                  const sideCard = sideCards[r];
                  if (sideCard) {
                    rowItems.push(renderCard(sideCard, `side-${r}`));
                  } else {
                    rowItems.push(<div key={`empty-col-${r}`} className="glass-card p-5 sm:p-7" />);
                  }
                  return rowItems;
                })}
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