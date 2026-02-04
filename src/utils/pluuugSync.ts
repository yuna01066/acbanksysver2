import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface PluuugInquiryData {
  name: string;
  quoteNumber: string;
  quoteDate: string;
  inquiryDate: string;
  estimate: string; // 견적서 내용 (문자열)
  content?: string; // 메모/설명
  client?: {
    id?: number;
    companyName?: string;
    inCharge?: string;
    contact?: string;
    email?: string;
    address?: string;
  };
  status?: {
    id: number;
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
  pluuugInquiryId?: number;
  pluuugClientId?: number;
  error?: string;
}

// Pluuug 의뢰 필드 ID 상수 (아크뱅크 전용)
export const PLUUUG_FIELD_IDS = {
  THICKNESS: 21228,        // 두께 (ML - 다중 선택)
  SIZE: 21229,             // 사이즈 (S - 문자열)
  COLOR_CODE: 21230,       // 컬러 아크뱅크 코드 (AC-) (S - 문자열)
  DOUBLE_SIDED: 21231,     // 양단면 (SL - 단일 선택)
  PAYMENT_STATUS: 21232,   // 입금 여부 (B - Boolean)
  DELIVERY_ADDRESS: 21233, // 납품 배송지 (S - 문자열)
  COLOR_CHANGE_NOTE: 21235,// 컬러/소재 변경시 작성 (S - 문자열)
  DESIRED_DELIVERY: 18120, // 납기 희망일 (D - 날짜)
};

// 두께 옵션 ID 매핑
export const THICKNESS_OPTION_IDS: Record<string, string> = {
  '1.3T': 'wNyFjaqXQmwypOo',
  '1.5T': 'aw1opkAgcQPj8bd',
  '2T': 'KJvrSObaidXzo2S',
  '3T': 'yiRfKobeCyTCa3C',
  '4T': 'SoIyHZKvYf8hhv7',
  '5T': 'vTgNJdyhcCg04bU',
  '6T': 'ytU7ES7NoWp7Jgq',
  '8T': 'ppH2Tu0h3aAeBIS',
  '10T': 'giolpsVDZtcKs8m',
  '12T': '7sjL4BmpiZWexgr',
  '14T': '5XoccG4iSIPekhj',
  '15T': 'R3ybbFBSdMBJ8wx',
  '20T': 'xLe671k980cf3dj',
  '30T': 'sIEgpDhvZl0MIgb',
  '30T 이상': 'YhFmNI2zE6DMuFn',
};

// 양단면 옵션 ID 매핑
export const DOUBLE_SIDED_OPTION_IDS: Record<string, string> = {
  '양면': '0DrVqhVvDYwYAPW',
  '단면': 'dlbz9XjNL7baq3f',
  '레이어 아크릴': 'l7d3HAb3WguqX6p',
};

export interface PluuugClientData {
  companyName: string;
  inCharge: string;
  position?: string;
  contact?: string;
  email?: string;
  content?: string;
  ceoName?: string;
  businessRegistrationNumber?: string;
  companyAddress?: string;
  companyDetailAddress?: string;
  businessType?: string;
  businessClass?: string;
  branchNumber?: string;
  status?: { id: number };
}

/**
 * 견적서 항목들을 문자열로 포맷팅
 */
function formatEstimateString(data: PluuugInquiryData): string {
  const lines: string[] = [];
  
  lines.push(`=== ${data.name} ===`);
  lines.push(`견적번호: ${data.quoteNumber}`);
  lines.push(`견적일자: ${data.quoteDate.split('T')[0]}`);
  lines.push('');
  
  // 항목 목록
  lines.push('【 품목 내역 】');
  data.items.forEach((item, index) => {
    lines.push(`${index + 1}. ${item.name}`);
    lines.push(`   수량: ${item.quantity}개`);
    lines.push(`   단가: ₩${item.unitPrice.toLocaleString()}`);
    lines.push(`   금액: ₩${item.amount.toLocaleString()}`);
    if (item.description) {
      lines.push(`   상세: ${item.description}`);
    }
    lines.push('');
  });
  
  // 합계
  lines.push('【 합계 】');
  lines.push(`공급가액: ₩${data.subtotal.toLocaleString()}`);
  lines.push(`부가세: ₩${data.tax.toLocaleString()}`);
  lines.push(`총합계: ₩${data.total.toLocaleString()}`);
  lines.push('');
  
  // 조건
  if (data.validUntil) lines.push(`유효기한: ${data.validUntil}`);
  if (data.deliveryPeriod) lines.push(`납기: ${data.deliveryPeriod}`);
  if (data.paymentCondition) lines.push(`결제조건: ${data.paymentCondition}`);
  if (data.desiredDeliveryDate) {
    lines.push(`희망납기일: ${data.desiredDeliveryDate.split('T')[0]}`);
  }
  
  // 발신자 정보
  if (data.issuer?.name) {
    lines.push('');
    lines.push('【 담당자 】');
    lines.push(`${data.issuer.name}`);
    if (data.issuer.phone) lines.push(`연락처: ${data.issuer.phone}`);
    if (data.issuer.email) lines.push(`이메일: ${data.issuer.email}`);
  }
  
  return lines.join('\n');
}

/**
 * Pluuug에 고객(Client)을 생성
 */
export async function createPluuugClient(
  clientData: PluuugClientData
): Promise<{ success: boolean; pluuugClientId?: number; error?: string }> {
  try {
    console.log('[Pluuug Client] Creating new client...', clientData);

  // 이메일 유효성 검사 및 기본값 설정
    let email = clientData.email || '';
    if (!email || !email.includes('@') || email === '_') {
      // 유효하지 않은 이메일인 경우 영문+숫자만 사용한 기본 이메일 생성
      const sanitizedName = clientData.companyName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
      const fallbackName = sanitizedName || `client${Date.now()}`;
      email = `${fallbackName}@example.com`;
    }

    // Pluuug API 고객 생성 형식으로 변환 - 모든 필수 필드 포함
    const pluuugPayload: any = {
      companyName: clientData.companyName || '미정 회사',
      inCharge: clientData.inCharge || '담당자',
      position: clientData.position || '담당자', // 필수 필드
      contact: clientData.contact || '010-0000-0000',
      email: email,
      content: clientData.content || '',
      ceoName: clientData.ceoName || clientData.inCharge || '대표자',
      businessRegistrationNumber: clientData.businessRegistrationNumber || '000-00-00000',
      companyAddress: clientData.companyAddress || '미정',
      companyDetailAddress: clientData.companyDetailAddress || '-', // 필수 필드 (빈 값 불가)
      businessType: clientData.businessType || '서비스업',
      businessClass: clientData.businessClass || '기타',
      branchNumber: clientData.branchNumber || '00',
      status: clientData.status || { id: 45637 }, // 기본 상태: 의뢰 고객
      fieldSet: [], // 필수 필드 (빈 배열)
    };

    console.log('[Pluuug Client] Payload:', pluuugPayload);

    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: {
        action: 'client.create',
        data: pluuugPayload
      }
    });

    if (error) {
      console.error('[Pluuug Client] Function invoke error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[Pluuug Client] API error:', data.error, data.data);
      return { success: false, error: data.error };
    }

    console.log('[Pluuug Client] Success:', data);
    return { 
      success: true, 
      pluuugClientId: data?.data?.id 
    };
  } catch (err: any) {
    console.error('[Pluuug Client] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 로컬 recipient 데이터를 Pluuug Client 형식으로 변환
 */
export function convertRecipientToPluuugClient(recipient: any): PluuugClientData {
  // 이메일 유효성 검사 - 영문+숫자만 사용
  let email = recipient.email || '';
  if (!email || !email.includes('@') || email === '_') {
    const sanitizedName = (recipient.companyName || recipient.company_name || 'unknown').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const fallbackName = sanitizedName || `client${Date.now()}`;
    email = `${fallbackName}@example.com`;
  }

  return {
    companyName: recipient.companyName || recipient.company_name || '미정 회사',
    inCharge: recipient.contactPerson || recipient.contact_person || '담당자',
    position: recipient.position || '담당자',
    contact: recipient.phoneNumber || recipient.phone || '010-0000-0000',
    email: email,
    content: recipient.clientMemo || recipient.memo || '',
    ceoName: recipient.ceoName || recipient.ceo_name || recipient.contactPerson || recipient.contact_person || '대표자',
    businessRegistrationNumber: recipient.businessRegistrationNumber || recipient.business_registration_number || '000-00-00000',
    companyAddress: recipient.deliveryAddress || recipient.address || '미정',
    companyDetailAddress: recipient.detailAddress || recipient.detail_address || '-',
    businessType: recipient.businessType || recipient.business_type || '서비스업',
    businessClass: recipient.businessClass || recipient.business_class || '기타',
    branchNumber: recipient.branchNumber || recipient.branch_number || '00',
    status: { id: 45637 }, // 기본 상태: 의뢰 고객
  };
}

/**
 * 고객이 Pluuug에 없으면 자동으로 등록하고, 있으면 ID 반환
 */
async function ensurePluuugClient(
  userId: string,
  recipient: any,
  recipientId: string | null
): Promise<{ pluuugClientId: number | null; error?: string }> {
  // 1. 이미 Pluuug 클라이언트 ID가 있는지 확인
  if (recipient?.pluuugClientId || recipient?.pluuug_client_id) {
    const existingId = recipient.pluuugClientId || recipient.pluuug_client_id;
    console.log('[Pluuug] Using existing client ID:', existingId);
    return { pluuugClientId: existingId };
  }

  // 2. recipients 테이블에서 pluuug_client_id 확인
  if (recipientId) {
    const { data: existingRecipient, error: findError } = await supabase
      .from('recipients')
      .select('pluuug_client_id')
      .eq('id', recipientId)
      .single();

    if (!findError && existingRecipient?.pluuug_client_id) {
      console.log('[Pluuug] Found existing client ID in recipients:', existingRecipient.pluuug_client_id);
      return { pluuugClientId: existingRecipient.pluuug_client_id };
    }
  }

  // 3. Pluuug에 새 고객 등록
  console.log('[Pluuug] No existing client ID found, creating new client...');
  
  const clientData = convertRecipientToPluuugClient(recipient);
  const createResult = await createPluuugClient(clientData);

  if (!createResult.success || !createResult.pluuugClientId) {
    console.error('[Pluuug] Failed to create client:', createResult.error);
    return { pluuugClientId: null, error: createResult.error || 'Pluuug 고객 생성 실패' };
  }

  // 4. recipients 테이블에 pluuug_client_id 업데이트
  if (recipientId) {
    const { error: updateError } = await supabase
      .from('recipients')
      .update({
        pluuug_client_id: createResult.pluuugClientId,
        pluuug_synced_at: new Date().toISOString()
      })
      .eq('id', recipientId);

    if (updateError) {
      console.warn('[Pluuug] Failed to update recipient with client ID:', updateError);
    } else {
      console.log('[Pluuug] Updated recipient with new client ID:', createResult.pluuugClientId);
    }
  }

  toast.success(`고객 "${clientData.companyName}"이(가) Pluuug에 등록되었습니다.`);
  
  return { pluuugClientId: createResult.pluuugClientId };
}

/**
 * 견적 데이터에서 Pluuug fieldSet 생성
 */
function buildFieldSet(quoteData: PluuugInquiryData, recipient: any, quotes: any[]): any[] {
  const fieldSet: any[] = [];

  // 1. 두께 (S - 문자열로 변환하여 전송) - API가 ML 형식을 거부하므로 문자열로 대체
  const thicknessValues = new Set<string>();
  quotes.forEach((quote: any) => {
    if (quote.thickness) {
      const thickness = quote.thickness.toString().replace(/\s/g, '');
      thicknessValues.add(thickness);
    }
  });
  
  // 두께는 ML 필드이지만 API 형식 문제로 인해 생략
  // 대신 content 필드에 모든 정보가 포함됨
  if (thicknessValues.size > 0) {
    console.log('[Pluuug fieldSet] Thickness values (skipped due to API format):', Array.from(thicknessValues));
  }

  // 2. 사이즈 (S - 문자열) - 모든 사이즈 정보 수집
  const sizeInfo: string[] = [];
  quotes.forEach((quote: any) => {
    if (quote.width && quote.height) {
      sizeInfo.push(`${quote.width}×${quote.height}mm`);
    } else if (quote.size) {
      sizeInfo.push(quote.size);
    } else if (quote.selectedSize) {
      sizeInfo.push(quote.selectedSize);
    }
  });
  
  if (sizeInfo.length > 0) {
    fieldSet.push({
      field: { id: PLUUUG_FIELD_IDS.SIZE },
      value: [...new Set(sizeInfo)].join(', ')
    });
  }

  // 3. 컬러 아크뱅크 코드 (S - 문자열)
  const colorCodes: string[] = [];
  quotes.forEach((quote: any) => {
    if (quote.color) colorCodes.push(quote.color);
    if (quote.selectedColor) colorCodes.push(quote.selectedColor);
    if (quote.colorCode) colorCodes.push(quote.colorCode);
  });
  
  if (colorCodes.length > 0) {
    fieldSet.push({
      field: { id: PLUUUG_FIELD_IDS.COLOR_CODE },
      value: [...new Set(colorCodes)].join(', ')
    });
  }

  // 4. 양단면 (SL - 단일 선택) - API 형식 문제로 생략
  // 대신 content 필드에 포함됨

  // 5. 입금 여부 (B - Boolean) - 기본값 false
  fieldSet.push({
    field: { id: PLUUUG_FIELD_IDS.PAYMENT_STATUS },
    value: false
  });

  // 6. 납품 배송지 (S - 문자열)
  const deliveryAddress = recipient?.deliveryAddress || recipient?.address || '';
  if (deliveryAddress && deliveryAddress !== '_' && deliveryAddress !== '-') {
    fieldSet.push({
      field: { id: PLUUUG_FIELD_IDS.DELIVERY_ADDRESS },
      value: deliveryAddress
    });
  }

  // 7. 컬러/소재 변경시 작성 (S - 문자열) - 커스텀 컬러 정보
  const customColorInfo: string[] = [];
  quotes.forEach((quote: any) => {
    if (quote.customColorName) customColorInfo.push(quote.customColorName);
    if (quote.customOpacity) customColorInfo.push(`투명도: ${quote.customOpacity}`);
  });
  
  if (customColorInfo.length > 0) {
    fieldSet.push({
      field: { id: PLUUUG_FIELD_IDS.COLOR_CHANGE_NOTE },
      value: customColorInfo.join(', ')
    });
  }

  // 8. 납기 희망일 (D - 날짜)
  if (quoteData.desiredDeliveryDate) {
    const dateStr = quoteData.desiredDeliveryDate.split('T')[0];
    fieldSet.push({
      field: { id: PLUUUG_FIELD_IDS.DESIRED_DELIVERY },
      value: dateStr
    });
  }

  return fieldSet;
}

/**
 * 견적서를 Pluuug 의뢰(Inquiry)로 동기화
 */
export async function syncQuoteToPluuug(
  quoteData: PluuugInquiryData,
  userId?: string,
  recipient?: any,
  recipientId?: string | null,
  quotes?: any[]
): Promise<PluuugSyncResult> {
  try {
    console.log('[Pluuug Sync] Starting inquiry sync...', quoteData);

    // 고객 ID 확보 (없으면 자동 등록)
    let clientId = quoteData.client?.id;
    
    if (!clientId && userId && recipient) {
      const clientResult = await ensurePluuugClient(userId, recipient, recipientId || null);
      
      if (clientResult.error) {
        return { success: false, error: clientResult.error };
      }
      
      clientId = clientResult.pluuugClientId || undefined;
    }

    if (!clientId) {
      console.warn('[Pluuug Sync] No client ID available');
      return { 
        success: false, 
        error: 'Pluuug에 연결된 고객 정보가 없습니다. 고객 정보를 입력해주세요.' 
      };
    }

    // 견적 내용을 문자열로 포맷팅
    const estimateContent = formatEstimateString(quoteData);

    // Pluuug API 의뢰 생성 형식으로 변환 - 먼저 빈 fieldSet으로 생성
    const pluuugPayload: any = {
      name: quoteData.name,
      estimate: quoteData.total.toString(),
      content: estimateContent,
      inquiryDate: quoteData.inquiryDate.split('T')[0],
      contract: null,
      workSet: [],
      inChargeSet: [],
      fieldSet: [], // 빈 배열로 먼저 생성
      status: { id: quoteData.status?.id || 120348 },
      client: { id: clientId },
    };

    console.log('[Pluuug Sync] Creating inquiry...');

    const { data, error } = await supabase.functions.invoke('pluuug-api', {
      body: {
        action: 'inquiry.create',
        data: pluuugPayload
      }
    });

    if (error) {
      console.error('[Pluuug Sync] Function invoke error:', error);
      return { success: false, error: error.message };
    }

    if (data?.error) {
      console.error('[Pluuug Sync] API error:', data.error, data.data);
      return { success: false, error: data.error };
    }

    const inquiryId = data?.data?.id;
    console.log('[Pluuug Sync] Inquiry created with ID:', inquiryId);

    // 의뢰 생성 후 fieldSet 업데이트 (별도 요청)
    if (quotes && quotes.length > 0 && inquiryId) {
      const fieldSet = buildFieldSet(quoteData, recipient, quotes);
      console.log('[Pluuug Sync] Updating fieldSet:', JSON.stringify(fieldSet, null, 2));

      if (fieldSet.length > 0) {
        try {
          const { data: updateData, error: updateError } = await supabase.functions.invoke('pluuug-api', {
            body: {
              action: 'inquiry.update',
              id: inquiryId,
              data: { fieldSet }
            }
          });

          if (updateError || updateData?.error) {
            console.warn('[Pluuug Sync] fieldSet update failed (non-critical):', updateError || updateData?.error);
            // fieldSet 업데이트 실패는 무시 (의뢰 생성은 성공)
          } else {
            console.log('[Pluuug Sync] fieldSet updated successfully');
          }
        } catch (updateErr) {
          console.warn('[Pluuug Sync] fieldSet update exception:', updateErr);
        }
      }
    }

    return { 
      success: true, 
      pluuugInquiryId: inquiryId,
      pluuugClientId: clientId
    };
  } catch (err: any) {
    console.error('[Pluuug Sync] Error:', err);
    return { success: false, error: err.message };
  }
}

/**
 * 로컬 견적 데이터를 Pluuug Inquiry 형식으로 변환
 */
export function convertQuoteToPluuugFormat(
  quotes: any[],
  recipient: any,
  quoteNumber: string,
  subtotal: number,
  tax: number,
  total: number
): PluuugInquiryData {
  const name = recipient?.projectName 
    ? `${recipient.projectName}`
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
    name,
    quoteNumber,
    quoteDate,
    inquiryDate: quoteDate, // 의뢰일 = 견적일
    estimate: '', // formatEstimateString에서 생성됨
    content: recipient?.clientMemo || '',
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
): Promise<{ success: boolean; quoteId?: string; pluuugSynced?: boolean; pluuugInquiryId?: string; error?: string }> {
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
    let pluuugInquiryId: string | undefined;

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

      // 고객 자동 등록 + 동기화 (quotes 데이터 포함하여 fieldSet 생성)
      const syncResult = await syncQuoteToPluuug(
        pluuugData,
        userId,
        recipient,
        recipientId,
        quotes // quotes 데이터 전달
      );
      
      if (syncResult.success) {
        pluuugSynced = true;
        pluuugInquiryId = syncResult.pluuugInquiryId?.toString();
        
        // 동기화 성공 시 saved_quotes 업데이트
        await supabase
          .from('saved_quotes')
          .update({
            pluuug_synced: true,
            pluuug_synced_at: new Date().toISOString(),
            pluuug_estimate_id: pluuugInquiryId
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
      pluuugInquiryId
    };
  } catch (err: any) {
    console.error('[Save Quote with Pluuug] Error:', err);
    return { success: false, error: err.message };
  }
}
