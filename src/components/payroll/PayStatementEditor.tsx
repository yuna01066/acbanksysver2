import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { PayStatement, PayStatementLineItem, PayStatementSaveInput, PayStatementStatus } from '@/hooks/useHrSelfService';
import PayStatementPreview, { formatPayrollAmount, toPayrollLineItems } from '@/components/payroll/PayStatementPreview';

type PayrollEmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  department?: string | null;
  position?: string | null;
  employee_number?: string | null;
};

interface PayStatementEditorProps {
  employees: PayrollEmployee[];
  statement?: PayStatement | null;
  onSave: (input: PayStatementSaveInput) => Promise<void>;
  isSaving?: boolean;
}

const defaultEarnings: PayStatementLineItem[] = [
  { id: 'base', label: '기본급', amount: 0 },
  { id: 'meal', label: '식대', amount: 0 },
  { id: 'fixed', label: '고정수당', amount: 0 },
  { id: 'overtime', label: '연장수당', amount: 0 },
  { id: 'other', label: '기타 지급', amount: 0 },
];

const defaultDeductions: PayStatementLineItem[] = [
  { id: 'pension', label: '국민연금', amount: 0 },
  { id: 'health', label: '건강보험', amount: 0 },
  { id: 'employment', label: '고용보험', amount: 0 },
  { id: 'income_tax', label: '소득세', amount: 0 },
  { id: 'local_tax', label: '지방소득세', amount: 0 },
  { id: 'other', label: '기타 공제', amount: 0 },
];

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = (month: string) => `${month.slice(0, 7)}-01`;
const monthEnd = (month: string) => {
  const [year, monthNumber] = month.slice(0, 7).split('-').map(Number);
  return new Date(year, monthNumber, 0).toISOString().slice(0, 10);
};

const sumItems = (items: PayStatementLineItem[]) => items.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);

const normalizeMonth = (value?: string | null) => (value || today()).slice(0, 7);

const createRow = (prefix: string): PayStatementLineItem => ({
  id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  label: '',
  amount: 0,
});

const LineItemEditor = ({
  title,
  items,
  onChange,
  prefix,
}: {
  title: string;
  items: PayStatementLineItem[];
  onChange: (items: PayStatementLineItem[]) => void;
  prefix: string;
}) => {
  const updateItem = (index: number, patch: Partial<PayStatementLineItem>) => {
    onChange(items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onChange([...items, createRow(prefix)])}>
          <Plus className="h-3.5 w-3.5" />
          항목 추가
        </Button>
      </div>
      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item.id || index} className="grid gap-2 sm:grid-cols-[1.2fr_120px_1fr_36px]">
            <Input value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} placeholder="항목명" />
            <Input
              type="number"
              min={0}
              value={Number(item.amount) || 0}
              onChange={(event) => updateItem(index, { amount: Number(event.target.value) || 0 })}
              placeholder="금액"
            />
            <Input value={item.note || ''} onChange={(event) => updateItem(index, { note: event.target.value })} placeholder="비고" />
            <Button type="button" variant="ghost" size="icon" onClick={() => onChange(items.filter((_, itemIndex) => itemIndex !== index))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};

