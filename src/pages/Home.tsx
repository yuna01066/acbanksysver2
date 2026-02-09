import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Instagram, MessageCircle, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, LogIn, User, LogOut, Megaphone, Building2 } from "lucide-react";
import DashboardCalendar from '@/components/DashboardCalendar';
import ProjectProgressCard from '@/components/ProjectProgressCard';
import NotificationPanel from '@/components/NotificationPanel';
import AnnouncementCard from '@/components/AnnouncementCard';
import ActivityFeedCard from '@/components/ActivityFeedCard';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
const Home = () => {
  const navigate = useNavigate();
  const { user, profile, signOut, isAdmin, isModerator } = useAuth();
  const { notifications, unviewedCount, markAsViewed, removeNotification, refresh: refreshNotifications } = useNotifications();
  const links = [{
    title: "홈페이지",
    icon: HomeIcon,
    description: "공식 웹사이트 방문",
    url: "https://acbank.co.kr",
    requiresAuth: false,
    action: () => window.open("https://acbank.co.kr", "_blank")
  }, {
    title: "클라이언트 상담폼",
    icon: FileText,
    description: "상담 신청하기",
    url: "https://acbank.co.kr/acbankform",
    requiresAuth: true,
    action: () => window.open("https://acbank.co.kr/acbankform", "_blank")
  }, {
    title: "채널톡",
    icon: MessageCircle,
    description: "실시간 상담",
    url: "https://acbank.channel.io",
    requiresAuth: true,
    action: () => window.open("https://acbank.channel.io", "_blank")
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
    title: "고객사 관리",
    icon: Building2,
    description: "고객사 정보 및 견적 히스토리",
    url: "/recipients",
    requiresAuth: true,
    action: () => navigate("/recipients")
  }, {
    title: "인스타그램",
    icon: Instagram,
    description: "소셜 미디어 팔로우",
    url: "https://www.instagram.com/acbank.co.kr/",
    requiresAuth: true,
    action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank")
  }, {
    title: "아크뱅크 노션 페이지",
    icon: BookOpen,
    description: "문서 및 가이드",
    url: "https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link",
    requiresAuth: true,
    action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank")
  }, {
    title: "공지사항",
    icon: Megaphone,
    description: "공지사항 게시판",
    url: "/announcements",
    requiresAuth: true,
    action: () => navigate("/announcements")
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
  }, {
    title: "",
    icon: null,
    description: "",
    url: "",
    requiresAuth: false,
    placeholder: true,
    action: () => {}
  }, {
    title: "",
    icon: null,
    description: "",
    url: "",
    requiresAuth: false,
    placeholder: true,
    action: () => {}
  }];

  const handleCardClick = (link: typeof links[0]) => {
    if (link.requiresAuth && !user) {
      toast.error('로그인이 필요한 서비스입니다.');
      navigate('/auth');
      return;
    }
    link.action();
  };
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Top Bar */}
          <div className="flex justify-between items-center gap-4 mb-8">
            <div>
              {user && (
                <NotificationPanel
                  notifications={notifications}
                  unviewedCount={unviewedCount}
                  onMarkViewed={markAsViewed}
                  onRemove={removeNotification}
                  onRefresh={refreshNotifications}
                />
              )}
            </div>
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  <Button variant="ghost" size="icon" onClick={() => window.open('https://desk.channel.io/acbank/groups/단체방-401443', '_blank')} title="팀챗">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  <Button variant="outline" onClick={() => navigate('/my-page')} className="gap-2">
                    <User className="h-4 w-4" />
                    {profile?.full_name || user.email}
                  </Button>
                  <Button variant="ghost" onClick={signOut} className="gap-2">
                    <LogOut className="h-4 w-4" />
                    로그아웃
                  </Button>
                </>
              ) : (
                <Button onClick={() => navigate('/auth')} className="gap-2">
                  <LogIn className="h-4 w-4" />
                  로그인
                </Button>
              )}
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-16 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">ACBANK</h1>
            <p className="text-xl text-muted-foreground">아크뱅크 내부 관리 시스템</p>
          </div>

          {user && (
            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnnouncementCard />
              <ActivityFeedCard />
              <ProjectProgressCard />
            </div>
          )}

          {/* Calendar - 로그인한 사용자만 */}
          {user && (
            <div className="mb-10">
              <DashboardCalendar />
            </div>
          )}

          {/* Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link, index) => {
            if ((link as any).placeholder) {
              return <div key={index} className="hidden lg:block" />;
            }
            const Icon = link.icon;
            const isLocked = link.requiresAuth && !user;
            const isAdminOnly = (link as any).requiresAdmin && !isAdmin && !isModerator;
            return <Card 
              key={index} 
              className={cn(
                "cursor-pointer group transition-all duration-300",
                (isLocked || isAdminOnly)
                  ? "opacity-60 hover:opacity-70 cursor-not-allowed" 
                  : "hover:scale-105"
              )} 
              onClick={() => handleCardClick(link)}
            >
                  <CardContent className="p-8 text-center relative">
                    {isLocked && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">
                          로그인 필요
                        </Badge>
                      </div>
                    )}
                    {isAdminOnly && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">
                          관리자 전용
                        </Badge>
                      </div>
                    )}
                    <div className="mb-4 flex justify-center">
                      <div className={cn(
                        "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center transition-all duration-300",
                        (isLocked || isAdminOnly)
                          ? "from-muted/20 to-muted/30" 
                          : "from-primary/20 to-accent/20 group-hover:from-primary/30 group-hover:to-accent/30"
                      )}>
                        {Icon && <Icon className={cn(
                          "w-8 h-8",
                          (isLocked || isAdminOnly) ? "text-muted-foreground" : "text-primary"
                        )} />}
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{link.title}</h3>
                    <p className="text-sm text-muted-foreground">{link.description}</p>
                  </CardContent>
                </Card>;
          })}
          </div>

          {/* Footer */}
          <div className="mt-16 text-center space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed">
                본 프로그램은 아크뱅크 내부용 시스템 프로그램으로, 무단 복제 및 배포, 유출을 금지하고 있습니다.<br />
                위반 시 법적인 책임을 질 수 있습니다.
              </p>
            </div>
            <p className="text-sm text-muted-foreground">@2025 ACBANK. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>;
};
export default Home;