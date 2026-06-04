import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

const supabaseAny = supabase as any;

export type ApprovalRequestType = 'project_start' | 'purchase_request' | 'expense_payment';
export type ApprovalRequestStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalRequestPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface ApprovalRequestRecord {
  id: string;
  request_type: ApprovalRequestType;
  status: ApprovalRequestStatus;
  title: string;
  summary: string | null;
  amount: number | null;
  priority: ApprovalRequestPriority;
  related_quote_id: string | null;
  related_project_id: string | null;
  related_material_order_id: string | null;
  related_internal_document_id: string | null;
  payload_snapshot: Json;
  requested_by: string;
  requested_by_name: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalRequestEventRecord {
  id: string;
  approval_request_id: string;
  event_type: string;
  actor_id: string | null;
  actor_name: string | null;
  note: string | null;
  metadata: Json;
  created_at: string;
}

export interface CreateApprovalRequestInput {
  requestType: ApprovalRequestType;
  status?: Extract<ApprovalRequestStatus, 'draft' | 'pending'>;
  title?: string;
  summary?: string;
  amount?: number | null;
  priority?: ApprovalRequestPriority;
  relatedQuoteId?: string | null;
  relatedProjectId?: string | null;
  relatedMaterialOrderId?: string | null;
  relatedInternalDocumentId?: string | null;
  payloadSnapshot?: Json;
}

export function getApprovalStatusLabel(status: ApprovalRequestStatus) {
  switch (status) {
    case 'draft': return '초안';
    case 'pending': return '승인 대기';
    case 'approved': return '승인';
    case 'rejected': return '반려';
    case 'cancelled': return '취소';
    default: return status;
  }
}

export function getApprovalTypeLabel(type: ApprovalRequestType) {
  switch (type) {
    case 'project_start': return '프로젝트 개시';
    case 'purchase_request': return '구매 품의';
    case 'expense_payment': return '지출 품의';
    default: return type;
  }
}

export function getApprovalStatusClass(status: ApprovalRequestStatus) {
  switch (status) {
    case 'pending': return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'approved': return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'rejected': return 'border-red-200 bg-red-50 text-red-700';
    case 'cancelled': return 'border-gray-200 bg-gray-50 text-gray-600';
    default: return 'border-blue-200 bg-blue-50 text-blue-700';
  }
}

export async function createApprovalRequest(input: CreateApprovalRequestInput) {
  const payload = {
    request_type: input.requestType,
    status: input.status || 'pending',
    title: input.title,
    summary: input.summary,
    amount: input.amount,
    priority: input.priority || 'normal',
    related_quote_id: input.relatedQuoteId,
    related_project_id: input.relatedProjectId,
    related_material_order_id: input.relatedMaterialOrderId,
    related_internal_document_id: input.relatedInternalDocumentId,
    payload_snapshot: input.payloadSnapshot || {},
  };

  const { data, error } = await supabaseAny.rpc('create_approval_request', {
    _payload: payload,
  });
  if (error) throw error;
  return data as string;
}

export async function reviewApprovalRequest(id: string, decision: 'approved' | 'rejected', reviewNote?: string) {
  const { data, error } = await supabaseAny.rpc('review_approval_request', {
    _request_id: id,
    _decision: decision,
    _review_note: reviewNote || null,
  });
  if (error) throw error;
  return data as string;
}

export async function cancelApprovalRequest(id: string, note?: string) {
  const { data, error } = await supabaseAny.rpc('cancel_approval_request', {
    _request_id: id,
    _note: note || null,
  });
  if (error) throw error;
  return data as string;
}

export async function listProjectApprovalRequests(projectId: string) {
  const { data, error } = await supabaseAny
    .from('approval_requests')
    .select('*')
    .eq('related_project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ApprovalRequestRecord[];
}

export async function listPendingApprovalRequests(limit = 10) {
  const { data, error } = await supabaseAny
    .from('approval_requests')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as ApprovalRequestRecord[];
}

export async function listApprovalRequestEvents(requestId: string) {
  const { data, error } = await supabaseAny
    .from('approval_request_events')
    .select('*')
    .eq('approval_request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ApprovalRequestEventRecord[];
}
