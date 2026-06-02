import type { JSONContent } from '@tiptap/react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

export interface ContractRenderInput {
  templateContent?: JSONContent | null;
  contract: Record<string, any>;
  companyInfo?: Record<string, any> | null;
  employee?: Record<string, any> | null;
  companySealUrl?: string | null;
  signatureImageUrl?: string | null;
  includeCompanySeal?: boolean;
}

const escapeHtml = (value: unknown) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const formatDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy년 MM월 dd일', { locale: ko });
  } catch {
    return value;
  }
};

const formatPlainDate = (value?: string | null) => {
  if (!value) return '';
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return value;
  }
};

const formatNumber = (value?: number | string | null) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return '';
  return n.toLocaleString('ko-KR');
};

const MONTHLY_STANDARD_HOURS = 209;

const getWageBasisLabel = (contract: Record<string, any>) => {
  const rawBasis = String(contract.wage_basis || '').trim();
  const normalizedBasis = rawBasis.toLowerCase();
  if (normalizedBasis.includes('시급') || normalizedBasis.includes('hour')) return '시급';
  if (normalizedBasis.includes('연봉') || normalizedBasis.includes('annual')) return '연봉';
  if (normalizedBasis.includes('월급') || normalizedBasis.includes('monthly')) return '월급';
  if (rawBasis && rawBasis !== '통상임금') return rawBasis;
  if (contract.annual_salary && !contract.monthly_salary) return '연봉';
  return '월급';
};

const getMonthlySalary = (contract: Record<string, any>) => {
  if (contract.monthly_salary) return Number(contract.monthly_salary);
  if (contract.annual_salary) return Math.round(Number(contract.annual_salary) / 12);
  return null;
};

const getAnnualSalary = (contract: Record<string, any>) => {
  if (contract.annual_salary) return Number(contract.annual_salary);
  const monthlySalary = getMonthlySalary(contract);
  return monthlySalary ? Math.round(monthlySalary * 12) : null;
};

const getHourlyWage = (contract: Record<string, any>) => {
  if (contract.hourly_wage) return Number(contract.hourly_wage);
  if (getWageBasisLabel(contract) !== '시급') return null;
  const monthlySalary = getMonthlySalary(contract);
  return monthlySalary ? Math.round(monthlySalary / MONTHLY_STANDARD_HOURS) : null;
};

export function contractSignaturePlaceholder() {
  return '<span data-contract-placeholder="구성원직인" style="display:inline-flex;align-items:center;justify-content:center;min-width:120px;min-height:48px;border:1px dashed #94a3b8;border-radius:4px;color:#64748b;font-size:12px;">서명 대기</span>';
}

export function companySealPlaceholder() {
  return '<span data-contract-placeholder="회사직인" style="display:inline-flex;align-items:center;justify-content:center;min-width:96px;min-height:48px;border:1px dashed #ef4444;border-radius:4px;color:#dc2626;font-size:12px;">회사 직인</span>';
}

