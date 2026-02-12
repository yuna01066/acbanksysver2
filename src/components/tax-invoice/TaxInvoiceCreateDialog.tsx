import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Send, XCircle, RefreshCw, FileText } from 'lucide-react';

export interface InvoiceFormData {
  writeDate: string;
  taxType: string;
  chargeDirection: string;
  issueType: string;
  purposeType: string;
  invoiceDirection: 'sales' | 'purchase';
  supplierCorpNum: string;
  supplierCorpName: string;
  supplierCEOName: string;
  supplierAddr: string;
  supplierBizType: string;
  supplierBizClass: string;
  supplierContactName: string;
  supplierEmail: string;
  supplierTel: string;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCEOName: string;
  buyerAddr: string;
  buyerBizType: string;
  buyerBizClass: string;
  buyerContactName: string;
  buyerEmail: string;
  buyerTel: string;
  supplyCostTotal: number;
  taxTotal: number;
  totalAmount: number;
  remark1: string;
  memo: string;
  recipientId: string;
  projectId: string;
  projectName: string;
  quoteId: string;
  quoteNumber: string;
  items: { serialNum: number; itemName: string; unitCost: number; qty: number; supplyCost: number; tax: number; remark: string }[];
}

interface TaxInvoiceCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: InvoiceFormData;
  setForm: React.Dispatch<React.SetStateAction<InvoiceFormData>>;
  recipients: any[];
  projects: any[];
  quotes: any[];
  onIssue: () => void;
  issuing: boolean;
  onFillBuyer: (recipientId: string) => void;
  onFillFromQuote: (quoteId: string) => void;
}

