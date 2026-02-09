import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  smartPromotionEnabled: boolean;
}

interface PromotionSettings {
  approval_target: string;
  member_reminder: boolean;
  admin_reminder: boolean;
  plan_notification_days: number;
  annual_promotion_timing: string;
  monthly_1st_timing: string;
  monthly_2nd_timing: string;
}

const NOTIFICATION_DAYS_OPTIONS = [
  { value: 5, label: '사용 계획일 5일 전' },
  { value: 10, label: '사용 계획일 10일 전' },
  { value: 15, label: '사용 계획일 15일 전' },
  { value: 30, label: '사용 계획일 30일 전' },
];

const ANNUAL_TIMING_OPTIONS = [
  { value: '6months_before', label: '소멸 6개월 전' },
  { value: '3months_before', label: '소멸 3개월 전' },
  { value: '1month_before', label: '소멸 1개월 전' },
];

const MONTHLY_TIMING_OPTIONS = [
  { value: '3months_before', label: '소멸 3개월 전' },
  { value: '2months_before', label: '소멸 2개월 전' },
  { value: '1month_before', label: '소멸 1개월 전' },
];

const LeavePromotionDialog: React.FC<Props> = ({ open, onOpenChange, smartPromotionEnabled }) => {
  const [settings, setSettings] = useState<PromotionSettings>({
    approval_target: 'none',
    member_reminder: false,
    admin_reminder: false,
    plan_notification_days: 10,
    annual_promotion_timing: '6months_before',
    monthly_1st_timing: '3months_before',
    monthly_2nd_timing: '1month_before',
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    supabase
      .from('leave_general_settings')
      .select('setting_value')
      .eq('setting_key', 'leave_promotion')
      .single()
      .then(({ data }) => {
        if (data?.setting_value) {
          setSettings({ ...settings, ...(data.setting_value as any) });
        }
        setLoading(false);
      });
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('leave_general_settings')
      .update({
        setting_value: settings as any,
        updated_at: new Date().toISOString(),
      })
      .eq('setting_key', 'leave_promotion');
    setSaving(false);
    if (error) {
      toast.error('저장 실패: ' + error.message);
      return;
    }
    toast.success('변경 사항이 저장되었습니다.');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>연차 촉진 설정</DialogTitle>
          <p className="text-sm text-muted-foreground">구성원에게 연차 사용 촉진 시, 기본적으로 적용되는 설정이에요.</p>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-6 mt-2">
            {/* 승인·참조 대상 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">승인 · 참조 대상</p>
                <p className="text-xs text-muted-foreground">구성원이 작성한 연차 사용 계획의 승인 · 참조 대상을 설정할 수 있어요.</p>
              </div>
              <button className="text-sm text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                {settings.approval_target === 'none' ? '사용 안 함' : '사용'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <Separator />

            {/* 구성원 작성 리마인드 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">구성원 작성 리마인드</p>
                <p className="text-xs text-muted-foreground">구성원에게 사용 계획 작성 알림을 제출 기한 동안 매일 보내요.</p>
              </div>
              <Switch
                checked={settings.member_reminder}
                onCheckedChange={v => setSettings({ ...settings, member_reminder: v })}
              />
            </div>

            {/* 관리자 작성 리마인드 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">관리자 작성 리마인드</p>
                <p className="text-xs text-muted-foreground">관리자에게 사용 계획 작성 알림을 제출 기한 동안 매일 보내요.</p>
              </div>
              <Switch
                checked={settings.admin_reminder}
                onCheckedChange={v => setSettings({ ...settings, admin_reminder: v })}
              />
            </div>

            {/* 사용 계획일 알림 시점 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">사용 계획일 알림 시점</p>
                <p className="text-xs text-muted-foreground">구성원에게 사용 계획일 이전에 알림을 보내요.</p>
              </div>
              <Select
                value={String(settings.plan_notification_days)}
                onValueChange={v => setSettings({ ...settings, plan_notification_days: Number(v) })}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTIFICATION_DAYS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* 스마트 연차 촉진 */}
            <div>
              <h3 className="font-semibold text-base mb-1">스마트 연차 촉진</h3>
              <p className="text-sm text-muted-foreground mb-4">
                스마트 연차 촉진 사용 시, 근로기준법을 준수한 연차 촉진을 자동화할 수 있어요.
              </p>

              {!smartPromotionEnabled && (
                <div className="rounded-lg border bg-muted/50 p-4 mb-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">스마트 연차 촉진이 비활성되어 있어요.</p>
                      <p className="text-xs text-muted-foreground">활성화하려면 '연차 정책 → 스마트 연차 촉진' 을 사용함으로 변경해주세요.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* 연차 촉진 시점 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">연차 촉진 시점</p>
                    <p className="text-xs text-muted-foreground">1년 이상 재직 구성원의 자동 촉진 시점</p>
                  </div>
                  <Select
                    value={settings.annual_promotion_timing}
                    onValueChange={v => setSettings({ ...settings, annual_promotion_timing: v })}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ANNUAL_TIMING_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* 월차 촉진 시점 */}
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">월차 촉진 시점</p>
                    <p className="text-xs text-muted-foreground">1년 미만 재직 구성원의 자동 촉진 시점</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">1차</Badge>
                      <Select
                        value={settings.monthly_1st_timing}
                        onValueChange={v => setSettings({ ...settings, monthly_1st_timing: v })}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHLY_TIMING_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">2차</Badge>
                      <Select
                        value={settings.monthly_2nd_timing}
                        onValueChange={v => setSettings({ ...settings, monthly_2nd_timing: v })}
                      >
                        <SelectTrigger className="w-[160px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MONTHLY_TIMING_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                ※ 스마트 연차 촉진은 소멸 유예 설정과 관계없이 법정 연차 소멸일을 기준으로 실행됩니다.
              </p>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              변경 사항 저장
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LeavePromotionDialog;