function imageHtml(src: string, alt: string) {
  return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="display:inline-block;max-width:150px;max-height:64px;object-fit:contain;vertical-align:middle;" />`;
}

export function buildContractPlaceholderValues(input: ContractRenderInput): Record<string, string> {
  const { contract, companyInfo, employee, companySealUrl, signatureImageUrl, includeCompanySeal } = input;
  const companyAddress = [companyInfo?.address, companyInfo?.detail_address].filter(Boolean).join(' ');
  const employeeAddress = [employee?.address, employee?.detail_address].filter(Boolean).join(' ');

  return {
    회사명: escapeHtml(companyInfo?.company_name || 'ACRIVE'),
    회사주소: escapeHtml(companyAddress || companyInfo?.address || ''),
    사업자등록번호: escapeHtml(companyInfo?.business_number || ''),
    대표자명: escapeHtml(companyInfo?.ceo_name || '대표'),
    업태: escapeHtml(companyInfo?.business_type || ''),
    업종: escapeHtml(companyInfo?.industry || ''),
    회사전화: escapeHtml(companyInfo?.phone || ''),
    회사이메일: escapeHtml(companyInfo?.email || ''),
    회사직인: includeCompanySeal
      ? (companySealUrl ? imageHtml(companySealUrl, '회사 직인') : companySealPlaceholder())
      : escapeHtml('직인 생략'),
    구성원직인: signatureImageUrl ? imageHtml(signatureImageUrl, '구성원 서명') : contractSignaturePlaceholder(),
    구성원이름: escapeHtml(contract.user_name || employee?.full_name || ''),
    생년월일: escapeHtml(formatPlainDate(contract.birth_date || employee?.birthday)),
    부서: escapeHtml(contract.department || employee?.department || ''),
    직위: escapeHtml(contract.position || employee?.position || ''),
    직책: escapeHtml(employee?.job_title || employee?.rank_title || contract.position || ''),
    입사일: escapeHtml(formatPlainDate(employee?.join_date || contract.contract_start_date)),
    주소: escapeHtml(employeeAddress),
    전화번호: escapeHtml(employee?.phone || ''),
    이메일: escapeHtml(employee?.email || ''),
    급여형태: escapeHtml(getWageBasisLabel(contract)),
    연봉: escapeHtml(formatNumber(getAnnualSalary(contract))),
    월급: escapeHtml(formatNumber(getMonthlySalary(contract))),
    시급: escapeHtml(formatNumber(getHourlyWage(contract))),
    월소정근로시간: escapeHtml(String(MONTHLY_STANDARD_HOURS)),
    기본급: escapeHtml(formatNumber(contract.base_pay)),
    고정연장수당: escapeHtml(formatNumber(contract.fixed_overtime_pay)),
    고정연장시간: escapeHtml(contract.fixed_overtime_hours ?? contract.comprehensive_wage_hours ?? ''),
    급여일: escapeHtml(String(contract.pay_day || 25)),
    계약일: escapeHtml(formatDate(contract.contract_date)),
    계약시작일: escapeHtml(formatDate(contract.contract_start_date)),
    계약종료일: escapeHtml(formatDate(contract.contract_end_date) || '기간의 정함 없음'),
    수습시작일: escapeHtml(formatDate(contract.probation_start_date)),
    수습종료일: escapeHtml(formatDate(contract.probation_end_date)),
    수습기간: escapeHtml(contract.probation_period || '수습 없음'),
    근무형태: escapeHtml(contract.work_type || '고정 근무제'),
    근무요일: escapeHtml(contract.work_days || '월,화,수,목,금요일'),
  };
}

function replaceTextPlaceholders(text: string, values: Record<string, string>) {
  return escapeHtml(text).replace(/\{\{([^}]+)\}\}/g, (_match, key) => values[key] ?? escapeHtml(key));
}

function attrsToStyle(attrs: Record<string, any> = {}) {
  const styles: string[] = [];
  if (attrs.textAlign) styles.push(`text-align:${attrs.textAlign}`);
  if (attrs.colspan) styles.push(`grid-column:span ${attrs.colspan}`);
  if (attrs.rowspan) styles.push(`grid-row:span ${attrs.rowspan}`);
  return styles.length ? ` style="${styles.join(';')}"` : '';
}

function renderMarks(html: string, marks?: any[]) {
  if (!marks?.length) return html;
  return marks.reduce((acc, mark) => {
    if (mark.type === 'bold') return `<strong>${acc}</strong>`;
    if (mark.type === 'italic') return `<em>${acc}</em>`;
    if (mark.type === 'underline') return `<u>${acc}</u>`;
    if (mark.type === 'strike') return `<s>${acc}</s>`;
    if (mark.type === 'textStyle' && mark.attrs?.color) {
      return `<span style="color:${escapeHtml(mark.attrs.color)}">${acc}</span>`;
    }
    if (mark.type === 'highlight') {
      const color = mark.attrs?.color || '#fef3c7';
      return `<mark style="background-color:${escapeHtml(color)}">${acc}</mark>`;
    }
    return acc;
  }, html);
}

function renderNode(node: JSONContent | undefined, values: Record<string, string>): string {
  if (!node) return '';

  switch (node.type) {
    case 'doc':
      return (node.content || []).map((child) => renderNode(child, values)).join('');
    case 'text':
      return renderMarks(replaceTextPlaceholders(node.text || '', values), node.marks);
    case 'mention': {
      const key = node.attrs?.id || node.attrs?.label || '';
      return values[key] ?? escapeHtml(key);
    }
    case 'paragraph': {
      const content = (node.content || []).map((child) => renderNode(child, values)).join('');
      return `<p${attrsToStyle(node.attrs)}>${content || '<br />'}</p>`;
    }
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level || 2), 1), 6);
      const content = (node.content || []).map((child) => renderNode(child, values)).join('');
      return `<h${level}${attrsToStyle(node.attrs)}>${content}</h${level}>`;
    }
    case 'bulletList':
      return `<ul>${(node.content || []).map((child) => renderNode(child, values)).join('')}</ul>`;
    case 'orderedList':
      return `<ol>${(node.content || []).map((child) => renderNode(child, values)).join('')}</ol>`;
    case 'listItem':
      return `<li>${(node.content || []).map((child) => renderNode(child, values)).join('')}</li>`;
    case 'table':
      return `<table>${(node.content || []).map((child) => renderNode(child, values)).join('')}</table>`;
    case 'tableRow':
      return `<tr>${(node.content || []).map((child) => renderNode(child, values)).join('')}</tr>`;
    case 'tableHeader':
      return `<th>${(node.content || []).map((child) => renderNode(child, values)).join('')}</th>`;
    case 'tableCell':
      return `<td>${(node.content || []).map((child) => renderNode(child, values)).join('')}</td>`;
    case 'horizontalRule':
      return '<hr />';
    case 'hardBreak':
      return '<br />';
    default:
      return (node.content || []).map((child) => renderNode(child, values)).join('');
  }
}

export function renderContractHtml(input: ContractRenderInput) {
  const values = buildContractPlaceholderValues(input);
  const body = input.templateContent
    ? renderNode(input.templateContent, values)
    : `<h1 style="text-align:center">전자계약서</h1><p>${values.회사명}와 ${values.구성원이름}은 본 문서의 내용에 동의합니다.</p><p style="text-align:center">${values.계약일}</p><p>회사: ${values.회사명} ${values.회사직인}</p><p>구성원: ${values.구성원이름} ${values.구성원직인}</p>`;

  return `<article class="contract-document">${body}</article>`;
}

export function injectSignatureIntoRenderedHtml(renderedHtml: string, signatureImageUrl?: string | null) {
  if (!signatureImageUrl) return renderedHtml;
  const signature = imageHtml(signatureImageUrl, '구성원 서명');
  return renderedHtml.replace(
    /<span[^>]*data-contract-placeholder=["']구성원직인["'][^>]*>.*?<\/span>/g,
    signature,
  );
}

export function injectCompanySealIntoRenderedHtml(renderedHtml: string, companySealUrl?: string | null) {
  if (!companySealUrl) return renderedHtml;
  const seal = imageHtml(companySealUrl, '회사 직인');
  return renderedHtml.replace(
    /<span[^>]*data-contract-placeholder=["']회사직인["'][^>]*>.*?<\/span>/g,
    seal,
  );
}

export function contractDocumentCss() {
  return `
    .contract-document {
      width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 56px 64px;
      background: #fff;
      color: #111827;
      font-size: 14px;
      line-height: 1.75;
      font-family: AppleSDGothicNeo, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-sizing: border-box;
    }
    .contract-document h1 { font-size: 24px; margin: 0 0 28px; line-height: 1.35; }
    .contract-document h2 { font-size: 20px; margin: 22px 0 10px; line-height: 1.4; }
    .contract-document h3 { font-size: 16px; margin: 18px 0 8px; line-height: 1.45; }
    .contract-document p { margin: 7px 0; }
    .contract-document table { width: 100%; border-collapse: collapse; margin: 14px 0; }
    .contract-document th, .contract-document td { border: 1px solid #d1d5db; padding: 8px 10px; vertical-align: top; }
    .contract-document th { background: #f3f4f6; font-weight: 700; text-align: center; }
    .contract-document ul, .contract-document ol { padding-left: 22px; }
    .contract-document hr { border: 0; border-top: 1px solid #d1d5db; margin: 18px 0; }
  `;
}
