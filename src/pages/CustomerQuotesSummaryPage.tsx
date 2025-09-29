
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calculator, ShoppingCart } from "lucide-react";
import { useQuotes } from "@/contexts/QuoteContext";
import QuoteSummaryHeader from "@/components/QuoteSummaryHeader";
import CustomerQuoteCard from "@/components/CustomerQuoteCard";
import TotalPricingSummary from "@/components/TotalPricingSummary";

const CustomerQuotesSummaryPage = () => {
  const navigate = useNavigate();
  const {
    quotes,
    removeQuote,
    updateQuoteQuantity,
    clearQuotes,
    getTotalPrice,
    getTotalPriceWithTax
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

  const handleViewInternalQuote = () => {
    navigate('/quotes-summary');
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
            transform: scale(0.8);
            transform-origin: top left;
            width: 125%; /* 100% / 0.8 to maintain full page width */
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
          <QuoteSummaryHeader 
            onClearQuotes={clearQuotes}
            onPrintPDF={handlePrintPDF}
            onViewCustomerQuote={handleViewInternalQuote}
            currentDate={currentDate}
          />

          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
            <CardContent className="p-8">
              {/* 견적 목록 - 고객용 카드 사용 */}
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  견적 목록 ({quotes.length}개)
                </h3>
                <div className="space-y-6">
                  {quotes.map((quote, index) => (
                    <CustomerQuoteCard
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

              {/* 고객용 안내사항 */}
              <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-semibold text-blue-800 mb-3">견적서 안내사항</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• 본 견적서는 선택하신 조건에 따른 예상 금액입니다.</li>
                  <li>• 실제 주문 시 수량, 배송지, 추가 요구사항에 따라 금액이 변동될 수 있습니다.</li>
                  <li>• 견적서 유효기간은 발행일로부터 14일입니다.</li>
                  <li>• 배송비는 별도입니다.</li>
                  <li>• 정확한 견적 및 주문 문의는 담당자에게 연락 바랍니다.</li>
                </ul>
              </div>

              {/* 연락처 정보 */}
              <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-3">문의 및 주문</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                  <p className="font-medium">• 전화: 070-7537-3680</p>
                  <p className="font-medium">• 이메일: acbank@acbank.co.kr</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default CustomerQuotesSummaryPage;
