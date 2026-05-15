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
import RecipientInfoForm from "@/components/RecipientInfoForm";
import { QuoteRecipient } from "@/contexts/QuoteContext";
import QuoteAttachments, { QuotePdfAttachment } from "@/components/QuoteAttachments";
import EditableQuoteItem from "@/components/EditableQuoteItem";
import { useAuth } from "@/contexts/AuthContext";
import QuoteMemoPanel from "@/components/QuoteMemoPanel";
import QuoteMaterialOrders from "@/components/QuoteMaterialOrders";
import QuoteSummarySection from "@/components/quote-detail/QuoteSummarySection";
import QuoteCompanyInfoSection from "@/components/quote-detail/QuoteCompanyInfoSection";
import QuoteTotalSection from "@/components/quote-detail/QuoteTotalSection";
import QuoteNotesSection from "@/components/quote-detail/QuoteNotesSection";
import QuoteContactSection from "@/components/quote-detail/QuoteContactSection";
import QuoteClientRequestSection from "@/components/quote-detail/QuoteClientRequestSection";
import QuoteDocumentsSection from "@/components/quote-detail/QuoteDocumentsSection";
import QuoteVersionHistory from "@/components/quote-detail/QuoteVersionHistory";
import QuoteStageTimeline from "@/components/quote-detail/QuoteStageTimeline";
import { useQuoteVersions } from "@/hooks/useQuoteVersions";

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
  pricing_version_id?: string | null;
  calculation_snapshot?: any;
  subtotal: number;
  tax: number;
  total: number;
}

const SavedQuoteDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [manualTotalOverride, setManualTotalOverride] = useState<{ subtotal: number; tax: number; total: number } | null>(null);
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
  const [quoteDefaults, setQuoteDefaults] = useState({
    quote_bank_info: '신한은행 140-014-544315 (주)아크뱅크',
    quote_notes: '- 견적서의 유효기간은 발행일로부터 14일 입니다.\n- 운송비 및 부가세는 별도 입니다.',
    quote_consultation: '안녕하세요\n견적 문의해 주셔서 감사합니다.\n상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.',
    quote_contact_phone: '070-7537-3680',
    quote_contact_email: 'acbank@acbank.co.kr',
    quote_contact_message: '견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.',
  });
  const [companyInfo, setCompanyInfo] = useState({
    company_name: '(주)아크뱅크',
    business_number: '299-87-02991',
    website: 'acbank.co.kr',
    address: '경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호',
    detail_address: '',
    business_type: '제조업 / 도매 및 소매업',
    industry: '아크릴 가공 외',
    phone: '070-7666-9828',
    email: 'acbank@acbank.co.kr',
  });
  const printContainerRef = useRef<HTMLDivElement>(null);
  const { user, isAdmin, isModerator } = useAuth();
  const { saveVersion } = useQuoteVersions(id);

  useEffect(() => {
    if (id) {
      fetchQuote();
      fetchLinkedProject();
    }
    fetchQuoteDefaults();
  }, [id]);

  const fetchQuoteDefaults = async () => {
    const { data } = await supabase
      .from('company_info')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (data) {
      const d = data as any;
      setQuoteDefaults(prev => ({
        quote_bank_info: d.quote_bank_info || prev.quote_bank_info,
        quote_notes: d.quote_notes || prev.quote_notes,
        quote_consultation: d.quote_consultation || prev.quote_consultation,
        quote_contact_phone: d.quote_contact_phone || prev.quote_contact_phone,
        quote_contact_email: d.quote_contact_email || prev.quote_contact_email,
        quote_contact_message: d.quote_contact_message || prev.quote_contact_message,
      }));
      setCompanyInfo(prev => ({
        company_name: d.company_name || prev.company_name,
        business_number: d.business_number || prev.business_number,
        website: d.website || prev.website,
        address: d.address || prev.address,
        detail_address: d.detail_address || '',
        business_type: d.business_type || prev.business_type,
        industry: d.industry || prev.industry,
        phone: d.phone || prev.phone,
        email: d.email || prev.email,
      }));
    }
  };

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
        issuerId: formattedData.issuer_id || undefined,
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
    setRecipientData(prev => {
      const updated = { ...prev, [field]: value };
      // 견적일자 변경 시 유효기간 자동 재계산
      if (field === 'quoteDate' && value instanceof Date) {
        const validDate = new Date(value);
        validDate.setDate(validDate.getDate() + 14);
        updated.validUntil = `${value.toLocaleDateString('ko-KR')} ~ ${validDate.toLocaleDateString('ko-KR')}`;
      }
      return updated;
    });
  };

  const handleBulkRecipientChange = (updates: Partial<QuoteRecipient>) => {
    setRecipientData(prev => ({ ...prev, ...updates }));
  };

  const handleSaveEdit = async () => {
    if (!id) return;

    try {
      // 수동 오버라이드가 있으면 그 값 사용, 없으면 자동 계산
      let roundedSubtotal: number;
      let newTax: number;
      let newTotal: number;
      
      if (manualTotalOverride) {
        roundedSubtotal = manualTotalOverride.subtotal;
        newTax = manualTotalOverride.tax;
        newTotal = manualTotalOverride.total;
      } else {
        const newSubtotal = editedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0);
        roundedSubtotal = Math.round(newSubtotal / 100) * 100;
        newTax = Math.round(roundedSubtotal * 0.1);
        newTotal = roundedSubtotal + newTax;
      }

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
          issuer_id: recipientData.issuerId || null,
          issuer_name: recipientData.issuerName,
          issuer_email: recipientData.issuerEmail,
          issuer_phone: recipientData.issuerPhone,
          attachments: allAttachments,
          items: editedItems,
          calculation_snapshot: {
            ...(quote.calculation_snapshot && typeof quote.calculation_snapshot === 'object' ? quote.calculation_snapshot : {}),
            schemaVersion: 1,
            editedAt: new Date().toISOString(),
            subtotal: roundedSubtotal,
            tax: newTax,
            total: newTotal,
            items: editedItems.map(item => ({
              id: item.id,
              totalPrice: item.totalPrice,
              quantity: item.quantity || 1,
              calculationSnapshot: item.calculationSnapshot || null,
            })),
            note: '견적 저장 당시 계산 근거입니다. 수동 편집 시 품목 스냅샷은 기존 값을 유지합니다.',
          },
          subtotal: roundedSubtotal,
          tax: newTax,
          total: newTotal
        })
        .eq('id', id);

      if (error) throw error;

      // Save version snapshot before edit
      if (quote) {
        const changes: string[] = [];
        if (recipientData.projectName !== (quote.project_name || '')) changes.push('프로젝트명');
        if (recipientData.companyName !== (quote.recipient_company || '')) changes.push('거래처');
        if (editedItems.length !== items.length) changes.push('품목 수');
        if (roundedSubtotal !== Math.round(quote.subtotal)) changes.push('금액');
        const summary = changes.length > 0 ? `${changes.join(', ')} 변경` : '수정됨';
        
        saveVersion.mutate({
          snapshot: {
            project_name: quote.project_name,
            recipient_company: quote.recipient_company,
            recipient_name: quote.recipient_name,
            items: quote.items,
            subtotal: quote.subtotal,
            tax: quote.tax,
            total: quote.total,
            valid_until: quote.valid_until,
          },
          changeSummary: summary,
        });
      }

      toast.success('견적서가 수정되었습니다.');
      setIsEditing(false);
      setManualTotalOverride(null);
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
  const autoSubtotal = isEditing 
    ? Math.round(editedItems.reduce((sum, item) => sum + (item.totalPrice * item.quantity), 0) / 100) * 100
    : Math.round(quote.subtotal);
  const autoTax = isEditing 
    ? Math.round(autoSubtotal * 0.1)
    : Math.round(quote.tax);
  const autoTotal = isEditing 
    ? autoSubtotal + autoTax
    : Math.round(quote.total);
  
  const subtotal = (isEditing && manualTotalOverride) ? manualTotalOverride.subtotal : autoSubtotal;
  const tax = (isEditing && manualTotalOverride) ? manualTotalOverride.tax : autoTax;
  const totalWithTax = (isEditing && manualTotalOverride) ? manualTotalOverride.total : autoTotal;
  const calculationSnapshot = quote.calculation_snapshot && typeof quote.calculation_snapshot === 'object'
    ? quote.calculation_snapshot
    : null;
  const snapshotVersionName = calculationSnapshot?.pricingVersionName
    || items.find((item: any) => item?.pricingVersionName)?.pricingVersionName
    || items.find((item: any) => item?.calculationSnapshot?.pricingVersion?.versionName)?.calculationSnapshot?.pricingVersion?.versionName;
  const snapshotCapturedAt = calculationSnapshot?.capturedAt
    || items.find((item: any) => item?.calculationSnapshot?.capturedAt)?.calculationSnapshot?.capturedAt;

  return (
    <>
      <PrintStyles quoteNumber={quote.quote_number} projectName={quote.project_name} companyName={quote.recipient_company} isInternal={viewMode === 'internal'} />
      <div className="min-h-screen bg-[hsl(220,10%,95%)] p-2 sm:p-4 print-layout-wrapper">
        <div className="w-full max-w-6xl mx-auto flex flex-col lg:flex-row gap-4 lg:gap-6 print-flex-container">
        <div className="flex-1 min-w-0 max-w-full lg:max-w-4xl print-container" id="saved-quote-print-container" ref={printContainerRef}>
          <div className="mb-4 sm:mb-6 print:hidden flex justify-between items-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
              size="sm"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">홈으로 돌아가기</span>
              <span className="sm:hidden">홈</span>
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
            onCancelEdit={() => { setIsEditing(false); setManualTotalOverride(null); }}
            onToggleViewMode={toggleViewMode}
            viewMode={viewMode}
            showSavedQuoteActions={true}
          />

          <Card className="shadow-lg border border-gray-300 rounded-xl bg-white quote-main-card [backdrop-filter:none] [-webkit-backdrop-filter:none] [background:white]" style={{ overflow: 'visible' }}>
            <CardContent className="p-6 print:p-4" style={{ overflow: 'visible' }}>
              {/* 견적 요약 정보 */}
              <QuoteSummarySection
                quoteNumber={quote.quote_number}
                currentDate={currentDate}
                itemCount={items.length}
                subtotal={subtotal}
                tax={tax}
                totalWithTax={totalWithTax}
              />

              {viewMode === 'internal' && !isEditing && (snapshotVersionName || snapshotCapturedAt) && (
                <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 print:hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-blue-950">단가 영향도</div>
                      <div className="mt-1 text-xs text-blue-800">
                        이 견적은 저장 당시 계산 스냅샷 기준으로 고정되어 이후 단가 변경에 자동 영향받지 않습니다.
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-white">
                      {snapshotVersionName || '미지정 단가표'}
                      {snapshotCapturedAt && ` · ${new Date(snapshotCapturedAt).toLocaleDateString('ko-KR')}`}
                    </Badge>
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
                      recipientCompany={quote.recipient_company || recipientData.companyName}
                      projectName={quote.project_name || recipientData.projectName}
                      quotePdf={quotePdf}
                      onQuotePdfChange={setQuotePdf}
                      showQuotePdfSection={true}
                    />
                  </div>
                </div>
              )}

              {/* 회사 정보 섹션 */}
              <QuoteCompanyInfoSection
                quote={quote}
                currentDate={currentDate}
                recipientData={recipientData}
                companyInfo={companyInfo}
                bankInfo={quoteDefaults.quote_bank_info}
              />

              {/* 견적 목록 */}
              <div className="mb-6 quote-section">
                <h3 className="text-[17px] font-bold text-black mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({isEditing ? editedItems.length : items.length}개) {isEditing ? '- 편집 모드' : viewMode === 'customer' ? '' : '- 내부 관리용'}
                </h3>
                <div className="space-y-4">
                  {isEditing ? (
                    <>
                      {editedItems.map((item: any, index: number) => (
                        <EditableQuoteItem
                          key={index}
                          item={item}
                          index={index}
                          onUpdate={handleItemUpdate}
                          onRemove={handleItemRemove}
                          quoteId={id}
                        />
                      ))}
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-2 h-14 text-muted-foreground hover:text-primary hover:border-primary"
                        onClick={() => navigate(`/calculator?addToQuote=${id}`)}
                      >
                        <Calculator className="w-4 h-4 mr-2" />
                        새 견적 항목 추가하기
                      </Button>
                    </>
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
              <QuoteTotalSection
                subtotal={subtotal}
                tax={tax}
                totalWithTax={totalWithTax}
                isEditing={isEditing}
                onTotalOverride={(s, t, total) => {
                  if (total === 0) {
                    setManualTotalOverride(null);
                  } else {
                    setManualTotalOverride({ subtotal: s, tax: t, total });
                  }
                }}
              />

              {/* 특이사항 및 상담내용 */}
              <QuoteNotesSection
                notes={quoteDefaults.quote_notes}
                consultation={quoteDefaults.quote_consultation}
                viewMode={viewMode}
              />

              {/* 연락처 정보 */}
              <QuoteContactSection
                contactMessage={quoteDefaults.quote_contact_message}
                contactPhone={quoteDefaults.quote_contact_phone}
                contactEmail={quoteDefaults.quote_contact_email}
                recipientData={recipientData}
              />

              {/* 클라이언트 요청사항 */}
              <QuoteClientRequestSection
                recipientMemo={quote.recipient_memo}
                attachments={attachments}
                viewMode={viewMode}
                quoteId={id}
              />

              {/* 첨부 서류 */}
              <QuoteDocumentsSection />
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
                  onClick={() => navigate(`/project-management?id=${linkedProject.id}`)}
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
          {id && <QuoteVersionHistory quoteId={id} />}
          {id && <QuoteStageTimeline quoteId={id} />}
        </div>
        </div>
      </div>
    </>
  );
};

export default SavedQuoteDetailPage;
