import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  ClipboardCheck,
  Clock,
  FolderOpen,
  LayoutDashboard,
  MessageSquareText,
  Settings,
  Sparkles,
  User,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AssistantEmbeddedTool = 'responseAssistant' | 'quoteWizard' | 'meetingBooking';
export type AssistantShortcutTarget = 'tool' | 'route' | 'external';
export type AssistantShortcutRole = 'admin' | 'moderator' | 'employee';

export interface AssistantShortcutItem {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  target: AssistantShortcutTarget;
  tool?: AssistantEmbeddedTool;
  path?: string;
  externalUrl?: string;
  allowedRoles?: AssistantShortcutRole[];
  keywords: string[];
}

type AssistantPreferenceRow = {
  user_id: string;
  shortcut_ids: string[] | null;
  storage?: 'database' | 'local';
};

const supabaseAny = supabase as any;
const ASSISTANT_SHORTCUT_STORAGE_PREFIX = 'acbank:assistant-shortcuts:';

export const ASSISTANT_SHORTCUT_CATALOG: AssistantShortcutItem[] = [
  {
    id: 'tool-response-assistant',
    label: '상담 CS',
    description: '답변 작성과 문안 검수',
    icon: MessageSquareText,
    target: 'tool',
    tool: 'responseAssistant',
    keywords: ['상담', 'cs', '응대', '답변'],
  },
  {
    id: 'tool-quote-wizard',
    label: '견적 마법사',
    description: '파일 분석과 견적 초안',
    icon: Sparkles,
    target: 'tool',
    tool: 'quoteWizard',
    keywords: ['견적', '도면', '마법사'],
  },
  {
    id: 'tool-meeting-booking',
    label: '미팅 예약',
    description: '직원/고객 일정 등록',
    icon: CalendarPlus,
    target: 'tool',
    tool: 'meetingBooking',
    keywords: ['미팅', '예약', '상담', '회의'],
  },
  {
    id: 'route-calendar',
    label: '통합 캘린더',
    description: '오늘 일정과 회의실 확인',
    icon: CalendarDays,
    target: 'route',
    path: '/calendar',
    keywords: ['캘린더', '일정', '회의실'],
  },
  {
    id: 'route-yield-calculator',
    label: '수율 계산기',
    description: '원판 배치와 수율 확인',
    icon: BarChart3,
    target: 'route',
    path: '/calculator?type=yield',
    keywords: ['수율', '계산기', '원판', '네스팅', 'yield'],
  },
  {
    id: 'route-attendance',
    label: '근태 관리',
    description: '출퇴근과 연차 확인',
    icon: Clock,
    target: 'route',
    path: '/attendance',
    keywords: ['근태', '출근', '퇴근', '연차'],
  },
  {
    id: 'route-my-page',
    label: '마이페이지',
    description: '내 정보와 HR 업무',
    icon: User,
    target: 'route',
    path: '/my-page',
    keywords: ['마이페이지', '내정보', 'hr'],
  },
  {
    id: 'route-review-hub',
    label: '승인/검토 센터',
    description: '승인과 검토 업무 모음',
    icon: ClipboardCheck,
    target: 'route',
    path: '/review-hub',
    allowedRoles: ['admin', 'moderator'],
    keywords: ['승인', '검토', '관리'],
  },
  {
    id: 'route-channel-talk',
    label: '채널톡 분석함',
    description: 'AI 문의 분석 확인',
    icon: MessageSquareText,
    target: 'route',
    path: '/channel-talk-leads',
    allowedRoles: ['admin', 'moderator'],
    keywords: ['채널톡', '문의', '분석'],
  },
  {
    id: 'route-admin-settings',
    label: '관리자 설정',
    description: '운영 기능 설정',
    icon: Settings,
    target: 'route',
    path: '/admin-settings',
    allowedRoles: ['admin', 'moderator'],
    keywords: ['관리자', '설정', '운영'],
  },
  {
    id: 'route-saved-quotes',
    label: '발행 견적서',
    description: '저장된 견적서 확인',
    icon: FolderOpen,
    target: 'route',
    path: '/saved-quotes',
    keywords: ['견적서', '발행', '저장'],
  },
  {
    id: 'route-projects',
    label: '프로젝트',
    description: '프로젝트 현황 확인',
    icon: LayoutDashboard,
    target: 'route',
    path: '/project-management',
    keywords: ['프로젝트', '진행', '관리'],
  },
  {
    id: 'external-notion',
    label: '아크뱅크 노션',
    description: '사내 노션 문서',
    icon: BookOpen,
    target: 'external',
    externalUrl: 'https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link',
    keywords: ['노션', '문서', '가이드'],
  },
];

const ROLE_DEFAULT_SHORTCUT_IDS: Record<AssistantShortcutRole, string[]> = {
  employee: [
    'tool-response-assistant',
    'tool-quote-wizard',
    'tool-meeting-booking',
    'route-calendar',
    'route-yield-calculator',
    'route-attendance',
    'route-my-page',
  ],
  moderator: [
    'tool-response-assistant',
    'tool-quote-wizard',
    'tool-meeting-booking',
    'route-calendar',
    'route-review-hub',
    'route-channel-talk',
  ],
  admin: [
    'tool-response-assistant',
    'tool-quote-wizard',
    'tool-meeting-booking',
    'route-calendar',
    'route-admin-settings',
    'route-channel-talk',
  ],
};

function getAssistantRole(isAdmin: boolean, isModerator: boolean): AssistantShortcutRole {
  if (isAdmin) return 'admin';
  if (isModerator) return 'moderator';
  return 'employee';
}

