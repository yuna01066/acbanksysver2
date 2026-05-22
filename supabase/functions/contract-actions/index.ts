import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

type SupabaseAdminClient = ReturnType<typeof createClient>;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ContractAction = 'opened' | 'signed' | 'rejected' | 'downloaded';

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function firstIp(req: Request) {
  return (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '')
    .split(',')[0]
    .trim() || null;
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  return sha256Bytes(bytes);
}

async function sha256Bytes(bytes: Uint8Array | ArrayBuffer) {
  const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function inferMime(path: string, blobType?: string) {
  if (blobType) return blobType;
  if (path.toLowerCase().endsWith('.pdf')) return 'application/pdf';
  if (path.toLowerCase().endsWith('.png')) return 'image/png';
  if (path.toLowerCase().endsWith('.jpg') || path.toLowerCase().endsWith('.jpeg')) return 'image/jpeg';
  if (path.toLowerCase().endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

async function validateStoredObject(
  supabaseAdmin: SupabaseAdminClient,
  path: string,
  expectedPrefix: string,
  options: { label: string; maxBytes: number; mime: string | string[] },
) {
  if (!path.startsWith(expectedPrefix)) {
    throw new Error(`${options.label} 파일 경로가 계약 소유자와 일치하지 않습니다.`);
  }

  const { data, error } = await supabaseAdmin.storage
    .from('employee-contracts')
    .download(path);
  if (error || !data) {
    throw new Error(`${options.label} 파일을 스토리지에서 찾을 수 없습니다.`);
  }

  const mime = inferMime(path, data.type);
  const allowed = Array.isArray(options.mime) ? options.mime : [options.mime];
  const mimeOk = allowed.some((item) => item.endsWith('/') ? mime.startsWith(item) : mime === item);
  if (!mimeOk) {
    throw new Error(`${options.label} 파일 형식이 올바르지 않습니다.`);
  }
  if (data.size <= 0 || data.size > options.maxBytes) {
    throw new Error(`${options.label} 파일 크기가 허용 범위를 벗어났습니다.`);
  }

  const bytes = await data.arrayBuffer();
  return {
    mime,
    size: data.size,
    sha256: await sha256Bytes(bytes),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const action = body.action as ContractAction;
    const contractId = body.contractId as string | undefined;
    if (!contractId || !['opened', 'signed', 'rejected', 'downloaded'].includes(action)) {
      return json({ error: 'Invalid contract action.' }, 400);
    }

    const { data: contract, error: contractError } = await supabaseAdmin
      .from('employment_contracts')
      .select('*')
      .eq('id', contractId)
      .single();

    if (contractError || !contract) return json({ error: '계약서를 찾을 수 없습니다.' }, 404);

    const [{ data: isAdmin }, { data: isModerator }] = await Promise.all([
      supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
      supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'moderator' }),
    ]);
    const isOwner = contract.user_id === user.id;
    if (!isOwner && !isAdmin && !isModerator) return json({ error: 'Forbidden' }, 403);

    const eventBase = {
      contract_id: contractId,
      actor_id: user.id,
      actor_role: isAdmin ? 'admin' : isModerator ? 'moderator' : 'employee',
      ip_address: firstIp(req),
      user_agent: req.headers.get('user-agent'),
    };

    if (action === 'opened') {
      if (!contract.opened_at || contract.status === 'requested') {
        await supabaseAdmin
          .from('employment_contracts')
          .update({
            opened_at: contract.opened_at || new Date().toISOString(),
            status: contract.status === 'requested' ? 'opened' : contract.status,
          })
          .eq('id', contractId);
      }
      await supabaseAdmin.from('contract_events').insert({
        ...eventBase,
        event_type: 'opened',
        metadata: {},
      });
      return json({ success: true });
    }

    if (action === 'downloaded') {
      await supabaseAdmin.from('contract_events').insert({
        ...eventBase,
        event_type: 'downloaded',
        metadata: { signed_pdf_storage_path: contract.signed_pdf_storage_path || null },
      });
      return json({ success: true });
    }

    if (!isOwner) return json({ error: '직원 본인만 서명 또는 거절할 수 있습니다.' }, 403);
    if (!['requested', 'opened'].includes(contract.status)) {
      return json({ error: '서명 대기 상태의 계약서만 처리할 수 있습니다.' }, 409);
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (action === 'rejected') {
      const reason = String(body.reason || '').trim();
      if (reason.length < 5) {
        return json({ error: '거절 사유를 5자 이상 입력해주세요.' }, 400);
      }
      const rejectedAt = new Date().toISOString();
      const { error } = await supabaseAdmin
        .from('employment_contracts')
        .update({
          status: 'rejected',
          rejected_at: rejectedAt,
          rejected_reason: reason || null,
          notes: reason || '거절됨',
        })
        .eq('id', contractId)
        .eq('user_id', user.id);
      if (error) throw error;

      await supabaseAdmin.from('contract_events').insert({
        ...eventBase,
        event_type: 'rejected',
        metadata: { reason },
      });

      if (contract.requested_by) {
        await supabaseAdmin.from('notifications').insert({
          user_id: contract.requested_by,
          type: 'contract_rejected',
          title: '계약서 거절',
          description: `${profile?.full_name || contract.user_name}님이 계약서를 거절했습니다.${reason ? ` 사유: ${reason}` : ''}`,
          data: { contract_id: contractId, user_id: user.id },
        });
      }

      return json({ success: true });
    }

    const signedByName = String(body.signedByName || '').trim();
    const expectedName = String(profile?.full_name || contract.user_name || '').trim();
    if (!signedByName || signedByName !== expectedName) {
      return json({ error: '서명자 이름이 프로필 이름과 일치하지 않습니다.' }, 400);
    }

    const signatureStoragePath = String(body.signatureStoragePath || '').trim();
    const signedPdfStoragePath = String(body.signedPdfStoragePath || '').trim();
    if (!signatureStoragePath || !signedPdfStoragePath) {
      return json({ error: '서명 이미지와 최종 PDF 파일이 필요합니다.' }, 400);
    }
    const expectedFilePrefix = `${user.id}/${contractId}/`;
    if (!signatureStoragePath.startsWith(expectedFilePrefix) || !signedPdfStoragePath.startsWith(expectedFilePrefix)) {
      return json({ error: '파일 경로가 서명자 및 계약서와 일치하지 않습니다.' }, 400);
    }

    const [signatureFile, pdfFile] = await Promise.all([
      validateStoredObject(supabaseAdmin, signatureStoragePath, expectedFilePrefix, {
        label: '서명 이미지',
        mime: 'image/',
        maxBytes: 2 * 1024 * 1024,
      }),
      validateStoredObject(supabaseAdmin, signedPdfStoragePath, expectedFilePrefix, {
        label: '최종 PDF',
        mime: 'application/pdf',
        maxBytes: 15 * 1024 * 1024,
      }),
    ]);

    const signedRenderedHtml = String(body.signedRenderedHtml || contract.rendered_html || '');
    if (!signedRenderedHtml.trim()) {
      return json({ error: '서명 완료 HTML 스냅샷이 필요합니다.' }, 400);
    }

    const signedAt = new Date().toISOString();
    const contentHash = await sha256Hex([
      signedRenderedHtml,
      signatureFile.sha256,
      pdfFile.sha256,
    ].join('\n'));

    const { error: updateError } = await supabaseAdmin
      .from('employment_contracts')
      .update({
        status: 'signed',
        signed_at: signedAt,
        signed_by_name: signedByName,
        signature_storage_path: signatureStoragePath,
        signed_pdf_storage_path: signedPdfStoragePath,
        signed_rendered_html: signedRenderedHtml,
        content_sha256: contentHash,
      })
      .eq('id', contractId)
      .eq('user_id', user.id);
    if (updateError) throw updateError;

    const { data: documentFile } = await supabaseAdmin
      .from('document_files')
      .insert({
        owner_type: 'employee',
        document_type: 'employee_contract_pdf',
        file_name: `${contract.user_name || signedByName}_전자계약서.pdf`,
        storage_provider: 'supabase_storage',
        storage_bucket: 'employee-contracts',
        storage_path: signedPdfStoragePath,
        mime_type: pdfFile.mime,
        file_size: pdfFile.size,
        metadata: {
          contract_id: contractId,
          user_id: user.id,
          content_sha256: contentHash,
          pdf_sha256: pdfFile.sha256,
          signature_sha256: signatureFile.sha256,
        },
        uploaded_by: user.id,
      })
      .select('id')
      .single();

    if (documentFile?.id) {
      await supabaseAdmin
        .from('employment_contracts')
        .update({ signed_pdf_document_file_id: documentFile.id })
        .eq('id', contractId);
    }

    await supabaseAdmin.from('contract_events').insert({
      ...eventBase,
      event_type: 'signed',
      metadata: {
        signed_by_name: signedByName,
        signature_storage_path: signatureStoragePath,
        signed_pdf_storage_path: signedPdfStoragePath,
        content_sha256: contentHash,
        signature_sha256: signatureFile.sha256,
        pdf_sha256: pdfFile.sha256,
      },
    });

    if (contract.requested_by) {
      await supabaseAdmin.from('notifications').insert({
        user_id: contract.requested_by,
        type: 'contract_signed',
        title: '계약서 서명 완료',
        description: `${signedByName}님이 계약서에 서명했습니다.`,
        data: { contract_id: contractId, user_id: user.id },
      });
    }

    return json({ success: true, content_sha256: contentHash });
  } catch (error) {
    console.error('contract-actions error:', error);
    return json({ error: error instanceof Error ? error.message : '계약 처리 중 오류가 발생했습니다.' }, 500);
  }
});
