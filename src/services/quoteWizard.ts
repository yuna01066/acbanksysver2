import { supabase } from '@/integrations/supabase/client';
import type {
  QuoteWizardDraftConversion,
  QuoteWizardFileKind,
  QuoteWizardFileRecord,
  QuoteWizardJobRecord,
  QuoteWizardPayload,
  QuoteWizardResultSnapshot,
} from '@/types/quoteWizard';
import { secureRandomToken } from '@/utils/secureRandom';

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
      ? '견적 마법사 함수에 연결하지 못했습니다. Lovable Cloud에 quote-wizard 함수를 배포하거나 로컬 functions 서버를 연결해야 합니다.'
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
  const id = `${Date.now()}-${secureRandomToken(8)}`;
  return `${job.user_id}/${job.id}/${id}-${safeFileName(file.name)}`;
};

const createLocalId = () => (
  `${Date.now()}-${secureRandomToken(8)}`
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
  const risks = [
    '로컬 개발 fallback 상태입니다. Lovable Cloud quote-wizard 함수 또는 분석 워커가 연결되지 않아 파일 내용 기반 분석을 수행하지 않았습니다.',
    sourceOnly
      ? '원본 파일만으로는 자동 분석이 제한됩니다. PDF/DXF 또는 이미지 미리보기가 필요합니다.'
      : '첨부 파일은 접수했지만 로컬 fallback에서는 PDF/CAD 내용을 파싱하지 않습니다.',
  ];

  return {
    analysis: {
      item_name: null,
      dimensions: null,
      quantity: null,
      material: null,
      thickness: null,
      color: null,
      finish: null,
      processing: [],
      observed: { files: files.map((file) => `${file.file_name}(${file.kind})`) },
      inferred: {
        engine_status: 'unavailable',
        extraction_mode: 'frontend_dev_fallback',
        worker_status: 'not_connected',
        note: '로컬 fallback은 UI 확인용이며 샘플 치수/수량/금액을 생성하지 않습니다.',
      },
      parts: [],
      missing_fields: ['분석 엔진 연결', '제작 품목', '파트별 치수', '수량', '소재/두께', '원장 규격'],
      production_risks: risks,
      recommended_reply: '첨부파일은 접수했지만 현재 분석 엔진이 연결되지 않아 도면 내용 기반 추출을 진행하지 못했습니다. Lovable Cloud quote-wizard 함수 배포 또는 로컬 워커 연결 후 다시 분석해주세요.',
      confidence: 'low',
    },
    yield: {
      status: 'insufficient_data',
      candidate_basis: null,
      stock_sheet: {
        name: null,
        width_mm: null,
        height_mm: null,
        basis: null,
      },
      total_part_area_mm2: null,
      estimated_sheet_count: null,
      yield_percent: null,
      scrap_percent: null,
      notes: ['원장/수율 계산에 필요한 파트 치수와 수량이 부족합니다.'],
    },
    formula: {
      status: 'blocked',
      subtotal: 0,
      tax: 0,
      total: 0,
      version: 'pricing-engine-v2-core-260520',
      line_items: [],
      warnings: risks,
      blocked_reasons: ['분석 엔진이 연결되지 않아 견적 산출을 보류했습니다.'],
    },
  };
};

const isLegacySamplePart = (part: unknown) => {
  if (!part || typeof part !== 'object') return false;
  const candidate = part as Partial<QuoteWizardResultSnapshot['analysis']['parts'][number]>;
  const name = String(candidate.name || '');
  const width = Number(candidate.width_mm) || 0;
  const height = Number(candidate.height_mm) || 0;
  const quantity = Number(candidate.quantity) || 0;

  return (
    (name.includes('상/하판') && width === 600 && height === 380 && quantity === 24) ||
    (name.includes('전/후면판') && width === 600 && height === 240 && quantity === 24) ||
    (name.includes('좌/우') && width === 380 && height === 240 && quantity === 24)
  );
};

