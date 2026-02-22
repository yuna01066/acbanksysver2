import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileText, Calendar, Trash2, Users, Building2, Home, Save, List, Edit, X } from "lucide-react";
import arcbankLogo from "@/assets/arcbank-logo.png";

interface QuoteSummaryHeaderProps {
  onClearQuotes: () => void;
  onPrintPDF: () => void;
  onViewCustomerQuote?: () => void;
  onSaveQuote?: () => void;
  currentDate: string;
  quoteNumber: string;
  isSaving?: boolean;
  // SavedQuoteDetailPage용 props
  showSavedQuoteActions?: boolean;
  isEditMode?: boolean;
  onEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onToggleViewMode?: () => void;
  viewMode?: 'internal' | 'customer';
}

const QuoteSummaryHeader = ({
  onClearQuotes,
  onPrintPDF,
  onViewCustomerQuote,
  onSaveQuote,
  currentDate,
  quoteNumber,
  isSaving = false,
  showSavedQuoteActions = false,
  isEditMode = false,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleViewMode,
  viewMode = 'internal'
}: QuoteSummaryHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomerView = location.pathname === '/customer-quotes-summary';
  return <>
      {/* 상단 액션 버튼들 */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <Button variant="outline" onClick={() => navigate('/saved-quotes')} className="flex items-center gap-2">
          <List className="w-4 h-4" />
          발행 견적서 목록
        </Button>
        <div className="flex gap-2">
          {showSavedQuoteActions ? (
            // SavedQuoteDetailPage용 버튼들
            <>
              {isEditMode ? (
                <>
                  <Button variant="outline" onClick={onSaveEdit} className="text-green-600 border-green-600">
                    <Save className="w-4 h-4 mr-2" />
                    저장
                  </Button>
                  <Button variant="outline" onClick={onCancelEdit}>
                    <X className="w-4 h-4 mr-2" />
                    취소
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={onEdit} className="text-blue-600 border-blue-600">
                    <Edit className="w-4 h-4 mr-2" />
                    수정
                  </Button>
                  <Button variant="outline" onClick={onToggleViewMode} className={`flex items-center gap-2 ${viewMode === 'customer' ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-green-600 border-green-600 hover:bg-green-50'}`}>
                    {viewMode === 'internal' ? (
                      <>
                        <Users className="w-4 h-4" />
                        고객용 견적서
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4" />
                        내부용 견적서
                      </>
                    )}
                  </Button>
                  <Button onClick={onPrintPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4" />
                    PDF 출력
                  </Button>
                </>
              )}
            </>
          ) : (
            // InternalQuotePage, CustomerQuotesSummaryPage용 버튼들
            <>
              {onViewCustomerQuote && <Button variant="outline" onClick={onViewCustomerQuote} className={`flex items-center gap-2 ${isCustomerView ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-green-600 border-green-600 hover:bg-green-50'}`}>
                  {isCustomerView ? <>
                      <Building2 className="w-4 h-4" />
                      내부용 견적서
                    </> : <>
                      <Users className="w-4 h-4" />
                      고객용 견적서
                    </>}
                </Button>}
              {onSaveQuote && <Button variant="outline" onClick={onSaveQuote} disabled={isSaving} className="flex items-center gap-2 text-green-600 border-green-600 hover:bg-green-50">
                  <Save className="w-4 h-4" />
                  {isSaving ? '저장 중...' : '견적서 저장'}
                </Button>}
              <Button variant="outline" onClick={onClearQuotes} className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                전체 삭제
              </Button>
              <Button onClick={onPrintPDF} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4" />
                PDF 출력
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 헤더 */}
      <Card className="shadow-sm border border-gray-300 rounded-xl overflow-hidden bg-white mb-6 quote-header-card [backdrop-filter:none] [-webkit-backdrop-filter:none]">
        <CardHeader className="bg-white border-b border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold flex items-center gap-3 mb-1 text-black">
                <img src={arcbankLogo} alt="아크뱅크 로고" className="w-7 h-7 object-contain" />
                아크뱅크 견적서
              </CardTitle>
              <p className="text-gray-500 text-sm font-normal tracking-wider">ACBANK Quotation</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm">
                <Calendar className="w-4 h-4" />
                <span>{currentDate}</span>
              </div>
              <Badge className="bg-gray-100 text-black border border-gray-300 px-3 py-1.5 text-sm font-semibold">
                견적번호: {quoteNumber}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>
    </>;
};
export default QuoteSummaryHeader;