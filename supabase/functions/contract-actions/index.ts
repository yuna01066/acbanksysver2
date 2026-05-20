import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

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
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
      if (!contract.opened_at) {
        await supabaseAdmin
          .from('employment_contracts')
          .update({ opened_at: new Date().toISOString() })
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
    if (contract.status !== 'requested') {
      return json({ error: '서명 대기 상태의 계약서만 처리할 수 있습니다.' }, 409);
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (action === 'rejected') {
      const reason = String(body.reason || '').trim();
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
    if (!signatureStoragePath.startsWith(`${user.id}/`) || !signedPdfStoragePath.startsWith(`${user.id}/`)) {
      return json({ error: '파일 경로가 서명자와 일치하지 않습니다.' }, 400);
    }

    const signedAt = new Date().toISOString();
    const contentHash = await sha256Hex([
      contract.rendered_html || '',
      signedByName,
      signatureStoragePath,
      signedPdfStoragePath,
      signedAt,
    ].join('\n'));

    const { error: updateError } = await supabaseAdmin
      .from('employment_contracts')
      .update({
        status: 'signed',
        signed_at: signedAt,
        signed_by_name: signedByName,
        signature_storage_path: signatureStoragePath,
        signed_pdf_storage_path: signedPdfStoragePath,
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
        mime_type: 'application/pdf',
        metadata: {
          contract_id: contractId,
          user_id: user.id,
          content_sha256: contentHash,
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
