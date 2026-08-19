import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getPagePolicyCandidates,
  isPageAllowedByPolicy,
  isMasterProtectedPagePath,
  isRoleSufficient,
  normalizePagePath,
  passesMasterProtectedPageGate,
  resolveMinimumRole,
} from '../src/lib/pageAccessPolicy';
import { isApprovedProfile } from '../supabase/functions/_shared/approval.ts';

assert.equal(normalizePagePath('/QUOTE-WIZARD///'), '/quote-wizard');
assert.equal(normalizePagePath('saved-quotes//ABC-123/?tab=history#row'), '/saved-quotes/abc-123');
assert.equal(normalizePagePath('///'), '/');

assert.deepEqual(
  getPagePolicyCandidates('/SAVED-QUOTES/ABC-123/'),
  ['/saved-quotes/abc-123', '/saved-quotes'],
);
assert.deepEqual(getPagePolicyCandidates('/CALENDAR/'), ['/calendar']);

assert.equal(
  resolveMinimumRole('/calendar', { ok: false }),
  null,
  'policy query errors must fail closed',
);
assert.equal(
  resolveMinimumRole('/unknown-protected-page', { ok: true }),
  null,
  'unknown protected pages must not be opened by a missing policy',
);
assert.equal(resolveMinimumRole('/calendar', { ok: true }), 'employee');
assert.equal(resolveMinimumRole('/quote-wizard/', { ok: true }), 'admin');
assert.equal(resolveMinimumRole('/admin-settings', { ok: true }), 'moderator');
assert.equal(resolveMinimumRole('/employee-profiles', { ok: true }), 'admin');
assert.equal(resolveMinimumRole('/tax-invoices', { ok: true }), 'admin');
assert.equal(resolveMinimumRole('/business-dashboard', { ok: true }), 'admin');
assert.equal(resolveMinimumRole('/error-logs', { ok: true }), 'admin');
assert.equal(resolveMinimumRole('/review-hub', { ok: true }), 'moderator');
assert.equal(resolveMinimumRole('/quote-template-management', { ok: true }), 'moderator');
assert.equal(resolveMinimumRole('/jjikjjiki-event-settings', { ok: true }), 'moderator');
assert.equal(resolveMinimumRole('/response-assistant-management', { ok: true }), 'moderator');
assert.equal(resolveMinimumRole('/saved-quotes/ABC-123', { ok: true }), 'employee');
assert.equal(resolveMinimumRole('/calendar', { ok: true, minRole: 'unexpected' }), null);
assert.equal(resolveMinimumRole('/calendar', { ok: true, minRole: 'manager' }), 'manager');

assert.equal(isRoleSufficient('admin', 'employee'), true);
assert.equal(isRoleSufficient('manager', 'manager'), true);
assert.equal(isRoleSufficient('employee', 'manager'), false);
assert.equal(isRoleSufficient(null, 'employee'), false);

for (const masterPath of [
  '/business-dashboard',
  '/employee-profiles?tab=contracts',
  '/error-logs',
  '/tax-invoices',
  '/user-statistics',
  '/year-end-tax-admin',
]) {
  assert.equal(isMasterProtectedPagePath(masterPath), true);
  assert.equal(
    passesMasterProtectedPageGate(masterPath, false),
    false,
    `A non-master admin menu must hide ${masterPath} even when the role policy allows it`,
  );
  assert.equal(passesMasterProtectedPageGate(masterPath, true), true);
}
assert.equal(isMasterProtectedPagePath('/admin-settings'), false);

