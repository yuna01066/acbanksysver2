import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar, Trash2, Users, Building2, Home } from "lucide-react";
interface QuoteSummaryHeaderProps {
  onClearQuotes: () => void;
  onPrintPDF: () => void;
  onViewCustomerQuote?: () => void;
  currentDate: string;
  quoteNumber: string;
}
const QuoteSummaryHeader = ({
  onClearQuotes,
  onPrintPDF,
  onViewCustomerQuote,
  currentDate,
  quoteNumber
}: QuoteSummaryHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomerView = location.pathname === '/customer-quotes-summary';
  return <>
      {/* 상단 액션 버튼들 */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" onClick={() => navigate('/')} className="flex items-center gap-2">
          <Home className="w-4 h-4" />
          홈으로 돌아가기
        </Button>
        <div className="flex gap-2">
          {onViewCustomerQuote && <Button variant="outline" onClick={onViewCustomerQuote} className={`flex items-center gap-2 ${isCustomerView ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-green-600 border-green-600 hover:bg-green-50'}`}>
              {isCustomerView ? <>
                  <Building2 className="w-4 h-4" />
                  내부용 견적서
                </> : <>
                  <Users className="w-4 h-4" />
                  고객용 견적서
                </>}
            </Button>}
          <Button variant="outline" onClick={onClearQuotes} className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50">
            <Trash2 className="w-4 h-4" />
            전체 삭제
          </Button>
          <Button onClick={onPrintPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Download className="w-4 h-4" />
            PDF 출력
          </Button>
        </div>
      </div>

      {/* 헤더 */}
      <Card className="shadow-lg border-0 rounded-xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-8">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold flex items-center gap-3 mb-2">
                <FileText className="w-8 h-8" />
                아크뱅크 견적서
              </CardTitle>
              <p className="text-slate-200 text-lg">ACBANK Quotation</p>
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
      </Card>
    </>;
};
export default QuoteSummaryHeader;