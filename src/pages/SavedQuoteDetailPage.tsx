import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { List, Save, Edit, X, Download, Users, Building2, Calendar, FileText } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QuoteCard from "@/components/QuoteCard";
import CustomerQuoteCard from "@/components/CustomerQuoteCard";
import businessRegistration from "@/assets/arcbank-business-registration.jpg";
import bankAccount from "@/assets/arcbank-bank-account.jpg";

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

const SavedQuoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<SavedQuote>>({});
  const [viewMode, setViewMode] = useState<'internal' | 'customer'>('internal');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchQuote();
    }
  }, [id]);

  const fetchQuote = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      const formattedData = {
        ...data,
        items: Array.isArray(data.items) ? data.items : []
      };
      
      setQuote(formattedData);
      setEditForm(formattedData);
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('견적서를 불러오는데 실패했습니다.');
      navigate('/saved-quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!id) return;

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
        .eq('id', id);

      if (error) throw error;

      toast.success('견적서가 수정되었습니다.');
      setIsEditing(false);
      fetchQuote();
    } catch (error) {
      console.error('Error updating quote:', error);
      toast.error('견적서 수정에 실패했습니다.');
    }
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'internal' ? 'customer' : 'internal');
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-muted-foreground">로딩 중...</p>
      </div>
    );
  }

  const currentDate = new Date(quote.quote_date).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const items = Array.isArray(quote.items) ? quote.items : [];
  const subtotal = quote.subtotal;
  const tax = quote.tax;
  const totalWithTax = quote.total;

  return (
    <>
      <style>{`
        @media print {
          body {
            transform: scale(0.8);
            transform-origin: top left;
            width: 125%;
            margin: 0;
            padding: 0;
          }
          .print-container {
            max-width: none;
            margin: 0;
            padding: 10px;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-4xl mx-auto print-container">
          <div className="mb-6 print:hidden">
            <Button 
              variant="outline" 
              onClick={() => navigate('/saved-quotes')}
              className="flex items-center gap-2"
              size="sm"
            >
              <List className="w-4 h-4" />
              발행 견적서 목록
            </Button>
          </div>

          {/* Header */}
          <div className="flex justify-between items-center mb-6 print:hidden">
            <Button variant="outline" onClick={() => navigate('/saved-quotes')} className="flex items-center gap-2">
              <List className="w-4 h-4" />
              발행 견적서 목록
            </Button>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={handleSaveEdit} className="text-green-600 border-green-600">
                    <Save className="w-4 h-4 mr-2" />
                    저장
                  </Button>
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4 mr-2" />
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="text-blue-600 border-blue-600">
                    <Edit className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button variant="outline" onClick={toggleViewMode} className={`flex items-center gap-2 ${viewMode === 'customer' ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-green-600 border-green-600 hover:bg-green-50'}`}>
                    {viewMode === 'internal' ? (
                      <>
                        <Users className="w-4 h-4" />
                        고객용 견적서
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        내부용 견적서
                      </>
                    )}
                  </Button>
                  <Button onClick={handlePrintPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4" />
                    PDF 출력
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quote Header Card */}
          <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden bg-white mb-6">
            <div className="bg-white border-b border-gray-100 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-gray-900">
                    <FileText className="w-8 h-8 text-gray-700" />
                    아크뱅크 견적서
                  </h1>
                  <p className="text-gray-500 text-lg font-light">ACBANK Quotation</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-gray-500 mb-2">
                    <Calendar className="w-4 h-4" />
                    <span>{currentDate}</span>
                  </div>
                  <Badge className="bg-gray-100 text-gray-800 border border-gray-200 px-4 py-2 text-lg font-semibold">
                    견적번호: {quote.quote_number}
                  </Badge>
                </div>
              </div>
            </div>
          </Card>

          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
            <CardContent className="p-8">
              {/* 견적 요약 정보 */}
              <div className="mb-8 border border-gray-200 rounded-lg bg-white shadow-sm">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                    <h2 className="text-lg font-semibold text-gray-900">견적 요약</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 견적 기본 정보 */}
                    <div className="space-y-3">
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">견적번호</p>
                        <p className="text-sm font-semibold text-gray-900">{quote.quote_number}</p>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <p className="text-xs text-gray-500 mb-1">작성일</p>
                        <p className="text-sm font-semibold text-gray-900">{currentDate}</p>
                      </div>
                    </div>
                    
                    {/* 견적 항목 */}
                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col justify-center">
                      <p className="text-xs text-gray-500 mb-1">견적 항목 수</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-bold text-gray-900">{items.length}</p>
                        <p className="text-sm text-gray-500">개</p>
                      </div>
                    </div>
                    
                    {/* 금액 정보 */}
                    <div className="space-y-2 bg-gray-50 rounded-lg p-3 border border-gray-100">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <p className="text-xs text-gray-500">공급가</p>
                        <p className="text-sm font-semibold text-gray-900">{subtotal.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <p className="text-xs text-gray-500">부가세</p>
                        <p className="text-sm font-semibold text-gray-900">{tax.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <p className="text-sm font-semibold text-gray-900">최종 금액</p>
                        <p className="text-base font-bold text-gray-900">{totalWithTax.toLocaleString()}원</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Edit Form */}
              {isEditing && (
                <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900">수신자 정보 수정</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700">업체명</Label>
                      <Input
                        value={editForm.recipient_company || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_company: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">담당자</Label>
                      <Input
                        value={editForm.recipient_name || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_name: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">연락처</Label>
                      <Input
                        value={editForm.recipient_phone || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-700">이메일</Label>
                      <Input
                        value={editForm.recipient_email || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_email: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-gray-700">배송지</Label>
                      <Input
                        value={editForm.recipient_address || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_address: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-gray-700">메모</Label>
                      <Textarea
                        value={editForm.recipient_memo || ''}
                        onChange={(e) => setEditForm({ ...editForm, recipient_memo: e.target.value })}
                        rows={3}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 견적서 수신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 수신</h3>
                  
                  {/* 고객 정보 */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">고객 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>업체명:</strong> {quote.recipient_company || '-'}</div>
                      <div><strong>담당자:</strong> {quote.recipient_name || '-'}</div>
                      <div><strong>연락처:</strong> {quote.recipient_phone || '-'}</div>
                      <div><strong>이메일:</strong> {quote.recipient_email || '-'}</div>
                      {quote.recipient_address && (
                        <div><strong>배송지:</strong> {quote.recipient_address}</div>
                      )}
                    </div>
                  </div>

                  {quote.recipient_memo && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <h4 className="font-semibold text-amber-900 mb-2">클라이언트 요청사항</h4>
                      <p className="text-sm text-amber-800 whitespace-pre-wrap">{quote.recipient_memo}</p>
                    </div>
                  )}
                </div>

                {/* 견적서 발신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 발신</h3>
                  
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">아크뱅크</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>대표:</strong> 주혜옥</div>
                      <div><strong>연락처:</strong> 010-8892-8858</div>
                      <div><strong>이메일:</strong> acbank@acbank.co.kr</div>
                      <div><strong>사업자등록번호:</strong> 000-00-00000</div>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-8" />

              {/* 견적 상세 내역 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-6 text-gray-900 border-b-2 border-gray-300 pb-2">견적 상세 내역</h3>
                
                <div className="space-y-6">
                  {items.map((item: any, index: number) => (
                    viewMode === 'customer' ? (
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
              </div>

              <Separator className="my-8" />

              {/* 총 금액 */}
              <div className="bg-gray-50 rounded-lg p-6 border-2 border-gray-300">
                <div className="flex justify-end">
                  <div className="w-full md:w-1/2 space-y-3">
                    <div className="flex justify-between items-center text-lg pb-2 border-b border-gray-300">
                      <span className="text-gray-600 font-medium">공급가:</span>
                      <span className="font-bold text-gray-900">{subtotal.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between items-center text-lg pb-2 border-b border-gray-300">
                      <span className="text-gray-600 font-medium">부가세 (10%):</span>
                      <span className="font-bold text-gray-900">{tax.toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between items-center text-2xl pt-2">
                      <span className="font-bold text-gray-900">최종 금액:</span>
                      <span className="font-bold text-blue-600">{totalWithTax.toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-8" />

              {/* 특이사항 및 안내사항 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4 text-gray-900 border-b-2 border-gray-300 pb-2">특이사항 및 안내사항</h3>
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <ul className="space-y-2 text-sm text-yellow-900">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>상기 금액은 부가세 포함 금액입니다.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>견적 유효기간은 견적일로부터 30일입니다.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>최종 금액은 실측 후 조정될 수 있습니다.</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-600">•</span>
                      <span>배송 및 설치 비용은 별도 협의가 필요합니다.</span>
                    </li>
                  </ul>
                </div>
              </div>

              <Separator className="my-8" />

              {/* 상담 및 문의 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold mb-4 text-gray-900 border-b-2 border-gray-300 pb-2">상담 및 문의</h3>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-900">
                    <div>
                      <p className="font-semibold mb-2">연락처</p>
                      <p>전화: 010-8892-8858</p>
                      <p>이메일: acbank@acbank.co.kr</p>
                    </div>
                    <div>
                      <p className="font-semibold mb-2">소셜 미디어</p>
                      <p>카카오톡: @아크뱅크</p>
                      <p>인스타그램: @acbank.co.kr</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-8" />

              {/* 첨부 서류 */}
              <div>
                <h3 className="text-lg font-bold mb-4 text-gray-900 border-b-2 border-gray-300 pb-2">첨부 서류</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">사업자등록증</p>
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <img 
                        src={businessRegistration} 
                        alt="사업자등록증" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-700">입금 계좌</p>
                    <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                      <img 
                        src={bankAccount} 
                        alt="입금계좌" 
                        className="w-full h-auto"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
