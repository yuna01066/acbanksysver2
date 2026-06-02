import type { JSONContent } from '@tiptap/react';
import { PREBUILT_TEMPLATES } from '@/components/contract/template-editor/prebuiltTemplates';

export type ContractTemplateContentSource = 'saved' | 'prebuilt_fallback' | 'empty';

export interface ContractTemplateContentInput {
  content?: JSONContent | null;
  name?: string | null;
  template_type?: string | null;
}

export interface ResolvedContractTemplateContent {
  content: JSONContent | null;
  source: ContractTemplateContentSource;
  prebuiltTemplateId?: string;
  prebuiltTemplateName?: string;
}

const DEFAULT_PREBUILT_BY_TYPE: Record<string, string> = {
  labor: 'labor-regular-standard-2026',
  salary: 'salary-annual-2026',
};

const hasMeaningfulContent = (node?: JSONContent | null): boolean => {
  if (!node) return false;
  if (typeof node.text === 'string' && node.text.trim().length > 0) return true;
  if (!Array.isArray(node.content) || node.content.length === 0) return false;
  return node.content.some(hasMeaningfulContent);
};

const findPrebuiltTemplate = (templateType?: string | null, name?: string | null) => {
  const normalizedType = templateType || 'labor';
  const preferredId = DEFAULT_PREBUILT_BY_TYPE[normalizedType];
  if (preferredId) {
    const preferred = PREBUILT_TEMPLATES.find((template) => template.id === preferredId);
    if (preferred) return preferred;
  }

  const normalizedName = (name || '').trim();
  if (normalizedName) {
    const exactName = PREBUILT_TEMPLATES.find((template) => (
      template.type === normalizedType && template.name === normalizedName
    ));
    if (exactName) return exactName;
  }

  return PREBUILT_TEMPLATES.find((template) => template.type === normalizedType) || null;
};

export const resolveContractTemplateContent = (
  template?: ContractTemplateContentInput | null,
): ResolvedContractTemplateContent => {
  if (hasMeaningfulContent(template?.content)) {
    return {
      content: template?.content || null,
      source: 'saved',
    };
  }

  const prebuiltTemplate = findPrebuiltTemplate(template?.template_type, template?.name);
  if (!prebuiltTemplate) {
    return {
      content: null,
      source: 'empty',
    };
  }

  return {
    content: prebuiltTemplate.content,
    source: 'prebuilt_fallback',
    prebuiltTemplateId: prebuiltTemplate.id,
    prebuiltTemplateName: prebuiltTemplate.name,
  };
};
