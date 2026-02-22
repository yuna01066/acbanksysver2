import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, Save, Edit, X, Download, Users, Building2, Home, Calculator, FileText, Calendar as CalendarIcon, FolderOpen, ExternalLink } from "lucide-react";
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
import QuoteAttachments, { QuotePdfAttachment } from "@/components/QuoteAttachments";
import EditableQuoteItem from "@/components/EditableQuoteItem";
import { useAuth } from "@/contexts/AuthContext";
import QuoteMemoPanel from "@/components/QuoteMemoPanel";
import QuoteMaterialOrders from "@/components/QuoteMaterialOrders";

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
  attachments: any;
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
  const [attachments, setAttachments] = useState<any[]>([]);
  const [editedItems, setEditedItems] = useState<any[]>([]);
  const [quotePdf, setQuotePdf] = useState<QuotePdfAttachment | null>(null);
  const [linkedProject, setLinkedProject] = useState<{ id: string; name: string; payment_status: string | null } | null>(null);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin, isModerator } = useAuth();

  useEffect(() => {
    if (id) {
      fetchQuote();
      fetchLinkedProject();
    }
  }, [id]);

  const fetchLinkedProject = async () => {
    if (!id) return;
    try {
      const { data: quoteData } = await supabase
        .from('saved_quotes')
        .select('project_id')
        .eq('id', id)
        .single();

      if (quoteData?.project_id) {
        const { data: project } = await supabase
          .from('projects')
          .select('id, name, payment_status')
          .eq('id', quoteData.project_id)
          .single();
        
        if (project) setLinkedProject(project);
      } else {
        setLinkedProject(null);
      }
    } catch {
      setLinkedProject(null);
    }
  };

  // PDF 파일명 설정
  useEffect(() => {
    if (quote) {
      const parts = [quote.quote_number, quote.project_name, quote.recipient_company].filter(Boolean);
      const fileName = parts.length > 0 ? parts.join('-') : '견적서';
      document.title = fileName;
    }
    
    return () => {
      document.title = 'Lovable - Build for the web';
    };
  }, [quote]);

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
      setAttachments(Array.isArray(formattedData.attachments) ? formattedData.attachments : []);
      setEditedItems(Array.isArray(formattedData.items) ? formattedData.items : []);
      
      // 견적서 PDF 정보 로드 (attachments 배열에서 quote_pdf 타입 찾기)
      const attachmentsArray = Array.isArray(formattedData.attachments) ? formattedData.attachments : [];
      const savedQuotePdf = attachmentsArray.find((a: any) => 
        typeof a === 'object' && a !== null && a.type === 'quote_pdf'
      ) as { name: string; path: string; size: number; url: string; uploadedAt?: string; type: string } | undefined;
      if (savedQuotePdf) {
        setQuotePdf({
          name: savedQuotePdf.name,
          path: savedQuotePdf.path,
          size: savedQuotePdf.size,
          url: savedQuotePdf.url,
          uploadedAt: savedQuotePdf.uploadedAt || ''
        });
      }
      
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
      // 수정된 항목들의 총 금액 재계산
      const newSubtotal = editedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
      const roundedSubtotal = Math.round(newSubtotal / 100) * 100;
      const newTax = Math.round(roundedSubtotal * 0.1);
      const newTotal = roundedSubtotal + newTax;

      // 첨부 파일 목록 구성 (PDF 정보 + 기존 첨부 파일)
      const allAttachments = [
        // 견적서 PDF (type: 'quote_pdf'로 구분)
        ...(quotePdf ? [{
          ...quotePdf,
          type: 'quote_pdf'
        }] : []),
        // 기존 첨부 파일 (quote_pdf가 아닌 것들만)
        ...attachments.filter((a: any) => a.type !== 'quote_pdf')
      ];

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
          issuer_phone: recipientData.issuerPhone,
          attachments: allAttachments,
          items: editedItems,
          subtotal: roundedSubtotal,
          tax: newTax,
          total: newTotal
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

  const handleItemUpdate = (index: number, updatedItem: any) => {
    const newItems = [...editedItems];
    newItems[index] = updatedItem;
    setEditedItems(newItems);
  };

  const handleItemRemove = (index: number) => {
    if (editedItems.length <= 1) {
      toast.error('최소 1개의 견적 항목이 필요합니다.');
      return;
    }
    const newItems = editedItems.filter((_, i) => i !== index);
    setEditedItems(newItems);
  };

  const handleAttachmentsChange = (newAttachments: any[]) => {
    setAttachments(newAttachments);
  };

  const handlePrintPDF = () => {
    window.print();
  };



  const toggleViewMode = () => {
    setViewMode(prev => prev === 'internal' ? 'customer' : 'internal');
  };

  if (loading || !quote) {
    return (
      <div className="min-h-screen bg-[hsl(220,10%,95%)] flex items-center justify-center">
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
  
  // 편집 모드일 때는 editedItems 기반으로 계산, 아닐 때는 저장된 값 사용
  const calculatedSubtotal = isEditing 
    ? Math.round(editedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0) / 100) * 100
    : Math.round(quote.subtotal);
  const calculatedTax = isEditing 
    ? Math.round(calculatedSubtotal * 0.1)
    : Math.round(quote.tax);
  const calculatedTotal = isEditing 
    ? calculatedSubtotal + calculatedTax
    : Math.round(quote.total);
  
  const subtotal = calculatedSubtotal;
  const tax = calculatedTax;
  const totalWithTax = calculatedTotal;

  return (
    <>
      <PrintStyles quoteNumber={quote.quote_number} projectName={quote.project_name} companyName={quote.recipient_company} isInternal={viewMode === 'internal'} />
      <div className="min-h-screen bg-[hsl(220,10%,95%)] p-4 print-layout-wrapper">
        <div className="w-full max-w-6xl mx-auto flex gap-6 print-flex-container">
        <div className="flex-1 min-w-0 max-w-4xl print-container" id="saved-quote-print-container" ref={printContainerRef}>
          <div className="mb-6 print:hidden flex justify-between items-center">
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

          <QuoteSummaryHeader 
            onClearQuotes={() => {}}
            onPrintPDF={handlePrintPDF}
            currentDate={currentDate}
            quoteNumber={quote.quote_number}
            isEditMode={isEditing}
            onEdit={() => setIsEditing(true)}
            onSaveEdit={handleSaveEdit}
            onCancelEdit={() => setIsEditing(false)}
            onToggleViewMode={toggleViewMode}
            viewMode={viewMode}
            showSavedQuoteActions={true}
          />

          <Card className="shadow-lg border border-gray-300 rounded-xl bg-white quote-main-card [backdrop-filter:none] [-webkit-backdrop-filter:none] [background:white]" style={{ overflow: 'visible', fontFamily: "'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont, sans-serif" }}>
            <CardContent className="p-6 print:p-4" style={{ overflow: 'visible' }}>
              {/* 견적 요약 정보 - 내부용에서만 출력 */}
              {viewMode !== 'customer' && (
              <div className="mb-6 rounded-lg bg-[hsl(210,50%,94%)] border border-[hsl(210,40%,82%)] print-summary quote-section">
                <div className="p-5">
                  <h2 className="text-[17px] font-bold text-black mb-4 pb-2 border-b border-[hsl(210,40%,75%)]">견적 요약</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
                        <p className="text-[12px] font-semibold text-gray-500 mb-1">견적번호</p>
                        <p className="text-[14px] font-bold text-black">{quote.quote_number}</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
                        <p className="text-[12px] font-semibold text-gray-500 mb-1">작성일</p>
                        <p className="text-[14px] font-bold text-black">{currentDate}</p>
                      </div>
                    </div>
                    
                    <div className="bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)] flex flex-col justify-center">
                      <p className="text-[12px] font-semibold text-gray-500 mb-1">견적 항목 수</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-2xl font-black text-black">{items.length}</p>
                        <p className="text-[14px] font-medium text-black">개</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 bg-white rounded-lg p-3 border border-[hsl(210,30%,90%)]">
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <p className="text-[12px] font-semibold text-gray-500">공급가</p>
                        <p className="text-[14px] font-bold text-black">{subtotal.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pb-2 border-b border-gray-200">
                        <p className="text-[12px] font-semibold text-gray-500">부가세</p>
                        <p className="text-[14px] font-bold text-black">{tax.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <p className="text-[13px] font-bold text-black">최종 금액</p>
                        <p className="text-[17px] font-black text-black">{totalWithTax.toLocaleString()}원</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}

              {/* Edit Form */}
              {isEditing && (
                <div className="mb-8">
                  <RecipientInfoForm
                    recipientData={recipientData}
                    onChange={handleRecipientChange}
                    onBulkChange={handleBulkRecipientChange}
                    showClientMemo={true}
                  />
                  
                  {/* 첨부 파일 수정 */}
                  <div className="mt-6">
                    <QuoteAttachments
                      attachments={attachments}
                      onAttachmentsChange={handleAttachmentsChange}
                      readOnly={false}
                      quoteId={id}
                      quoteNumber={quote.quote_number}
                      quotePdf={quotePdf}
                      onQuotePdfChange={setQuotePdf}
                      showQuotePdfSection={true}
                    />
                  </div>
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 quote-section">
                {/* 견적서 수신 */}
                <div className="bg-[hsl(145,45%,92%)] rounded-lg border border-[hsl(145,35%,80%)] p-5 space-y-3">
                  <h3 className="text-[17px] font-bold text-black border-b-2 border-[hsl(145,40%,60%)] pb-2">견적서 수신</h3>
                  
                  <div>
                    <h4 className="font-bold text-black mb-2 text-[14px]">프로젝트 정보</h4>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">프로젝트명</span><span className="font-semibold text-black">{quote.project_name || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적번호</span><span className="font-semibold text-black">{quote.quote_number}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적일자</span><span className="font-semibold text-black">{quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">유효기간</span><span className="font-semibold text-black">{quote.valid_until || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">납기</span><span className="font-semibold text-black">{quote.delivery_period || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">지불 조건</span><span className="font-semibold text-black">{quote.payment_condition || '-'}</span></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[hsl(145,20%,85%)]">
                    <h4 className="font-bold text-black mb-2 text-[14px]">담당자 및 납기 정보</h4>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">회사명</span><span className="font-semibold text-black">{quote.recipient_company || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold text-black">{quote.recipient_name || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">{quote.recipient_phone || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">{quote.recipient_email || '-'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">납기 희망일</span><span className="font-semibold text-black">{quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '미정'}</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">현장 주소</span><span className="font-semibold text-black">{quote.recipient_address || '-'}</span></div>
                    </div>
                  </div>
                </div>

                {/* 견적서 발신 */}
                <div className="bg-[hsl(215,50%,92%)] rounded-lg border border-[hsl(215,40%,80%)] p-5 space-y-3">
                  <h3 className="text-[17px] font-bold text-black border-b-2 border-[hsl(215,45%,60%)] pb-2">견적서 발신</h3>
                  
                  <div>
                    <h4 className="font-bold text-black mb-2 text-[14px]">회사 정보</h4>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">상호</span><span className="font-semibold text-black">(주)아크뱅크</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">사업자번호</span><span className="font-semibold text-black">299-87-02991</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">웹사이트</span><span className="font-semibold text-black">acbank.co.kr</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">주소</span><span className="font-semibold text-black leading-relaxed">경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">업태</span><span className="font-semibold text-black">제조업 / 도매 및 소매업</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">종목</span><span className="font-semibold text-black">아크릴 가공 외</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">070-7666-9828</span></div>
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">acbank@acbank.co.kr</span></div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[hsl(215,25%,85%)]">
                    <h4 className="font-bold text-black mb-2 text-[14px]">담당자 정보</h4>
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold text-black">{recipientData.issuerName || '작성'}</span></div>
                      {recipientData.issuerEmail && <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">{recipientData.issuerEmail}</span></div>}
                      {recipientData.issuerPhone && <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">{recipientData.issuerPhone}</span></div>}
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-[hsl(210,60%,90%)] rounded-lg border border-[hsl(210,50%,78%)]">
                    <h4 className="font-bold text-[hsl(215,60%,22%)] mb-1 text-[13px]">입금 계좌</h4>
                    <div className="text-[14px] font-bold text-[hsl(215,60%,18%)]">
                      신한은행 140-014-544315 (주)아크뱅크
                    </div>
                  </div>
                </div>
              </div>


              {/* 견적 목록 */}
              <div className="mb-6 quote-section">
                <h3 className="text-[17px] font-bold text-black mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({isEditing ? editedItems.length : items.length}개) {isEditing ? '- 편집 모드' : viewMode === 'customer' ? '' : '- 내부 관리용'}
                </h3>
                <div className="space-y-4">
                  {isEditing ? (
                    editedItems.map((item: any, index: number) => (
                      <EditableQuoteItem
                        key={index}
                        item={item}
                        index={index}
                        onUpdate={handleItemUpdate}
                        onRemove={handleItemRemove}
                        quoteId={id}
                      />
                    ))
                  ) : (
                    items.map((item: any, index: number) => (
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
                    ))
                  )}
                </div>
              </div>

              {/* 견적 총 합계 */}
              <div className="mb-6 rounded-lg bg-[hsl(220,30%,94%)] border border-[hsl(220,25%,82%)] print-total quote-section">
                <div className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-[14px] font-bold text-black bg-white px-4 py-2 rounded-lg border border-gray-200">총 견적 금액</h2>
                    <div className="flex flex-col items-end gap-1.5 flex-1">
                      <div className="flex items-center gap-5">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-gray-500">소계 (부가세 별도)</span>
                          <span className="text-[14px] font-bold text-black">{subtotal.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-semibold text-gray-500">부가세 (10%)</span>
                          <span className="text-[14px] font-bold text-black">{tax.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg">
                          <span className="text-[13px] font-bold text-white">총 합계</span>
                          <span className="text-[18px] font-black text-white">{totalWithTax.toLocaleString()}원</span>
                        </div>
                      </div>
                      <p className="text-[12px] text-gray-500">* 배송비는 별도 입니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 특이사항 및 상담내용 */}
              {viewMode !== 'customer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 quote-section">
                <div className="bg-[hsl(45,55%,92%)] rounded-lg border border-[hsl(45,40%,78%)] p-4">
                  <h3 className="text-[14px] font-bold mb-2 text-black">특 이 사 항 :</h3>
                  <ul className="text-[13px] space-y-1 text-black">
                    <li>- 견적서의 유효기간은 발행일로부터 14일 입니다.</li>
                    <li>- 운송비 및 부가세는 별도 입니다.</li>
                  </ul>
                </div>
                
                <div className="bg-[hsl(45,55%,92%)] rounded-lg border border-[hsl(45,40%,78%)] p-4">
                  <h3 className="text-[14px] font-bold mb-2 text-black">상 담 내 용 :</h3>
                  <div className="text-[13px] space-y-1 text-black">
                    <p>안녕하세요</p>
                    <p>견적 문의해 주셔서 감사합니다.</p>
                    <p>상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.</p>
                  </div>
                </div>
              </div>
              )}

              {/* 연락처 정보 */}
              <div className="mb-6 p-5 bg-[hsl(200,45%,92%)] border border-[hsl(200,40%,78%)] rounded-lg quote-section">
                <h4 className="font-bold text-black mb-3 text-[14px]">문의 및 주문</h4>
                <div className="text-[13px] space-y-2">
                  <p className="text-black">견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                  
                  {recipientData.issuerName && (
                    <div className="bg-white p-3 rounded-lg border border-[hsl(200,25%,88%)]">
                      <p className="font-bold text-gray-500 mb-1.5 text-[12px] uppercase tracking-wider">담당자</p>
                      <div className="space-y-1 text-[13px] font-semibold text-black">
                        <p>👤 {recipientData.issuerName}</p>
                        {recipientData.issuerPhone && <p>📞 {recipientData.issuerPhone}</p>}
                        {recipientData.issuerEmail && <p>📧 {recipientData.issuerEmail}</p>}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <p className="font-semibold bg-white px-3 py-2 rounded-lg border border-[hsl(200,25%,88%)] text-black text-[13px]">📞 대표전화: 070-7537-3680</p>
                    <p className="font-semibold bg-white px-3 py-2 rounded-lg border border-[hsl(200,25%,88%)] text-black text-[13px]">📧 대표이메일: acbank@acbank.co.kr</p>
                  </div>
                </div>
              </div>

              {/* 클라이언트 요청사항 - 내부용에서만 */}
              {viewMode !== 'customer' && (
              <div className="mb-6 space-y-5">
                {(quote.recipient_memo || (quote.attachments && Array.isArray(quote.attachments) && quote.attachments.length > 0)) && (
                  <div className="bg-[hsl(30,50%,92%)] border border-[hsl(30,40%,78%)] rounded-lg p-5 quote-section">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[hsl(30,35%,75%)]">
                      <FileText className="w-5 h-5 text-black" />
                      <h3 className="text-[17px] font-bold text-black">클라이언트 요청사항</h3>
                    </div>
                    
                    {quote.recipient_memo && (
                      <div className="mb-4">
                        <h4 className="font-bold text-black mb-2 text-[14px]">요청 내용</h4>
                        <p className="text-[13px] text-black whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-[hsl(30,25%,88%)]">
                          {quote.recipient_memo}
                        </p>
                      </div>
                    )}
                    
                    {quote.attachments && Array.isArray(quote.attachments) && quote.attachments.length > 0 && (
                      <QuoteAttachments
                        attachments={attachments}
                        onAttachmentsChange={() => {}}
                        readOnly={true}
                        quoteId={id}
                      />
                    )}
                  </div>
                )}
              </div>
              )}

              {/* 첨부 서류 */}
              <div className="mb-6 quote-section">
                <h3 className="text-[17px] font-bold mb-4 text-black">첨부 서류</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-bold text-black mb-3 text-center text-[13px]">사업자등록증</h4>
                    <div className="flex justify-center">
                      <img 
                        src={businessRegistration} 
                        alt="아크뱅크 사업자등록증" 
                        className="w-full max-w-[380px] h-auto border border-gray-200 rounded"
                        style={{ aspectRatio: '148/210' }}
                      />
                    </div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-bold text-black mb-3 text-center text-[13px]">통장사본</h4>
                    <div className="flex justify-center">
                      <img 
                        src={bankAccount} 
                        alt="아크뱅크 통장사본" 
                        className="w-full max-w-[380px] h-auto border border-gray-200 rounded"
                        style={{ aspectRatio: '148/210' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        {/* 우측 메모 패널 */}
        <div className="w-[300px] shrink-0 print:hidden sticky top-4 self-start hidden lg:block space-y-4 print-side-panel">
          {/* 연결된 프로젝트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                연결된 프로젝트
              </CardTitle>
            </CardHeader>
            <CardContent>
              {linkedProject ? (
                <button
                  onClick={() => navigate(`/projects?id=${linkedProject.id}`)}
                  className="w-full text-left p-3 rounded-lg border hover:bg-accent transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{linkedProject.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </div>
                  {linkedProject.payment_status && (
                    <Badge variant="outline" className="mt-1.5 text-xs">
                      {linkedProject.payment_status}
                    </Badge>
                  )}
                </button>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-2">연결된 프로젝트가 없습니다</p>
              )}
            </CardContent>
          </Card>
          {/* 원판 발주 */}
          {id && <QuoteMaterialOrders quoteId={id} />}
          {id && <QuoteMemoPanel quoteId={id} />}
        </div>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
