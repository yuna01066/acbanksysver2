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
  const primaryPricingVersionId = quotes.find(q => q.pricingVersionId)?.pricingVersionId || null;
  const capturedAt = new Date().toISOString();
  const primaryPricingSource = quotes.find(q => q.pricingVersionName || q.calculationSnapshot?.pricingVersion);
  const primaryPricingVersionName = formatPricingVersionDisplayName({
    versionName: primaryPricingSource?.pricingVersionName || primaryPricingSource?.calculationSnapshot?.pricingVersion?.versionName,
    supplierName: primaryPricingSource?.calculationSnapshot?.pricingVersion?.supplierName,
    effectiveFrom: primaryPricingSource?.calculationSnapshot?.pricingVersion?.effectiveFrom,
    capturedAt,
  });
  const quoteProjectTitle = formatQuoteProjectTitle({
    projectName: recipient?.projectName,
    companyName: recipient?.companyName,
  });

  const quoteData = {
    quote_number: quoteNumber,
    quote_date_display: recipient?.quoteDate?.toISOString() || capturedAt,
    project_name: quoteProjectTitle,
    recipient_name: recipient?.contactPerson || '',
    recipient_company: recipient?.companyName || '',
    recipient_phone: recipient?.phoneNumber || '',
    recipient_email: recipient?.email || '',
    recipient_address: recipient?.deliveryAddress || '',
    recipient_memo: recipient?.clientMemo || '',
    desired_delivery_date: recipient?.desiredDeliveryDate?.toISOString() || null,
    valid_until: recipient?.validUntil || '',
    delivery_period: recipient?.deliveryPeriod || '',
    payment_condition: recipient?.paymentCondition || '',
    issuer_id: recipient?.issuerId || userId,
    issuer_name: recipient?.issuerName || '',
    issuer_email: recipient?.issuerEmail || '',
    issuer_phone: recipient?.issuerPhone || '',
    issuer_department: recipient?.issuerDepartment || '',
    issuer_position: recipient?.issuerPosition || '',
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
    attachments: recipient?.attachments || [],
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
      quoteNumber,
      recipient,
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
