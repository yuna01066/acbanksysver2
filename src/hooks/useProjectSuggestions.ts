import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TaggableProject {
  id: string;
  title: string;
  source: 'quote' | 'notion';
  url?: string;
  status?: string;
}

export const useProjectSuggestions = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<TaggableProject[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchProjects = async () => {
      // Fetch saved quotes (project names)
      const { data: quotes } = await supabase
        .from('saved_quotes')
        .select('id, project_name, quote_number, project_stage')
        .order('created_at', { ascending: false })
        .limit(50);

      // Fetch Notion projects
      let notionProjects: TaggableProject[] = [];
      try {
        const { data } = await supabase.functions.invoke('notion-projects');
        if (data?.projects) {
          notionProjects = data.projects.map((p: any) => ({
            id: p.id,
            title: p.title,
            source: 'notion' as const,
            url: p.url,
            status: p.status,
          }));
        }
      } catch {
        // Notion fetch failed, continue with quotes only
      }

      const quoteProjects: TaggableProject[] = (quotes || [])
        .filter(q => q.project_name || q.quote_number)
        .map(q => ({
          id: q.id,
          title: q.project_name || q.quote_number,
          source: 'quote' as const,
          status: q.project_stage,
        }));

      setProjects([...notionProjects, ...quoteProjects]);
    };

    fetchProjects();
  }, [user]);

  const filterProjects = (query: string): TaggableProject[] => {
    if (!query) return projects.slice(0, 6);
    const q = query.toLowerCase();
    return projects.filter(p => p.title.toLowerCase().includes(q)).slice(0, 6);
  };

  const findProject = (tagName: string): TaggableProject | undefined => {
    const normalized = tagName.replace(/_/g, ' ').toLowerCase();
    return projects.find(p => p.title.toLowerCase() === normalized);
  };

  return { projects, filterProjects, findProject };
};
