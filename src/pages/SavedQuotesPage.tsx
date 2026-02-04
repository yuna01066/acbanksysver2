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
import { Home, Search, Calendar, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Building2, User, FileText, Trash2, Filter, Copy, Cloud, CloudOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { syncQuoteToPluuug, convertQuoteToPluuugFormat } from '@/utils/pluuugSync';

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
  pluuug_synced: boolean | null;
  pluuug_synced_at: string | null;
  pluuug_estimate_id: string | null;
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
  const [userFilter, setUserFilter] = useState<string>('all'); // 'all' or user_id
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [syncingQuoteId, setSyncingQuoteId] = useState<string | null>(null);
  const ITEMS_PER_PAGE = 50;

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
  }, [searchTerm, dateFilter, quotes, sortBy]);

  useEffect(() => {
    setCurrentPage(1); // 검색어 변경 시 첫 페이지로
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

      // 관리자인 경우
      if (isAdmin) {
        // userFilter에 따라 쿼리 조건 분기
        let countQuery = supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true });

        let dataQuery = supabase
          .from('saved_quotes')
          .select('*')
          .order('quote_date', { ascending: false })
          .range(from, to);

        // 특정 사용자 필터가 적용된 경우
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
        setQuotes(formattedData);
      } 
      // 일반 사용자인 경우 (자신의 견적서만)
      else {
        const { count, error: countError } = await supabase
          .from('saved_quotes')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (countError) throw countError;
        setTotalCount(count || 0);

        const { data, error } = await supabase
          .from('saved_quotes')
          .select('*')
          .eq('user_id', user.id)
          .order('quote_date', { ascending: false })
          .range(from, to);

        if (error) throw error;

        const formattedData = (data || []).map(q => ({
          ...q,
          items: Array.isArray(q.items) ? q.items : []
        }));
        setQuotes(formattedData);
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
        quote.project_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(quote => 
        quote.quote_date.startsWith(dateFilter)
      );
    }

    // 정렬 적용
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
      
      // 실제로 삭제된 행이 있는지 확인
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
      // 원본 견적서 가져오기
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

      // 새 견적번호 생성
      const newQuoteNumber = generateNewQuoteNumber();

      // 복제 데이터 생성 (id, created_at, updated_at 제외)
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
        issuer_name: originalQuote.issuer_name,
        issuer_email: originalQuote.issuer_email,
        issuer_phone: originalQuote.issuer_phone,
        issuer_department: originalQuote.issuer_department,
        issuer_position: originalQuote.issuer_position,
        custom_color_name: originalQuote.custom_color_name,
        custom_opacity: originalQuote.custom_opacity,
        attachments: originalQuote.attachments,
        desired_delivery_date: originalQuote.desired_delivery_date,
      };

      const { data: newQuote, error: insertError } = await supabase
        .from('saved_quotes')
        .insert(duplicateData)
        .select()
        .single();

      if (insertError) throw insertError;

      toast.success('견적서가 복제되었습니다.');
      fetchQuotes(); // 목록 새로고침
      
      // 새 견적서 상세 페이지로 이동 (선택사항)
      // navigate(`/saved-quotes/${newQuote.id}`);
    } catch (error) {
      console.error('Error duplicating quote:', error);
      toast.error('견적서 복제에 실패했습니다.');
    }
  };

  const handleSyncToPluuug = async (quote: SavedQuote) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    if (quote.pluuug_synced) {
      toast.info('이미 Pluuug에 동기화된 견적서입니다.');
      return;
    }

    setSyncingQuoteId(quote.id);
    
    try {
      // 견적 데이터를 Pluuug 형식으로 변환
      const recipient = {
        projectName: quote.project_name,
        companyName: quote.recipient_company,
        contactPerson: quote.recipient_name,
        phoneNumber: quote.recipient_phone,
        email: quote.recipient_email,
        deliveryAddress: quote.recipient_address,
        clientMemo: quote.recipient_memo,
      };

      const pluuugData = convertQuoteToPluuugFormat(
        quote.items,
        recipient,
        quote.quote_number,
        quote.subtotal,
        quote.tax,
        quote.total
      );

      // Pluuug에 동기화 (고객 자동 등록 포함) - quotes 데이터도 전달하여 fieldSet 생성
      const syncResult = await syncQuoteToPluuug(
        pluuugData,
        user.id,
        recipient,
        null, // recipientId가 없으면 자동 등록
        quote.items // quotes 데이터 전달 (fieldSet 생성용)
      );

      if (syncResult.success) {
        // DB 업데이트
        await supabase
          .from('saved_quotes')
          .update({
            pluuug_synced: true,
            pluuug_synced_at: new Date().toISOString(),
            pluuug_estimate_id: syncResult.pluuugInquiryId?.toString()
          })
          .eq('id', quote.id);

        toast.success('Pluuug에 견적서가 동기화되었습니다!');
        fetchQuotes(); // 목록 새로고침
      } else {
        toast.error(`동기화 실패: ${syncResult.error || '알 수 없는 오류'}`);
      }
    } catch (error: any) {
      console.error('Error syncing to Pluuug:', error);
      toast.error(`동기화 중 오류 발생: ${error.message}`);
    } finally {
      setSyncingQuoteId(null);
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
          <div className="flex justify-end mb-4">
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
                        {quote.pluuug_synced ? (
                          <Badge variant="secondary" className="text-xs flex items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            <Cloud className="w-3 h-3" />
                            Pluuug
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSyncToPluuug(quote);
                            }}
                            disabled={syncingQuoteId === quote.id}
                            className="h-6 px-2 text-xs flex items-center gap-1 text-muted-foreground hover:text-primary hover:border-primary"
                            title="Pluuug에 동기화"
                          >
                            {syncingQuoteId === quote.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CloudOff className="w-3 h-3" />
                            )}
                            {syncingQuoteId === quote.id ? '동기화 중...' : '미연동'}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="space-y-3 mb-4">
                      {quote.recipient_company && (
                        <div className="flex items-center gap-2 text-sm">
                          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground truncate">{quote.recipient_company}</span>
                        </div>
                      )}
                      {quote.recipient_name && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-muted-foreground">{quote.recipient_name}</span>
                        </div>
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
