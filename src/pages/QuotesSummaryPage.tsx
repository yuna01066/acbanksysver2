import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calculator, ShoppingCart, Home, Download, FileText, Calendar as CalendarIcon, Plus, Trash2, Send } from "lucide-react";
import { useQuotes, QuoteRecipient, Attachment } from "@/contexts/QuoteContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import QuoteCard from "@/components/QuoteCard";
import TotalPricingSummary from "@/components/TotalPricingSummary";
import QuoteWarningNote from "@/components/QuoteWarningNote";
import RecipientInfoForm from "@/components/RecipientInfoForm";
import PrintStyles from "@/components/PrintStyles";
import QuoteAttachments from "@/components/QuoteAttachments";

const QuotesSummaryPage = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { quotes, recipient, removeQuote, updateQuoteQuantity, clearQuotes, getTotalPrice, getTotalPriceWithTax, updateRecipient, generateQuoteNumber, updateAttachments } = useQuotes();
  
  const [recipientData, setRecipientData] = React.useState<QuoteRecipient>({
    projectName: recipient?.projectName || '',
    quoteNumber: recipient?.quoteNumber || generateQuoteNumber(),
    quoteDate: recipient?.quoteDate || new Date(),
    validUntil: recipient?.validUntil || (() => {
      const quoteDate = recipient?.quoteDate || new Date();
      const validDate = new Date(quoteDate);
      validDate.setDate(validDate.getDate() + 14);
      return `${quoteDate.toLocaleDateString('ko-KR')} ~ ${validDate.toLocaleDateString('ko-KR')}`;
    })(),
    deliveryPeriod: '최대 14일 소요 예상',
    paymentCondition: '선지급 조건',
    companyName: recipient?.companyName || '',
    contactPerson: recipient?.contactPerson || '',
    phoneNumber: recipient?.phoneNumber || '',
    email: recipient?.email || '',
    desiredDeliveryDate: recipient?.desiredDeliveryDate || null,
    deliveryAddress: recipient?.deliveryAddress || '',
    clientMemo: recipient?.clientMemo || '',
    // 로그인한 사용자 정보 자동 입력
    issuerId: recipient?.issuerId || user?.id || '',
    issuerName: recipient?.issuerName || profile?.full_name || '',
    issuerEmail: recipient?.issuerEmail || profile?.email || '',
    issuerPhone: recipient?.issuerPhone || profile?.phone || '',
    issuerDepartment: recipient?.issuerDepartment || profile?.department || '',
    issuerPosition: recipient?.issuerPosition || profile?.position || ''
  });

  if (quotes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <ShoppingCart className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">담긴 견적이 없습니다.</p>
            <Button onClick={() => navigate('/')}>
              계산기로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const subtotal = Math.round(getTotalPrice());
  const tax = Math.round(subtotal * 0.1); // 10% 부가세
  const totalWithTax = Math.round(getTotalPriceWithTax());

  const handlePrintPDF = () => {
    window.print();
  };

  const handleAddQuote = () => {
    navigate('/calculator');
  };

  const handleRecipientChange = (field: keyof QuoteRecipient, value: any) => {
    const newRecipientData = { ...recipientData, [field]: value };
    // 견적일자 변경 시 유효기간 자동 재계산
    if (field === 'quoteDate' && value instanceof Date) {
      const validDate = new Date(value);
      validDate.setDate(validDate.getDate() + 14);
      newRecipientData.validUntil = `${value.toLocaleDateString('ko-KR')} ~ ${validDate.toLocaleDateString('ko-KR')}`;
    }
    setRecipientData(newRecipientData);
    updateRecipient(newRecipientData);
  };

  const handleBulkRecipientChange = (updates: Partial<QuoteRecipient>) => {
    const newRecipientData = { ...recipientData, ...updates };
    setRecipientData(newRecipientData);
    updateRecipient(newRecipientData);
  };

  const handleViewCustomerQuote = () => {
    navigate('/customer-quotes-summary');
  };

  const currentDate = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <>
      <PrintStyles quoteNumber={recipientData.quoteNumber} projectName={recipientData.projectName} companyName={recipientData.companyName} />
      
      {/* Print Footer */}
      <div className="print-footer hidden print:flex">
        <span>견적번호: {recipientData.quoteNumber}</span>
        <span>{recipientData.projectName || '프로젝트명 없음'}</span>
        <span></span>
      </div>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-4xl mx-auto print-container">
          {/* 간단한 헤더 */}
          <div className="flex justify-between items-center mb-6 print:hidden">
            <Button 
              variant="outline" 
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <Home className="w-4 h-4" />
              홈으로 돌아가기
            </Button>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleAddQuote}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-2" />
                견적 추가
              </Button>
              <Button 
                variant="outline" 
                onClick={clearQuotes}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                전체 삭제
              </Button>
              <Button 
                onClick={() => navigate('/internal-quote')}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Send className="w-4 h-4 mr-2" />
                견적 발행
              </Button>
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
                    견적번호: {recipientData.quoteNumber}
                  </Badge>
                </div>
              </div>
            </CardHeader>
          </Card>


          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
            <CardContent className="p-8">
              {/* 견적 수신 폼 */}
              <RecipientInfoForm
                recipientData={recipientData}
                onChange={handleRecipientChange}
                onBulkChange={handleBulkRecipientChange}
                showClientMemo={true}
              />

              <Separator className="my-8" />

              {/* 첨부 파일 섹션 */}
              <div className="mb-8">
                <QuoteAttachments
                  attachments={recipient?.attachments || []}
                  onAttachmentsChange={updateAttachments}
                />
              </div>

              <Separator className="my-8" />

              {/* 견적 목록 */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({quotes.length}개)
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

              <Separator className="my-8" />

              {/* 최종 총합 금액 */}
              <TotalPricingSummary
                quotesLength={quotes.length}
                subtotal={subtotal}
                tax={tax}
                totalWithTax={totalWithTax}
              />

              {/* 주의사항 */}
              <QuoteWarningNote />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default QuotesSummaryPage;
