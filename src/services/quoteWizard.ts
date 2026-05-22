import { supabase } from '@/integrations/supabase/client';
import type {
  QuoteWizardDraftConversion,
  QuoteWizardFileKind,
  QuoteWizardFileRecord,
  QuoteWizardJobRecord,
  QuoteWizardPayload,
  QuoteWizardResultSnapshot,
} from '@/types/quoteWizard';

const QUOTE_WIZARD_FUNCTION = 'quote-wizard';
export const QUOTE_WIZARD_BUCKET = 'quote-wizard-temp';

type FunctionResponse<T> = {
  success?: boolean;
  error?: string;
} & T;

const LOCAL_JOB_PREFIX = 'local-quote-wizard';
const localPayloads = new Map<string, QuoteWizardPayload>();

const isDevFallbackEnabled = () => (
  import.meta.env.DEV && import.meta.env.VITE_QUOTE_WIZARD_DEV_FALLBACK !== 'false'
);

const isLocalJob = (jobId: string) => jobId.startsWith(LOCAL_JOB_PREFIX);

const quoteWizardConnectionError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    message.includes('Failed to send a request')
      ? '견적 마법사 Edge Function에 연결하지 못했습니다. Supabase에 quote-wizard 함수를 배포하거나 로컬 functions 서버를 연결해야 합니다.'
      : message
  );
};

const invokeQuoteWizard = async <T>(body: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.functions.invoke<FunctionResponse<T>>(QUOTE_WIZARD_FUNCTION, {
    body,
  });

  if (error) throw quoteWizardConnectionError(error);
  if (data?.error) throw new Error(data.error);
  return data as T;
};

export const classifyQuoteWizardFile = (file: Pick<File, 'name' | 'type'>): QuoteWizardFileKind => {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/')) return 'image';
  if (name.endsWith('.dxf')) return 'dxf';
  if (name.endsWith('.dwg')) return 'dwg';
  if (/\.(ai|eps|skp|3dm|step|stp|iges|igs|obj)$/i.test(name)) return 'source';
  return 'unknown';
};

const safeFileName = (name: string) => (
  name
    .normalize('NFKD')
    .replace(/[^\w.\-가-힣]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 140) || 'quote-wizard-file'
);

const createStoragePath = (job: QuoteWizardJobRecord, file: File) => {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return `${job.user_id}/${job.id}/${id}-${safeFileName(file.name)}`;
};

const createLocalId = () => (
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
);

const createLocalPayload = (customerNote: string): QuoteWizardPayload => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const job: QuoteWizardJobRecord = {
    id: `${LOCAL_JOB_PREFIX}-${createLocalId()}`,
    user_id: 'local-dev-user',
    status: 'draft',
    source: 'internal_app',
    review_status: 'needs_review',
    customer_note: customerNote || null,
    result_id: null,
    converted_draft_id: null,
    error_message: null,
    expires_at: expiresAt,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
  const payload = { job, files: [], result: null };
  localPayloads.set(job.id, payload);
  return payload;
};

