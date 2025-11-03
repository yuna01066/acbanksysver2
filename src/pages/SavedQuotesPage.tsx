import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
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
  }, [currentPage]);

  useEffect(() => {
    filterQuotes();
  }, [searchTerm, dateFilter, quotes, sortBy]);

  useEffect(() => {
    setCurrentPage(1); // 검색어 변경 시 첫 페이지로
  }, [searchTerm, dateFilter]);

  const fetchQuotes = async () => {
    try {
      // 총 개수 가져오기
      const { count, error: countError } = await supabase
        .from('saved_quotes')
        .select('*', { count: 'exact', head: true });

      if (countError) throw countError;
      setTotalCount(count || 0);

      // 페이지네이션된 데이터 가져오기
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error } = await supabase
        .from('saved_quotes')
        .select('*')
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

    try {
      const { error } = await supabase
        .from('saved_quotes')
        .delete()
        .eq('id', quoteId);

      if (error) throw error;
      
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="mb-12">
          <div className="flex justify-end mb-6">
            <Button onClick={() => navigate('/')} variant="ghost" size="sm" className="gap-2">
              <Home className="w-4 h-4" />
              홈
            </Button>
          </div>
          <div className="text-center space-y-3">
            <h1 className="text-3xl font-bold tracking-tight">
              발행 견적서
            </h1>
            <p className="text-sm text-muted-foreground">저장된 견적서를 확인하고 관리합니다</p>
          </div>
        </div>

        {/* Search, Filter and Sort */}
        <div className="mb-8 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-10 border-0 bg-muted/50"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-10 h-10 border-0 bg-muted/50"
              />
            </div>
            <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
              <SelectTrigger className="h-10 border-0 bg-muted/50">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date-desc">최신순</SelectItem>
                <SelectItem value="date-asc">오래된순</SelectItem>
                <SelectItem value="amount-desc">금액 높은순</SelectItem>
                <SelectItem value="amount-asc">금액 낮은순</SelectItem>
                <SelectItem value="number-desc">견적번호 ↓</SelectItem>
                <SelectItem value="number-asc">견적번호 ↑</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Quotes List */}
        {filteredQuotes.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground mb-6">
              {quotes.length === 0 
                ? '저장된 견적서가 없습니다.' 
                : '검색 결과가 없습니다.'}
            </p>
            <Button onClick={() => navigate('/calculator')} variant="outline" size="sm">
              견적서 작성하기
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredQuotes.map((quote, index) => (
                <div
                  key={quote.id}
                  className="group relative bg-card border border-border/40 rounded-xl p-5 hover:border-border transition-all duration-300 hover:shadow-sm animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          {quote.quote_number}
                        </span>
                      </div>
                      {quote.project_name && (
                        <h3 className="font-semibold text-base truncate mb-2">
                          {quote.project_name}
                        </h3>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {new Date(quote.quote_date).toLocaleDateString('ko-KR', { 
                        month: 'numeric', 
                        day: 'numeric' 
                      })}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="space-y-2 mb-4 text-sm">
                    {quote.recipient_company && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{quote.recipient_company}</span>
                      </div>
                    )}
                    {quote.recipient_name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{quote.recipient_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  <div className="pt-4 border-t border-border/40 mb-4">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-muted-foreground">총액</span>
                      <span className="text-lg font-bold">{formatPrice(quote.total)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/saved-quotes/${quote.id}`)}
                      className="flex-1 h-9 text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" />
                      상세보기
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteQuote(quote.id)}
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {!searchTerm && !dateFilter && totalCount > ITEMS_PER_PAGE && (
              <div className="mt-8 flex items-center justify-center gap-6">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  이전
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentPage} / {Math.ceil(totalCount / ITEMS_PER_PAGE)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / ITEMS_PER_PAGE), p + 1))}
                  disabled={currentPage >= Math.ceil(totalCount / ITEMS_PER_PAGE)}
                  className="gap-1"
                >
                  다음
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SavedQuotesPage;
