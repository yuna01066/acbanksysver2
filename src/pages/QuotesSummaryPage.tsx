import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Calculator, ShoppingCart } from "lucide-react";
import { useQuotes } from "@/contexts/QuoteContext";
import QuoteSummaryHeader from "@/components/QuoteSummaryHeader";
import QuoteCard from "@/components/QuoteCard";
import TotalPricingSummary from "@/components/TotalPricingSummary";
import QuoteWarningNote from "@/components/QuoteWarningNote";

const QuotesSummaryPage = () => {
  const navigate = useNavigate();
  const { quotes, removeQuote, updateQuoteQuantity, clearQuotes, getTotalPrice, getTotalPriceWithTax } = useQuotes();

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
          <QuoteSummaryHeader 
            onClearQuotes={clearQuotes}
            onPrintPDF={handlePrintPDF}
            onViewCustomerQuote={handleViewCustomerQuote}
            currentDate={currentDate}
          />

          <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
            <CardContent className="p-8">
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