const navigationRolePolicies = [{ page_key: '/calendar', min_role: 'manager' }];
assert.equal(
  isPageAllowedByPolicy('/calendar', 'manager', navigationRolePolicies, []),
  true,
);
assert.equal(
  isPageAllowedByPolicy('/calendar', 'employee', navigationRolePolicies, []),
  false,
  'DB role policy must override the local fallback',
);
assert.equal(
  isPageAllowedByPolicy(
    '/calendar',
    'employee',
    navigationRolePolicies,
    [{ page_key: '/calendar', effect: 'allow' }],
  ),
  true,
  'an explicit user allow must win over the role policy',
);
assert.equal(
  isPageAllowedByPolicy(
    '/calendar',
    'admin',
    navigationRolePolicies,
    [{ page_key: '/calendar', effect: 'deny' }],
  ),
  false,
  'an explicit user deny must win even for an otherwise sufficient role',
);
assert.equal(
  isPageAllowedByPolicy('/calculator', 'employee', [], [], { allowUnprotected: true }),
  true,
  'public navigation destinations must remain available',
);

assert.equal(isApprovedProfile({ is_approved: true }), true);
assert.equal(isApprovedProfile({ is_approved: false }), false);
assert.equal(isApprovedProfile({}), false);
assert.equal(isApprovedProfile(null), false);

const projectRoot = process.cwd();
const sharedAuthSource = await readFile(
  path.join(projectRoot, 'supabase/functions/_shared/auth.ts'),
  'utf8',
);
assert.match(sharedAuthSource, /options\.requireApproved !== false/);
assert.match(sharedAuthSource, /\.from\("profiles"\)/);
assert.match(sharedAuthSource, /Account approval required/);

const quoteWizardSource = await readFile(
  path.join(projectRoot, 'supabase/functions/quote-wizard/index.ts'),
  'utf8',
);
assert.match(quoteWizardSource, /requireFunctionAuth\(req\)/);
assert.match(quoteWizardSource, /\.from\("page_access_permissions"\)/);
assert.match(quoteWizardSource, /override\?\.effect === "deny"/);
assert.match(quoteWizardSource, /override\?\.effect === "allow"/);
assert.match(quoteWizardSource, /supabase\.rpc\("has_role"/);
assert.doesNotMatch(quoteWizardSource, /async function getAuthenticatedUser/);

const pageAccessHookSource = await readFile(
  path.join(projectRoot, 'src/hooks/usePageAccess.ts'),
  'utf8',
);
assert.match(pageAccessHookSource, /!user \|\| !isApproved/);
assert.doesNotMatch(pageAccessHookSource, /No restriction[^\n]*open to all/);

const authContextSource = await readFile(
  path.join(projectRoot, 'src/contexts/AuthContext.tsx'),
  'utf8',
);
assert.match(authContextSource, /!profileResult\.data\?\.is_approved/);
assert.match(authContextSource, /await supabase\.auth\.signOut\(\)/);

const appSource = await readFile(path.join(projectRoot, 'src/App.tsx'), 'utf8');
assert.match(
  appSource,
  /const S:[\s\S]*?<PageAccessGuard>[\s\S]*?<CompanySettingsGuard>/,
  'Sensitive routes must pass both the page role policy and company-master reauthentication',
);
for (const routePath of ['/admin-settings']) {
  assert.match(
    appSource,
    new RegExp(`<Route path="${routePath}" element=\\{<G>`),
    `${routePath} must use the shared page access policy`,
  );
}
for (const routePath of [
  '/user-statistics',
  '/admin-settings',
  '/employee-profiles',
  '/year-end-tax-admin',
  '/tax-invoices',
  '/business-dashboard',
  '/error-logs',
]) {
  if (routePath === '/admin-settings') continue;
  assert.match(
    appSource,
    new RegExp(`<Route path="${routePath}" element=\\{<S>`),
    `${routePath} must retain company-master reauthentication after the role check`,
  );
}
const guardedRoutePattern = /<Route path="([^"]+)" element=\{<[GS]>/g;
const guardedPolicyKeys = new Set<string>();
for (const routeMatch of appSource.matchAll(guardedRoutePattern)) {
  const concretePath = routeMatch[1].replace(/:[^/]+/g, 'test-id');
  const candidates = getPagePolicyCandidates(concretePath);
  guardedPolicyKeys.add(candidates[candidates.length - 1]);
  assert.notEqual(
    resolveMinimumRole(concretePath, { ok: true }),
    null,
    `PageAccessGuard route must have an explicit fallback policy: ${routeMatch[1]}`,
  );
}

