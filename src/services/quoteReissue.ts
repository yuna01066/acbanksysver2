import { supabase } from '@/integrations/supabase/client';
import { logQuoteActivity } from '@/services/quoteActivity';
import { recalculateValidUntil } from '@/utils/quoteWorkflow';
import { secureRandomNumericString } from '@/utils/secureRandom';

interface ReissueQuoteParams {
  quoteId: string;
  actorId: string;
  actorName: string;
}

export interface ReissuedQuoteResult {
  id: string;
  quote_number: string;
}

const generateQuoteNumber = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');
  const sequence = secureRandomNumericString(0, 99, 2);
  return `${month}${day}${hour}${minute}${sequence}`;
};

const withoutGeneratedQuotePdf = (attachments: unknown) => {
  if (!Array.isArray(attachments)) return [];
  return attachments.filter((attachment: any) => attachment?.type !== 'quote_pdf');
};

export async function reissueSavedQuote({
  quoteId,
  actorId,
  actorName,
}: ReissueQuoteParams): Promise<ReissuedQuoteResult> {
  const { data: originalQuote, error: fetchError } = await supabase
    .from('saved_quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!originalQuote) throw new Error('원본 견적서를 찾을 수 없습니다.');
  if ((originalQuote as any).reissued_quote_id) {
    throw new Error('이미 재발행된 견적입니다.');
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const newQuoteNumber = generateQuoteNumber();
  const newValidUntil = recalculateValidUntil((originalQuote as any).valid_until, now);

  const reissueData = {
    quote_number: newQuoteNumber,
    quote_date: nowIso,
    quote_date_display: nowIso,
    project_name: (originalQuote as any).project_name,
    recipient_name: (originalQuote as any).recipient_name,
    recipient_company: (originalQuote as any).recipient_company,
    recipient_phone: (originalQuote as any).recipient_phone,
    recipient_email: (originalQuote as any).recipient_email,
    recipient_address: (originalQuote as any).recipient_address,
    recipient_memo: (originalQuote as any).recipient_memo,
    items: (originalQuote as any).items,
    subtotal: (originalQuote as any).subtotal,
    tax: (originalQuote as any).tax,
    total: (originalQuote as any).total,
    user_id: actorId,
    valid_until: newValidUntil,
    delivery_period: (originalQuote as any).delivery_period,
    payment_condition: (originalQuote as any).payment_condition,
    issuer_id: (originalQuote as any).issuer_id,
    issuer_name: (originalQuote as any).issuer_name,
    issuer_email: (originalQuote as any).issuer_email,
    issuer_phone: (originalQuote as any).issuer_phone,
    issuer_department: (originalQuote as any).issuer_department,
    issuer_position: (originalQuote as any).issuer_position,
    pricing_version_id: (originalQuote as any).pricing_version_id,
    calculation_snapshot: (originalQuote as any).calculation_snapshot,
    custom_color_name: (originalQuote as any).custom_color_name,
    custom_opacity: (originalQuote as any).custom_opacity,
    attachments: withoutGeneratedQuotePdf((originalQuote as any).attachments),
    desired_delivery_date: (originalQuote as any).desired_delivery_date,
    assigned_to: (originalQuote as any).assigned_to || (originalQuote as any).issuer_id || actorId,
    assigned_to_name: (originalQuote as any).assigned_to_name || (originalQuote as any).issuer_name || actorName,
    project_stage: 'quote_issued',
    quote_status: 'sent',
    status_updated_at: nowIso,
    auto_cancelled_at: null,
    auto_cancel_reason: null,
    reissued_from_quote_id: quoteId,
    reissued_at: nowIso,
  };

  const { data: newQuote, error: insertError } = await (supabase as any)
    .from('saved_quotes')
    .insert(reissueData)
    .select('id, quote_number')
    .single();

  if (insertError) throw insertError;

  const { error: updateOriginalError } = await (supabase as any)
    .from('saved_quotes')
    .update({
      reissued_quote_id: newQuote.id,
      reissued_at: nowIso,
      status_updated_at: nowIso,
    })
    .eq('id', quoteId);

  if (updateOriginalError) {
    await (supabase as any).from('saved_quotes').delete().eq('id', newQuote.id);
    throw updateOriginalError;
  }

  await Promise.allSettled([
    logQuoteActivity({
      quoteId,
      actionType: 'quote_reissued',
      actorId,
      actorName,
      oldValue: (originalQuote as any).quote_number,
      newValue: newQuote.quote_number,
      metadata: {
        originalQuoteId: quoteId,
        reissuedQuoteId: newQuote.id,
        originalQuoteNumber: (originalQuote as any).quote_number,
        reissuedQuoteNumber: newQuote.quote_number,
      },
    }),
    logQuoteActivity({
      quoteId: newQuote.id,
      actionType: 'created_from_reissue',
      actorId,
      actorName,
      oldValue: (originalQuote as any).quote_number,
      newValue: newQuote.quote_number,
      metadata: {
        originalQuoteId: quoteId,
        reissuedQuoteId: newQuote.id,
        originalQuoteNumber: (originalQuote as any).quote_number,
        reissuedQuoteNumber: newQuote.quote_number,
      },
    }),
  ]);

  return newQuote;
}
