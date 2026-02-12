import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type AppRole, ROLE_HIERARCHY } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * Hook that checks if the current user has access to a given page.
 * Rules:
 * - If no role restriction is set for a page, it's open to all authenticated users
 * - If a min_role is set, only users with that role or higher can access
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
        // Lower index = higher privilege
        setAllowed(userIdx <= minIdx);
      }
      setChecking(false);
    };

    checkAccess();
  }, [user, userRole, authLoading, location.pathname]);

  return { allowed, checking };
};
