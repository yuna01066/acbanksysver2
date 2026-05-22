import { supabase } from '@/integrations/supabase/client';
import { type Attachment, type Quote, type QuoteRecipient } from '@/contexts/QuoteContext';
import {
  createDocumentFileRecord,
  type DocumentSyncStatus,
  type StorageProvider,
} from '@/services/documentFiles';
import { buildIssuedQuoteDrivePath, toDrivePathText } from '@/utils/documentOrganization';
import { formatPricingVersionDisplayName } from '@/utils/pricingVersionDisplay';
import { type QuoteStyleType } from '@/utils/quoteStyle';
import { formatQuoteProjectTitle } from '@/utils/quoteNaming';

interface SaveIssuedQuoteParams {
  userId: string;
  quotes: Quote[];
  recipient: QuoteRecipient | null;
  quoteNumber: string;
  quoteStyle: QuoteStyleType;
  subtotal: number;
  tax: number;
  total: number;
  existingQuoteId?: string | null;
}

interface SaveIssuedQuoteResult {
  quoteId: string;
  inserted: boolean;
}

interface ExistingSavedQuoteForUpdate {
  quote_number?: string | null;
  quote_date_display?: string | null;
  project_name?: string | null;
  recipient_name?: string | null;
  recipient_company?: string | null;
  recipient_phone?: string | null;
  recipient_email?: string | null;
  recipient_address?: string | null;
  recipient_memo?: string | null;
  desired_delivery_date?: string | null;
  valid_until?: string | null;
  delivery_period?: string | null;
  payment_condition?: string | null;
  issuer_id?: string | null;
  issuer_name?: string | null;
  issuer_email?: string | null;
  issuer_phone?: string | null;
  issuer_department?: string | null;
  issuer_position?: string | null;
  attachments?: Attachment[] | null;
}

const hasText = (value?: string | null) => Boolean(value && value.trim().length > 0);

const pickText = (next?: string | null, existing?: string | null, fallback = '') => {
  if (hasText(next)) return next!.trim();
  if (hasText(existing)) return existing!.trim();
  return fallback;
};

const pickIsoDate = (
  next?: Date | string | null,
  existing?: string | null,
  fallback: string | null = null,
) => {
  if (next instanceof Date && !Number.isNaN(next.getTime())) return next.toISOString();
  if (typeof next === 'string' && next.trim()) return next;
  if (hasText(existing)) return existing!.trim();
  return fallback;
};

