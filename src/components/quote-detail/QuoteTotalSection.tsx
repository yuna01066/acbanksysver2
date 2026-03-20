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
    <div className="mb-6 rounded-lg bg-[hsl(220,30%,94%)] border border-[hsl(220,25%,82%)] print-total quote-section">
      <div className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-bold text-black bg-white px-4 py-2 rounded-lg border border-gray-200">총 견적 금액</h2>
            {isEditing && (
              <button
                onClick={handleToggleManual}
                className={`text-[11px] px-3 py-1.5 rounded-lg border transition-colors ${
                  editMode === 'manual'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {editMode === 'manual' ? '직접입력 중' : '금액 직접입력'}
              </button>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-1">
            <div className="flex items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500">소계 (부가세 별도)</span>
                <span className="text-[14px] font-bold text-black">{displaySubtotal.toLocaleString()}원</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-semibold text-gray-500">부가세 (10%)</span>
                <span className="text-[14px] font-bold text-black">{displayTax.toLocaleString()}원</span>
              </div>
              {isEditing && editMode === 'manual' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg">
                  <span className="text-[13px] font-bold text-white">총 합계</span>
                  <Input
                    type="number"
                    value={manualTotal}
                    onChange={(e) => handleManualTotalChange(e.target.value)}
                    className="w-36 h-8 text-[16px] font-black text-right bg-white text-black border-0 rounded"
                  />
                  <span className="text-[13px] font-bold text-white">원</span>
                </div>
              ) : (
                <div className="flex items-center gap-3 px-4 py-2 bg-gray-900 rounded-lg">
                  <span className="text-[13px] font-bold text-white">총 합계</span>
                  <span className="text-[18px] font-black text-white">{displayTotal.toLocaleString()}원</span>
                </div>
              )}
            </div>
            <p className="text-[12px] text-gray-500">* 배송비는 별도 입니다.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteTotalSection;
