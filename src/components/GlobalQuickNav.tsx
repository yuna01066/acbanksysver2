import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarDays,
  Calculator,
  ClipboardList,
  ClipboardCheck,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Home,
  MessageCircle,
  Package,
  Palette,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Star,
  User,
  Users,
  Wrench,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useAuth } from '@/contexts/AuthContext';

type QuickNavItem = {
  title: string;
  description: string;
  path: string;
  group: '업무' | '영업' | '관리' | '직원';
  keywords: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
};

const QUICK_NAV_ITEMS: QuickNavItem[] = [
  { title: '견적 계산기', description: '판재 견적 계산', path: '/calculator?type=quote', group: '영업', keywords: '견적 계산 단가 판재 quote calculator', icon: Calculator },
  { title: '수율 계산기', description: '원판 배치와 수율 확인', path: '/calculator?type=yield', group: '영업', keywords: '수율 네스팅 원판 yield nesting', icon: BarChart3 },
  { title: '발행 견적서', description: '저장된 견적서 검색/관리', path: '/saved-quotes', group: '영업', keywords: '발행 견적서 저장 quote saved', icon: FileSpreadsheet },
  { title: '고객사 관리', description: '거래처와 담당자 정보', path: '/recipients', group: '영업', keywords: '거래처 고객사 담당자 client recipient', icon: Building2 },
  { title: '프로젝트 관리', description: '견적·거래처·발주 연결', path: '/project-management', group: '업무', keywords: '프로젝트 프로젝트관리 project', icon: FolderOpen },
  { title: '원판 발주 관리', description: '자재 발주 내역', path: '/material-orders', group: '업무', keywords: '원판 발주 자재 material order', icon: Package },
  { title: '팀 채팅', description: '내부 메시지와 업무 대화', path: '/team-chat', group: '업무', keywords: '채팅 메시지 소통 chat', icon: MessageCircle },
  { title: '공지사항', description: '사내 공지 확인', path: '/announcements', group: '업무', keywords: '공지 announcement notice', icon: ClipboardList },
  { title: '근태 관리', description: '출퇴근 기록', path: '/attendance', group: '직원', keywords: '근태 출근 퇴근 attendance', icon: CalendarDays },
  { title: '연차 관리', description: '휴가 신청/승인', path: '/leave-management', group: '직원', keywords: '연차 휴가 leave vacation', icon: CalendarDays },
  { title: '마이페이지', description: '내 정보와 개인 업무', path: '/my-page', group: '직원', keywords: '마이페이지 내정보 my page profile', icon: User },
  { title: '업무 평가', description: '평가 작성과 확인', path: '/performance-review', group: '직원', keywords: '평가 업무평가 review performance', icon: Star },
  { title: '승인/검토 센터', description: '승인·동기화·견적 연결 확인', path: '/review-hub', group: '관리', keywords: '승인 검토 중간관리자 review approval moderator', icon: ClipboardCheck, adminOnly: true },
  { title: '관리자 설정', description: '시스템 설정 허브', path: '/admin-settings', group: '관리', keywords: '관리자 설정 admin settings', icon: Settings, adminOnly: true },
  { title: '원판 관리', description: '원판/컬러/사이즈 단가', path: '/panel-management', group: '관리', keywords: '원판 컬러 사이즈 단가 panel color price', icon: Palette, adminOnly: true },
  { title: '가공 가격 관리', description: '가공 옵션과 배수 관리', path: '/processing-price-management', group: '관리', keywords: '가공 가격 옵션 processing price', icon: Wrench, adminOnly: true },
  { title: '경영 대시보드', description: '매출·비용·수익성', path: '/business-dashboard', group: '관리', keywords: '경영 대시보드 매출 수익 dashboard', icon: Briefcase, adminOnly: true },
  { title: '직원 관리', description: '구성원/권한/인사 정보', path: '/employee-profiles', group: '관리', keywords: '직원 구성원 권한 인사 employee', icon: Users, adminOnly: true },
  { title: '세금계산서', description: '계산서 발행/관리', path: '/tax-invoices', group: '관리', keywords: '세금계산서 계산서 tax invoice', icon: Receipt, adminOnly: true },
  { title: '견적서 템플릿', description: '견적서 양식 관리', path: '/quote-template-management', group: '관리', keywords: '템플릿 양식 quote template', icon: FileText, adminOnly: true },
  { title: '스토리지 현황', description: '데이터/파일 사용량', path: '/storage-status', group: '관리', keywords: '스토리지 저장소 storage', icon: Sparkles, adminOnly: true },
];

const HIDDEN_PATHS = ['/auth', '/forgot-password', '/customer-quote', '/customer-quotes-summary', '/quote'];

const GlobalQuickNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading, isAdmin, isModerator } = useAuth();
  const [open, setOpen] = useState(false);

  const isHidden = !user
    || loading
    || location.pathname === '/'
    || HIDDEN_PATHS.some(path => location.pathname.startsWith(path));

  const visibleItems = useMemo(
    () => QUICK_NAV_ITEMS.filter(item => !item.adminOnly || isAdmin || isModerator),
    [isAdmin, isModerator]
  );

  const groupedItems = useMemo(() => {
    return visibleItems.reduce<Record<QuickNavItem['group'], QuickNavItem[]>>((acc, item) => {
      acc[item.group] = [...(acc[item.group] || []), item];
      return acc;
    }, {} as Record<QuickNavItem['group'], QuickNavItem[]>);
  }, [visibleItems]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (!isHidden) setOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHidden]);

  useEffect(() => {
    document.documentElement.classList.toggle('quick-nav-active', !isHidden);

    return () => {
      document.documentElement.classList.remove('quick-nav-active');
    };
  }, [isHidden]);

  if (isHidden) return null;

  const goTo = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-3 z-40 h-10 gap-2 rounded-full border-border/70 bg-background/90 px-3 text-xs shadow-smooth backdrop-blur print:hidden sm:right-6 sm:top-4"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">빠른 이동</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <div className="border-b px-4 py-3">
          <div className="text-sm font-semibold">빠른 이동</div>
          <div className="text-xs text-muted-foreground">화면 이름, 업무, 키워드로 바로 이동합니다.</div>
        </div>
        <CommandInput placeholder="예: 견적, 프로젝트, 원판, 근태..." />
        <CommandList className="max-h-[420px]">
          <CommandEmpty>검색 결과가 없습니다.</CommandEmpty>
          {(['영업', '업무', '직원', '관리'] as const).map(group => {
            const items = groupedItems[group] || [];
            if (items.length === 0) return null;

            return (
              <CommandGroup key={group} heading={group}>
                {items.map(item => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.path}
                      value={`${item.title} ${item.description} ${item.keywords}`}
                      onSelect={() => goTo(item.path)}
                      className="gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{item.title}</div>
                        <div className="truncate text-xs text-muted-foreground">{item.description}</div>
                      </div>
                      <CommandShortcut>{item.path.split('?')[0]}</CommandShortcut>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
        <div className="flex items-center justify-between border-t px-4 py-2 text-[11px] text-muted-foreground">
          <span>Enter로 이동</span>
          <span>Esc로 닫기</span>
        </div>
      </CommandDialog>
    </>
  );
};

export default GlobalQuickNav;
