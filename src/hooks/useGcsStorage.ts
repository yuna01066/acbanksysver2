import { supabase } from '@/integrations/supabase/client';

interface GcsUploadResult {
  success: boolean;
  name: string;
  gcsPath: string;
}

const GCS_BUCKET = 'acbank_sys2';

async function callGcsFunction(body: Record<string, any>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');

  const res = await supabase.functions.invoke('gcs-storage', {
    body,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (res.error) throw new Error(res.error.message || 'GCS 요청 실패');
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
}

export async function gcsUploadFile(
  file: File,
  pathPrefix: string,
): Promise<GcsUploadResult> {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const safeName = file.name
    .replace(/[^a-zA-Z0-9가-힣ㄱ-ㅎㅏ-ㅣ._\-]/g, '_')
    .replace(/_+/g, '_');
  const gcsPath = `${pathPrefix}/${Date.now()}_${safeName}`;

  await callGcsFunction({
    action: 'upload',
    bucket: GCS_BUCKET,
    path: gcsPath,
    contentType: file.type || 'application/octet-stream',
    data: base64,
  });

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
