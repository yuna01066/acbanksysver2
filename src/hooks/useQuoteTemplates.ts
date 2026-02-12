import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface QuoteTemplateSection {
  id: string;
  template_id: string;
  section_type: string; // 'items' | 'formula' | 'image' | 'divider' | 'info'
  title: string;
  display_order: number;
  config: Record<string, any>;
  items?: QuoteTemplateItem[];
}

export interface QuoteTemplateItem {
  id: string;
  section_id: string;
  name: string;
  description: string | null;
  unit_price: number;
  quantity: number;
  unit: string;
  display_order: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  is_default: boolean;
  vat_option: string;
  discount_rate: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sections?: QuoteTemplateSection[];
}

export function useQuoteTemplates() {
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('quote_templates')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTemplates(data as any[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  return { templates, loading, refresh: fetchTemplates };
}

export async function fetchTemplateWithDetails(templateId: string): Promise<QuoteTemplate | null> {
  const { data: template } = await supabase
    .from('quote_templates')
    .select('*')
    .eq('id', templateId)
    .single();
  if (!template) return null;

  const { data: sections } = await supabase
    .from('quote_template_sections')
    .select('*')
    .eq('template_id', templateId)
    .order('display_order');

  const sectionIds = (sections || []).map(s => s.id);
  let items: any[] = [];
  if (sectionIds.length > 0) {
    const { data } = await supabase
      .from('quote_template_items')
      .select('*')
      .in('section_id', sectionIds)
      .order('display_order');
    items = data || [];
  }

  const sectionsWithItems = (sections || []).map(s => ({
    ...s,
    config: s.config || {},
    items: items.filter(i => i.section_id === s.id),
  }));

  return { ...(template as any), sections: sectionsWithItems };
}
