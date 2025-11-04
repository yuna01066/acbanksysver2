import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, Save, Edit, X, Download, Users, Building2, Home, Calculator, FileText, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QuoteCard from "@/components/QuoteCard";
import CustomerQuoteCard from "@/components/CustomerQuoteCard";
import QuoteSummaryHeader from "@/components/QuoteSummaryHeader";
import PrintStyles from "@/components/PrintStyles";
import businessRegistration from "@/assets/arcbank-business-registration.jpg";
import bankAccount from "@/assets/arcbank-bank-account.jpg";
import arcbankLogo from "@/assets/arcbank-logo.png";
import RecipientInfoForm from "@/components/RecipientInfoForm";
import { QuoteRecipient } from "@/contexts/QuoteContext";

interface SavedQuote {
  id: string;
  quote_number: string;
  quote_date: string;
  project_name: string | null;
  quote_date_display: string | null;
  valid_until: string | null;
  delivery_period: string | null;
  payment_condition: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_address: string | null;
  recipient_memo: string | null;
  desired_delivery_date: string | null;
  issuer_name: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  issuer_department: string | null;
  issuer_position: string | null;
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
  const [recipientData, setRecipientData] = useState<QuoteRecipient>({
    projectName: '',
    quoteNumber: '',
    quoteDate: new Date(),
    validUntil: '',
    deliveryPeriod: '',
    paymentCondition: '',
    companyName: '',
    contactPerson: '',
    phoneNumber: '',
    email: '',
    desiredDeliveryDate: null,
    deliveryAddress: '',
    clientMemo: ''
  });
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
      
      // 현재 로그인한 사용자의 프로필 정보 가져오기
      const { data: { user } } = await supabase.auth.getUser();
      let profileData = null;
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, department, position')
          .eq('id', user.id)
          .single();
        
