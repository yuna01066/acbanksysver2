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
import { Home, Search, Calendar, Eye, ChevronLeft, ChevronRight, ArrowUpDown, Building2, User, FileText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

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
}

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc' | 'number-desc' | 'number-asc';

const SavedQuotesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<SavedQuote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    fetchQuotes();
  }, [currentPage, user]);

  useEffect(() => {
    filterQuotes();
  }, [searchTerm, dateFilter, quotes, sortBy]);

  useEffect(() => {
    setCurrentPage(1); // 검색어 변경 시 첫 페이지로
  }, [searchTerm, dateFilter]);

  const fetchQuotes = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // 총 개수 가져오기 (현재 사용자의 견적서만)
      const { count, error: countError } = await supabase
        .from('saved_quotes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (countError) throw countError;
      setTotalCount(count || 0);

      // 페이지네이션된 데이터 가져오기 (현재 사용자의 견적서만)
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <Badge variant="outline" className="text-xs">
                        {new Date(quote.quote_date).toLocaleDateString('ko-KR', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </Badge>
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
