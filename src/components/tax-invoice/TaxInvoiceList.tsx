import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Mail, Download } from 'lucide-react';

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: '임시저장', variant: 'secondary' },
  issued: { label: '발행완료', variant: 'default' },
  sent_to_nts: { label: '국세청전송', variant: 'default' },
  nts_accepted: { label: '국세청접수', variant: 'default' },
  cancelled: { label: '발행취소', variant: 'destructive' },
  failed: { label: '실패', variant: 'destructive' },
};

interface TaxInvoiceListProps {
  invoices: any[];
  isLoading: boolean;
  direction: 'sales' | 'purchase';
  onSelectInvoice: (inv: any) => void;
  onSyncStatus: (inv: any) => void;
  onResendEmail: (inv: any) => void;
  onExportExcel: () => void;
}

const TaxInvoiceList: React.FC<TaxInvoiceListProps> = ({
  invoices, isLoading, direction, onSelectInvoice, onSyncStatus, onResendEmail, onExportExcel,
}) => {
  const filtered = invoices.filter(i => i.invoice_direction === direction || (!i.invoice_direction && direction === 'sales'));

  return (
    <Card>
      <div className="flex items-center justify-between p-3 border-b">
        <span className="text-sm font-medium text-muted-foreground">
          {filtered.length}건
        </span>
        <Button variant="outline" size="sm" className="gap-1" onClick={onExportExcel}>
          <Download className="h-3.5 w-3.5" /> 엑셀 다운로드
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">작성일자</TableHead>
              <TableHead>{direction === 'sales' ? '공급받는자' : '공급자'}</TableHead>
              <TableHead>연결</TableHead>
              <TableHead className="text-right">공급가액</TableHead>
              <TableHead className="text-right">세액</TableHead>
              <TableHead className="text-right">합계</TableHead>
              <TableHead className="w-24 text-center">상태</TableHead>
              <TableHead className="w-28 text-center">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">로딩 중...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">세금계산서가 없습니다.</TableCell></TableRow>
            ) : filtered.map((inv: any) => (
              <TableRow
                key={inv.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => onSelectInvoice(inv)}
              >
                <TableCell className="text-sm">{inv.write_date}</TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{direction === 'sales' ? inv.buyer_corp_name : inv.supplier_corp_name}</div>
                  <div className="text-xs text-muted-foreground">{direction === 'sales' ? inv.buyer_corp_num : inv.supplier_corp_num}</div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    {inv.project_name && <span className="text-xs text-muted-foreground">📁 {inv.project_name}</span>}
                    {inv.quote_number && <span className="text-xs text-muted-foreground">📄 {inv.quote_number}</span>}
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">{(inv.supply_cost_total || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm">{(inv.tax_total || 0).toLocaleString()}</TableCell>
                <TableCell className="text-right text-sm font-medium">{(inv.total_amount || 0).toLocaleString()}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={STATUS_MAP[inv.status]?.variant || 'outline'}>
                    {STATUS_MAP[inv.status]?.label || inv.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 justify-center">
                    <Button variant="ghost" size="icon" title="상태 동기화" onClick={() => onSyncStatus(inv)}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    {inv.status === 'issued' && (
                      <Button variant="ghost" size="icon" title="이메일 재전송" onClick={() => onResendEmail(inv)}>
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};

export default TaxInvoiceList;
