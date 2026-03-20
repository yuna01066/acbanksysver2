import { supabase } from '@/integrations/supabase/client';

interface GcsUploadResult {
  success: boolean;
  name: string;
  gcsPath: string;
}

const GCS_BUCKET = 'acbank_sys2';

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');
  return session.access_token;
}

async function callGcsFunction(body: Record<string, any>) {
  const token = await getAuthToken();

  const res = await supabase.functions.invoke('gcs-storage', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.error) throw new Error(res.error.message || 'GCS 요청 실패');
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export async function gcsUploadFile(
  file: File,
  pathPrefix: string,
): Promise<GcsUploadResult> {
  const token = await getAuthToken();

  const safeName = file.name
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ._\-]/g, '_')
    .replace(/_+/g, '_');
  const gcsPath = `${pathPrefix}/${Date.now()}_${safeName}`;

  // Send file as binary via FormData-like approach using custom headers
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const url = `https://${projectId}.supabase.co/functions/v1/gcs-storage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'apikey': anonKey,
      'x-gcs-action': 'upload',
      'x-gcs-bucket': GCS_BUCKET,
      'x-gcs-path': encodeURIComponent(gcsPath),
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`업로드 실패: ${errText}`);
  }

  return { success: true, name: file.name, gcsPath };
}

export async function gcsGetDownloadUrl(path: string): Promise<string> {
  const data = await callGcsFunction({
    action: 'get-download-url',
    bucket: GCS_BUCKET,
    path,
  });
  return data.url;
}

export async function gcsDeleteFile(path: string): Promise<void> {
  await callGcsFunction({
    action: 'delete',
    bucket: GCS_BUCKET,
    path,
  });
}

/**
 * Check if a URL/path is a GCS path (not a full URL).
 * GCS paths don't start with http.
 */
export function isGcsPath(urlOrPath: string): boolean {
  return !!urlOrPath && !urlOrPath.startsWith('http');
}

/**
 * Resolve a URL or GCS path to a downloadable URL.
 * If it's already a full URL, return it as-is.
 * If it's a GCS path, generate a signed URL.
 */
export async function resolveFileUrl(urlOrPath: string): Promise<string> {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http')) return urlOrPath;
  return gcsGetDownloadUrl(urlOrPath);
}
