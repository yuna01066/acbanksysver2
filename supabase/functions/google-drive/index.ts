import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
  token_uri: string;
}

// Create JWT for service account auth
async function createJWT(sa: ServiceAccountKey): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: sa.token_uri,
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: any) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unsignedToken = `${encode(header)}.${encode(claims)}`;

  // Import private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5', cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${unsignedToken}.${sig}`;
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const jwt = await createJWT(sa);
  const res = await fetch(sa.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Token exchange failed: ${err}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function driveApi(
  accessToken: string,
  path: string,
  method = 'GET',
  body?: any,
  isUpload = false,
  contentType?: string,
): Promise<any> {
  const baseUrl = isUpload
    ? 'https://www.googleapis.com/upload/drive/v3'
    : 'https://www.googleapis.com/drive/v3';

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${accessToken}`,
  };

  let fetchBody: any = undefined;
  if (body && !isUpload) {
    headers['Content-Type'] = 'application/json';
    fetchBody = JSON.stringify(body);
  } else if (body && isUpload) {
    headers['Content-Type'] = contentType || 'application/octet-stream';
    fetchBody = body;
  }

  const res = await fetch(`${baseUrl}${path}`, { method, headers, body: fetchBody });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Drive API error [${res.status}]: ${errText}`);
  }

  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

// Find or create a folder by name under a parent
async function findOrCreateFolder(
  accessToken: string,
  name: string,
  parentId: string,
  driveId: string,
): Promise<string> {
  // Search for existing folder
  const q = `name='${name}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const searchResult = await driveApi(
    accessToken,
    `/files?q=${encodeURIComponent(q)}&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=drive&driveId=${driveId}&fields=files(id,name)`,
  );

  if (searchResult.files?.length > 0) {
    return searchResult.files[0].id;
  }

  // Create folder
  const folder = await driveApi(accessToken, '/files?supportsAllDrives=true', 'POST', {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  });

  return folder.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const saKeyJson = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY');
    if (!saKeyJson) throw new Error('GCS_SERVICE_ACCOUNT_KEY is not configured');

    const sharedDriveId = Deno.env.get('GOOGLE_DRIVE_SHARED_DRIVE_ID');
    if (!sharedDriveId) throw new Error('GOOGLE_DRIVE_SHARED_DRIVE_ID is not configured');

    const sa: ServiceAccountKey = JSON.parse(saKeyJson);
    const accessToken = await getAccessToken(sa);

    const { action, projectName, documentType, fileName, fileBase64, contentType, year, month } = await req.json();

    switch (action) {
      // 프로젝트 폴더 구조 생성 및 파일 업로드
      case 'upload-document': {
        if (!projectName || !documentType || !fileName || !fileBase64) {
          throw new Error('projectName, documentType, fileName, fileBase64 are required');
        }

        // 1. 최상위: 프로젝트 폴더
        const projectFolderId = await findOrCreateFolder(accessToken, projectName, sharedDriveId, sharedDriveId);

        let targetFolderId: string;

        if (documentType === 'quote' || documentType === 'receipt') {
          // 2. 견적서/영수증: 년도 > 월별 폴더
          const folderName = documentType === 'quote' ? '매입 견적서' : '영수증';
          const typeFolderId = await findOrCreateFolder(accessToken, folderName, projectFolderId, sharedDriveId);

          const y = year || new Date().getFullYear().toString();
          const m = month || String(new Date().getMonth() + 1).padStart(2, '0');

          const yearFolderId = await findOrCreateFolder(accessToken, `${y}년`, typeFolderId, sharedDriveId);
          targetFolderId = await findOrCreateFolder(accessToken, `${m}월`, yearFolderId, sharedDriveId);
        } else {
          // 프로젝트 업데이트 파일
          const updatesFolderId = await findOrCreateFolder(accessToken, '프로젝트 업데이트', projectFolderId, sharedDriveId);
          targetFolderId = updatesFolderId;
        }

        // 3. 파일 업로드 (resumable upload for reliability)
        const binaryData = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));

        // Create file metadata
        const metadata = await driveApi(
          accessToken,
          `/files?uploadType=resumable&supportsAllDrives=true`,
          'POST',
          { name: fileName, parents: [targetFolderId] },
        );

        // Actually, use multipart upload for simplicity
        const boundary = '-------314159265358979323846';
        const metadataJson = JSON.stringify({ name: fileName, parents: [targetFolderId] });

        const multipartBody = new Uint8Array([
          ...new TextEncoder().encode(
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadataJson}\r\n--${boundary}\r\nContent-Type: ${contentType || 'application/octet-stream'}\r\n\r\n`
          ),
          ...binaryData,
          ...new TextEncoder().encode(`\r\n--${boundary}--`),
        ]);

        const uploadRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          },
        );

        if (!uploadRes.ok) {
          const errText = await uploadRes.text();
          throw new Error(`Upload failed: ${errText}`);
        }

        const uploadedFile = await uploadRes.json();

        return new Response(JSON.stringify({
          success: true,
          fileId: uploadedFile.id,
          fileName: uploadedFile.name,
          webViewLink: `https://drive.google.com/file/d/${uploadedFile.id}/view`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 프로젝트 폴더 구조만 생성
      case 'create-project-folders': {
        if (!projectName) throw new Error('projectName is required');

        const projectFolderId = await findOrCreateFolder(accessToken, projectName, sharedDriveId, sharedDriveId);
        await findOrCreateFolder(accessToken, '매입 견적서', projectFolderId, sharedDriveId);
        await findOrCreateFolder(accessToken, '영수증', projectFolderId, sharedDriveId);
        await findOrCreateFolder(accessToken, '프로젝트 업데이트', projectFolderId, sharedDriveId);

        return new Response(JSON.stringify({
          success: true,
          projectFolderId,
          driveLink: `https://drive.google.com/drive/folders/${projectFolderId}`,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Google Drive error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
