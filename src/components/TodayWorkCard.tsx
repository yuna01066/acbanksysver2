import { CheckCircle2, ChevronRight, ClipboardCheck, FileText, FolderOpen, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { AppNotification } from '@/hooks/useNotifications';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { toneClasses, useTodayWorkItems } from '@/hooks/useTodayWorkItems';
import { useNavigate } from 'react-router-dom';

interface TodayWorkCardProps {
  notifications: AppNotification[];
}

const TodayWorkCard = ({ notifications }: TodayWorkCardProps) => {
  const navigate = useNavigate();
  const { items: workItems, urgentCount, isLoading } = useTodayWorkItems(notifications);
  const shouldScrollWorkItems = workItems.length > 4;

  return (
    <Card className="w-full overflow-hidden border-primary/10 bg-background/85 shadow-sm backdrop-blur">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={CheckCircle2}
          title="오늘 처리할 일"
          subtitle="알림, 일정, 승인, 납기, 프로젝트 상태를 우선순위 기준으로 모았습니다."
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <Badge variant="secondary" className="rounded-full px-2.5 py-1">
                총 {workItems.length}건
              </Badge>
              {urgentCount > 0 && (
                <Badge className="rounded-full bg-amber-500/10 px-2.5 py-1 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300">
                  우선 확인 {urgentCount}건
                </Badge>
              )}
            </div>
          }
        />
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex min-h-[160px] items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            업무 항목을 불러오는 중입니다.
          </div>
        ) : workItems.length === 0 ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center">
            <CheckCircle2 className="mb-2 h-9 w-9 text-emerald-500" />
            <p className="text-sm font-medium">현재 바로 처리할 항목이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">캘린더와 최근 활동은 아래 카드에서 계속 확인할 수 있습니다.</p>
          </div>
        ) : (
          <ScrollArea className={cn('pr-3', shouldScrollWorkItems ? 'h-[340px] sm:h-[360px]' : 'max-h-[360px]')}>
            <div className="space-y-2 pb-1">
              {workItems.map((item, index) => (
                <div key={item.id}>
                  <button
                    type="button"
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className="group grid w-full grid-cols-[auto,1fr,auto] items-center gap-3 rounded-xl border bg-card/80 p-3 text-left transition-colors hover:bg-accent/40 disabled:cursor-wait disabled:opacity-70"
                  >
                    <div className={cn('flex h-9 w-9 items-center justify-center rounded-full border', toneClasses(item.tone))}>
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', toneClasses(item.tone))}>
                          {item.label}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground group-hover:text-foreground">
                      <span className="hidden sm:inline">{item.actionLabel}</span>
                      {item.disabled ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                    </div>
                  </button>
                  {index < workItems.length - 1 && <Separator className="opacity-40" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/saved-quotes')}>
            <FileText className="h-3.5 w-3.5" />
            견적
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/project-management')}>
            <FolderOpen className="h-3.5 w-3.5" />
            프로젝트
          </Button>
          <Button variant="outline" size="sm" className="justify-start gap-2" onClick={() => navigate('/leave-management')}>
            <ClipboardCheck className="h-3.5 w-3.5" />
            승인
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default TodayWorkCard;
