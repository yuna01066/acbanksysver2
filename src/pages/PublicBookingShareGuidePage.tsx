import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarCheck2, Check, ClipboardCopy, ExternalLink, Link2, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { usePublicBookingLinks } from '@/hooks/usePublicMeetingBookings';
import type { PublicBookingLinkRow, PublicBookingLinkType } from '@/types/publicBooking';

const LINK_TYPE_LABELS: Record<PublicBookingLinkType, string> = {
  customer_request: '고객 미팅 요청',
  partner_room: '공유회사 회의실',
  consultation_booking: '상담 예약',
};

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function buildPublicUrl(slug: string) {
  return `${window.location.origin}/public-booking/${slug}`;
}

function buildShareMessage(link: PublicBookingLinkRow) {
  const url = buildPublicUrl(link.slug);
  const weekdays = (link.allowed_weekdays || []).map((d) => WEEKDAY_LABELS[d]).join('·');
  const lines = [
    `[${link.title}]`,
    link.description ? link.description : null,
    '',
    `예약 링크: ${url}`,
    `예약 가능 요일: ${weekdays || '별도 안내'}`,
    `예약 가능 시간: ${link.start_time.slice(0, 5)} ~ ${link.end_time.slice(0, 5)} (${link.duration_minutes}분 단위)`,
    link.access_code_hash ? '접속 코드: 담당자에게 별도로 문의해주세요.' : null,
    link.requires_approval
      ? '※ 예약 요청 후 담당자 확인이 완료되면 확정 안내를 드립니다.'
      : '※ 예약 즉시 확정되며, 변경이 필요하면 담당자에게 알려주세요.',
  ];
  return lines.filter((line) => line !== null).join('\n');
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label}을(를) 복사했습니다.`);
  } catch {
    toast.error('복사에 실패했습니다. 직접 선택해 복사해주세요.');
  }
}

const LinkShareCard = ({ link }: { link: PublicBookingLinkRow }) => {
  const url = buildPublicUrl(link.slug);
  const [message, setMessage] = useState(() => buildShareMessage(link));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <CardTitle className="text-base">{link.title}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary">{LINK_TYPE_LABELS[link.link_type] || link.link_type}</Badge>
              <Badge variant={link.is_active ? 'default' : 'outline'}>
                {link.is_active ? '활성' : '비활성'}
              </Badge>
              {link.requires_approval ? <Badge variant="outline">승인 필요</Badge> : null}
              {link.access_code_hash ? <Badge variant="outline">접속 코드</Badge> : null}
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              링크 열기
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">공개 링크 주소</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
            <Button type="button" onClick={() => copyText(url, '링크')} className="shrink-0">
              <ClipboardCopy className="mr-1.5 h-4 w-4" />
              링크 복사
            </Button>
          </div>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">사내 공유용 안내 문구 (수정 후 복사 가능)</p>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={9}
            className="text-xs leading-relaxed"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => copyText(message, '안내 문구')}>
              <ClipboardCopy className="mr-1.5 h-3.5 w-3.5" />
              안내 문구 복사
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setMessage(buildShareMessage(link))}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              기본 문구로 되돌리기
            </Button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          예약 가능: {(link.allowed_weekdays || []).map((d) => WEEKDAY_LABELS[d]).join('·') || '미설정'} ·{' '}
          {link.start_time.slice(0, 5)}~{link.end_time.slice(0, 5)} · 1회 {link.duration_minutes}분 · 최대{' '}
          {link.max_days_ahead}일 이후까지
        </p>
      </CardContent>
    </Card>
  );
};

const PublicBookingShareGuidePage = () => {
  const navigate = useNavigate();
  const { isAdmin, isModerator } = useAuth();
  const canManage = isAdmin || isModerator;
  const { data: links = [], isLoading, refetch, isRefetching } = usePublicBookingLinks(canManage);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'active' | 'all'>('active');

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return links.filter((link) => {
      if (filter === 'active' && !link.is_active) return false;
      if (!keyword) return true;
      return (
        link.title.toLowerCase().includes(keyword) ||
        link.slug.toLowerCase().includes(keyword) ||
        (link.description || '').toLowerCase().includes(keyword)
      );
    });
  }, [links, search, filter]);

  if (!canManage) {
    return (
      <PageShell maxWidth="5xl">
        <Alert>
          <AlertDescription>공개 예약 링크 안내는 관리자와 매니저만 확인할 수 있습니다.</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="공개 예약"
        title="공개 링크 공유 안내"
        description="예약 링크와 사내 공유용 안내 문구를 복사해 메신저·메일로 바로 전달할 수 있습니다."
        icon={<Link2 className="h-5 w-5" />}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              뒤로
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              {isRefetching ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              새로고침
            </Button>
            <Button size="sm" onClick={() => navigate('/public-booking-approvals')}>
              <CalendarCheck2 className="mr-1.5 h-4 w-4" />
              예약 승인 관리
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-semibold">공유 전 확인 사항</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              링크가 <span className="font-medium text-foreground">활성</span> 상태인지 확인 후 공유합니다.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              접속 코드가 설정된 링크는 코드를 링크와 같은 메시지에 함께 쓰지 말고 별도로 전달합니다.
            </li>
            <li className="flex gap-2">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
              승인 필요 링크는 요청 접수 후 <span className="font-medium text-foreground">예약 승인 관리</span>에서 확정 처리합니다.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="링크 제목 또는 주소 검색"
            className="pl-8"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'active' | 'all')}>
          <TabsList>
            <TabsTrigger value="active">활성 링크</TabsTrigger>
            <TabsTrigger value="all">전체</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          링크를 불러오는 중입니다.
        </p>
      ) : filtered.length === 0 ? (
        <Alert>
          <AlertDescription>
            공유할 수 있는 공개 예약 링크가 없습니다. 회의실 예약 관리에서 링크를 먼저 생성해주세요.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filtered.map((link) => (
            <LinkShareCard key={link.id} link={link} />
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default PublicBookingShareGuidePage;