const isLegacyFallbackResult = (result: QuoteWizardResultSnapshot | null | undefined) => {
  if (!result) return false;
  const inferred = result.analysis?.inferred || {};
  const mode = typeof inferred.extraction_mode === 'string' ? inferred.extraction_mode : null;
  const note = typeof inferred.note === 'string' ? inferred.note : '';
  const parts = Array.isArray(result.analysis?.parts) ? result.analysis.parts : [];

  return (
    mode === 'fallback_sample' ||
    note.includes('샘플 구조') ||
    parts.some(isLegacySamplePart)
  );
};

const buildLegacyFallbackResult = (payload: QuoteWizardPayload): QuoteWizardResultSnapshot => {
  const risks = [
    '이전 버전 함수가 생성한 샘플 분석 결과가 감지되어 화면에서 제거했습니다.',
    '첨부 파일 기준으로 새 분석을 다시 실행해야 합니다.',
    '상담원 검수 전에는 임시 금액을 만들지 않습니다.',
  ];

  return {
    analysis: {
      item_name: null,
      dimensions: null,
      quantity: null,
      material: null,
      thickness: null,
      color: null,
      finish: null,
      processing: [],
      observed: {
        files: payload.files.map((file) => `${file.file_name}(${file.kind})`),
        legacy_result_hidden: true,
      },
      inferred: {
        engine_status: 'unavailable',
        extraction_mode: 'legacy_fallback_hidden',
        worker_status: 'not_connected',
        note: '이전 샘플 결과를 숨겼습니다. 파일을 다시 업로드해 새 분석을 실행해주세요.',
      },
      parts: [],
      missing_fields: ['새 분석 실행', '제작 품목', '파트별 치수', '수량', '소재/두께', '원장 규격'],
      production_risks: risks,
      recommended_reply: '이전 샘플 분석 결과가 감지되어 자동 표시를 중단했습니다. 파일을 다시 업로드해 견적 마법사를 새로 실행해주세요.',
      confidence: 'low',
    },
    yield: {
      status: 'insufficient_data',
      candidate_basis: null,
      stock_sheet: {
        name: null,
        width_mm: null,
        height_mm: null,
        basis: null,
      },
      total_part_area_mm2: null,
      estimated_sheet_count: null,
      yield_percent: null,
      scrap_percent: null,
      notes: ['이전 샘플 결과는 수율 참고값으로 사용하지 않습니다.'],
    },
    formula: {
      status: 'blocked',
      subtotal: 0,
      tax: 0,
      total: 0,
      version: 'pricing-engine-v2-core-260520',
      line_items: [],
      warnings: risks,
      blocked_reasons: ['이전 샘플 결과가 감지되어 견적 산출을 보류했습니다.'],
    },
  };
};

const sanitizeQuoteWizardPayload = (payload: QuoteWizardPayload): QuoteWizardPayload => {
  if (!isLegacyFallbackResult(payload.result)) return payload;

  return {
    ...payload,
    job: {
      ...payload.job,
      review_status: 'blocked',
    },
    result: buildLegacyFallbackResult(payload),
  };
};

export async function createQuoteWizardJob(customerNote: string): Promise<QuoteWizardPayload> {
  try {
    return sanitizeQuoteWizardPayload(await invokeQuoteWizard<QuoteWizardPayload>({
      action: 'createJob',
      customerNote,
    }));
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

  return sanitizeQuoteWizardPayload(await invokeQuoteWizard<QuoteWizardPayload>({
    action: 'analyzeJob',
    jobId,
  }));
}

export async function getQuoteWizardJob(jobId: string): Promise<QuoteWizardPayload> {
  if (isLocalJob(jobId)) {
    const payload = localPayloads.get(jobId);
    if (!payload) throw new Error('로컬 견적 마법사 작업을 찾을 수 없습니다.');
    return payload;
  }

  return sanitizeQuoteWizardPayload(await invokeQuoteWizard<QuoteWizardPayload>({
    action: 'getJob',
    jobId,
  }));
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
