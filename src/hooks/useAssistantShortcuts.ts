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
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ROLE_HIERARCHY, useAuth, type AppRole } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AssistantEmbeddedTool = 'responseAssistant' | 'quoteWizard' | 'meetingBooking';
export type AssistantShortcutTarget = 'tool' | 'route' | 'external';
export type AssistantShortcutRole = AppRole;
export type AssistantShortcutCategory = 'assistant' | 'schedule' | 'sales' | 'project' | 'people' | 'admin' | 'external';
export type AssistantShortcutAccess = 'enabled' | 'locked' | 'hidden';

export interface AssistantShortcutItem {
  id: string;
  label: string;
  description: string;
  category: AssistantShortcutCategory;
  icon: LucideIcon;
  target: AssistantShortcutTarget;
  tool?: AssistantEmbeddedTool;
  path?: string;
  externalUrl?: string;
  allowedRoles?: AssistantShortcutRole[];
  requiredPageKey?: string;
  lockedReason?: string;
  keywords: string[];
}

export interface AssistantShortcutAccessResult {
  state: AssistantShortcutAccess;
  reason?: string;
}

type AssistantPreferenceRow = {
  user_id: string;
  shortcut_ids: string[] | null;
  storage?: 'database' | 'local';
};

const supabaseAny = supabase as any;
const ASSISTANT_SHORTCUT_STORAGE_PREFIX = 'acbank:assistant-shortcuts:';

export const ASSISTANT_SHORTCUT_CATEGORY_LABELS: Record<AssistantShortcutCategory, string> = {
  assistant: '햄찌 도구',
  schedule: '일정',
  sales: '영업',
  project: '프로젝트',
  people: '인사',
  admin: '관리',
  external: '외부',
};

export const ASSISTANT_SHORTCUT_CATALOG: AssistantShortcutItem[] = [
  {
    id: 'tool-response-assistant',
    label: '상담 CS',
    description: '답변 작성과 문안 검수',
    category: 'assistant',
    icon: MessageSquareText,
    target: 'tool',
    tool: 'responseAssistant',
    keywords: ['상담', 'cs', '응대', '답변'],
  },
  {
    id: 'tool-quote-wizard',
    label: '견적 마법사',
    description: '파일 분석과 견적 초안',
    category: 'assistant',
    icon: Sparkles,
    target: 'tool',
    tool: 'quoteWizard',
    keywords: ['견적', '도면', '마법사'],
  },
  {
    id: 'tool-meeting-booking',
    label: '미팅 예약',
    description: '직원/고객 일정 등록',
    category: 'assistant',
    icon: CalendarPlus,
    target: 'tool',
    tool: 'meetingBooking',
    keywords: ['미팅', '예약', '상담', '회의'],
  },
  {
    id: 'route-calendar',
    label: '통합 캘린더',
    description: '오늘 일정과 회의실 확인',
    category: 'schedule',
    icon: CalendarDays,
    target: 'route',
    path: '/calendar',
    requiredPageKey: '/calendar',
    keywords: ['캘린더', '일정', '회의실'],
  },
  {
    id: 'route-yield-calculator',
    label: '수율 계산기',
    description: '원판 배치와 수율 확인',
    category: 'sales',
    icon: BarChart3,
    target: 'route',
    path: '/calculator?type=yield',
    requiredPageKey: '/calculator',
    keywords: ['수율', '계산기', '원판', '네스팅', 'yield'],
  },
  {
    id: 'route-attendance',
    label: '근태 관리',
    description: '출퇴근과 연차 확인',
    category: 'people',
    icon: Clock,
    target: 'route',
    path: '/attendance',
    requiredPageKey: '/attendance',
    keywords: ['근태', '출근', '퇴근', '연차'],
  },
  {
    id: 'route-my-page',
    label: '마이페이지',
    description: '내 정보와 HR 업무',
    category: 'people',
    icon: User,
    target: 'route',
    path: '/my-page',
    requiredPageKey: '/my-page',
    keywords: ['마이페이지', '내정보', 'hr'],
  },
  {
    id: 'route-review-hub',
    label: '승인/검토 센터',
    description: '승인과 검토 업무 모음',
    category: 'admin',
    icon: ClipboardCheck,
    target: 'route',
    path: '/review-hub',
    requiredPageKey: '/review-hub',
    allowedRoles: ['admin', 'moderator'],
    lockedReason: '관리자 또는 중간관리자 권한이 필요합니다.',
    keywords: ['승인', '검토', '관리'],
  },
  {
    id: 'route-channel-talk',
    label: '채널톡 분석함',
    description: 'AI 문의 분석 확인',
    category: 'admin',
    icon: MessageSquareText,
    target: 'route',
    path: '/channel-talk-leads',
    requiredPageKey: '/channel-talk-leads',
    allowedRoles: ['admin', 'moderator'],
    lockedReason: '관리자 또는 중간관리자 권한이 필요합니다.',
    keywords: ['채널톡', '문의', '분석'],
  },
  {
    id: 'route-admin-settings',
    label: '관리자 설정',
    description: '운영 기능 설정',
    category: 'admin',
    icon: Settings,
    target: 'route',
    path: '/admin-settings',
    requiredPageKey: '/admin-settings',
    allowedRoles: ['admin', 'moderator'],
    lockedReason: '관리자 또는 중간관리자 권한이 필요합니다.',
    keywords: ['관리자', '설정', '운영'],
  },
  {
    id: 'route-saved-quotes',
    label: '발행 견적서',
    description: '저장된 견적서 확인',
    category: 'sales',
    icon: FolderOpen,
    target: 'route',
    path: '/saved-quotes',
    requiredPageKey: '/saved-quotes',
    keywords: ['견적서', '발행', '저장'],
  },
  {
    id: 'route-projects',
    label: '프로젝트',
    description: '프로젝트 현황 확인',
    category: 'project',
    icon: LayoutDashboard,
    target: 'route',
    path: '/project-management',
    requiredPageKey: '/project-management',
    keywords: ['프로젝트', '진행', '관리'],
  },
  {
    id: 'external-notion',
    label: '아크뱅크 노션',
    description: '사내 노션 문서',
    category: 'external',
    icon: BookOpen,
    target: 'external',
    externalUrl: 'https://www.notion.so/juhaeok/ACBANK-2025-253e58d2699680f3a8acd55f77302895?source=copy_link',
    keywords: ['노션', '문서', '가이드'],
  },
];

