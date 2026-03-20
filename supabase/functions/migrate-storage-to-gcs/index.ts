import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GCS_BUCKET = 'acbank_sys2';

// ---- GCS signing helpers (same as gcs-storage) ----
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message)));
}
function toHex(data: Uint8Array): string {
  return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
}
async function sha256(data: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}

async function signAndUpload(
  bucket: string,
  path: string,
  body: Uint8Array,
  contentType: string,
  accessKey: string,
  secretKey: string,
) {
  const url = new URL(`https://storage.googleapis.com/${bucket}/${path}`);
  const now = new Date();
  const dateStamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const shortDate = dateStamp.substring(0, 8);
  const region = 'auto';
  const scope = `${shortDate}/${region}/s3/aws4_request`;

  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'host': 'storage.googleapis.com',
    'x-amz-date': dateStamp,
  };
  const payloadHash = await sha256(body);
  headers['x-amz-content-sha256'] = payloadHash;

  const signedHeaderKeys = Object.keys(headers).map(k => k.toLowerCase()).sort();
  const canonicalHeaders = signedHeaderKeys.map(k => `${k}:${headers[k]}`).join('\n') + '\n';
  const signedHeadersStr = signedHeaderKeys.join(';');

  const canonicalRequest = ['PUT', `/${bucket}/${path}`, '', canonicalHeaders, signedHeadersStr, payloadHash].join('\n');
  const canonicalRequestHash = await sha256(new TextEncoder().encode(canonicalRequest));
  const stringToSign = ['AWS4-HMAC-SHA256', dateStamp, scope, canonicalRequestHash].join('\n');

  const kDate = await hmacSha256(new TextEncoder().encode('AWS4' + secretKey), shortDate);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, 's3');
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

  const res = await fetch(url.toString(), { method: 'PUT', headers, body });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS upload failed: ${text}`);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accessKey = Deno.env.get('GCS_HMAC_ACCESS_KEY')!;
    const secretKey = Deno.env.get('GCS_HMAC_SECRET_KEY')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { buckets } = await req.json();
    // Default buckets to migrate
    const bucketsToMigrate = buckets || [
      'tax-documents',
      'incident-attachments',
      'recipient-documents',
      'team-chat-attachments',
      'internal-project-docs',
    ];

    const results: Record<string, { migrated: number; failed: number; errors: string[] }> = {};

    for (const bucketName of bucketsToMigrate) {
      results[bucketName] = { migrated: 0, failed: 0, errors: [] };

      // List all files in the bucket
      const { data: files, error: listError } = await supabase.storage
        .from(bucketName)
        .list('', { limit: 10000 });

      if (listError) {
        results[bucketName].errors.push(`List error: ${listError.message}`);
        continue;
      }

      // Recursively list files (handle folders)
      const allFiles: string[] = [];
      const listRecursive = async (prefix: string) => {
        const { data, error } = await supabase.storage.from(bucketName).list(prefix, { limit: 10000 });
        if (error || !data) return;
        for (const item of data) {
          const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
          if (item.id) {
            allFiles.push(fullPath);
          } else {
            await listRecursive(fullPath);
          }
        }
      };

      await listRecursive('');

      for (const filePath of allFiles) {
        try {
          // Download from Supabase storage
          const { data: fileData, error: downloadError } = await supabase.storage
            .from(bucketName)
            .download(filePath);

          if (downloadError || !fileData) {
            results[bucketName].errors.push(`Download ${filePath}: ${downloadError?.message}`);
            results[bucketName].failed++;
            continue;
          }

          // Determine GCS path
          const gcsPath = `${bucketName}/${filePath}`;
          const contentType = fileData.type || 'application/octet-stream';

          // Upload to GCS
          const bytes = new Uint8Array(await fileData.arrayBuffer());
          await signAndUpload(GCS_BUCKET, gcsPath, bytes, contentType, accessKey, secretKey);

          results[bucketName].migrated++;
        } catch (err) {
          results[bucketName].errors.push(`${filePath}: ${err instanceof Error ? err.message : 'unknown'}`);
          results[bucketName].failed++;
        }
      }
    }

    // Update DB references for migrated files
    // tax_documents: file_url was publicUrl, now gcsPath
    const { data: taxDocs } = await supabase.from('tax_documents').select('id, file_url');
    if (taxDocs) {
      for (const doc of taxDocs) {
        if (doc.file_url?.startsWith('http')) {
          // Extract path from public URL
          const match = doc.file_url.match(/tax-documents\/(.+)$/);
          if (match) {
            const gcsPath = `tax-documents/${match[1]}`;
            await supabase.from('tax_documents').update({ file_url: gcsPath }).eq('id', doc.id);
          }
        }
      }
    }

    // internal_project_documents: file_url was storage path
    const { data: internalDocs } = await supabase.from('internal_project_documents').select('id, file_url');
    if (internalDocs) {
      for (const doc of internalDocs) {
        if (doc.file_url && !doc.file_url.startsWith('internal-project')) {
          const gcsPath = `internal-project-docs/${doc.file_url}`;
          await supabase.from('internal_project_documents').update({ file_url: gcsPath }).eq('id', doc.id);
        }
      }
    }

    // recipients: business_document_url was storage path
    const { data: recipients } = await supabase.from('recipients').select('id, business_document_url');
    if (recipients) {
      for (const r of recipients as any[]) {
        if (r.business_document_url && !r.business_document_url.startsWith('recipient-documents/') && !r.business_document_url.startsWith('http')) {
          const gcsPath = `recipient-documents/${r.business_document_url}`;
          await supabase.from('recipients').update({ business_document_url: gcsPath } as any).eq('id', r.id);
        }
      }
    }

    // team_messages attachments: url was public URL, now gcsPath
    const { data: messages } = await supabase.from('team_messages').select('id, attachments');
    if (messages) {
      for (const msg of messages) {
        if (msg.attachments && Array.isArray(msg.attachments)) {
          let changed = false;
          const updated = (msg.attachments as any[]).map((att: any) => {
            if (att.url?.includes('team-chat-attachments')) {
              const match = att.url.match(/team-chat-attachments\/(.+)$/);
              if (match) {
                changed = true;
                return { ...att, url: `team-chat/${match[1]}` };
              }
            }
            return att;
          });
          if (changed) {
            await supabase.from('team_messages').update({ attachments: updated }).eq('id', msg.id);
          }
        }
      }
    }

    // incident_reports attachments: path was supabase storage path
    const { data: incidents } = await supabase.from('incident_reports').select('id, attachments');
    if (incidents) {
      for (const inc of incidents) {
        if (inc.attachments && Array.isArray(inc.attachments)) {
          let changed = false;
          const updated = (inc.attachments as any[]).map((att: any) => {
            if (att.path && !att.path.startsWith('incident-attachments/')) {
              changed = true;
              return { ...att, path: `incident-attachments/${att.path}` };
            }
            return att;
          });
          if (changed) {
            await supabase.from('incident_reports').update({ attachments: updated } as any).eq('id', inc.id);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});