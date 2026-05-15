import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.58.0";

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
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
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
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
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

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(supabaseUrl, serviceRoleKey);
}

function drivePathSegments(path: string): string[] {
  return path
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;
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

      if (documentFile.drive_file_id) {
        return new Response(JSON.stringify({
          success: true,
          skipped: true,
          reason: 'already_copied',
          fileId: documentFile.drive_file_id,
          folderId: documentFile.drive_folder_id,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
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

      const { data: storageFile, error: downloadError } = await supabase.storage
        .from(documentFile.storage_bucket)
        .download(documentFile.storage_path);

      if (downloadError || !storageFile) {
        throw new Error(`Storage download failed: ${downloadError?.message || documentFile.storage_path}`);
      }

      const bytes = new Uint8Array(await storageFile.arrayBuffer());
      const folderId = await ensureFolderPath(
        accessToken,
        drivePathSegments(documentFile.drive_path),
        sharedDriveId,
        sharedDriveId
      );
      const result = await uploadBytes(
        accessToken,
        folderId,
        documentFile.file_name,
        bytes,
        documentFile.mime_type || storageFile.type || 'application/octet-stream'
      );

      const currentMetadata = documentFile.metadata && typeof documentFile.metadata === 'object'
        ? documentFile.metadata
        : {};
      const { error: updateError } = await supabase
        .from('document_files')
        .update({
          drive_file_id: result.id,
          drive_folder_id: folderId,
          sync_status: 'synced',
          sync_error: null,
          synced_at: new Date().toISOString(),
          metadata: {
            ...currentMetadata,
            copied_to_drive_at: new Date().toISOString(),
            copied_from_bucket: documentFile.storage_bucket,
            copied_from_path: documentFile.storage_path,
          },
        })
        .eq('id', documentFileId);

      if (updateError) {
        throw new Error(`Document file update failed after Drive upload: ${updateError.message}`);
      }

      return new Response(JSON.stringify({
        success: true,
        fileId: result.id,
        fileName: result.name,
        folderId,
        viewLink: `https://drive.google.com/file/d/${result.id}/view`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list-drive-usage') {
      // List all folders and files in shared drive for usage stats
      const folders: { name: string; fileCount: number; totalSize: number }[] = [];
      
      // List top-level folders
      const topQ = `'${sharedDriveId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      const topRes = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(topQ)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${sharedDriveId}&fields=files(id,name)&pageSize=100`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const topData = await topRes.json();
      
      let totalFiles = 0;
      let totalSize = 0;
      
      for (const folder of (topData.files || [])) {
        // Count files in each top-level folder (recursive via q)
        const filesQ = `'${folder.id}' in parents and trashed=false`;
        const filesRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(filesQ)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${sharedDriveId}&fields=files(id,name,size,mimeType)&pageSize=1000`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const filesData = await filesRes.json();
        
        let folderFileCount = 0;
        let folderSize = 0;
        
        for (const f of (filesData.files || [])) {
          if (f.mimeType === 'application/vnd.google-apps.folder') {
            // Sub-folder: count its contents too
            const subQ = `'${f.id}' in parents and trashed=false`;
            const subRes = await fetch(
              `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(subQ)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${sharedDriveId}&fields=files(size)&pageSize=1000`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const subData = await subRes.json();
            for (const sf of (subData.files || [])) {
              folderFileCount++;
              folderSize += parseInt(sf.size || '0');
            }
          } else {
            folderFileCount++;
            folderSize += parseInt(f.size || '0');
          }
        }
        
        folders.push({ name: folder.name, fileCount: folderFileCount, totalSize: folderSize });
        totalFiles += folderFileCount;
        totalSize += folderSize;
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
      const { folderPath, fileName, fileBase64, contentType } = body;
      if (!folderPath || !Array.isArray(folderPath) || !fileName || !fileBase64) {
        throw new Error('Missing folderPath, fileName, or fileBase64');
      }
      const folderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      const result = await uploadFile(accessToken, folderId, fileName, fileBase64, contentType || 'image/png');

      // Make file publicly readable so thumbnail URLs work
      await fetch(`https://www.googleapis.com/drive/v3/files/${result.id}/permissions?supportsAllDrives=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      });

      return new Response(JSON.stringify({
        success: true,
        fileId: result.id,
        fileName: result.name,
      }), {
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

      // Also generate short-lived download URLs with access token for thumbnails
      const filesWithAuth = files.map((f: any) => ({
        ...f,
        authImageUrl: `${f.imageUrl}&access_token=${accessToken}`,
        authThumbnail: f.thumbnailLink ? `${f.thumbnailLink}` : null,
      }));

      return new Response(JSON.stringify({ success: true, files: filesWithAuth }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete-file') {
      const { fileId } = body;
      if (!fileId) throw new Error('Missing fileId');

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!res.ok && res.status !== 204 && res.status !== 404) {
        const errText = await res.text();
        throw new Error(`Delete failed: ${errText}`);
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Google Drive error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
