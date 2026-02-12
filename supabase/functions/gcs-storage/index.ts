import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Base64url encode (no padding)
function base64urlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Create JWT for GCS authentication
async function createJWT(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/devstorage.full_control',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const encoder = new TextEncoder();
  const headerB64 = base64urlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(encoder.encode(JSON.stringify(payload)));
  const signInput = `${headerB64}.${payloadB64}`;

  // Import private key
  const pemContent = serviceAccount.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\n/g, '');
  const binaryKey = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));

  const key = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(signInput))
  );

  return `${signInput}.${base64urlEncode(signature)}`;
}

// Get access token from Google OAuth
async function getAccessToken(serviceAccount: { client_email: string; private_key: string }): Promise<string> {
  const jwt = await createJWT(serviceAccount);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceAccountKey = Deno.env.get('GCS_SERVICE_ACCOUNT_KEY');
    if (!serviceAccountKey) {
      throw new Error('GCS_SERVICE_ACCOUNT_KEY is not configured');
    }

    const projectId = Deno.env.get('GCS_PROJECT_ID');
    if (!projectId) {
      throw new Error('GCS_PROJECT_ID is not configured');
    }

    const serviceAccount = JSON.parse(serviceAccountKey);
    const accessToken = await getAccessToken(serviceAccount);
    const GCS_API = 'https://storage.googleapis.com';

    const { action, bucket, path, contentType, data: fileData, prefix } = await req.json();

    switch (action) {
      // 버킷 목록 조회
      case 'list-buckets': {
        const res = await fetch(`${GCS_API}/storage/v1/b?project=${projectId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await res.json();
        if (!res.ok) throw new Error(`List buckets failed: ${JSON.stringify(result)}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 버킷 생성
      case 'create-bucket': {
        if (!bucket) throw new Error('bucket name is required');
        const res = await fetch(`${GCS_API}/storage/v1/b?project=${projectId}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: bucket, location: 'ASIA-NORTHEAST3' }),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(`Create bucket failed: ${JSON.stringify(result)}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 목록 조회
      case 'list-files': {
        if (!bucket) throw new Error('bucket name is required');
        const params = new URLSearchParams();
        if (prefix) params.set('prefix', prefix);
        params.set('maxResults', '100');
        const res = await fetch(`${GCS_API}/storage/v1/b/${bucket}/o?${params}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await res.json();
        if (!res.ok) throw new Error(`List files failed: ${JSON.stringify(result)}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 업로드 (base64 데이터)
      case 'upload': {
        if (!bucket || !path || !fileData) throw new Error('bucket, path, and data are required');
        const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
        const encodedPath = encodeURIComponent(path);
        const res = await fetch(
          `${GCS_API}/upload/storage/v1/b/${bucket}/o?uploadType=media&name=${encodedPath}`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': contentType || 'application/octet-stream',
            },
            body: binaryData,
          }
        );
        const result = await res.json();
        if (!res.ok) throw new Error(`Upload failed: ${JSON.stringify(result)}`);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 서명된 다운로드 URL 생성
      case 'get-download-url': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        const encodedPath = encodeURIComponent(path);
        // 공개 URL을 반환 (authenticatedRead 또는 공개 버킷용)
        // 비공개 버킷의 경우 서명된 URL 사용
        const mediaUrl = `${GCS_API}/storage/v1/b/${bucket}/o/${encodedPath}?alt=media`;
        
        // 파일 메타데이터도 함께 반환
        const metaRes = await fetch(`${GCS_API}/storage/v1/b/${bucket}/o/${encodedPath}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const metadata = await metaRes.json();
        if (!metaRes.ok) throw new Error(`Get metadata failed: ${JSON.stringify(metadata)}`);

        return new Response(JSON.stringify({ 
          url: mediaUrl,
          metadata,
          authHeader: `Bearer ${accessToken}` 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 삭제
      case 'delete': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        const encodedPath = encodeURIComponent(path);
        const res = await fetch(`${GCS_API}/storage/v1/b/${bucket}/o/${encodedPath}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (res.status === 204 || res.ok) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const result = await res.json();
        throw new Error(`Delete failed: ${JSON.stringify(result)}`);
      }

      default:
        throw new Error(`Unknown action: ${action}. Supported: list-buckets, create-bucket, list-files, upload, get-download-url, delete`);
    }
  } catch (error) {
    console.error('GCS Storage error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