function canUseShortcut(shortcut: AssistantShortcutItem, role: AssistantShortcutRole) {
  return !shortcut.allowedRoles || shortcut.allowedRoles.includes(role);
}

function sanitizeShortcutIds(ids: string[], role: AssistantShortcutRole) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    const shortcut = ASSISTANT_SHORTCUT_CATALOG.find((item) => item.id === id);
    if (!shortcut || !canUseShortcut(shortcut, role)) return false;
    seen.add(id);
    return true;
  });
}

function isAssistantPreferenceStorageError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return (
    message.includes('assistant_user_preferences')
    || message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('relation')
  );
}

function getLocalPreferenceKey(userId: string) {
  return `${ASSISTANT_SHORTCUT_STORAGE_PREFIX}${userId}`;
}

function readLocalShortcutIds(userId?: string | null) {
  if (!userId || typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getLocalPreferenceKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : null;
  } catch {
    return null;
  }
}

function writeLocalShortcutIds(userId: string, ids: string[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getLocalPreferenceKey(userId), JSON.stringify(ids));
}

function removeLocalShortcutIds(userId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(getLocalPreferenceKey(userId));
}

export function useAssistantShortcuts() {
  const { user, isAdmin, isModerator } = useAuth();
  const queryClient = useQueryClient();
  const role = getAssistantRole(isAdmin, isModerator);
  const roleDefaultIds = ROLE_DEFAULT_SHORTCUT_IDS[role];

  const preferencesQuery = useQuery({
    queryKey: ['assistant-user-preferences', user?.id],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('assistant_user_preferences')
        .select('user_id, shortcut_ids')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) {
        if (isAssistantPreferenceStorageError(error)) {
          const localIds = readLocalShortcutIds(user!.id);
          return { user_id: user!.id, shortcut_ids: localIds, storage: 'local' };
        }
        throw error;
      }
      return data ? { ...(data as AssistantPreferenceRow), storage: 'database' } : null;
    },
    enabled: !!user,
  });

  const availableShortcuts = ASSISTANT_SHORTCUT_CATALOG.filter((shortcut) => canUseShortcut(shortcut, role));
  const storedIds = Array.isArray(preferencesQuery.data?.shortcut_ids)
    ? preferencesQuery.data!.shortcut_ids
    : null;
  const shortcutIds = sanitizeShortcutIds(storedIds && storedIds.length > 0 ? storedIds : roleDefaultIds, role);
  const selectedShortcuts = shortcutIds
    .map((id) => availableShortcuts.find((shortcut) => shortcut.id === id))
    .filter(Boolean) as AssistantShortcutItem[];
  const isLocalFallback = preferencesQuery.data?.storage === 'local'
    || (Boolean(user) && Boolean(preferencesQuery.error) && isAssistantPreferenceStorageError(preferencesQuery.error));

  const saveShortcutOrder = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const nextIds = sanitizeShortcutIds(ids, role);
      if (nextIds.length === 0) throw new Error('바로가기를 1개 이상 선택해주세요.');
      const { error } = await supabaseAny
        .from('assistant_user_preferences')
        .upsert({ user_id: user.id, shortcut_ids: nextIds }, { onConflict: 'user_id' });
      if (error) {
        if (isAssistantPreferenceStorageError(error)) {
          writeLocalShortcutIds(user.id, nextIds);
          return { ids: nextIds, storage: 'local' as const };
        }
        throw error;
      }
      removeLocalShortcutIds(user.id);
      return { ids: nextIds, storage: 'database' as const };
    },
    onSuccess: ({ ids: nextIds, storage }) => {
      queryClient.setQueryData(['assistant-user-preferences', user?.id], {
        user_id: user?.id,
        shortcut_ids: nextIds,
        storage,
      });
      queryClient.invalidateQueries({ queryKey: ['assistant-user-preferences', user?.id] });
      toast.success(storage === 'local'
        ? 'DB 설정 전까지 이 브라우저에 임시 저장했습니다.'
        : '햄찌 바로가기를 저장했습니다.');
    },
    onError: (error: Error) => {
      toast.error(error.message || '바로가기 저장에 실패했습니다.');
    },
  });

  const resetToRoleDefault = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const { error } = await supabaseAny
        .from('assistant_user_preferences')
        .upsert({ user_id: user.id, shortcut_ids: roleDefaultIds }, { onConflict: 'user_id' });
      if (error) {
        if (isAssistantPreferenceStorageError(error)) {
          removeLocalShortcutIds(user.id);
          return { ids: roleDefaultIds, storage: 'local' as const };
        }
        throw error;
      }
      removeLocalShortcutIds(user.id);
      return { ids: roleDefaultIds, storage: 'database' as const };
    },
    onSuccess: ({ ids: nextIds, storage }) => {
      queryClient.setQueryData(['assistant-user-preferences', user?.id], {
        user_id: user?.id,
        shortcut_ids: nextIds,
        storage,
      });
      queryClient.invalidateQueries({ queryKey: ['assistant-user-preferences', user?.id] });
      toast.success(storage === 'local'
        ? '브라우저 임시 설정을 지우고 역할 기본값으로 복구했습니다.'
        : '역할 기본 바로가기로 복구했습니다.');
    },
    onError: (error: Error) => {
      toast.error(error.message || '기본값 복구에 실패했습니다.');
    },
  });

  return {
    role,
    roleDefaultIds,
    shortcutIds,
    selectedShortcuts,
    availableShortcuts,
    isLoading: preferencesQuery.isLoading,
    isLocalFallback,
    saveShortcutOrder,
    resetToRoleDefault,
  };
}