const migrationFiles = (await (await import('node:fs/promises')).readdir(
  path.join(projectRoot, 'supabase/migrations'),
))
  .filter((fileName) => fileName.endsWith('.sql'))
  .sort();
const migrationSource = (await Promise.all(
  migrationFiles.map((fileName) => readFile(path.join(projectRoot, 'supabase/migrations', fileName), 'utf8')),
)).join('\n');
const authHardeningMigrationSource = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260812090100_auth_access_security_hardening.sql'),
  'utf8',
);
assert.match(authHardeningMigrationSource, /CREATE TABLE IF NOT EXISTS public\.company_master_users/);
assert.match(authHardeningMigrationSource, /CREATE TRIGGER normalize_page_role_access_key/);
for (const pageKey of guardedPolicyKeys) {
  assert.ok(
    migrationSource.includes(`('${pageKey}',`),
    `Migration must seed an explicit policy for guarded route: ${pageKey}`,
  );
}
const masterFunction = authHardeningMigrationSource.match(
  /CREATE OR REPLACE FUNCTION public\.is_company_master\(\)[\s\S]*?\$\$;/,
)?.[0];
assert.ok(masterFunction);
assert.match(masterFunction, /company_master_users/);
assert.doesNotMatch(masterFunction, /\.email/);
assert.match(authHardeningMigrationSource, /IF minimum_role IS NULL THEN\s+RETURN FALSE/);

const navigationAccessSource = await readFile(
  path.join(projectRoot, 'src/hooks/useNavigationPageAccess.ts'),
  'utf8',
);
assert.match(navigationAccessSource, /from\('page_role_access'\)/);
assert.match(navigationAccessSource, /from\('page_access_permissions'\)/);
assert.match(navigationAccessSource, /isPageAllowedByPolicy/);
assert.match(navigationAccessSource, /query\.error \|\| !query\.data/);

const navigationMigrationSource = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260819090000_attendance_status_and_page_access.sql'),
  'utf8',
);
assert.match(navigationMigrationSource, /ON CONFLICT \(page_key\) DO NOTHING/);
assert.equal(
  (navigationMigrationSource.match(/ON CONFLICT \(page_key\) DO UPDATE/g) || []).length,
  1,
  'Only the review-hub security correction may overwrite an existing role policy',
);
assert.match(
  navigationMigrationSource,
  /VALUES \('\/review-hub', 'moderator'\)\s+ON CONFLICT \(page_key\) DO UPDATE\s+SET min_role = EXCLUDED\.min_role/,
);

const adminSettingsSource = await readFile(
  path.join(projectRoot, 'src/pages/AdminSettingsPage.tsx'),
  'utf8',
);
for (const featureId of [
  'employee-profiles',
  'electronic-contracts',
  'pay-statements',
  'tax-invoices',
  'business-dashboard',
  'error-logs',
]) {
  const featureSource = adminSettingsSource.match(
    new RegExp(`id: '${featureId}'[\\s\\S]*?\\n  },`),
  )?.[0];
  assert.ok(featureSource, `Admin settings feature must exist: ${featureId}`);
  assert.match(featureSource, /access: 'master'/);
}
for (const featureId of [
  'quote-template-management',
  'response-assistant-management',
  'hamzzi-event-settings',
]) {
  const featureSource = adminSettingsSource.match(
    new RegExp(`id: '${featureId}'[\\s\\S]*?\\n  },`),
  )?.[0];
  assert.ok(featureSource, `Admin settings feature must exist: ${featureId}`);
  assert.match(featureSource, /access: 'admin-or-moderator'/);
}

console.log('Auth/access security regression tests passed.');