const TaxInvoiceCreateDialog: React.FC<TaxInvoiceCreateDialogProps> = ({
  open, onOpenChange, form, setForm, recipients, projects, quotes,
  onIssue, issuing, onFillBuyer, onFillFromQuote,
}) => {
  const updateItem = (idx: number, field: string, value: any) => {
    setForm(prev => {
      const items = [...prev.items];
      (items[idx] as any)[field] = value;
      if (field === 'unitCost' || field === 'qty') {
        items[idx].supplyCost = items[idx].unitCost * items[idx].qty;
        items[idx].tax = Math.round(items[idx].supplyCost * 0.1);
      }
      const supplyCostTotal = items.reduce((s, i) => s + i.supplyCost, 0);
      const taxTotal = items.reduce((s, i) => s + i.tax, 0);
      return { ...prev, items, supplyCostTotal, taxTotal, totalAmount: supplyCostTotal + taxTotal };
    });
  };

  const addItemRow = () => {
    setForm(prev => ({
      ...prev,
      items: [...prev.items, { serialNum: prev.items.length + 1, itemName: '', unitCost: 0, qty: 1, supplyCost: 0, tax: 0, remark: '' }],
    }));
  };

  const removeItemRow = (idx: number) => {
    if (form.items.length <= 1) return;
    setForm(prev => {
      const items = prev.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, serialNum: i + 1 }));
      const supplyCostTotal = items.reduce((s, i) => s + i.supplyCost, 0);
      const taxTotal = items.reduce((s, i) => s + i.tax, 0);
      return { ...prev, items, supplyCostTotal, taxTotal, totalAmount: supplyCostTotal + taxTotal };
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>세금계산서 발행</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 기본정보 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">매출/매입</Label>
              <Select value={form.invoiceDirection} onValueChange={v => setForm(f => ({ ...f, invoiceDirection: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sales">매출</SelectItem>
                  <SelectItem value="purchase">매입</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">작성일자</Label>
              <Input
                value={`${form.writeDate.slice(0, 4)}-${form.writeDate.slice(4, 6)}-${form.writeDate.slice(6, 8)}`}
                onChange={e => setForm(f => ({ ...f, writeDate: e.target.value.replace(/-/g, '') }))}
                type="date"
              />
            </div>
            <div>
              <Label className="text-xs">과세유형</Label>
              <Select value={form.taxType} onValueChange={v => setForm(f => ({ ...f, taxType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="taxable">과세</SelectItem>
                  <SelectItem value="zero_rate">영세</SelectItem>
                  <SelectItem value="exempt">면세</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">발행유형</Label>
              <Select value={form.issueType} onValueChange={v => setForm(f => ({ ...f, issueType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">정발행</SelectItem>
                  <SelectItem value="reverse">역발행</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">영수/청구</Label>
              <Select value={form.purposeType} onValueChange={v => setForm(f => ({ ...f, purposeType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="receipt">영수</SelectItem>
                  <SelectItem value="request">청구</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 연동 정보 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">프로젝트 연결</Label>
              <Select value={form.projectId || '__none__'} onValueChange={v => {
                const proj = projects.find(p => p.id === v);
                setForm(f => ({ ...f, projectId: v === '__none__' ? '' : v, projectName: proj?.name || '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="프로젝트 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">견적서 연결 (품목 자동입력)</Label>
              <Select value={form.quoteId || '__none__'} onValueChange={v => {
                if (v !== '__none__') onFillFromQuote(v);
                else setForm(f => ({ ...f, quoteId: '', quoteNumber: '' }));
              }}>
                <SelectTrigger><SelectValue placeholder="견적서 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">없음</SelectItem>
                  {quotes.map(q => (
                    <SelectItem key={q.id} value={q.id}>
                      {q.quote_number} - {q.recipient_company || '미지정'} ({Number(q.total).toLocaleString()}원)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* 공급자 / 공급받는자 */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h4 className="font-semibold text-sm text-primary">공급자 (발행자)</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">사업자번호*</Label>
                  <Input value={form.supplierCorpNum} onChange={e => setForm(f => ({ ...f, supplierCorpNum: e.target.value }))} placeholder="0000000000" />
                </div>
                <div>
                  <Label className="text-xs">상호</Label>
                  <Input value={form.supplierCorpName} onChange={e => setForm(f => ({ ...f, supplierCorpName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">대표자</Label>
                  <Input value={form.supplierCEOName} onChange={e => setForm(f => ({ ...f, supplierCEOName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">담당자</Label>
                  <Input value={form.supplierContactName} onChange={e => setForm(f => ({ ...f, supplierContactName: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">이메일</Label>
                  <Input value={form.supplierEmail} onChange={e => setForm(f => ({ ...f, supplierEmail: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm text-primary">공급받는자</h4>
                <Select onValueChange={v => { onFillBuyer(v); setForm(f => ({ ...f, recipientId: v })); }}>
                  <SelectTrigger className="w-40 h-7 text-xs">
                    <SelectValue placeholder="수신처 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {recipients.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">사업자번호*</Label>
                  <Input value={form.buyerCorpNum} onChange={e => setForm(f => ({ ...f, buyerCorpNum: e.target.value }))} placeholder="0000000000" />
                </div>
                <div>
                  <Label className="text-xs">상호</Label>
                  <Input value={form.buyerCorpName} onChange={e => setForm(f => ({ ...f, buyerCorpName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">대표자</Label>
                  <Input value={form.buyerCEOName} onChange={e => setForm(f => ({ ...f, buyerCEOName: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs">담당자</Label>
                  <Input value={form.buyerContactName} onChange={e => setForm(f => ({ ...f, buyerContactName: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">이메일</Label>
                  <Input value={form.buyerEmail} onChange={e => setForm(f => ({ ...f, buyerEmail: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 품목 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-sm">품목</h4>
              <Button variant="outline" size="sm" onClick={addItemRow}>+ 행추가</Button>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>품목명</TableHead>
                    <TableHead className="w-24">단가</TableHead>
                    <TableHead className="w-16">수량</TableHead>
                    <TableHead className="w-24">공급가</TableHead>
                    <TableHead className="w-24">세액</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-xs">{idx + 1}</TableCell>
                      <TableCell>
                        <Input className="h-8 text-sm" value={item.itemName} onChange={e => updateItem(idx, 'itemName', e.target.value)} placeholder="품목명" />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-sm text-right" type="number" value={item.unitCost || ''} onChange={e => updateItem(idx, 'unitCost', Number(e.target.value))} />
                      </TableCell>
                      <TableCell>
                        <Input className="h-8 text-sm text-right" type="number" value={item.qty || ''} onChange={e => updateItem(idx, 'qty', Number(e.target.value))} />
                      </TableCell>
                      <TableCell className="text-right text-sm">{item.supplyCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-sm">{item.tax.toLocaleString()}</TableCell>
                      <TableCell>
                        {form.items.length > 1 && (
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItemRow(idx)}>
                            <XCircle className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex justify-end gap-6 mt-3 text-sm">
              <span>공급가: <strong>{form.supplyCostTotal.toLocaleString()}원</strong></span>
              <span>세액: <strong>{form.taxTotal.toLocaleString()}원</strong></span>
              <span>합계: <strong className="text-primary">{form.totalAmount.toLocaleString()}원</strong></span>
            </div>
          </div>

          <div>
            <Label className="text-xs">비고</Label>
            <Textarea value={form.remark1} onChange={e => setForm(f => ({ ...f, remark1: e.target.value }))} rows={2} placeholder="비고사항" />
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>취소</Button>
          <Button onClick={onIssue} disabled={issuing}>
            {issuing ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            즉시발행
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TaxInvoiceCreateDialog;
