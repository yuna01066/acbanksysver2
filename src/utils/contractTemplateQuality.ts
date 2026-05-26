import type { JSONContent } from '@tiptap/react';

export interface ContractTemplateQuality {
  ok: boolean;
  missing: string[];
  warnings: string[];
  present: string[];
}

export interface ContractTemplateQualityOptions {
  templateType?: string | null;
}

const REQUIRED_PLACEHOLDERS = ['계약일', '회사명', '대표자명', '구성원이름', '생년월일', '구성원직인', '회사직인'];
const WAGE_TEMPLATE_TYPES = new Set(['labor', 'salary']);
const WAGE_PLACEHOLDERS = ['월급', '기본급', '급여일', '근무요일', '계약시작일'];
const COMPREHENSIVE_PLACEHOLDERS = ['고정연장시간', '고정연장수당'];

function collectFromText(text: string | undefined, keys: Set<string>, textParts: string[]) {
  if (!text) return;
  textParts.push(text);
  const matches = text.matchAll(/\{\{([^}]+)\}\}/g);
  for (const match of matches) {
    const key = match[1]?.trim();
    if (key) keys.add(key);
  }
}

function walkNode(node: JSONContent | null | undefined, keys: Set<string>, textParts: string[]) {
  if (!node) return;
  if (node.type === 'mention') {
    const key = String(node.attrs?.id || node.attrs?.label || '').trim();
    if (key) keys.add(key);
  }
  collectFromText(node.text, keys, textParts);
  node.content?.forEach((child) => walkNode(child, keys, textParts));
}

export function extractContractPlaceholderKeys(content: JSONContent | null | undefined) {
  const keys = new Set<string>();
  walkNode(content, keys, []);
  return keys;
}

function collectTemplateText(content: JSONContent | null | undefined) {
  const textParts: string[] = [];
  walkNode(content, new Set<string>(), textParts);
  return textParts.join(' ');
}

function hasComprehensiveWageSignal(keys: Set<string>, text: string) {
  return COMPREHENSIVE_PLACEHOLDERS.some((key) => keys.has(key))
    || text.includes('포괄임금')
    || text.includes('고정연장');
}

function hasSeparateExcessPayText(text: string) {
  return text.includes('초과분') && text.includes('별도') && text.includes('지급');
}

export function evaluateContractTemplateQuality(
  content: JSONContent | null | undefined,
  options: ContractTemplateQualityOptions = {},
): ContractTemplateQuality {
  const keys = extractContractPlaceholderKeys(content);
  const fullText = collectTemplateText(content);
  const missing = REQUIRED_PLACEHOLDERS.filter((key) => !keys.has(key));
  const warnings: string[] = [];

  if (options.templateType && WAGE_TEMPLATE_TYPES.has(options.templateType)) {
    const wageMissing = WAGE_PLACEHOLDERS.filter((key) => !keys.has(key));
    if (wageMissing.length > 0) {
      warnings.push(`임금형 필드 확인 필요: ${wageMissing.join(', ')}`);
    }
  }

  if (hasComprehensiveWageSignal(keys, fullText)) {
    const comprehensiveMissing = COMPREHENSIVE_PLACEHOLDERS.filter((key) => !keys.has(key));
    if (comprehensiveMissing.length > 0) {
      warnings.push(`포괄임금 필드 확인 필요: ${comprehensiveMissing.join(', ')}`);
    }
    if (!hasSeparateExcessPayText(fullText)) {
      warnings.push('포괄임금형은 "초과분 별도 지급" 문구가 필요합니다.');
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    present: Array.from(keys).sort((a, b) => a.localeCompare(b, 'ko')),
  };
}