const parseDateOrNull = (value?: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const fetchExistingSavedQuote = async (quoteId: string): Promise<ExistingSavedQuoteForUpdate | null> => {
  const { data, error } = await supabase
    .from('saved_quotes')
    .select(`
      quote_number,
      quote_date_display,
      project_name,
      recipient_name,
      recipient_company,
      recipient_phone,
      recipient_email,
      recipient_address,
      recipient_memo,
      desired_delivery_date,
      valid_until,
      delivery_period,
      payment_condition,
      issuer_id,
      issuer_name,
      issuer_email,
      issuer_phone,
      issuer_department,
      issuer_position,
      attachments
    `)
    .eq('id', quoteId)
    .maybeSingle();

  if (error) throw error;
  return (data as unknown as ExistingSavedQuoteForUpdate | null) || null;
};

const buildAttachmentLedgerRecords = async ({
  quoteId,
  attachments,
  quoteNumber,
  recipient,
  userId,
}: {
  quoteId: string;
  attachments: Attachment[];
  quoteNumber: string;
  recipient: QuoteRecipient | null;
  userId: string;
}) => {
  if (!attachments.length) return attachments;

  const result: Attachment[] = [];

  for (const attachment of attachments) {
    const existingDocumentFileId = attachment.documentFileId || (attachment as any).document_file_id || null;
    if (existingDocumentFileId) {
      result.push(attachment);
      continue;
    }

    const documentType = attachment.type === 'quote_pdf' ? 'quote_pdf' : 'customer_attachment';
    const fallbackBucket = documentType === 'quote_pdf' ? 'quote-pdfs' : 'quote-attachments';
    const section = documentType === 'quote_pdf' ? '00_견적서PDF' : '01_고객첨부';
    const driveFolderPath = quoteNumber ? buildIssuedQuoteDrivePath({
      quoteNumber,
      recipientCompany: recipient?.companyName,
      projectName: recipient?.projectName,
      section,
    }) : null;
    const storageProvider = (attachment.storageProvider || (attachment as any).storage_provider || 'supabase_storage') as StorageProvider;
    const storageBucket = attachment.storageBucket || (attachment as any).storage_bucket || fallbackBucket;
    const storagePath = attachment.storagePath || (attachment as any).storage_path || attachment.path || null;
    const syncStatus = (
      attachment.syncStatus
      || (attachment as any).sync_status
      || ((attachment as any).driveFileId || (attachment as any).drive_file_id ? 'synced' : driveFolderPath ? 'pending' : 'not_required')
    ) as DocumentSyncStatus;

    const documentFileId = await createDocumentFileRecord({
      owner_type: 'quote',
      quote_id: quoteId,
      project_id: null,
      document_type: documentType,
      file_name: attachment.name,
      storage_provider: storageProvider,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      external_url: (attachment as any).externalUrl || (attachment as any).external_url || (attachment as any).url || null,
      drive_file_id: (attachment as any).driveFileId || (attachment as any).drive_file_id || null,
      drive_folder_id: (attachment as any).driveFolderId || (attachment as any).drive_folder_id || null,
      drive_path: driveFolderPath ? toDrivePathText(driveFolderPath) : (attachment as any).drivePath || (attachment as any).drive_path || null,
      mime_type: documentType === 'quote_pdf' ? 'application/pdf' : attachment.type || null,
      file_size: attachment.size || null,
      uploaded_by: userId,
      sync_status: syncStatus,
      synced_at: syncStatus === 'synced' ? new Date().toISOString() : null,
      metadata: {
        source: 'issuedQuoteSaver',
        quoteNumber,
        originalPath: attachment.path || storagePath,
      },
    });

    const { pendingDelete, ...persistedAttachment } = attachment;
    result.push({
      ...persistedAttachment,
      documentFileId,
      storageProvider,
      storageBucket,
      storagePath,
      syncStatus,
    });
  }

  return result;
};

export async function saveIssuedQuote({
  userId,
  quotes,
  recipient,
  quoteNumber,
  quoteStyle,
  subtotal,
  tax,
  total,
  existingQuoteId,
}: SaveIssuedQuoteParams): Promise<SaveIssuedQuoteResult> {
  const existingQuote = existingQuoteId
    ? await fetchExistingSavedQuote(existingQuoteId)
    : null;
  const primaryPricingVersionId = quotes.find(q => q.pricingVersionId)?.pricingVersionId || null;
  const capturedAt = new Date().toISOString();
  const primaryPricingSource = quotes.find(q => q.pricingVersionName || q.calculationSnapshot?.pricingVersion);
  const primaryPricingVersionName = formatPricingVersionDisplayName({
    versionName: primaryPricingSource?.pricingVersionName || primaryPricingSource?.calculationSnapshot?.pricingVersion?.versionName,
    supplierName: primaryPricingSource?.calculationSnapshot?.pricingVersion?.supplierName,
    effectiveFrom: primaryPricingSource?.calculationSnapshot?.pricingVersion?.effectiveFrom,
    capturedAt,
  });

  const resolvedQuoteNumber = pickText(quoteNumber, existingQuote?.quote_number);
  const resolvedCompanyName = pickText(recipient?.companyName, existingQuote?.recipient_company);
  const resolvedProjectName = pickText(recipient?.projectName, existingQuote?.project_name);
  const resolvedContactPerson = pickText(recipient?.contactPerson, existingQuote?.recipient_name);
  const resolvedPhoneNumber = pickText(recipient?.phoneNumber, existingQuote?.recipient_phone);
  const resolvedEmail = pickText(recipient?.email, existingQuote?.recipient_email);
  const resolvedDeliveryAddress = pickText(recipient?.deliveryAddress, existingQuote?.recipient_address);
  const resolvedClientMemo = pickText(recipient?.clientMemo, existingQuote?.recipient_memo);
  const resolvedValidUntil = pickText(recipient?.validUntil, existingQuote?.valid_until);
  const resolvedDeliveryPeriod = pickText(recipient?.deliveryPeriod, existingQuote?.delivery_period);
  const resolvedPaymentCondition = pickText(recipient?.paymentCondition, existingQuote?.payment_condition);
  const resolvedIssuerId = pickText(recipient?.issuerId, existingQuote?.issuer_id, userId);
  const resolvedIssuerName = pickText(recipient?.issuerName, existingQuote?.issuer_name);
  const resolvedIssuerEmail = pickText(recipient?.issuerEmail, existingQuote?.issuer_email);
  const resolvedIssuerPhone = pickText(recipient?.issuerPhone, existingQuote?.issuer_phone);
  const resolvedIssuerDepartment = pickText(recipient?.issuerDepartment, existingQuote?.issuer_department);
  const resolvedIssuerPosition = pickText(recipient?.issuerPosition, existingQuote?.issuer_position);
  const resolvedQuoteDate = pickIsoDate(recipient?.quoteDate, existingQuote?.quote_date_display, capturedAt);
  const resolvedDesiredDeliveryDate = pickIsoDate(
    recipient?.desiredDeliveryDate,
    existingQuote?.desired_delivery_date,
    null,
  );
  const resolvedAttachments = Array.isArray(recipient?.attachments)
    ? recipient.attachments
    : Array.isArray(existingQuote?.attachments)
      ? existingQuote.attachments
      : [];
  const resolvedRecipient: QuoteRecipient | null = recipient || existingQuote ? {
    projectName: resolvedProjectName,
    quoteNumber: resolvedQuoteNumber,
    quoteDate: parseDateOrNull(resolvedQuoteDate),
    validUntil: resolvedValidUntil,
    deliveryPeriod: resolvedDeliveryPeriod,
    paymentCondition: resolvedPaymentCondition,
    companyName: resolvedCompanyName,
    contactPerson: resolvedContactPerson,
    phoneNumber: resolvedPhoneNumber,
    email: resolvedEmail,
    desiredDeliveryDate: parseDateOrNull(resolvedDesiredDeliveryDate),
    deliveryAddress: resolvedDeliveryAddress,
    clientMemo: resolvedClientMemo,
    issuerId: resolvedIssuerId,
    issuerName: resolvedIssuerName,
    issuerEmail: resolvedIssuerEmail,
    issuerPhone: resolvedIssuerPhone,
    issuerDepartment: resolvedIssuerDepartment,
    issuerPosition: resolvedIssuerPosition,
    attachments: resolvedAttachments,
  } : null;

  const quoteProjectTitle = formatQuoteProjectTitle({
    projectName: resolvedProjectName,
    companyName: resolvedCompanyName,
  });

  const quoteData = {
    quote_number: resolvedQuoteNumber,
    quote_date_display: resolvedQuoteDate || capturedAt,
    project_name: quoteProjectTitle,
    recipient_name: resolvedContactPerson,
    recipient_company: resolvedCompanyName,
    recipient_phone: resolvedPhoneNumber,
    recipient_email: resolvedEmail,
    recipient_address: resolvedDeliveryAddress,
    recipient_memo: resolvedClientMemo,
    desired_delivery_date: resolvedDesiredDeliveryDate,
    quote_status: 'sent',
    assigned_to: resolvedIssuerId || userId,
    assigned_to_name: resolvedIssuerName,
    status_updated_at: capturedAt,
    valid_until: resolvedValidUntil,
    delivery_period: resolvedDeliveryPeriod,
    payment_condition: resolvedPaymentCondition,
    issuer_id: resolvedIssuerId,
    issuer_name: resolvedIssuerName,
    issuer_email: resolvedIssuerEmail,
    issuer_phone: resolvedIssuerPhone,
    issuer_department: resolvedIssuerDepartment,
    issuer_position: resolvedIssuerPosition,
    items: quotes.map(q => ({ ...q })),
    pricing_version_id: primaryPricingVersionId,
    calculation_snapshot: {
      schemaVersion: 2,
      capturedAt,
      snapshotVersion: 'issued-quote-snapshot-v2',
      formulaDocVersion: 260520,
      pricingVersionId: primaryPricingVersionId,
      pricingVersionName: primaryPricingVersionName,
      quoteStyle,
      subtotal: Math.round(subtotal),
      tax: Math.round(tax),
      total: Math.round(total),
      items: quotes.map(q => ({
        id: q.id,
        totalPrice: q.totalPrice,
        quantity: q.quantity,
        calculationSnapshot: q.calculationSnapshot || null,
      })),
      engineVersions: Array.from(new Set(
        quotes
          .map(q => q.calculationSnapshot?.snapshotVersion || q.calculationSnapshot?.calculationEngineVersion)
          .filter(Boolean)
      )),
      note: '견적 저장 당시 계산 근거입니다. 이후 단가표 변경은 저장 견적 금액에 자동 반영되지 않습니다.',
    },
    subtotal: Math.round(subtotal),
    tax: Math.round(tax),
    total: Math.round(total),
    attachments: resolvedAttachments,
  };

  const quoteId = existingQuoteId || null;
  let savedQuoteId = quoteId;
  let inserted = false;

  if (savedQuoteId) {
    const { error } = await supabase
      .from('saved_quotes')
      .update(quoteData as never)
      .eq('id', savedQuoteId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('saved_quotes')
      .insert([{ ...quoteData, user_id: userId, quote_date: capturedAt } as never])
      .select('id')
      .single();

    if (error) throw error;
    savedQuoteId = (data as { id?: string } | null)?.id || null;
    inserted = true;
  }

  if (!savedQuoteId) {
    throw new Error('견적서 저장 ID를 확인할 수 없습니다.');
  }

  if ((quoteData.attachments as Attachment[]).length > 0) {
    const attachmentsWithLedger = await buildAttachmentLedgerRecords({
      quoteId: savedQuoteId,
      attachments: quoteData.attachments as Attachment[],
      quoteNumber: resolvedQuoteNumber,
      recipient: resolvedRecipient,
      userId,
    });
    const { error } = await supabase
      .from('saved_quotes')
      .update({ attachments: attachmentsWithLedger } as never)
      .eq('id', savedQuoteId);
    if (error) throw error;
  }

  return { quoteId: savedQuoteId, inserted };
}
