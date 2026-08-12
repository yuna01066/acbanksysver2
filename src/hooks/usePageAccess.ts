import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPagePolicyCandidates,
  isRoleSufficient,
  normalizePagePath,
  resolveMinimumRole,
} from '@/lib/pageAccessPolicy';
import { useLocation } from 'react-router-dom';

// Pages where we should allow access if the user owns related data
const OWNER_BYPASS_PAGES = ['/saved-quotes', '/quotes-summary', '/customer-quotes-summary'];

/**
 * Hook that checks if the current user has access to a given page.
 * Rules:
 * - Unknown protected pages and policy lookup failures are denied
 * - Only explicitly registered protected pages may use a local fallback policy
 * - If a min_role is set, only users with that role or higher can access
 * - For quote-related pages, the author always has access to their own data
 * - Role hierarchy: admin > moderator > manager > employee
 */
export const usePageAccess = () => {
  const { user, userRole, isApproved, loading: authLoading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (authLoading) {
      setChecking(true);
      return () => {
        cancelled = true;
      };
    }

    if (!user || !isApproved) {
      setAllowed(false);
      setChecking(false);
      return () => {
        cancelled = true;
      };
    }

    const checkAccess = async () => {
      setChecking(true);
      const pageKey = normalizePagePath(location.pathname);
      const pathsToCheck = getPagePolicyCandidates(pageKey);
      const segments = pageKey.split('/').filter(Boolean);

      try {
        const { data: userOverrides, error: userOverridesError } = await supabase
          .from('page_access_permissions')
          .select('page_key, effect')
          .eq('user_id', user.id)
          .in('page_key', pathsToCheck);

        if (cancelled) return;

        if (userOverridesError) {
          console.warn('[PageAccess] Failed to load user overrides', userOverridesError);
          setAllowed(false);
          return;
        }

        const matchedOverride = pathsToCheck
          .map(path => userOverrides?.find((row) => normalizePagePath(row.page_key) === path))
          .find(Boolean) as { effect?: string } | undefined;

        if (matchedOverride?.effect === 'deny') {
          setAllowed(false);
          return;
        }

        if (matchedOverride?.effect === 'allow') {
          setAllowed(true);
          return;
        }

        const { data, error } = await supabase
          .from('page_role_access')
          .select('page_key, min_role')
          .in('page_key', pathsToCheck)
          .limit(pathsToCheck.length);

        if (cancelled) return;

        if (error) {
          console.warn('[PageAccess] Failed to load role access policy', error);
          setAllowed(false);
          return;
        }

        const matchedRole = pathsToCheck
          .map(path => data?.find((row) => normalizePagePath(row.page_key) === path))
          .find(Boolean);
        const minimumRole = resolveMinimumRole(pageKey, {
          ok: true,
          minRole: matchedRole?.min_role,
        });

        if (!minimumRole) {
          setAllowed(false);
          return;
        }

        if (isRoleSufficient(userRole, minimumRole)) {
          setAllowed(true);
          return;
        }

        // Role insufficient — check if user owns data on bypass pages.
        const basePath = segments.length > 0 ? `/${segments[0]}` : '/';
        if (OWNER_BYPASS_PAGES.includes(basePath)) {
          const hasOwnData = await checkOwnership(user.id, basePath, pageKey);
          if (cancelled) return;
          setAllowed(hasOwnData);
          return;
        }

        setAllowed(false);
      } catch (error) {
        console.error('[PageAccess] Unexpected access check failure', error);
        if (!cancelled) setAllowed(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [user, userRole, isApproved, authLoading, location.pathname]);

  return { allowed, checking };
};

/**
 * Check if the user owns any data relevant to the page they're trying to access.
 */
async function checkOwnership(userId: string, basePath: string, fullPath: string): Promise<boolean> {
  if (basePath === '/saved-quotes') {
    // For detail page /saved-quotes/:id, check ownership of that specific quote
    const segments = fullPath.split('/').filter(Boolean);
    if (segments.length >= 2) {
      const quoteId = segments[1];
      const { count } = await supabase
        .from('saved_quotes')
        .select('id', { count: 'exact', head: true })
        .eq('id', quoteId)
        .or(`user_id.eq.${userId},issuer_id.eq.${userId}`);
      return (count ?? 0) > 0;
    }
    // For list page, check if user has any quotes (as creator or issuer)
    const { count } = await supabase
      .from('saved_quotes')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},issuer_id.eq.${userId}`)
      .limit(1);
    return (count ?? 0) > 0;
  }

  if (basePath === '/quotes-summary' || basePath === '/customer-quotes-summary') {
    const { count } = await supabase
      .from('saved_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .limit(1);
    return (count ?? 0) > 0;
  }

  return false;
}
