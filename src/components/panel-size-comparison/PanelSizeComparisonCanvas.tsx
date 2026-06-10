import { useId, useMemo } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getPanelQualityVisual,
  sortPanelSizeComparisonItems,
} from '@/hooks/usePanelSizeComparisonData';
import type { PanelSizeComparisonItem } from '@/types/panelSizeComparison';

interface PanelSizeComparisonCanvasProps {
  items: PanelSizeComparisonItem[];
  highlightedId?: string | null;
  opacity: number;
  compact?: boolean;
  className?: string;
}

const NICE_TICK_STEPS = [50, 100, 250, 500, 1000, 2000, 5000];

const makeTicks = (maxValue: number, scale = 1, minPixelSpacing = 64) => {
  if (maxValue <= 0) return [];
  const roughStep = scale > 0 ? minPixelSpacing / scale : 250;
  const step = NICE_TICK_STEPS.find((candidate) => candidate >= roughStep) || NICE_TICK_STEPS[NICE_TICK_STEPS.length - 1];
  const ticks: number[] = [];
  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== maxValue) ticks.push(maxValue);
  return ticks;
};

const formatMm = (value: number) => `${Math.round(value).toLocaleString()}mm`;

export function PanelSizeComparisonCanvas({
  items,
  highlightedId,
  opacity,
  compact = false,
  className,
}: PanelSizeComparisonCanvasProps) {
  const rawId = useId();
  const glowId = `panel-glow-${rawId.replace(/:/g, '')}`;

  const geometry = useMemo(() => {
    const maxWidth = Math.max(0, ...items.map((item) => item.width));
    const maxHeight = Math.max(0, ...items.map((item) => item.height));
    const viewHeight = compact ? 430 : 660;
    const margin = compact
      ? { top: 70, right: 42, bottom: 58, left: 70 }
      : { top: 118, right: 78, bottom: 90, left: 112 };
    const drawingHeight = viewHeight - margin.top - margin.bottom;
    const maxViewWidth = compact ? 760 : 1040;
    const minViewWidth = compact ? 360 : 520;
    const heightLimitedScale = maxHeight > 0 ? drawingHeight / maxHeight : 1;
    const heightLimitedPlotWidth = maxWidth * heightLimitedScale;
    const fittedViewWidth = Math.ceil(
      margin.left + margin.right + heightLimitedPlotWidth + (compact ? 40 : 56)
    );
    const viewWidth = maxWidth > 0 && maxHeight > 0
      ? Math.min(maxViewWidth, Math.max(minViewWidth, fittedViewWidth))
      : maxViewWidth;
    const drawingWidth = viewWidth - margin.left - margin.right;
    const scale = maxWidth > 0 && maxHeight > 0
      ? Math.min(drawingWidth / maxWidth, drawingHeight / maxHeight)
      : 1;
    const plotWidth = maxWidth * scale;
    const plotHeight = maxHeight * scale;
    const originX = margin.left + Math.max(0, (drawingWidth - plotWidth) / 2);
    const originY = viewHeight - margin.bottom;
    const plotTop = originY - plotHeight;
    const plotRight = originX + plotWidth;

    return {
      maxWidth,
      maxHeight,
      viewWidth,
      viewHeight,
      margin,
      drawingWidth,
      drawingHeight,
      scale,
      originX,
      originY,
      plotWidth,
      plotHeight,
      plotTop,
      plotRight,
      xTicks: makeTicks(maxWidth, scale, compact ? 58 : 76),
      yTicks: makeTicks(maxHeight, scale, compact ? 56 : 68),
    };
  }, [compact, items]);

  if (items.length === 0 || geometry.maxWidth <= 0 || geometry.maxHeight <= 0) {
    return (
      <div
        className={cn(
          'flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-center',
          className
        )}
      >
        <div className="space-y-2 px-5">
          <Layers className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">표시할 원판이 없습니다</p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            선택한 두께와 재질에서 제작 가능한 활성 원판이 없습니다.
          </p>
        </div>
      </div>
    );
  }

  const baseOpacity = Math.min(0.85, Math.max(0.2, opacity / 100));
  const paintItems = [...items].sort((a, b) => b.area - a.area);
  const labelItems = sortPanelSizeComparisonItems(items);
  const highlighted = items.find((item) => item.id === highlightedId) || labelItems[0];
  const highlightedVisual = highlighted ? getPanelQualityVisual(highlighted.quality) : null;
  const highlightedRect = highlighted
    ? {
        x: geometry.originX,
        y: geometry.originY - highlighted.height * geometry.scale,
        width: highlighted.width * geometry.scale,
        height: highlighted.height * geometry.scale,
      }
    : null;

  return (
    <div
      className={cn(
        'relative w-full max-w-full overflow-hidden rounded-lg border border-border/70 bg-background shadow-sm',
        compact
          ? 'h-[190px] sm:h-auto sm:min-h-[170px] sm:aspect-[16/9]'
          : 'h-[380px] sm:h-auto sm:min-h-[360px] sm:aspect-[16/10]',
        className
      )}
    >
      {highlighted && highlightedVisual && (
        <div
          className={cn(
            'pointer-events-none absolute z-10 flex max-w-[calc(100%-2rem)] items-center gap-2.5 rounded-lg border border-border/70 bg-background/90 shadow-sm backdrop-blur',
            compact ? 'left-2 top-2 px-2.5 py-1.5' : 'left-4 top-4 px-3 py-2'
          )}
        >
          <span
            className={cn('shrink-0 rounded-full', compact ? 'h-2.5 w-2.5' : 'h-3 w-3')}
            style={{ backgroundColor: highlightedVisual.fill }}
          />
          <div className="min-w-0">
            <div className={cn('truncate font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>
              {highlighted.qualityName} · {highlighted.sizeName}
            </div>
            <div className={cn('truncate tabular-nums text-muted-foreground', compact ? 'text-[11px]' : 'text-xs')}>
              {formatMm(highlighted.width)} x {formatMm(highlighted.height)}
            </div>
          </div>
        </div>
      )}

      <svg
        className="h-full w-full"
        viewBox={`0 0 ${geometry.viewWidth} ${geometry.viewHeight}`}
        role="img"
        aria-label="선택한 원판 사이즈를 같은 축척으로 겹쳐 비교한 도면"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#0f172a" floodOpacity="0.16" />
          </filter>
          <pattern id={`${glowId}-grid`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(var(--border))" strokeOpacity="0.35" strokeWidth="1" />
          </pattern>
        </defs>

        <rect width={geometry.viewWidth} height={geometry.viewHeight} fill="hsl(var(--background))" />
        <rect
          x={geometry.originX}
          y={geometry.plotTop}
          width={geometry.plotWidth}
          height={geometry.plotHeight}
          rx={compact ? 4 : 6}
          fill="hsl(var(--muted) / 0.16)"
        />
        <rect
          x={geometry.originX}
          y={geometry.plotTop}
          width={geometry.plotWidth}
          height={geometry.plotHeight}
          fill={`url(#${glowId}-grid)`}
          opacity="0.75"
        />

        {geometry.xTicks.map((tick, index) => {
          const x = geometry.originX + tick * geometry.scale;
          const nextTick = geometry.xTicks[index + 1];
          const nextX = typeof nextTick === 'number' ? geometry.originX + nextTick * geometry.scale : null;
          const hideNearFinalLabel = nextX !== null && index === geometry.xTicks.length - 2 && nextX - x < (compact ? 32 : 44);

          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={geometry.plotTop}
                x2={x}
                y2={geometry.originY}
                stroke="hsl(var(--border))"
                strokeOpacity={tick === 0 ? 0.9 : 0.45}
              />
              {!compact && !hideNearFinalLabel && (
                <text x={x} y={geometry.originY + 24} textAnchor="middle" fontSize="13" fill="hsl(var(--muted-foreground))">
                  {tick.toLocaleString()}
                </text>
              )}
            </g>
          );
        })}

        {geometry.yTicks.map((tick, index) => {
          const y = geometry.originY - tick * geometry.scale;
          const nextTick = geometry.yTicks[index + 1];
          const nextY = typeof nextTick === 'number' ? geometry.originY - nextTick * geometry.scale : null;
          const hideNearFinalLabel = nextY !== null && index === geometry.yTicks.length - 2 && y - nextY < (compact ? 24 : 34);

          return (
            <g key={`y-${tick}`}>
              <line
                x1={geometry.originX}
                y1={y}
                x2={geometry.plotRight}
                y2={y}
                stroke="hsl(var(--border))"
                strokeOpacity={tick === 0 ? 0.9 : 0.45}
              />
              {!compact && !hideNearFinalLabel && (
                <text x={geometry.originX - 14} y={y + 4} textAnchor="end" fontSize="13" fill="hsl(var(--muted-foreground))">
                  {tick.toLocaleString()}
                </text>
              )}
            </g>
          );
        })}

        {paintItems.map((item) => {
          const visual = getPanelQualityVisual(item.quality);
          const isHighlighted = item.id === highlighted?.id;
          const rectWidth = item.width * geometry.scale;
          const rectHeight = item.height * geometry.scale;
          const rectY = geometry.originY - rectHeight;

          return (
            <g
              key={item.id}
              className="transition-all duration-500 motion-reduce:transition-none"
              opacity={isHighlighted ? 1 : baseOpacity}
              filter={isHighlighted && !compact ? `url(#${glowId})` : undefined}
            >
              <rect
                x={geometry.originX}
                y={rectY}
                width={rectWidth}
                height={rectHeight}
                rx={compact ? 5 : 7}
                fill={visual.fill}
                fillOpacity={isHighlighted ? Math.min(0.42, baseOpacity + 0.18) : baseOpacity * 0.62}
                stroke={visual.stroke}
                strokeWidth={isHighlighted ? (compact ? 1.8 : 2) : (compact ? 0.8 : 0.95)}
                vectorEffect="non-scaling-stroke"
              />
              {!compact && rectWidth > 92 && rectHeight > 38 && (
                <text
                  x={geometry.originX + rectWidth - 12}
                  y={rectY + 24}
                  textAnchor="end"
                  fontSize="18"
                  fontWeight={isHighlighted ? 700 : 600}
                  fill={visual.stroke}
                  opacity={isHighlighted ? 1 : 0.76}
                >
                  {item.sizeName}
                </text>
              )}
            </g>
          );
        })}

        {highlighted && highlightedRect && highlightedVisual && (
          <g className="transition-opacity duration-500 motion-reduce:transition-none">
            {!compact && (
              <>
                <line
                  x1={highlightedRect.x}
                  y1={highlightedRect.y - 18}
                  x2={highlightedRect.x + highlightedRect.width}
                  y2={highlightedRect.y - 18}
                  stroke={highlightedVisual.stroke}
                  strokeWidth="0.9"
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={highlightedRect.x + highlightedRect.width + 18}
                  y1={highlightedRect.y}
                  x2={highlightedRect.x + highlightedRect.width + 18}
                  y2={highlightedRect.y + highlightedRect.height}
                  stroke={highlightedVisual.stroke}
                  strokeWidth="0.9"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            )}
          </g>
        )}

        {!compact && (
          <>
            <text
              x={geometry.plotRight}
              y={geometry.originY + 58}
              textAnchor="end"
              fontSize="13"
              fill="hsl(var(--muted-foreground))"
            >
              width mm
            </text>
            <text
              x={geometry.originX}
              y={geometry.plotTop - 18}
              textAnchor="start"
              fontSize="13"
              fill="hsl(var(--muted-foreground))"
            >
              height mm
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
