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

          <Card className="shadow-lg border-0 rounded-xl bg-white" style={{ overflow: 'visible' }}>
            <CardContent className="p-8 print:p-4" style={{ overflow: 'visible' }}>
              {/* 견적 요약 정보 - 내부용에서만 출력 */}
              {viewMode !== 'customer' && (
              <div className="mb-8 rounded-xl bg-white shadow-sm border border-[hsl(220,12%,88%)] print-summary">
                <div className="p-6">
                  <div className="flex items-center gap-2 mb-5 pb-3 border-b border-[hsl(220,12%,88%)]">
                    <h2 className="text-lg font-bold text-[hsl(0,0%,0%)]">견적 요약</h2>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* 견적 기본 정보 */}
                    <div className="space-y-3">
                      <div className="bg-[hsl(220,12%,96%)] rounded-xl p-4 border border-[hsl(220,12%,90%)]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-black mb-1.5">견적번호</p>
                        <p className="text-[15px] font-bold text-black">{quote.quote_number}</p>
                      </div>
                      <div className="bg-[hsl(220,12%,96%)] rounded-xl p-4 border border-[hsl(220,12%,90%)]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-black mb-1.5">작성일</p>
                        <p className="text-[15px] font-bold text-[hsl(0,0%,0%)]">{currentDate}</p>
                      </div>
                    </div>
                    
                    {/* 견적 항목 */}
                    <div className="bg-[hsl(220,12%,96%)] rounded-xl p-4 border border-[hsl(220,12%,90%)] flex flex-col justify-center">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-black mb-1.5">견적 항목 수</p>
                      <div className="flex items-baseline gap-1">
                        <p className="text-3xl font-black text-[hsl(0,0%,0%)]">{items.length}</p>
                        <p className="text-sm font-medium text-black">개</p>
                      </div>
                    </div>
                    
                    {/* 금액 정보 */}
                    <div className="space-y-2.5 bg-[hsl(220,12%,96%)] rounded-xl p-4 border border-[hsl(220,12%,90%)]">
                      <div className="flex justify-between items-center pb-2.5 border-b border-[hsl(220,12%,88%)]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-black">공급가</p>
                        <p className="text-[14px] font-bold text-[hsl(0,0%,0%)]">{subtotal.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pb-2.5 border-b border-[hsl(220,12%,88%)]">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-black">부가세</p>
                        <p className="text-[14px] font-bold text-[hsl(0,0%,0%)]">{tax.toLocaleString()}원</p>
                      </div>
                      <div className="flex justify-between items-center pt-1">
                        <p className="text-[13px] font-bold text-[hsl(0,0%,0%)]">최종 금액</p>
                        <p className="text-[17px] font-black text-[hsl(0,0%,0%)]">{totalWithTax.toLocaleString()}원</p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 견적서 수신 */}
                <div className="space-y-4">
                  <h3 className="text-[20px] font-bold border-b-2 border-black pb-2 text-gray-900">견적서 수신</h3>
                  
                  {/* 프로젝트 기본 정보 */}
                  <div className="p-5 bg-[hsl(220,12%,97%)] rounded-xl border border-[hsl(220,12%,90%)]">
                    <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-[15px]">프로젝트 정보</h4>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">프로젝트명</span><span className="font-bold text-black">{quote.project_name || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">견적번호</span><span className="font-bold text-black">{quote.quote_number}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">견적일자</span><span className="font-bold text-black">{quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">유효기간</span><span className="font-bold text-black">{quote.valid_until || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">납기</span><span className="font-bold text-black">{quote.delivery_period || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">지불 조건</span><span className="font-bold text-black">{quote.payment_condition || '-'}</span></div>
                    </div>
                  </div>

                  {/* 담당자 및 납기 정보 */}
                  <div className="p-5 bg-[hsl(220,12%,97%)] rounded-xl border border-[hsl(220,12%,90%)]">
                    <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-[15px]">담당자 및 납기 정보</h4>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">회사명</span><span className="font-bold text-black">{quote.recipient_company || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">담당자</span><span className="font-bold text-black">{quote.recipient_name || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">연락처</span><span className="font-bold text-black">{quote.recipient_phone || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">이메일</span><span className="font-bold text-black">{quote.recipient_email || '-'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">납기 희망일</span><span className="font-bold text-black">{quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '미정'}</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">현장 주소</span><span className="font-bold text-black">{quote.recipient_address || '-'}</span></div>
                    </div>
                  </div>
                </div>

                {/* 견적서 발신 */}
                <div className="space-y-4">
                  <h3 className="text-[20px] font-bold border-b-2 border-black pb-2 text-gray-900">견적서 발신</h3>
                  
                  {/* 회사 기본 정보 */}
                  <div className="p-5 bg-[hsl(220,12%,97%)] rounded-xl border border-[hsl(220,12%,90%)]">
                    <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-[15px]">회사 정보</h4>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">상호</span><span className="font-bold text-black">(주)아크뱅크</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">사업자번호</span><span className="font-bold text-black">299-87-02991</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">웹사이트</span><span className="font-bold text-black">acbank.co.kr</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">주소</span><span className="font-bold text-black leading-relaxed">경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호 (동행빌딩)</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">업태</span><span className="font-bold text-black">제조업 / 도매 및 소매업</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">종목</span><span className="font-bold text-black">아크릴 가공 외</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">연락처</span><span className="font-bold text-black">070-7666-9828</span></div>
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">이메일</span><span className="font-bold text-black">acbank@acbank.co.kr</span></div>
                    </div>
                  </div>

                  {/* 담당자 정보 */}
                  <div className="p-5 bg-[hsl(220,12%,97%)] rounded-xl border border-[hsl(220,12%,90%)]">
                    <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-[15px]">담당자 정보</h4>
                    <div className="space-y-2.5 text-[13px]">
                      <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">담당자</span><span className="font-bold text-black">{recipientData.issuerName || '작성'}</span></div>
                      {recipientData.issuerEmail && <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">이메일</span><span className="font-bold text-black">{recipientData.issuerEmail}</span></div>}
                      {recipientData.issuerPhone && <div className="flex"><span className="text-black w-24 shrink-0 font-semibold">연락처</span><span className="font-bold text-black">{recipientData.issuerPhone}</span></div>}
                    </div>
                  </div>
                  
                  <div className="p-5 bg-[hsl(210,80%,95%)] rounded-xl border border-[hsl(210,70%,80%)]">
                    <h4 className="font-bold text-[hsl(220,60%,20%)] mb-2 text-[13px]">입금 계좌</h4>
                    <div className="text-[14px] font-bold text-[hsl(220,50%,15%)]">
                      <div>신한은행 140-014-544315 (주)아크뱅크</div>
                    </div>
                  </div>
                </div>
              </div>


              {/* 견적 목록 */}
              <div className="mb-8">
                <h3 className="text-lg font-bold text-[hsl(0,0%,0%)] mb-6 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({isEditing ? editedItems.length : items.length}개) {isEditing ? '- 편집 모드' : viewMode === 'customer' ? '' : '- 내부 관리용'}
                </h3>
                <div className="space-y-6">
                  {isEditing ? (
                    // 편집 모드: EditableQuoteItem 사용
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
                    // 읽기 모드: 기존 QuoteCard/CustomerQuoteCard 사용
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
              <div className="mb-8 rounded-xl bg-white shadow-sm border border-[hsl(220,12%,88%)] print-total">
                <div className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-[15px] font-bold text-[hsl(0,0%,0%)] bg-[hsl(220,12%,96%)] px-6 py-2.5 rounded-xl border border-[hsl(220,12%,90%)]">총 견적 금액</h2>
                    <div className="flex flex-col items-end gap-2 flex-1">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-black">소계 (부가세 별도)</span>
                          <span className="text-[14px] font-bold text-[hsl(0,0%,0%)]">{subtotal.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-black">부가세 (10%)</span>
                          <span className="text-[14px] font-bold text-[hsl(0,0%,0%)]">{tax.toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-3 px-5 py-2.5 bg-[hsl(220,14%,16%)] rounded-xl">
                          <span className="text-[13px] font-bold text-white">총 합계</span>
                          <span className="text-xl font-black text-white">{totalWithTax.toLocaleString()}원</span>
                        </div>
                      </div>
                      <p className="text-[11px] font-medium text-black">* 배송비는 별도 입니다.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 특이사항 및 상담내용 - 내부용에서만 출력 */}
              {viewMode !== 'customer' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-[15px] font-bold mb-3 text-[hsl(0,0%,0%)]">특 이 사 항 :</h3>
                  <ul className="text-[13px] space-y-1.5 text-black">
                    <li>- 견적서의 유효기간은 발행일로부터 14일 입니다.</li>
                    <li>- 운송비 및 부가세는 별도 입니다.</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="text-[15px] font-bold mb-3 text-[hsl(0,0%,0%)]">상 담 내 용 :</h3>
                  <div className="text-[13px] space-y-1.5 text-black">
                    <p>안녕하세요</p>
                    <p>견적 문의해 주셔서 감사합니다.</p>
                    <p>상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.</p>
                  </div>
                </div>
              </div>
              )}

              {/* 연락처 정보 */}
              <div className="mt-8 p-6 bg-[hsl(215,50%,96%)] border border-[hsl(215,40%,85%)] rounded-xl">
                <h4 className="font-bold text-[hsl(0,0%,0%)] mb-4 text-[15px]">문의 및 주문</h4>
                <div className="text-[13px] space-y-3">
                  <p className="mb-3 text-black">견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                  
                  {/* 담당자 정보 */}
                  {recipientData.issuerName && (
                    <div className="bg-white p-4 rounded-xl border border-[hsl(215,40%,88%)]">
                      <p className="font-bold text-black mb-2 text-[12px] uppercase tracking-wider">담당자</p>
                      <div className="space-y-1.5 text-[13px] font-bold text-black">
                        <p>👤 {recipientData.issuerName}</p>
                        {recipientData.issuerPhone && <p>📞 {recipientData.issuerPhone}</p>}
                        {recipientData.issuerEmail && <p>📧 {recipientData.issuerEmail}</p>}
                      </div>
                    </div>
                  )}
                  
                  {/* 회사 대표 연락처 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <p className="font-bold bg-white px-4 py-3 rounded-xl border border-[hsl(215,40%,88%)] text-black">📞 대표전화: 070-7537-3680</p>
                    <p className="font-bold bg-white px-4 py-3 rounded-xl border border-[hsl(215,40%,88%)] text-black">📧 대표이메일: acbank@acbank.co.kr</p>
                  </div>
                </div>
              </div>

              {/* 클라이언트 요청사항 및 첨부 서류 - 내부용에서만 출력 */}
              {viewMode !== 'customer' && (
              <div className="mt-8 mb-8 space-y-8">
                {/* 클라이언트 요청사항 - 사업자등록증 위에 표시 */}
                {(quote.recipient_memo || (quote.attachments && Array.isArray(quote.attachments) && quote.attachments.length > 0)) && (
                  <div className="bg-[hsl(220,12%,97%)] border border-[hsl(220,12%,88%)] rounded-xl p-8">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[hsl(220,12%,88%)]">
                      <div className="bg-[hsl(220,14%,16%)] p-3 rounded-xl">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-[hsl(0,0%,0%)]">
                        클라이언트 요청사항
                      </h3>
                    </div>
                    
                    {/* 요청사항 내용 */}
                    {quote.recipient_memo && (
                      <div className="mb-6">
                        <div className="bg-white p-6 rounded-xl border border-[hsl(220,12%,90%)]">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="bg-[hsl(220,12%,93%)] p-2 rounded-lg">
                              <svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-[hsl(0,0%,0%)] mb-2 text-[15px]">요청 내용</h4>
                              <p className="text-[13px] text-black whitespace-pre-wrap leading-relaxed bg-[hsl(220,12%,96%)] p-4 rounded-xl border border-[hsl(220,12%,90%)]">
                                {quote.recipient_memo}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 첨부 파일 - 다운로드 기능 포함 */}
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

                {/* 첨부 서류 - A5 사이즈 */}
                <div>
                  <h3 className="text-lg font-bold mb-6 text-[hsl(0,0%,0%)]">첨부 서류</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white border border-[hsl(220,12%,88%)] rounded-xl p-5">
                      <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-center text-[13px]">사업자등록증</h4>
                      <div className="flex justify-center">
                        <img 
                          src={businessRegistration} 
                          alt="아크뱅크 사업자등록증" 
                          className="w-full max-w-[420px] h-auto border border-[hsl(220,12%,88%)] rounded-lg"
                          style={{ aspectRatio: '148/210' }}
                        />
                      </div>
                    </div>
                    <div className="bg-white border border-[hsl(220,12%,88%)] rounded-xl p-5">
                      <h4 className="font-bold text-[hsl(0,0%,0%)] mb-3 text-center text-[13px]">통장사본</h4>
                      <div className="flex justify-center">
                        <img 
                          src={bankAccount} 
                          alt="아크뱅크 통장사본" 
                          className="w-full max-w-[420px] h-auto border border-[hsl(220,12%,88%)] rounded-lg"
                          style={{ aspectRatio: '148/210' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              )}
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
