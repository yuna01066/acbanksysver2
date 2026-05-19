import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";

interface QuoteTotalSectionProps {
  subtotal: number;
  tax: number;
  totalWithTax: number;
  isEditing?: boolean;
  onTotalOverride?: (subtotal: number, tax: number, total: number) => void;
}

const QuoteTotalSection: React.FC<QuoteTotalSectionProps> = ({ subtotal, tax, totalWithTax, isEditing, onTotalOverride }) => {
  const [editMode, setEditMode] = useState<'auto' | 'manual'>('auto');
  const [manualTotal, setManualTotal] = useState<string>('');

  useEffect(() => {
    if (!isEditing) {
      setEditMode('auto');
      setManualTotal('');
    }
  }, [isEditing]);

  // 최종금액에서 역산: 총합계 = 공급가 + 부가세(10%), 공급가 = 총합계 / 1.1
  const handleManualTotalChange = (value: string) => {
    setManualTotal(value);
    const total = Math.round(Number(value) || 0);
    if (total > 0) {
      const newSubtotal = Math.round(total / 1.1 / 100) * 100;
      const newTax = total - newSubtotal;
      onTotalOverride?.(newSubtotal, newTax, total);
    }
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
                {editMode === 'manual' ? '직접입력 중' : '금액 직접입력'}
              </button>
            )}
          </div>
          <div className="flex flex-col gap-1.5 lg:items-end">
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[12px] font-semibold text-slate-500">공급가</span>
                <span className="text-[14px] font-bold text-slate-950">{displaySubtotal.toLocaleString()}원</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-[12px] font-semibold text-slate-500">부가세</span>
                <span className="text-[14px] font-bold text-slate-950">{displayTax.toLocaleString()}원</span>
              </div>
              {isEditing && editMode === 'manual' ? (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2">
                  <span className="text-[13px] font-bold text-blue-700">총 합계</span>
                  <Input
                    type="number"
                    value={manualTotal}
                    onChange={(e) => handleManualTotalChange(e.target.value)}
                    className="h-8 w-36 rounded border-blue-200 bg-white text-right text-[16px] font-black text-slate-950"
                  />
                  <span className="text-[13px] font-bold text-blue-700">원</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-blue-50 px-4 py-2">
                  <span className="text-[13px] font-bold text-blue-700">총 합계</span>
                  <span className="text-[20px] font-black text-blue-700">{displayTotal.toLocaleString()}원</span>
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