        profileData = profile;
      }
      
      setQuote(formattedData);
      
      // RecipientData 설정 - issuer 정보는 profiles에서 가져오거나 saved_quotes에 저장된 값 사용
      setRecipientData({
        projectName: formattedData.project_name || '',
        quoteNumber: formattedData.quote_number || '',
        quoteDate: formattedData.quote_date_display ? new Date(formattedData.quote_date_display) : new Date(),
        validUntil: formattedData.valid_until || '',
        deliveryPeriod: formattedData.delivery_period || '',
        paymentCondition: formattedData.payment_condition || '',
        companyName: formattedData.recipient_company || '',
        contactPerson: formattedData.recipient_name || '',
        phoneNumber: formattedData.recipient_phone || '',
        email: formattedData.recipient_email || '',
        desiredDeliveryDate: formattedData.desired_delivery_date ? new Date(formattedData.desired_delivery_date) : null,
        deliveryAddress: formattedData.recipient_address || '',
        clientMemo: formattedData.recipient_memo || '',
        issuerName: formattedData.issuer_name || profileData?.full_name || '',
        issuerEmail: formattedData.issuer_email || profileData?.email || '',
        issuerPhone: formattedData.issuer_phone || profileData?.phone || ''
      });
    } catch (error) {
      console.error('Error fetching quote:', error);
      toast.error('견적서를 불러오는데 실패했습니다.');
      navigate('/saved-quotes');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipientChange = (field: keyof QuoteRecipient, value: any) => {
    setRecipientData(prev => ({ ...prev, [field]: value }));
  };

  const handleBulkRecipientChange = (updates: Partial<QuoteRecipient>) => {
    setRecipientData(prev => ({ ...prev, ...updates }));
  };

  const handleSaveEdit = async () => {
    if (!id) return;

    try {
      const { error } = await supabase
        .from('saved_quotes')
        .update({
          project_name: recipientData.projectName,
          quote_date_display: recipientData.quoteDate?.toISOString(),
          valid_until: recipientData.validUntil,
          delivery_period: recipientData.deliveryPeriod,
          payment_condition: recipientData.paymentCondition,
          recipient_name: recipientData.contactPerson,
          recipient_company: recipientData.companyName,
          recipient_phone: recipientData.phoneNumber,
          recipient_email: recipientData.email,
          recipient_address: recipientData.deliveryAddress,
          recipient_memo: recipientData.clientMemo,
          desired_delivery_date: recipientData.desiredDeliveryDate?.toISOString(),
          issuer_name: recipientData.issuerName,
          issuer_email: recipientData.issuerEmail,
          issuer_phone: recipientData.issuerPhone
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
  const subtotal = Math.round(quote.subtotal);
  const tax = Math.round(quote.tax);
  const totalWithTax = Math.round(quote.total);

  return (
    <>
      <PrintStyles quoteNumber={quote.quote_number} projectName={quote.project_name} companyName={quote.recipient_company} />
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-4xl mx-auto print-container">
          <div className="mb-6 print:hidden">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
              size="sm"
            >
              <Home className="w-4 h-4" />
              홈으로 돌아가기
            </Button>
          </div>

          {/* Header Actions */}
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
          
          {/* 헤더 카드 */}
          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white mb-6 print:shadow-none">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-700 text-white p-8 print:bg-slate-900">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-slate-300 mb-2">ARCBANK QUOTATION</div>
                  <CardTitle className="text-3xl font-bold flex items-center gap-3 mb-2">
                    <FileText className="w-8 h-8" />
                    아크뱅크 견적서
                  </CardTitle>
                  <p className="text-slate-200 text-lg">Panel Material Quotation</p>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-2 text-slate-200 mb-2">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{currentDate}</span>
                  </div>
                  <Badge className="bg-white/20 text-white border-0 px-4 py-2 text-lg font-bold">
                    견적번호: {quote.quote_number}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>
          
          <div className="hidden">
            <QuoteSummaryHeader 
              onClearQuotes={() => {}}
              onPrintPDF={handlePrintPDF}
              currentDate={currentDate}
              quoteNumber={quote.quote_number}
            />
          </div>

          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
            <CardContent className="p-8">
              {/* 견적 요약 정보 */}
              <div className="mb-8 border border-gray-200 rounded-lg bg-white shadow-sm print-summary">
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
                <div className="mb-8">
                  <RecipientInfoForm
                    recipientData={recipientData}
                    onChange={handleRecipientChange}
                    onBulkChange={handleBulkRecipientChange}
                    showClientMemo={true}
                  />
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 견적서 수신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 수신</h3>
                  
                  {/* 프로젝트 기본 정보 */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">프로젝트 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>프로젝트명:</strong> {quote.project_name || '-'}</div>
                      <div><strong>견적번호:</strong> {quote.quote_number}</div>
                      <div><strong>견적일자:</strong> {quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</div>
                      <div><strong>유효기간:</strong> {quote.valid_until || '-'}</div>
                      <div><strong>납기:</strong> {quote.delivery_period || '-'}</div>
                      <div><strong>지불 조건:</strong> {quote.payment_condition || '-'}</div>
                    </div>
                  </div>

                  {/* 담당자 및 납기 정보 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">담당자 및 납기 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>회사명:</strong> {quote.recipient_company || '-'}</div>
                      <div><strong>담당자:</strong> {quote.recipient_name || '-'}</div>
                      <div><strong>연락처:</strong> {quote.recipient_phone || '-'}</div>
                      <div><strong>이메일:</strong> {quote.recipient_email || '-'}</div>
                      <div><strong>납기 희망일:</strong> {quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '-'}</div>
                      <div><strong>납기현장 주소:</strong> {quote.recipient_address || '-'}</div>
                    </div>
                  </div>
                </div>

                {/* 견적서 발신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 발신</h3>
                  
                  {/* 회사 기본 정보 */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">회사 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>상호:</strong> (주)아크뱅크</div>
                      <div><strong>사업자번호:</strong> 299-87-02991</div>
                      <div><strong>웹사이트:</strong> acbank.co.kr</div>
                      <div><strong>주소:</strong> 경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호 (동행빌딩)</div>
                      <div><strong>업태:</strong> 제조업 / 도매 및 소매업</div>
                      <div><strong>종목:</strong> 아크릴 가공 외</div>
                      <div><strong>연락처:</strong> 070-7666-9828</div>
                      <div><strong>이메일:</strong> acbank@acbank.co.kr</div>
                    </div>
                  </div>

                  {/* 담당자 정보 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">담당자 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>담당자:</strong> {recipientData.issuerName || '작성'}</div>
                      {recipientData.issuerEmail && <div><strong>이메일:</strong> {recipientData.issuerEmail}</div>}
                      {recipientData.issuerPhone && <div><strong>연락처:</strong> {recipientData.issuerPhone}</div>}
                    </div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">입금 계좌</h4>
                    <div className="text-sm text-blue-700">
                      <div>신한은행 140-014-544315 (주)아크뱅크</div>
                    </div>
                  </div>
                </div>
              </div>


              {/* 내부용 견적 목록 */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({items.length}개) - 내부 관리용
                </h3>
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
                        readOnly={true}
                      />
                    ) : (
                      <QuoteCard
                        key={index}
                        quote={item}
                        index={index}
                        onRemove={() => {}}
                        onUpdateQuantity={() => {}}
                        readOnly={true}
                      />
                    )
                  ))}
                </div>
              </div>

              {/* 견적 총 합계 */}
              <div className="mb-8 border border-gray-200 rounded-lg bg-white shadow-sm print-total">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold text-gray-900 bg-slate-100 px-6 py-2 rounded-lg">총 견적 금액</h2>
                    <div className="flex flex-col items-end gap-2 flex-1">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">소계 (부가세 별도)</span>
                          <span className="text-sm font-semibold text-gray-900">{subtotal.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">부가세 (10%)</span>
                          <span className="text-sm font-semibold text-gray-900">{tax.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-lg">
                          <span className="text-sm font-bold text-white">총 합계</span>
                          <span className="text-xl font-bold text-white">{totalWithTax.toLocaleString()}원</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">* 배송비는 별도 입니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 특이사항 및 상담내용 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-bold mb-3">특 이 사 항 :</h3>
                  <ul className="text-sm space-y-1">
                    <li>- 견적서의 유효기간은 발행일로부터 14일 입니다.</li>
                    <li>- 운송비 및 부가세는 별도 입니다.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold mb-3">상 담 내 용 :</h3>
                  <div className="text-sm space-y-1">
                    <p>안녕하세요</p>
                    <p>견적 문의해 주셔서 감사합니다.</p>
                    <p>상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.</p>
                  </div>
                </div>
              </div>

              {/* 연락처 정보 */}
              <div className="mt-8 p-6 bg-gradient-to-r from-blue-50 to-slate-50 border border-blue-200 rounded-xl shadow-sm">
                <h4 className="font-bold text-slate-800 mb-4 text-lg">문의 및 주문</h4>
                <div className="text-sm text-slate-700 space-y-3">
                  <p className="mb-3">견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                  
                  {/* 담당자 정보 */}
                  {quote.issuer_name && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="font-semibold text-blue-900 mb-2">담당자</p>
                      <div className="space-y-1">
                        <p className="font-medium">👤 {quote.issuer_name}</p>
                        {quote.issuer_phone && <p className="font-medium">📞 {quote.issuer_phone}</p>}
                        {quote.issuer_email && <p className="font-medium">📧 {quote.issuer_email}</p>}
                      </div>
                    </div>
                  )}
                  
                  {/* 회사 대표 연락처 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="font-semibold bg-white px-3 py-2 rounded-lg">📞 대표전화: 070-7537-3680</p>
                    <p className="font-semibold bg-white px-3 py-2 rounded-lg">📧 대표이메일: acbank@acbank.co.kr</p>
                  </div>
                </div>
              </div>

              {/* 첨부 서류 - A5 사이즈 */}
              <div className="mt-8 mb-8">
                <h3 className="text-xl font-bold mb-6 text-slate-800">첨부 서류</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-slate-700 mb-3 text-center">사업자등록증</h4>
                    <div className="flex justify-center">
                      <img 
                        src={businessRegistration} 
                        alt="아크뱅크 사업자등록증" 
                        className="w-full max-w-[420px] h-auto border border-gray-300 rounded shadow-sm"
                        style={{ aspectRatio: '148/210' }}
                      />
                    </div>
                  </div>
                  <div className="bg-white border-2 border-gray-200 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-slate-700 mb-3 text-center">통장사본</h4>
                    <div className="flex justify-center">
                      <img 
                        src={bankAccount} 
                        alt="아크뱅크 통장사본" 
                        className="w-full max-w-[420px] h-auto border border-gray-300 rounded shadow-sm"
                        style={{ aspectRatio: '148/210' }}
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