const buildLocalResult = (files: QuoteWizardFileRecord[]): QuoteWizardResultSnapshot => {
  const hasFastPreview = files.some((file) => ['pdf', 'image', 'dxf'].includes(file.kind));
  const sourceOnly = !hasFastPreview;
  const parts = sourceOnly ? [] : [
    { id: 'local-top-bottom', name: '상/하판', shape: 'rect' as const, width_mm: 600, height_mm: 380, quantity: 24, material: '아크릴', thickness: '5T', basis: '로컬 개발 fallback 샘플', confidence: 'medium' as const, risk_notes: ['회전 가능 여부 확인'] },
    { id: 'local-front-back', name: '전/후면판', shape: 'rect' as const, width_mm: 600, height_mm: 240, quantity: 24, material: '아크릴', thickness: '5T', basis: '로컬 개발 fallback 샘플', confidence: 'medium' as const, risk_notes: ['접착 여유 확인'] },
    { id: 'local-side', name: '좌/우 측판', shape: 'rect' as const, width_mm: 380, height_mm: 240, quantity: 24, material: '아크릴', thickness: '5T', basis: '로컬 개발 fallback 샘플', confidence: 'medium' as const, risk_notes: ['두께 차감 검수'] },
  ];
  const totalPartArea = parts.reduce((sum, part) => sum + (part.width_mm || 0) * (part.height_mm || 0) * (part.quantity || 0), 0);
  const sheetArea = 1220 * 2440;
  const estimatedSheetCount = totalPartArea ? Math.max(1, Math.ceil(totalPartArea / (sheetArea * 0.82))) : null;
  const yieldPercent = totalPartArea && estimatedSheetCount ? Math.round((totalPartArea / (sheetArea * estimatedSheetCount)) * 1000) / 10 : null;
  const subtotal = sourceOnly ? 0 : 1_348_200;
  const tax = Math.round(subtotal * 0.1);

  return {
    analysis: {
      item_name: sourceOnly ? null : '투명 아크릴 박스형 진열 커버',
      dimensions: sourceOnly ? null : '600 x 380 x 240mm',
      quantity: sourceOnly ? null : 12,
      material: sourceOnly ? null : '아크릴',
      thickness: sourceOnly ? null : '5T',
      color: sourceOnly ? null : '투명',
      finish: sourceOnly ? null : '불광/광택',
      processing: sourceOnly ? [] : ['재단', '타공', '인쇄', '접착', '조립'],
      observed: { files: files.map((file) => `${file.file_name}(${file.kind})`) },
      inferred: { worker_mode: 'frontend_dev_fallback' },
      parts,
      missing_fields: sourceOnly
        ? ['PDF/JPG/PNG 미리보기', '제작 품목', '사이즈', '수량', '희망 납기']
        : ['원장 규격', '회전 가능 여부', '커프/재단 여유', '로고 원본'],
      production_risks: [
        sourceOnly ? '원본 파일만으로는 빠른 견적 분석이 제한됩니다.' : '도면 스케일 확인 필요',
        '현재 결과는 로컬 개발 fallback입니다. 운영 반영 전 Edge Function 배포가 필요합니다.',
      ],
      recommended_reply: sourceOnly
        ? '빠른 견적 확인을 위해 PDF, JPG 또는 PNG 미리보기 파일과 제작 품목, 사이즈, 수량, 희망 납기를 함께 알려주세요.'
        : '첨부파일 기준으로 임시 분석했습니다. 원장 규격, 로고 원본, 회전 가능 여부를 확인하면 견적 정확도를 높일 수 있습니다.',
      confidence: sourceOnly ? 'low' : 'medium',
    },
    yield: {
      status: sourceOnly ? 'insufficient_data' : 'estimated',
      candidate_basis: sourceOnly ? null : 'frontend_dev_fallback',
      stock_sheet: {
        name: sourceOnly ? null : '4*8 후보',
        width_mm: sourceOnly ? null : 1220,
        height_mm: sourceOnly ? null : 2440,
        basis: sourceOnly ? null : 'fallback_candidate',
      },
      total_part_area_mm2: totalPartArea || null,
      estimated_sheet_count: estimatedSheetCount,
      yield_percent: yieldPercent,
      scrap_percent: yieldPercent === null ? null : Math.round((100 - yieldPercent) * 10) / 10,
      notes: sourceOnly
        ? ['원장/수율 계산에 필요한 치수와 수량이 부족합니다.']
        : ['로컬 개발 fallback 참고값입니다.', '운영에서는 quote-wizard Edge Function과 worker 결과를 사용합니다.'],
    },
    formula: {
      status: sourceOnly ? 'blocked' : 'needs_review',
      subtotal,
      tax,
      total: subtotal + tax,
      version: 'pricing-engine-v2-core-260520',
      line_items: sourceOnly ? [] : [
        { label: '원장/재단 기준', amount: 624_000, source: 'dev_fallback', reason: '아크릴 5T 후보 원장' },
        { label: '타공/가공', amount: 312_000, source: 'dev_fallback', reason: '상단 타공 및 재단 공임' },
        { label: '인쇄/조립', amount: 412_200, source: 'dev_fallback', reason: 'UV 인쇄 및 접착 조립' },
      ],
      warnings: sourceOnly ? ['PDF/JPG/PNG 미리보기 없이 자동 견적 산출 불가'] : ['상담원 검수 전 확정 금액으로 사용하지 않습니다.'],
      blocked_reasons: sourceOnly ? ['PDF/JPG/PNG 미리보기 없이 자동 견적 산출 불가'] : [],
    },
  };
};

