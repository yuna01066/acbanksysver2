import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNotionProjects } from '@/hooks/useNotionProjects';

export interface TaggableProject {
  id: string;
  title: string;
  source: 'quote' | 'notion' | 'project';
  url?: string;
  status?: string;
}

export const useProjectSuggestions = () => {
  const { user } = useAuth();

  const { data: quotes = [] } = useQuery({
    queryKey: ['project-suggestion-quotes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_quotes')
        .select('id, project_name, quote_number, project_stage')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: internalProjects = [] } = useQuery({
    queryKey: ['project-suggestion-projects'],
    queryFn: async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, status')
        .order('created_at', { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: notionProjectsRaw = [] } = useNotionProjects({
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const projects = useMemo<TaggableProject[]>(() => {
    const notionProjects: TaggableProject[] = notionProjectsRaw.map((p) => ({
      id: p.id,
      title: p.title,
      source: 'notion',
      url: p.url,
      status: p.status,
    }));

    const quoteItems: TaggableProject[] = quotes
      .filter((q) => q.project_name || q.quote_number)
      .map((q) => ({
        id: q.id,
        title: q.project_name || q.quote_number,
        source: 'quote',
        status: q.project_stage,
      }));

    const projectItems: TaggableProject[] = internalProjects
      .filter((p) => p.name)
      .map((p) => ({
        id: p.id,
        title: p.name,
        source: 'project',
        status: p.status,
      }));

    return [...projectItems, ...quoteItems, ...notionProjects];
  }, [internalProjects, notionProjectsRaw, quotes]);

  const filterProjects = (query: string): TaggableProject[] => {
    if (!query) return projects.slice(0, 8);
    const q = query.toLowerCase();
    return projects.filter((p) => p.title.toLowerCase().includes(q)).slice(0, 8);
  };

  const findProject = (tagName: string): TaggableProject | undefined => {
    const normalized = tagName.replace(/_/g, ' ').toLowerCase();
    return projects.find((p) => p.title.toLowerCase() === normalized);
  };

  return { projects, filterProjects, findProject };
};
