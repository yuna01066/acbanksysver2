import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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
  return { serviceAccount: JSON.parse(serviceAccountKey), sharedDriveId };
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
      const { projectName, documentType, fileName, fileBase64, contentType, year, month } = body;
      const typeFolder = documentType === 'quote' ? '매입견적서' : '영수증';
      const folderPath = [projectName, typeFolder, `${year}년`, `${month}월`];
      const folderId = await ensureFolderPath(accessToken, folderPath, sharedDriveId, sharedDriveId);
      const result = await uploadFile(accessToken, folderId, fileName, fileBase64, contentType || 'application/octet-stream');

      return new Response(JSON.stringify({ success: true, fileId: result.id, fileName: result.name }), {
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

      return new Response(JSON.stringify({ success: true, uploadUri }), {
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
