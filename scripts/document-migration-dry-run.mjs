#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, 'reports');

function parseDotEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

async function loadEnv() {
  let fileEnv = {};
  let localEnv = {};
  try {
    fileEnv = parseDotEnv(await readFile(path.join(rootDir, '.env'), 'utf8'));
  } catch {
    // .env is optional. Shell environment can provide the same values.
  }
  try {
    localEnv = parseDotEnv(await readFile(path.join(rootDir, '.env.local'), 'utf8'));
  } catch {
    // .env.local is intentionally gitignored and is the safest place for service keys.
  }
  return { ...fileEnv, ...localEnv, ...process.env };
}

function cleanSegment(value, fallback = '미지정') {
  const cleaned = String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/_+/g, '_')
    .slice(0, 80);
  return cleaned || fallback;
}

function yearMonth(dateLike) {
  const date = dateLike ? new Date(dateLike) : new Date();
  if (Number.isNaN(date.getTime())) return yearMonth();
  return {
    year: String(date.getFullYear()),
    month: String(date.getMonth() + 1).padStart(2, '0'),
  };
}

function quoteFolderName(quote) {
  return [
    cleanSegment(quote.quote_number, '견적번호미정'),
    cleanSegment(quote.recipient_company, '거래처미정'),
    cleanSegment(quote.project_name, '프로젝트미정'),
  ].join('_');
}

function quoteDriveBasePath(quote) {
  const { year, month } = yearMonth(quote.quote_date || quote.created_at);
  return ['ACBANK_SYS', '01_발행견적서', year, month, quoteFolderName(quote)];
}

function projectDriveBasePath(project) {
  return ['ACBANK_SYS', '02_프로젝트', cleanSegment(project?.name, '프로젝트미정')];
}

function toCsvCell(value) {
  const text = value == null ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

class SupabaseRest {
  constructor({ url, key }) {
    this.url = url.replace(/\/$/, '');
    this.key = key;
  }

  async select(table, select, extraQuery = '') {
    const query = new URLSearchParams({ select }).toString();
    const suffix = extraQuery ? `&${extraQuery}` : '';
    const res = await fetch(`${this.url}/rest/v1/${table}?${query}${suffix}`, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
      },
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`${table} 조회 실패: ${res.status} ${detail}`);
    }
    return res.json();
  }

  async count(table) {
    const res = await fetch(`${this.url}/rest/v1/${table}?select=id&limit=1`, {
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        Prefer: 'count=exact',
      },
    });

    if (!res.ok) return null;
    const range = res.headers.get('content-range') || '';
    const total = range.split('/')[1];
    return total && total !== '*' ? Number(total) : null;
  }
}

function buildQuoteAttachmentRows(quotes) {
  const rows = [];
  for (const quote of quotes) {
    for (const attachment of asArray(quote.attachments)) {
      if (!attachment || typeof attachment !== 'object' || !attachment.path) continue;
      const isPdf = attachment.type === 'quote_pdf';
      const targetSection = isPdf ? '00_견적서PDF' : '01_고객첨부';
      rows.push({
        source: 'saved_quotes.attachments',
        ownerType: 'quote',
        quoteId: quote.id,
        quoteNumber: quote.quote_number,
        projectId: quote.project_id || '',
        projectName: quote.project_name || '',
        recipientCompany: quote.recipient_company || '',
        documentType: isPdf ? 'quote_pdf' : 'customer_attachment',
        fileName: attachment.name || attachment.fileName || '첨부파일',
        currentProvider: 'supabase_storage',
        currentBucket: isPdf ? 'quote-pdfs' : 'quote-attachments',
        currentPath: attachment.path,
        targetDrivePath: [...quoteDriveBasePath(quote), targetSection].join('/'),
        fileSize: attachment.size || '',
        mimeType: isPdf ? 'application/pdf' : attachment.type || '',
        action: 'copy_to_drive_then_index',
      });
    }
  }
  return rows;
}

