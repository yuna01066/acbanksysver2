import React from 'react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { PayStatement, PayStatementLineItem, PayStatementSaveInput } from '@/hooks/useHrSelfService';
import { cn } from '@/lib/utils';

type PreviewProfile = {
  full_name?: string | null;
  email?: string | null;
  department?: string | null;
  position?: string | null;
  employee_number?: string | null;
};

type PreviewStatement = Partial<Omit<PayStatement, 'earnings' | 'deductions' | 'profile'>>
  & Partial<Omit<PayStatementSaveInput, 'earnings' | 'deductions'>>
  & {
    profile?: PreviewProfile | null;
    earnings?: PayStatementLineItem[] | Record<string, unknown> | unknown;
    deductions?: PayStatementLineItem[] | Record<string, unknown> | unknown;
    gross_pay?: number | null;
    total_deductions?: number | null;
    net_pay?: number | null;
  };

interface PayStatementPreviewProps {
  statement: PreviewStatement;
  profile?: PreviewProfile | null;
  className?: string;
  showInternalNote?: boolean;
}

export const formatPayrollAmount = (value: number | null | undefined) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ko-KR')}원`;
};

export const toPayrollLineItems = (value: unknown): PayStatementLineItem[] => {
  if (Array.isArray(value)) {
    return value.map((item, index) => ({
      id: typeof item?.id === 'string' ? item.id : String(index),
      label: typeof item?.label === 'string' ? item.label : '항목',
      amount: Number(item?.amount) || 0,
      note: typeof item?.note === 'string' ? item.note : undefined,
      source: item?.source === 'manual' ? 'manual' : 'auto',
      taxable: typeof item?.taxable === 'boolean' ? item.taxable : undefined,
      formula_key: typeof item?.formula_key === 'string' ? item.formula_key : undefined,
    }));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).map(([label, amount]) => ({
      id: label,
      label,
      amount: Number(amount) || 0,
    }));
  }

  return [];
};

const sumItems = (items: PayStatementLineItem[]) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return format(date, 'yyyy. M. d.', { locale: ko });
};

const PayRows = ({ title, items }: { title: string; items: PayStatementLineItem[] }) => (
  <section className="rounded-lg border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3">
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
    </div>
    <div className="divide-y divide-slate-100">
      {items.length === 0 ? (
        <div className="px-4 py-4 text-sm text-slate-500">등록된 항목이 없습니다.</div>
      ) : (
        items.map((item) => (
          <div key={item.id || item.label} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium text-slate-800">
                {item.label}
                {item.source && (
                  <span className="ml-2 rounded-full border border-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    {item.source === 'manual' ? '수동' : '자동'}
                  </span>
                )}
              </p>
              {(item.note || item.taxable === false) && (
                <p className="mt-1 text-xs text-slate-500">
                  {[item.note, item.taxable === false ? '비과세' : null].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <p className="font-semibold tabular-nums text-slate-950">{formatPayrollAmount(item.amount)}</p>
          </div>
        ))
      )}
    </div>
  </section>
);

const PayStatementPreview: React.FC<PayStatementPreviewProps> = ({
  statement,
  profile,
  className,
  showInternalNote = false,
}) => {
  const employee = profile || statement.profile || null;
  const earnings = toPayrollLineItems(statement.earnings);
  const deductions = toPayrollLineItems(statement.deductions);
  const grossPay = Number(statement.gross_pay ?? sumItems(earnings));
  const totalDeductions = Number(statement.total_deductions ?? sumItems(deductions));
  const netPay = Number(statement.net_pay ?? grossPay - totalDeductions);

  return (
    <article className={cn('pay-statement-preview bg-white text-slate-950', className)}>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-none">
        <header className="border-b border-slate-200 pb-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-700">ACBANK Payroll</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">급여명세서</h2>
              <p className="mt-2 text-sm text-slate-500">시스템에서 발행된 월별 급여명세입니다.</p>
            </div>
            <div className="rounded-lg border border-slate-200 px-4 py-3 text-right">
              <p className="text-xs text-slate-500">급여월</p>
              <p className="text-lg font-bold text-slate-950">{formatDate(statement.pay_month)}</p>
              <p className="mt-1 text-xs text-slate-500">지급일 {formatDate(statement.payment_date)}</p>
            </div>
          </div>
        </header>

        <section className="grid gap-4 border-b border-slate-200 py-5 md:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-950">직원 정보</h3>
            <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">성명</dt>
              <dd className="font-medium text-slate-900">{employee?.full_name || '-'}</dd>
              <dt className="text-slate-500">사번</dt>
              <dd className="text-slate-900">{employee?.employee_number || '-'}</dd>
              <dt className="text-slate-500">부서/직책</dt>
              <dd className="text-slate-900">{[employee?.department, employee?.position].filter(Boolean).join(' / ') || '-'}</dd>
            </dl>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-950">산정 기간</h3>
            <dl className="mt-3 grid grid-cols-[90px_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-slate-500">시작일</dt>
              <dd className="text-slate-900">{formatDate(statement.pay_period_start)}</dd>
              <dt className="text-slate-500">종료일</dt>
              <dd className="text-slate-900">{formatDate(statement.pay_period_end)}</dd>
              <dt className="text-slate-500">발행일</dt>
              <dd className="text-slate-900">{formatDate(statement.published_at || statement.issued_at)}</dd>
            </dl>
          </div>
        </section>

        <div className="grid gap-4 py-5 md:grid-cols-2">
          <PayRows title="지급 항목" items={earnings} />
          <PayRows title="공제 항목" items={deductions} />
        </div>

        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-blue-700">지급총액</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{formatPayrollAmount(grossPay)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700">공제총액</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{formatPayrollAmount(totalDeductions)}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700">실지급액</p>
              <p className="mt-1 text-2xl font-bold text-blue-700">{formatPayrollAmount(netPay)}</p>
            </div>
          </div>
        </section>

        {statement.memo && (
          <section className="mt-4 rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">안내 문구</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{statement.memo}</p>
          </section>
        )}

        {statement.calculation_basis && Object.keys(statement.calculation_basis).length > 0 && (
          <section className="mt-4 rounded-lg border border-slate-200 p-4">
            <h4 className="text-sm font-semibold text-slate-950">계산 기준</h4>
            <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p>급여 기준: {String(statement.calculation_basis.payType || '-')}</p>
              <p>월 소정시간: {String(statement.calculation_basis.standardMonthlyHours || '-')}</p>
              <p>과세 기준액: {formatPayrollAmount(Number(statement.calculation_basis.taxablePay) || 0)}</p>
              <p>요율 버전: {String((statement.calculation_basis.rateVersion as { name?: string } | undefined)?.name || '-')}</p>
            </div>
          </section>
        )}

        {showInternalNote && statement.internal_note && (
          <section className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-semibold text-amber-900">내부 메모</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-amber-800">{statement.internal_note}</p>
          </section>
        )}
      </div>
    </article>
  );
};

export default PayStatementPreview;
