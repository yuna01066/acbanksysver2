import { supabase } from '@/integrations/supabase/client';
import { formatQuoteProjectTitle } from '@/utils/quoteNaming';
import { logQuoteActivity } from '@/services/quoteActivity';
import { projectStageToLegacyQuoteStatus } from '@/utils/quoteWorkflow';
import { createApprovalRequest } from '@/services/approvalRequests';

export interface QuoteForProjectConversion {
  id: string;
  quote_number: string;
  project_name: string | null;
  recipient_name: string | null;
  recipient_company: string | null;
  recipient_phone: string | null;
  recipient_email: string | null;
  recipient_address?: string | null;
  recipient_memo?: string | null;
  recipient_id?: string | null;
  desired_delivery_date?: string | null;
  total: number;
  items: unknown;
  user_id: string;
  project_id?: string | null;
  quote_status?: string | null;
  project_stage?: string | null;
}

export interface ConvertedProject {
  id: string;
  name: string;
  status: string;
  payment_status: string | null;
  approvalRequestId?: string | null;
  approvalRequestError?: string | null;
}

interface ConvertQuoteToProjectParams {
  quote: QuoteForProjectConversion;
  actorId: string;
  actorName: string;
}

const buildProjectDescription = (quote: QuoteForProjectConversion) => {
  const lines = [
    `견적서 ${quote.quote_number}에서 생성된 프로젝트입니다.`,
    quote.recipient_company ? `거래처: ${quote.recipient_company}` : null,
    quote.recipient_name ? `담당자: ${quote.recipient_name}` : null,
    quote.desired_delivery_date ? `납기 희망일: ${new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR')}` : null,
  ].filter(Boolean);

  return lines.join('\n');
};

const mapQuoteItemsForProject = (items: unknown) => (
  Array.isArray(items)
    ? items.map((item: any) => ({
        id: item?.id,
        name: item?.name || item?.projectName || item?.description || '견적 항목',
        quantity: item?.quantity || 1,
        totalPrice: item?.totalPrice || item?.total || 0,
        material: item?.material,
        size: item?.size || item?.sizeName,
      }))
    : []
);

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message || '알 수 없는 오류');
  }
  return String(error || '알 수 없는 오류');
};

export async function convertQuoteToProject({
  quote,
  actorId,
  actorName,
}: ConvertQuoteToProjectParams): Promise<ConvertedProject> {
  if (quote.project_id) {
    throw new Error('이미 프로젝트에 연결된 견적입니다.');
  }

  let recipientId: string | null = quote.recipient_id || null;
  if (!recipientId && quote.recipient_company?.trim()) {
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('id')
      .eq('user_id', quote.user_id || actorId)
      .eq('company_name', quote.recipient_company.trim())
      .eq('contact_person', quote.recipient_name?.trim() || quote.recipient_company.trim())
      .maybeSingle();

    if (recipientError) throw recipientError;
    recipientId = recipient?.id || null;
  }

  const projectName = formatQuoteProjectTitle({
    projectName: quote.project_name?.trim() || `견적 ${quote.quote_number}`,
    companyName: quote.recipient_company,
  });

  const quoteItemSnapshot = mapQuoteItemsForProject(quote.items);
  const quoteSnapshot = {
    sourceQuoteId: quote.id,
    sourceQuoteNumber: quote.quote_number,
    quoteTotal: quote.total,
    desiredDeliveryDate: quote.desired_delivery_date || null,
    recipientCompany: quote.recipient_company || null,
    recipientName: quote.recipient_name || null,
    recipientPhone: quote.recipient_phone || null,
    recipientEmail: quote.recipient_email || null,
    recipientAddress: quote.recipient_address || null,
    recipientMemo: quote.recipient_memo || null,
    items: quoteItemSnapshot,
  };

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .insert({
      name: projectName,
      description: buildProjectDescription(quote),
      status: 'active',
      project_type: 'client',
      recipient_id: recipientId,
      contact_name: quote.recipient_name || null,
      contact_phone: quote.recipient_phone || null,
      contact_email: quote.recipient_email || null,
      specs: quoteSnapshot,
      user_id: quote.user_id || actorId,
    } as never)
    .select('id, name, status, payment_status')
    .single();

  if (projectError) throw projectError;

  const { error: quoteError } = await supabase
    .from('saved_quotes')
    .update({
      project_id: project.id,
      project_followup_status: 'converted',
      project_followup_note: null,
      project_followup_updated_at: new Date().toISOString(),
      project_followup_updated_by: actorId,
      project_stage: 'contracted',
      quote_status: projectStageToLegacyQuoteStatus('contracted'),
      status_updated_at: new Date().toISOString(),
    } as never)
    .eq('id', quote.id);

  if (quoteError) {
    await supabase
      .from('projects')
      .delete()
      .eq('id', project.id);
    throw quoteError;
  }

  const { error: documentError } = await (supabase as any)
    .from('document_files')
    .update({ project_id: project.id })
    .eq('quote_id', quote.id)
    .is('project_id', null);

  await logQuoteActivity({
    quoteId: quote.id,
    actionType: 'project_converted',
    actorId,
    actorName,
    oldValue: quote.project_id || null,
    newValue: project.id,
    metadata: {
      quoteNumber: quote.quote_number,
      projectId: project.id,
      projectName: project.name,
      documentLinkError: documentError ? documentError.message : null,
    },
  });

  if (quote.project_stage !== 'contracted') {
    await logQuoteActivity({
      quoteId: quote.id,
      actionType: 'status_changed',
      actorId,
      actorName,
      oldValue: quote.project_stage || 'quote_issued',
      newValue: 'contracted',
      memo: '프로젝트 전환으로 자동 수주 처리',
      metadata: { quoteNumber: quote.quote_number, projectId: project.id },
    });
  }

  if (documentError) {
    console.warn('[QuoteProjectConversion] document_files link failed:', documentError);
  }

  let approvalRequestId: string | null = null;
  let approvalRequestError: string | null = null;
  try {
    approvalRequestId = await createApprovalRequest({
      requestType: 'project_start',
      title: `프로젝트 개시 품의 · ${project.name}`,
      summary: `${quote.quote_number} 견적 기준 프로젝트 개시 승인 요청`,
      amount: Number(quote.total || 0),
      relatedQuoteId: quote.id,
      relatedProjectId: project.id,
      payloadSnapshot: {
        quote: quoteSnapshot,
        project: {
          id: project.id,
          name: project.name,
          status: project.status,
        },
        convertedBy: {
          actorId,
          actorName,
        },
      },
    });
  } catch (approvalError) {
    approvalRequestError = getErrorMessage(approvalError);
    console.warn('[QuoteProjectConversion] project approval request failed:', approvalError);
  }

  return {
    ...(project as ConvertedProject),
    approvalRequestId,
    approvalRequestError,
  };
}
