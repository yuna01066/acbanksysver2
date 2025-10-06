import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, TrendingUp, Settings, Sparkles, Zap, ShieldCheck } from "lucide-react";
import CalculatorWidget from "@/components/CalculatorWidget";

const Index = () => {
  const [showCalculator, setShowCalculator] = useState(false);
  const navigate = useNavigate();

  if (showCalculator) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
        <CalculatorWidget />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-background relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Header with Settings */}
      <header className="relative z-10 px-6 py-6 flex justify-end">
        <Button
          onClick={() => navigate('/admin-settings')}
          variant="minimal"
          size="sm"
          className="animate-fade-in backdrop-blur-sm bg-card/90 border-border/50 hover:bg-card hover:shadow-smooth"
        >
          <Settings className="w-4 h-4" />
          관리자 설정
        </Button>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 container mx-auto px-6 py-12 md:py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8 animate-fade-in">
          {/* Brand Logo/Name */}
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-full border border-primary/20 backdrop-blur-sm">
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
            <span className="text-display font-bold bg-gradient-to-r from-primary via-primary-dark to-primary bg-clip-text text-transparent">
              ARCBANK
            </span>
            <Sparkles className="w-5 h-5 text-primary animate-pulse" />
          </div>

          {/* Hero Title */}
          <div className="space-y-4">
            <h1 className="text-display font-bold tracking-tight">
              스마트한 판재 견적 시스템
            </h1>
            <p className="text-title text-muted-foreground max-w-2xl mx-auto">
              정확한 가격 계산과 수율 분석으로 더 나은 비즈니스 결정을 내리세요
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 pt-8">
            <Card className="group hover:scale-105 transition-all duration-300 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:shadow-glow transition-all">
                  <Calculator className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-headline font-semibold">견적 계산기</h3>
                <p className="text-body text-muted-foreground">
                  판재 단가 및 총 견적을 빠르고 정확하게 계산합니다
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:scale-105 transition-all duration-300 border-accent/20">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center group-hover:shadow-glow transition-all">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-headline font-semibold">수율 계산기</h3>
                <p className="text-body text-muted-foreground">
                  원자재 수율을 최적화하여 비용을 절감합니다
                </p>
              </CardContent>
            </Card>

            <Card className="group hover:scale-105 transition-all duration-300 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center group-hover:shadow-glow transition-all">
                  <ShieldCheck className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-headline font-semibold">정확한 분석</h3>
                <p className="text-body text-muted-foreground">
                  데이터 기반의 정확한 가격 분석을 제공합니다
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="pt-8 space-y-4">
            <Button
              onClick={() => setShowCalculator(true)}
              size="lg"
              className="group relative overflow-hidden px-8 py-6 text-lg font-semibold bg-gradient-to-r from-primary via-primary-dark to-primary hover:shadow-glow transition-all duration-300 hover:scale-105"
            >
              <Zap className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
              계산 시작하기
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            </Button>
            <p className="text-caption text-muted-foreground">
              별도 로그인 없이 바로 시작할 수 있습니다
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-8 text-center text-caption text-muted-foreground">
        <p>© 2025 ARCBANK. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default Index;
