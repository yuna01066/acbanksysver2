import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { DEDUCTION_CATEGORIES, type TaxSettlement, type TaxDeductionItem, type TaxDependent } from '@/hooks/useYearEndTax';

interface Props {
  settlement: TaxSettlement;
  deductionItems: TaxDeductionItem[];
  dependents: TaxDependent[];
  onAdd: (item: any) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isEditable: boolean;
}

const TaxDeductionsTab: React.FC<Props> = ({ settlement, deductionItems, dependents, onAdd, onDelete, isEditable }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ category: '', sub_category: '', amount: '', description: '', dependent_id: '' });

  const selectedCategory = form.category ? DEDUCTION_CATEGORIES[form.category as keyof typeof DEDUCTION_CATEGORIES] : null;

  const handleSubmit = async () => {
    if (!form.category || !form.sub_category || !form.amount) return;
    await onAdd({
      settlement_id: settlement.id,
      user_id: user!.id,
      category: form.category,
      sub_category: form.sub_category,
      amount: Number(form.amount),
      description: form.description || null,
      dependent_id: form.dependent_id || null,
    });
    setForm({ category: '', sub_category: '', amount: '', description: '', dependent_id: '' });
    setOpen(false);
  };

  const formatAmount = (n: number) => n.toLocaleString('ko-KR') + '원';

  const getCategoryTotal = (catKey: string) =>
    deductionItems.filter(i => i.category === catKey).reduce((s, i) => s + Number(i.amount), 0);

  const totalDeductions = deductionItems.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" /> 소득·세액 공제자료 입력
            </CardTitle>
            <CardDescription>각 항목별 공제 금액을 입력하세요.</CardDescription>
          </div>
          {isEditable && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> 항목 추가</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>공제항목 추가</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>공제 분류 *</Label>
                    <Select value={form.category} onValueChange={(v) => setForm(p => ({ ...p, category: v, sub_category: '' }))}>
                      <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(DEDUCTION_CATEGORIES).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {selectedCategory && (
                    <div>
                      <Label>세부 항목 *</Label>
                      <Select value={form.sub_category} onValueChange={(v) => setForm(p => ({ ...p, sub_category: v }))}>
                        <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          {selectedCategory.items.map(i => (
                            <SelectItem key={i.key} value={i.key}>{i.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>금액 (원) *</Label>
                    <Input type="number" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} placeholder="0" />
                  </div>
                  {dependents.length > 0 && (
                    <div>
                      <Label>대상자</Label>
                      <Select value={form.dependent_id} onValueChange={(v) => setForm(p => ({ ...p, dependent_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="본인" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="self">본인</SelectItem>
                          {dependents.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name} ({d.relationship})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div>
                    <Label>메모</Label>
                    <Input value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="선택사항" />
                  </div>
                  <Button onClick={handleSubmit} className="w-full" disabled={!form.category || !form.sub_category || !form.amount}>
                    추가
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {deductionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">등록된 공제항목이 없습니다.</p>
        ) : (
          <>
            <div className="mb-4 p-3 rounded-lg bg-primary/5 border">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">총 공제자료 합계</span>
                <span className="text-lg font-bold text-primary">{formatAmount(totalDeductions)}</span>
              </div>
            </div>
            <Accordion type="multiple" className="space-y-2">
              {Object.entries(DEDUCTION_CATEGORIES).map(([catKey, catInfo]) => {
                const items = deductionItems.filter(i => i.category === catKey);
                if (items.length === 0) return null;
                const catTotal = getCategoryTotal(catKey);
                return (
                  <AccordionItem key={catKey} value={catKey} className="border rounded-lg px-3">
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between w-full mr-2">
                        <span className="text-sm font-medium">{catInfo.label}</span>
                        <span className="text-sm font-semibold">{formatAmount(catTotal)}</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pb-2">
                        {items.map((item) => {
                          const subLabel = catInfo.items.find(i => i.key === item.sub_category)?.label || item.sub_category;
                          const dep = dependents.find(d => d.id === item.dependent_id);
                          return (
                            <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                              <div>
                                <span>{subLabel}</span>
                                {dep && <span className="text-xs text-muted-foreground ml-1">({dep.name})</span>}
                                {item.description && <span className="text-xs text-muted-foreground ml-1">- {item.description}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{formatAmount(Number(item.amount))}</span>
                                {isEditable && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(item.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TaxDeductionsTab;
