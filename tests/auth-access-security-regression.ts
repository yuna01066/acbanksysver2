import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getPagePolicyCandidates,
  isRoleSufficient,
  normalizePagePath,
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
assert.equal(resolveMinimumRole('/saved-quotes/ABC-123', { ok: true }), 'employee');
assert.equal(resolveMinimumRole('/calendar', { ok: true, minRole: 'unexpected' }), null);
assert.equal(resolveMinimumRole('/calendar', { ok: true, minRole: 'manager' }), 'manager');

assert.equal(isRoleSufficient('admin', 'employee'), true);
assert.equal(isRoleSufficient('manager', 'manager'), true);
assert.equal(isRoleSufficient('employee', 'manager'), false);
assert.equal(isRoleSufficient(null, 'employee'), false);

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
const guardedRoutePattern = /<Route path="([^"]+)" element=\{<G>/g;
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

const migrationSource = await readFile(
  path.join(projectRoot, 'supabase/migrations/20260812090100_auth_access_security_hardening.sql'),
  'utf8',
);
assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.company_master_users/);
assert.match(migrationSource, /CREATE TRIGGER normalize_page_role_access_key/);
for (const pageKey of guardedPolicyKeys) {
  assert.ok(
    migrationSource.includes(`('${pageKey}',`),
    `Migration must seed an explicit policy for guarded route: ${pageKey}`,
  );
}
const masterFunction = migrationSource.match(
  /CREATE OR REPLACE FUNCTION public\.is_company_master\(\)[\s\S]*?\$\$;/,
)?.[0];
assert.ok(masterFunction);
assert.match(masterFunction, /company_master_users/);
assert.doesNotMatch(masterFunction, /\.email/);
assert.match(migrationSource, /IF minimum_role IS NULL THEN\s+RETURN FALSE/);

console.log('Auth/access security regression tests passed.');
