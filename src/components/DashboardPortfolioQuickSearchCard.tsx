import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, Images, Loader2, Plus, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  getPortfolioCategoryKeywords,
  getPortfolioCategoryLabel,
  PORTFOLIO_CATEGORY_FILTERS,
} from '@/lib/portfolioSearch';
import { hydratePortfolioThumbnailUrls } from '@/lib/portfolioThumbnails';

type PortfolioSearchRow = {
  id: string;
  title: string;
  category: string | null;
  client_name: string | null;
  project_year: number | null;
  location: string | null;
  materials: string[] | null;
  processes: string[] | null;
  keywords: string[] | null;
  created_at: string;
  updated_at: string;
  image_count: number;
};

type PortfolioListImage = {
  id: string;
  post_id: string;
  file_name: string;
  thumbnail_url: string | null;
  image_url: string | null;
  thumbnail_bucket: string | null;
  thumbnail_path: string | null;
  is_main: boolean;
  display_order: number;
  image_count?: number;
};

type PortfolioQuickItem = PortfolioSearchRow & {
  thumbnail_url: string | null;
};

type RecentPortfolioPost = {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  viewedAt: number;
};

const RECENT_PORTFOLIO_POSTS_KEY = 'portfolio-recent-posts';
const DASHBOARD_PORTFOLIO_LIMIT = 4;

function readRecentPortfolioPosts(): RecentPortfolioPost[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(RECENT_PORTFOLIO_POSTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item): item is RecentPortfolioPost => (
        item
        && typeof item.id === 'string'
        && typeof item.title === 'string'
        && typeof item.viewedAt === 'number'
      ))
      .sort((a, b) => b.viewedAt - a.viewedAt)
      .slice(0, DASHBOARD_PORTFOLIO_LIMIT);
  } catch {
    return [];
  }
}

async function fetchPortfolioQuickItems(searchText: string, categoryKey: string): Promise<PortfolioQuickItem[]> {
  const categoryKeywords = getPortfolioCategoryKeywords(categoryKey);
  const { data, error } = await (supabase.rpc as any)('search_portfolio_posts', {
    p_search_text: searchText || null,
    p_category_keywords: categoryKeywords.length > 0 ? categoryKeywords : null,
    p_exact_keyword: null,
    p_limit: DASHBOARD_PORTFOLIO_LIMIT,
    p_offset: 0,
    p_gallery_type: 'portfolio',
  });
  if (error) throw error;

  const rows = (data || []) as PortfolioSearchRow[];
  const postIds = rows.map(row => row.id);
  const imagesByPostId = new Map<string, PortfolioListImage>();

  if (postIds.length > 0) {
    const listImages = await (supabase.rpc as any)('get_portfolio_post_main_images', {
      p_post_ids: postIds,
    });
    if (!listImages.error) {
      const hydrated = await hydratePortfolioThumbnailUrls((listImages.data || []) as PortfolioListImage[]);
      hydrated.forEach((image) => imagesByPostId.set(image.post_id, image));
    }
  }

  return rows.map(row => {
    const image = imagesByPostId.get(row.id);
    return {
      ...row,
      thumbnail_url: image?.thumbnail_url || image?.image_url || null,
    };
  });
}

const buildPortfolioUrl = (searchText: string, categoryKey: string) => {
  const params = new URLSearchParams();
  if (searchText.trim()) params.set('q', searchText.trim());
  if (categoryKey !== 'all') params.set('category', getPortfolioCategoryLabel(categoryKey));
  return `/portfolio${params.toString() ? `?${params.toString()}` : ''}`;
};

export default function DashboardPortfolioQuickSearchCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchText, setSearchText] = useState('');
  const [categoryKey, setCategoryKey] = useState('all');
  const [recentPosts, setRecentPosts] = useState<RecentPortfolioPost[]>(() => readRecentPortfolioPosts());
  const deferredSearchText = useDeferredValue(searchText);
  const normalizedSearchText = deferredSearchText.trim();
  const isSearching = Boolean(normalizedSearchText || categoryKey !== 'all');

  const { data: items = [], isLoading, isFetching } = useQuery({
    queryKey: ['home-portfolio-quick-search', normalizedSearchText, categoryKey],
    queryFn: () => fetchPortfolioQuickItems(normalizedSearchText, categoryKey),
    enabled: !!user && isSearching,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const refreshRecentPosts = () => setRecentPosts(readRecentPortfolioPosts());

    refreshRecentPosts();
    window.addEventListener('focus', refreshRecentPosts);
    window.addEventListener('storage', refreshRecentPosts);
    return () => {
      window.removeEventListener('focus', refreshRecentPosts);
      window.removeEventListener('storage', refreshRecentPosts);
    };
  }, []);

  const resultLabel = useMemo(() => (
    isSearching ? `${items.length}건 검색` : recentPosts.length > 0 ? `최근 조회 ${recentPosts.length}건` : '최근 조회 없음'
  ), [isSearching, items.length, recentPosts.length]);

  if (!user) return null;

  return (
    <Card className="flex h-full w-full flex-col">
      <CardHeader className="pb-3">
        <BrandedCardHeader
          icon={Images}
          title="포트폴리오 빠른검색"
          subtitle="상담 중 비슷한 제작 사례를 바로 찾습니다."
          meta={<Badge variant="secondary" className="rounded-full px-2.5 text-xs">{resultLabel}</Badge>}
          actions={(
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 rounded-lg px-2 text-xs"
                onClick={() => navigate('/portfolio')}
              >
                전체보기
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1 rounded-lg px-2 text-xs"
                onClick={() => navigate('/portfolio')}
              >
                <Plus className="h-3.5 w-3.5" />
                등록
              </Button>
            </div>
          )}
        />
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3 pt-0">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') navigate(buildPortfolioUrl(searchText, categoryKey));
            }}
            placeholder="키워드, 소재, 색상, 가공, 공간 검색"
            className="h-10 rounded-xl pl-9 text-sm"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PORTFOLIO_CATEGORY_FILTERS.map(filter => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setCategoryKey(filter.key)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors',
                categoryKey === filter.key
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border bg-background text-muted-foreground hover:border-foreground/40 hover:text-foreground',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {isSearching && isLoading ? (
          <div className="flex min-h-[250px] flex-1 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            포트폴리오를 불러오는 중입니다.
          </div>
        ) : isSearching && items.length === 0 ? (
          <div className="flex min-h-[250px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/35" />
            검색 결과가 없습니다. 포트폴리오에서 새 사례를 등록해주세요.
          </div>
        ) : !isSearching && recentPosts.length === 0 ? (
          <div className="flex min-h-[250px] flex-1 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-sm text-muted-foreground">
            <ImageIcon className="mb-2 h-8 w-8 text-muted-foreground/35" />
            최근 조회한 포트폴리오가 없습니다.
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3 h-8 rounded-lg px-3 text-xs"
              onClick={() => navigate('/portfolio')}
            >
              포트폴리오 보기
            </Button>
          </div>
        ) : !isSearching ? (
          <div className="grid flex-1 grid-cols-2 gap-2">
            {recentPosts.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(`/portfolio?q=${encodeURIComponent(item.title)}`)}
                className="group overflow-hidden rounded-xl border bg-background text-left transition-colors hover:border-foreground/30 hover:bg-muted/20"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted/40">
                  {item.thumbnailUrl ? (
                    <img
                      src={item.thumbnailUrl}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/45">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2.5">
                  <div className="truncate text-xs font-semibold text-foreground">{item.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">최근 조회</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className={cn('grid flex-1 grid-cols-2 gap-2', isFetching && 'opacity-70')}>
            {items.slice(0, DASHBOARD_PORTFOLIO_LIMIT).map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(buildPortfolioUrl(normalizedSearchText || item.title, categoryKey))}
                className="group overflow-hidden rounded-xl border bg-background text-left transition-colors hover:border-foreground/30 hover:bg-muted/20"
              >
                <div className="aspect-[4/3] overflow-hidden bg-muted/40">
                  {item.thumbnail_url ? (
                    <img
                      src={item.thumbnail_url}
                      alt={item.title}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground/45">
                      <ImageIcon className="h-7 w-7" />
                    </div>
                  )}
                </div>
                <div className="space-y-1 p-2.5">
                  <div className="truncate text-xs font-semibold text-foreground">{item.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {[item.category, item.client_name, item.materials?.[0], item.processes?.[0]].filter(Boolean).join(' · ') || '포트폴리오'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
