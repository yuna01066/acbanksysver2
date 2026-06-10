import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calculator,
  Check,
  Layers3,
  Loader2,
  Pause,
  Play,
  Ruler,
  Settings,
} from 'lucide-react';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { PanelSizeComparisonCanvas } from '@/components/panel-size-comparison/PanelSizeComparisonCanvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  getLargestPanelSizeByQuality,
  getPanelQualityVisual,
  sortPanelSizeComparisonItems,
  usePanelSizeComparisonData,
} from '@/hooks/usePanelSizeComparisonData';
import { cn } from '@/lib/utils';
import type {
  PanelSizeComparisonFilters,
  PanelSizeComparisonItem,
  PanelSizeComparisonViewMode,
} from '@/types/panelSizeComparison';

const DEFAULT_FILTERS: PanelSizeComparisonFilters = {
  thickness: '3T',
  selectedQualities: [],
  selectedSizeNames: [],
  opacity: 48,
  isPlaying: true,
  viewMode: 'all',
};

function parseViewMode(value: string | null): PanelSizeComparisonViewMode | null {
  if (value === 'all' || value === 'largest') return value;
  return null;
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return prefersReducedMotion;
}

function formatPrice(value: number | null) {
  if (!value || value <= 0) return '단가 미등록';
  return `${Math.round(value).toLocaleString()}원`;
}

function formatDimension(item: PanelSizeComparisonItem) {
  return `${item.width.toLocaleString()} x ${item.height.toLocaleString()}mm`;
}

function groupItemsByQuality(items: PanelSizeComparisonItem[]) {
  const grouped = new Map<string, PanelSizeComparisonItem[]>();

  for (const item of items) {
    grouped.set(item.quality, [...(grouped.get(item.quality) || []), item]);
  }

  return Array.from(grouped.entries()).map(([quality, qualityItems]) => ({
    quality,
    items: sortPanelSizeComparisonItems(qualityItems),
  }));
}

function getSizeOptions(items: PanelSizeComparisonItem[]) {
  const grouped = new Map<string, number>();

  for (const item of sortPanelSizeComparisonItems(items)) {
    grouped.set(item.sizeName, (grouped.get(item.sizeName) || 0) + 1);
  }

  return Array.from(grouped.entries()).map(([sizeName, count]) => ({
    sizeName,
    count,
  }));
}

const PanelSizeComparisonPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = usePrefersReducedMotion();
  const { items, qualitySummaries, thicknesses, isLoading, isError, error } = usePanelSizeComparisonData();
  const [filters, setFilters] = useState<PanelSizeComparisonFilters>(() => ({
    ...DEFAULT_FILTERS,
    thickness: searchParams.get('thickness') || DEFAULT_FILTERS.thickness,
    viewMode: parseViewMode(searchParams.get('mode')) || DEFAULT_FILTERS.viewMode,
  }));
  const [qualitySelectionInitialized, setQualitySelectionInitialized] = useState(false);
  const [sizeSelectionInitialized, setSizeSelectionInitialized] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const searchParamKey = searchParams.toString();

  useEffect(() => {
    if (prefersReducedMotion) {
      setFilters((current) => ({ ...current, isPlaying: false }));
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParamKey);
    const requestedThickness = nextParams.get('thickness') || DEFAULT_FILTERS.thickness;
    const requestedViewMode = parseViewMode(nextParams.get('mode')) || DEFAULT_FILTERS.viewMode;

    setFilters((current) => {
      if (current.thickness === requestedThickness && current.viewMode === requestedViewMode) {
        return current;
      }

      return {
        ...current,
        thickness: requestedThickness,
        viewMode: requestedViewMode,
      };
    });
  }, [searchParamKey]);

  useEffect(() => {
    if (thicknesses.length === 0) return;

    setFilters((current) => {
      if (thicknesses.includes(current.thickness)) return current;
      return {
        ...current,
        thickness: thicknesses.includes('3T') ? '3T' : thicknesses[0],
      };
    });
  }, [thicknesses]);

  useEffect(() => {
    const availableQualities = qualitySummaries.map((summary) => summary.quality);
    if (availableQualities.length === 0) return;

    if (!qualitySelectionInitialized) {
      setFilters((current) => ({
        ...current,
        selectedQualities: availableQualities,
      }));
      setQualitySelectionInitialized(true);
      return;
    }

    setFilters((current) => ({
      ...current,
      selectedQualities: current.selectedQualities.filter((quality) => availableQualities.includes(quality)),
    }));
  }, [qualitySelectionInitialized, qualitySummaries]);

  const qualityFilteredItems = useMemo(
    () => items.filter((item) =>
      item.thickness === filters.thickness &&
      filters.selectedQualities.includes(item.quality)
    ),
    [filters.selectedQualities, filters.thickness, items]
  );

  const sizeOptions = useMemo(() => getSizeOptions(qualityFilteredItems), [qualityFilteredItems]);
  const availableSizeNames = useMemo(() => sizeOptions.map((option) => option.sizeName), [sizeOptions]);

  useEffect(() => {
    if (availableSizeNames.length === 0) return;

    if (!sizeSelectionInitialized) {
      setFilters((current) => ({
        ...current,
        selectedSizeNames: availableSizeNames,
      }));
      setSizeSelectionInitialized(true);
      return;
    }

    setFilters((current) => {
      const nextSelectedSizeNames = current.selectedSizeNames.filter((sizeName) =>
        availableSizeNames.includes(sizeName)
      );

      if (nextSelectedSizeNames.length === current.selectedSizeNames.length) return current;
      if (current.selectedSizeNames.length > 0 && nextSelectedSizeNames.length === 0) {
        return {
          ...current,
          selectedSizeNames: availableSizeNames,
        };
      }

      return {
        ...current,
        selectedSizeNames: nextSelectedSizeNames,
      };
    });
  }, [availableSizeNames, sizeSelectionInitialized]);

  const sourceItems = useMemo(
    () => qualityFilteredItems.filter((item) =>
      filters.selectedSizeNames.includes(item.sizeName)
    ),
    [filters.selectedSizeNames, qualityFilteredItems]
  );

  const comparisonItems = useMemo(() => {
    if (filters.viewMode === 'largest') return getLargestPanelSizeByQuality(sourceItems);
    return sortPanelSizeComparisonItems(sourceItems);
  }, [filters.viewMode, sourceItems]);

  const groupedSourceItems = useMemo(() => groupItemsByQuality(sourceItems), [sourceItems]);
  const largestItems = useMemo(() => getLargestPanelSizeByQuality(sourceItems), [sourceItems]);
  const maxWidth = Math.max(0, ...sourceItems.map((item) => item.width));
  const maxHeight = Math.max(0, ...sourceItems.map((item) => item.height));

  useEffect(() => {
    if (comparisonItems.length === 0) {
      setHighlightedId(null);
      return;
    }

    setHighlightedId((current) =>
      current && comparisonItems.some((item) => item.id === current)
        ? current
        : comparisonItems[0].id
    );
  }, [comparisonItems]);

  useEffect(() => {
    if (!filters.isPlaying || prefersReducedMotion || comparisonItems.length <= 1) return;

    const timer = window.setInterval(() => {
      setHighlightedId((current) => {
        const currentIndex = comparisonItems.findIndex((item) => item.id === current);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % comparisonItems.length : 0;
        return comparisonItems[nextIndex].id;
      });
    }, 1300);

    return () => window.clearInterval(timer);
  }, [comparisonItems, filters.isPlaying, prefersReducedMotion]);

  const updateFilters = (patch: Partial<PanelSizeComparisonFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const toggleQuality = (quality: string) => {
    setFilters((current) => {
      const exists = current.selectedQualities.includes(quality);
      return {
        ...current,
        selectedQualities: exists
          ? current.selectedQualities.filter((selected) => selected !== quality)
          : [...current.selectedQualities, quality],
      };
    });
  };

  const toggleSizeName = (sizeName: string) => {
    setFilters((current) => {
      const exists = current.selectedSizeNames.includes(sizeName);
      return {
        ...current,
        selectedSizeNames: exists
          ? current.selectedSizeNames.filter((selected) => selected !== sizeName)
          : [...current.selectedSizeNames, sizeName],
      };
    });
  };

  const visibleQualityCount = new Set(sourceItems.map((item) => item.quality)).size;
  const highlightedItem = comparisonItems.find((item) => item.id === highlightedId) || null;

  return (
    <PageShell maxWidth="full" contentClassName="max-w-[1500px]">
      <PageHeader
        eyebrow="Panel Scale"
        title="원판 사이즈 비교"
        description="선택한 두께에서 재질별 제작 가능한 원판을 같은 축척으로 겹쳐 비교합니다."
        icon={<Ruler className="h-5 w-5" />}
        meta={(
          <>
            <Badge variant="secondary">{filters.thickness || '두께 선택'}</Badge>
            <Badge variant="outline">{sourceItems.length}개 활성 원판</Badge>
            <Badge variant="outline">{visibleQualityCount}개 재질</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/calculator?type=yield')}>
              <Calculator className="h-4 w-4" />
              수율 계산기
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/panel-management')}>
              <Settings className="h-4 w-4" />
              원판 관리
            </Button>
          </>
        )}
      />

      <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)_260px_180px] xl:items-end">
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">두께</div>
            <Select
              value={filters.thickness}
              onValueChange={(thickness) => updateFilters({ thickness })}
              disabled={isLoading || thicknesses.length === 0}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="두께 선택" />
              </SelectTrigger>
              <SelectContent>
                {thicknesses.map((thickness) => (
                  <SelectItem key={thickness} value={thickness}>{thickness}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">재질</div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => updateFilters({ selectedQualities: qualitySummaries.map((summary) => summary.quality) })}
                >
                  전체
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => updateFilters({ selectedQualities: [] })}
                >
                  해제
                </Button>
              </div>
            </div>
            <div className="flex min-h-9 flex-wrap items-center gap-1.5">
              {qualitySummaries.map((summary) => {
                const visual = getPanelQualityVisual(summary.quality);
                const selected = filters.selectedQualities.includes(summary.quality);
                const activeForThickness = items.filter((item) =>
                  item.quality === summary.quality &&
                  item.thickness === filters.thickness
                ).length;

                return (
                  <button
                    key={summary.quality}
                    type="button"
                    className={cn(
                      'flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      selected
                        ? 'border-foreground/15 bg-foreground text-background'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent/50',
                      activeForThickness === 0 && 'opacity-45'
                    )}
                    onClick={() => toggleQuality(summary.quality)}
                    disabled={activeForThickness === 0}
                    aria-pressed={selected}
                  >
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visual.fill }} />
                    <span>{visual.label}</span>
                    <span className={cn('tabular-nums', selected ? 'text-background/70' : 'text-muted-foreground')}>
                      {activeForThickness}
                    </span>
                    {selected && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">보기</div>
            <ToggleGroup
              type="single"
              value={filters.viewMode}
              onValueChange={(value) => {
                if (value) updateFilters({ viewMode: value as PanelSizeComparisonViewMode });
              }}
              className="justify-start rounded-md border bg-background p-1"
            >
              <ToggleGroupItem value="all" className="h-7 flex-1 rounded px-2 text-xs">
                전체 원판
              </ToggleGroupItem>
              <ToggleGroupItem value="largest" className="h-7 flex-1 rounded px-2 text-xs">
                재질별 최대
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-muted-foreground">레이어 농도</div>
              <span className="text-xs tabular-nums text-muted-foreground">{filters.opacity}%</span>
            </div>
            <Slider
              min={25}
              max={80}
              step={1}
              value={[filters.opacity]}
              onValueChange={([opacity]) => updateFilters({ opacity })}
            />
          </div>
        </div>

        <div className="mt-4 border-t border-border/70 pt-3">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="text-xs font-medium text-muted-foreground">규격</div>
              <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">
                {filters.selectedSizeNames.length}/{sizeOptions.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => updateFilters({ selectedSizeNames: availableSizeNames })}
                disabled={availableSizeNames.length === 0}
              >
                전체
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => updateFilters({ selectedSizeNames: [] })}
                disabled={availableSizeNames.length === 0}
              >
                해제
              </Button>
            </div>
          </div>
          <div className="flex min-h-9 flex-wrap items-center gap-1.5">
            {sizeOptions.length === 0 ? (
              <span className="text-xs text-muted-foreground">선택한 재질에서 가능한 규격이 없습니다.</span>
            ) : (
              sizeOptions.map((option) => {
                const selected = filters.selectedSizeNames.includes(option.sizeName);

                return (
                  <button
                    key={option.sizeName}
                    type="button"
                    className={cn(
                      'flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors',
                      selected
                        ? 'border-primary/35 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                    )}
                    onClick={() => toggleSizeName(option.sizeName)}
                    aria-pressed={selected}
                  >
                    <span>{option.sizeName}</span>
                    <span className={cn('tabular-nums', selected ? 'text-primary/70' : 'text-muted-foreground')}>
                      {option.count}
                    </span>
                    {selected && <Check className="h-3 w-3" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-dashed bg-card">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-sm text-destructive">
          원판 데이터를 불러오지 못했습니다: {error instanceof Error ? error.message : '알 수 없는 오류'}
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_420px]">
          <section className="rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Layers3 className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">축척 비교 캔버스</h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  모든 원판은 좌하단 기준으로 정렬되며, 실제 mm 비율을 유지합니다.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant={filters.isPlaying ? 'default' : 'outline'}
                  size="sm"
                  className="h-9 gap-1.5"
                  onClick={() => updateFilters({ isPlaying: !filters.isPlaying })}
                  disabled={prefersReducedMotion || comparisonItems.length <= 1}
                >
                  {filters.isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {filters.isPlaying ? '정지' : '재생'}
                </Button>
              </div>
            </div>

            <PanelSizeComparisonCanvas
              items={comparisonItems}
              highlightedId={highlightedId}
              opacity={filters.opacity}
            />

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <div className="text-[11px] font-medium text-muted-foreground">최대 가로</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">{maxWidth.toLocaleString()}mm</div>
              </div>
              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <div className="text-[11px] font-medium text-muted-foreground">최대 세로</div>
                <div className="mt-1 text-sm font-semibold tabular-nums text-foreground">{maxHeight.toLocaleString()}mm</div>
              </div>
              <div className="rounded-lg border bg-background/80 px-3 py-2">
                <div className="text-[11px] font-medium text-muted-foreground">현재 강조</div>
                <div className="mt-1 truncate text-sm font-semibold text-foreground">
                  {highlightedItem ? `${highlightedItem.qualityName} ${highlightedItem.sizeName}` : '-'}
                </div>
              </div>
            </div>

            {largestItems.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {largestItems.map((item) => {
                  const visual = getPanelQualityVisual(item.quality);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={cn(
                        'flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-xs transition-colors hover:bg-accent/45',
                        highlightedId === item.id && 'border-primary/40 bg-primary/5'
                      )}
                      onClick={() => setHighlightedId(item.id)}
                    >
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: visual.fill }} />
                      <span className="font-medium text-foreground">{visual.shortLabel}</span>
                      <span className="text-muted-foreground">{item.sizeName}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="rounded-lg border border-border/70 bg-card p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">제작 가능 목록</h2>
                <p className="mt-1 text-xs text-muted-foreground">활성 원판만 표시됩니다.</p>
              </div>
              <Badge variant="secondary" className="rounded-full px-2.5 text-xs">
                {sourceItems.length}건
              </Badge>
            </div>

            {sourceItems.length === 0 ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-lg border border-dashed bg-muted/20 px-5 text-center">
                <div className="space-y-2">
                  <Ruler className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">선택 조건에 맞는 원판이 없습니다</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    두께, 재질, 규격 선택을 다시 확인해주세요.
                  </p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[620px] pr-3">
                <div className="space-y-4">
                  {groupedSourceItems.map((group) => {
                    const first = group.items[0];
                    const visual = getPanelQualityVisual(group.quality);

                    return (
                      <section key={group.quality} className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: visual.fill }} />
                            <h3 className="truncate text-sm font-semibold text-foreground">
                              {first.qualityName}
                            </h3>
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground">{group.items.length}개</span>
                        </div>

                        <div className="space-y-1.5">
                          {group.items.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              className={cn(
                                'w-full rounded-lg border bg-background/80 p-2.5 text-left transition-colors hover:bg-accent/35',
                                highlightedId === item.id && 'border-primary/50 bg-primary/5'
                              )}
                              onClick={() => setHighlightedId(item.id)}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-foreground">{item.sizeName}</span>
                                    {filters.viewMode === 'largest' && largestItems.some((largest) => largest.id === item.id) && (
                                      <Badge variant="outline" className="rounded-full px-2 py-0 text-[10px]">최대</Badge>
                                    )}
                                  </div>
                                  <div className="mt-1 text-xs tabular-nums text-muted-foreground">
                                    {formatDimension(item)}
                                  </div>
                                </div>
                                <div className="shrink-0 text-right text-xs">
                                  <div className="font-medium tabular-nums text-foreground">{(item.area / 1_000_000).toFixed(2)}m²</div>
                                  <div className="mt-1 text-muted-foreground">{formatPrice(item.price)}</div>
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </aside>
        </div>
      )}
    </PageShell>
  );
};

export default PanelSizeComparisonPage;
