import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { action, requestId, email, full_name, phone } = await req.json();

    // === Action: submit (unauthenticated) ===
    if (action === 'submit') {
      if (!email || !full_name || !phone) {
        return new Response(
          JSON.stringify({ error: '모든 필드를 입력해주세요.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Password reset request for:', email);

      // Verify against profiles table using service role (bypasses RLS)
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (profileError || !profile) {
        console.log('Profile not found for email:', email);
        return new Response(
          JSON.stringify({ error: '일치하는 사용자 정보를 찾을 수 없습니다.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify name and phone match
      if (profile.full_name !== full_name.trim()) {
        console.log('Name mismatch:', profile.full_name, 'vs', full_name);
        return new Response(
          JSON.stringify({ error: '일치하는 사용자 정보를 찾을 수 없습니다.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile.phone !== phone.trim()) {
        console.log('Phone mismatch:', profile.phone, 'vs', phone);
        return new Response(
          JSON.stringify({ error: '일치하는 사용자 정보를 찾을 수 없습니다.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check for existing pending request
      const { data: existing } = await supabaseAdmin
        .from('password_reset_requests')
        .select('id')
        .eq('user_id', profile.id)
        .eq('status', 'pending');

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: '이미 비밀번호 초기화 요청이 진행 중입니다. 관리자의 승인을 기다려주세요.' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Create reset request
      const { error: insertError } = await supabaseAdmin
        .from('password_reset_requests')
        .insert({
          user_id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          phone: profile.phone || phone,
          status: 'pending'
        });

      if (insertError) {
        console.error('Insert error:', insertError);
        return new Response(
          JSON.stringify({ error: '요청 처리 중 오류가 발생했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Reset request created for user:', profile.id);
      return new Response(
        JSON.stringify({ success: true, message: '비밀번호 초기화 요청이 접수되었습니다.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Action: approve (admin only) ===
    if (action === 'approve') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!requestId) {
        return new Response(
          JSON.stringify({ error: 'requestId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the request
      const { data: resetReq, error: reqError } = await supabaseAdmin
        .from('password_reset_requests')
        .select('*')
        .eq('id', requestId)
        .single();

      if (reqError || !resetReq) {
        return new Response(
          JSON.stringify({ error: '요청을 찾을 수 없습니다.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Reset password to 1234
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        resetReq.user_id,
        { password: '1234' }
      );

      if (updateError) {
        console.error('Password reset error:', updateError);
        return new Response(
          JSON.stringify({ error: '비밀번호 초기화에 실패했습니다.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update request status
      await supabaseAdmin
        .from('password_reset_requests')
        .update({
          status: 'approved',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id
        })
        .eq('id', requestId);

      console.log('Password reset approved for user:', resetReq.user_id);
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === Action: reject (admin only) ===
    if (action === 'reject') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: isAdmin } = await supabaseAdmin.rpc('has_role', { _user_id: user.id, _role: 'admin' });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabaseAdmin
        .from('password_reset_requests')
        .update({
          status: 'rejected',
          resolved_at: new Date().toISOString(),
          resolved_by: user.id
        })
        .eq('id', requestId);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
