import { supabase } from '@/integrations/supabase/client';
import { logQuoteActivity } from '@/services/quoteActivity';
import { secureRandomNumericString } from '@/utils/secureRandom';

interface DuplicateSavedQuoteParams {
  quoteId: string;
  actorId: string;
  actorName: string;
  actorEmail?: string | null;
}

export interface DuplicatedQuoteResult {
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

export async function duplicateSavedQuote({
  quoteId,
  actorId,
  actorName,
  actorEmail,
}: DuplicateSavedQuoteParams): Promise<DuplicatedQuoteResult> {
  const { data: originalQuote, error: fetchError } = await supabase
    .from('saved_quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!originalQuote) throw new Error('원본 견적서를 찾을 수 없습니다.');

  const nowIso = new Date().toISOString();
  const newQuoteNumber = generateQuoteNumber();
  const duplicateData = {
    quote_number: newQuoteNumber,
    quote_date: nowIso,
    quote_date_display: nowIso,
    project_name: (originalQuote as any).project_name
      ? `${(originalQuote as any).project_name} (복사본)`
      : '(복사본)',
    recipient_name: (originalQuote as any).recipient_name,
    recipient_company: (originalQuote as any).recipient_company,
    recipient_phone: (originalQuote as any).recipient_phone,
    recipient_email: (originalQuote as any).recipient_email,
    recipient_address: (originalQuote as any).recipient_address,
    recipient_memo: (originalQuote as any).recipient_memo,
    recipient_id: (originalQuote as any).recipient_id,
    items: (originalQuote as any).items,
    subtotal: (originalQuote as any).subtotal,
    tax: (originalQuote as any).tax,
    total: (originalQuote as any).total,
    user_id: actorId,
    valid_until: (originalQuote as any).valid_until,
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
    project_stage: 'quote_issued',
    quote_status: 'sent',
    project_followup_status: 'pending',
    project_followup_note: null,
    project_followup_updated_at: null,
    project_followup_updated_by: null,
    assigned_to: (originalQuote as any).issuer_id || actorId,
    assigned_to_name: (originalQuote as any).issuer_name || actorName || actorEmail || null,
    status_updated_at: nowIso,
    auto_cancelled_at: null,
    auto_cancel_reason: null,
    custom_color_name: (originalQuote as any).custom_color_name,
    custom_opacity: (originalQuote as any).custom_opacity,
    attachments: withoutGeneratedQuotePdf((originalQuote as any).attachments),
    desired_delivery_date: (originalQuote as any).desired_delivery_date,
  };

  const { data: newQuote, error: insertError } = await (supabase as any)
    .from('saved_quotes')
    .insert(duplicateData)
    .select('id, quote_number')
    .single();

  if (insertError) throw insertError;

  await Promise.allSettled([
    logQuoteActivity({
      quoteId,
      actionType: 'quote_duplicated',
      actorId,
      actorName: actorName || actorEmail || '알 수 없음',
      oldValue: (originalQuote as any).quote_number,
      newValue: newQuote.quote_number,
      metadata: {
        source: 'original',
        originalQuoteId: quoteId,
        duplicatedQuoteId: newQuote.id,
        originalQuoteNumber: (originalQuote as any).quote_number,
        duplicatedQuoteNumber: newQuote.quote_number,
      },
    }),
    logQuoteActivity({
      quoteId: newQuote.id,
      actionType: 'quote_duplicated',
      actorId,
      actorName: actorName || actorEmail || '알 수 없음',
      oldValue: (originalQuote as any).quote_number,
      newValue: newQuote.quote_number,
      metadata: {
        source: 'duplicate',
        originalQuoteId: quoteId,
        duplicatedQuoteId: newQuote.id,
        originalQuoteNumber: (originalQuote as any).quote_number,
        duplicatedQuoteNumber: newQuote.quote_number,
      },
    }),
  ]).catch((error) => {
    console.warn('Failed to log quote duplication activity:', error);
  });

  return newQuote;
}
