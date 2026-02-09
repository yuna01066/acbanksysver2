import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Check } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ResignationAdjustmentDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const [basis, setBasis] = useState<string>('favorable_to_employee');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('leave_general_settings')
      .select('setting_value')
      .eq('setting_key', 'resignation_adjustment')
      .single()
      .then(({ data }) => {
        if (data?.setting_value) {
          const val = data.setting_value as any;
          setBasis(val.basis || 'favorable_to_employee');
        }
        setLoading(false);
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('leave_general_settings')
      .update({
        setting_value: { basis },
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'resignation_adjustment');
    setSaving(false);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
    }
    toast.success('변경 사항이 적용되었습니다.');
    onOpenChange(false);
  };

  const OPTIONS = [
    {
      value: 'favorable_to_employee',
      label: '구성원에게 유리한 기준으로 적용',
      badge: '기본',
      desc: '근로기준법 기준과 실제 회사 부여량 중, 더 큰 값을 기준으로 조정합니다.',
    },
    {
      value: 'labor_law_standard',
      label: '항상 근로기준법 기준으로 적용',
      desc: '실제 회사 부여량이 더 많을 때도, 근로기준법 기준으로 조정합니다.',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>퇴직자 연차 조정 기준 설정</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-6 mt-2">
            <div>
              <h3 className="font-semibold text-base mb-1">조정 기준</h3>
              <p className="text-sm text-muted-foreground mb-4">퇴직자 잔여 연차 조정 시, 필요한 기준을 설정합니다.</p>

              <div className="space-y-3">
                {OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setBasis(opt.value)}
                    className={`w-full text-left p-4 rounded-lg border transition-colors ${basis === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {opt.badge && <Badge variant="secondary" className="text-xs">{opt.badge}</Badge>}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${basis === opt.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                        {basis === opt.value && <Check className="h-3 w-3 text-primary-foreground" />}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Example table */}
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">예시</TableHead>
                    <TableHead className="text-xs text-center">조정 기준</TableHead>
                  </TableRow>
                  <TableRow>
                    <TableHead className="text-xs">구성원</TableHead>
                    <TableHead className="text-xs text-center">근로기준법 기준 부여량</TableHead>
                    <TableHead className="text-xs text-center">실제 회사 부여량</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="text-sm">김연차</TableCell>
                    <TableCell className={`text-sm text-center ${basis === 'favorable_to_employee' || basis === 'labor_law_standard' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-medium' : ''}`}>
                      <span className="flex items-center justify-center gap-1">
                        {(basis === 'favorable_to_employee') && <Check className="h-3 w-3" />}
                        15일
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-center">10일</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="text-sm">김조정</TableCell>
                    <TableCell className={`text-sm text-center ${basis === 'labor_law_standard' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-medium' : ''}`}>
                      15일
                    </TableCell>
                    <TableCell className={`text-sm text-center ${basis === 'favorable_to_employee' ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 font-medium' : ''}`}>
                      <span className="flex items-center justify-center gap-1">
                        {basis === 'favorable_to_employee' && <Check className="h-3 w-3" />}
                        20일
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              변경 사항 적용하기
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ResignationAdjustmentDialog;
