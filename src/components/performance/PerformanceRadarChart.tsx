import { ShieldCheck, Target } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface PerformanceRadarMetric {
  id: string;
  label: string;
  value: number | null;
  description?: string | null;
  evidenceCount?: number;
}

interface PerformanceRadarChartProps {
  title?: string;
  summary?: string;
  metrics: PerformanceRadarMetric[];
  className?: string;
  framed?: boolean;
  compact?: boolean;
}

const AXIS_COUNT = 6;
const CENTER = 100;
const RADIUS = 68;

const clampScore = (value: number | null | undefined) =>
  typeof value === 'number' ? Math.max(0, Math.min(10, value)) : 0;

const formatScore = (value: number | null | undefined) =>
  typeof value === 'number' ? `${Math.round(value * 10) / 10}` : '-';

const getTextAnchor = (x: number) => {
  if (x < CENTER - 8) return 'end';
  if (x > CENTER + 8) return 'start';
  return 'middle';
};

const getPoint = (index: number, total: number, ratio: number, radius = RADIUS) => {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total;
  return {
    x: CENTER + Math.cos(angle) * radius * ratio,
    y: CENTER + Math.sin(angle) * radius * ratio,
  };
};

const makePoints = (
  metrics: PerformanceRadarMetric[],
  ratioFn: (metric: PerformanceRadarMetric, index: number) => number,
) =>
  metrics
    .map((metric, index) => {
      const point = getPoint(index, metrics.length, ratioFn(metric, index));
      return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    })
    .join(' ');

const normalizeMetrics = (metrics: PerformanceRadarMetric[]) => {
  const normalized = metrics.slice(0, AXIS_COUNT);
  while (normalized.length < AXIS_COUNT) {
    normalized.push({
      id: `empty-${normalized.length}`,
      label: `항목 ${normalized.length + 1}`,
      value: null,
      description: null,
      evidenceCount: 0,
    });
  }
  return normalized;
};

const PerformanceRadarChart = ({
  title = '육각형 역량 지표',
  summary = '점수와 선택형 근거를 함께 표시합니다.',
  metrics,
  className,
  framed = true,
  compact = false,
}: PerformanceRadarChartProps) => {
  const normalizedMetrics = normalizeMetrics(metrics);
  const availableMetrics = normalizedMetrics.filter(metric => typeof metric.value === 'number');
  const average = availableMetrics.length > 0
    ? availableMetrics.reduce((sum, metric) => sum + (metric.value || 0), 0) / availableMetrics.length
    : null;
  const totalEvidence = normalizedMetrics.reduce((sum, metric) => sum + (metric.evidenceCount || 0), 0);

  const content = (
    <div className={cn('grid gap-5', compact ? 'lg:grid-cols-[220px_1fr]' : 'lg:grid-cols-[280px_1fr]')}>
      <div className="rounded-2xl border bg-muted/20 p-3">
        <svg viewBox="0 0 200 200" role="img" aria-label={title} className="h-64 w-full">
          {[0.25, 0.5, 0.75, 1].map(level => (
            <polygon
              key={level}
              points={makePoints(normalizedMetrics, () => level)}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />
          ))}
          {normalizedMetrics.map((_, index) => {
            const end = getPoint(index, normalizedMetrics.length, 1);
            return (
              <line
                key={index}
                x1={CENTER}
                y1={CENTER}
                x2={end.x}
                y2={end.y}
                stroke="hsl(var(--border))"
                strokeWidth="1"
              />
            );
          })}
          <polygon
            points={makePoints(normalizedMetrics, metric => clampScore(metric.value) / 10)}
            fill="hsl(var(--primary) / 0.12)"
            stroke="hsl(var(--primary))"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          {normalizedMetrics.map((metric, index) => {
            const point = getPoint(index, normalizedMetrics.length, clampScore(metric.value) / 10);
            const label = getPoint(index, normalizedMetrics.length, 1.2);
            return (
              <g key={metric.id}>
                <circle cx={point.x} cy={point.y} r="3.4" fill="hsl(var(--primary))" />
                <text
                  x={label.x}
                  y={label.y}
                  textAnchor={getTextAnchor(label.x)}
                  dominantBaseline="middle"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="8"
                  fontWeight="600"
                >
                  {metric.label.length > 7 ? `${metric.label.slice(0, 7)}...` : metric.label}
                </text>
              </g>
            );
          })}
          <circle cx={CENTER} cy={CENTER} r="2" fill="hsl(var(--foreground))" />
        </svg>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-xl bg-background p-3">
            <p className="text-muted-foreground">평균 점수</p>
            <p className="text-lg font-semibold">{formatScore(average)}</p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="text-muted-foreground">선택 근거</p>
            <p className="text-lg font-semibold">{totalEvidence}개</p>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {normalizedMetrics.map(metric => (
          <div key={metric.id} className="rounded-2xl border bg-background/80 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{metric.label}</p>
                {metric.description && (
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{metric.description}</p>
                )}
              </div>
              <span className="text-lg font-semibold tabular-nums">{formatScore(metric.value)}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${clampScore(metric.value) * 10}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Badge variant="outline" className="rounded-full text-[11px]">
                근거 {metric.evidenceCount ?? 0}
              </Badge>
              <span className="text-[11px] text-muted-foreground">10점 기준</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!framed) return <div className={className}>{content}</div>;

  return (
    <Card className={cn('overflow-hidden border-border/80 bg-card/95 shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl border bg-background">
                <Target className="h-4 w-4" />
              </span>
              {title}
            </CardTitle>
            <p className="mt-2 text-sm text-muted-foreground">{summary}</p>
          </div>
          <Badge variant="secondary" className="rounded-full">
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            근거 기반
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default PerformanceRadarChart;
