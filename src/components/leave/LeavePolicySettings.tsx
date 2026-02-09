import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, Settings2, Calendar, Clock, Shield, Sparkles, ChevronRight, Loader2, Save, Trash2 } from 'lucide-react';

interface LeavePolicy {
  id: string;
  policy_name: string;
  description: string | null;
  grant_basis: string;
  leave_unit: string;
  allow_advance_use: boolean;
  grant_method: string;
  auto_expire_enabled: boolean;
  auto_expire_type: string;
  smart_promotion: string;
  approver_required: boolean;
  is_default: boolean;
}

const GRANT_BASIS_LABELS: Record<string, string> = {
  join_date: '입사일',
  fiscal_year: '회계연도',
};

const LEAVE_UNIT_LABELS: Record<string, string> = {
  hour: '시간',
  half_day: '반차',
  day: '일',
};

const GRANT_METHOD_LABELS: Record<string, string> = {
  monthly_accrual: '매월 개근시 1일 부여 · 첫 회계일에 근무한 ...',
  annual_grant: '연 단위 일괄 부여',
  proportional: '비례 부여',
};

const AUTO_EXPIRE_LABELS: Record<string, string> = {
  annual_monthly: '연차 · 월차 설정됨',
  annual_only: '연차만 설정됨',
  none: '설정 안 함',
};

const SMART_PROMOTION_LABELS: Record<string, string> = {
  none: '사용 안 함',
  enabled: '사용',
};