const EMPLOYEE_DEFAULT_SHORTCUT_IDS = [
  'tool-response-assistant',
  'tool-quote-wizard',
  'tool-meeting-booking',
  'route-calendar',
  'route-yield-calculator',
  'route-attendance',
  'route-my-page',
];

const ROLE_DEFAULT_SHORTCUT_IDS: Record<AssistantShortcutRole, string[]> = {
  employee: [
    ...EMPLOYEE_DEFAULT_SHORTCUT_IDS,
  ],
  manager: [
    ...EMPLOYEE_DEFAULT_SHORTCUT_IDS,
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

export function getAssistantRole(
  isAdmin: boolean,
  isModerator: boolean,
  isManager = false,
): AssistantShortcutRole {
  if (isAdmin) return 'admin';
  if (isModerator) return 'moderator';
  if (isManager) return 'manager';
  return 'employee';
}

function getRoleLockedReason(shortcut: AssistantShortcutItem) {
  if (shortcut.lockedReason) return shortcut.lockedReason;
  if (!shortcut.allowedRoles || shortcut.allowedRoles.length === 0) return '현재 권한으로 사용할 수 없습니다.';
  const labels: Record<AssistantShortcutRole, string> = {
    admin: '관리자',
    moderator: '중간관리자',
    manager: '담당자',
    employee: '직원',
  };
  return `${shortcut.allowedRoles.map((role) => labels[role]).join(' 또는 ')} 권한이 필요합니다.`;
}

export function resolveAssistantShortcutAccess(
  shortcut: AssistantShortcutItem,
  context: {
    role: AssistantShortcutRole;
    pageAccess?: Record<string, boolean>;
  },
): AssistantShortcutAccessResult {
  if (shortcut.allowedRoles && !shortcut.allowedRoles.includes(context.role)) {
    return { state: 'locked', reason: getRoleLockedReason(shortcut) };
  }

  if (
    shortcut.requiredPageKey
    && context.pageAccess
    && context.pageAccess[shortcut.requiredPageKey] === false
  ) {
    return { state: 'locked', reason: '해당 화면 접근 권한이 필요합니다.' };
  }

  return { state: 'enabled' };
}

function sanitizeShortcutIds(
  ids: string[],
  role: AssistantShortcutRole,
  pageAccess?: Record<string, boolean>,
) {
  const seen = new Set<string>();
  return ids.filter((id) => {
    if (seen.has(id)) return false;
    const shortcut = ASSISTANT_SHORTCUT_CATALOG.find((item) => item.id === id);
    if (!shortcut || resolveAssistantShortcutAccess(shortcut, { role, pageAccess }).state !== 'enabled') return false;
    seen.add(id);
    return true;
  });
}

function isAssistantPreferenceStorageError(error: unknown) {
  const message = String((error as { message?: string })?.message || error || '').toLowerCase();
  return (
    message.includes('assistant_user_preferences')
    || message.includes('save_assistant_shortcuts')
    || message.includes('schema cache')
    || message.includes('does not exist')
    || message.includes('could not find the function')
    || message.includes('function')
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
  const { user, isAdmin, isModerator, isManager, userRole } = useAuth();
  const queryClient = useQueryClient();
  const role = getAssistantRole(isAdmin, isModerator, isManager);
  const roleDefaultIds = ROLE_DEFAULT_SHORTCUT_IDS[role];
  const shortcutById = useMemo(
    () => new Map(ASSISTANT_SHORTCUT_CATALOG.map((shortcut) => [shortcut.id, shortcut])),
    [],
  );
  const requiredPageKeys = useMemo(
    () => Array.from(new Set(
      ASSISTANT_SHORTCUT_CATALOG
        .map((shortcut) => shortcut.requiredPageKey)
        .filter((pageKey): pageKey is string => Boolean(pageKey)),
    )),
    [],
  );

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

  const pageAccessQuery = useQuery({
    queryKey: ['assistant-shortcut-page-access', user?.id, userRole],
    queryFn: async () => {
      if (!user || requiredPageKeys.length === 0) return {};

      const [{ data: overrides, error: overridesError }, { data: rolePolicies, error: rolePoliciesError }] = await Promise.all([
        supabaseAny
          .from('page_access_permissions')
          .select('page_key, effect')
          .eq('user_id', user.id)
          .in('page_key', requiredPageKeys),
        supabase
          .from('page_role_access')
          .select('page_key, min_role')
          .in('page_key', requiredPageKeys),
      ]);

      if (overridesError) {
        console.warn('[AssistantShortcuts] Failed to load page user overrides', overridesError);
      }
      if (rolePoliciesError) {
        console.warn('[AssistantShortcuts] Failed to load page role policies', rolePoliciesError);
      }

      const access: Record<string, boolean> = {};
      requiredPageKeys.forEach((pageKey) => {
        const override = (overrides || []).find((row: { page_key?: string; effect?: string }) => row.page_key === pageKey);
        if (override?.effect === 'deny') {
          access[pageKey] = false;
          return;
        }
        if (override?.effect === 'allow') {
          access[pageKey] = true;
          return;
        }

        const policy = (rolePolicies || []).find((row: { page_key?: string; min_role?: string | null }) => row.page_key === pageKey);
        const minRole = normalizeRole(policy?.min_role);
        access[pageKey] = !minRole || canRoleAccess(userRole, minRole);
      });

      return access;
    },
    enabled: !!user,
    staleTime: 1000 * 60,
  });

  const pageAccess = pageAccessQuery.data;
  const shortcutAccessMap = useMemo(() => {
    const access = new Map<string, AssistantShortcutAccessResult>();
    ASSISTANT_SHORTCUT_CATALOG.forEach((shortcut) => {
      access.set(shortcut.id, resolveAssistantShortcutAccess(shortcut, { role, pageAccess }));
    });
    return access;
  }, [pageAccess, role]);
  const availableShortcuts = ASSISTANT_SHORTCUT_CATALOG.filter(
    (shortcut) => shortcutAccessMap.get(shortcut.id)?.state === 'enabled',
  );
  const lockedShortcuts = ASSISTANT_SHORTCUT_CATALOG.filter(
    (shortcut) => shortcutAccessMap.get(shortcut.id)?.state === 'locked',
  );
  const storedIds = Array.isArray(preferencesQuery.data?.shortcut_ids)
    ? preferencesQuery.data!.shortcut_ids
    : null;
  const enabledRoleDefaultIds = sanitizeShortcutIds(roleDefaultIds, role, pageAccess);
  const shortcutIds = sanitizeShortcutIds(
    storedIds && storedIds.length > 0 ? storedIds : enabledRoleDefaultIds,
    role,
    pageAccess,
  );
  const selectedShortcuts = shortcutIds
    .map((id) => shortcutById.get(id))
    .filter(Boolean) as AssistantShortcutItem[];
  const isLocalFallback = preferencesQuery.data?.storage === 'local'
    || (Boolean(user) && Boolean(preferencesQuery.error) && isAssistantPreferenceStorageError(preferencesQuery.error));

  const saveShortcutOrder = useMutation({
    mutationFn: async (ids: string[]) => {
      if (!user) throw new Error('로그인이 필요합니다.');
      const nextIds = sanitizeShortcutIds(ids, role, pageAccess);
      if (nextIds.length === 0) throw new Error('바로가기를 1개 이상 선택해주세요.');
      const { data, error } = await supabaseAny
        .rpc('save_assistant_shortcuts', { shortcut_ids: nextIds });
      if (error) {
        if (isAssistantPreferenceStorageError(error)) {
          writeLocalShortcutIds(user.id, nextIds);
          return { ids: nextIds, storage: 'local' as const };
        }
        throw error;
      }
      const savedIds = sanitizeShortcutIds(Array.isArray(data) ? data : nextIds, role, pageAccess);
      removeLocalShortcutIds(user.id);
      return { ids: savedIds, storage: 'database' as const };
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

  return {
    role,
    roleDefaultIds: enabledRoleDefaultIds,
    shortcutIds,
    selectedShortcuts,
    availableShortcuts,
    lockedShortcuts,
    shortcutAccessMap,
    isLoading: preferencesQuery.isLoading,
    isLocalFallback,
    saveShortcutOrder,
  };
}

function normalizeRole(role?: string | null): AppRole | null {
  if (role === 'admin' || role === 'moderator' || role === 'manager' || role === 'employee') return role;
  if (role === 'user') return 'employee';
  return null;
}

function canRoleAccess(userRole: AppRole | null, minRole: AppRole) {
  if (!userRole) return false;
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minRole);
  if (userIndex < 0 || minIndex < 0) return false;
  return userIndex <= minIndex;
}
