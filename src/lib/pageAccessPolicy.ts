export type AccessRole = 'admin' | 'moderator' | 'manager' | 'employee';

const ROLE_HIERARCHY: AccessRole[] = ['admin', 'moderator', 'manager', 'employee'];

// PageAccessGuard가 감싸는 경로 중 DB 정책이 아직 생성되지 않은 환경에서도
// 접근을 허용할 경로만 명시한다. 이 목록에도, DB에도 없는 경로는 차단한다.
export const EXPLICIT_PROTECTED_PAGE_DEFAULTS: Readonly<Record<string, AccessRole>> = {
  '/admin-settings': 'moderator',
  '/attendance': 'employee',
  '/branding-intakes': 'employee',
  '/calendar': 'employee',
  '/channel-talk-leads': 'employee',
  '/customer-quotes-summary': 'employee',
  '/business-dashboard': 'admin',
  '/embed-code': 'moderator',
  '/employee-profiles': 'admin',
  '/error-logs': 'admin',
  '/exhibition-management': 'employee',
  '/jjikjjiki-event-settings': 'moderator',
  '/leave-management': 'employee',
  '/material-orders': 'employee',
  '/meeting-reservations': 'manager',
  '/my-page': 'employee',
  '/notification-center': 'employee',
  '/panel-size-comparison': 'employee',
  '/performance-review': 'employee',
  '/portfolio': 'employee',
  '/project-management': 'employee',
  '/public-booking-approvals': 'moderator',
  '/public-booking-share': 'moderator',
  '/quote-drafts': 'employee',
  '/quote-calculation-settings': 'admin',
  '/quote-template-management': 'moderator',
  '/quote-wizard': 'admin',
  '/quotes-summary': 'employee',
  '/recipients': 'employee',
  '/references': 'employee',
  '/review-hub': 'moderator',
  '/review-settings': 'moderator',
  '/response-assistant': 'employee',
  '/response-assistant-management': 'moderator',
  '/sample-chip-inventory': 'moderator',
  '/saved-quotes': 'employee',
  '/space-quote': 'employee',
  '/space-quotes': 'employee',
  '/team-chat': 'employee',
  '/storage-status': 'admin',
  '/tax-invoices': 'admin',
  '/user-statistics': 'admin',
  '/year-end-tax': 'employee',
  '/year-end-tax-admin': 'admin',
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

const MASTER_PROTECTED_PAGE_PATHS = new Set([
  '/business-dashboard',
  '/employee-profiles',
  '/error-logs',
  '/tax-invoices',
  '/user-statistics',
  '/year-end-tax-admin',
]);

export function isMasterProtectedPagePath(rawPath: string): boolean {
  return getPagePolicyCandidates(rawPath)
    .some((candidate) => MASTER_PROTECTED_PAGE_PATHS.has(candidate));
}

export function passesMasterProtectedPageGate(rawPath: string, isMaster: boolean): boolean {
  return !isMasterProtectedPagePath(rawPath) || isMaster;
}

export function getExplicitPageMinimumRole(rawPath: string): AccessRole | null {
  const candidates = getPagePolicyCandidates(rawPath);
  for (const candidate of candidates) {
    const role = EXPLICIT_PROTECTED_PAGE_DEFAULTS[candidate];
    if (role) return role;
  }
  return null;
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

  return getExplicitPageMinimumRole(rawPath);
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

export type PageRolePolicy = {
  page_key: string;
  min_role: string;
};

export type PageAccessOverride = {
  page_key: string;
  effect: string;
};

export function isPageAllowedByPolicy(
  rawPath: string,
  userRole: AccessRole | null,
  rolePolicies: readonly PageRolePolicy[],
  userOverrides: readonly PageAccessOverride[],
  options: { allowUnprotected?: boolean } = {},
): boolean {
  const candidates = getPagePolicyCandidates(rawPath);
  const matchedOverride = candidates
    .map((candidate) => userOverrides.find(
      (row) => normalizePagePath(row.page_key) === candidate,
    ))
    .find(Boolean);

  if (matchedOverride?.effect === 'deny') return false;
  if (matchedOverride?.effect === 'allow') return true;

  const matchedRolePolicy = candidates
    .map((candidate) => rolePolicies.find(
      (row) => normalizePagePath(row.page_key) === candidate,
    ))
    .find(Boolean);
  const explicitMinimumRole = getExplicitPageMinimumRole(rawPath);

  if (!matchedRolePolicy && !explicitMinimumRole) {
    return options.allowUnprotected === true;
  }

  const minimumRole = resolveMinimumRole(rawPath, {
    ok: true,
    minRole: matchedRolePolicy?.min_role,
  });

  return minimumRole ? isRoleSufficient(userRole, minimumRole) : false;
}
