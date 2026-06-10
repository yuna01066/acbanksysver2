import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Loader2, Maximize2, Ruler } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import {
  getPanelComparisonDashboardSummary,
  usePanelSizeComparisonData,
} from '@/hooks/usePanelSizeComparisonData';
import { cn } from '@/lib/utils';

interface DashboardPanelSizeComparisonCardProps {
  defaultThickness?: string;
}

export default function DashboardPanelSizeComparisonCard({
  defaultThickness = '3T',
}: DashboardPanelSizeComparisonCardProps) {
  const navigate = useNavigate();
  const { items, isLoading, isError } = usePanelSizeComparisonData();
  const summary = getPanelComparisonDashboardSummary(items, defaultThickness);

  const openComparison = (thickness?: string) => {
    const params = new URLSearchParams();
    if (thickness) params.set('thickness', thickness);
    const query = params.toString();
    navigate(`/panel-size-comparison${query ? `?${query}` : ''}`);
  };

  return (
    <Card className="flex h-full w-full flex-col">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={Ruler}
          title="원판 규격 현황"
          subtitle="두께별 활성 원판을 빠르게 확인"
          meta={
            <Badge variant="secondary" className="rounded-full px-2.5 text-xs">
              {summary.selectedThickness}
            </Badge>
          }
          actions={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 rounded-lg px-2 text-xs"
              onClick={() => openComparison()}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              전체 비교
            </Button>
          }
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        {isLoading ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/20">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center text-xs text-muted-foreground">
            원판 데이터를 불러오지 못했습니다.
          </div>
        ) : summary.activeSizeCount === 0 ? (
          <div className="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-4 text-center text-xs text-muted-foreground">
            활성 원판 데이터가 없습니다.
          </div>
        ) : (
          <>
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="text-xs font-medium text-muted-foreground">기본 기준</div>
              <div className="mt-1 text-sm font-semibold text-foreground">
                {summary.selectedThickness} · {summary.activeQualityCount}개 재질 · {summary.activeSizeCount}개 규격
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="tabular-nums">
                  최대 {summary.maxWidth.toLocaleString()} x {summary.maxHeight.toLocaleString()}mm
                </span>
                {summary.missingPriceCount > 0 && (
                  <Badge variant="outline" className="gap-1 rounded-full px-2 py-0.5 text-[10px]">
                    <AlertTriangle className="h-3 w-3" />
                    단가 미등록 {summary.missingPriceCount}건
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">두께 바로 비교</div>
              <div className="flex flex-wrap gap-1.5">
                {summary.availableThicknesses.map((thickness) => (
                  <button
                    key={thickness}
                    type="button"
                    className={cn(
                      'flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      thickness === summary.selectedThickness
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent/45 hover:text-foreground'
                    )}
                    onClick={() => openComparison(thickness)}
                  >
                    <span>{thickness}</span>
                    <ArrowRight className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs leading-relaxed text-muted-foreground">
              정밀한 축척 비교와 재질 선택은 전체 비교 화면에서 확인합니다.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