const LeavePolicySettings: React.FC = () => {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<LeavePolicy | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    policy_name: '',
    description: '',
    grant_basis: 'join_date',
    leave_unit: 'day',
    allow_advance_use: false,
    grant_method: 'monthly_accrual',
    auto_expire_enabled: true,
    auto_expire_type: 'annual_monthly',
    smart_promotion: 'none',
    approver_required: false,
  });

  const fetchPolicies = async () => {
    const { data } = await supabase
      .from('leave_policy_settings')
      .select('*')
      .order('created_at');
    if (data) setPolicies(data as LeavePolicy[]);
    setLoading(false);
  };

  useEffect(() => { fetchPolicies(); }, []);

  const openCreateDialog = () => {
    setEditingPolicy(null);
    setForm({
      policy_name: '', description: '', grant_basis: 'join_date', leave_unit: 'day',
      allow_advance_use: false, grant_method: 'monthly_accrual',
      auto_expire_enabled: true, auto_expire_type: 'annual_monthly',
      smart_promotion: 'none', approver_required: false,
    });
    setDialogOpen(true);
  };

  const openEditDialog = (policy: LeavePolicy) => {
    setEditingPolicy(policy);
    setForm({
      policy_name: policy.policy_name,
      description: policy.description || '',
      grant_basis: policy.grant_basis,
      leave_unit: policy.leave_unit,
      allow_advance_use: policy.allow_advance_use,
      grant_method: policy.grant_method,
      auto_expire_enabled: policy.auto_expire_enabled,
      auto_expire_type: policy.auto_expire_type,
      smart_promotion: policy.smart_promotion,
      approver_required: policy.approver_required,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.policy_name.trim()) {
      toast.error('정책 이름을 입력하세요.');
      return;
    }
    setSaving(true);
    try {
      if (editingPolicy) {
        const { error } = await supabase
          .from('leave_policy_settings')
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq('id', editingPolicy.id);
        if (error) throw error;
        toast.success('정책이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('leave_policy_settings')
          .insert(form);
        if (error) throw error;
        toast.success('정책이 추가되었습니다.');
      }
      setDialogOpen(false);
      await fetchPolicies();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 정책을 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('leave_policy_settings').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패: ' + error.message);
      return;
    }
    toast.success('삭제되었습니다.');
    await fetchPolicies();
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* 연차 정책 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">연차 정책</h2>
          <Button variant="outline" size="sm" className="gap-1" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" /> 연차 정책 추가
          </Button>
        </div>

        {policies.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">등록된 정책이 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {policies.map(policy => (
              <Card key={policy.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openEditDialog(policy)}>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">부여 기준일</p>
                      <p className="text-sm font-medium">{GRANT_BASIS_LABELS[policy.grant_basis] || policy.grant_basis}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">사용 단위</p>
                      <p className="text-sm font-medium">{LEAVE_UNIT_LABELS[policy.leave_unit] || policy.leave_unit} 단위</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">승인 · 참조</p>
                      <p className="text-sm font-medium text-muted-foreground">{policy.approver_required ? '사용' : '없음'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">스마트 연차 촉진</p>
                      <p className="text-sm font-medium text-muted-foreground">{SMART_PROMOTION_LABELS[policy.smart_promotion] || policy.smart_promotion}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* 연차 설정 */}
      <section>
        <h2 className="text-lg font-bold mb-4">연차 설정</h2>
        <div className="space-y-3">
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Settings2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">퇴직자 연차 조정 기준 설정</p>
                  <p className="text-xs text-muted-foreground">퇴직자 잔여 연차 조정 시, 부여량 기준을 선택하는 설정이에요.</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                구성원에게 유리한 기준으로 적용
                <ChevronRight className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">연차 촉진 설정</p>
                  <p className="text-xs text-muted-foreground">구성원에게 연차 사용 촉진 시, 기본적으로 적용되는 설정이에요.</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Policy Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {editingPolicy ? '연차 정책 수정' : '연차 정책 이름'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* Policy Name & Description */}
            <div className="space-y-3">
              <Input
                placeholder="연차 정책 이름"
                value={form.policy_name}
                onChange={e => setForm({ ...form, policy_name: e.target.value })}
                className="text-base"
              />
              <Input
                placeholder="이 연차 정책에 대한 설명을 입력해주세요"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="text-sm"
              />
            </div>

            <Separator />

            {/* 기본 설정 */}
            <div>
              <h3 className="font-semibold mb-4">기본 설정</h3>
              <div className="space-y-5">
                {/* 승인·참조자 선택 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">승인 · 참조자 선택</p>
                    <p className="text-xs text-muted-foreground">승인 참조 대상을 선택해 주세요.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{form.approver_required ? '사용' : '사용 안 함'}</span>
                    <Switch checked={form.approver_required} onCheckedChange={v => setForm({ ...form, approver_required: v })} />
                  </div>
                </div>

                {/* 연차 사용 단위 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">연차 사용 단위</p>
                    <p className="text-xs text-muted-foreground">연차의 사용 단위를 설정해 주세요.</p>
                  </div>
                  <div className="flex border rounded-lg overflow-hidden">
                    {(['hour', 'half_day', 'day'] as const).map(unit => (
                      <button
                        key={unit}
                        className={`px-4 py-2 text-sm transition-colors ${form.leave_unit === unit ? 'bg-foreground text-background font-medium' : 'bg-background text-foreground hover:bg-muted'}`}
                        onClick={() => setForm({ ...form, leave_unit: unit })}
                      >
                        {LEAVE_UNIT_LABELS[unit]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 당겨쓰기 허용 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">당겨쓰기 허용</p>
                    <p className="text-xs text-muted-foreground">연차 초과 사용에 대한 허용 여부를 설정할 수 있어요.</p>
                  </div>
                  <Switch checked={form.allow_advance_use} onCheckedChange={v => setForm({ ...form, allow_advance_use: v })} />
                </div>
              </div>
            </div>

            <Separator />

            {/* 연차 부여 · 소멸 설정 */}
            <div>
              <h3 className="font-semibold mb-4">연차 부여 · 소멸 설정</h3>
              <div className="space-y-5">
                {/* 연차 부여 방식 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">연차 부여 방식</p>
                    <p className="text-xs text-muted-foreground">연차 부여 기준을 설정할 수 있어요.</p>
                  </div>
                  <button
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => {
                      const methods = Object.keys(GRANT_METHOD_LABELS);
                      const idx = methods.indexOf(form.grant_method);
                      setForm({ ...form, grant_method: methods[(idx + 1) % methods.length] });
                    }}
                  >
                    {GRANT_METHOD_LABELS[form.grant_method]?.substring(0, 25)}...
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* 자동 소멸 설정 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">자동 소멸 설정</p>
                    <p className="text-xs text-muted-foreground">자동 소멸 시점과 유예 기간을 설정할 수 있어요.</p>
                  </div>
                  <button
                    className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => {
                      const types = Object.keys(AUTO_EXPIRE_LABELS);
                      const idx = types.indexOf(form.auto_expire_type);
                      setForm({ ...form, auto_expire_type: types[(idx + 1) % types.length] });
                    }}
                  >
                    {AUTO_EXPIRE_LABELS[form.auto_expire_type]}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* 스마트 연차 촉진 */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">스마트 연차 촉진</p>
                    <p className="text-xs text-muted-foreground">구성원의 연차 사용 계획 작성을 자동으로 요청합니다.</p>
                  </div>
                  <select
                    value={form.smart_promotion}
                    onChange={e => setForm({ ...form, smart_promotion: e.target.value })}
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                  >
                    {Object.entries(SMART_PROMOTION_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {editingPolicy && !editingPolicy.is_default && (
                <Button variant="destructive" size="sm" className="gap-1" onClick={() => { handleDelete(editingPolicy.id); setDialogOpen(false); }}>
                  <Trash2 className="h-4 w-4" /> 삭제
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                저장하기
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LeavePolicySettings;
