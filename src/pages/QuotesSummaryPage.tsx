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
import { useQuotes, QuoteRecipient } from "@/contexts/QuoteContext";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import QuoteCard from "@/components/QuoteCard";
import TotalPricingSummary from "@/components/TotalPricingSummary";
import QuoteWarningNote from "@/components/QuoteWarningNote";

const QuotesSummaryPage = () => {
  const navigate = useNavigate();
  const { quotes, recipient, removeQuote, updateQuoteQuantity, clearQuotes, getTotalPrice, getTotalPriceWithTax, updateRecipient } = useQuotes();
  
  const [recipientData, setRecipientData] = React.useState<QuoteRecipient>({
    projectName: recipient?.projectName || '',
    quoteNumber: recipient?.quoteNumber || `QT-${Date.now().toString().slice(-6)}`,
    quoteDate: recipient?.quoteDate || new Date(),
    validUntil: '견적일자로 부터 14일',
    deliveryPeriod: '최대 14일 소요 예상',
    paymentCondition: '선지급 조건',
    contactPerson: recipient?.contactPerson || '',
    phoneNumber: recipient?.phoneNumber || '',
    email: recipient?.email || '',
    desiredDeliveryDate: recipient?.desiredDeliveryDate || null,
    deliveryAddress: recipient?.deliveryAddress || ''
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

  const subtotal = getTotalPrice();
  const tax = subtotal * 0.1; // 10% 부가세
  const totalWithTax = getTotalPriceWithTax();

  const handlePrintPDF = () => {
    window.print();
  };

  const handleAddQuote = () => {
    navigate('/');
  };

  const handleRecipientChange = (field: keyof QuoteRecipient, value: any) => {
    const newRecipientData = { ...recipientData, [field]: value };
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
      <style>{`
        @media print {
          body {
            transform: scale(0.7);
            transform-origin: top left;
            width: 142.857%; /* 100% / 0.7 to maintain full page width */
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="w-full max-w-4xl mx-auto">
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
          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white mb-6">
            <CardHeader className="bg-slate-900 text-white p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-3xl font-bold flex items-center gap-3 mb-2">
                    <FileText className="w-8 h-8" />
                    견적서 작성하기
                  </CardTitle>
                  <p className="text-slate-200 text-lg">Create Panel Material Quotation</p>
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
              {/* 견적 수신 섹션 */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6">견적서 수신</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 기본 정보 */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="projectName">프로젝트명</Label>
                      <Input
                        id="projectName"
                        value={recipientData.projectName}
                        onChange={(e) => handleRecipientChange('projectName', e.target.value)}
                        placeholder="프로젝트명을 입력하세요"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quoteNumber">견적번호</Label>
                      <Input
                        id="quoteNumber"
                        value={recipientData.quoteNumber}
                        onChange={(e) => handleRecipientChange('quoteNumber', e.target.value)}
                        placeholder="견적번호"
                      />
                    </div>
                    <div>
                      <Label>견적일자</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !recipientData.quoteDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recipientData.quoteDate ? format(recipientData.quoteDate, "yyyy년 MM월 dd일") : <span>날짜 선택</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recipientData.quoteDate || undefined}
                            onSelect={(date) => handleRecipientChange('quoteDate', date)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="validUntil">유효기간</Label>
                      <Input
                        id="validUntil"
                        value={recipientData.validUntil}
                        onChange={(e) => handleRecipientChange('validUntil', e.target.value)}
                        placeholder="견적일자로 부터 14일"
                      />
                    </div>
                    <div>
                      <Label htmlFor="deliveryPeriod">납기</Label>
                      <Input
                        id="deliveryPeriod"
                        value={recipientData.deliveryPeriod}
                        onChange={(e) => handleRecipientChange('deliveryPeriod', e.target.value)}
                        placeholder="최대 14일 소요 예상"
                      />
                    </div>
                    <div>
                      <Label htmlFor="paymentCondition">지불 조건</Label>
                      <Input
                        id="paymentCondition"
                        value={recipientData.paymentCondition}
                        onChange={(e) => handleRecipientChange('paymentCondition', e.target.value)}
                        placeholder="선지급 조건"
                      />
                    </div>
                  </div>

                  {/* 담당자 정보 */}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="contactPerson">담당자 *</Label>
                      <Input
                        id="contactPerson"
                        value={recipientData.contactPerson}
                        onChange={(e) => handleRecipientChange('contactPerson', e.target.value)}
                        placeholder="담당자명을 입력하세요"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phoneNumber">연락처 *</Label>
                      <Input
                        id="phoneNumber"
                        value={recipientData.phoneNumber}
                        onChange={(e) => handleRecipientChange('phoneNumber', e.target.value)}
                        placeholder="연락처를 입력하세요"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">이메일 *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={recipientData.email}
                        onChange={(e) => handleRecipientChange('email', e.target.value)}
                        placeholder="이메일을 입력하세요"
                      />
                    </div>
                    <div>
                      <Label>납기 희망일 *</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !recipientData.desiredDeliveryDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {recipientData.desiredDeliveryDate ? format(recipientData.desiredDeliveryDate, "yyyy년 MM월 dd일") : <span>희망일 선택</span>}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={recipientData.desiredDeliveryDate || undefined}
                            onSelect={(date) => handleRecipientChange('desiredDeliveryDate', date)}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label htmlFor="deliveryAddress">납기현장 주소 *</Label>
                      <Textarea
                        id="deliveryAddress"
                        value={recipientData.deliveryAddress}
                        onChange={(e) => handleRecipientChange('deliveryAddress', e.target.value)}
                        placeholder="납기현장 주소를 입력하세요"
                        rows={3}
                      />
                    </div>
                  </div>
                </div>
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
