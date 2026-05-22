export type QuoteWizardJobStatus = 'draft' | 'uploaded' | 'queued' | 'analyzing' | 'completed' | 'failed' | 'expired';

export type QuoteWizardReviewStatus = 'calculable' | 'needs_review' | 'blocked' | 'converted';

export type QuoteWizardFileKind = 'pdf' | 'image' | 'dxf' | 'dwg' | 'source' | 'unknown';

export interface QuoteWizardFileRecord {
  id: string;
  job_id: string;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  file_size: number | null;
  kind: QuoteWizardFileKind;
  expires_at: string;
}

export interface QuoteWizardPart {
  id: string;
  name: string;
  shape: 'rect' | 'trapezoid' | 'irregular' | 'unknown';
  width_mm: number | null;
  height_mm: number | null;
  quantity: number | null;
  material: string | null;
  thickness: string | null;
  basis: string;
  confidence: 'low' | 'medium' | 'high';
  risk_notes: string[];
}

export interface QuoteWizardAnalysisSnapshot {
  item_name: string | null;
  dimensions: string | null;
  quantity: number | null;
  material: string | null;
  thickness: string | null;
  color: string | null;
  finish: string | null;
  processing: string[];
  observed: Record<string, unknown>;
  inferred: Record<string, unknown>;
  parts: QuoteWizardPart[];
  missing_fields: string[];
  production_risks: string[];
  recommended_reply: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface QuoteWizardYieldSnapshot {
  status: 'not_applicable' | 'insufficient_data' | 'estimated' | 'calculated';
  candidate_basis: string | null;
  stock_sheet: {
    name: string | null;
    width_mm: number | null;
    height_mm: number | null;
    basis: string | null;
  };
  total_part_area_mm2: number | null;
  estimated_sheet_count: number | null;
  yield_percent: number | null;
  scrap_percent: number | null;
  notes: string[];
}

export interface QuoteWizardFormulaSnapshot {
  status: QuoteWizardReviewStatus;
  subtotal: number;
  tax: number;
  total: number;
  version: string;
  line_items: Array<{
    label: string;
    amount: number;
    source: string;
    reason?: string;
  }>;
  warnings: string[];
  blocked_reasons: string[];
}

export interface QuoteWizardResultSnapshot {
  analysis: QuoteWizardAnalysisSnapshot;
  yield: QuoteWizardYieldSnapshot;
  formula: QuoteWizardFormulaSnapshot;
}

export interface QuoteWizardJobRecord {
  id: string;
  user_id: string;
  status: QuoteWizardJobStatus;
  source: 'internal_app' | 'widget' | 'worker';
  review_status: QuoteWizardReviewStatus;
  customer_note: string | null;
  result_id: string | null;
  converted_draft_id: string | null;
  error_message: string | null;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface QuoteWizardPayload {
  job: QuoteWizardJobRecord;
  files: QuoteWizardFileRecord[];
  result: QuoteWizardResultSnapshot | null;
}

export interface QuoteWizardDraftConversion {
  draftId: string;
  job: QuoteWizardJobRecord;
}
