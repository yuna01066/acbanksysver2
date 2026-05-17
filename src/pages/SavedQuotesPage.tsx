import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Home, Search, Calendar, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Building2, User, FileText, Trash2, Filter, Copy, FolderOpen, Loader2, PlusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ProjectStageSelect, { PROJECT_STAGES } from '@/components/ProjectStageSelect';
import { getPaymentStatusInfo } from '@/components/project/PaymentStatusSelect';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';

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
  project_name: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
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
  issuer_name: string | null;
  issuer_phone: string | null;
  issuer_email: string | null;
  attachments: unknown;
  desired_delivery_date?: string | null;
  project_stage?: string;
  project_id?: string | null;
  linked_project?: LinkedProject | null;
  creator_name?: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'number-desc' | 'number-asc';

const SavedQuotesPage = () => {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
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
  const ITEMS_PER_PAGE = 50;

  // valid_until 문자열에서 마지막 날짜를 파싱하는 함수
  const parseValidUntilDate = (validUntil: string | null): Date | null => {
    if (!validUntil || validUntil.trim() === '') return null;
    
    // "2026. 2. 11. ~ 2026. 2. 25." 형식 → 마지막 날짜 추출
    if (validUntil.includes('~')) {
      const parts = validUntil.split('~');
      const endPart = parts[parts.length - 1].trim();
      const nums = endPart.match(/\d+/g);
      if (nums && nums.length >= 3) {
        return new Date(parseInt(nums[0]), parseInt(nums[1]) - 1, parseInt(nums[2]));
      }
    }
    
    // "2026년 02월 16일" 형식
    const korMatch = validUntil.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (korMatch) {
      return new Date(parseInt(korMatch[1]), parseInt(korMatch[2]) - 1, parseInt(korMatch[3]));
    }
    
    // "2026. 2. 25." 형식 (단일)
    const dotMatch = validUntil.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/);
    if (dotMatch) {
      return new Date(parseInt(dotMatch[1]), parseInt(dotMatch[2]) - 1, parseInt(dotMatch[3]));
    }
    
    return null;
  };

  // 만료된 견적서 자동 상태 변경 + 만료 예정 알림
  const autoExpireQuotes = async (quotesData: SavedQuote[]): Promise<number> => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    
    const expiredIds = quotesData
      .filter(q => {
        if (q.project_stage !== 'quote_issued') return false;
        const expDate = parseValidUntilDate(q.valid_until);
        if (!expDate) return false;
        return expDate < today;
      })
      .map(q => q.id);

    // 만료 예정 견적서 알림 (3일 이내)
    const soonExpiring = quotesData.filter(q => {
      if (q.project_stage !== 'quote_issued') return false;
      const expDate = parseValidUntilDate(q.valid_until);
      if (!expDate) return false;
      return expDate >= today && expDate <= threeDaysLater;
    });

    if (soonExpiring.length > 0 && user) {
      // Check if we already sent notification today
      const todayStr = today.toISOString().substring(0, 10);
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'quote_expiring')
        .gte('created_at', todayStr)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from('notifications').insert({
          user_id: user.id,
          type: 'quote_expiring',
          title: '견적서 만료 예정',
          description: `${soonExpiring.length}건의 견적서가 3일 이내 만료 예정입니다.`,
          data: { quote_ids: soonExpiring.map(q => q.id), count: soonExpiring.length },
        });
      }
    }
    
    if (expiredIds.length === 0) return 0;

    try {
      const { error } = await supabase
        .from('saved_quotes')
        .update({ project_stage: 'cancelled' })
        .in('id', expiredIds);
      
      if (error) throw error;
      
      toast.info(`유효기간이 만료된 견적서 ${expiredIds.length}건이 취소 처리되었습니다.`);
      return expiredIds.length;
    } catch (error) {
      console.error('Error auto-expiring quotes:', error);
      return 0;
    }
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
  }, [searchTerm, dateFilter, userFilter]);

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

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .order('full_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
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
          countQuery = countQuery.eq('user_id', userFilter);
          dataQuery = dataQuery.eq('user_id', userFilter);
        }

        const { count, error: countError } = await countQuery;
        if (countError) throw countError;
        setTotalCount(count || 0);

        const { data, error } = await dataQuery;
        if (error) throw error;

        const formattedData = (data || []).map(q => ({
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
          const { data: profiles } = await supabase
            .from('profiles')
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
        }));
        
        // 만료된 견적서 자동 상태 변경 후 다시 로드
        const expiredCount = await autoExpireQuotes(finalQuotes);
        if (expiredCount) {
          // 상태 변경이 있었으면 다시 fetch하지 않고 로컬에서 업데이트
          setQuotes(finalQuotes.map(q => 
            q.project_stage === 'quote_issued' && parseValidUntilDate(q.valid_until) && parseValidUntilDate(q.valid_until)! < new Date(new Date().setHours(0,0,0,0))
              ? { ...q, project_stage: 'cancelled' }
              : q
          ));
        } else {
          setQuotes(finalQuotes);
        }
      } else {
        // Non-admin: show quotes where user is owner OR issuer
        const { count, error: countError } = await supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true })
          .or(`user_id.eq.${user.id},issuer_id.eq.${user.id}`);

        if (countError) throw countError;
        setTotalCount(count || 0);

        const { data, error } = await supabase
          .from('saved_quotes')
          .select('*')
          .or(`user_id.eq.${user.id},issuer_id.eq.${user.id}`)
          .order('quote_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map(q => ({
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
          const { data: profiles } = await supabase
            .from('profiles')
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
        }));
        
        const expiredCount2 = await autoExpireQuotes(finalQuotes2);
        if (expiredCount2) {
          setQuotes(finalQuotes2.map(q => 
            q.project_stage === 'quote_issued' && parseValidUntilDate(q.valid_until) && parseValidUntilDate(q.valid_until)! < new Date(new Date().setHours(0,0,0,0))
              ? { ...q, project_stage: 'cancelled' }
              : q
          ));
        } else {
          setQuotes(finalQuotes2);
        }
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
      filtered = filtered.filter(quote => quote.project_stage === stageFilter);
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

  const generateNewQuoteNumber = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const sequence = String(Math.floor(Math.random() * 100) + 1).padStart(2, '0');
    return `${month}${day}${hour}${minute}${sequence}`;
  };

  const handleDuplicateQuote = async (quoteId: string) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    try {
      const { data: originalQuote, error: fetchError } = await supabase
        .from('saved_quotes')
        .select('*')
        .eq('id', quoteId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!originalQuote) {
        toast.error('원본 견적서를 찾을 수 없습니다.');
        return;
      }

      const newQuoteNumber = generateNewQuoteNumber();

      const originalAttachments = Array.isArray(originalQuote.attachments)
        ? (originalQuote.attachments as Array<{ type?: string }>)
        : [];
      const filteredAttachments = originalAttachments.filter((attachment) => attachment?.type !== 'quote_pdf');
      
      const duplicateData = {
        quote_number: newQuoteNumber,
        quote_date: new Date().toISOString(),
        quote_date_display: originalQuote.quote_date_display,
        project_name: originalQuote.project_name ? `${originalQuote.project_name} (복사본)` : '(복사본)',
        recipient_name: originalQuote.recipient_name,
        recipient_company: originalQuote.recipient_company,
        recipient_phone: originalQuote.recipient_phone,
        recipient_email: originalQuote.recipient_email,
        recipient_address: originalQuote.recipient_address,
        recipient_memo: originalQuote.recipient_memo,
        items: originalQuote.items,
        subtotal: originalQuote.subtotal,
        tax: originalQuote.tax,
        total: originalQuote.total,
        user_id: user.id,
        valid_until: originalQuote.valid_until,
        delivery_period: originalQuote.delivery_period,
        payment_condition: originalQuote.payment_condition,
        issuer_id: originalQuote.issuer_id,
        issuer_name: originalQuote.issuer_name,
        issuer_email: originalQuote.issuer_email,
        issuer_phone: originalQuote.issuer_phone,
        issuer_department: originalQuote.issuer_department,
        issuer_position: originalQuote.issuer_position,
        custom_color_name: originalQuote.custom_color_name,
        custom_opacity: originalQuote.custom_opacity,
        attachments: filteredAttachments,
        desired_delivery_date: originalQuote.desired_delivery_date,
      };

      const { data: newQuote, error: insertError } = await supabase
        .from('saved_quotes')
        .insert(duplicateData)
        .select()
        .single();

      if (insertError) throw insertError;

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
      let recipientId: string | null = null;

      if (quote.recipient_company?.trim()) {
        const { data: recipient, error: recipientError } = await supabase
          .from('recipients')
          .select('id')
          .eq('company_name', quote.recipient_company.trim())
          .maybeSingle();

        if (recipientError) throw recipientError;
        recipientId = recipient?.id || null;
      }

      const projectName = quote.project_name?.trim()
        || [quote.recipient_company, quote.quote_number].filter(Boolean).join(' · ')
        || `견적 ${quote.quote_number}`;

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: `견적서 ${quote.quote_number}에서 생성된 프로젝트입니다.`,
          status: 'active',
          project_type: 'client',
          recipient_id: recipientId,
          contact_name: quote.recipient_name || null,
          contact_phone: quote.recipient_phone || null,
          contact_email: quote.recipient_email || null,
          specs: {
            sourceQuoteId: quote.id,
            sourceQuoteNumber: quote.quote_number,
            quoteTotal: quote.total,
            desiredDeliveryDate: quote.desired_delivery_date || null,
          },
          user_id: quote.user_id || user.id,
        } as any)
        .select('id, name, status, payment_status')
        .single();

      if (projectError) throw projectError;

      const { error: quoteError } = await supabase
        .from('saved_quotes')
        .update({ project_id: project.id })
        .eq('id', quote.id);

      if (quoteError) throw quoteError;

      await supabase
        .from('document_files' as any)
        .update({ project_id: project.id })
        .eq('quote_id', quote.id)
        .is('project_id', null);

      setQuotes((prev) => prev.map((item) => (
        item.id === quote.id
          ? { ...item, project_id: project.id, linked_project: project as LinkedProject }
          : item
      )));

      toast.success('견적서 기준 프로젝트가 생성되었습니다.');
      navigate(`/project-management?id=${project.id}`);
    } catch (error) {
      console.error('Error creating project from quote:', error);
      toast.error('프로젝트 생성에 실패했습니다.');
    } finally {
      setCreatingProjectQuoteId(null);
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
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Issued Quotes"
        title="발행 견적서"
        description="견적 상태, 연결 프로젝트, 거래처 정보를 한 화면에서 확인합니다."
        icon={<FileText className="h-5 w-5" />}
        actions={(
          <>
            <Button onClick={() => navigate('/calculator')} size="sm" className="gap-2">
              <PlusCircle className="h-4 w-4" />
              견적서 작성
            </Button>
            <Button onClick={() => navigate('/space-quotes')} variant="outline" size="sm" className="gap-2">
              공간디자인 견적서
            </Button>
            <Button onClick={() => navigate('/')} variant="outline" size="sm" className="gap-2">
              <Home className="h-4 w-4" />
              홈
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
                placeholder="견적번호, 프로젝트명, 업체명, 담당자 검색"
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
                      {user.full_name} ({user.email})
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
            <span className="text-sm text-muted-foreground">단계</span>
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
              <Button onClick={() => navigate('/calculator')} variant="outline">
                견적서 작성하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="overflow-hidden border-border/70">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[210px]">견적</TableHead>
                    <TableHead className="min-w-[220px]">거래처</TableHead>
                    <TableHead className="min-w-[220px]">프로젝트</TableHead>
                    <TableHead className="w-[150px]">단계</TableHead>
                    <TableHead className="w-[140px] text-right">금액</TableHead>
                    <TableHead className="w-[120px]">발행일</TableHead>
                    <TableHead className="w-[132px] text-right">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => {
                    const paymentInfo = quote.linked_project?.payment_status
                      ? getPaymentStatusInfo(quote.linked_project.payment_status)
                      : null;

                    return (
                      <TableRow
                        key={quote.id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                      >
                        <TableCell className="py-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="font-semibold tabular-nums">{quote.quote_number}</div>
                            {quote.project_name && (
                              <div className="max-w-[260px] truncate text-xs text-muted-foreground">
                                {quote.project_name}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                              {quote.issuer_name && <span>담당 {quote.issuer_name}</span>}
                              {quote.creator_name && <span>작성 {quote.creator_name}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            {quote.recipient_company ? (
                              <button
                                type="button"
                                className="flex max-w-[240px] items-center gap-1.5 truncate text-left text-sm font-medium text-primary hover:underline"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  navigate(`/recipients?company=${encodeURIComponent(quote.recipient_company!)}`);
                                }}
                              >
                                <Building2 className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{quote.recipient_company}</span>
                              </button>
                            ) : (
                              <span className="text-sm text-muted-foreground">거래처 없음</span>
                            )}
                            {quote.recipient_name && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                {quote.recipient_name}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          {quote.linked_project ? (
                            <button
                              type="button"
                              className="flex max-w-[240px] flex-col items-start gap-1 rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2 text-left transition-colors hover:bg-primary/10"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/project-management?id=${quote.linked_project!.id}`);
                              }}
                            >
                              <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
                                <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="truncate">{quote.linked_project.name}</span>
                              </span>
                              {paymentInfo && (
                                <Badge className={`text-[10px] ${paymentInfo.color}`}>
                                  {paymentInfo.label}
                                </Badge>
                              )}
                            </button>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                미연결
                              </Badge>
                              {quote.project_stage !== 'cancelled' && (
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
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="py-3">
                          <div onClick={(event) => event.stopPropagation()}>
                            <ProjectStageSelect
                              quoteId={quote.id}
                              currentStage={quote.project_stage || 'quote_issued'}
                              quoteNumber={quote.quote_number}
                              quoteUserId={quote.user_id}
                              onStageChanged={(newStage) => {
                                setQuotes(prev => prev.map(q => q.id === quote.id ? { ...q, project_stage: newStage } : q));
                              }}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-right font-semibold tabular-nums">
                          {formatPrice(quote.total)}
                        </TableCell>
                        <TableCell className="py-3 text-sm text-muted-foreground">
                          {new Date(quote.quote_date).toLocaleDateString('ko-KR', {
                            year: '2-digit',
                            month: '2-digit',
                            day: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8"
                              title="상세보기"
                              onClick={(event) => {
                                event.stopPropagation();
                                navigate(`/saved-quotes/${quote.id}`);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                              title="견적서 복제"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDuplicateQuote(quote.id);
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              title="견적서 삭제"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleDeleteQuote(quote.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
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
