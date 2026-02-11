import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Edit2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { TaxSettlement, TaxDependent } from '@/hooks/useYearEndTax';

const RELATIONSHIPS = ['배우자', '직계존속(부)', '직계존속(모)', '직계비속(자녀)', '형제자매', '기타'];

interface Props {
  settlement: TaxSettlement;
  dependents: TaxDependent[];
  onAdd: (dep: any) => Promise<void>;
  onUpdate: (id: string, updates: any) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isEditable: boolean;
}

const TaxDependentsTab: React.FC<Props> = ({ settlement, dependents, onAdd, onUpdate, onDelete, isEditable }) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    relationship: '',
    birth_date: '',
    resident_number: '',
    is_disabled: false,
    disability_type: '',
    is_senior: false,
    is_child_under6: false,
    is_single_parent: false,
    is_woman_deduction: false,
    has_income_limit: true,
    basic_deduction: true,
  });

  const resetForm = () => {
    setForm({
      name: '', relationship: '', birth_date: '', resident_number: '',
      is_disabled: false, disability_type: '', is_senior: false,
      is_child_under6: false, is_single_parent: false, is_woman_deduction: false,
      has_income_limit: true, basic_deduction: true,
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.name || !form.relationship) return;
    if (editingId) {
      await onUpdate(editingId, { ...form, resident_number: form.resident_number || null, birth_date: form.birth_date || null, disability_type: form.disability_type || null });
    } else {
      await onAdd({
        settlement_id: settlement.id,
        user_id: user!.id,
        ...form,
        resident_number: form.resident_number || null,
        birth_date: form.birth_date || null,
        disability_type: form.disability_type || null,
      });
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (dep: TaxDependent) => {
    setForm({
      name: dep.name,
      relationship: dep.relationship,
      birth_date: dep.birth_date || '',
      resident_number: dep.resident_number || '',
      is_disabled: dep.is_disabled,
      disability_type: dep.disability_type || '',
      is_senior: dep.is_senior,
      is_child_under6: dep.is_child_under6,
      is_single_parent: dep.is_single_parent,
      is_woman_deduction: dep.is_woman_deduction,
      has_income_limit: dep.has_income_limit,
      basic_deduction: dep.basic_deduction,
    });
    setEditingId(dep.id);
    setOpen(true);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" /> 부양가족 등록
            </CardTitle>
            <CardDescription>기본공제 대상 부양가족을 등록하세요.</CardDescription>
          </div>
          {isEditable && (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" /> 추가</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingId ? '부양가족 수정' : '부양가족 추가'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>이름 *</Label>
                      <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>관계 *</Label>
                      <Select value={form.relationship} onValueChange={(v) => setForm(p => ({ ...p, relationship: v }))}>
                        <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                        <SelectContent>
                          {RELATIONSHIPS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>생년월일</Label>
                      <Input type="date" value={form.birth_date} onChange={(e) => setForm(p => ({ ...p, birth_date: e.target.value }))} />
                    </div>
                    <div>
                      <Label>주민등록번호</Label>
                      <Input value={form.resident_number} onChange={(e) => setForm(p => ({ ...p, resident_number: e.target.value }))} placeholder="앞6자리-뒤7자리" />
                    </div>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    <p className="text-sm font-medium">추가 공제 여부</p>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">기본공제 적용</Label>
                      <Switch checked={form.basic_deduction} onCheckedChange={(v) => setForm(p => ({ ...p, basic_deduction: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">소득요건 충족</Label>
                      <Switch checked={form.has_income_limit} onCheckedChange={(v) => setForm(p => ({ ...p, has_income_limit: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">장애인</Label>
                      <Switch checked={form.is_disabled} onCheckedChange={(v) => setForm(p => ({ ...p, is_disabled: v }))} />
                    </div>
                    {form.is_disabled && (
                      <div>
                        <Label>장애유형</Label>
                        <Select value={form.disability_type} onValueChange={(v) => setForm(p => ({ ...p, disability_type: v }))}>
                          <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="장애인">장애인</SelectItem>
                            <SelectItem value="상이(국가유공)">상이(국가유공)</SelectItem>
                            <SelectItem value="항시치료">항시치료 필요자</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">경로우대 (70세 이상)</Label>
                      <Switch checked={form.is_senior} onCheckedChange={(v) => setForm(p => ({ ...p, is_senior: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">6세 이하 자녀</Label>
                      <Switch checked={form.is_child_under6} onCheckedChange={(v) => setForm(p => ({ ...p, is_child_under6: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">한부모</Label>
                      <Switch checked={form.is_single_parent} onCheckedChange={(v) => setForm(p => ({ ...p, is_single_parent: v }))} />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">부녀자</Label>
                      <Switch checked={form.is_woman_deduction} onCheckedChange={(v) => setForm(p => ({ ...p, is_woman_deduction: v }))} />
                    </div>
                  </div>

                  <Button onClick={handleSubmit} className="w-full" disabled={!form.name || !form.relationship}>
                    {editingId ? '수정' : '추가'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {dependents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">등록된 부양가족이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {dependents.map((dep) => (
              <div key={dep.id} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{dep.name}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{dep.relationship}</span>
                    {dep.basic_deduction && <span className="text-xs text-green-600">기본공제</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {dep.birth_date && <span className="text-xs text-muted-foreground">{dep.birth_date}</span>}
                    {dep.is_disabled && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 rounded">장애인</span>}
                    {dep.is_senior && <span className="text-xs bg-amber-100 text-amber-700 px-1.5 rounded">경로우대</span>}
                    {dep.is_child_under6 && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">6세이하</span>}
                    {dep.is_single_parent && <span className="text-xs bg-pink-100 text-pink-700 px-1.5 rounded">한부모</span>}
                  </div>
                </div>
                {isEditable && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(dep)}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onDelete(dep.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TaxDependentsTab;
