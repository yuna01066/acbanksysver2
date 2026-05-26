import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  getSupabaseAdminClient,
  isAuthResponse,
  requireFunctionAuth,
  withCors,
} from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Create JWT from service account credentials
async function createJWT(serviceAccount: any): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: serviceAccount.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const pemContent = serviceAccount.private_key
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${unsignedToken}.${signatureB64}`;
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const jwt = await createJWT(serviceAccount);
  const res = await fetch(serviceAccount.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Token exchange failed: ${errText}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string,
  driveId: string
): Promise<string> {
  const q = `name='${escapeDriveQueryValue(name)}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${driveId}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files?.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Failed to create folder '${name}': ${errText}`);
  }

  const folder = await createRes.json();
  return folder.id;
}

async function ensureFolderPath(
  accessToken: string,
  folderNames: string[],
  rootId: string,
  driveId: string
): Promise<string> {
  let currentParent = rootId;
  for (const name of folderNames) {
    currentParent = await findOrCreateFolder(accessToken, name, currentParent, driveId);
  }
  return currentParent;
}

// Multipart upload for small files (base64)
async function uploadFile(
  accessToken: string,
  folderId: string,
  fileName: string,
  fileBase64: string,
  contentType: string
): Promise<any> {
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const boundary = '===BOUNDARY===';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`;
  const filePart = `${delimiter}Content-Type: ${contentType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${fileBase64}`;

  const body = metaPart + filePart + closeDelimiter;

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Upload failed: ${errText}`);
  }

  return await res.json();
}

async function uploadBytes(
  accessToken: string,
  folderId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string
): Promise<any> {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return uploadFile(accessToken, folderId, fileName, btoa(binary), contentType);
}

// Init resumable upload session - returns upload URI for client-side direct upload
async function initResumableUpload(
  accessToken: string,
  folderId: string,
  fileName: string,
  contentType: string,
  fileSize: number
): Promise<string> {
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': fileSize.toString(),
      },
      body: metadata,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Resumable upload init failed: ${errText}`);
  }

  const uploadUri = res.headers.get('Location');
  if (!uploadUri) throw new Error('No upload URI returned');
  return uploadUri;
}

function getConfig() {
  const serviceAccountKey = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY');
  const sharedDriveId = Deno.env.get('GOOGLE_DRIVE_SHARED_DRIVE_ID');
  if (!serviceAccountKey || !sharedDriveId) {
    throw new Error('Missing GCS_SERVICE_ACCOUNT_KEY or GOOGLE_DRIVE_SHARED_DRIVE_ID');
  }
  
  let parsed;
  try {
    parsed = JSON.parse(serviceAccountKey);
  } catch (e1) {
    // Try decoding as base64
    try {
      const decoded = atob(serviceAccountKey);
      parsed = JSON.parse(decoded);
    } catch (e2) {
      throw new Error(`GCS_SERVICE_ACCOUNT_KEY is not valid JSON (first 20 chars: "${serviceAccountKey.substring(0, 20)}..."). Please re-set the secret with the full JSON content of your service account key file.`);
    }
  }
  
  // Extract folder ID if a full URL was provided
  let driveId = sharedDriveId;
  const urlMatch = sharedDriveId.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) {
    driveId = urlMatch[1];
  }
  
  return { serviceAccount: parsed, sharedDriveId: driveId };
}

function drivePathSegments(path: string): string[] {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function extractDriveFileId(value: unknown): string | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const decoded = decodeURIComponent(raw);
  const patterns = [
    /\/folders\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
    /^([a-zA-Z0-9_-]{10,})$/,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function driveFileViewLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

function getImageExtension(fileName: string, mimeType: string | null | undefined): string {
  const match = fileName.match(/\.([a-zA-Z0-9]{2,8})$/);
  if (match?.[1]) return match[1].toLowerCase();
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/gif') return 'gif';
  if (mimeType === 'image/heic') return 'heic';
  return 'jpg';
}

function makePortfolioCopyFileName(file: any): string {
  const rawName = String(file?.name || 'portfolio-image');
  const withoutExt = rawName.replace(/\.[^.]+$/, '');
  const safeBase = withoutExt
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'portfolio';
  return `${Date.now()}-${crypto.randomUUID()}-${safeBase}.${getImageExtension(rawName, file?.mimeType)}`;
}

function getMetadataRecord(value: any): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

const PORTFOLIO_DRIVE_ROOT = ['ACBANK_SYS', '04_포트폴리오'];
const PORTFOLIO_CATEGORY_FALLBACK = '기타';
const PORTFOLIO_CATEGORIES = new Set([
  '인테리어',
  '제작가공',
  '디테일',
  '사인/디스플레이',
  PORTFOLIO_CATEGORY_FALLBACK,
]);

function sanitizeDriveFolderName(value: string): string {
  const cleaned = value
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || '미분류';
}

function normalizePortfolioCategory(value: string | null | undefined): string {
  const trimmed = (value || '').trim();
  return PORTFOLIO_CATEGORIES.has(trimmed) ? trimmed : PORTFOLIO_CATEGORY_FALLBACK;
}

function getPortfolioFolderPath(body: any): string[] {
  if (Array.isArray(body.folderPath) && body.folderPath.length > 0) {
    return body.folderPath.map((part: string) => sanitizeDriveFolderName(String(part)));
  }

  const category = normalizePortfolioCategory(body.category);
  const postTitle = sanitizeDriveFolderName(String(body.postTitle || body.title || '무제 포트폴리오'));
  return [...PORTFOLIO_DRIVE_ROOT, category, postTitle];
}

async function findDriveFilesByName(
  accessToken: string,
  folderId: string,
  fileName: string,
  driveId: string
): Promise<any[]> {
  const q = `name='${escapeDriveQueryValue(fileName)}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${driveId}&fields=files(id,name,size,mimeType,createdTime)&pageSize=10&orderBy=createdTime desc`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive duplicate lookup failed: ${errText}`);
  }

  const data = await res.json();
  return data.files || [];
}

