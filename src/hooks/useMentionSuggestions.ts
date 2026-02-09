import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MentionUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  department: string | null;
}

export const useMentionSuggestions = () => {
  const [users, setUsers] = useState<MentionUser[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, department')
        .eq('is_approved', true)
        .order('full_name');
      if (data) setUsers(data);
    };
    fetchUsers();
  }, []);

  const filterUsers = (query: string) => {
    if (!query) return users.slice(0, 5);
    const q = query.toLowerCase();
    return users.filter(u => u.full_name.toLowerCase().includes(q)).slice(0, 5);
  };

  return { users, filterUsers };
};
