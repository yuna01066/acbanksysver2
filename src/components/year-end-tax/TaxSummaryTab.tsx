import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Send, Calculator, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DEDUCTION_CATEGORIES, type TaxSettlement, type TaxDeductionItem, type TaxDependent, type TaxDocument } from '@/hooks/useYearEndTax';

interface Props {
  settlement: TaxSettlement;
  dependents: TaxDependent[];
  deductionItems: TaxDeductionItem[];
  documents: TaxDocument[];
  onUpdateSettlement: (updates: any) => Promise<void>;
  onSubmit: () => Promise<void>;
  isEditable: boolean;
}

const TaxSummaryTab: React.FC<Props> = ({
  settlement,
  dependents,
  deductionItems,
  documents,
  onUpdateSettlement,
  onSubmit,
  isEditable,
}) => {
  const [simulating, setSimulating] = useState(false);
  const [salary, setSalary] = useState(String(settlement.total_salary || ''));
  const [taxPaid, setTaxPaid] = useState(String(settlement.total_tax_paid || ''));
  const [localTaxPaid, setLocalTaxPaid] = useState(String(settlement.total_local_tax_paid || ''));

  const formatAmount = (n: number) => n.toLocaleString('ko-KR') + '원';

  const totalDeductions = deductionItems.reduce((s, i) => s + Number(i.amount), 0);
  const basicDeductionCount = dependents.filter(d => d.basic_deduction).length + 1; // +1 for self

  const handleSaveSalary = async () => {
    await onUpdateSettlement({
      total_salary: Number(salary) || 0,
      total_tax_paid: Number(taxPaid) || 0,
      total_local_tax_paid: Number(localTaxPaid) || 0,
    });
    toast.success('근로소득 정보가 저장되었습니다.');
  };

  const handleSimulate = async () => {
    if (!salary || Number(salary) <= 0) {
      toast.error('총급여를 먼저 입력하세요.');
      return;
    }
    setSimulating(true);
    try {
      const { data, error } = await supabase.functions.invoke('simulate-tax', {
        body: {
          total_salary: Number(salary),
          total_tax_paid: Number(taxPaid) || 0,
          total_local_tax_paid: Number(localTaxPaid) || 0,
          basic_deduction_count: basicDeductionCount,
          dependents: dependents.map(d => ({
            relationship: d.relationship,
            is_disabled: d.is_disabled,
            is_senior: d.is_senior,
            is_child_under6: d.is_child_under6,
            is_single_parent: d.is_single_parent,
          })),
          deductions: Object.entries(DEDUCTION_CATEGORIES).map(([catKey, catInfo]) => ({
            category: catInfo.label,
            total: deductionItems.filter(i => i.category === catKey).reduce((s, i) => s + Number(i.amount), 0),
          })).filter(d => d.total > 0),
        },
      });

      if (error) throw error;

      await onUpdateSettlement({
        total_salary: Number(salary),
        total_tax_paid: Number(taxPaid) || 0,
        total_local_tax_paid: Number(localTaxPaid) || 0,
        estimated_tax: data.estimated_tax || 0,
        estimated_refund: data.estimated_refund || 0,
      });
      toast.success('예상 세액이 계산되었습니다.');
    } catch (err) {
      toast.error('세액 시뮬레이션에 실패했습니다. 잠시 후 다시 시도하세요.');
    }
    setSimulating(false);
  };

  const canSubmit = isEditable && Number(salary) > 0 && settlement.status !== 'submitted';

  return (
    <div className="space-y-4">
      {/* 근로소득 입력 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">근로소득 정보</CardTitle>
          <CardDescription>{settlement.tax_year}년도 총 급여 및 기납부세액을 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>총 급여</Label>
              <Input
                type="number" value={salary}
                onChange={(e) => setSalary(e.target.value)}
                placeholder="0" disabled={!isEditable}
              />
            </div>
            <div>
              <Label>기납부 소득세</Label>
              <Input
                type="number" value={taxPaid}
                onChange={(e) => setTaxPaid(e.target.value)}
                placeholder="0" disabled={!isEditable}
              />
            </div>
            <div>
              <Label>기납부 지방소득세</Label>
              <Input
                type="number" value={localTaxPaid}
                onChange={(e) => setLocalTaxPaid(e.target.value)}
                placeholder="0" disabled={!isEditable}
              />
            </div>
          </div>
          {isEditable && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSaveSalary}>저장</Button>
              <Button size="sm" onClick={handleSimulate} disabled={simulating}>
                {simulating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Calculator className="h-4 w-4 mr-1" />}
                예상 세액 계산
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">연말정산 요약</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">부양가족</p>
              <p className="text-lg font-bold">{dependents.length}명</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">공제항목</p>
              <p className="text-lg font-bold">{deductionItems.length}건</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">제출서류</p>
              <p className="text-lg font-bold">{documents.length}건</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-muted/50">
              <p className="text-xs text-muted-foreground">총 공제금액</p>
              <p className="text-lg font-bold">{formatAmount(totalDeductions)}</p>
            </div>
          </div>

          <Separator />

          {(settlement.estimated_tax > 0 || settlement.estimated_refund !== 0) && (
            <div className={`p-4 rounded-lg ${settlement.estimated_refund > 0 ? 'bg-green-50 border border-green-200' : settlement.estimated_refund < 0 ? 'bg-red-50 border border-red-200' : 'bg-muted/50'}`}>
              <div className="flex items-center gap-2 mb-2">
                {settlement.estimated_refund > 0 ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                )}
                <span className="font-medium">
                  {settlement.estimated_refund > 0 ? '예상 환급액' : '예상 추가납부액'}
                </span>
              </div>
              <p className={`text-2xl font-bold ${settlement.estimated_refund > 0 ? 'text-green-700' : 'text-red-700'}`}>
                {formatAmount(Math.abs(settlement.estimated_refund))}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                * 참고용 시뮬레이션이며, 실제 정산 결과와 차이가 있을 수 있습니다.
              </p>
            </div>
          )}

          {/* 분납 설정 */}
          {settlement.estimated_refund < 0 && (
            <div className="p-3 rounded-lg border">
              <div className="flex items-center justify-between mb-2">
                <Label>분납 설정</Label>
                <Switch
                  checked={settlement.installment_enabled}
                  onCheckedChange={(v) => onUpdateSettlement({ installment_enabled: v })}
                  disabled={!isEditable}
                />
              </div>
              {settlement.installment_enabled && (
                <Select
                  value={String(settlement.installment_months)}
                  onValueChange={(v) => onUpdateSettlement({ installment_months: Number(v) })}
                  disabled={!isEditable}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}개월 분납</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <Separator />

          {/* 제출 */}
          {isEditable && canSubmit && (
            <Button onClick={onSubmit} className="w-full" size="lg">
              <Send className="h-5 w-5 mr-2" /> 연말정산 자료 제출
            </Button>
          )}

          {settlement.status === 'submitted' && (
            <div className="text-center p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <CheckCircle2 className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
              <p className="font-medium text-indigo-800">제출 완료</p>
              <p className="text-sm text-indigo-600">관리자가 검토 중입니다.</p>
            </div>
          )}

          {settlement.status === 'confirmed' && (
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-green-800">연말정산 확정</p>
              {settlement.final_refund !== 0 && (
                <p className="text-lg font-bold text-green-700 mt-1">
                  {settlement.final_refund > 0 ? '환급' : '추가납부'}: {formatAmount(Math.abs(settlement.final_refund))}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxSummaryTab;