const PayStatementEditor: React.FC<PayStatementEditorProps> = ({ employees, statement, onSave, isSaving }) => {
  const initialMonth = normalizeMonth(statement?.pay_month);
  const [selectedUserId, setSelectedUserId] = useState(statement?.user_id || employees[0]?.id || '');
  const [payMonth, setPayMonth] = useState(initialMonth);
  const [payPeriodStart, setPayPeriodStart] = useState(statement?.pay_period_start || monthStart(initialMonth));
  const [payPeriodEnd, setPayPeriodEnd] = useState(statement?.pay_period_end || monthEnd(initialMonth));
  const [paymentDate, setPaymentDate] = useState(statement?.payment_date || today());
  const [earnings, setEarnings] = useState<PayStatementLineItem[]>(
    statement?.earnings ? toPayrollLineItems(statement.earnings) : defaultEarnings,
  );
  const [deductions, setDeductions] = useState<PayStatementLineItem[]>(
    statement?.deductions ? toPayrollLineItems(statement.deductions) : defaultDeductions,
  );
  const [memo, setMemo] = useState(statement?.memo || '');
  const [internalNote, setInternalNote] = useState(statement?.internal_note || '');

  const selectedEmployee = employees.find((employee) => employee.id === selectedUserId) || statement?.profile || null;
  const grossPay = sumItems(earnings);
  const totalDeductions = sumItems(deductions);
  const netPay = grossPay - totalDeductions;

  const previewStatement = useMemo(() => ({
    ...statement,
    user_id: selectedUserId,
    pay_month: `${payMonth}-01`,
    pay_period_start: payPeriodStart,
    pay_period_end: payPeriodEnd,
    payment_date: paymentDate,
    earnings,
    deductions,
    gross_pay: grossPay,
    total_deductions: totalDeductions,
    net_pay: netPay,
    memo,
    internal_note: internalNote,
    profile: selectedEmployee,
  }), [deductions, earnings, grossPay, internalNote, memo, netPay, payMonth, payPeriodEnd, payPeriodStart, paymentDate, selectedEmployee, selectedUserId, statement, totalDeductions]);

  const save = async (status: PayStatementStatus) => {
    if (!selectedUserId) throw new Error('직원을 선택해주세요.');
    if (netPay < 0) throw new Error('공제 합계가 지급 합계보다 클 수 없습니다.');

    await onSave({
      id: statement?.id,
      user_id: selectedUserId,
      pay_month: `${payMonth}-01`,
      pay_period_start: payPeriodStart,
      pay_period_end: payPeriodEnd,
      payment_date: paymentDate,
      earnings,
      deductions,
      memo,
      internal_note: internalNote,
      file_storage_path: statement?.file_storage_path || null,
      status,
    });
  };

  const handleMonthChange = (value: string) => {
    setPayMonth(value);
    setPayPeriodStart(monthStart(value));
    setPayPeriodEnd(monthEnd(value));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
      <div className="space-y-5">
        <div className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>직원</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId} disabled={Boolean(statement?.id)}>
              <SelectTrigger><SelectValue placeholder="직원 선택" /></SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name || employee.email || employee.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>급여월</Label>
            <Input type="month" value={payMonth} onChange={(event) => handleMonthChange(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>산정 시작일</Label>
            <Input type="date" value={payPeriodStart} onChange={(event) => setPayPeriodStart(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>산정 종료일</Label>
            <Input type="date" value={payPeriodEnd} onChange={(event) => setPayPeriodEnd(event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>지급일</Label>
            <Input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
          </div>
        </div>

        <LineItemEditor title="지급 항목" items={earnings} onChange={setEarnings} prefix="earning" />
        <LineItemEditor title="공제 항목" items={deductions} onChange={setDeductions} prefix="deduction" />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>직원 안내 문구</Label>
            <Textarea value={memo} onChange={(event) => setMemo(event.target.value)} rows={5} placeholder="직원이 볼 수 있는 안내 문구" />
          </div>
          <div className="space-y-1.5">
            <Label>내부 메모</Label>
            <Textarea value={internalNote} onChange={(event) => setInternalNote(event.target.value)} rows={5} placeholder="관리자용 메모" />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <span>지급 {formatPayrollAmount(grossPay)}</span>
            <span>공제 {formatPayrollAmount(totalDeductions)}</span>
            <span className="font-semibold">실지급 {formatPayrollAmount(netPay)}</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => save('draft')} disabled={isSaving}>임시저장</Button>
            <Button type="button" onClick={() => save('published')} disabled={isSaving || netPay < 0}>발행</Button>
          </div>
        </div>
      </div>

      <PayStatementPreview statement={previewStatement} profile={selectedEmployee} showInternalNote />
    </div>
  );
};

export default PayStatementEditor;
