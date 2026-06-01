import { useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

export type DashboardQuickLinkCategory = 'work' | 'quote-project' | 'management' | 'external';

export type DashboardQuickLinkItem = {
  id: string;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  category: DashboardQuickLinkCategory;
  priority: number;
  path?: string;
  externalUrl?: string;
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  requiresMaster?: boolean;
  action: () => void;
};

type DashboardQuickLinksSectionProps = {
  items: DashboardQuickLinkItem[];
  isAuthenticated: boolean;
  isAdmin: boolean;
  isModerator: boolean;
  isMaster: boolean;
};

type CategoryFilter = 'all' | DashboardQuickLinkCategory;

const CATEGORY_LABELS: Record<DashboardQuickLinkCategory, string> = {
  work: '업무',
  'quote-project': '견적·프로젝트',
  management: '관리',
  external: '외부',
};

const CATEGORY_ORDER: DashboardQuickLinkCategory[] = ['work', 'quote-project', 'management', 'external'];

const DashboardQuickLinksSection = ({
  items,
  isAuthenticated,
  isAdmin,
  isModerator,
  isMaster,
}: DashboardQuickLinksSectionProps) => {
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');

  const visibleItems = useMemo(() => {
    return items
      .filter((item) => {
        if (item.requiresAuth && !isAuthenticated) return false;
        if (item.requiresMaster && !isMaster) return false;
        if (item.requiresAdmin && !isAdmin && !isModerator) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.category !== b.category) {
          return CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
        }
        return a.priority - b.priority || a.title.localeCompare(b.title, 'ko');
      });
  }, [isAdmin, isAuthenticated, isMaster, isModerator, items]);

  const categoryCounts = useMemo(() => {
    return visibleItems.reduce<Record<DashboardQuickLinkCategory, number>>((acc, item) => {
      acc[item.category] += 1;
      return acc;
    }, {
      work: 0,
      'quote-project': 0,
      management: 0,
      external: 0,
    });
  }, [visibleItems]);

  const filters = useMemo(() => {
    return [
      { id: 'all' as const, label: '전체', count: visibleItems.length },
      ...CATEGORY_ORDER
        .filter((category) => categoryCounts[category] > 0)
        .map((category) => ({
          id: category,
          label: CATEGORY_LABELS[category],
          count: categoryCounts[category],
        })),
    ];
  }, [categoryCounts, visibleItems.length]);

  const filteredItems = activeCategory === 'all'
    ? visibleItems
    : visibleItems.filter((item) => item.category === activeCategory);

  if (visibleItems.length === 0) return null;

  return (
    <section className="mt-6 rounded-lg border border-border/70 bg-white p-3 shadow-none dark:bg-background/80 sm:p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">업무 바로가기</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{filteredItems.length}개 항목</p>
        </div>
        <div className="flex max-w-full gap-1.5 overflow-x-auto pb-1 sm:justify-end sm:pb-0" role="tablist" aria-label="바로가기 분류">
          {filters.map((filter) => {
            const isActive = activeCategory === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveCategory(filter.id)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  isActive
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/80 bg-white text-muted-foreground hover:border-foreground/30 hover:text-foreground dark:bg-background'
                )}
              >
                <span>{filter.label}</span>
                <span className={cn('text-[10px]', isActive ? 'text-background/70' : 'text-muted-foreground')}>
                  {filter.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isExternal = Boolean(item.externalUrl);

          return (
            <button
              key={item.id}
              type="button"
              onClick={item.action}
              className="group flex min-h-[68px] w-full items-center gap-3 rounded-lg border border-border/70 bg-white px-3 py-2.5 text-left shadow-none transition-colors hover:border-foreground/25 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-background dark:hover:bg-muted/35"
              aria-label={`${item.title} 열기`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition-colors group-hover:border-foreground/25 group-hover:text-foreground dark:bg-background">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold leading-5 text-foreground">
                    {item.title}
                  </span>
                  {isExternal && (
                    <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      외부
                      <ExternalLink className="h-2.5 w-2.5" />
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-xs leading-5 text-muted-foreground">
                  {item.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default DashboardQuickLinksSection;
