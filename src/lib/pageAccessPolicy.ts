export type AccessRole = 'admin' | 'moderator' | 'manager' | 'employee';

const ROLE_HIERARCHY: AccessRole[] = ['admin', 'moderator', 'manager', 'employee'];

// PageAccessGuard가 감싸는 경로 중 DB 정책이 아직 생성되지 않은 환경에서도
// 접근을 허용할 경로만 명시한다. 이 목록에도, DB에도 없는 경로는 차단한다.
const EXPLICIT_PROTECTED_PAGE_DEFAULTS: Readonly<Record<string, AccessRole>> = {
  '/attendance': 'employee',
  '/branding-intakes': 'employee',
  '/calendar': 'employee',
  '/channel-talk-leads': 'employee',
  '/customer-quotes-summary': 'employee',
  '/exhibition-management': 'employee',
  '/leave-management': 'employee',
  '/material-orders': 'employee',
  '/meeting-reservations': 'manager',
  '/panel-size-comparison': 'employee',
  '/performance-review': 'employee',
  '/portfolio': 'employee',
  '/project-management': 'employee',
  '/quote-drafts': 'employee',
  '/quote-calculation-settings': 'admin',
  '/quote-wizard': 'admin',
  '/quotes-summary': 'employee',
  '/recipients': 'employee',
  '/references': 'employee',
  '/review-hub': 'employee',
  '/saved-quotes': 'employee',
  '/space-quote': 'employee',
  '/space-quotes': 'employee',
  '/team-chat': 'employee',
};

export function normalizePagePath(rawPath: string): string {
  const pathOnly = rawPath.trim().split(/[?#]/, 1)[0]?.toLowerCase() || '/';
  const withLeadingSlash = pathOnly.startsWith('/') ? pathOnly : `/${pathOnly}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  return collapsed.length > 1 ? collapsed.replace(/\/+$/, '') : '/';
}

export function getPagePolicyCandidates(rawPath: string): string[] {
  const pagePath = normalizePagePath(rawPath);
  const segments = pagePath.split('/').filter(Boolean);
  const candidates = [pagePath];

  if (segments.length > 1) {
    candidates.push(`/${segments[0]}`);
  }

  return [...new Set(candidates)];
}

export function resolveMinimumRole(
  rawPath: string,
  policyResult: { ok: boolean; minRole?: string },
): AccessRole | null {
  if (!policyResult.ok) return null;

  if (policyResult.minRole !== undefined) {
    return ROLE_HIERARCHY.includes(policyResult.minRole as AccessRole)
      ? policyResult.minRole as AccessRole
      : null;
  }

  const candidates = getPagePolicyCandidates(rawPath);
  for (const candidate of candidates) {
    const explicitRole = EXPLICIT_PROTECTED_PAGE_DEFAULTS[candidate];
    if (explicitRole) return explicitRole;
  }

  return null;
}

export function isRoleSufficient(
  userRole: AccessRole | null,
  minimumRole: AccessRole,
): boolean {
  if (!userRole) return false;
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minimumIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return userIndex >= 0 && minimumIndex >= 0 && userIndex <= minimumIndex;
}
