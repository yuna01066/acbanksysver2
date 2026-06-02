import { supabase } from '@/integrations/supabase/client';
import { type QuoteRecipient } from '@/contexts/QuoteContext';

interface UpsertRecipientParams {
  userId: string;
  recipient: QuoteRecipient | null;
}

interface UpsertRecipientResult {
  recipientId: string | null;
  inserted: boolean;
  updated: boolean;
}

const cleanText = (value?: string | null) => value?.trim() || '';

const toEmailFallback = (companyName: string, contactPerson: string) => {
  const base = (companyName || contactPerson || 'recipient')
    .replace(/[^a-zA-Z0-9가-힣]/g, '')
    .toLowerCase()
    .slice(0, 40);
  return `${base || 'recipient'}@example.com`;
};

const buildNonEmptyUpdates = (recipient: QuoteRecipient) => {
  const updates: Record<string, string | null> = {};
  const phone = cleanText(recipient.phoneNumber);
  const email = cleanText(recipient.email);
  const address = cleanText(recipient.deliveryAddress);
  const memo = cleanText(recipient.clientMemo);

  if (phone) updates.phone = phone;
  if (email) updates.email = email;
  if (address) updates.address = address;
  if (memo) updates.memo = memo;

  return updates;
};

export async function upsertRecipientFromQuoteRecipient({
  userId,
  recipient,
}: UpsertRecipientParams): Promise<UpsertRecipientResult> {
  if (!recipient) {
    return { recipientId: null, inserted: false, updated: false };
  }

  const companyName = cleanText(recipient.companyName) || cleanText(recipient.contactPerson);
  const contactPerson = cleanText(recipient.contactPerson) || cleanText(recipient.companyName);

  if (!companyName || !contactPerson) {
    return { recipientId: null, inserted: false, updated: false };
  }

  const { data: existing, error: findError } = await supabase
    .from('recipients')
    .select('id')
    .eq('user_id', userId)
    .eq('company_name', companyName)
    .eq('contact_person', contactPerson)
    .maybeSingle();

  if (findError) throw findError;

  if (existing?.id) {
    const updates = buildNonEmptyUpdates(recipient);
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from('recipients')
        .update(updates)
        .eq('id', existing.id)
        .eq('user_id', userId);
      if (updateError) throw updateError;
      return { recipientId: existing.id, inserted: false, updated: true };
    }
    return { recipientId: existing.id, inserted: false, updated: false };
  }

  const phone = cleanText(recipient.phoneNumber) || '010-0000-0000';
  const email = cleanText(recipient.email) || toEmailFallback(companyName, contactPerson);

  const insertPayload = {
    user_id: userId,
    company_name: companyName,
    business_name: null,
    contact_person: contactPerson,
    position: '담당자',
    phone,
    email,
    address: cleanText(recipient.deliveryAddress) || null,
    detail_address: null,
    ceo_name: contactPerson || '대표자',
    business_registration_number: '000-00-00000',
    business_type: '서비스업',
    business_class: '기타',
    branch_number: '00',
    accounting_contact_person: null,
    accounting_position: null,
    accounting_phone: null,
    accounting_email: null,
    memo: cleanText(recipient.clientMemo) || null,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('recipients')
    .insert(insertPayload)
    .select('id')
    .single();

  if (insertError) {
    if (insertError.code === '23505') {
      const { data: duplicate, error: duplicateError } = await supabase
        .from('recipients')
        .select('id')
        .eq('user_id', userId)
        .eq('company_name', companyName)
        .eq('contact_person', contactPerson)
        .maybeSingle();
      if (duplicateError) throw duplicateError;
      return { recipientId: duplicate?.id || null, inserted: false, updated: false };
    }
    throw insertError;
  }

  return { recipientId: inserted?.id || null, inserted: true, updated: false };
}
