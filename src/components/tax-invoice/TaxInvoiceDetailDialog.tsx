import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Mail, XCircle } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '임시저장', variant: 'secondary' },
  issued: { label: '발행완료', variant: 'default' },
  sent_to_nts: { label: '국세청전송', variant: 'default' },
  nts_accepted: { label: '국세청접수', variant: 'default' },
  cancelled: { label: '발행취소', variant: 'destructive' },
  failed: { label: '실패', variant: 'destructive' },
};

const TAX_TYPE_MAP: Record<string, string> = {
  taxable: '과세', zero_rate: '영세', exempt: '면세',
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  syncing: boolean;
  onSyncStatus: (inv: any) => void;
  onResendEmail: (inv: any) => void;
  onCancel: (inv: any) => void;
}

const TaxInvoiceDetailDialog: React.FC<Props> = ({
  open, onOpenChange, invoice, syncing, onSyncStatus, onResendEmail, onCancel,
}) => {
  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            세금계산서 상세
            <Badge variant={STATUS_MAP[invoice.status]?.variant || 'outline'}>
              {STATUS_MAP[invoice.status]?.label || invoice.status}
            </Badge>
            <Badge variant="outline">
              {invoice.invoice_direction === 'purchase' ? '매입' : '매출'}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">작성일자</span><span>{invoice.write_date}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">과세유형</span><span>{TAX_TYPE_MAP[invoice.tax_type] || invoice.tax_type}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">관리번호</span><span className="font-mono text-xs">{invoice.popbill_mgt_key || '-'}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">국세청 확인번호</span><span className="font-mono text-xs">{invoice.popbill_nts_confirm_num || '-'}</span></div>
            {invoice.project_name && (
              <div className="flex justify-between"><span className="text-muted-foreground">프로젝트</span><span>{invoice.project_name}</span></div>
            )}
            {invoice.quote_number && (
              <div className="flex justify-between"><span className="text-muted-foreground">견적번호</span><span>{invoice.quote_number}</span></div>
            )}
          </div>

          <Separator />

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <h5 className="font-semibold mb-2 text-xs text-muted-foreground">공급자</h5>
              <p className="font-medium">{invoice.supplier_corp_name}</p>
              <p className="text-xs text-muted-foreground">{invoice.supplier_corp_num}</p>
              <p className="text-xs">{invoice.supplier_ceo_name}</p>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <h5 className="font-semibold mb-2 text-xs text-muted-foreground">공급받는자</h5>
              <p className="font-medium">{invoice.buyer_corp_name}</p>
              <p className="text-xs text-muted-foreground">{invoice.buyer_corp_num}</p>
              <p className="text-xs">{invoice.buyer_ceo_name}</p>
            </div>
          </div>

          <Separator />

          <div className="flex justify-end gap-6">
            <span>공급가: <strong>{(invoice.supply_cost_total || 0).toLocaleString()}원</strong></span>
            <span>세액: <strong>{(invoice.tax_total || 0).toLocaleString()}원</strong></span>
            <span>합계: <strong className="text-primary">{(invoice.total_amount || 0).toLocaleString()}원</strong></span>
          </div>

          {Array.isArray(invoice.items) && invoice.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>품목명</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">공급가</TableHead>
                  <TableHead className="text-right">세액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoice.items as any[]).map((item: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{item.itemName || item.item_name || '-'}</TableCell>
                    <TableCell className="text-right">{Number(item.unitCost || item.unit_cost || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{item.qty || item.quantity || 0}</TableCell>
                    <TableCell className="text-right">{Number(item.supplyCost || item.supply_cost || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right">{Number(item.tax || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {invoice.remark1 && (
            <div>
              <span className="text-xs text-muted-foreground">비고:</span>
              <p>{invoice.remark1}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 gap-2">
          <Button variant="outline" size="sm" onClick={() => onSyncStatus(invoice)} disabled={syncing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} /> 상태 동기화
          </Button>
          {invoice.status === 'issued' && (
            <>
              <Button variant="outline" size="sm" onClick={() => onResendEmail(invoice)}>
                <Mail className="h-4 w-4 mr-1" /> 이메일 재전송
              </Button>
              <Button variant="destructive" size="sm" onClick={() => onCancel(invoice)}>
                <XCircle className="h-4 w-4 mr-1" /> 발행취소
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaxInvoiceDetailDialog;
