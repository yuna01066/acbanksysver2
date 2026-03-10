import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import CustomerQuoteCard from '@/components/CustomerQuoteCard';
import QuoteCard from '@/components/QuoteCard';
import { Home, Search, Calendar, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Building2, User, FileText, Trash2, Filter, Copy, FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import ProjectStageSelect, { PROJECT_STAGES, getStageInfo } from '@/components/ProjectStageSelect';
import { getPaymentStatusInfo } from '@/components/project/PaymentStatusSelect';

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
  items: any;
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
  attachments: any;
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

      const originalAttachments = Array.isArray(originalQuote.attachments) ? originalQuote.attachments : [];
      const filteredAttachments = originalAttachments.filter((a: any) => a?.type !== 'quote_pdf');
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-end gap-2 mb-4">
            <Button onClick={() => navigate('/')} variant="outline">
              <Home className="w-4 h-4 mr-2" />
              홈으로
            </Button>
          </div>
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              발행 견적서 목록
            </h1>
            <p className="text-muted-foreground">저장된 견적서를 확인하고 관리합니다</p>
          </div>
        </div>

        {/* Search, Filter and Sort */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="견적번호, 프로젝트명, 업체명, 담당자로 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-10"
                />
              </div>
              {isAdmin && (
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      <SelectValue placeholder="담당자 선택" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 견적서</SelectItem>
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
                    <ArrowUpDown className="w-4 h-4" />
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
            </div>
            {/* Stage Filter */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">단계:</span>
              <Badge
                variant={stageFilter === 'all' ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => setStageFilter('all')}
              >
                전체
              </Badge>
              {PROJECT_STAGES.map((s) => (
                <Badge
                  key={s.value}
                  variant="outline"
                  className={`cursor-pointer text-xs ${stageFilter === s.value ? s.color + ' border-current' : ''}`}
                  onClick={() => setStageFilter(s.value)}
                >
                  {s.label}
                </Badge>
              ))}
            </div>
            {isAdmin && (
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  관리자 모드
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {userFilter === 'all' 
                    ? '전체 견적서를 조회하고 있습니다' 
                    : `${users.find(u => u.id === userFilter)?.full_name || '선택된 사용자'}의 견적서를 조회하고 있습니다`
                  }
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quotes List */}
        {filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground mb-4">
                {quotes.length === 0 
                  ? '저장된 견적서가 없습니다.' 
                  : '검색 결과가 없습니다.'}
              </p>
              <Button onClick={() => navigate('/calculator')} variant="outline">
                견적서 작성하기
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredQuotes.map((quote) => (
                <Card key={quote.id} className="hover:shadow-lg transition-all hover:scale-[1.02]">
                  <CardContent className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="w-5 h-5 text-primary" />
                          <h3 className="text-lg font-bold">{quote.quote_number}</h3>
                        </div>
                        {quote.project_name && (
                          <p className="text-base font-semibold text-foreground mb-2">{quote.project_name}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {new Date(quote.quote_date).toLocaleDateString('ko-KR', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </Badge>
                      </div>
                    </div>

                    {/* Project Stage */}
                    <div className="mb-3">
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

                    {/* Linked Project */}
                    {quote.linked_project && (
                      <div
                        className="mb-3 p-3 rounded-lg border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project-management?id=${quote.linked_project!.id}`);
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="text-sm font-semibold text-foreground truncate">{quote.linked_project.name}</span>
                        </div>
                        <div className="flex items-center gap-2 ml-6">
                          {quote.linked_project.payment_status && (
                            <Badge className={`text-xs ${getPaymentStatusInfo(quote.linked_project.payment_status).color}`}>
                              {getPaymentStatusInfo(quote.linked_project.payment_status).label}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Info Grid */}
                    <div className="space-y-3 mb-4">
                      {quote.recipient_company && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span
                            className="text-primary hover:underline cursor-pointer truncate"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/recipients?company=${encodeURIComponent(quote.recipient_company!)}`);
                            }}
                          >
                            {quote.recipient_company}
                          </span>
                        </div>
                      )}
                      {quote.recipient_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{quote.recipient_name}</span>
                        </div>
                      )}
                    </div>

                      {/* Issuer & Creator */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        {quote.issuer_name && (
                          <span className="bg-muted px-2 py-0.5 rounded">담당: {quote.issuer_name}</span>
                        )}
                        {quote.creator_name && (
                          <span className="bg-muted px-2 py-0.5 rounded">작성: {quote.creator_name}</span>
                        )}
                      </div>

                    {/* Price */}
                    <div className="bg-muted/50 rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">총 금액</span>
                        <span className="text-xl font-bold text-muted-foreground">{formatPrice(quote.total)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        상세보기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicateQuote(quote.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="견적서 복제"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteQuote(quote.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Pagination */}
            {!searchTerm && !dateFilter && totalCount > ITEMS_PER_PAGE && (
              <Card className="mt-6">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
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
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        이전
                      </Button>
                      <div className="text-sm font-medium px-4">
                        {currentPage} / {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), p + 1))}
                        disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                      >
                        다음
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SavedQuotesPage;
