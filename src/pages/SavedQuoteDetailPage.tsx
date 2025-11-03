import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Home, Save, Edit, X, Download, Users, Building2 } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QuoteCard from "@/components/QuoteCard";
import CustomerQuoteCard from "@/components/CustomerQuoteCard";
import businessRegistration from "@/assets/arcbank-business-registration.jpg";
import bankAccount from "@/assets/arcbank-bank-account.jpg";
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
          {/* Header Actions */}
          <div className="flex justify-between items-center mb-6 print:hidden">
            <Button variant="outline" onClick={() => navigate('/saved-quotes')} className="flex items-center gap-2">
              <Home className="w-4 h-4" />
              목록으로
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
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button variant="outline" onClick={toggleViewMode}>
                    {viewMode === 'internal' ? (
                      <>
                        <Users className="w-4 h-4 mr-2" />
                        고객용 보기
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4 mr-2" />
                        내부용 보기
                      </>
                    )}
                  </Button>
                  <Button onClick={handlePrintPDF} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4 mr-2" />
                    PDF 출력
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Quote Header */}
          <Card className="shadow-sm border border-gray-200 rounded-xl overflow-hidden bg-white mb-6">
            <div className="bg-white border-b border-gray-100 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-gray-900">
                    아크뱅크 견적서
                  </h1>
                  <p className="text-gray-500 text-lg font-light">ACBANK Quotation</p>
                </div>
                <div className="text-right">
                  <div className="text-gray-500 mb-2">{currentDate}</div>
                  <div className="bg-gray-100 text-gray-800 border border-gray-200 px-4 py-2 text-lg font-semibold rounded">
                    견적번호: {quote.quote_number}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Edit Form */}
          {isEditing && (
            <Card className="mb-6">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">수신자 정보 수정</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>업체명</Label>
                    <Input
                      value={editForm.recipient_company || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_company: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>담당자</Label>
                    <Input
                      value={editForm.recipient_name || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>연락처</Label>
                    <Input
                      value={editForm.recipient_phone || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>이메일</Label>
                    <Input
                      value={editForm.recipient_email || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_email: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>배송지</Label>
                    <Input
                      value={editForm.recipient_address || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_address: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>메모</Label>
                    <Textarea
                      value={editForm.recipient_memo || ''}
                      onChange={(e) => setEditForm({ ...editForm, recipient_memo: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recipient & Sender Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">수신</h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">업체명:</span>
                    <span className="font-medium">{quote.recipient_company || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">담당자:</span>
                    <span className="font-medium">{quote.recipient_name || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">연락처:</span>
                    <span className="font-medium">{quote.recipient_phone || '-'}</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">이메일:</span>
                    <span className="font-medium">{quote.recipient_email || '-'}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900">발신</h3>
                <div className="space-y-3">
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">업체명:</span>
                    <span className="font-medium">아크뱅크</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">담당자:</span>
                    <span className="font-medium">주혜옥 대표</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">연락처:</span>
                    <span className="font-medium">010-8892-8858</span>
                  </div>
                  <div className="flex">
                    <span className="text-gray-600 w-24 flex-shrink-0">이메일:</span>
                    <span className="font-medium">acbank@acbank.co.kr</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quote Items */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">견적 내역</h3>
              <div className="space-y-4">
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
            </CardContent>
          </Card>

          {/* Total Summary */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex justify-end">
                <div className="w-full md:w-1/2 space-y-3">
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-600">소계:</span>
                    <span className="font-semibold">{formatPrice(quote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-lg">
                    <span className="text-gray-600">부가세 (10%):</span>
                    <span className="font-semibold">{formatPrice(quote.tax)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-xl font-bold">
                    <span>총 합계:</span>
                    <span className="text-blue-600">{formatPrice(quote.total)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Special Notes */}
          <Card className="mb-6">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">특이사항</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p>• 상기 금액은 부가세 포함 금액입니다.</p>
                <p>• 견적 유효기간은 견적일로부터 30일입니다.</p>
                <p>• 최종 금액은 실측 후 조정될 수 있습니다.</p>
              </div>
            </CardContent>
          </Card>

          {/* Contact & Documents */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">상담 및 문의</h3>
                <div className="space-y-2 text-sm">
                  <p className="flex items-center gap-2">
                    <span className="font-medium">전화:</span>
                    <span>010-8892-8858</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium">이메일:</span>
                    <span>acbank@acbank.co.kr</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="font-medium">카카오톡:</span>
                    <span>@아크뱅크</span>
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">첨부서류</h3>
                <div className="space-y-2">
                  <img src={businessRegistration} alt="사업자등록증" className="w-full rounded border" />
                  <p className="text-xs text-center text-gray-500">사업자등록증</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">입금계좌</h3>
              <img src={bankAccount} alt="입금계좌" className="w-full rounded border" />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
