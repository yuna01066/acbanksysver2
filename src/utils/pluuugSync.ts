import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PluuugEstimateData {
  title: string;
  client?: {
    id?: number;
    companyName?: string;
    inCharge?: string;
    contact?: string;
    email?: string;
  };
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    amount: number;
    description?: string;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  memo?: string;
  validUntil?: string;
  deliveryPeriod?: string;
  paymentCondition?: string;
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

    // Pluuug API 견적서 생성 형식으로 변환
    const pluuugPayload = {
      title: quoteData.title,
      content: quoteData.memo || '',
      items: quoteData.items.map((item, index) => ({
        name: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
        order: index + 1,
        description: item.description || ''
      })),
      totalAmount: quoteData.total,
      taxAmount: quoteData.tax,
      supplyAmount: quoteData.subtotal,
      // 고객 정보 (고객이 Pluuug에 등록되어 있다면 ID로 연결)
      ...(quoteData.client?.id && { client: { id: quoteData.client.id } })
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

  const items = quotes.map(quote => {
    // breakdown에서 가격 항목만 추출 (price > 0인 항목)
    const priceItems = quote.breakdown?.filter((b: any) => b.price > 0) || [];
    const description = priceItems.map((b: any) => b.label).join(', ');
    
    return {
      name: `${quote.material} ${quote.quality || ''} ${quote.thickness || ''}`.trim(),
      quantity: quote.quantity || 1,
      unitPrice: quote.totalPrice,
      amount: quote.totalPrice * (quote.quantity || 1),
      description: description || quote.processingName || ''
    };
  });

  return {
    title,
    client: recipient ? {
      companyName: recipient.companyName,
      inCharge: recipient.contactPerson,
      contact: recipient.phoneNumber,
      email: recipient.email
    } : undefined,
    items,
    subtotal,
    tax,
    total,
    memo: recipient?.clientMemo,
    validUntil: recipient?.validUntil,
    deliveryPeriod: recipient?.deliveryPeriod,
    paymentCondition: recipient?.paymentCondition
  };
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
): Promise<{ success: boolean; quoteId?: string; pluuugSynced?: boolean; error?: string }> {
  try {
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

      const syncResult = await syncQuoteToPluuug(pluuugData);
      
      if (syncResult.success) {
        pluuugSynced = true;
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
      pluuugSynced 
    };
  } catch (err: any) {
    console.error('[Save Quote with Pluuug] Error:', err);
    return { success: false, error: err.message };
  }
}
