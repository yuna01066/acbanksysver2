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

      const { data, error } = await supabase
        .from('page_role_access')
        .select('min_role')
        .eq('page_key', pageKey)
        .maybeSingle();

      if (error || !data) {
        // No restriction — open to all
        setAllowed(true);
      } else {
        const minRole = data.min_role as AppRole;
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
