import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  getExplicitPageMinimumRole,
  isPageAllowedByPolicy,
} from '@/lib/pageAccessPolicy';

type PageRolePolicyRow = {
  page_key: string;
  min_role: string;
};

type PageOverrideRow = {
  page_key: string;
  effect: string;
};

type NavigationPageAccessSnapshot = {
  rolePolicies: PageRolePolicyRow[];
  userOverrides: PageOverrideRow[];
};

export const NAVIGATION_PAGE_ACCESS_QUERY_KEY = 'navigation-page-access';

/**
 * Loads one access-policy snapshot shared by global and dashboard navigation.
 * Protected destinations fail closed when the policy lookup is unavailable.
 */
export function useNavigationPageAccess() {
  const { user, userRole, isApproved, loading: authLoading } = useAuth();

  const query = useQuery<NavigationPageAccessSnapshot>({
    queryKey: [NAVIGATION_PAGE_ACCESS_QUERY_KEY, user?.id],
    queryFn: async () => {
      const [rolePolicyResult, userOverrideResult] = await Promise.all([
        supabase
          .from('page_role_access')
          .select('page_key, min_role'),
        supabase
          .from('page_access_permissions')
          .select('page_key, effect')
          .eq('user_id', user!.id),
      ]);

      if (rolePolicyResult.error) throw rolePolicyResult.error;
      if (userOverrideResult.error) throw userOverrideResult.error;

      return {
        rolePolicies: (rolePolicyResult.data || []) as PageRolePolicyRow[],
        userOverrides: (userOverrideResult.data || []) as PageOverrideRow[],
      };
    },
    enabled: Boolean(user && isApproved && !authLoading),
    staleTime: 30 * 1000,
  });

  const canAccessPath = useCallback((rawPath: string) => {
    const explicitMinimumRole = getExplicitPageMinimumRole(rawPath);

    // Destinations without PageAccessGuard remain available even while the
    // protected-page policy snapshot is loading or unavailable.
    if (!explicitMinimumRole && !query.data) return true;

    if (authLoading || !user || !isApproved || query.error || !query.data) {
      return false;
    }

    return isPageAllowedByPolicy(
      rawPath,
      userRole,
      query.data.rolePolicies,
      query.data.userOverrides,
      { allowUnprotected: true },
    );
  }, [authLoading, isApproved, query.data, query.error, user, userRole]);

  return {
    canAccessPath,
    checking: authLoading || query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