export async function createQuoteWizardJob(customerNote: string): Promise<QuoteWizardPayload> {
  try {
    return await invokeQuoteWizard<QuoteWizardPayload>({
      action: 'createJob',
      customerNote,
    });
  } catch (error) {
    if (isDevFallbackEnabled()) return createLocalPayload(customerNote);
    throw error;
  }
}

export async function uploadQuoteWizardFiles(job: QuoteWizardJobRecord, files: File[]): Promise<QuoteWizardFileRecord[]> {
  if (isLocalJob(job.id)) {
    const payload = localPayloads.get(job.id);
    if (!payload) throw new Error('로컬 견적 마법사 작업을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const localFiles = files.map((file) => ({
      id: createLocalId(),
      job_id: job.id,
      file_name: file.name,
      file_path: `local-dev/${job.id}/${safeFileName(file.name)}`,
      mime_type: file.type || null,
      file_size: file.size,
      kind: classifyQuoteWizardFile(file),
      expires_at: job.expires_at,
    }));
    localPayloads.set(job.id, {
      ...payload,
      job: { ...payload.job, status: 'uploaded', updated_at: now },
      files: localFiles,
    });
    return localFiles;
  }

  const payload: Array<{
    file_name: string;
    file_path: string;
    mime_type: string | null;
    file_size: number;
    kind: QuoteWizardFileKind;
  }> = [];

  for (const file of files) {
    const filePath = createStoragePath(job, file);
    const { error } = await supabase.storage
      .from(QUOTE_WIZARD_BUCKET)
      .upload(filePath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (error) throw error;

    payload.push({
      file_name: file.name,
      file_path: filePath,
      mime_type: file.type || null,
      file_size: file.size,
      kind: classifyQuoteWizardFile(file),
    });
  }

  const result = await invokeQuoteWizard<{ files: QuoteWizardFileRecord[] }>({
    action: 'registerFiles',
    jobId: job.id,
    files: payload,
  });

  return result.files;
}

export async function analyzeQuoteWizardJob(jobId: string): Promise<QuoteWizardPayload> {
  if (isLocalJob(jobId)) {
    const payload = localPayloads.get(jobId);
    if (!payload) throw new Error('로컬 견적 마법사 작업을 찾을 수 없습니다.');
    const now = new Date().toISOString();
    const result = buildLocalResult(payload.files);
    const analyzed: QuoteWizardPayload = {
      ...payload,
      job: {
        ...payload.job,
        status: 'completed',
        review_status: result.formula.status,
        result_id: `${jobId}-result`,
        updated_at: now,
      },
      result,
    };
    localPayloads.set(jobId, analyzed);
    return analyzed;
  }

  return invokeQuoteWizard<QuoteWizardPayload>({
    action: 'analyzeJob',
    jobId,
  });
}

export async function getQuoteWizardJob(jobId: string): Promise<QuoteWizardPayload> {
  if (isLocalJob(jobId)) {
    const payload = localPayloads.get(jobId);
    if (!payload) throw new Error('로컬 견적 마법사 작업을 찾을 수 없습니다.');
    return payload;
  }

  return invokeQuoteWizard<QuoteWizardPayload>({
    action: 'getJob',
    jobId,
  });
}

export async function convertQuoteWizardToDraft(jobId: string): Promise<QuoteWizardDraftConversion> {
  if (isLocalJob(jobId)) {
    throw new Error('로컬 미리보기 결과는 견적 초안으로 전환할 수 없습니다. Supabase Edge Function과 마이그레이션을 배포한 뒤 다시 시도해주세요.');
  }

  return invokeQuoteWizard<QuoteWizardDraftConversion>({
    action: 'convertDraft',
    jobId,
  });
}

export async function cleanupExpiredQuoteWizardJobs(): Promise<{ deletedRows: number; removedFiles: number }> {
  return invokeQuoteWizard<{ deletedRows: number; removedFiles: number }>({
    action: 'cleanupExpired',
  });
}
