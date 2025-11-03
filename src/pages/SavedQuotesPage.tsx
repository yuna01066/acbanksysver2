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
import { Home, Search, Calendar, Edit, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
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

const SavedQuotesPage = () => {
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<SavedQuote[]>([]);
  const [filteredQuotes, setFilteredQuotes] = useState<SavedQuote[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [viewMode, setViewMode] = useState<Record<string, 'internal' | 'customer'>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SavedQuote>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuotes();
  }, []);

  useEffect(() => {
    filterQuotes();
  }, [searchTerm, dateFilter, quotes]);

  const fetchQuotes = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('*')
        .order('quote_date', { ascending: false });

      if (error) throw error;
      
      const formattedData = (data || []).map(q => ({
        ...q,
        items: Array.isArray(q.items) ? q.items : []
      }));
      setQuotes(formattedData);
      const initialViewMode: Record<string, 'internal' | 'customer'> = {};
      (data || []).forEach(quote => {
        initialViewMode[quote.id] = 'internal';
      });
      setViewMode(initialViewMode);
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
        quote.recipient_company?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (dateFilter) {
      filtered = filtered.filter(quote => 
        quote.quote_date.startsWith(dateFilter)
      );
    }

    setFilteredQuotes(filtered);
  };

  const toggleViewMode = (quoteId: string) => {
    setViewMode(prev => ({
      ...prev,
      [quoteId]: prev[quoteId] === 'internal' ? 'customer' : 'internal'
    }));
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

  const handleEditQuote = (quote: SavedQuote) => {
    setEditingId(quote.id);
    setEditForm(quote);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    try {
      const { error } = await supabase
        .from('saved_quotes')
        .update({
          recipient_name: editForm.recipient_name,
          recipient_company: editForm.recipient_company,
          recipient_phone: editForm.recipient_phone,
          recipient_email: editForm.recipient_email,
          recipient_address: editForm.recipient_address,
          recipient_memo: editForm.recipient_memo
        })
        .eq('id', editingId);

      if (error) throw error;

      toast.success('견적서가 수정되었습니다.');
      setEditingId(null);
      setEditForm({});
      fetchQuotes();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('견적서 수정에 실패했습니다.');
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary via-primary-glow to-accent bg-clip-text text-transparent">
              발행 견적서 목록
            </h1>
            <p className="text-muted-foreground">저장된 견적서를 확인하고 관리합니다</p>
          </div>
          <Button onClick={() => navigate('/')} variant="outline">
            <Home className="w-4 h-4 mr-2" />
            홈으로
          </Button>
        </div>

        {/* Search and Filter */}
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="견적번호, 업체명, 담당자로 검색..."
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
          <div className="space-y-6">
            {filteredQuotes.map((quote) => (
              <Card key={quote.id}>
                <CardContent className="p-6">
                  {/* Quote Header */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b">
                    <div>
                      <h3 className="text-lg font-semibold">{quote.quote_number}</h3>
                      <p className="text-sm text-muted-foreground">
                        {new Date(quote.quote_date).toLocaleDateString('ko-KR')}
                        {quote.recipient_company && ` · ${quote.recipient_company}`}
                        {quote.recipient_name && ` · ${quote.recipient_name}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {editingId === quote.id ? (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSaveEdit}
                            className="text-green-600 border-green-600"
                          >
                            <Save className="w-4 h-4 mr-1" />
                            저장
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            <X className="w-4 h-4 mr-1" />
                            취소
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditQuote(quote)}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            수정
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleViewMode(quote.id)}
                          >
                            {viewMode[quote.id] === 'internal' ? '고객용 보기' : '내부용 보기'}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteQuote(quote.id)}
                          >
                            삭제
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit Form */}
                  {editingId === quote.id && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg space-y-4">
                      <h4 className="font-semibold mb-3">수신자 정보 수정</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>업체명</Label>
                          <Input
                            value={editForm.recipient_company || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_company: e.target.value })}
                            placeholder="업체명"
                          />
                        </div>
                        <div>
                          <Label>담당자</Label>
                          <Input
                            value={editForm.recipient_name || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_name: e.target.value })}
                            placeholder="담당자명"
                          />
                        </div>
                        <div>
                          <Label>연락처</Label>
                          <Input
                            value={editForm.recipient_phone || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
                            placeholder="연락처"
                          />
                        </div>
                        <div>
                          <Label>이메일</Label>
                          <Input
                            value={editForm.recipient_email || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_email: e.target.value })}
                            placeholder="이메일"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>배송지</Label>
                          <Input
                            value={editForm.recipient_address || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_address: e.target.value })}
                            placeholder="배송지 주소"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>메모</Label>
                          <Textarea
                            value={editForm.recipient_memo || ''}
                            onChange={(e) => setEditForm({ ...editForm, recipient_memo: e.target.value })}
                            placeholder="메모 내용"
                            rows={3}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quote Items */}
                  <div className="space-y-4">
                    {(Array.isArray(quote.items) ? quote.items : []).map((item: any, index: number) => (
                      viewMode[quote.id] === 'customer' ? (
                        <CustomerQuoteCard
                          key={index}
                          quote={item}
                          index={index}
                          onRemove={() => {}}
                          onUpdateQuantity={() => {}}
                          isCustomerView={true}
                        />
                      ) : (
                        <QuoteCard
                          key={index}
                          quote={item}
                          index={index}
                          onRemove={() => {}}
                          onUpdateQuantity={() => {}}
                        />
                      )
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-6 pt-4 border-t">
                    <div className="flex justify-end space-y-2 flex-col items-end">
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">소계:</span>
                        <span className="font-medium">{formatPrice(quote.subtotal)}</span>
                      </div>
                      <div className="flex gap-4 text-sm">
                        <span className="text-muted-foreground">부가세 (10%):</span>
                        <span className="font-medium">{formatPrice(quote.tax)}</span>
                      </div>
                      <div className="flex gap-4 text-lg font-bold">
                        <span>총 합계:</span>
                        <span className="text-primary">{formatPrice(quote.total)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedQuotesPage;
