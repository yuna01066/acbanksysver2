import React, { useState, useEffect, useRef } from 'react';
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
import QuoteAttachments, { QuotePdfAttachment } from "@/components/QuoteAttachments";
import EditableQuoteItem from "@/components/EditableQuoteItem";
import { generateAndUploadQuotePdf, createPdfAttachmentMetadata } from "@/utils/generateQuotePdf";
import { useAuth } from "@/contexts/AuthContext";
import { syncQuoteToPluuug, convertQuoteToPluuugFormat } from "@/utils/pluuugSync";

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
  pluuug_synced: boolean | null;
  pluuug_estimate_id: string | null;
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin, isModerator } = useAuth();

  useEffect(() => {
    if (id) {
      fetchQuote();
    }
  }, [id]);

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
      
      // PDF 자동 재생성
      if (user && quote) {
        toast.info('수정된 견적서의 PDF를 재생성하고 있습니다...');
        try {
          // fetchQuote 먼저 실행하여 화면 업데이트
          await fetchQuote();
          // 약간의 딜레이로 DOM 렌더링 대기
          await new Promise(resolve => setTimeout(resolve, 800));
          
          const pdfResult = await generateAndUploadQuotePdf(
            'saved-quote-print-container',
            user.id,
            quote.quote_number,
            recipientData.projectName || undefined
          );

          if (pdfResult.success && pdfResult.pdfUrl && pdfResult.pdfPath) {
            const pdfAttachment = createPdfAttachmentMetadata(
              quote.quote_number,
              pdfResult.pdfUrl,
              pdfResult.pdfPath
            );

            const updatedAttachments = [
              ...allAttachments.filter((a: any) => a?.type !== 'quote_pdf'),
              { ...pdfAttachment, type: 'quote_pdf', uploadedAt: new Date().toISOString() }
            ];

            await supabase
              .from('saved_quotes')
              .update({ attachments: updatedAttachments })
              .eq('id', id);

            setQuotePdf({
              name: pdfAttachment.name,
              path: pdfAttachment.path,
              size: pdfAttachment.size,
              url: pdfAttachment.url,
              uploadedAt: new Date().toISOString()
            });

            toast.success('PDF가 재생성되었습니다.');

            // Pluuug 동기화된 견적서이면 Pluuug도 업데이트
            if (quote.pluuug_synced && quote.pluuug_estimate_id) {
              toast.info('Pluuug 의뢰를 업데이트하고 있습니다...');
              try {
                const pluuugRecipient = {
                  projectName: recipientData.projectName,
                  companyName: recipientData.companyName,
                  contactPerson: recipientData.contactPerson,
                  phoneNumber: recipientData.phoneNumber,
                  email: recipientData.email,
                  deliveryAddress: recipientData.deliveryAddress,
                  clientMemo: recipientData.clientMemo,
                };

                const pluuugData = convertQuoteToPluuugFormat(
                  editedItems,
                  pluuugRecipient,
                  quote.quote_number,
                  roundedSubtotal,
                  newTax,
                  newTotal,
                  pdfResult.pdfUrl
                );

                const syncResult = await syncQuoteToPluuug(
                  pluuugData,
                  user.id,
                  pluuugRecipient,
                  null,
                  editedItems,
                  quote.pluuug_estimate_id
                );

                if (syncResult.success) {
                  toast.success('Pluuug 의뢰가 업데이트되었습니다!');
                } else {
                  toast.warning(`Pluuug 업데이트 실패: ${syncResult.error}`);
                }
              } catch (syncErr: any) {
                console.error('[Save Edit] Pluuug sync error:', syncErr);
                toast.warning('Pluuug 업데이트에 실패했습니다.');
              }
            }
          } else {
            console.warn('[Save Edit] PDF regeneration failed:', pdfResult.error);
            toast.warning('PDF 재생성에 실패했습니다.');
          }
        } catch (pdfErr: any) {
          console.error('[Save Edit] PDF regeneration error:', pdfErr);
        }
      }
      
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

  // PDF 자동 생성 및 저장
  const handleGeneratePdf = async () => {
    if (!user || !quote) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setIsGeneratingPdf(true);
    try {
      toast.info('PDF를 생성하고 있습니다...');
      
      const pdfResult = await generateAndUploadQuotePdf(
        'saved-quote-print-container',
        user.id,
        quote.quote_number,
        quote.project_name || undefined
      );

      if (pdfResult.success && pdfResult.pdfUrl && pdfResult.pdfPath) {
        // PDF 첨부파일 메타데이터 생성
        const pdfAttachment = createPdfAttachmentMetadata(
          quote.quote_number,
          pdfResult.pdfUrl,
          pdfResult.pdfPath
        );
        
        // 기존 attachments에서 quote_pdf 타입 제거 후 새로 추가
        const currentAttachments = Array.isArray(quote.attachments) ? quote.attachments : [];
        const newAttachments = [
          ...currentAttachments.filter((a: any) => a?.type !== 'quote_pdf'),
          { ...pdfAttachment, type: 'quote_pdf', uploadedAt: new Date().toISOString() }
        ];
        
        // DB 업데이트
        const { error } = await supabase
          .from('saved_quotes')
          .update({ attachments: newAttachments })
          .eq('id', quote.id);

        if (error) throw error;

        // 상태 업데이트
        setQuotePdf({
          name: pdfAttachment.name,
          path: pdfAttachment.path,
          size: pdfAttachment.size,
          url: pdfAttachment.url,
          uploadedAt: new Date().toISOString()
        });
        setAttachments(newAttachments);
        
        toast.success('PDF가 생성되어 저장되었습니다!');
        console.log('[PDF Generator] PDF saved successfully:', pdfResult.pdfUrl);
      } else {
        throw new Error(pdfResult.error || 'PDF 생성 실패');
      }
    } catch (error: any) {
      console.error('[PDF Generator] Error:', error);
      toast.error(`PDF 생성 실패: ${error.message}`);
    } finally {
      setIsGeneratingPdf(false);
    }
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
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-4xl mx-auto print-container" id="saved-quote-print-container" ref={printContainerRef}>
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
            
            {/* PDF 생성 버튼 - 중간관리자 이상만 */}
            {!quotePdf && (isAdmin || isModerator) && (
              <Button 
                variant="outline" 
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                className="flex items-center gap-2 ml-2"
                size="sm"
              >
                {isGeneratingPdf ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    PDF 생성 중...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    PDF 생성 및 저장
                  </>
                )}
              </Button>
            )}
            
            {quotePdf && (
              <div className="inline-flex items-center gap-2 ml-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-md text-sm">
                <FileText className="w-4 h-4" />
                <span>PDF 저장됨</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePdf}
                  disabled={isGeneratingPdf}
                  className="h-6 px-2 text-xs text-green-600 hover:text-green-800"
                >
                  {isGeneratingPdf ? '생성 중...' : '다시 생성'}
                </Button>
              </div>
            )}
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
                  견적 목록 ({isEditing ? editedItems.length : items.length}개) {isEditing ? '- 편집 모드' : '- 내부 관리용'}
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
                  {recipientData.issuerName && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="font-semibold text-blue-900 mb-2">담당자</p>
                      <div className="space-y-1">
                        <p className="font-medium">👤 {recipientData.issuerName}</p>
                        {recipientData.issuerPhone && <p className="font-medium">📞 {recipientData.issuerPhone}</p>}
                        {recipientData.issuerEmail && <p className="font-medium">📧 {recipientData.issuerEmail}</p>}
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

              {/* 클라이언트 요청사항 및 첨부 서류 */}
              <div className="mt-8 mb-8 space-y-8">
                {/* 클라이언트 요청사항 - 사업자등록증 위에 표시 */}
                {(quote.recipient_memo || (quote.attachments && Array.isArray(quote.attachments) && quote.attachments.length > 0)) && (
                  <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 border-2 border-blue-300 rounded-xl p-8 shadow-lg">
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-blue-300">
                      <div className="bg-blue-600 p-3 rounded-lg shadow-md">
                        <FileText className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-blue-900">
                        클라이언트 요청사항
                      </h3>
                    </div>
                    
                    {/* 요청사항 내용 */}
                    {quote.recipient_memo && (
                      <div className="mb-6">
                        <div className="bg-white p-6 rounded-lg border-2 border-blue-200 shadow-sm">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="bg-blue-100 p-2 rounded-lg">
                              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h4 className="font-bold text-gray-900 mb-2 text-lg">요청 내용</h4>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200">
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
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
