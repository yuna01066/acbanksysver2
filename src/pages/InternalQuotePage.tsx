import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Calculator, ShoppingCart, Home, Save, Link } from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuotes } from "@/contexts/QuoteContext";
import { useAuth } from "@/contexts/AuthContext";
import QuoteSummaryHeader from "@/components/QuoteSummaryHeader";
import QuoteCard from "@/components/QuoteCard";
import PrintStyles from "@/components/PrintStyles";
import businessRegistration from "@/assets/arcbank-business-registration.jpg";
import bankAccount from "@/assets/arcbank-bank-account.jpg";
import arcbankLogo from "@/assets/arcbank-logo.png";
import { FileText } from "lucide-react";
import { saveQuoteWithPluuugSync } from "@/utils/pluuugSync";
import { generateAndUploadQuotePdf, createPdfAttachmentMetadata } from "@/utils/generateQuotePdf";

const InternalQuotePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [syncToPluuug, setSyncToPluuug] = useState(true);
  const printContainerRef = useRef<HTMLDivElement>(null);
  const {
    quotes,
    recipient,
    removeQuote,
    updateQuoteQuantity,
    clearQuotes,
    getTotalPrice,
    getTotalPriceWithTax,
    generateQuoteNumber
  } = useQuotes();

  if (quotes.length === 0) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">담긴 견적이 없습니다.</p>
            <Button onClick={() => navigate('/')}>
              계산기로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>;
  }

  const subtotal = getTotalPrice();
  const tax = subtotal * 0.1; // 10% 부가세
  const totalWithTax = getTotalPriceWithTax();

  const handlePrintPDF = () => {
    window.print();
  };

  const handleViewCustomerQuote = () => {
    navigate('/customer-quotes-summary');
  };

  const handleSaveQuote = async () => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/auth');
      return;
    }

    setIsSaving(true);
    try {
      // PDF 자동 생성
      toast.info('PDF를 생성하고 있습니다...');
      
      const pdfResult = await generateAndUploadQuotePdf(
        'quote-print-container',
        user.id,
        quoteNumber,
        recipient?.projectName
      );

      let attachmentsWithPdf = recipient?.attachments || [];
      
      if (pdfResult.success && pdfResult.pdfUrl && pdfResult.pdfPath) {
        // PDF 첨부파일 메타데이터 추가
        const pdfAttachment = createPdfAttachmentMetadata(
          quoteNumber,
          pdfResult.pdfUrl,
          pdfResult.pdfPath
        );
        
        // 기존 quote_pdf 타입 첨부파일 제거 후 새로 추가
        attachmentsWithPdf = [
          ...attachmentsWithPdf.filter((a: any) => a.type !== 'quote_pdf'),
          pdfAttachment
        ];
        
        console.log('[Save Quote] PDF generated and attached:', pdfResult.pdfUrl);
      } else {
        console.warn('[Save Quote] PDF generation failed:', pdfResult.error);
        toast.warning('PDF 생성에 실패했지만 견적서는 저장됩니다.');
      }

      // recipient에 PDF 첨부파일 추가
      const recipientWithPdf = {
        ...recipient,
        attachments: attachmentsWithPdf
      };

      const subtotal = getTotalPrice();
      const tax = subtotal * 0.1;
      const total = getTotalPriceWithTax();

      const result = await saveQuoteWithPluuugSync(
        user.id,
        quotes,
        recipientWithPdf,
        quoteNumber,
        subtotal,
        tax,
        total,
        syncToPluuug
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success('견적서가 저장되었습니다.');
      clearQuotes(); // 저장 후 컨텍스트 클리어 (다음 견적서는 새 번호로 시작)
      navigate('/saved-quotes');
    } catch (error: any) {
      console.error('Error saving quote:', error);
      toast.error('견적서 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // 견적번호 생성 - QuoteContext에서 가져옴
  const quoteNumber = recipient?.quoteNumber || generateQuoteNumber();

  return (
    <>
      <PrintStyles quoteNumber={quoteNumber} projectName={recipient?.projectName} companyName={recipient?.companyName} isInternal={true} />
      <div className="min-h-screen bg-gray-50 p-4">
          <div className="w-full max-w-4xl mx-auto print-container" id="quote-print-container" ref={printContainerRef}>
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

          {/* Pluuug 동기화 옵션 */}
          <div className="mb-4 flex items-center justify-end gap-3 print:hidden">
            <div className="flex items-center space-x-2 bg-white border border-gray-200 rounded-lg px-4 py-2">
              <Switch 
                id="pluuug-sync" 
                checked={syncToPluuug} 
                onCheckedChange={setSyncToPluuug}
              />
              <Label htmlFor="pluuug-sync" className="flex items-center gap-2 cursor-pointer">
                <Link className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium">Pluuug 동기화</span>
              </Label>
            </div>
          </div>
          
          <QuoteSummaryHeader 
            onClearQuotes={clearQuotes}
            onPrintPDF={handlePrintPDF}
            onViewCustomerQuote={handleViewCustomerQuote}
            onSaveQuote={handleSaveQuote}
            currentDate={currentDate}
            quoteNumber={quoteNumber}
            isSaving={isSaving}
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
                        <p className="text-sm font-semibold text-gray-900">{quoteNumber}</p>
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
                        <p className="text-2xl font-bold text-gray-900">{quotes.length}</p>
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

              {/* 회사 정보 섹션 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 견적서 수신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 수신</h3>
                  
                  {/* 프로젝트 기본 정보 */}
                  <div className="p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">프로젝트 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>프로젝트명:</strong> {recipient?.projectName || '-'}</div>
                      <div><strong>견적번호:</strong> {recipient?.quoteNumber || quoteNumber}</div>
                      <div><strong>견적일자:</strong> {recipient?.quoteDate ? recipient.quoteDate.toLocaleDateString('ko-KR') : currentDate}</div>
                      <div><strong>유효기간:</strong> {recipient?.validUntil || '-'}</div>
                      <div><strong>납기:</strong> {recipient?.deliveryPeriod || '-'}</div>
                      <div><strong>지불 조건:</strong> {recipient?.paymentCondition || '-'}</div>
                    </div>
                  </div>

                  {/* 담당자 및 납기 정보 */}
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold text-slate-800 mb-3">담당자 및 납기 정보</h4>
                    <div className="space-y-2 text-sm text-slate-700">
                      <div><strong>회사명:</strong> {recipient?.companyName || '-'}</div>
                      <div><strong>담당자:</strong> {recipient?.contactPerson || '-'}</div>
                      <div><strong>연락처:</strong> {recipient?.phoneNumber || '-'}</div>
                      <div><strong>이메일:</strong> {recipient?.email || '-'}</div>
                      <div><strong>납기 희망일:</strong> {recipient?.desiredDeliveryDate ? recipient.desiredDeliveryDate.toLocaleDateString('ko-KR') : '-'}</div>
                      <div><strong>납기현장 주소:</strong> {recipient?.deliveryAddress || '-'}</div>
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
                      <div><strong>담당자:</strong> {recipient?.issuerName || '작성'}</div>
                      {recipient?.issuerEmail && <div><strong>이메일:</strong> {recipient.issuerEmail}</div>}
                      {recipient?.issuerPhone && <div><strong>연락처:</strong> {recipient.issuerPhone}</div>}
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
                  견적 목록 ({quotes.length}개) - 내부 관리용
                </h3>
                <div className="space-y-6">
                  {quotes.map((quote, index) => (
                    <QuoteCard
                      key={quote.id}
                      quote={quote}
                      index={index}
                      onRemove={removeQuote}
                      onUpdateQuantity={updateQuoteQuantity}
                    />
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
                          <span className="text-sm font-semibold text-gray-900">{Math.round(subtotal).toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-600">부가세 (10%)</span>
                          <span className="text-sm font-semibold text-gray-900">{Math.round(tax).toLocaleString()}원</span>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 rounded-lg">
                          <span className="text-sm font-bold text-white">총 합계</span>
                          <span className="text-xl font-bold text-white">{Math.round(totalWithTax).toLocaleString()}원</span>
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
                  {recipient?.issuerName && (
                    <div className="bg-white p-3 rounded-lg border border-blue-100">
                      <p className="font-semibold text-blue-900 mb-2">담당자</p>
                      <div className="space-y-1">
                        <p className="font-medium">👤 {recipient.issuerName}</p>
                        {recipient?.issuerPhone && <p className="font-medium">📞 {recipient.issuerPhone}</p>}
                        {recipient?.issuerEmail && <p className="font-medium">📧 {recipient.issuerEmail}</p>}
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
                {(recipient?.clientMemo || (recipient?.attachments && recipient.attachments.length > 0)) && (
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
                    {recipient?.clientMemo && (
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
                                {recipient.clientMemo}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 첨부 파일 */}
                    {recipient?.attachments && recipient.attachments.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <div className="bg-indigo-100 p-2 rounded-lg">
                            <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                          </div>
                          <h4 className="font-bold text-gray-900 text-lg">
                            첨부 파일 ({recipient.attachments.length}개)
                          </h4>
                        </div>
                        <div className="space-y-3">
                          {recipient.attachments.map((attachment, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-4 rounded-lg border-2 border-indigo-200 hover:border-indigo-300 transition-all shadow-sm hover:shadow-md">
                              <div className="flex items-center gap-3">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                  <FileText className="w-5 h-5 text-indigo-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{attachment.name}</p>
                                  <p className="text-xs text-gray-500">
                                    파일 크기: {(attachment.size / 1024).toFixed(1)} KB
                                  </p>
                                </div>
                              </div>
                              <div className="bg-indigo-600 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                첨부됨
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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

export default InternalQuotePage;