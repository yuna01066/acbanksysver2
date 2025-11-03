import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Home as HomeIcon, Instagram, MessageCircle, FileText, BookOpen, FileSpreadsheet, Settings, TrendingUp, LogIn, User, LogOut } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
const Home = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const links = [{
    title: "홈페이지",
    icon: HomeIcon,
    description: "공식 웹사이트 방문",
    url: "https://acbank.co.kr",
    action: () => window.open("https://acbank.co.kr", "_blank")
  }, {
    title: "클라이언트 상담폼",
    icon: FileText,
    description: "상담 신청하기",
    url: "https://acbank.co.kr/acbankform",
    action: () => window.open("https://acbank.co.kr/acbankform", "_blank")
  }, {
    title: "채널톡",
    icon: MessageCircle,
    description: "실시간 상담",
    url: "https://acbank.channel.io",
    action: () => window.open("https://acbank.channel.io", "_blank")
  }, {
    title: "수율 계산기",
    icon: TrendingUp,
    description: "패널 수율 최적화",
    url: "/calculator?type=yield",
    action: () => navigate("/calculator?type=yield")
  }, {
    title: "견적 계산기",
    icon: Calculator,
    description: "스마트 판재 견적",
    url: "/calculator?type=quote",
    action: () => navigate("/calculator?type=quote")
  }, {
    title: "발행 견적서 확인",
    icon: FileSpreadsheet,
    description: "저장된 견적서 관리",
    url: "/saved-quotes",
    action: () => navigate("/saved-quotes")
  }, {
    title: "인스타그램",
    icon: Instagram,
    description: "소셜 미디어 팔로우",
    url: "https://www.instagram.com/acbank.co.kr/",
    action: () => window.open("https://www.instagram.com/acbank.co.kr/", "_blank")
  }, {
    title: "아크뱅크 노션 페이지",
    icon: BookOpen,
    description: "문서 및 가이드",
    url: "https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link",
    action: () => window.open("https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link", "_blank")
  }, {
    title: "관리자 설정",
    icon: Settings,
    description: "가격 및 옵션 관리",
    url: "/admin-settings",
    action: () => navigate("/admin-settings")
  }];
  return <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* User Info / Login Button */}
          <div className="flex justify-end items-center gap-4 mb-8">
            {user ? (
              <>
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

          {/* Header */}
          <div className="text-center mb-16 animate-fade-up">
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">ACBANK</h1>
            <p className="text-xl text-muted-foreground">아크뱅크 내부 관리 시스템</p>
          </div>

          {/* Links Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {links.map((link, index) => {
            const Icon = link.icon;
            return <Card key={index} className="cursor-pointer group hover:scale-105 transition-all duration-300" onClick={link.action}>
                  <CardContent className="p-8 text-center">
                    <div className="mb-4 flex justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center group-hover:from-primary/30 group-hover:to-accent/30 transition-all duration-300">
                        <Icon className="w-8 h-8 text-primary" />
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