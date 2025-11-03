
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar } from "lucide-react";
import { formatPrice } from "@/utils/priceCalculations";

interface QuoteData {
  factory?: string;
  material: string;
  quality: string;
  thickness: string;
  size: string;
  colorType?: string;
  surface: string;
  colorMixingCost: number;
  processing: string;
  processingName: string;
  totalPrice: number;
  breakdown: { label: string; price: number }[];
}

const CustomerQuotePage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const quoteData = location.state as QuoteData;
  
  // 견적번호 생성
  const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;

  if (!quoteData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <p className="text-gray-600 mb-4">견적 데이터를 찾을 수 없습니다.</p>
            <Button onClick={() => navigate('/')}>
              계산기로 돌아가기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  };

  const handlePrintPDF = () => {
    window.print();
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
          @page {
            size: A4;
            margin: 15mm 15mm 25mm 15mm;
          }
          
          body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
          }
          
          .print-container {
            max-width: none;
            margin: 0;
            padding: 0;
            page-break-after: auto;
          }
          
          /* 2열 레이아웃 유지 */
          .grid.grid-cols-1.md\\:grid-cols-2,
          .grid.grid-cols-2.md\\:grid-cols-3 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1rem !important;
          }
          
          /* 푸터 스타일 */
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 15mm;
            right: 15mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-top: 1px solid #ccc;
            font-size: 10pt;
            color: #666;
          }
          
          .print-footer::after {
            counter-increment: page;
            content: "Page " counter(page);
          }
        }
      `}</style>
      
      {/* Print Footer */}
      <div className="print-footer hidden print:flex">
        <span>견적번호: {quoteNumber}</span>
        <span>고객용 견적서</span>
        <span></span>
      </div>
      
      <div className="min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-4xl mx-auto print-container">
        {/* 상단 액션 버튼들 */}
        <div className="flex justify-between items-center mb-6 print:hidden">
          <Button 
            variant="outline" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            홈으로 돌아가기
          </Button>
          <Button 
            onClick={handlePrintPDF}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            PDF 출력
          </Button>
        </div>

        {/* 견적서 메인 카드 */}
        <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
          {/* 헤더 */}
          <CardHeader className="bg-slate-900 text-white p-8">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-3xl font-bold flex items-center gap-3 mb-2">
                  <FileText className="w-8 h-8" />
                  판재 견적서
                </CardTitle>
                <p className="text-slate-200 text-lg">Panel Material Quotation</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-slate-200 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>{currentDate}</span>
                </div>
                <Badge className="bg-white/20 text-white border-0 px-4 py-2 text-lg font-bold">
                  견적번호: {quoteNumber}
                </Badge>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            {/* 제품 정보 섹션 - 공장 정보 제외 */}
            <div className="mb-8">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                제품 정보
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">소재</div>
                  <div className="font-semibold text-gray-900">{quoteData.material}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">재질</div>
                  <div className="font-semibold text-gray-900">{quoteData.quality}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">두께</div>
                  <div className="font-semibold text-gray-900">{quoteData.thickness}</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">사이즈</div>
                  <div className="font-semibold text-gray-900">{quoteData.size}</div>
                </div>
                {quoteData.colorType && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">색상</div>
                    <div className="font-semibold text-gray-900">{quoteData.colorType}</div>
                  </div>
                )}
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-sm text-gray-600 mb-1">면수</div>
                  <div className="font-semibold text-gray-900">{quoteData.surface}</div>
                </div>
                {quoteData.processing && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 md:col-span-2">
                    <div className="text-sm text-gray-600 mb-1">가공방법</div>
                    <div className="font-semibold text-gray-900">{quoteData.processingName}</div>
                  </div>
                )}
              </div>
            </div>

            <Separator className="my-8" />

            {/* 가격 세부 내역 (단가) - 금액 제외 */}
            {quoteData.breakdown && quoteData.breakdown.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-4">가격 세부 내역 (단가)</h3>
                <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
                  <div className="space-y-2">
                    {quoteData.breakdown.map((item, index) => (
                      <div key={index} className="flex items-center py-2 border-b border-gray-200 last:border-0">
                        <div className="text-gray-700">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <Separator className="my-8" />

            {/* 최종 견적 금액 */}
            <div className="bg-slate-900 rounded-xl p-6 text-white">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-2xl font-bold mb-2">견적 금액</h3>
                  <p className="text-slate-300">부가세 포함 금액</p>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-bold">{formatPrice(quoteData.totalPrice)}</div>
                </div>
              </div>
            </div>

            {/* 주의사항 */}
            <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold text-blue-800 mb-3">견적서 안내사항</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• 본 견적서는 선택하신 조건에 따른 예상 금액입니다.</li>
                <li>• 실제 주문 시 수량, 배송지, 추가 요구사항에 따라 금액이 변동될 수 있습니다.</li>
                <li>• 견적서 유효기간은 발행일로부터 30일입니다.</li>
                <li>• 정확한 견적 및 주문 문의는 담당자에게 연락 바랍니다.</li>
              </ul>
            </div>

            {/* 연락처 정보 */}
            <div className="mt-6 p-6 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-800 mb-3">문의 및 주문</h4>
              <div className="text-sm text-gray-700 space-y-1">
                <p>견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.</p>
                <p className="font-medium">• 전화: 000-0000-0000</p>
                <p className="font-medium">• 이메일: contact@company.com</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default CustomerQuotePage;
