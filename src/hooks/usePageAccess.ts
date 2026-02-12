import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type AppRole, ROLE_HIERARCHY } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

// Pages where we should allow access if the user owns related data
const OWNER_BYPASS_PAGES = ['/saved-quotes', '/quotes-summary', '/customer-quotes-summary'];

/**
 * Hook that checks if the current user has access to a given page.
 * Rules:
 * - If no role restriction is set for a page, it's open to all authenticated users
 * - If a min_role is set, only users with that role or higher can access
 * - For quote-related pages, the author always has access to their own data
 * - Role hierarchy: admin > moderator > manager > employee
 */
export const usePageAccess = () => {
  const { user, userRole, loading: authLoading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setChecking(false);
      return;
    }

    const checkAccess = async () => {
      const pageKey = location.pathname;

      // Try exact match first, then parent path (e.g. /saved-quotes/abc → /saved-quotes)
      const pathsToCheck = [pageKey];
      const segments = pageKey.split('/').filter(Boolean);
      if (segments.length > 1) {
        pathsToCheck.push('/' + segments[0]);
      }

      const { data, error } = await supabase
        .from('page_role_access')
        .select('min_role')
        .in('page_key', pathsToCheck)
        .order('min_role', { ascending: true })
        .limit(1);

      if (error || !data || data.length === 0) {
        // No restriction — open to all
        setAllowed(true);
      } else {
        const minRole = data[0].min_role as AppRole;
        const minIdx = ROLE_HIERARCHY.indexOf(minRole);
        const userIdx = userRole ? ROLE_HIERARCHY.indexOf(userRole) : ROLE_HIERARCHY.length;

        if (userIdx <= minIdx) {
          // Role is sufficient
          setAllowed(true);
        } else {
          // Role insufficient — check if user owns data on bypass pages
          const basePath = '/' + segments[0];
          if (OWNER_BYPASS_PAGES.includes(basePath)) {
            const hasOwnData = await checkOwnership(user.id, basePath, pageKey);
            setAllowed(hasOwnData);
          } else {
            setAllowed(false);
          }
        }
      }
      setChecking(false);
    };

    checkAccess();
  }, [user, userRole, authLoading, location.pathname]);

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
        .eq('user_id', userId);
      return (count ?? 0) > 0;
    }
    // For list page, check if user has any quotes
    const { count } = await supabase
      .from('saved_quotes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
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
