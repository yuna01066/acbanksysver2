import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { isAuthResponse, requireFunctionAuth, withCors } from "../_shared/auth.ts";

type AuthContext = Awaited<ReturnType<typeof requireFunctionAuth>>;
type GcsAction = 'upload' | 'get-download-url' | 'delete';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-gcs-action, x-gcs-bucket, x-gcs-path, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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

  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k] || headers[Object.keys(headers).find(h => h.toLowerCase() === k)!]}`).join('\n') + '\n';
  const signedHeaders = signedHeaderKeys.join(';');

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

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    dateStamp,
    scope,
    canonicalRequestHash,
  ].join('\n');

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

function getCredentials() {
  const accessKey = Deno.env.get('GCS_HMAC_ACCESS_KEY');
  const secretKey = Deno.env.get('GCS_HMAC_SECRET_KEY');
  const projectId = Deno.env.get('GCS_PROJECT_ID');
  if (!accessKey || !secretKey) throw new Error('GCS_HMAC_ACCESS_KEY or GCS_HMAC_SECRET_KEY is not configured');
  if (!projectId) throw new Error('GCS_PROJECT_ID is not configured');
  return { accessKey, secretKey, projectId };
}

function getAllowedUserBucket() {
  return Deno.env.get('GCS_BUCKET') || 'acbank_sys2';
}

function jsonError(message: string, status = 403) {
  throw new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pathSegment(path: string, index: number) {
  return path.split('/').filter(Boolean)[index] || '';
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function hasPrivilegedRole(auth: AuthContext) {
  if (!auth.user) return false;
  const checks = await Promise.all([
    auth.supabaseAdmin.rpc('has_role', { _user_id: auth.user.id, _role: 'admin' }),
    auth.supabaseAdmin.rpc('has_role', { _user_id: auth.user.id, _role: 'moderator' }),
  ]);
  return checks.some(({ data }) => Boolean(data));
}

async function canAccessProject(auth: AuthContext, projectId: string) {
  if (!auth.user || !isUuid(projectId)) return false;
  const checks = await Promise.all([
    auth.supabaseAdmin.rpc('is_project_owner', { _project_id: projectId, _user_id: auth.user.id }),
    auth.supabaseAdmin.rpc('is_project_assigned', { _project_id: projectId, _user_id: auth.user.id }),
  ]);
  return checks.some(({ data }) => Boolean(data));
}

async function canAccessDocumentFile(auth: AuthContext, path: string) {
  if (!auth.user) return false;
  const { data, error } = await auth.supabaseAdmin
    .from('document_files')
    .select('uploaded_by, quote_id, project_id, recipient_id')
    .eq('storage_provider', 'gcs')
    .eq('storage_path', path)
    .limit(1);

  if (error || !data?.length) return false;
  const doc = data[0] as {
    uploaded_by?: string | null;
    quote_id?: string | null;
    project_id?: string | null;
    recipient_id?: string | null;
  };

  if (doc.uploaded_by === auth.user.id) return true;
  if (doc.project_id && await canAccessProject(auth, doc.project_id)) return true;

  if (doc.quote_id) {
    const { data: quote } = await auth.supabaseAdmin
      .from('saved_quotes')
      .select('user_id, issuer_id, assigned_to')
      .eq('id', doc.quote_id)
      .maybeSingle();
    if (
      quote
      && [quote.user_id, quote.issuer_id, quote.assigned_to].includes(auth.user.id)
    ) {
      return true;
    }
  }

  if (doc.recipient_id) {
    const { data: recipient } = await auth.supabaseAdmin
      .from('recipients')
      .select('user_id')
      .eq('id', doc.recipient_id)
      .maybeSingle();
    if (recipient?.user_id === auth.user.id) return true;
  }

  return false;
}

async function assertGcsAccess(auth: AuthContext, action: GcsAction, bucket: string, path: string) {
  if (!auth.user) jsonError('Authentication required', 401);

  const privileged = await hasPrivilegedRole(auth);
  if (privileged) return;

  if (bucket !== getAllowedUserBucket()) {
    jsonError('Forbidden bucket');
  }

  const userId = auth.user.id;

  if (action === 'upload') {
    if (
      path.startsWith(`recipient-documents/${userId}/`)
      || path.startsWith(`tax-documents/${userId}/`)
      || path.startsWith(`team-chat/${userId}/`)
      || path.startsWith(`project-updates/${userId}/`)
      || path.startsWith(`internal-project-docs/${userId}/`)
    ) {
      return;
    }
    jsonError('Forbidden upload path');
  }

  if (action === 'get-download-url' && path.startsWith('team-chat/')) {
    return;
  }

  if (
    path.startsWith(`recipient-documents/${userId}/`)
    || path.startsWith(`tax-documents/${userId}/`)
    || path.startsWith(`project-updates/${userId}/`)
    || path.startsWith(`internal-project-docs/${userId}/`)
  ) {
    return;
  }

  if (path.startsWith('project-updates/')) {
    const projectId = pathSegment(path, 2);
    if (await canAccessProject(auth, projectId)) return;
  }

  if (path.startsWith('internal-project-docs/')) {
    const maybeProjectId = pathSegment(path, 1);
    if (await canAccessProject(auth, maybeProjectId)) return;
  }

  if (await canAccessDocumentFile(auth, path)) return;

  jsonError('Forbidden path');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check if this is a binary upload via custom headers
    const headerAction = req.headers.get('x-gcs-action');
    if (headerAction === 'upload') {
      const auth = await requireFunctionAuth(req);
      const { accessKey, secretKey } = getCredentials();
      const bucket = req.headers.get('x-gcs-bucket');
      const path = decodeURIComponent(req.headers.get('x-gcs-path') || '');
      const contentType = req.headers.get('content-type') || 'application/octet-stream';

      if (!bucket || !path) throw new Error('bucket and path headers are required');
      if (path.startsWith('/') || path.includes('..')) throw new Error('Invalid path');
      await assertGcsAccess(auth, 'upload', bucket, path);

      // Read body as binary directly - no base64 overhead
      const binaryData = new Uint8Array(await req.arrayBuffer());

      const res = await gcsRequest('PUT', `/${bucket}/${path}`, accessKey, secretKey, binaryData, {
        'Content-Type': contentType,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed: ${text}`);
      }
      return new Response(JSON.stringify({ success: true, name: path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // JSON-based actions (non-upload)
    const { action, bucket, path, contentType, data: fileData, prefix } = await req.json();
    const adminActions = new Set(['list-buckets', 'create-bucket', 'list-files']);
    const auth = await requireFunctionAuth(req, adminActions.has(action) ? { allowedRoles: ['admin', 'moderator'] } : {});
    const { accessKey, secretKey, projectId } = getCredentials();
    if (typeof path === 'string' && (path.startsWith('/') || path.includes('..'))) {
      throw new Error('Invalid path');
    }
    if (typeof prefix === 'string' && (prefix.startsWith('/') || prefix.includes('..'))) {
      throw new Error('Invalid prefix');
    }

    switch (action) {
      case 'list-buckets': {
        const res = await gcsRequest('GET', '/', accessKey, secretKey);
        const text = await res.text();
        if (!res.ok) throw new Error(`List buckets failed: ${text}`);
        const bucketNames: string[] = [];
        const matches = text.matchAll(/<Name>([^<]+)<\/Name>/g);
        for (const match of matches) {
          bucketNames.push(match[1]);
        }
        return new Response(JSON.stringify({ items: bucketNames.map(name => ({ name })) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

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

      case 'list-files': {
        if (!bucket) throw new Error('bucket name is required');
        const params: Record<string, string> = { 'max-keys': '10000' };
        if (prefix) params['prefix'] = prefix;
        const res = await gcsRequest('GET', `/${bucket}`, accessKey, secretKey, null, {}, params);
        const text = await res.text();
        if (!res.ok) throw new Error(`List files failed: ${text}`);
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

      // Legacy base64 upload (kept for backward compatibility with small files)
      case 'upload': {
        if (!bucket || !path || !fileData) throw new Error('bucket, path, and data are required');
        await assertGcsAccess(auth, 'upload', bucket, path);
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

      case 'get-download-url': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        await assertGcsAccess(auth, 'get-download-url', bucket, path);
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

      case 'delete': {
        if (!bucket || !path) throw new Error('bucket and path are required');
        await assertGcsAccess(auth, 'delete', bucket, path);
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
    if (isAuthResponse(error)) return withCors(error, corsHeaders);
    console.error('GCS Storage error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
