
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

  // 견적번호 생성
  const quoteNumber = Date.now().toString().slice(-6);

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
              {/* 견적서 헤더 */}
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold mb-2">견 적 서</h1>
                <div className="text-lg text-gray-600">견적번호: {quoteNumber}</div>
              </div>

              {/* 회사 정보 섹션 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                {/* 견적서 발신 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">견적서 발신</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>상호:</strong> (주)아크뱅크</div>
                    <div><strong>사업자번호:</strong> 299-87-02991</div>
                    <div><strong>견적일자:</strong> {currentDate}</div>
                    <div><strong>웹사이트:</strong> acbank.co.kr</div>
                    <div><strong>유효기간:</strong> 견적일자로부터 14일</div>
                    <div><strong>주소:</strong> 경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호 (동행빌딩)</div>
                    <div><strong>📅 납기:</strong> 최대 14일 소요 예상</div>
                    <div><strong>지불 조건:</strong> 선지급 조건</div>
                    <div><strong>업태:</strong> 제조업 / 도매 및 소매업</div>
                    <div><strong>종목:</strong> 아크릴 가공 외</div>
                  </div>
                </div>

                {/* 담당자 정보 */}
                <div className="space-y-4">
                  <h3 className="text-lg font-bold border-b-2 border-gray-300 pb-2">담당자 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>담당자:</strong> 작성</div>
                    <div><strong>연락처:</strong> 070-7666-9828</div>
                    <div><strong>이메일:</strong> acbank@acbank.co.kr</div>
                  </div>
                  
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">입금 계좌</h4>
                    <div className="text-sm text-blue-700">
                      <div>신한은행 140-014-544315 (주)아크뱅크</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 총합계 금액 박스 */}
              <div className="text-center p-6 bg-gray-100 rounded-lg mb-8">
                <div className="text-xl font-bold">
                  합계 금액: 일금 {totalWithTax.toLocaleString()}원 정 ( ₩ {totalWithTax.toLocaleString()} ) / 배송비 별도
                </div>
              </div>

              {/* 견적 상세 내역 테이블 */}
              <div className="mb-8">
                <h3 className="text-xl font-bold mb-4">견적 상세 내역</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">Component No.</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">분류</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">세부 내용</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">수량</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">단가(원)</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">공급가(원)</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">세액계</th>
                        <th className="border border-gray-300 px-3 py-2 text-sm font-bold">합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map((quote, index) => {
                        const unitPrice = quote.totalPrice;
                        const totalPrice = unitPrice * quote.quantity;
                        const taxAmount = totalPrice * 0.1;
                        const totalWithTax = totalPrice + taxAmount;
                        
                        return (
                          <React.Fragment key={quote.id}>
                            <tr>
                              <td className="border border-gray-300 px-3 py-2 text-sm font-bold" rowSpan={6}>{index + 1}.</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm">소재</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm">{quote.material}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-center">1</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-3 py-2 text-sm">두께</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm">{quote.thickness}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-center">1</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 px-3 py-2 text-sm">사이즈</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm">{quote.size}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-center">{quote.quantity}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                            </tr>
                            {quote.selectedColor && (
                              <tr>
                                <td className="border border-gray-300 px-3 py-2 text-sm">컬러</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm">{quote.selectedColor}</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm text-center">1</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                                <td className="border border-gray-300 px-3 py-2 text-sm text-right">0</td>
                              </tr>
                            )}
                            <tr>
                              <td className="border border-gray-300 px-3 py-2 text-sm">가공</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm">{quote.processingName}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-center">1</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">{unitPrice.toLocaleString()}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">{totalPrice.toLocaleString()}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">{taxAmount.toLocaleString()}</td>
                              <td className="border border-gray-300 px-3 py-2 text-sm text-right">{totalWithTax.toLocaleString()}</td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
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
              <div className="mt-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="font-semibold text-gray-800 mb-3">문의 및 주문</h4>
                <div className="text-sm text-gray-700 space-y-1">
                  <p>견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                  <p className="font-medium">• 전화: 070-7666-9828</p>
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
