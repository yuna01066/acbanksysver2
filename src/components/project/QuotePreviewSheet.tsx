import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, FileText } from 'lucide-react';
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
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!quoteId || !open) return;
    setLoading(true);
    supabase
      .from('saved_quotes')
      .select('*')
      .eq('id', quoteId)
      .single()
      .then(({ data }) => {
        setQuote(data);
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
              {/* 수신처 정보 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">수신처 정보</h3>
                <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-4">
                  <div>
                    <span className="text-muted-foreground text-xs">업체명</span>
                    <p className="font-medium">{quote.recipient_company || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">담당자</span>
                    <p>{quote.recipient_name || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">연락처</span>
                    <p>{quote.recipient_phone || '-'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">이메일</span>
                    <p>{quote.recipient_email || '-'}</p>
                  </div>
                </div>
              </div>

              {/* 견적 항목 */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">견적 항목 ({items.length}건)</h3>
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

              {/* 합계 */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">공급가액</span>
                  <span>₩{Math.round(quote.subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">부가세 (10%)</span>
                  <span>₩{Math.round(quote.tax).toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>합계</span>
                  <span>₩{Math.round(quote.total).toLocaleString()}</span>
                </div>
              </div>

              {/* 기타 정보 */}
              <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                {quote.valid_until && (
                  <div>
                    <span className="block text-[10px]">견적 유효기간</span>
                    <span className="text-foreground">{quote.valid_until}</span>
                  </div>
                )}
                {quote.delivery_period && (
                  <div>
                    <span className="block text-[10px]">납기</span>
                    <span className="text-foreground">{quote.delivery_period}</span>
                  </div>
                )}
                {quote.payment_condition && (
                  <div>
                    <span className="block text-[10px]">결제조건</span>
                    <span className="text-foreground">{quote.payment_condition}</span>
                  </div>
                )}
                {quote.quote_date && (
                  <div>
                    <span className="block text-[10px]">견적일</span>
                    <span className="text-foreground">
                      {format(new Date(quote.quote_date), 'yyyy년 M월 d일', { locale: ko })}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default QuotePreviewSheet;
