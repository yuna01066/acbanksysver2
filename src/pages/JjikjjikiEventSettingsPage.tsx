import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import jjikjjikiLunchCelebration from '@/assets/hamzzi/jjikjjiki-lunch-celebration.png';
import jjikjjikiLunchSpeechSticker from '@/assets/hamzzi/jjikjjiki-lunch-speech-sticker.png';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { createSettingsChangeRequest } from '@/services/settingsChangeRequests';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  DEFAULT_HAMZZI_EVENT_SETTINGS,
  HAMZZI_EVENT_SETTINGS_KEY,
  parseHamzziEventSettings,
  stringifyHamzziEventSettings,
  type HamzziEventSettings,
  type HamzziManagedEventKey,
} from '@/lib/responseAssistantDefaults';
import { triggerHamzzi, type HamzziEventType } from '@/lib/hamzziEvents';

type ResponseAssistantSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

const HAMZZI_EVENT_KEYS = Object.keys(DEFAULT_HAMZZI_EVENT_SETTINGS) as HamzziManagedEventKey[];

const HAMZZI_EVENT_META: Record<HamzziManagedEventKey, {
  label: string;
  category: 'time' | 'achievement' | 'secret';
  helper: string;
}> = {
  lunch_time: {
    label: '점심시간 찍찍이',
    category: 'time',
    helper: '지정 시간대에 하루 1회 점심 전용 반응을 표시합니다.',
  },
  late_night: {
    label: '야간 마감 알림',
    category: 'time',
    helper: '퇴근 이후 시간대에 마감 안내 반응을 표시합니다.',
  },
  quote_issued: {
    label: '견적 발행 완료',
    category: 'achievement',
    helper: '견적서 발행 성공 시 짧은 성취 반응을 표시합니다.',
  },
  quote_streak_5: {
    label: '견적 5건 발행',
    category: 'achievement',
    helper: '하루 견적 발행 5건 도달 시 표시합니다.',
  },
  work_complete: {
    label: '근무 완료',
    category: 'achievement',
    helper: '근무 진행률 100% 등 완료 이벤트에서 표시합니다.',
  },
  delivery_complete: {
    label: '납기 완료',
    category: 'achievement',
    helper: '납기 완료 처리 시 표시합니다.',
  },
  hidden_click: {
    label: '숨은 클릭 반응',
    category: 'secret',
    helper: '런처를 반복 클릭했을 때 나오는 숨은 반응입니다.',
  },
};

const JjikjjikiEventSettingsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, userRole, isAdmin, isModerator, loading } = useAuth();
  const canManage = userRole === 'admin' || userRole === 'moderator' || isAdmin || isModerator;
  const requiresApproval = isModerator && !isAdmin;
  const [hamzziEventDraft, setHamzziEventDraft] = useState<HamzziEventSettings>(DEFAULT_HAMZZI_EVENT_SETTINGS);

  useEffect(() => {
    if (!loading && !canManage) navigate('/admin-settings');
  }, [canManage, loading, navigate]);

  const { data: hamzziEventSetting, isLoading } = useQuery<ResponseAssistantSetting | null>({
    queryKey: ['response-assistant-setting', HAMZZI_EVENT_SETTINGS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_assistant_settings')
        .select('key, value, description, updated_by, created_at, updated_at')
        .eq('key', HAMZZI_EVENT_SETTINGS_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ResponseAssistantSetting | null;
    },
    enabled: !!user && canManage,
  });

  useEffect(() => {
    setHamzziEventDraft(parseHamzziEventSettings(hamzziEventSetting?.value));
  }, [hamzziEventSetting?.value]);

  const currentHamzziEventSettings = useMemo(
    () => parseHamzziEventSettings(hamzziEventSetting?.value),
    [hamzziEventSetting?.value],
  );
  const hamzziEventChanged = stringifyHamzziEventSettings(hamzziEventDraft)
    !== stringifyHamzziEventSettings(currentHamzziEventSettings);

  const saveHamzziEvents = useMutation({
    mutationFn: async (): Promise<'requested' | 'saved'> => {
      const value = stringifyHamzziEventSettings(hamzziEventDraft);
      const currentValue = stringifyHamzziEventSettings(currentHamzziEventSettings);

      if (requiresApproval) {
        await createSettingsChangeRequest({
          targetArea: 'admin',
          targetTable: 'response_assistant_settings',
          targetKey: HAMZZI_EVENT_SETTINGS_KEY,
          action: 'upsert',
          riskLevel: 'medium',
          changeSummary: '찍찍이 이벤트 반응 설정 변경',
          beforeValue: {
            key: HAMZZI_EVENT_SETTINGS_KEY,
            value: currentValue,
            description: hamzziEventSetting?.description || null,
          },
          afterValue: {
            key: HAMZZI_EVENT_SETTINGS_KEY,
            value,
            description: '찍찍이 이벤트별 활성 여부, 시간 조건, 문구, 표시 시간을 관리하는 JSON 설정',
          },
        });
        return 'requested';
      }

      const { error } = await supabase
        .from('response_assistant_settings')
        .upsert(
          {
            key: HAMZZI_EVENT_SETTINGS_KEY,
            value,
            description: '찍찍이 이벤트별 활성 여부, 시간 조건, 문구, 표시 시간을 관리하는 JSON 설정',
            updated_by: user?.id || null,
          },
          { onConflict: 'key' },
        );
      if (error) throw error;
      return 'saved';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['response-assistant-setting', HAMZZI_EVENT_SETTINGS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['settings-change-requests'] });
      toast.success(
        result === 'requested'
          ? '관리자 승인 요청으로 등록되었습니다.'
          : '찍찍이 이벤트 설정이 저장되었습니다.',
      );
    },
    onError: (error: Error) => toast.error('찍찍이 이벤트 저장 실패: ' + error.message),
  });

  const setHamzziEventSetting = (
    key: HamzziManagedEventKey,
    patch: Partial<HamzziEventSettings[HamzziManagedEventKey]>,
  ) => {
    setHamzziEventDraft((current) => ({
      ...current,
      [key]: {
        ...current[key],
        ...patch,
      },
    }));
  };

  const previewHamzziEvent = (key: HamzziManagedEventKey) => {
    const setting = hamzziEventDraft[key];
    triggerHamzzi(key as HamzziEventType, {
      message: setting.message || DEFAULT_HAMZZI_EVENT_SETTINGS[key].message,
      description: setting.description || '관리자 미리보기',
      durationMs: setting.duration_ms,
      preview: true,
    });
    toast.success('우측 하단에서 찍찍이 미리보기를 재생합니다.');
  };

  if (loading || isLoading) {
    return (
      <PageShell maxWidth="5xl">
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    );
  }

  if (!canManage) return null;

  return (
    <PageShell maxWidth="6xl">
      <PageHeader
        eyebrow="Admin"
        title="찍찍이 이벤트 관리"
        description="점심시간, 성과 순간, 숨은 반응에 표시되는 찍찍이 이벤트를 관리합니다."
        icon={<Sparkles className="h-5 w-5" />}
        meta={(
          <>
            <Badge variant="outline">hamzzi_event_settings</Badge>
            {hamzziEventChanged ? <Badge className="bg-amber-500 text-white">수정 중</Badge> : <Badge variant="outline">저장됨</Badge>}
          </>
        )}
        actions={(
          <Button variant="outline" size="sm" onClick={() => navigate('/admin-settings')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            관리자 설정
          </Button>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-white/60 bg-card/80">
          <CardHeader className="border-b">
            <BrandedCardHeader
              icon={Sparkles}
              title="이벤트 미리보기"
              subtitle="설정은 기존 찍찍이 반응 시스템에 그대로 연결됩니다."
            />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="relative h-56 overflow-hidden rounded-2xl border bg-gradient-to-b from-white to-amber-50/60">
              <img
                src={jjikjjikiLunchSpeechSticker}
                alt=""
                className="absolute left-4 top-4 z-10 w-40 rotate-[-2deg] drop-shadow-[0_10px_14px_rgba(15,23,42,0.16)]"
              />
              <img
                src={jjikjjikiLunchCelebration}
                alt=""
                className="absolute bottom-0 right-3 h-44 w-auto drop-shadow-[0_14px_20px_rgba(15,23,42,0.18)]"
              />
            </div>

            <Alert className="border-blue-200 bg-blue-50 text-blue-950">
              <Clock className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                시간대 이벤트는 시작/종료 시간을 적용하고, 성과 이벤트는 실제 업무 액션이 발생할 때 설정된 문구와 표시 시간을 사용합니다.
              </AlertDescription>
            </Alert>

            <div className="rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
              상담 응대 보조 관리 페이지와 분리되어도 저장 위치는 동일합니다. 기존 운영 데이터와 승인 요청 흐름은 유지됩니다.
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/60 bg-card/80">
          <CardHeader className="border-b">
            <BrandedCardHeader
              icon={Sparkles}
              title="이벤트 설정"
              subtitle="시간 조건, 문구, 표시 시간, 하루 1회 제한을 이벤트별로 조정합니다."
            />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-3">
              {HAMZZI_EVENT_KEYS.map((eventKey) => {
                const setting = hamzziEventDraft[eventKey];
                const meta = HAMZZI_EVENT_META[eventKey];
                const isTimed = meta.category === 'time';

                return (
                  <div key={eventKey} className="space-y-3 rounded-2xl border bg-background p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold text-foreground">{meta.label}</p>
                          <Badge variant="outline">
                            {meta.category === 'time' ? '시간대' : meta.category === 'achievement' ? '성과' : '시크릿'}
                          </Badge>
                        </div>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{meta.helper}</p>
                      </div>
                      <Switch
                        checked={setting.enabled}
                        onCheckedChange={(checked) => setHamzziEventSetting(eventKey, { enabled: checked })}
                        aria-label={`${meta.label} 활성화`}
                      />
                    </div>

                    {isTimed && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor={`${eventKey}-start`} className="text-xs">시작 시간</Label>
                          <Input
                            id={`${eventKey}-start`}
                            type="time"
                            value={setting.start_time || ''}
                            onChange={(event) => setHamzziEventSetting(eventKey, { start_time: event.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`${eventKey}-end`} className="text-xs">종료 시간</Label>
                          <Input
                            id={`${eventKey}-end`}
                            type="time"
                            value={setting.end_time || ''}
                            onChange={(event) => setHamzziEventSetting(eventKey, { end_time: event.target.value })}
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor={`${eventKey}-message`} className="text-xs">문구</Label>
                      <Input
                        id={`${eventKey}-message`}
                        value={setting.message}
                        onChange={(event) => setHamzziEventSetting(eventKey, { message: event.target.value })}
                        placeholder={DEFAULT_HAMZZI_EVENT_SETTINGS[eventKey].message}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${eventKey}-description`} className="text-xs">보조 설명</Label>
                      <Input
                        id={`${eventKey}-description`}
                        value={setting.description || ''}
                        onChange={(event) => setHamzziEventSetting(eventKey, { description: event.target.value })}
                        placeholder="선택 입력"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <Label htmlFor={`${eventKey}-duration`} className="text-xs">표시 시간(ms)</Label>
                        <Input
                          id={`${eventKey}-duration`}
                          type="number"
                          min={1200}
                          max={12000}
                          step={100}
                          value={setting.duration_ms}
                          onChange={(event) => setHamzziEventSetting(eventKey, { duration_ms: Number(event.target.value) })}
                        />
                      </div>
                      <div className="flex items-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => previewHamzziEvent(eventKey)}
                          className="gap-2"
                        >
                          <Play className="h-4 w-4" />
                          미리보기
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                      <Label className="text-xs">하루 1회 제한</Label>
                      <Switch
                        checked={setting.once_per_day}
                        onCheckedChange={(checked) => setHamzziEventSetting(eventKey, { once_per_day: checked })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setHamzziEventDraft(DEFAULT_HAMZZI_EVENT_SETTINGS)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                기본값
              </Button>
              <Button
                type="button"
                onClick={() => saveHamzziEvents.mutate()}
                disabled={saveHamzziEvents.isPending || !hamzziEventChanged}
                className="gap-2"
              >
                {saveHamzziEvents.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {requiresApproval ? '승인 요청' : '이벤트 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
};

export default JjikjjikiEventSettingsPage;
