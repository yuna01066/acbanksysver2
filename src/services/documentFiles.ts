import { supabase } from '@/integrations/supabase/client';
import { gcsDeleteFile, gcsGetDownloadUrl } from '@/hooks/useGcsStorage';

export type StorageProvider = 'supabase_storage' | 'gcs' | 'google_drive' | 'external_url';
export type DocumentSyncStatus = 'pending' | 'synced' | 'failed' | 'not_required';

export interface DocumentDownloadTarget {
  documentFileId?: string | null;
  storageProvider?: StorageProvider;
  storageBucket?: string | null;
  storagePath?: string | null;
  externalUrl?: string | null;
  driveFileId?: string | null;
  publicUrl?: string | null;
}

interface DocumentFileInput {
  owner_type: string;
  quote_id?: string | null;
  project_id?: string | null;
  recipient_id?: string | null;
  document_type: string;
  file_name: string;
  storage_provider: StorageProvider;
  storage_bucket?: string | null;
  storage_path?: string | null;
  external_url?: string | null;
  drive_file_id?: string | null;
  drive_folder_id?: string | null;
  drive_path?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  metadata?: Record<string, unknown>;
  uploaded_by?: string | null;
  sync_status?: DocumentSyncStatus;
  sync_error?: string | null;
  synced_at?: string | null;
}

const documentFilesTable = 'document_files' as any;

async function getDriveFileIdFromLedger(
  documentFileId: string | null | undefined,
  storageBucket?: string | null,
  storagePath?: string | null,
): Promise<string | null> {
  if (!documentFileId && (!storageBucket || !storagePath)) return null;

  let query = supabase
    .from(documentFilesTable)
    .select('drive_file_id')
    .limit(1);

  query = documentFileId
    ? query.eq('id', documentFileId)
    : query.eq('storage_bucket', storageBucket).eq('storage_path', storagePath);

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  return (data as { drive_file_id?: string | null } | null)?.drive_file_id || null;
}

export async function deleteDriveFile(fileId: string | null | undefined): Promise<void> {
  if (!fileId) return;

  const { data, error } = await supabase.functions.invoke('google-drive', {
    body: { action: 'delete-file', fileId },
  });

  if (error || data?.error) {
    throw new Error(error?.message || data?.error || 'Google Drive 파일 삭제에 실패했습니다.');
  }
}

export async function getDownloadUrl(target: DocumentDownloadTarget): Promise<string> {
  const provider = target.storageProvider || (target.externalUrl || target.publicUrl ? 'external_url' : 'supabase_storage');

  if (provider === 'external_url') {
    const url = target.externalUrl || target.publicUrl;
    if (!url) throw new Error('다운로드 URL이 없습니다.');
    return url;
  }

  if (provider === 'google_drive') {
    if (!target.driveFileId) throw new Error('Google Drive 파일 ID가 없습니다.');
    return `https://drive.google.com/file/d/${target.driveFileId}/view`;
  }

  if (provider === 'gcs') {
    if (!target.storagePath) throw new Error('GCS 파일 경로가 없습니다.');
    return gcsGetDownloadUrl(target.storagePath);
  }

  if (!target.storageBucket || !target.storagePath) {
    throw new Error('스토리지 버킷 또는 파일 경로가 없습니다.');
  }

  const { data, error } = await supabase.storage
    .from(target.storageBucket)
    .createSignedUrl(target.storagePath, 300);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || '다운로드 링크 생성에 실패했습니다.');
  }

  return data.signedUrl;
}

export async function openDocumentFile(target: DocumentDownloadTarget): Promise<void> {
  const url = await getDownloadUrl(target);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function createDocumentFileRecord(input: DocumentFileInput): Promise<string | null> {
  const { data, error } = await supabase
    .from(documentFilesTable)
    .insert(input as any)
    .select('id')
    .single();

  if (error) throw error;
  return (data as { id?: string } | null)?.id || null;
}

export async function updateDocumentFileRecord(
  id: string | null | undefined,
  updates: Partial<DocumentFileInput>,
): Promise<void> {
  if (!id) return;
  const { error } = await supabase
    .from(documentFilesTable)
    .update(updates as any)
    .eq('id', id);
  if (error) throw error;
}

export async function removeDocumentFileRecord(id: string | null | undefined): Promise<void> {
  if (!id) return;
  const { error } = await supabase.from(documentFilesTable).delete().eq('id', id);
  if (error) throw error;
}

export async function deleteStoredFile(target: DocumentDownloadTarget): Promise<void> {
  const provider = target.storageProvider || 'supabase_storage';
  const driveFileId = target.driveFileId
    || await getDriveFileIdFromLedger(target.documentFileId, target.storageBucket, target.storagePath);

  if (driveFileId) {
    await deleteDriveFile(driveFileId);
  }

  if (provider === 'gcs') {
    if (target.storagePath) await gcsDeleteFile(target.storagePath);
    return;
  }

  if (provider !== 'supabase_storage') return;
  if (!target.storageBucket || !target.storagePath) return;

  const { error } = await supabase.storage
    .from(target.storageBucket)
    .remove([target.storagePath]);

  if (error) throw error;
}

export function getAttachmentTarget(
  attachment: any,
  fallbackBucket = 'quote-attachments',
): DocumentDownloadTarget {
  const storageProvider = attachment.storageProvider || attachment.storage_provider || 'supabase_storage';
  const storageBucket = attachment.storageBucket || attachment.storage_bucket || fallbackBucket;
  const storagePath = attachment.storagePath || attachment.storage_path || attachment.path || null;

  return {
    documentFileId: attachment.documentFileId || attachment.document_file_id || null,
    storageProvider,
    storageBucket,
    storagePath,
    externalUrl: attachment.externalUrl || attachment.external_url || attachment.url || null,
    driveFileId: attachment.driveFileId || attachment.drive_file_id || null,
    publicUrl: attachment.url || null,
  };
}
