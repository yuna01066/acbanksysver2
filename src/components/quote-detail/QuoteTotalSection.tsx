import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

interface QuoteTotalSectionProps {
  subtotal: number;
  tax: number;
  totalWithTax: number;
  autoTotalWithTax?: number;
  isEditing?: boolean;
  onTotalOverride?: (subtotal: number, tax: number, total: number) => void;
  manualAdjustment?: {
    previousTotal?: number | null;
    adjustedTotal?: number | null;
    difference?: number | null;
  } | null;
}

const formatCurrency = (value: number) => `${Math.round(value).toLocaleString()}원`;

const formatSignedCurrency = (value: number) => {
  const rounded = Math.round(value);
  if (rounded === 0) return '변동 없음';
  return `${rounded > 0 ? '+' : '-'}${Math.abs(rounded).toLocaleString()}원`;
};

const parseCurrencyValue = (value: string) => Number(value.replace(/[^\d]/g, '')) || 0;

const QuoteTotalSection: React.FC<QuoteTotalSectionProps> = ({
  subtotal,
  tax,
  totalWithTax,
  autoTotalWithTax,
  isEditing,
  onTotalOverride,
  manualAdjustment,
}) => {
  const [editMode, setEditMode] = useState<'auto' | 'manual'>('auto');
  const [manualTotal, setManualTotal] = useState<string>('');

  useEffect(() => {
    if (!isEditing) {
      setEditMode('auto');
      setManualTotal('');
    }
  }, [isEditing]);

  // VAT 포함 최종금액을 기준으로 공급가/부가세를 역산한다.
  const handleManualTotalChange = (value: string) => {
    const normalizedValue = value.replace(/[^\d]/g, '');
    setManualTotal(normalizedValue);
    const total = Math.round(parseCurrencyValue(normalizedValue));

    if (total <= 0) {
      onTotalOverride?.(0, 0, 0);
      return;
    }

    const newSubtotal = Math.round(total / 1.1);
    const newTax = total - newSubtotal;
    onTotalOverride?.(newSubtotal, newTax, total);
  };

  const handleToggleManual = () => {
    if (editMode === 'auto') {
      setEditMode('manual');
      setManualTotal(String(totalWithTax));
    } else {
      setEditMode('auto');
      setManualTotal('');
      onTotalOverride?.(0, 0, 0); // signal to reset to auto
    }
  };

  const displaySubtotal = subtotal;
  const displayTax = tax;
  const displayTotal = totalWithTax;
  const comparisonTotal = autoTotalWithTax ?? manualAdjustment?.previousTotal ?? displayTotal;
  const manualDifference = displayTotal - comparisonTotal;
  const savedManualDifference = manualAdjustment?.difference ?? (
    typeof manualAdjustment?.adjustedTotal === 'number' && typeof manualAdjustment?.previousTotal === 'number'
      ? manualAdjustment.adjustedTotal - manualAdjustment.previousTotal
      : null
  );
  const showSavedManualAdjustment = !isEditing && savedManualDifference !== null && savedManualDifference !== 0;

  return (
    <div className="mb-6 rounded-lg border border-blue-200 bg-white print-total quote-section">
      <div className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-[14px] font-bold text-slate-950">총 견적 금액</h2>
            {isEditing && (
              <button
                onClick={handleToggleManual}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                  editMode === 'manual'
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {editMode === 'manual' ? '자동 계산으로 복구' : 'VAT 포함 금액 조정'}
              </button>
            )}
            {showSavedManualAdjustment && (
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                수동 조정 {formatSignedCurrency(savedManualDifference || 0)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5 lg:items-end">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[12px] font-semibold text-slate-500">공급가</span>
                <span className="text-[14px] font-bold text-slate-950">{formatCurrency(displaySubtotal)}</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[12px] font-semibold text-slate-500">부가세</span>
                <span className="text-[14px] font-bold text-slate-950">{formatCurrency(displayTax)}</span>
              </div>
              {isEditing && editMode === 'manual' ? (
                <div className="flex flex-col gap-1 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-blue-700">VAT 포함 최종금액</span>
                    <Input
                      inputMode="numeric"
                      value={manualTotal}
                      onChange={(e) => handleManualTotalChange(e.target.value)}
                      className="h-8 w-40 rounded border-blue-200 bg-white text-right text-[16px] font-black text-slate-950"
                    />
                    <span className="text-[13px] font-bold text-blue-700">원</span>
                  </div>
                  <div className="text-right text-[11px] font-semibold text-slate-500">
                    자동 계산 대비 {formatSignedCurrency(manualDifference)}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2">
                  <span className="text-[13px] font-bold text-blue-700">총 합계</span>
                  <span className="text-[20px] font-black text-blue-700">{formatCurrency(displayTotal)}</span>
                </div>
              )}
            </div>
            <p className="text-[12px] text-slate-500">* 배송비는 별도 입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteTotalSection;
