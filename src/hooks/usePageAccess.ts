import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'react-router-dom';

/**
 * Hook that checks if the current user has access to a given page.
 * Rules:
 * - Admin and Moderator always have access
 * - If no permissions are set for a page, it's open to all authenticated users
 * - If permissions exist, only listed users (+ admin/moderator) can access
 */
export const usePageAccess = () => {
  const { user, isAdmin, isModerator, loading: authLoading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState(true);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (authLoading || !user) {
      setChecking(false);
      return;
    }

    // Admins and moderators always have access
    if (isAdmin || isModerator) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    const checkAccess = async () => {
      const pageKey = location.pathname;

      // Check if there are any permissions set for this page
      const { data, error } = await supabase
        .from('page_access_permissions')
        .select('user_id')
        .eq('page_key', pageKey);

      if (error || !data || data.length === 0) {
        // No restrictions set — page is open to all
        setAllowed(true);
      } else {
        // Check if current user is in the allowed list
        setAllowed(data.some(p => p.user_id === user.id));
      }
      setChecking(false);
    };

    checkAccess();
  }, [user, isAdmin, isModerator, authLoading, location.pathname]);

  return { allowed, checking };
};
