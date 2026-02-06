import React, { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generateAndUploadQuotePdf, createPdfAttachmentMetadata } from '@/utils/generateQuotePdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/utils/priceCalculations';
import arcbankLogo from '@/assets/arcbank-logo.png';
import businessRegistration from '@/assets/arcbank-business-registration.jpg';
import bankAccount from '@/assets/arcbank-bank-account.jpg';

interface BulkPdfGeneratorProps {
  onComplete?: () => void;
}

interface QuoteForPdf {
  id: string;
  quote_number: string;
  quote_date: string;
  quote_date_display: string | null;
  project_name: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_address: string | null;
  recipient_memo: string | null;
  desired_delivery_date: string | null;
  valid_until: string | null;
  delivery_period: string | null;
  payment_condition: string | null;
  issuer_name: string | null;
  issuer_email: string | null;
  issuer_phone: string | null;
  items: any[];
  subtotal: number;
  tax: number;
  total: number;
  attachments: any;
  pluuug_synced: boolean | null;
  pluuug_estimate_id: string | null;
}

const BulkPdfGenerator = ({ onComplete }: BulkPdfGeneratorProps) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [currentQuote, setCurrentQuote] = useState<QuoteForPdf | null>(null);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [failed, setFailed] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const renderContainerRef = useRef<HTMLDivElement>(null);

  const startBulkGeneration = async () => {
    if (!user) return;

    setIsRunning(true);
    setProgress(0);
    setCompleted(0);
    setFailed(0);
    setIsDone(false);

    try {
      // Fetch all quotes without PDF
      const { data: quotes, error } = await supabase
        .from('saved_quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Filter quotes without quote_pdf attachment
      const quotesWithoutPdf = (quotes || []).filter(q => {
        const attachments = Array.isArray(q.attachments) ? q.attachments : [];
        return !attachments.some((a: any) => a?.type === 'quote_pdf');
      }).map(q => ({
        ...q,
        items: Array.isArray(q.items) ? q.items : []
      }));

      setTotal(quotesWithoutPdf.length);

      if (quotesWithoutPdf.length === 0) {
        toast.info('모든 견적서에 이미 PDF가 생성되어 있습니다.');
        setIsDone(true);
        setIsRunning(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < quotesWithoutPdf.length; i++) {
        const quote = quotesWithoutPdf[i];
        setCurrentQuote(quote);
        setProgress(((i) / quotesWithoutPdf.length) * 100);

        // Wait for render
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          const pdfResult = await generateAndUploadQuotePdf(
            'bulk-pdf-render-container',
            user.id,
            quote.quote_number,
            quote.project_name || undefined
          );

          if (pdfResult.success && pdfResult.pdfUrl && pdfResult.pdfPath) {
            const pdfAttachment = createPdfAttachmentMetadata(
              quote.quote_number,
              pdfResult.pdfUrl,
              pdfResult.pdfPath
            );

            const currentAttachments = Array.isArray(quote.attachments) ? quote.attachments : [];
            const newAttachments = [
              ...currentAttachments.filter((a: any) => a?.type !== 'quote_pdf'),
              { ...pdfAttachment, type: 'quote_pdf', uploadedAt: new Date().toISOString() }
            ];

            await supabase
              .from('saved_quotes')
              .update({ attachments: newAttachments })
              .eq('id', quote.id);

            successCount++;
            setCompleted(successCount);
            console.log(`[Bulk PDF] Generated ${i + 1}/${quotesWithoutPdf.length}: ${quote.quote_number}`);
          } else {
            failCount++;
            setFailed(failCount);
            console.error(`[Bulk PDF] Failed for ${quote.quote_number}:`, pdfResult.error);
          }
        } catch (err) {
          failCount++;
          setFailed(failCount);
          console.error(`[Bulk PDF] Error for ${quote.quote_number}:`, err);
        }

        // Small delay between generations
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setProgress(100);
      setIsDone(true);
      setCurrentQuote(null);
      toast.success(`PDF 일괄 생성 완료: ${successCount}건 성공, ${failCount}건 실패`);
      onComplete?.();
    } catch (err: any) {
      console.error('[Bulk PDF] Error:', err);
      toast.error(`일괄 PDF 생성 중 오류: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setIsDone(false);
    setProgress(0);
    setCompleted(0);
    setFailed(0);
    setTotal(0);
    setCurrentQuote(null);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="flex items-center gap-2"
      >
        <FileText className="w-4 h-4" />
        전체 PDF 일괄 생성
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>PDF 일괄 생성</DialogTitle>
            <DialogDescription>
              PDF가 없는 견적서들에 대해 자동으로 PDF를 생성합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!isRunning && !isDone && (
              <div className="text-center py-4">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">
                  PDF가 생성되지 않은 견적서들을 찾아 자동으로 PDF를 생성합니다.
                </p>
                <Button onClick={startBulkGeneration} className="w-full">
                  <FileText className="w-4 h-4 mr-2" />
                  일괄 생성 시작
                </Button>
              </div>
            )}

            {isRunning && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm font-medium">PDF 생성 중...</span>
                </div>
                <Progress value={progress} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>완료: {completed}건</span>
                  {failed > 0 && <span className="text-destructive">실패: {failed}건</span>}
                  <span>전체: {total}건</span>
                </div>
                {currentQuote && (
                  <p className="text-xs text-muted-foreground truncate">
                    현재: {currentQuote.quote_number} {currentQuote.project_name ? `- ${currentQuote.project_name}` : ''}
                  </p>
                )}
              </div>
            )}

            {isDone && (
              <div className="text-center py-4 space-y-3">
                {failed === 0 ? (
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto" />
                )}
                <div>
                  <p className="font-medium">
                    {total === 0 ? '생성할 PDF가 없습니다' : 'PDF 일괄 생성 완료'}
                  </p>
                  {total > 0 && (
                    <p className="text-sm text-muted-foreground">
                      성공: {completed}건 / 실패: {failed}건 / 전체: {total}건
                    </p>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full">
                  닫기
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden render container for PDF generation */}
      {currentQuote && (
        <div
          ref={renderContainerRef}
          style={{ position: 'absolute', left: '-9999px', top: 0, width: '210mm', zIndex: -1 }}
        >
          <div id="bulk-pdf-render-container" style={{ backgroundColor: '#fff', padding: '20px' }}>
            <QuotePdfTemplate quote={currentQuote} />
          </div>
        </div>
      )}
    </>
  );
};

/** Minimal quote template for PDF rendering */
const QuotePdfTemplate = ({ quote }: { quote: QuoteForPdf }) => {
  const items = quote.items || [];
  const subtotal = Math.round(quote.subtotal);
  const tax = Math.round(quote.tax);
  const total = Math.round(quote.total);
  const quoteDate = quote.quote_date_display
    ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR')
    : new Date(quote.quote_date).toLocaleDateString('ko-KR');

  return (
    <div style={{ fontFamily: 'sans-serif', fontSize: '11px', color: '#1a1a1a', lineHeight: 1.5 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', borderBottom: '3px solid #1e293b', paddingBottom: '16px' }}>
        <div>
          <img src={arcbankLogo} alt="아크뱅크" style={{ height: '40px', marginBottom: '8px' }} />
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>견 적 서</div>
          <div style={{ fontSize: '11px', color: '#64748b' }}>Panel Material Quotation</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>견적번호</div>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b', background: '#f1f5f9', padding: '4px 12px', borderRadius: '6px' }}>{quote.quote_number}</div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>견적일자: {quoteDate}</div>
        </div>
      </div>

      {/* Company Info Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {/* Recipient */}
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>견적서 수신</div>
          <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
            {quote.project_name && <div><strong>프로젝트:</strong> {quote.project_name}</div>}
            <div><strong>회사명:</strong> {quote.recipient_company || '-'}</div>
            <div><strong>담당자:</strong> {quote.recipient_name || '-'}</div>
            <div><strong>연락처:</strong> {quote.recipient_phone || '-'}</div>
            <div><strong>이메일:</strong> {quote.recipient_email || '-'}</div>
            {quote.recipient_address && <div><strong>주소:</strong> {quote.recipient_address}</div>}
            {quote.desired_delivery_date && <div><strong>납기 희망일:</strong> {new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR')}</div>}
          </div>
        </div>

        {/* Sender */}
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', color: '#1e293b', borderBottom: '1px solid #cbd5e1', paddingBottom: '6px' }}>견적서 발신</div>
          <div style={{ fontSize: '11px', lineHeight: 1.8 }}>
            <div><strong>상호:</strong> (주)아크뱅크</div>
            <div><strong>사업자번호:</strong> 299-87-02991</div>
            <div><strong>주소:</strong> 경기도 포천시 소흘읍 호국로 287번길 15, 나동 1층 101호</div>
            <div><strong>연락처:</strong> 070-7666-9828</div>
            <div><strong>이메일:</strong> acbank@acbank.co.kr</div>
            {quote.issuer_name && <div><strong>담당자:</strong> {quote.issuer_name}</div>}
            {quote.issuer_phone && <div><strong>담당자 연락처:</strong> {quote.issuer_phone}</div>}
          </div>
        </div>
      </div>

      {/* Terms row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', fontSize: '11px' }}>
        {quote.valid_until && <div style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px' }}><strong>유효기간:</strong> {quote.valid_until}</div>}
        {quote.delivery_period && <div style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px' }}><strong>납기:</strong> {quote.delivery_period}</div>}
        {quote.payment_condition && <div style={{ background: '#f1f5f9', padding: '4px 10px', borderRadius: '4px' }}><strong>결제조건:</strong> {quote.payment_condition}</div>}
      </div>

      {/* Items */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', color: '#1e293b' }}>
          견적 목록 ({items.length}개)
        </div>

        {items.map((item: any, idx: number) => (
          <div key={idx} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '12px', overflow: 'hidden' }}>
            {/* Item header */}
            <div style={{ background: '#f1f5f9', padding: '8px 12px', fontWeight: 'bold', fontSize: '12px', color: '#1e293b' }}>
              견적 #{idx + 1}
            </div>
            <div style={{ padding: '12px' }}>
              {/* Item details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '10px' }}>
                {item.selectedColor && (
                  <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>색상</div>
                    <div style={{ fontWeight: '600', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {item.selectedColorHex && <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '2px', backgroundColor: item.selectedColorHex, border: '1px solid #ccc' }} />}
                      {item.colorType === 'CUSTOM' ? '맞춤 색상' : item.selectedColor}
                    </div>
                  </div>
                )}
                <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>소재</div>
                  <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.material}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>재질</div>
                  <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.quality}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>두께</div>
                  <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.thickness}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>사이즈</div>
                  <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.size}</div>
                </div>
                <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '9px', color: '#64748b' }}>면수</div>
                  <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.surface}</div>
                </div>
                {item.processingName && (
                  <div style={{ background: '#f8fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0', gridColumn: 'span 2' }}>
                    <div style={{ fontSize: '9px', color: '#64748b' }}>가공방법</div>
                    <div style={{ fontWeight: '600', fontSize: '11px' }}>{item.processingName}</div>
                  </div>
                )}
              </div>

              {/* Breakdown */}
              {item.breakdown && item.breakdown.length > 0 && (
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '10px', fontWeight: '600', color: '#475569', marginBottom: '4px' }}>가격 상세 내역 (단가)</div>
                  {item.breakdown.map((b: any, bi: number) => (
                    <div key={bi} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px', fontSize: '10px', background: bi % 2 === 0 ? '#f8fafc' : 'transparent', borderRadius: '2px' }}>
                      <span style={{ color: '#475569' }}>{b.label}</span>
                      <span style={{ fontWeight: '600' }}>{formatPrice(b.price)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Item pricing */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>단가: {formatPrice(item.totalPrice)} × {item.quantity}개</span>
                <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{formatPrice(item.totalPrice * (item.quantity || 1))}</span>
              </div>

              {/* Serial number / notes */}
              {item.serialNumber && (
                <div style={{ marginTop: '6px', background: '#fefce8', padding: '4px 8px', borderRadius: '4px', border: '1px solid #fde68a', fontSize: '10px' }}>
                  <strong>클라이언트 요청사항:</strong> {item.serialNumber}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div style={{ background: '#1e293b', color: 'white', borderRadius: '8px', padding: '16px', marginBottom: '20px' }}>
        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '8px' }}>총 견적 금액</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ color: '#94a3b8' }}>소계 (부가세 별도)</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{subtotal.toLocaleString()}원</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ color: '#94a3b8' }}>부가세 (10%)</span>
          <span style={{ fontSize: '14px', fontWeight: '600' }}>{tax.toLocaleString()}원</span>
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold' }}>총 합계</span>
          <span style={{ fontSize: '22px', fontWeight: 'bold' }}>{total.toLocaleString()}원</span>
        </div>
      </div>

      {/* Notes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px', fontSize: '11px' }}>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>특 이 사 항 :</div>
          <ul style={{ paddingLeft: '16px', color: '#475569', lineHeight: 1.8 }}>
            <li>견적서의 유효기간은 발행일로부터 14일 입니다.</li>
            <li>운송비 및 부가세는 별도 입니다.</li>
          </ul>
        </div>
        <div>
          <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>상 담 내 용 :</div>
          <div style={{ color: '#475569', lineHeight: 1.8 }}>
            <p>안녕하세요</p>
            <p>견적 문의해 주셔서 감사합니다.</p>
            <p>상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.</p>
          </div>
        </div>
      </div>

      {/* Contact */}
      <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', border: '1px solid #bfdbfe', marginBottom: '20px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#1e40af' }}>문의 및 주문</div>
        {quote.issuer_name && <div>👤 담당자: {quote.issuer_name} {quote.issuer_phone ? `| 📞 ${quote.issuer_phone}` : ''} {quote.issuer_email ? `| 📧 ${quote.issuer_email}` : ''}</div>}
        <div>📞 대표전화: 070-7537-3680 | 📧 대표이메일: acbank@acbank.co.kr</div>
        <div style={{ marginTop: '6px', fontWeight: 'bold', color: '#1e40af' }}>💰 입금계좌: 신한은행 140-014-544315 (주)아크뱅크</div>
      </div>

      {/* Client memo */}
      {quote.recipient_memo && (
        <div style={{ background: '#eff6ff', borderRadius: '8px', padding: '12px', border: '2px solid #93c5fd', marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1e3a8a', marginBottom: '6px' }}>클라이언트 요청사항</div>
          <div style={{ fontSize: '11px', color: '#334155', whiteSpace: 'pre-wrap', background: '#fff', padding: '8px', borderRadius: '4px', border: '1px solid #bfdbfe' }}>
            {quote.recipient_memo}
          </div>
        </div>
      )}

      {/* Attachments - Business registration */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '12px', color: '#1e293b' }}>첨부 서류</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontWeight: '600', color: '#475569', marginBottom: '6px', fontSize: '12px' }}>사업자등록증</div>
            <img src={businessRegistration} alt="사업자등록증" style={{ width: '100%', maxWidth: '300px', height: 'auto', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          </div>
          <div style={{ border: '2px solid #e2e8f0', borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
            <div style={{ fontWeight: '600', color: '#475569', marginBottom: '6px', fontSize: '12px' }}>통장사본</div>
            <img src={bankAccount} alt="통장사본" style={{ width: '100%', maxWidth: '300px', height: 'auto', border: '1px solid #d1d5db', borderRadius: '4px' }} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPdfGenerator;