async function getDriveFileMetadata(
  accessToken: string,
  fileId: string,
  fields = 'id,name,mimeType,size,parents,trashed',
): Promise<any | null> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true&fields=${encodeURIComponent(fields)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive file lookup failed: ${errText}`);
  }

  return await res.json();
}

async function assertFileInFolder(
  accessToken: string,
  fileId: string,
  folderId: string,
): Promise<any | null> {
  const file = await getDriveFileMetadata(accessToken, fileId);
  if (!file) return null;
  if (file.trashed) throw new Error('Drive 파일이 이미 휴지통에 있습니다.');
  if (!Array.isArray(file.parents) || !file.parents.includes(folderId)) {
    throw new Error('요청한 Drive 폴더에 있는 파일만 처리할 수 있습니다.');
  }
  return file;
}

async function deleteDriveFile(accessToken: string, fileId: string): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`Delete failed: ${errText}`);
  }
}

async function copyDriveFile(
  accessToken: string,
  fileId: string,
  folderId: string,
  fileName: string,
): Promise<any> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}/copy?supportsAllDrives=true&fields=id,name,mimeType,size,parents`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive copy failed: ${errText}`);
  }

  const copied = await res.json();
  if (Array.isArray(copied.parents) && copied.parents.includes(folderId)) {
    return copied;
  }

  const removeParents = Array.isArray(copied.parents)
    ? copied.parents.filter((parentId: string) => parentId !== folderId).join(',')
    : '';
  const updateUrl = new URL(`https://www.googleapis.com/drive/v3/files/${copied.id}`);
  updateUrl.searchParams.set('supportsAllDrives', 'true');
  updateUrl.searchParams.set('addParents', folderId);
  if (removeParents) updateUrl.searchParams.set('removeParents', removeParents);
  updateUrl.searchParams.set('fields', 'id,name,mimeType,size,parents');

  const updateRes = await fetch(updateUrl.toString(), {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    await deleteDriveFile(accessToken, copied.id).catch((deleteError) => {
      console.warn('Failed to clean up copied Drive file after move failure:', deleteError);
    });
    throw new Error(`Drive copied file move failed: ${errText}`);
  }

  return await updateRes.json();
}

async function getDriveFileMedia(
  accessToken: string,
  fileId: string,
): Promise<{ file: any; body: ReadableStream<Uint8Array> | null; contentType: string }> {
  const file = await getDriveFileMetadata(accessToken, fileId);
  if (!file || file.trashed) throw new Error('Drive 파일을 찾을 수 없습니다.');

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive file download failed: ${errText}`);
  }

  return {
    file,
    body: res.body,
    contentType: file.mimeType || res.headers.get('Content-Type') || 'application/octet-stream',
  };
}

async function listDriveChildren(
  accessToken: string,
  driveId: string,
  parentId: string,
): Promise<any[]> {
  const files: any[] = [];
  let pageToken = '';

  do {
    const q = `'${parentId}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    url.searchParams.set('corpora', 'drive');
    url.searchParams.set('driveId', driveId);
    url.searchParams.set('fields', 'nextPageToken,files(id,name,size,mimeType)');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive children list failed: ${errText}`);
    }

    const data = await res.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return files;
}

async function listPortfolioDriveFolderFiles(
  accessToken: string,
  folderId: string,
  driveId: string | null,
): Promise<any[]> {
  const files: any[] = [];
  let pageToken = '';

  do {
    const q = `'${folderId}' in parents and trashed=false`;
    const url = new URL('https://www.googleapis.com/drive/v3/files');
    url.searchParams.set('q', q);
    url.searchParams.set('supportsAllDrives', 'true');
    url.searchParams.set('includeItemsFromAllDrives', 'true');
    if (driveId) {
      url.searchParams.set('corpora', 'drive');
      url.searchParams.set('driveId', driveId);
    } else {
      url.searchParams.set('corpora', 'allDrives');
    }
    url.searchParams.set('fields', 'nextPageToken,files(id,name,size,mimeType,createdTime,modifiedTime,thumbnailLink,webViewLink,parents,driveId)');
    url.searchParams.set('pageSize', '200');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Drive folder list failed: ${errText}`);
    }

    const data = await res.json();
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);

  return files;
}

