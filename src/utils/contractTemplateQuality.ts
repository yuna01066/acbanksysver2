import type { JSONContent } from '@tiptap/react';

export interface ContractTemplateQuality {
  ok: boolean;
  missing: string[];
  present: string[];
}

const REQUIRED_PLACEHOLDERS = ['계약일', '구성원이름', '구성원직인'];
const COMPANY_IDENTITY_PLACEHOLDERS = ['회사명', '대표자명'];

function collectFromText(text: string | undefined, keys: Set<string>) {
  if (!text) return;
  const matches = text.matchAll(/\{\{([^}]+)\}\}/g);
  for (const match of matches) {
    const key = match[1]?.trim();
    if (key) keys.add(key);
  }
}

function walkNode(node: JSONContent | null | undefined, keys: Set<string>) {
  if (!node) return;
  if (node.type === 'mention') {
    const key = String(node.attrs?.id || node.attrs?.label || '').trim();
    if (key) keys.add(key);
  }
  collectFromText(node.text, keys);
  node.content?.forEach((child) => walkNode(child, keys));
}

export function extractContractPlaceholderKeys(content: JSONContent | null | undefined) {
  const keys = new Set<string>();
  walkNode(content, keys);
  return keys;
}

export function evaluateContractTemplateQuality(content: JSONContent | null | undefined): ContractTemplateQuality {
  const keys = extractContractPlaceholderKeys(content);
  const missing = REQUIRED_PLACEHOLDERS.filter((key) => !keys.has(key));
  if (!COMPANY_IDENTITY_PLACEHOLDERS.some((key) => keys.has(key))) {
    missing.push('회사명 또는 대표자명');
  }

  return {
    ok: missing.length === 0,
    missing,
    present: Array.from(keys).sort((a, b) => a.localeCompare(b, 'ko')),
  };
}
