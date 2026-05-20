import { supabase } from '@/integrations/supabase/client';
import { formatQuoteProjectTitle } from '@/utils/quoteNaming';
import { logQuoteActivity } from '@/services/quoteActivity';

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
  desired_delivery_date?: string | null;
  total: number;
  items: unknown;
  user_id: string;
  project_id?: string | null;
  quote_status?: string | null;
}

export interface ConvertedProject {
  id: string;
  name: string;
  status: string;
  payment_status: string | null;
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

export async function convertQuoteToProject({
  quote,
  actorId,
  actorName,
}: ConvertQuoteToProjectParams): Promise<ConvertedProject> {
  if (quote.project_id) {
    throw new Error('이미 프로젝트에 연결된 견적입니다.');
  }

  let recipientId: string | null = null;
  if (quote.recipient_company?.trim()) {
    const { data: recipient, error: recipientError } = await supabase
      .from('recipients')
      .select('id')
      .eq('company_name', quote.recipient_company.trim())
      .maybeSingle();

    if (recipientError) throw recipientError;
    recipientId = recipient?.id || null;
  }

  const projectName = formatQuoteProjectTitle({
    projectName: quote.project_name?.trim() || `견적 ${quote.quote_number}`,
    companyName: quote.recipient_company,
  });

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
      specs: {
        sourceQuoteId: quote.id,
        sourceQuoteNumber: quote.quote_number,
        quoteTotal: quote.total,
        desiredDeliveryDate: quote.desired_delivery_date || null,
        recipientAddress: quote.recipient_address || null,
        recipientMemo: quote.recipient_memo || null,
        items: Array.isArray(quote.items)
          ? quote.items.map((item: any) => ({
              id: item?.id,
              name: item?.name || item?.projectName || item?.description || '견적 항목',
              quantity: item?.quantity || 1,
              totalPrice: item?.totalPrice || 0,
            }))
          : [],
      },
      user_id: quote.user_id || actorId,
    } as never)
    .select('id, name, status, payment_status')
    .single();

  if (projectError) throw projectError;

  const { error: quoteError } = await supabase
    .from('saved_quotes')
    .update({
      project_id: project.id,
      quote_status: 'won',
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

  if (quote.quote_status !== 'won') {
    await logQuoteActivity({
      quoteId: quote.id,
      actionType: 'status_changed',
      actorId,
      actorName,
      oldValue: quote.quote_status || 'sent',
      newValue: 'won',
      memo: '프로젝트 전환으로 자동 수주 처리',
      metadata: { quoteNumber: quote.quote_number, projectId: project.id },
    });
  }

  if (documentError) {
    console.warn('[QuoteProjectConversion] document_files link failed:', documentError);
  }

  return project as ConvertedProject;
}
