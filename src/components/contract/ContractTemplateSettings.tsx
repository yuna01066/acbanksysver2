import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, FileText, Pencil, Trash2, Loader2, FileSignature, DollarSign } from 'lucide-react';
import { useContractTemplates, type ContractTemplate } from '@/hooks/useContracts';

const TEMPLATE_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  labor: {
    label: '근로계약서',
    icon: <FileSignature className="h-5 w-5" />,
    color: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  },
  salary: {
    label: '연봉계약서',
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  },
};

interface TemplateForm {
  name: string;
  template_type: string;
  description: string;
  pay_day: number;
  is_active: boolean;
}

const emptyForm: TemplateForm = {
  name: '',
  template_type: 'labor',
  description: '',
  pay_day: 25,
  is_active: true,
};

const ContractTemplateSettings: React.FC = () => {
  const { templates, loading, refresh } = useContractTemplatesWithRefresh();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: ContractTemplate) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      template_type: t.template_type,
      description: t.description || '',
      pay_day: t.pay_day,
      is_active: t.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('양식 이름을 입력해주세요.'); return; }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('contract_templates')
          .update({
            name: form.name.trim(),
            template_type: form.template_type,
            description: form.description.trim() || null,
            pay_day: form.pay_day,
            is_active: form.is_active,
          })
          .eq('id', editingId);
        if (error) throw error;
        toast.success('양식이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert({
            name: form.name.trim(),
            template_type: form.template_type,
            description: form.description.trim() || null,
            pay_day: form.pay_day,
            is_active: form.is_active,
          });
        if (error) throw error;
        toast.success('양식이 생성되었습니다.');
      }
      setDialogOpen(false);
      refresh();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('양식이 삭제되었습니다.');
      setDeleteTarget(null);
      refresh();
    } catch (e: any) {
      toast.error('삭제 실패: ' + e.message);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (t: ContractTemplate) => {
    const { error } = await supabase
      .from('contract_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id);
    if (error) {
      toast.error('상태 변경 실패');
    } else {
      toast.success(t.is_active ? '비활성화되었습니다.' : '활성화되었습니다.');
      refresh();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">계약서 양식 관리</h3>
          <p className="text-sm text-muted-foreground">근로계약서 및 연봉계약서 양식을 생성하고 관리합니다.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" /> 새 양식 만들기
        </Button>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">등록된 계약서 양식이 없습니다.</p>
            <p className="text-xs mt-1">새 양식을 만들어 계약서를 작성해보세요.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map(t => {
            const typeInfo = TEMPLATE_TYPES[t.template_type] || TEMPLATE_TYPES.labor;
            return (
              <Card key={t.id} className={`transition-all ${!t.is_active ? 'opacity-50' : ''}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${typeInfo.color}`}>
                        {typeInfo.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{t.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[11px]">{typeInfo.label}</Badge>
                          <Badge variant="outline" className="text-[11px]">급여일 {t.pay_day}일</Badge>
                          {!t.is_active && (
                            <Badge variant="secondary" className="text-[11px]">비활성</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteTarget(t)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mb-3">{t.description}</p>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">활성 상태</span>
                    <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? '양식 수정' : '새 계약서 양식 만들기'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>양식 이름 *</Label>
              <Input
                placeholder="예: 정규직 근로계약서"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>계약서 유형 *</Label>
              <Select value={form.template_type} onValueChange={v => setForm(f => ({ ...f, template_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="labor">
                    <span className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-blue-600" /> 근로계약서
                    </span>
                  </SelectItem>
                  <SelectItem value="salary">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" /> 연봉계약서
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>급여일</Label>
              <Select value={String(form.pay_day)} onValueChange={v => setForm(f => ({ ...f, pay_day: Number(v) }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 5, 10, 15, 20, 25].map(d => (
                    <SelectItem key={d} value={String(d)}>매월 {d}일</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>설명</Label>
              <Textarea
                placeholder="양식에 대한 설명을 입력하세요"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>활성 상태</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>취소</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingId ? '수정' : '생성'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>양식을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" 양식이 영구적으로 삭제됩니다. 이 양식으로 생성된 기존 계약서에는 영향을 주지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Extended hook that includes refresh and returns all templates (not just active)
function useContractTemplatesWithRefresh() {
  const [templates, setTemplates] = React.useState<ContractTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at');
    if (data) setTemplates(data as ContractTemplate[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { templates, loading, refresh: fetch };
}

export default ContractTemplateSettings;