async function calculateFolderUsage(
  accessToken: string,
  driveId: string,
  folderId: string,
): Promise<{ fileCount: number; totalSize: number }> {
  const children = await listDriveChildren(accessToken, driveId, folderId);
  let fileCount = 0;
  let totalSize = 0;

  for (const child of children) {
    if (child.mimeType === 'application/vnd.google-apps.folder') {
      const nested = await calculateFolderUsage(accessToken, driveId, child.id);
      fileCount += nested.fileCount;
      totalSize += nested.totalSize;
    } else {
      fileCount++;
      totalSize += Number(child.size || 0);
    }
  }

  return { fileCount, totalSize };
}

async function markDocumentFileSynced(
  supabase: any,
  documentFile: any,
  driveFile: any,
  folderId: string | null,
  metadataUpdate: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('document_files')
    .update({
      drive_file_id: driveFile.id,
      drive_folder_id: folderId,
      sync_status: 'synced',
      sync_error: null,
      synced_at: now,
      metadata: {
        ...getMetadataRecord(documentFile.metadata),
        ...metadataUpdate,
      },
    })
    .eq('id', documentFile.id);

  if (error) {
    throw new Error(`Document file update failed after Drive sync: ${error.message}`);
  }
}

async function markDocumentFileSyncFailed(
  supabase: any,
  documentFile: any,
  message: string
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('document_files')
    .update({
      sync_status: 'failed',
      sync_error: message,
      metadata: {
        ...getMetadataRecord(documentFile.metadata),
        last_sync_failed_at: now,
      },
    })
    .eq('id', documentFile.id);

  if (error) {
    console.error('Failed to record document sync failure:', error);
  }
}