function buildInternalDocumentRows(docs, projectById) {
  return docs
    .filter(doc => doc.file_url)
    .map(doc => {
      const project = projectById.get(doc.project_id);
      const typeFolder = doc.document_type === 'quote' ? '매입견적서' : '영수증';
      const date = yearMonth(doc.created_at);
      return {
        source: 'internal_project_documents',
        ownerType: 'project',
        quoteId: '',
        quoteNumber: '',
        projectId: doc.project_id || '',
        projectName: project?.name || '',
        recipientCompany: '',
        documentType: doc.document_type === 'quote' ? 'purchase_quote' : doc.document_type,
        fileName: doc.file_name || '문서',
        currentProvider: String(doc.file_url).startsWith('http') ? 'external_url' : 'gcs',
        currentBucket: String(doc.file_url).startsWith('http') ? '' : 'acbank_sys2',
        currentPath: doc.file_url,
        targetDrivePath: [...projectDriveBasePath(project), '02_발주_매입', typeFolder, `${date.year}년`, `${date.month}월`].join('/'),
        fileSize: doc.file_size || '',
        mimeType: doc.mime_type || '',
        action: 'copy_to_drive_then_index',
      };
    });
}

async function main() {
  const env = await loadEnv();
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || `https://${env.SUPABASE_PROJECT_ID || env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
  const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const usingServiceRole = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);

  if (!url || url.includes('undefined') || !key) {
    throw new Error('SUPABASE_URL/VITE_SUPABASE_URL 및 SUPABASE_SERVICE_ROLE_KEY 또는 VITE_SUPABASE_PUBLISHABLE_KEY가 필요합니다.');
  }

  const supabase = new SupabaseRest({ url, key });
  const access = {
    usingServiceRole,
    countsVisibleToCurrentKey: {
      saved_quotes: await supabase.count('saved_quotes'),
      internal_project_documents: await supabase.count('internal_project_documents'),
      projects: await supabase.count('projects'),
    },
  };

  const [quotes, internalDocs, projects] = await Promise.all([
    supabase.select('saved_quotes', 'id,quote_number,quote_date,created_at,recipient_company,project_name,project_id,attachments,user_id', 'order=quote_date.desc&limit=5000'),
    supabase.select('internal_project_documents', 'id,project_id,document_type,file_name,file_url,file_size,mime_type,uploaded_by,created_at', 'order=created_at.desc&limit=5000'),
    supabase.select('projects', 'id,name,created_at', 'limit=5000'),
  ]);

  const projectById = new Map(projects.map(project => [project.id, project]));
  const rows = [
    ...buildQuoteAttachmentRows(quotes),
    ...buildInternalDocumentRows(internalDocs, projectById),
  ];

  const summary = rows.reduce((acc, row) => {
    acc.total += 1;
    acc.bySource[row.source] = (acc.bySource[row.source] || 0) + 1;
    acc.byProvider[row.currentProvider] = (acc.byProvider[row.currentProvider] || 0) + 1;
    acc.byDocumentType[row.documentType] = (acc.byDocumentType[row.documentType] || 0) + 1;
    return acc;
  }, { total: 0, bySource: {}, byProvider: {}, byDocumentType: {} });
  const warnings = [];
  if (!usingServiceRole) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY가 없어 익명키로 조회했습니다. RLS 때문에 실제 데이터보다 적게 보일 수 있습니다.');
  }
  if (summary.total === 0) {
    warnings.push('정리 대상 파일이 0건입니다. 실제 파일이 있다면 서비스키로 재실행하거나 마이그레이션 적용 상태를 확인하세요.');
  }

  await mkdir(reportDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(reportDir, `document-migration-dry-run-${stamp}.json`);
  const csvPath = path.join(reportDir, `document-migration-dry-run-${stamp}.csv`);

  const columns = [
    'source',
    'ownerType',
    'quoteNumber',
    'projectName',
    'recipientCompany',
    'documentType',
    'fileName',
    'currentProvider',
    'currentBucket',
    'currentPath',
    'targetDrivePath',
    'fileSize',
    'mimeType',
    'action',
  ];
  const csv = [
    columns.map(toCsvCell).join(','),
    ...rows.map(row => columns.map(column => toCsvCell(row[column])).join(',')),
  ].join('\n');

  await writeFile(jsonPath, JSON.stringify({ generatedAt: new Date().toISOString(), summary, access, warnings, rows }, null, 2));
  await writeFile(csvPath, csv);

  console.log(JSON.stringify({ summary, access, warnings, jsonPath, csvPath }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
