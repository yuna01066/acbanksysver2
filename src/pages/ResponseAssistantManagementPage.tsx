import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Bot,
  Clock,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Play,
  Plus,
  RefreshCw,
  Save,
  ShieldAlert,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import jjikjjikiBase from '@/assets/hamzzi/jjikjjiki-base.png';
import jjikjjikiLunchCelebration from '@/assets/hamzzi/jjikjjiki-lunch-celebration.png';
import jjikjjikiLunchSpeechSticker from '@/assets/hamzzi/jjikjjiki-lunch-speech-sticker.png';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { createSettingsChangeRequest } from '@/services/settingsChangeRequests';
import { PageHeader, PageShell } from '@/components/layout/PageLayout';
import { BrandedCardHeader } from '@/components/ui/branded-card-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  DEFAULT_HAMZZI_EVENT_SETTINGS,
  DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION,
  HAMZZI_EVENT_SETTINGS_KEY,
  RESPONSE_ASSISTANT_ICON_SETTING_KEY,
  RESPONSE_ASSISTANT_SETTING_KEY,
  RESPONSE_KNOWLEDGE_CATEGORY_OPTIONS,
  parseHamzziEventSettings,
  responseKnowledgeCategoryLabel,
  stringifyHamzziEventSettings,
  type HamzziEventSettings,
  type HamzziManagedEventKey,
} from '@/lib/responseAssistantDefaults';
import { triggerHamzzi, type HamzziEventType } from '@/lib/hamzziEvents';
import { cn } from '@/lib/utils';

type ResponseAssistantSetting = {
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

type KnowledgeItem = {
  id: string;
  title: string;
  category: string;
  content: string;
  is_active: boolean;
  updated_at: string;
};

type KnowledgeDraft = Pick<KnowledgeItem, 'title' | 'category' | 'content' | 'is_active'>;

const EMPTY_KNOWLEDGE_ITEMS: KnowledgeItem[] = [];

const emptyKnowledgeDraft: KnowledgeDraft = {
  title: '',
  category: 'general',
  content: '',
  is_active: true,
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

const MAX_ICON_SIZE = 512;

function createLauncherIconDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('이미지 파일만 업로드할 수 있습니다.'));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const scale = Math.min(MAX_ICON_SIZE / image.naturalWidth, MAX_ICON_SIZE / image.naturalHeight, 1);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');

      if (!context) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('이미지를 처리할 수 없습니다.'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/png'));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 파일을 읽을 수 없습니다.'));
    };

    image.src = objectUrl;
  });
}

const ResponseAssistantManagementPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const iconInputRef = useRef<HTMLInputElement | null>(null);
  const hamzziEventsSectionRef = useRef<HTMLDivElement | null>(null);
  const { user, userRole, isAdmin, isModerator, loading } = useAuth();
  const canManage = userRole === 'admin' || userRole === 'moderator' || isAdmin || isModerator;
  const requiresApproval = isModerator && !isAdmin;
  const [instructionDraft, setInstructionDraft] = useState(DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION);
  const [iconDraft, setIconDraft] = useState('');
  const [iconFileName, setIconFileName] = useState('');
  const [hamzziEventDraft, setHamzziEventDraft] = useState<HamzziEventSettings>(DEFAULT_HAMZZI_EVENT_SETTINGS);
  const [knowledgeDrafts, setKnowledgeDrafts] = useState<Record<string, KnowledgeDraft>>({});
  const [newKnowledge, setNewKnowledge] = useState<KnowledgeDraft>(emptyKnowledgeDraft);

  useEffect(() => {
    if (!loading && !canManage) navigate('/admin-settings');
  }, [canManage, loading, navigate]);

  useEffect(() => {
    if (loading || !canManage) return;
    if (searchParams.get('section') !== 'hamzzi-events') return;

    window.setTimeout(() => {
      hamzziEventsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, [canManage, loading, searchParams]);

  const { data: setting, isLoading: settingLoading } = useQuery<ResponseAssistantSetting | null>({
    queryKey: ['response-assistant-setting', RESPONSE_ASSISTANT_SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_assistant_settings')
        .select('key, value, description, updated_by, created_at, updated_at')
        .eq('key', RESPONSE_ASSISTANT_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ResponseAssistantSetting | null;
    },
    enabled: !!user && canManage,
  });

  const { data: iconSetting, isLoading: iconSettingLoading } = useQuery<ResponseAssistantSetting | null>({
    queryKey: ['response-assistant-setting', RESPONSE_ASSISTANT_ICON_SETTING_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_assistant_settings')
        .select('key, value, description, updated_by, created_at, updated_at')
        .eq('key', RESPONSE_ASSISTANT_ICON_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as ResponseAssistantSetting | null;
    },
    enabled: !!user && canManage,
  });

  const { data: hamzziEventSetting, isLoading: hamzziEventSettingLoading } = useQuery<ResponseAssistantSetting | null>({
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

  const { data: knowledgeItems = EMPTY_KNOWLEDGE_ITEMS, isLoading: knowledgeLoading } = useQuery<KnowledgeItem[]>({
    queryKey: ['response-knowledge-items-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('response_knowledge_items')
        .select('id, title, category, content, is_active, updated_at')
        .order('category')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data || []) as unknown) as KnowledgeItem[];
    },
    enabled: !!user && canManage,
  });

  useEffect(() => {
    setInstructionDraft(setting?.value || DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION);
  }, [setting?.value]);

  useEffect(() => {
    setIconDraft(iconSetting?.value || '');
    setIconFileName('');
  }, [iconSetting?.value]);

  useEffect(() => {
    setHamzziEventDraft(parseHamzziEventSettings(hamzziEventSetting?.value));
  }, [hamzziEventSetting?.value]);

  useEffect(() => {
    setKnowledgeDrafts(
      Object.fromEntries(
        knowledgeItems.map((item) => [
          item.id,
          {
            title: item.title,
            category: item.category,
            content: item.content,
            is_active: item.is_active,
          },
        ]),
      ),
    );
  }, [knowledgeItems]);

  const currentInstruction = setting?.value || DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION;
  const instructionChanged = instructionDraft !== currentInstruction;
  const currentIcon = iconSetting?.value || '';
  const iconChanged = iconDraft !== currentIcon;
  const iconPreview = iconDraft || jjikjjikiBase;
  const currentHamzziEventSettings = useMemo(
    () => parseHamzziEventSettings(hamzziEventSetting?.value),
    [hamzziEventSetting?.value],
  );
  const hamzziEventChanged = stringifyHamzziEventSettings(hamzziEventDraft)
    !== stringifyHamzziEventSettings(currentHamzziEventSettings);
  const activeKnowledgeCount = useMemo(
    () => knowledgeItems.filter((item) => item.is_active).length,
    [knowledgeItems],
  );

  const saveInstruction = useMutation({
    mutationFn: async (): Promise<'requested' | 'saved'> => {
      const value = instructionDraft.trim();
      if (!value) throw new Error('instruction 프롬프트를 입력해주세요.');

      if (requiresApproval) {
        await createSettingsChangeRequest({
          targetArea: 'admin',
          targetTable: 'response_assistant_settings',
          targetKey: RESPONSE_ASSISTANT_SETTING_KEY,
          action: 'upsert',
          riskLevel: 'high',
          changeSummary: '상담 응대 보조 instruction 변경',
          beforeValue: {
            key: RESPONSE_ASSISTANT_SETTING_KEY,
            value: currentInstruction,
            description: setting?.description || null,
          },
          afterValue: {
            key: RESPONSE_ASSISTANT_SETTING_KEY,
            value,
            description: '상담 응대 보조 AI 초안 생성 시 기본으로 적용되는 instruction 가이드라인',
          },
        });
        return 'requested';
      }

      const { error } = await supabase
        .from('response_assistant_settings')
        .upsert(
          {
            key: RESPONSE_ASSISTANT_SETTING_KEY,
            value,
            description: '상담 응대 보조 AI 초안 생성 시 기본으로 적용되는 instruction 가이드라인',
            updated_by: user?.id || null,
          },
          { onConflict: 'key' },
        );
      if (error) throw error;
      return 'saved';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['response-assistant-setting', RESPONSE_ASSISTANT_SETTING_KEY] });
      queryClient.invalidateQueries({ queryKey: ['settings-change-requests'] });
      toast.success(
        result === 'requested'
          ? '관리자 승인 요청으로 등록되었습니다.'
          : '응대 instruction이 저장되었습니다.',
      );
    },
    onError: (error: Error) => toast.error('저장 실패: ' + error.message),
  });

  const createKnowledgeItem = useMutation({
    mutationFn: async () => {
      const title = newKnowledge.title.trim();
      const content = newKnowledge.content.trim();
      if (!title || !content) throw new Error('제목과 내용을 입력해주세요.');

      const { error } = await supabase
        .from('response_knowledge_items')
        .insert({
          title,
          category: newKnowledge.category,
          content,
          is_active: newKnowledge.is_active,
          created_by: user?.id || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewKnowledge(emptyKnowledgeDraft);
      queryClient.invalidateQueries({ queryKey: ['response-knowledge-items-admin'] });
      queryClient.invalidateQueries({ queryKey: ['response-knowledge-items'] });
      toast.success('응대 근거가 추가되었습니다.');
    },
    onError: (error: Error) => toast.error('추가 실패: ' + error.message),
  });

  const saveIcon = useMutation({
    mutationFn: async (): Promise<'requested' | 'saved'> => {
      if (requiresApproval) {
        await createSettingsChangeRequest({
          targetArea: 'admin',
          targetTable: 'response_assistant_settings',
          targetKey: RESPONSE_ASSISTANT_ICON_SETTING_KEY,
          action: iconDraft ? 'upsert' : 'delete',
          riskLevel: 'high',
          changeSummary: iconDraft ? '상담 응대 보조 런처 아이콘 변경' : '상담 응대 보조 런처 아이콘 기본값 복원',
          beforeValue: currentIcon
            ? {
                key: RESPONSE_ASSISTANT_ICON_SETTING_KEY,
                value: currentIcon,
                description: iconSetting?.description || null,
              }
            : null,
          afterValue: iconDraft
            ? {
                key: RESPONSE_ASSISTANT_ICON_SETTING_KEY,
                value: iconDraft,
                description: '상담 응대 보조 플로팅 런처 아이콘 이미지',
              }
            : null,
        });
        return 'requested';
      }

      if (!iconDraft) {
        const { error } = await supabase
          .from('response_assistant_settings')
          .delete()
          .eq('key', RESPONSE_ASSISTANT_ICON_SETTING_KEY);
        if (error) throw error;
        return 'saved';
      }

      const { error } = await supabase
        .from('response_assistant_settings')
        .upsert(
          {
            key: RESPONSE_ASSISTANT_ICON_SETTING_KEY,
            value: iconDraft,
            description: '상담 응대 보조 플로팅 런처 아이콘 이미지',
            updated_by: user?.id || null,
          },
          { onConflict: 'key' },
        );
      if (error) throw error;
      return 'saved';
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['response-assistant-setting', RESPONSE_ASSISTANT_ICON_SETTING_KEY] });
      queryClient.invalidateQueries({ queryKey: ['response-assistant-launcher-icon'] });
      queryClient.invalidateQueries({ queryKey: ['settings-change-requests'] });
      toast.success(
        result === 'requested'
          ? '관리자 승인 요청으로 등록되었습니다.'
          : iconDraft
            ? '위젯 아이콘이 저장되었습니다.'
            : '기본 아이콘으로 복원되었습니다.',
      );
    },
    onError: (error: Error) => toast.error('아이콘 저장 실패: ' + error.message),
  });

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

  const updateKnowledgeItem = useMutation({
    mutationFn: async ({ id, draft }: { id: string; draft: KnowledgeDraft }) => {
      const title = draft.title.trim();
      const content = draft.content.trim();
      if (!title || !content) throw new Error('제목과 내용을 입력해주세요.');

      const { error } = await supabase
        .from('response_knowledge_items')
        .update({
          title,
          category: draft.category,
          content,
          is_active: draft.is_active,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['response-knowledge-items-admin'] });
      queryClient.invalidateQueries({ queryKey: ['response-knowledge-items'] });
      toast.success('응대 근거가 저장되었습니다.');
    },
    onError: (error: Error) => toast.error('저장 실패: ' + error.message),
  });

  const setKnowledgeDraft = (id: string, patch: Partial<KnowledgeDraft>) => {
    setKnowledgeDrafts((current) => ({
      ...current,
      [id]: {
        ...(current[id] || emptyKnowledgeDraft),
        ...patch,
      },
    }));
  };

  const handleIconFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const dataUrl = await createLauncherIconDataUrl(file);
      setIconDraft(dataUrl);
      setIconFileName(file.name);
      toast.success('아이콘 미리보기가 변경되었습니다. 저장 버튼을 눌러 적용하세요.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '이미지를 처리할 수 없습니다.');
    }
  };

  if (loading || settingLoading || iconSettingLoading || hamzziEventSettingLoading) {
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
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Admin"
        title="상담 응대 보조 관리"
        description="AI 응대 초안의 기본 instruction과 직원들이 사용할 응대 근거/템플릿을 관리합니다."
        icon={<MessageSquareText className="h-5 w-5" />}
        meta={(
          <>
            <Badge variant="outline">프롬프트 관리</Badge>
            <Badge variant="outline">활성 근거 {activeKnowledgeCount}개</Badge>
          </>
        )}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/admin-settings')} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              관리자 설정
            </Button>
          </>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="border-white/60 bg-card/80">
          <CardHeader className="border-b">
            <BrandedCardHeader
              icon={Bot}
              title="Instruction 가이드라인 프롬프트"
              subtitle="저장한 내용은 상담 응대 초안 생성 Edge Function에서 기본 지침으로 사용됩니다."
              meta={instructionChanged ? <Badge className="bg-amber-500 text-white">수정 중</Badge> : <Badge variant="outline">저장됨</Badge>}
            />
          </CardHeader>
          <CardContent className="space-y-4 p-5">
            <Alert className="border-amber-200 bg-amber-50 text-amber-900">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                JSON 응답 형식과 위험도 판단 필드는 시스템에서 별도로 강제합니다. 중간관리자의 instruction 변경은 즉시 반영되지 않고 관리자 승인 요청으로 등록됩니다.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="response-assistant-instruction" className="text-xs">
                  기본 instruction
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {instructionDraft.length.toLocaleString()}자
                </span>
              </div>
              <Textarea
                id="response-assistant-instruction"
                value={instructionDraft}
                onChange={(event) => setInstructionDraft(event.target.value)}
                className="min-h-[420px] resize-y font-mono text-sm leading-relaxed"
                placeholder="상담 응대 보조 AI에게 적용할 기본 지침을 입력하세요."
              />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setInstructionDraft(DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION)}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                기본값 불러오기
              </Button>
              <Button
                type="button"
                onClick={() => saveInstruction.mutate()}
                disabled={saveInstruction.isPending || !instructionChanged}
                className="gap-2"
              >
                {saveInstruction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {requiresApproval ? '승인 요청' : 'instruction 저장'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={ImageIcon}
                title="위젯 아이콘"
                subtitle="우측 하단 상담 응대 보조 런처에 표시되는 아이콘입니다."
                meta={iconChanged ? <Badge className="bg-amber-500 text-white">수정 중</Badge> : <Badge variant="outline">저장됨</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-center rounded-2xl border bg-muted/30 p-6">
                <div className="relative flex h-28 w-28 items-center justify-center">
                  <img
                    src={iconPreview}
                    alt="상담 응대 보조 아이콘 미리보기"
                    className="max-h-28 max-w-28 object-contain drop-shadow-[0_10px_18px_rgba(0,0,0,0.20)]"
                  />
                </div>
              </div>

              <input
                ref={iconInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleIconFileChange}
              />

              <div className="rounded-lg border bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                PNG/WebP 권장, 업로드 시 최대 {MAX_ICON_SIZE}px 기준으로 자동 축소됩니다.
                {iconFileName && <span className="mt-1 block text-foreground">선택 파일: {iconFileName}</span>}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => iconInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  이미지 선택
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIconDraft('');
                    setIconFileName('');
                  }}
                  disabled={!iconDraft}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  기본값
                </Button>
              </div>

              <Button
                type="button"
                onClick={() => saveIcon.mutate()}
                disabled={saveIcon.isPending || !iconChanged}
                className="w-full gap-2"
              >
                {saveIcon.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {requiresApproval ? '승인 요청' : '아이콘 저장'}
              </Button>
            </CardContent>
          </Card>

          <Card ref={hamzziEventsSectionRef} id="hamzzi-events" className="scroll-mt-24 border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={Sparkles}
                title="찍찍이 이벤트 관리"
                subtitle="시간대와 성과 순간에 표시할 찍찍이 반응을 관리합니다."
                meta={hamzziEventChanged ? <Badge className="bg-amber-500 text-white">수정 중</Badge> : <Badge variant="outline">저장됨</Badge>}
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="relative h-44 overflow-hidden rounded-2xl border bg-gradient-to-b from-white to-amber-50/60">
                <img
                  src={jjikjjikiLunchSpeechSticker}
                  alt=""
                  className="absolute left-4 top-4 z-10 w-40 rotate-[-2deg] drop-shadow-[0_10px_14px_rgba(15,23,42,0.16)]"
                />
                <img
                  src={jjikjjikiLunchCelebration}
                  alt=""
                  className="absolute bottom-0 right-3 h-40 w-auto drop-shadow-[0_14px_20px_rgba(15,23,42,0.18)]"
                />
              </div>

              <Alert className="border-blue-200 bg-blue-50 text-blue-950">
                <Clock className="h-4 w-4" />
                <AlertDescription className="text-xs leading-relaxed">
                  시간대 이벤트는 시작/종료 시간을 적용하고, 성과 이벤트는 실제 업무 액션이 발생할 때 설정된 문구와 표시 시간을 사용합니다.
                </AlertDescription>
              </Alert>

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
                        <div className="flex items-end gap-2">
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

          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={Plus}
                title="응대 근거 추가"
                subtitle="가격, 납기, 제작 방식처럼 초안에 반영할 내부 근거를 등록합니다."
              />
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="space-y-2">
                <Label className="text-xs">제목</Label>
                <Input
                  value={newKnowledge.title}
                  onChange={(event) => setNewKnowledge((current) => ({ ...current, title: event.target.value }))}
                  placeholder="예: 무기포 접착 단가 설명"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">분류</Label>
                <Select
                  value={newKnowledge.category}
                  onValueChange={(value) => setNewKnowledge((current) => ({ ...current, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSE_KNOWLEDGE_CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">내용</Label>
                <Textarea
                  value={newKnowledge.content}
                  onChange={(event) => setNewKnowledge((current) => ({ ...current, content: event.target.value }))}
                  placeholder="직원이 상담에서 사용할 근거, 표현 방식, 주의 문구를 입력하세요."
                  className="min-h-32 leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
                <Label className="text-xs">바로 활성화</Label>
                <Switch
                  checked={newKnowledge.is_active}
                  onCheckedChange={(checked) => setNewKnowledge((current) => ({ ...current, is_active: checked }))}
                />
              </div>
              <Button
                type="button"
                onClick={() => createKnowledgeItem.mutate()}
                disabled={createKnowledgeItem.isPending}
                className="w-full gap-2"
              >
                {createKnowledgeItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                근거 추가
              </Button>
            </CardContent>
          </Card>

          <Card className="border-white/60 bg-card/80">
            <CardHeader className="border-b">
              <BrandedCardHeader
                icon={MessageSquareText}
                title="관리 메모"
                subtitle="직원 화면에서는 활성화된 근거만 선택지로 노출됩니다."
              />
            </CardHeader>
            <CardContent className="space-y-2 p-5 text-xs leading-relaxed text-muted-foreground">
              <p>가격 항의, 컴플레인, 납기 문의처럼 반복되는 응대 기준은 근거 항목으로 분리해두는 편이 관리하기 쉽습니다.</p>
              <p>특정 금액이나 일회성 조건은 공통 instruction에 넣지 말고, 상담 시 내부 메모에 입력하는 방식이 안전합니다.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-white/60 bg-card/80">
        <CardHeader className="border-b">
          <BrandedCardHeader
            icon={MessageSquareText}
            title="응대 근거 / 템플릿"
            subtitle="활성화된 항목은 상담 응대 보조의 근거 선택과 AI 초안 생성에 사용됩니다."
          />
        </CardHeader>
        <CardContent className="p-5">
          {knowledgeLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : knowledgeItems.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              등록된 응대 근거가 없습니다.
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {knowledgeItems.map((item) => {
                const draft = knowledgeDrafts[item.id] || item;
                const isChanged = draft.title !== item.title
                  || draft.category !== item.category
                  || draft.content !== item.content
                  || draft.is_active !== item.is_active;

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'space-y-3 rounded-xl border bg-background p-4',
                      !draft.is_active && 'opacity-60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <Badge variant="outline">{responseKnowledgeCategoryLabel(draft.category)}</Badge>
                        <p className="text-[11px] text-muted-foreground">
                          최근 수정 {new Date(item.updated_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {isChanged && <Badge className="bg-amber-500 text-white">수정 중</Badge>}
                        <Switch
                          checked={draft.is_active}
                          onCheckedChange={(checked) => setKnowledgeDraft(item.id, { is_active: checked })}
                          aria-label={`${item.title} 활성화`}
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <div className="space-y-2">
                        <Label className="text-xs">제목</Label>
                        <Input
                          value={draft.title}
                          onChange={(event) => setKnowledgeDraft(item.id, { title: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">분류</Label>
                        <Select value={draft.category} onValueChange={(value) => setKnowledgeDraft(item.id, { category: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {RESPONSE_KNOWLEDGE_CATEGORY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">내용</Label>
                      <Textarea
                        value={draft.content}
                        onChange={(event) => setKnowledgeDraft(item.id, { content: event.target.value })}
                        className="min-h-32 leading-relaxed"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => updateKnowledgeItem.mutate({ id: item.id, draft })}
                        disabled={!isChanged || updateKnowledgeItem.isPending}
                        className="gap-2"
                      >
                        {updateKnowledgeItem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        저장
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default ResponseAssistantManagementPage;
