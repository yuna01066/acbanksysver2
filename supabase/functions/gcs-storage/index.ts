import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// HMAC-SHA256 signing helper
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

function toHex(data: Uint8Array): string {
  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(hash));
}

// AWS Signature V4 for GCS S3-compatible API
async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: Uint8Array | null,
  accessKey: string,
  secretKey: string,
  region: string = 'auto'
): Promise<Record<string, string>> {
  const parsedUrl = new URL(url);
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const shortDate = dateStamp.substring(0, 8);
  const service = 's3';
  const scope = `${shortDate}/${region}/${service}/aws4_request`;

  headers['x-amz-date'] = dateStamp;
  headers['host'] = parsedUrl.host;

  const payloadHash = body ? await sha256(body) : await sha256(new Uint8Array(0));
  headers['x-amz-content-sha256'] = payloadHash;

  // Canonical headers
  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k] || headers[Object.keys(headers).find(h => h.toLowerCase() === k)!]}`).join('\n') + '\n';
  const signedHeaders = signedHeaderKeys.join(';');

  // Canonical request
  const canonicalQuery = parsedUrl.searchParams.toString();
  const canonicalRequest = [
    method,
    parsedUrl.pathname,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));

  // String to sign
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    canonicalRequestHash,
  ].join('\n');

  // Signing key
  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), shortDate);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');

  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return headers;
}

async function gcsRequest(
  method: string,
  path: string,
  accessKey: string,
  secretKey: string,
  body: Uint8Array | null = null,
  extraHeaders: Record<string, string> = {},
  queryParams: Record<string, string> = {}
): Promise<Response> {
  const baseUrl = 'https://storage.googleapis.com';
  const url = new URL(path, baseUrl);
  Object.entries(queryParams).forEach(([k, v]) => url.searchParams.set(k, v));

  const headers: Record<string, string> = { ...extraHeaders };
  await signRequest(method, url.toString(), headers, body, accessKey, secretKey);

  return fetch(url.toString(), { method, headers, body });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get('GCS_HMAC_ACCESS_KEY');
    const secretKey = Deno.env.get('GCS_HMAC_SECRET_KEY');
    const projectId = Deno.env.get('GCS_PROJECT_ID');

    if (!accessKey || !secretKey) {
      throw new Error('GCS_HMAC_ACCESS_KEY or GCS_HMAC_SECRET_KEY is not configured');
    }
    if (!projectId) {
      throw new Error('GCS_PROJECT_ID is not configured');
    }

    const { action, bucket, path, contentType, data: fileData, prefix } = await req.json();

    switch (action) {
      // 버킷 목록 조회
      case 'list-buckets': {
        const res = await gcsRequest('GET', '/', accessKey, secretKey);
        const text = await res.text();
        if (!res.ok) throw new Error(`List buckets failed: ${text}`);
        // Parse XML response to JSON-like format
        const bucketNames: string[] = [];
        const matches = text.matchAll(/<Name>([^<]+)<\/Name>/g);
        for (const match of matches) {
          bucketNames.push(match[1]);
        }
        return new Response(JSON.stringify({ items: bucketNames.map(name => ({ name })) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 버킷 생성
      case 'create-bucket': {
        if (!bucket) throw new Error('bucket name is required');
        const xmlBody = `<CreateBucketConfiguration><LocationConstraint>ASIA-NORTHEAST3</LocationConstraint></CreateBucketConfiguration>`;
        const bodyBytes = new TextEncoder().encode(xmlBody);
        const res = await gcsRequest('PUT', `/${bucket}`, accessKey, secretKey, bodyBytes, {
          'Content-Type': 'application/xml',
          'x-goog-project-id': projectId,
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Create bucket failed: ${text}`);
        }
        return new Response(JSON.stringify({ name: bucket, success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 목록 조회
      case 'list-files': {
        if (!bucket) throw new Error('bucket name is required');
        const params: Record<string, string> = { 'max-keys': '10000' };
        if (prefix) params['prefix'] = prefix;
        const res = await gcsRequest('GET', `/${bucket}`, accessKey, secretKey, null, {}, params);
        const text = await res.text();
        if (!res.ok) throw new Error(`List files failed: ${text}`);
        // Parse XML
        const items: { name: string; size: string; lastModified: string }[] = [];
        const keyMatches = text.matchAll(/<Key>([^<]+)<\/Key>/g);
        const sizeMatches = text.matchAll(/<Size>([^<]+)<\/Size>/g);
        const dateMatches = text.matchAll(/<LastModified>([^<]+)<\/LastModified>/g);
        const keys = [...keyMatches].map(m => m[1]);
        const sizes = [...sizeMatches].map(m => m[1]);
        const dates = [...dateMatches].map(m => m[1]);
        keys.forEach((key, i) => {
          items.push({ name: key, size: sizes[i] || '0', lastModified: dates[i] || '' });
        });
        return new Response(JSON.stringify({ items }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 업로드
      case 'upload': {
        if (!bucket || !path || !fileData) throw new Error('bucket, path, and data are required');
        const binaryData = Uint8Array.from(atob(fileData), c => c.charCodeAt(0));
        const res = await gcsRequest('PUT', `/${bucket}/${path}`, accessKey, secretKey, binaryData, {
          'Content-Type': contentType || 'application/octet-stream',
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Upload failed: ${text}`);
        }
        return new Response(JSON.stringify({ success: true, name: path }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 다운로드 URL 생성
      case 'get-download-url': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        // Generate a pre-signed URL (valid for 1 hour)
        const now = new Date();
        const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const shortDate = dateStamp.substring(0, 8);
        const scope = `${shortDate}/auto/s3/aws4_request`;
        const expires = '3600';

        const url = new URL(`https://storage.googleapis.com/${bucket}/${path}`);
        url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
        url.searchParams.set('X-Amz-Credential', `${accessKey}/${scope}`);
        url.searchParams.set('X-Amz-Date', dateStamp);
        url.searchParams.set('X-Amz-Expires', expires);
        url.searchParams.set('X-Amz-SignedHeaders', 'host');

        const canonicalRequest = [
          'GET',
          `/${bucket}/${path}`,
          url.searchParams.toString(),
          `host:storage.googleapis.com\n`,
          'host',
          'UNSIGNED-PAYLOAD',
        ].join('\n');

        const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));
        const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, canonicalRequestHash].join('\n');

        const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), shortDate);
        const kRegion = await hmacSha256(kDate, 'auto');
        const kService = await hmacSha256(kRegion, 's3');
        const kSigning = await hmacSha256(kService, 'aws4_request');
        const signature = toHex(await hmacSha256(kSigning, stringToSign));

        url.searchParams.set('X-Amz-Signature', signature);

        return new Response(JSON.stringify({ url: url.toString() }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 파일 삭제
      case 'delete': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        const res = await gcsRequest('DELETE', `/${bucket}/${path}`, accessKey, secretKey);
        if (res.status === 204 || res.ok) {
          return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const text = await res.text();
        throw new Error(`Delete failed: ${text}`);
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
