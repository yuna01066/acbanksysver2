import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, Calendar, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Building2, User, FileText, Trash2, Filter, Copy, FolderOpen, Loader2, PlusCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ProjectStageSelect, { PROJECT_STAGES } from '@/components/ProjectStageSelect';
import { getPaymentStatusInfo } from '@/components/project/PaymentStatusSelect';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';
import { formatQuoteProjectTitle } from '@/utils/quoteNaming';
import { convertQuoteToProject } from '@/services/quoteProjectConversion';
import { isQuoteExpired, isReissueProtectedProjectStage, normalizeProjectStage, projectStageToLegacyQuoteStatus } from '@/utils/quoteWorkflow';
import { reissueSavedQuote } from '@/services/quoteReissue';
import { duplicateSavedQuote } from '@/services/quoteDuplicate';
import { logQuoteActivity } from '@/services/quoteActivity';

interface LinkedProject {
  id: string;
  name: string;
  status: string;
  payment_status: string | null;
}

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  quote_date_display?: string | null;
  project_name: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_id?: string | null;
  recipient_address: string | null;
  recipient_memo: string | null;
  items: unknown;
  subtotal: number;
  tax: number;
  total: number;
  user_id: string;
  valid_until: string | null;
  delivery_period: string | null;
  payment_condition: string | null;
  issuer_id?: string | null;
  issuer_name: string | null;
  issuer_phone: string | null;
  issuer_email: string | null;
  issuer_department?: string | null;
  issuer_position?: string | null;
  attachments: unknown;
  calculation_snapshot?: unknown;
  pricing_version_id?: string | null;
  desired_delivery_date?: string | null;
  quote_status?: string | null;
  assigned_to?: string | null;
  assigned_to_name?: string | null;
  project_stage?: string;
  project_id?: string | null;
  project_followup_status?: string | null;
  project_followup_note?: string | null;
  project_followup_updated_at?: string | null;
  project_followup_updated_by?: string | null;
  linked_project?: LinkedProject | null;
  creator_name?: string | null;
  auto_cancelled_at?: string | null;
  auto_cancel_reason?: string | null;
  reissued_from_quote_id?: string | null;
  reissued_quote_id?: string | null;
  reissued_at?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'number-desc' | 'number-asc';

