import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PluuugEstimateData {
  title: string;
  quoteNumber: string;
  quoteDate: string;
  client?: {
    id?: number;
    companyName?: string;
    inCharge?: string;
    contact?: string;
    email?: string;
    address?: string;
  };
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    description?: string;
    order?: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  memo?: string;
  validUntil?: string;
  deliveryPeriod?: string;
  paymentCondition?: string;
  desiredDeliveryDate?: string;
  issuer?: {
    name?: string;
    phone?: string;
    email?: string;
  };
}

export interface PluuugSyncResult {
  success: boolean;
  pluuugEstimateId?: number;
  error?: string;
}

/**
 * 견적서를 Pluuug에 동기화
 */
export async function syncQuoteToPluuug(
  quoteData: PluuugEstimateData
): Promise<PluuugSyncResult> {
  try {
    console.log('[Pluuug Sync] Starting sync...', quoteData);

    // Pluuug API 견적서 생성 형식으로 변환 - 로컬 견적서 양식 기준
    const pluuugPayload = {
      title: quoteData.title,
      quoteNumber: quoteData.quoteNumber,
      quoteDate: quoteData.quoteDate,
      content: quoteData.memo || '',
      items: quoteData.items.map((item, index) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        order: item.order || index + 1,
        description: item.description || ''
      })),
      totalAmount: quoteData.total,
      taxAmount: quoteData.tax,
      supplyAmount: quoteData.subtotal,
      validUntil: quoteData.validUntil || '',
      deliveryPeriod: quoteData.deliveryPeriod || '',
      paymentCondition: quoteData.paymentCondition || '',
      desiredDeliveryDate: quoteData.desiredDeliveryDate || '',
      // 발신자(담당자) 정보
      issuer: quoteData.issuer ? {
        name: quoteData.issuer.name || '',
        phone: quoteData.issuer.phone || '',
        email: quoteData.issuer.email || ''
      } : undefined,
      // 고객 정보
      client: quoteData.client?.id 
        ? { 
            id: quoteData.client.id,
            companyName: quoteData.client.companyName || '',
            inCharge: quoteData.client.inCharge || '',
            contact: quoteData.client.contact || '',
            email: quoteData.client.email || '',
            address: quoteData.client.address || ''
          } 
        : quoteData.client ? {
            companyName: quoteData.client.companyName || '',
            inCharge: quoteData.client.inCharge || '',
            contact: quoteData.client.contact || '',
            email: quoteData.client.email || '',
            address: quoteData.client.address || ''
          } : undefined
    };

    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: {
        action: 'estimate.create',
        data: pluuugPayload
      }
    });

    if (error) {
      console.error('[Pluuug Sync] Function invoke error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[Pluuug Sync] API error:', data.error);
      return { success: false, error: data.error };
    }

    console.log('[Pluuug Sync] Success:', data);
    return { 
      success: true, 
      pluuugEstimateId: data?.data?.id 
    };
  } catch (err: any) {
    console.error('[Pluuug Sync] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 로컬 견적 데이터를 Pluuug 형식으로 변환
 */
export function convertQuoteToPluuugFormat(
  quotes: any[],
  recipient: any,
  quoteNumber: string,
  subtotal: number,
  tax: number,
  total: number
): PluuugEstimateData {
  const title = recipient?.projectName 
    ? `${recipient.projectName} - ${quoteNumber}`
    : `아크뱅크 견적서 ${quoteNumber}`;

  // 견적일자 포맷팅
  const quoteDate = recipient?.quoteDate 
    ? (recipient.quoteDate instanceof Date 
        ? recipient.quoteDate.toISOString() 
        : recipient.quoteDate)
    : new Date().toISOString();

  // 납기희망일 포맷팅
  const desiredDeliveryDate = recipient?.desiredDeliveryDate
    ? (recipient.desiredDeliveryDate instanceof Date 
        ? recipient.desiredDeliveryDate.toISOString() 
        : recipient.desiredDeliveryDate)
    : undefined;

  const items = quotes.map((quote, index) => {
    // breakdown에서 가격 항목만 추출 (price > 0인 항목)
    const priceItems = quote.breakdown?.filter((b: any) => b.price > 0) || [];
    const description = priceItems.map((b: any) => b.label).join(', ');
    
    return {
      name: `${quote.material} ${quote.quality || ''} ${quote.thickness || ''}`.trim(),
      quantity: quote.quantity || 1,
      unitPrice: quote.totalPrice,
      amount: quote.totalPrice * (quote.quantity || 1),
      description: description || quote.processingName || '',
      order: index + 1
    };
  });

  return {
    title,
    quoteNumber,
    quoteDate,
    client: recipient ? {
      companyName: recipient.companyName || '',
      inCharge: recipient.contactPerson || '',
      contact: recipient.phoneNumber || '',
      email: recipient.email || '',
      address: recipient.deliveryAddress || ''
    } : undefined,
    items,
    subtotal,
    tax,
    total,
    memo: recipient?.clientMemo || '',
    validUntil: recipient?.validUntil || '',
    deliveryPeriod: recipient?.deliveryPeriod || '',
    paymentCondition: recipient?.paymentCondition || '',
    desiredDeliveryDate,
    issuer: recipient?.issuerName ? {
      name: recipient.issuerName,
      phone: recipient.issuerPhone || '',
      email: recipient.issuerEmail || ''
    } : undefined
  };
}

/**
 * 담당자 정보를 recipients 테이블에 자동 저장/업데이트하고 Pluuug 클라이언트 ID 반환
 */
async function saveRecipientAutomatically(
  userId: string,
  recipient: any
): Promise<{ recipientId: string | null; pluuugClientId: number | null }> {
  if (!recipient?.companyName || !recipient?.contactPerson) {
    return { recipientId: null, pluuugClientId: null };
  }

  try {
    // 1. 기존 담당자 조회 (회사명 + 담당자명으로)
    const { data: existingRecipient, error: findError } = await supabase
      .from('recipients')
      .select('*')
      .eq('user_id', userId)
      .eq('company_name', recipient.companyName)
      .eq('contact_person', recipient.contactPerson)
      .maybeSingle();

    if (findError) {
      console.error('[Save Recipient] Find error:', findError);
      return { recipientId: null, pluuugClientId: null };
    }

    // 이메일 유효성 검사
    const email = recipient.email && recipient.email.includes('@')
      ? recipient.email
      : `${recipient.companyName.replace(/\s/g, '').toLowerCase()}@example.com`;

    const recipientData = {
      company_name: recipient.companyName,
      contact_person: recipient.contactPerson,
      phone: recipient.phoneNumber || '010-0000-0000',
      email: email,
      address: recipient.deliveryAddress || null,
      memo: recipient.clientMemo || null,
    };

    if (existingRecipient) {
      // 2a. 기존 담당자 업데이트 (새 정보가 있는 경우만)
      const updates: any = {};
      
      if (recipient.phoneNumber && recipient.phoneNumber !== existingRecipient.phone) {
        updates.phone = recipient.phoneNumber;
      }
      if (email !== existingRecipient.email) {
        updates.email = email;
      }
      if (recipient.deliveryAddress && recipient.deliveryAddress !== existingRecipient.address) {
        updates.address = recipient.deliveryAddress;
      }
      if (recipient.clientMemo && recipient.clientMemo !== existingRecipient.memo) {
        updates.memo = recipient.clientMemo;
      }

      // 업데이트할 내용이 있으면 업데이트
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('recipients')
          .update(updates)
          .eq('id', existingRecipient.id);
        
        console.log('[Save Recipient] Updated existing recipient:', existingRecipient.id);
      }

      return { 
        recipientId: existingRecipient.id, 
        pluuugClientId: existingRecipient.pluuug_client_id 
      };
    } else {
      // 2b. 새 담당자 생성
      const { data: newRecipient, error: insertError } = await supabase
        .from('recipients')
        .insert({
          user_id: userId,
          ...recipientData,
          position: '담당자',
          ceo_name: recipient.contactPerson || '대표자',
          business_registration_number: '000-00-00000',
          business_type: '서비스업',
          business_class: '기타',
          branch_number: '00',
        })
        .select('id, pluuug_client_id')
        .single();

      if (insertError) {
        // 중복 에러인 경우 무시
        if (insertError.code === '23505') {
          console.log('[Save Recipient] Recipient already exists (duplicate key)');
          return { recipientId: null, pluuugClientId: null };
        }
        console.error('[Save Recipient] Insert error:', insertError);
        return { recipientId: null, pluuugClientId: null };
      }

      console.log('[Save Recipient] Created new recipient:', newRecipient?.id);
      return { 
        recipientId: newRecipient?.id || null, 
        pluuugClientId: newRecipient?.pluuug_client_id || null 
      };
    }
  } catch (err) {
    console.error('[Save Recipient] Error:', err);
    return { recipientId: null, pluuugClientId: null };
  }
}

/**
 * 견적서 저장과 동시에 Pluuug 동기화 수행
 */
export async function saveQuoteWithPluuugSync(
  userId: string,
  quotes: any[],
  recipient: any,
  quoteNumber: string,
  subtotal: number,
  tax: number,
  total: number,
  syncToPluuug: boolean = true
): Promise<{ success: boolean; quoteId?: string; pluuugSynced?: boolean; pluuugEstimateId?: string; error?: string }> {
  try {
    // 0. 담당자 정보를 recipients 테이블에 자동 저장하고 Pluuug 클라이언트 ID 가져오기
    const { recipientId, pluuugClientId } = await saveRecipientAutomatically(userId, recipient);
    if (recipientId) {
      console.log('[Save Quote] Recipient saved/updated:', recipientId, 'Pluuug Client ID:', pluuugClientId);
    }

    // 1. Supabase에 견적서 저장
    const { data: savedQuote, error: saveError } = await supabase
      .from('saved_quotes')
      .insert([{
        user_id: userId,
        quote_number: quoteNumber,
        quote_date: new Date().toISOString(),
        project_name: recipient?.projectName || null,
        quote_date_display: recipient?.quoteDate ? recipient.quoteDate.toISOString() : new Date().toISOString(),
        valid_until: recipient?.validUntil || null,
        delivery_period: recipient?.deliveryPeriod || null,
        payment_condition: recipient?.paymentCondition || null,
        recipient_name: recipient?.contactPerson || null,
        recipient_company: recipient?.companyName || null,
        recipient_phone: recipient?.phoneNumber || null,
        recipient_email: recipient?.email || null,
        recipient_address: recipient?.deliveryAddress || null,
        recipient_memo: recipient?.clientMemo || null,
        desired_delivery_date: recipient?.desiredDeliveryDate ? recipient.desiredDeliveryDate.toISOString() : null,
        issuer_name: recipient?.issuerName || null,
        issuer_email: recipient?.issuerEmail || null,
        issuer_phone: recipient?.issuerPhone || null,
        items: quotes as any,
        subtotal,
        tax,
        total,
        attachments: (recipient?.attachments || []) as any
      }])
      .select('id')
      .single();

    if (saveError) {
      console.error('[Save Quote] Error:', saveError);
      return { success: false, error: saveError.message };
    }

    let pluuugSynced = false;
    let pluuugEstimateId: string | undefined;

    // 2. Pluuug 동기화 (옵션)
    if (syncToPluuug) {
      const pluuugData = convertQuoteToPluuugFormat(
        quotes,
        recipient,
        quoteNumber,
        subtotal,
        tax,
        total
      );

      // Pluuug 클라이언트 ID가 있으면 연결
      if (pluuugClientId) {
        pluuugData.client = {
          ...pluuugData.client,
          id: pluuugClientId
        };
        console.log('[Pluuug Sync] Linking to Pluuug client ID:', pluuugClientId);
      }

      const syncResult = await syncQuoteToPluuug(pluuugData);
      
      if (syncResult.success) {
        pluuugSynced = true;
        pluuugEstimateId = syncResult.pluuugEstimateId?.toString();
        
        // 동기화 성공 시 saved_quotes 업데이트
        await supabase
          .from('saved_quotes')
          .update({
            pluuug_synced: true,
            pluuug_synced_at: new Date().toISOString(),
            pluuug_estimate_id: pluuugEstimateId
          })
          .eq('id', savedQuote?.id);
        
        toast.success('Pluuug에도 견적서가 동기화되었습니다!');
      } else {
        // Pluuug 동기화 실패해도 로컬 저장은 성공
        console.warn('[Pluuug Sync] Failed but local save succeeded:', syncResult.error);
        toast.warning('견적서는 저장되었지만 Pluuug 동기화에 실패했습니다.');
      }
    }

    return { 
      success: true, 
      quoteId: savedQuote?.id,
      pluuugSynced,
      pluuugEstimateId
    };
  } catch (err: any) {
    console.error('[Save Quote with Pluuug] Error:', err);
    return { success: false, error: err.message };
  }
}