async function copyDocumentFileToDrive(
  supabase: any,
  accessToken: string,
  sharedDriveId: string,
  documentFile: any
): Promise<any> {
  if (documentFile.drive_file_id) {
    if (documentFile.sync_status !== 'synced') {
      await markDocumentFileSynced(
        supabase,
        documentFile,
        { id: documentFile.drive_file_id, name: documentFile.file_name },
        documentFile.drive_folder_id,
        { marked_synced_at: new Date().toISOString() }
      );
    }

    return {
      success: true,
      skipped: true,
      reason: 'already_copied',
      documentFileId: documentFile.id,
      fileId: documentFile.drive_file_id,
      folderId: documentFile.drive_folder_id,
    };
  }

  if (documentFile.storage_provider !== 'supabase_storage') {
    throw new Error(`Only supabase_storage copy is supported for now. provider=${documentFile.storage_provider}`);
  }
  if (!documentFile.storage_bucket || !documentFile.storage_path) {
    throw new Error('Missing storage_bucket or storage_path');
  }
  if (!documentFile.drive_path) {
    throw new Error('Missing drive_path');
  }

  const folderId = await ensureFolderPath(
    accessToken,
    drivePathSegments(documentFile.drive_path),
    sharedDriveId,
    sharedDriveId
  );

  const existingFiles = await findDriveFilesByName(accessToken, folderId, documentFile.file_name, sharedDriveId);
  const expectedSize = Number(documentFile.file_size || 0);
  const reusableFile = existingFiles.find((file) => expectedSize > 0 && Number(file.size || 0) === expectedSize)
    || (existingFiles.length === 1 ? existingFiles[0] : null);

  if (reusableFile) {
    await markDocumentFileSynced(
      supabase,
      documentFile,
      reusableFile,
      folderId,
      {
        reused_existing_drive_file_at: new Date().toISOString(),
        reused_existing_drive_file_name: reusableFile.name,
      }
    );

    return {
      success: true,
      reused: true,
      documentFileId: documentFile.id,
      fileId: reusableFile.id,
      fileName: reusableFile.name,
      folderId,
      viewLink: `https://drive.google.com/file/d/${reusableFile.id}/view`,
    };
  }

  const { data: storageFile, error: downloadError } = await supabase.storage
    .from(documentFile.storage_bucket)
    .download(documentFile.storage_path);

  if (downloadError || !storageFile) {
    throw new Error(`Storage download failed: ${downloadError?.message || documentFile.storage_path}`);
  }

  const bytes = new Uint8Array(await storageFile.arrayBuffer());
  const result = await uploadBytes(
    accessToken,
    folderId,
    documentFile.file_name,
    bytes,
    documentFile.mime_type || storageFile.type || 'application/octet-stream'
  );

  await markDocumentFileSynced(
    supabase,
    documentFile,
    result,
    folderId,
    {
      copied_to_drive_at: new Date().toISOString(),
      copied_from_bucket: documentFile.storage_bucket,
      copied_from_path: documentFile.storage_path,
    }
  );

  return {
    success: true,
    documentFileId: documentFile.id,
    fileId: result.id,
    fileName: result.name,
    folderId,
    viewLink: `https://drive.google.com/file/d/${result.id}/view`,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const adminActions = new Set([
      'copy-document-file-to-drive',
      'sync-pending-document-files',
      'list-drive-usage',
      'delete-file',
      'bulk-import-portfolio-folder',
    ]);


    await requireFunctionAuth(
      req,
      adminActions.has(action) ? { allowedRoles: ['admin', 'moderator'] } : {},
    );

    const { serviceAccount, sharedDriveId } = getConfig();
    const accessToken = await getAccessToken(serviceAccount);

    if (action === 'upload-document') {
      // Existing: multipart upload for internal project docs (small files)
      const { projectName, documentType, fileName, fileBase64, contentType, year, month, folderPath } = body;
      const typeFolder = documentType === 'quote' ? '매입견적서' : '영수증';
      const targetFolderPath = Array.isArray(folderPath)
        ? folderPath
        : [projectName, typeFolder, `${year}년`, `${month}월`];
      const folderId = await ensureFolderPath(accessToken, targetFolderPath, sharedDriveId, sharedDriveId);
      const result = await uploadFile(accessToken, folderId, fileName, fileBase64, contentType || 'application/octet-stream');

      return new Response(JSON.stringify({ success: true, fileId: result.id, fileName: result.name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'copy-document-file-to-drive') {
      const { documentFileId } = body;
      if (!documentFileId) throw new Error('Missing documentFileId');

      const supabase = getSupabaseAdminClient();
      const { data: documentFile, error: documentError } = await supabase
        .from('document_files')
        .select('*')
        .eq('id', documentFileId)
        .single();

      if (documentError || !documentFile) {
        throw new Error(`Document file not found: ${documentError?.message || documentFileId}`);
      }

      try {
        const result = await copyDocumentFileToDrive(supabase, accessToken, sharedDriveId, documentFile);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (copyError) {
        const message = copyError instanceof Error ? copyError.message : 'Unknown Drive sync error';
        await markDocumentFileSyncFailed(supabase, documentFile, message);
        throw copyError;
      }
    }

    if (action === 'sync-pending-document-files') {
      const supabase = getSupabaseAdminClient();
      const limit = Math.min(Math.max(Number(body.limit || 20), 1), 50);
      const retryFailed = body.retryFailed === true;
      const statuses = retryFailed ? ['pending', 'failed'] : ['pending'];

      const { data: documentFiles, error: listError } = await supabase
        .from('document_files')
        .select('*')
        .in('sync_status', statuses)
        .eq('storage_provider', 'supabase_storage')
        .not('drive_path', 'is', null)
        .not('storage_bucket', 'is', null)
        .not('storage_path', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);

      if (listError) {
        throw new Error(`Document files query failed: ${listError.message}`);
      }

      const results: Record<string, unknown>[] = [];
      let synced = 0;
      let reused = 0;
      let skipped = 0;
      let failed = 0;

      for (const documentFile of (documentFiles || [])) {
        try {
          const result = await copyDocumentFileToDrive(supabase, accessToken, sharedDriveId, documentFile);
          results.push(result);
          if (result.skipped) skipped++;
          else if (result.reused) reused++;
          else synced++;
        } catch (syncError) {
          const message = syncError instanceof Error ? syncError.message : 'Unknown Drive sync error';
          await markDocumentFileSyncFailed(supabase, documentFile, message);
          failed++;
          results.push({
            success: false,
            documentFileId: documentFile.id,
            fileName: documentFile.file_name,
            error: message,
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        requestedLimit: limit,
        processed: results.length,
        synced,
        reused,
        skipped,
        failed,
        retryFailed,
        results,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-drive-usage') {
      const folders: { name: string; fileCount: number; totalSize: number }[] = [];
      const topLevelItems = await listDriveChildren(accessToken, sharedDriveId, sharedDriveId);
      const topFolders = topLevelItems.filter((item) => item.mimeType === 'application/vnd.google-apps.folder');
      let totalFiles = 0;
      let totalSize = 0;

      for (const folder of topFolders) {
        const usage = await calculateFolderUsage(accessToken, sharedDriveId, folder.id);
        folders.push({ name: folder.name, fileCount: usage.fileCount, totalSize: usage.totalSize });
        totalFiles += usage.fileCount;
        totalSize += usage.totalSize;
      }

      const rootFiles = topLevelItems.filter((item) => item.mimeType !== 'application/vnd.google-apps.folder');
      if (rootFiles.length > 0) {
        const rootSize = rootFiles.reduce((sum, file) => sum + Number(file.size || 0), 0);
        folders.push({ name: '(공유 드라이브 루트)', fileCount: rootFiles.length, totalSize: rootSize });
        totalFiles += rootFiles.length;
        totalSize += rootSize;
      }

      return new Response(JSON.stringify({ 
        success: true, 
        folders: folders.sort((a, b) => b.totalSize - a.totalSize),
        totalFiles,
        totalSize 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'init-resumable-upload') {
      // New: create folder + init resumable upload session, return upload URI
      const { folderPath, fileName, contentType, fileSize } = body;
      if (!folderPath || !Array.isArray(folderPath) || !fileName) {
        throw new Error('Missing folderPath, fileName');
      }
      const folderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      const uploadUri = await initResumableUpload(
        accessToken, folderId, fileName, contentType || 'application/octet-stream', fileSize || 0
      );

      return new Response(JSON.stringify({ success: true, uploadUri, folderId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'upload-portfolio-image') {
      const { fileName, fileBase64, contentType } = body;
      if (!fileName || !fileBase64) {
        throw new Error('Missing fileName or fileBase64');
      }
      const folderPath = getPortfolioFolderPath(body);
      const folderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      const result = await uploadFile(accessToken, folderId, fileName, fileBase64, contentType || 'image/png');

      return new Response(JSON.stringify({
        success: true,
        fileId: result.id,
        fileName: result.name,
        folderId,
        drivePath: folderPath.join('/'),
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'copy-portfolio-drive-files') {
      const sourceFolderId = extractDriveFileId(body.sourceFolderId || body.sourceFolderUrl);
      const files = Array.isArray(body.files) ? body.files.slice(0, 20) : [];
      if (!sourceFolderId) throw new Error('Missing sourceFolderId');
      if (files.length === 0) throw new Error('Missing files');

      const folderPath = getPortfolioFolderPath(body);
      const targetFolderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      const copiedFiles: Record<string, unknown>[] = [];
      const failures: Record<string, string>[] = [];

      for (const item of files) {
        const sourceFileId = extractDriveFileId(item?.id || item?.fileId);
        const requestedName = String(item?.name || 'Drive 이미지');
        if (!sourceFileId) {
          failures.push({ sourceFileId: '', fileName: requestedName, error: 'Drive 파일 ID가 없습니다.' });
          continue;
        }

        try {
          const sourceFile = await assertFileInFolder(accessToken, sourceFileId, sourceFolderId);
          if (!sourceFile) throw new Error('Drive 파일을 찾을 수 없습니다.');
          if (!String(sourceFile.mimeType || '').startsWith('image/')) {
            throw new Error('이미지 파일만 복제할 수 있습니다.');
          }

          const copied = await copyDriveFile(
            accessToken,
            sourceFileId,
            targetFolderId,
            makePortfolioCopyFileName(sourceFile),
          );

          copiedFiles.push({
            sourceFileId,
            fileId: copied.id,
            fileName: copied.name || sourceFile.name || requestedName,
            folderId: targetFolderId,
            drivePath: folderPath.join('/'),
            mimeType: copied.mimeType || sourceFile.mimeType || 'image/jpeg',
            fileSize: Number(copied.size || sourceFile.size || 0),
          });
        } catch (copyError) {
          failures.push({
            sourceFileId,
            fileName: requestedName,
            error: copyError instanceof Error ? copyError.message : 'Drive 복제 실패',
          });
        }
      }

      return new Response(JSON.stringify({
        success: true,
        folderId: targetFolderId,
        drivePath: folderPath.join('/'),
        copiedFiles,
        failures,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-portfolio-drive-folder') {
      const folderId = extractDriveFileId(body.folderId || body.folderUrl);
      const serviceAccountEmail = serviceAccount.client_email || null;
      if (!folderId) {
        throw new Error('Drive 폴더 URL 또는 폴더 ID를 확인해주세요.');
      }

      try {
        const folder = await getDriveFileMetadata(
          accessToken,
          folderId,
          'id,name,mimeType,trashed,driveId,webViewLink',
        );

        if (!folder || folder.trashed || folder.mimeType !== 'application/vnd.google-apps.folder') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Drive 폴더에 접근할 수 없습니다. 서비스 계정에 폴더 공유가 필요합니다.',
            serviceAccountEmail,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const children = await listPortfolioDriveFolderFiles(accessToken, folder.id, folder.driveId || null);
        const imageFiles = children
          .filter((file: any) => typeof file.mimeType === 'string' && file.mimeType.startsWith('image/'))
          .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || ''), 'ko', { numeric: true }))
          .map((file: any) => ({
            id: file.id,
            name: file.name || 'Drive 이미지',
            mimeType: file.mimeType || 'application/octet-stream',
            size: Number(file.size || 0),
            createdTime: file.createdTime || null,
            modifiedTime: file.modifiedTime || null,
            thumbnailUrl: file.thumbnailLink || null,
            webViewLink: file.webViewLink || driveFileViewLink(file.id),
          }));
        const unsupportedCount = children.filter((file: any) => (
          file.mimeType !== 'application/vnd.google-apps.folder'
          && !(typeof file.mimeType === 'string' && file.mimeType.startsWith('image/'))
        )).length;

        return new Response(JSON.stringify({
          success: true,
          folder: {
            id: folder.id,
            name: folder.name || 'Drive 폴더',
            webViewLink: folder.webViewLink || null,
          },
          files: imageFiles,
          unsupportedCount,
          serviceAccountEmail,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } catch (folderError) {
        const detail = folderError instanceof Error ? folderError.message : String(folderError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Drive 폴더에 접근할 수 없습니다. 서비스 계정에 폴더 공유가 필요합니다.',
          detail,
          serviceAccountEmail,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'get-portfolio-drive-thumbnail') {
      const { fileId, folderId } = body;
      if (!fileId) throw new Error('Missing fileId');

      if (folderId) {
        await assertFileInFolder(accessToken, fileId, folderId);
      }

      const file = await getDriveFileMetadata(
        accessToken,
        fileId,
        'id,name,mimeType,size,parents,trashed,thumbnailLink',
      );
      if (!file || file.trashed) throw new Error('Drive 파일을 찾을 수 없습니다.');

      if (file.thumbnailLink) {
        const thumbnailUrl = String(file.thumbnailLink).replace(/=s\d+$/, '=s600');
        const thumbnailRes = await fetch(thumbnailUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (thumbnailRes.ok) {
          const contentType = thumbnailRes.headers.get('Content-Type') || 'image/jpeg';
          return new Response(thumbnailRes.body, {
            headers: {
              ...corsHeaders,
              'Content-Type': contentType,
              'X-Thumbnail-Mime-Type': contentType,
              'Cache-Control': 'private, max-age=300',
            },
          });
        }
      }

      const media = await getDriveFileMedia(accessToken, fileId);
      return new Response(media.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': media.contentType,
          'X-Thumbnail-Mime-Type': media.contentType,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    if (action === 'get-portfolio-image') {
      const { fileId, folderId } = body;
      if (!fileId) throw new Error('Missing fileId');

      if (folderId) {
        await assertFileInFolder(accessToken, fileId, folderId);
      }

      const media = await getDriveFileMedia(accessToken, fileId);
      return new Response(media.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/octet-stream',
          'X-Image-Mime-Type': media.contentType,
          'Cache-Control': 'private, max-age=300',
          'X-Drive-File-Name': encodeURIComponent(media.file.name || 'portfolio-image'),
        },
      });
    }

    if (action === 'delete-portfolio-file') {
      const { fileId, folderId, folderPath } = body;
      if (!fileId) throw new Error('Missing fileId');
      const targetFolderId = folderId || await ensureFolderPath(
        accessToken,
        Array.isArray(folderPath) ? folderPath : ['포트폴리오'],
        sharedDriveId,
        sharedDriveId,
      );
      const file = await assertFileInFolder(accessToken, fileId, targetFolderId);
      if (file) await deleteDriveFile(accessToken, fileId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-folder-files') {
      // List image files from a folder path in shared drive
      const { folderPath } = body;
      if (!folderPath || !Array.isArray(folderPath)) {
        throw new Error('Missing folderPath array');
      }

      // Navigate to folder, creating if needed
      let folderId: string;
      try {
        folderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      } catch {
        return new Response(JSON.stringify({ success: true, files: [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const filesQ = `'${folderId}' in parents and trashed=false and (mimeType contains 'image/')`;
      const filesRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQ)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${sharedDriveId}&fields=files(id,name,mimeType,size,createdTime,thumbnailLink,webContentLink)&pageSize=200&orderBy=createdTime desc`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const filesData = await filesRes.json();

      const files = (filesData.files || []).map((f: any) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: parseInt(f.size || '0'),
        createdTime: f.createdTime,
        thumbnailLink: f.thumbnailLink,
        // Build a direct view link
        viewLink: `https://drive.google.com/file/d/${f.id}/view`,
        // Proxy thumbnail through Drive API for auth
        imageUrl: `https://www.googleapis.com/drive/v3/files/${f.id}?alt=media&supportsAllDrives=true`,
      }));

      // Do not expose the Drive OAuth access token to the browser.
      const filesWithAuth = files.map((f: any) => ({
        ...f,
        authImageUrl: f.thumbnailLink || f.viewLink,
        authThumbnail: f.thumbnailLink || null,
      }));

      return new Response(JSON.stringify({ success: true, files: filesWithAuth }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'bulk-import-portfolio-folder') {
      const rootFolderId = extractDriveFileId(body.rootFolderId || body.folderId);
      if (!rootFolderId) throw new Error('Missing rootFolderId');
      const maxImagesPerPost = Math.min(Number(body.maxImagesPerPost || 20), 20);
      const pilot = !!body.pilot;
      const createdBy = String(body.createdBy || 'bulk-import');
      const dryRun = !!body.dryRun;

      const supabaseAdmin = getSupabaseAdminClient();
      const driveIdForList = sharedDriveId;

      const root = await getDriveFileMetadata(accessToken, rootFolderId, 'id,name,mimeType,driveId,trashed');
      if (!root || root.trashed || root.mimeType !== 'application/vnd.google-apps.folder') {
        throw new Error('Root Drive 폴더에 접근할 수 없습니다.');
      }
      const sourceDriveId = root.driveId || driveIdForList;

      const categorizeByName = (name: string): string => {
        const n = String(name || '');
        if (/사인물|사인|디스플레이|signage/i.test(n)) return '사인/디스플레이';
        if (/쇼룸|아트월|인테리어|interior/i.test(n)) return '인테리어';
        if (/오브제|작품|집기|빅더미|제작|가공/i.test(n)) return '제작가공';
        return '기타';
      };
      const isDupName = (name: string): boolean => /복사본|사본|copy|\s\(\d+\)/i.test(name);
      const isImage = (mime?: string | null): boolean => !!mime && String(mime).startsWith('image/');
      const isHeic = (mime?: string | null, name?: string | null): boolean => {
        const m = String(mime || '').toLowerCase();
        const n = String(name || '').toLowerCase();
        return m === 'image/heic' || m === 'image/heif' || /\.(heic|heif)$/i.test(n);
      };

      // List root children
      const rootChildren = await listPortfolioDriveFolderFiles(accessToken, root.id, sourceDriveId);
      const subfolders = rootChildren.filter((c: any) => c.mimeType === 'application/vnd.google-apps.folder');
      const directImages = rootChildren.filter((c: any) => isImage(c.mimeType) && !isDupName(c.name));

      type Project = { title: string; folderId: string; files: any[]; category: string };
      const projects: Project[] = [];

      for (const sub of subfolders) {
        const children = await listPortfolioDriveFolderFiles(accessToken, sub.id, sourceDriveId);
        const images = children
          .filter((c: any) => isImage(c.mimeType) && !isDupName(c.name))
          .sort((a: any, b: any) =>
            String(b.modifiedTime || b.createdTime || '').localeCompare(String(a.modifiedTime || a.createdTime || '')))
          .slice(0, maxImagesPerPost);
        projects.push({
          title: sanitizeDriveFolderName(sub.name),
          folderId: sub.id,
          files: images,
          category: categorizeByName(sub.name),
        });
      }

      if (directImages.length > 0) {
        projects.push({
          title: sanitizeDriveFolderName(root.name),
          folderId: root.id,
          files: directImages
            .sort((a: any, b: any) =>
              String(b.modifiedTime || b.createdTime || '').localeCompare(String(a.modifiedTime || a.createdTime || '')))
            .slice(0, maxImagesPerPost),
          category: categorizeByName(root.name),
        });
      }

      // Pilot mode: pick exactly 1 JPG + 1 HEIC across all projects
      if (pilot) {
        const jpgPick: { project: Project; file: any } | null = (() => {
          for (const p of projects) {
            const f = p.files.find((x: any) => /image\/jpe?g/i.test(x.mimeType) && !isHeic(x.mimeType, x.name));
            if (f) return { project: p, file: f };
          }
          return null;
        })();
        const heicPick: { project: Project; file: any } | null = (() => {
          for (const p of projects) {
            const f = p.files.find((x: any) => isHeic(x.mimeType, x.name));
            if (f) return { project: p, file: f };
          }
          return null;
        })();
        const picks = new Map<string, Project>();
        const addPick = (sel: { project: Project; file: any } | null) => {
          if (!sel) return;
          const existing = picks.get(sel.project.title);
          if (existing) {
            existing.files = [...existing.files, sel.file];
          } else {
            picks.set(sel.project.title, { ...sel.project, files: [sel.file] });
          }
        };
        addPick(jpgPick);
        addPick(heicPick);
        projects.length = 0;
        projects.push(...picks.values());
      }

      const report: any = {
        rootFolder: { id: root.id, name: root.name },
        projects: [],
        postsCreated: 0,
        postsUpdated: 0,
        imagesInserted: 0,
        skipped: [] as Array<{ project: string; file: string; reason: string }>,
        failures: [] as Array<{ project: string; file?: string; error: string }>,
      };

      if (dryRun) {
        report.projects = projects.map(p => ({
          title: p.title, category: p.category, imageCount: p.files.length,
          files: p.files.map((f: any) => ({ name: f.name, mimeType: f.mimeType, size: f.size })),
        }));
        return new Response(JSON.stringify({ success: true, dryRun: true, ...report }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const targetDriveId = sharedDriveId;

      for (const project of projects) {
        try {
          // Find existing post by title
          const { data: existing } = await supabaseAdmin
            .from('portfolio_posts')
            .select('id, keywords')
            .eq('title', project.title)
            .maybeSingle();

          let postId: string;
          let isNewPost = false;
          if (existing?.id) {
            postId = existing.id as string;
            report.postsUpdated++;
            // Ensure category keyword exists
            const kws: string[] = Array.isArray(existing.keywords) ? existing.keywords as string[] : [];
            if (!kws.includes(project.category)) {
              await supabaseAdmin.from('portfolio_posts').update({
                keywords: Array.from(new Set([...kws, project.category])),
              }).eq('id', postId);
            }
          } else {
            const { data: inserted, error: insertErr } = await supabaseAdmin
              .from('portfolio_posts')
              .insert({ title: project.title, keywords: [project.category], created_by: createdBy })
              .select('id')
              .single();
            if (insertErr) throw insertErr;
            postId = (inserted as any).id;
            isNewPost = true;
            report.postsCreated++;
          }

          // Existing images: dedupe by file_name
          const { data: existingImgs } = await supabaseAdmin
            .from('portfolio_images')
            .select('file_name, display_order')
            .eq('post_id', postId);
          const existingNames = new Set<string>((existingImgs || []).map((r: any) => String(r.file_name).toLowerCase()));
          let nextOrder = (existingImgs && existingImgs.length > 0)
            ? Math.max(...existingImgs.map((r: any) => Number(r.display_order || 0))) + 1
            : 0;

          // Ensure managed Drive folder
          const folderPath = [...PORTFOLIO_DRIVE_ROOT, project.category, sanitizeDriveFolderName(project.title)];
          const targetFolderId = await ensureFolderPath(accessToken, folderPath, targetDriveId, targetDriveId);

          const projReport = { title: project.title, category: project.category, inserted: 0, skipped: 0, failed: 0 };

          for (const file of project.files) {
            const fname = String(file.name || '');
            try {
              if (existingNames.has(fname.toLowerCase())) {
                report.skipped.push({ project: project.title, file: fname, reason: 'duplicate_in_post' });
                projReport.skipped++;
                continue;
              }

              // Copy original to managed Drive (preserve original in source per spec)
              const copied = await copyDriveFile(accessToken, file.id, targetFolderId, makePortfolioCopyFileName(file));

              // Thumbnail: download Drive thumbnail (JPEG) of the copied file at s=600
              // Use source file thumbnail since it's already generated by Drive
              const thumbMeta = await getDriveFileMetadata(accessToken, file.id, 'id,thumbnailLink,name');
              let thumbBuf: Uint8Array | null = null;
              const tlink = thumbMeta?.thumbnailLink ? String(thumbMeta.thumbnailLink).replace(/=s\d+$/, '=s600') : null;
              if (tlink) {
                const tres = await fetch(tlink, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (tres.ok) {
                  thumbBuf = new Uint8Array(await tres.arrayBuffer());
                }
              }
              // Fallback: for non-HEIC, download original as thumbnail proxy
              if (!thumbBuf && !isHeic(file.mimeType, fname)) {
                const tres = await fetch(
                  `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
                  { headers: { Authorization: `Bearer ${accessToken}` } },
                );
                if (tres.ok) thumbBuf = new Uint8Array(await tres.arrayBuffer());
              }
              if (!thumbBuf) {
                report.skipped.push({ project: project.title, file: fname, reason: 'no_thumbnail_available' });
                projReport.skipped++;
                // Best-effort: delete copy to avoid orphan
                await deleteDriveFile(accessToken, copied.id).catch(() => {});
                continue;
              }

              const thumbBucket = 'portfolio-thumbnails';
              const thumbPath = `${postId}/${nextOrder}-${crypto.randomUUID()}.jpg`;
              const { error: upErr } = await supabaseAdmin.storage
                .from(thumbBucket)
                .upload(thumbPath, thumbBuf, { contentType: 'image/jpeg', upsert: false });
              if (upErr) throw new Error(`thumbnail upload failed: ${upErr.message}`);

              const { error: imgErr } = await supabaseAdmin.from('portfolio_images').insert({
                post_id: postId,
                drive_file_id: copied.id,
                drive_folder_id: targetFolderId,
                drive_path: folderPath.join('/'),
                file_name: fname,
                thumbnail_url: null,
                image_url: null,
                thumbnail_bucket: thumbBucket,
                thumbnail_path: thumbPath,
                thumbnail_width: null,
                thumbnail_height: null,
                display_order: nextOrder,
                is_main: nextOrder === 0,
                file_size: Number(copied.size || file.size || 0),
                mime_type: copied.mimeType || file.mimeType || 'image/jpeg',
                storage_provider: 'google_drive',
                uploaded_by: createdBy,
                access_level: 'internal',
                delete_status: 'active',
              });
              if (imgErr) throw imgErr;

              existingNames.add(fname.toLowerCase());
              nextOrder++;
              report.imagesInserted++;
              projReport.inserted++;
            } catch (fileErr) {
              const msg = fileErr instanceof Error ? fileErr.message : String(fileErr);
              report.failures.push({ project: project.title, file: fname, error: msg });
              projReport.failed++;
            }
          }

          // If we just created a post but inserted 0 images, remove it
          if (isNewPost && projReport.inserted === 0) {
            await supabaseAdmin.from('portfolio_posts').delete().eq('id', postId);
            report.postsCreated--;
          }
          report.projects.push(projReport);
        } catch (projErr) {
          const msg = projErr instanceof Error ? projErr.message : String(projErr);
          report.failures.push({ project: project.title, error: msg });
        }
      }

      return new Response(JSON.stringify({ success: true, ...report }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete-file') {

      const { fileId } = body;
      if (!fileId) throw new Error('Missing fileId');
      await deleteDriveFile(accessToken, fileId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    if (isAuthResponse(error)) return withCors(error, corsHeaders);
    console.error('Google Drive error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