const SavedQuotesPage = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin } = useAuth();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<SavedQuote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [creatingProjectQuoteId, setCreatingProjectQuoteId] = useState<string | null>(null);
  const [reissuingQuoteId, setReissuingQuoteId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 50;

  const getQuoteTitle = (quote: SavedQuote): string => {
    const projectName = quote.project_name?.trim();
    if (projectName) {
      return formatQuoteProjectTitle({
        projectName,
        companyName: quote.recipient_company,
      });
    }

    const companyName = quote.recipient_company?.trim();
    if (companyName) return formatQuoteProjectTitle({ projectName: '견적', companyName });

    return `견적서 ${quote.quote_number}`;
  };

  const formatCompactDate = (date: string): string => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '-';

    const year = String(parsed.getFullYear()).slice(-2);
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchQuotes();
  }, [currentPage, user, isAdmin, userFilter]);

  useEffect(() => {
    filterQuotes();
  }, [searchTerm, dateFilter, quotes, sortBy, stageFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, stageFilter, userFilter]);

  const activeFilterCount = [
    searchTerm.trim() ? 'search' : null,
    dateFilter ? 'date' : null,
    stageFilter !== 'all' ? 'stage' : null,
    isAdmin && userFilter !== 'all' ? 'user' : null,
  ].filter(Boolean).length;

  const listSummary = useMemo(() => {
    const totalAmount = filteredQuotes.reduce((sum, quote) => sum + Number(quote.total || 0), 0);
    const linkedProjectCount = filteredQuotes.filter(quote => quote.linked_project).length;
    const recipientCount = new Set(
      filteredQuotes
        .map(quote => quote.recipient_company || quote.recipient_name)
        .filter(Boolean)
    ).size;

    return { totalAmount, linkedProjectCount, recipientCount };
  }, [filteredQuotes]);

  const resetFilters = () => {
    setSearchTerm('');
    setDateFilter('');
    setStageFilter('all');
    if (isAdmin) setUserFilter('all');
  };

  const canReissueQuote = (quote: SavedQuote) => {
    return isQuoteExpired(quote.valid_until)
      && !quote.reissued_quote_id
      && !quote.project_id
      && !isReissueProtectedProjectStage(quote.project_stage, quote.quote_status);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profile_directory' as any)
        .select('id, full_name')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(((data || []) as unknown) as UserProfile[]);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchQuotes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      if (isAdmin) {
        let countQuery = supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true });

        let dataQuery = supabase
          .from('saved_quotes')
          .select('*')
          .order('quote_date', { ascending: false })
          .range(from, to);

        if (userFilter !== 'all') {
          countQuery = countQuery.eq('assigned_to', userFilter);
          dataQuery = dataQuery.eq('assigned_to', userFilter);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        setTotalCount(count || 0);

        const { data, error } = await dataQuery;
        if (error) throw error;

        const formattedData = (data || []).map((q: any) => ({
          ...q,
          items: Array.isArray(q.items) ? q.items : []
        }));
        
        const projectIds = formattedData.filter(q => q.project_id).map(q => q.project_id);
        let projectMap: Record<string, LinkedProject> = {};
        if (projectIds.length > 0) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name, status, payment_status')
            .in('id', projectIds);
          if (projects) {
            projectMap = Object.fromEntries(projects.map(p => [p.id, p]));
          }
        }
        
        // Fetch creator names from profiles
        const creatorIds = [...new Set(formattedData.map(q => q.user_id))];
        let creatorMap: Record<string, string> = {};
        if (creatorIds.length > 0) {
          const { data: profiles } = await (supabase.from('profile_directory' as any) as any)
            .select('id, full_name')
            .in('id', creatorIds);
          if (profiles) {
            creatorMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
          }
        }
        
        const finalQuotes = formattedData.map(q => ({
          ...q,
          linked_project: q.project_id ? projectMap[q.project_id] || null : null,
          creator_name: creatorMap[q.user_id] || null,
          project_stage: normalizeProjectStage(q.project_stage, q.quote_status),
          assigned_to_name: q.assigned_to_name || q.issuer_name || creatorMap[q.user_id] || null,
        }));
        
        setQuotes(finalQuotes);
      } else {
        // Non-admin: show quotes where user is owner OR issuer
        const { count, error: countError } = await supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${user.id},issuer_id.eq.${user.id},assigned_to.eq.${user.id}`);

        if (countError) throw countError;
        setTotalCount(count || 0);

        const { data, error } = await supabase
          .from('saved_quotes')
          .select('*')
          .or(`user_id.eq.${user.id},issuer_id.eq.${user.id},assigned_to.eq.${user.id}`)
          .order('quote_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map((q: any) => ({
          ...q,
          items: Array.isArray(q.items) ? q.items : []
        }));
        
        const projectIds = formattedData.filter(q => q.project_id).map(q => q.project_id);
        let projectMap2: Record<string, LinkedProject> = {};
        if (projectIds.length > 0) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name, status, payment_status')
            .in('id', projectIds);
          if (projects) {
            projectMap2 = Object.fromEntries(projects.map(p => [p.id, p]));
          }
        }
        
        // Fetch creator names
        const creatorIds2 = [...new Set(formattedData.map(q => q.user_id))];
        let creatorMap2: Record<string, string> = {};
        if (creatorIds2.length > 0) {
          const { data: profiles } = await (supabase.from('profile_directory' as any) as any)
            .select('id, full_name')
            .in('id', creatorIds2);
          if (profiles) {
            creatorMap2 = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
          }
        }
        
        const finalQuotes2 = formattedData.map(q => ({
          ...q,
          linked_project: q.project_id ? projectMap2[q.project_id] || null : null,
          creator_name: creatorMap2[q.user_id] || null,
          project_stage: normalizeProjectStage(q.project_stage, q.quote_status),
          assigned_to_name: q.assigned_to_name || q.issuer_name || creatorMap2[q.user_id] || null,
        }));
        
        setQuotes(finalQuotes2);
      }
    } catch (error) {
      console.error('Error fetching quotes:', error);
      toast.error('견적서를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filterQuotes = () => {
    let filtered = [...quotes];

    if (searchTerm) {
      filtered = filtered.filter(quote => 
        quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.recipient_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.recipient_company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.project_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.issuer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        quote.creator_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(quote => 
        quote.quote_date.startsWith(dateFilter)
      );
    }

    if (stageFilter !== 'all') {
      filtered = filtered.filter(quote => normalizeProjectStage(quote.project_stage, quote.quote_status) === stageFilter);
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.quote_date).getTime() - new Date(a.quote_date).getTime();
        case 'date-asc':
          return new Date(a.quote_date).getTime() - new Date(b.quote_date).getTime();
        case 'amount-desc':
          return b.total - a.total;
        case 'amount-asc':
          return a.total - b.total;
        case 'number-desc':
          return b.quote_number.localeCompare(a.quote_number);
        case 'number-asc':
          return a.quote_number.localeCompare(b.quote_number);
        default:
          return 0;
      }
    });

    setFilteredQuotes(filtered);
  };

  const handleDeleteQuote = async (quoteId: string) => {
    if (!confirm('이 견적서를 삭제하시겠습니까?')) return;

    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .delete()
        .eq('id', quoteId)
        .eq('user_id', user.id)
        .select();

      if (error) throw error;
      
      if (!data || data.length === 0) {
        toast.error('견적서를 삭제할 권한이 없습니다.');
        return;
      }
      
      toast.success('견적서가 삭제되었습니다.');
      fetchQuotes();
    } catch (error) {
      console.error('Error deleting quote:', error);
      toast.error('견적서 삭제에 실패했습니다.');
    }
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      await duplicateSavedQuote({
        quoteId,
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
        actorEmail: user.email,
      });
      toast.success('견적서가 복제되었습니다.');
      fetchQuotes();
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error('견적서 복제에 실패했습니다.');
    }
  };

  const handleCreateProjectFromQuote = async (quote: SavedQuote) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (quote.project_id) {
      navigate(`/project-management?id=${quote.project_id}`);
      return;
    }

    setCreatingProjectQuoteId(quote.id);

    try {
      const project = await convertQuoteToProject({
        quote: {
          ...quote,
          project_stage: normalizeProjectStage(quote.project_stage, quote.quote_status),
        },
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
      });

      setQuotes((prev) => prev.map((item) => (
        item.id === quote.id
          ? {
              ...item,
              project_id: project.id,
              project_followup_status: 'converted',
              project_followup_note: null,
              project_followup_updated_at: new Date().toISOString(),
              project_followup_updated_by: user.id,
              project_stage: 'contracted',
              quote_status: projectStageToLegacyQuoteStatus('contracted'),
              linked_project: project as LinkedProject,
            }
          : item
      )));

      if (project.approvalRequestError) {
        toast.warning(`프로젝트 생성 완료, 품의 생성 실패: ${project.approvalRequestError}`);
      } else {
        toast.success('견적서 기준 프로젝트와 개시 품의가 생성되었습니다.');
      }
      navigate(`/project-management?id=${project.id}`);
    } catch (error) {
      console.error('Error creating project from quote:', error);
      toast.error('프로젝트 생성에 실패했습니다.');
    } finally {
      setCreatingProjectQuoteId(null);
    }
  };

  const handleMarkProjectNotRequired = async (quote: SavedQuote) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    const note = window.prompt('프로젝트 전환 제외 사유를 입력해주세요.', quote.project_followup_note || '');
    const trimmedNote = note?.trim();
    if (!trimmedNote) return;
    if (trimmedNote.length < 2) {
      toast.error('제외 사유를 입력해주세요.');
      return;
    }

    const nowIso = new Date().toISOString();
    const { error } = await (supabase as any)
      .from('saved_quotes')
      .update({
        project_followup_status: 'not_required',
        project_followup_note: trimmedNote,
        project_followup_updated_at: nowIso,
        project_followup_updated_by: user.id,
      })
      .eq('id', quote.id);

    if (error) {
      toast.error('프로젝트 전환 불필요 처리에 실패했습니다.');
      return;
    }

    await logQuoteActivity({
      quoteId: quote.id,
      actionType: 'project_followup_not_required',
      actorId: user.id,
      actorName: profile?.full_name || user.email || '알 수 없음',
      oldValue: quote.project_followup_status || (quote.project_id ? 'converted' : 'pending'),
      newValue: 'not_required',
      memo: trimmedNote,
    });

    setQuotes((prev) => prev.map((item) => (
      item.id === quote.id
        ? {
            ...item,
            project_followup_status: 'not_required',
            project_followup_note: trimmedNote,
            project_followup_updated_at: nowIso,
            project_followup_updated_by: user.id,
          }
        : item
    )));
    toast.success('프로젝트 전환 불필요로 처리했습니다.');
  };

  const handleReissueQuote = async (quote: SavedQuote) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setReissuingQuoteId(quote.id);
    try {
      const newQuote = await reissueSavedQuote({
        quoteId: quote.id,
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
      });

      toast.success(`견적서가 ${newQuote.quote_number}번으로 재발행되었습니다.`);
      fetchQuotes();
      navigate(`/saved-quotes/${newQuote.id}`);
    } catch (error) {
      console.error('Error reissuing quote:', error);
      toast.error(error instanceof Error ? error.message : '견적서 재발행에 실패했습니다.');
    } finally {
      setReissuingQuoteId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <PageShell maxWidth="full" contentClassName="max-w-none">
      <PageHeader
        eyebrow="Issued Quotes"
        title="발행 견적서"
        description="견적 상태, 연결 프로젝트, 거래처 정보를 한 화면에서 확인합니다."
        icon={<FileText className="h-5 w-5" />}
        actions={(
          <>
            <Button onClick={() => navigate('/calculator?type=quote')} size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              견적서 작성
            </Button>
            <Button onClick={() => navigate('/space-quotes')} variant="outline" size="sm" className="gap-2">
              공간디자인 견적서
            </Button>
          </>
        )}
      />

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="glass-surface rounded-2xl border border-border/60 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">표시 견적</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{filteredQuotes.length.toLocaleString()}건</div>
          </div>
          <div className="glass-surface rounded-2xl border border-border/60 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">표시 합계</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">{formatPrice(listSummary.totalAmount)}</div>
          </div>
          <div className="glass-surface rounded-2xl border border-border/60 px-4 py-3">
            <div className="text-xs font-medium text-muted-foreground">프로젝트 연결</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {listSummary.linkedProjectCount.toLocaleString()}건
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                거래처 {listSummary.recipientCount.toLocaleString()}곳
              </span>
            </div>
          </div>
        </div>

        <SearchFilterBar>
          <div className={`grid grid-cols-1 gap-3 md:grid-cols-2 ${
            isAdmin
              ? 'lg:grid-cols-[minmax(0,1.5fr)_180px_190px_190px_auto]'
              : 'lg:grid-cols-[minmax(0,1.5fr)_180px_190px_auto]'
          }`}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="견적 제목, 견적번호, 업체명, 담당자 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-10 pl-10"
              />
            </div>
            {isAdmin && (
              <Select value={userFilter} onValueChange={setUserFilter}>
                <SelectTrigger>
                  <div className="flex min-w-0 items-center gap-2">
                    <Filter className="h-4 w-4 shrink-0" />
                    <SelectValue placeholder="담당자 선택" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 담당자</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name || user.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">최신 날짜순</SelectItem>
                <SelectItem value="date-asc">오래된 날짜순</SelectItem>
                <SelectItem value="amount-desc">금액 높은순</SelectItem>
                <SelectItem value="amount-asc">금액 낮은순</SelectItem>
                <SelectItem value="number-desc">견적번호 내림차순</SelectItem>
                <SelectItem value="number-asc">견적번호 오름차순</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              disabled={activeFilterCount === 0}
              className="h-10 whitespace-nowrap"
            >
              필터 초기화
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">상태/단계</span>
            <Badge
              variant={stageFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer rounded-full px-2.5 text-xs"
              onClick={() => setStageFilter('all')}
            >
              전체
            </Badge>
            {PROJECT_STAGES.map((stage) => (
              <Badge
                key={stage.value}
                variant="outline"
                className={`cursor-pointer rounded-full px-2.5 text-xs ${stageFilter === stage.value ? stage.color + ' border-current' : ''}`}
                onClick={() => setStageFilter(stage.value)}
              >
                {stage.label}
              </Badge>
            ))}
            {isAdmin && (
              <span className="ml-auto text-xs text-muted-foreground">
                {userFilter === 'all'
                  ? '관리자: 전체 담당자 조회'
                  : `담당자: ${users.find(u => u.id === userFilter)?.full_name || '선택된 사용자'}`}
              </span>
            )}
          </div>
        </SearchFilterBar>

        {filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-12 text-center">
              <FileText className="mb-3 h-9 w-9 text-muted-foreground/35" />
              <p className="mb-4 text-sm text-muted-foreground">
                {quotes.length === 0 ? '저장된 견적서가 없습니다.' : '검색 결과가 없습니다.'}
              </p>
              <Button onClick={() => navigate('/calculator?type=quote')} variant="outline">
                견적서 작성하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden border-border/70">
              <div className="hidden border-b bg-muted/35 px-4 py-3 text-xs font-semibold text-muted-foreground lg:grid lg:grid-cols-[88px_minmax(0,1.5fr)_minmax(180px,0.6fr)_112px_132px_136px] lg:items-center lg:gap-4">
                <span>발행일</span>
                <span>견적 제목</span>
                <span>거래처</span>
                <span>담당자</span>
                <span className="text-right">금액</span>
                <span className="text-right">상태/단계</span>
              </div>

              <div className="divide-y divide-border/70">
                {filteredQuotes.map((quote) => {
                  const paymentInfo = quote.linked_project?.payment_status
                    ? getPaymentStatusInfo(quote.linked_project.payment_status)
                    : null;
                  const quoteTitle = getQuoteTitle(quote);
                  const expired = isQuoteExpired(quote.valid_until);
                  const reissueCandidate = canReissueQuote(quote);

                  return (
                    <div
                      key={quote.id}
                      className="cursor-pointer px-4 py-4 transition-colors hover:bg-muted/35"
                      onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                    >
                      <div className="grid gap-3 lg:grid-cols-[88px_minmax(0,1.5fr)_minmax(180px,0.6fr)_112px_132px_136px] lg:items-center lg:gap-4">
                        <div className="whitespace-nowrap text-sm font-semibold tabular-nums text-foreground">
                          {formatCompactDate(quote.quote_date)}
                        </div>

                        <div className="min-w-0">
                          <div
                            className="truncate text-[15px] font-semibold leading-5 text-foreground"
                            title={quoteTitle}
                          >
                            {quoteTitle}
                          </div>
                        </div>

                        <div className="min-w-0">
                          {quote.recipient_company ? (
                            <button
                              type="button"
                              className="flex max-w-full items-center gap-1.5 text-left text-sm font-medium text-primary hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (quote.recipient_id) {
                                  navigate(`/recipients?id=${encodeURIComponent(quote.recipient_id)}`);
                                } else {
                                  navigate(`/recipients?company=${encodeURIComponent(quote.recipient_company!)}`);
                                }
                              }}
                            >
                              <Building2 className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{quote.recipient_company}</span>
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">거래처 없음</span>
                          )}
                        </div>

                        <div className="flex min-w-0 items-center gap-1.5 text-sm">
                          <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate font-medium">
                            {quote.assigned_to_name || quote.issuer_name || quote.creator_name || '미지정'}
                          </span>
                        </div>

                        <div className="whitespace-nowrap text-left text-base font-semibold tabular-nums text-foreground lg:text-right">
                          {formatPrice(quote.total)}
                        </div>

                        <div className="flex justify-start lg:justify-end" onClick={(event) => event.stopPropagation()}>
                          <ProjectStageSelect
                            quoteId={quote.id}
                            currentStage={quote.project_stage || 'quote_issued'}
                            quoteNumber={quote.quote_number}
                            quoteUserId={quote.user_id}
                            onStageChanged={(newStage) => {
                              setQuotes(prev => prev.map(q => q.id === quote.id
                                ? { ...q, project_stage: newStage, quote_status: projectStageToLegacyQuoteStatus(newStage) }
                                : q));
                            }}
                          />
                        </div>
                      </div>

                      <div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground lg:ml-[104px] lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5">
                          <span className="rounded-full bg-muted/70 px-2 py-0.5 font-medium tabular-nums text-muted-foreground">
                            No. {quote.quote_number}
                          </span>
                          {quote.issuer_name && <span>발신 {quote.issuer_name}</span>}
                          {quote.creator_name && <span>작성 {quote.creator_name}</span>}
                          {quote.recipient_name && (
                            <span className="inline-flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5" />
                              {quote.recipient_name}
                            </span>
                          )}
                          {expired && (
                            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] text-amber-700">
                              유효기간 만료
                            </Badge>
                          )}
                          {quote.reissued_quote_id && (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                              재발행됨
                            </Badge>
                          )}
                          {quote.reissued_from_quote_id && (
                            <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] text-blue-700">
                              재발행본
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
                          {quote.linked_project ? (
                            <button
                              type="button"
                              className="flex h-7 max-w-[280px] items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-primary/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/project-management?id=${quote.linked_project!.id}`);
                              }}
                            >
                              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                              <span className="truncate">{quote.linked_project.name}</span>
                            </button>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              미연결
                            </Badge>
                          )}
                          {!quote.linked_project && quote.project_followup_status === 'not_required' && (
                            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-[10px] text-slate-600">
                              프로젝트 전환 불필요
                            </Badge>
                          )}
                          {paymentInfo && (
                            <Badge className={`text-[10px] ${paymentInfo.color}`}>
                              {paymentInfo.label}
                            </Badge>
                          )}
                          {!quote.linked_project && quote.project_stage !== 'cancelled' && quote.project_followup_status !== 'not_required' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs"
                              disabled={creatingProjectQuoteId === quote.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleCreateProjectFromQuote(quote);
                              }}
                            >
                              {creatingProjectQuoteId === quote.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PlusCircle className="h-3.5 w-3.5" />
                              )}
                              프로젝트 생성
                            </Button>
                          )}
                          {!quote.linked_project && quote.project_stage !== 'cancelled' && quote.project_followup_status !== 'not_required' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs text-muted-foreground"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleMarkProjectNotRequired(quote);
                              }}
                            >
                              전환 불필요
                            </Button>
                          )}
                          {reissueCandidate && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2 text-xs text-blue-700"
                              disabled={reissuingQuoteId === quote.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                handleReissueQuote(quote);
                              }}
                            >
                              {reissuingQuoteId === quote.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RotateCcw className="h-3.5 w-3.5" />
                              )}
                              견적 재발행
                            </Button>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              title="상세보기"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/saved-quotes/${quote.id}`);
                              }}
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              title="견적서 복제"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDuplicateQuote(quote.id);
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              title="견적서 삭제"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteQuote(quote.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {!searchTerm && !dateFilter && totalCount > ITEMS_PER_PAGE && (
              <Card className="mt-4">
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    총 {totalCount}개 중 {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-
                    {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}개 표시
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="mr-1 h-4 w-4" />
                      이전
                    </Button>
                    <div className="px-3 text-sm font-medium">
                      {currentPage} / {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), p + 1))}
                      disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                    >
                      다음
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

export default SavedQuotesPage;
