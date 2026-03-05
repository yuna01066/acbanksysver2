import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotionProject {
  id: string;
  title: string;
  date?: string;
  createdDate: string;
  lastEditedTime: string;
  startDate: string;
  endDate: string;
  assignee: string;
  assigneeList: string[];
  status: string;
  url: string;
}

interface UseNotionProjectsOptions {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
}

export const NOTION_PROJECTS_QUERY_KEY = ['notion-projects'] as const;

export const useNotionProjects = ({
  enabled = true,
  staleTime = 5 * 60 * 1000,
  refetchInterval = false,
}: UseNotionProjectsOptions = {}) => {
  return useQuery({
    queryKey: NOTION_PROJECTS_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('notion-projects');
      if (error) throw error;
      return (data?.projects || []) as NotionProject[];
    },
    enabled,
    staleTime,
    refetchInterval,
    retry: 1,
  });
};
