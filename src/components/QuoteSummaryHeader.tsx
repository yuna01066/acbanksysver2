import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Calendar, Trash2, Users, Building2, Save, List, Edit, X } from "lucide-react";
import arcbankLogo from "@/assets/arcbank-logo.png";
import { cn } from "@/lib/utils";
import { getQuoteStyleProfile, type QuoteStyleType } from "@/utils/quoteStyle";

interface QuoteSummaryHeaderProps {
  onClearQuotes: () => void;
  onPrintPDF: (mode?: 'internal' | 'customer') => void | Promise<void>;
  onViewCustomerQuote?: () => void | Promise<void>;
  onSaveQuote?: () => void | Promise<void>;
  currentDate: string;
  quoteNumber: string;
  validUntil?: string | null;
  isSaving?: boolean;
  // SavedQuoteDetailPage용 props
  showSavedQuoteActions?: boolean;
  isEditMode?: boolean;
  onEdit?: () => void;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
  onToggleViewMode?: () => void;
  viewMode?: 'internal' | 'customer';
  quoteStyle?: QuoteStyleType;
}

const QuoteSummaryHeader = ({
  onClearQuotes,
  onPrintPDF,
  onViewCustomerQuote,
  onSaveQuote,
  currentDate,
  quoteNumber,
  validUntil,
  isSaving = false,
  showSavedQuoteActions = false,
  isEditMode = false,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onToggleViewMode,
  viewMode = 'internal',
  quoteStyle = 'panel'
}: QuoteSummaryHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCustomerView = location.pathname === '/customer-quotes-summary';
  const styleProfile = getQuoteStyleProfile(quoteStyle);
  const effectiveViewMode = isCustomerView ? 'customer' : viewMode;
  return <>
      {/* 상단 액션 버튼들 */}
      <div className="flex flex-wrap justify-between items-center gap-2 mb-6 print:hidden">
        <Button variant="outline" size="sm" onClick={() => navigate('/saved-quotes')} className="flex items-center gap-2">
          <List className="w-4 h-4" />
          <span className="hidden sm:inline">발행 견적서 목록</span>
          <span className="sm:hidden">목록</span>
        </Button>
        <div className="flex flex-wrap gap-2">
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
                  <Button variant="outline" onClick={() => onPrintPDF('internal')} className="flex items-center gap-2 text-slate-700 border-slate-400 hover:bg-slate-50">
                    <Download className="w-4 h-4" />
                    내부용 PDF
                  </Button>
                  <Button onClick={() => onPrintPDF('customer')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Download className="w-4 h-4" />
                    고객용 PDF
                  </Button>
                </>
              )}
            </>
          ) : (
            // InternalQuotePage, CustomerQuotesSummaryPage용 버튼들
            <>
              {onViewCustomerQuote && <Button variant="outline" onClick={onViewCustomerQuote} disabled={isSaving} className={`flex items-center gap-2 ${isCustomerView ? 'text-blue-600 border-blue-600 hover:bg-blue-50' : 'text-green-600 border-green-600 hover:bg-green-50'}`}>
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
                  {isSaving ? '저장 중...' : '견적서 발행'}
                </Button>}
              <Button variant="outline" onClick={onClearQuotes} disabled={isSaving} className="flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                전체 삭제
              </Button>
              <Button onClick={() => onPrintPDF()} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                <Download className="w-4 h-4" />
                PDF 출력
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 헤더 */}
      <Card className="shadow-sm border border-slate-200 rounded-xl overflow-hidden bg-white mb-6 quote-header-card [backdrop-filter:none] [-webkit-backdrop-filter:none]">
        <div className="h-1.5 bg-blue-600 quote-header-accent" />
        <CardHeader className="bg-white p-4 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                  <img src={arcbankLogo} alt="아크뱅크 로고" className="h-7 w-7 object-contain" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="truncate text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">
                    {styleProfile.title}
                  </CardTitle>
                  <p className="mt-0.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">
                    {styleProfile.subtitle}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className={cn("px-2 py-0.5 text-[11px] font-semibold", styleProfile.badgeClassName)}>
                  {styleProfile.label}
                </Badge>
                <Badge variant="outline" className={cn(
                  "px-2 py-0.5 text-[11px] font-semibold",
                  effectiveViewMode === 'internal'
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : "bg-blue-50 text-blue-700 border-blue-200"
                )}>
                  {effectiveViewMode === 'internal' ? '내부관리용' : '고객제출용'}
                </Badge>
              </div>
            </div>
            <div className="grid min-w-[220px] gap-2 rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-xs sm:text-right">
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="font-semibold text-slate-500">견적번호</span>
                <span className="font-bold text-slate-950">{quoteNumber}</span>
              </div>
              <div className="flex items-center justify-between gap-4 sm:justify-end">
                <span className="font-semibold text-slate-500">작성일</span>
                <span className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  {currentDate}
                </span>
              </div>
              {validUntil && (
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="font-semibold text-slate-500">유효기간</span>
                  <span className="font-semibold text-slate-800">{validUntil}</span>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>
    </>;
};
export default QuoteSummaryHeader;
