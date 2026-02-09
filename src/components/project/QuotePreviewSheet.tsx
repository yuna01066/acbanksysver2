import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

interface Props {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QuotePreviewSheet: React.FC<Props> = ({ quoteId, open, onOpenChange }) => {
  const navigate = useNavigate();
  const [quote, setQuote] = useState<any>(null);
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [issuerProfile, setIssuerProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quoteId || !open) return;
    setLoading(true);

    Promise.all([
      supabase.from('saved_quotes').select('*').eq('id', quoteId).single(),
      supabase.from('company_info').select('*').limit(1).single(),
    ]).then(async ([quoteRes, companyRes]) => {
      const q = quoteRes.data;
      setQuote(q);
      setCompanyInfo(companyRes.data);

      if (q?.user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email, phone, department, position')
          .eq('id', q.user_id)
          .single();
        setIssuerProfile(profile);
      }
      setLoading(false);
    });
  }, [quoteId, open]);

  const items = quote ? (Array.isArray(quote.items) ? quote.items : []) : [];

  const stageLabels: Record<string, string> = {
    quote_issued: '견적 발행',
    invoice_issued: '계산서 발행',
    in_progress: '진행중',
    panel_ordered: '원판발주',
    manufacturing: '제작중',
    completed: '제작완료',
    cancelled: '취소',
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return format(new Date(dateStr), 'yyyy. M. d.', { locale: ko });
    } catch { return dateStr; }
  };

  const InfoRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div className="flex gap-1">
      <span className="font-semibold text-foreground shrink-0">{label}:</span>
      <span className="text-muted-foreground">{value || '-'}</span>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[50vw] overflow-y-auto p-0">
        {loading || !quote ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">로딩 중...</p>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <SheetHeader className="px-6 py-4 border-b sticky top-0 bg-background z-10">
              <div className="flex items-center justify-between">
                <div>
                  <SheetTitle className="text-base font-mono">{quote.quote_number}</SheetTitle>
                  <p className="text-sm text-muted-foreground mt-0.5">{quote.project_name || '-'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {stageLabels[quote.project_stage] || quote.project_stage}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      onOpenChange(false);
                      navigate(`/saved-quotes/${quote.id}`);
                    }}
                  >
                    <ExternalLink className="h-3 w-3" /> 상세보기
                  </Button>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 견적 요약 */}
              <div className="space-y-3">
                <h3 className="text-base font-bold">견적 요약</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">견적번호</p>
                    <p className="font-bold text-sm">{quote.quote_number}</p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">견적 항목 수</p>
                    <p className="font-bold text-sm">{items.length} <span className="text-xs font-normal">개</span></p>
                  </div>
                  <div className="bg-muted/40 rounded-lg p-3 space-y-0.5 text-right">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">공급가</span>
                      <span className="font-medium">{Math.round(quote.subtotal).toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">부가세</span>
                      <span className="font-medium">{Math.round(quote.tax).toLocaleString()}원</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t pt-1 mt-1">
                      <span>최종 금액</span>
                      <span>{Math.round(quote.total).toLocaleString()}원</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-muted/40 rounded-lg p-3">
                    <p className="text-[10px] text-muted-foreground mb-1">작성일</p>
                    <p className="font-bold text-sm">{formatDate(quote.quote_date_display || quote.quote_date)}</p>
                  </div>
                </div>
              </div>

              {/* 견적서 수신 / 발신 - 2 column layout */}
              <div className="grid grid-cols-2 gap-4">
                {/* 수신 */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold">견적서 수신</h3>

                  <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-xs">
                    <p className="font-bold text-sm mb-2">프로젝트 정보</p>
                    <InfoRow label="프로젝트명" value={quote.project_name} />
                    <InfoRow label="견적번호" value={quote.quote_number} />
                    <InfoRow label="견적일자" value={formatDate(quote.quote_date_display || quote.quote_date)} />
                    <InfoRow label="견적 유효기간" value={quote.valid_until} />
                    <InfoRow label="납기" value={quote.delivery_period} />
                    <InfoRow label="지불 조건" value={quote.payment_condition} />
                  </div>

                  <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-xs">
                    <p className="font-bold text-sm mb-2">담당자 및 납기 정보</p>
                    <InfoRow label="회사명" value={quote.recipient_company} />
                    <InfoRow label="담당자" value={quote.recipient_name} />
                    <InfoRow label="연락처" value={quote.recipient_phone} />
                    <InfoRow label="이메일" value={quote.recipient_email} />
                    {quote.desired_delivery_date && (
                      <InfoRow label="납기 희망일" value={formatDate(quote.desired_delivery_date)} />
                    )}
                    <InfoRow label="납기현장 주소" value={quote.recipient_address || '추후 전달 예정'} />
                  </div>
                </div>

                {/* 발신 */}
                <div className="space-y-4">
                  <h3 className="text-base font-bold">견적서 발신</h3>

                  {companyInfo && (
                    <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-xs">
                      <p className="font-bold text-sm mb-2">회사 정보</p>
                      <InfoRow label="상호" value={companyInfo.company_name} />
                      <InfoRow label="사업자번호" value={companyInfo.business_number} />
                      <InfoRow label="웹사이트" value={companyInfo.website} />
                      <InfoRow label="주소" value={
                        [companyInfo.address, companyInfo.detail_address].filter(Boolean).join(' ') || '-'
                      } />
                      <InfoRow label="업태" value={companyInfo.business_type} />
                      <InfoRow label="종목" value={companyInfo.industry} />
                      <InfoRow label="연락처" value={companyInfo.phone} />
                      <InfoRow label="이메일" value={companyInfo.email} />
                    </div>
                  )}

                  <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-xs">
                    <p className="font-bold text-sm mb-2">담당자 정보</p>
                    <InfoRow label="담당자" value={quote.issuer_name || issuerProfile?.full_name} />
                    <InfoRow label="이메일" value={quote.issuer_email || issuerProfile?.email} />
                    <InfoRow label="연락처" value={quote.issuer_phone || issuerProfile?.phone} />
                  </div>
                </div>
              </div>

              {/* 견적 항목 */}
              <div className="space-y-2">
                <h3 className="text-base font-bold">견적 항목 ({items.length}건)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-xs text-muted-foreground">
                        <th className="text-left p-2 font-medium">품목</th>
                        <th className="text-right p-2 font-medium">수량</th>
                        <th className="text-right p-2 font-medium">단가</th>
                        <th className="text-right p-2 font-medium">금액</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any, idx: number) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2">
                            <p className="font-medium text-xs">{item.description || item.name || '-'}</p>
                            {item.spec && <p className="text-[10px] text-muted-foreground">{item.spec}</p>}
                          </td>
                          <td className="text-right p-2 text-xs">{item.quantity}</td>
                          <td className="text-right p-2 text-xs">₩{Math.round(item.totalPrice || item.unitPrice || 0).toLocaleString()}</td>
                          <td className="text-right p-2 text-xs font-medium">
                            ₩{Math.round((item.totalPrice || item.unitPrice || 0) * (item.quantity || 1)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuotePreviewSheet;
