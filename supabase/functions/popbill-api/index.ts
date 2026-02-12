import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.168.0/node/crypto.ts";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// 팝빌 API 서버 URL
const LINKHUB_AUTH_URL = "https://auth.linkhub.co.kr";
const POPBILL_TEST_URL = "https://popbill-test.linkhub.co.kr";
const POPBILL_PROD_URL = "https://popbill.linkhub.co.kr";

// 테스트 모드 여부 (나중에 환경변수로 전환 가능)
const IS_TEST = true;
const POPBILL_API_URL = IS_TEST ? POPBILL_TEST_URL : POPBILL_PROD_URL;

interface TokenResponse {
  session_token: string;
  serviceID: string;
  linkID: string;
  usercode: string;
  expiration: string;
}

let cachedToken: { token: string; expiration: Date } | null = null;

/**
 * 링크허브 인증 토큰 발급
 */
async function getToken(linkID: string, secretKey: string, corpNum: string): Promise<string> {
  // 캐시된 토큰이 유효한지 확인
  if (cachedToken && new Date() < cachedToken.expiration) {
    return cachedToken.token;
  }

  const scope = ["110"]; // 전자세금계산서 서비스 코드
  const postData = JSON.stringify({
    access_id: linkID,
    scope: scope,
  });

  const uri = `/POPBILL_TEST/Token`; // 테스트: POPBILL_TEST, 운영: POPBILL
  const target = IS_TEST ? "/POPBILL_TEST/Token" : "/POPBILL/Token";

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace("T", "")
    .substring(0, 14);

  // HMAC-SHA256 서명 생성
  const hmac = createHmac("sha256", Buffer.from(secretKey, "base64"));

  const signTarget = [
    "POST",
    base64Encode(new TextEncoder().encode(postData)),
    timestamp,
    "",
    target,
  ].join("\n");

  hmac.update(signTarget);
  const signature = hmac.digest("base64");

  const authHeader = `LINKHUB ${linkID} ${signature}`;

  const response = await fetch(`${LINKHUB_AUTH_URL}${target}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      "x-lh-date": timestamp,
      "x-lh-forwarded": "",
    },
    body: postData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Token request failed [${response.status}]: ${errorBody}`);
  }

  const tokenData: TokenResponse = await response.json();

  // 토큰 캐싱 (만료 1분 전까지 유효)
  const expiration = new Date(tokenData.expiration);
  expiration.setMinutes(expiration.getMinutes() - 1);
  cachedToken = { token: tokenData.session_token, expiration };

  return tokenData.session_token;
}

/**
 * 팝빌 API 호출 헬퍼
 */
async function callPopbillAPI(
  method: string,
  path: string,
  token: string,
  corpNum: string,
  body?: any,
  additionalHeaders?: Record<string, string>
): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    "x-pb-userid": "", // 팝빌 사용자 ID (필요시 설정)
    ...additionalHeaders,
  };

  const url = `${POPBILL_API_URL}/Taxinvoice/${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers,
  };

  if (body && (method === "POST" || method === "PATCH")) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);
  const responseBody = await response.text();

  if (!response.ok) {
    throw new Error(`Popbill API call failed [${response.status}]: ${responseBody}`);
  }

  try {
    return JSON.parse(responseBody);
  } catch {
    return responseBody;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // 환경변수 확인
    const POPBILL_LINK_ID = Deno.env.get("POPBILL_LINK_ID");
    if (!POPBILL_LINK_ID) {
      throw new Error("POPBILL_LINK_ID is not configured");
    }

    const POPBILL_SECRET_KEY = Deno.env.get("POPBILL_SECRET_KEY");
    if (!POPBILL_SECRET_KEY) {
      throw new Error("POPBILL_SECRET_KEY is not configured");
    }

    const POPBILL_CORP_NUM = Deno.env.get("POPBILL_CORP_NUM");
    if (!POPBILL_CORP_NUM) {
      throw new Error("POPBILL_CORP_NUM is not configured");
    }

    // 인증 확인
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
    if (claimsError || !claimsData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.user.id;

    // 요청 파싱
    const { action, ...params } = await req.json();

    // 팝빌 토큰 발급
    const token = await getToken(POPBILL_LINK_ID, POPBILL_SECRET_KEY, POPBILL_CORP_NUM);

    let result: any;

    switch (action) {
      case "getToken": {
        // 토큰 발급 확인 (테스트용)
        result = { success: true, message: "Token acquired successfully" };
        break;
      }

      case "registIssue": {
        // 세금계산서 즉시발행
        const { taxInvoice, memo } = params;
        result = await callPopbillAPI(
          "POST",
          `${POPBILL_CORP_NUM}?memo=${encodeURIComponent(memo || "")}`,
          token,
          POPBILL_CORP_NUM,
          taxInvoice,
          { "x-pb-message": "RegistIssue" }
        );
        break;
      }

      case "register": {
        // 세금계산서 임시저장
        const { taxInvoice: regTaxInvoice } = params;
        result = await callPopbillAPI(
          "POST",
          POPBILL_CORP_NUM,
          token,
          POPBILL_CORP_NUM,
          regTaxInvoice
        );
        break;
      }

      case "issue": {
        // 임시저장된 세금계산서 발행
        const { mgtKeyType, mgtKey, memo: issueMemo } = params;
        result = await callPopbillAPI(
          "PATCH",
          `${POPBILL_CORP_NUM}/${mgtKeyType}/${mgtKey}`,
          token,
          POPBILL_CORP_NUM,
          { memo: issueMemo },
          { "x-pb-message": "ISSUE" }
        );
        break;
      }

      case "getInfo": {
        // 세금계산서 상태/요약 조회
        const { mgtKeyType: infoMgtKeyType, mgtKey: infoMgtKey } = params;
        result = await callPopbillAPI(
          "GET",
          `${POPBILL_CORP_NUM}/${infoMgtKeyType}/${infoMgtKey}`,
          token,
          POPBILL_CORP_NUM
        );
        break;
      }

      case "getDetailInfo": {
        // 세금계산서 상세조회
        const { mgtKeyType: detailMgtKeyType, mgtKey: detailMgtKey } = params;
        result = await callPopbillAPI(
          "GET",
          `${POPBILL_CORP_NUM}/${detailMgtKeyType}/${detailMgtKey}?TG=DETAIL`,
          token,
          POPBILL_CORP_NUM
        );
        break;
      }

      case "cancelIssue": {
        // 세금계산서 발행취소
        const { mgtKeyType: cancelMgtKeyType, mgtKey: cancelMgtKey, memo: cancelMemo } = params;
        result = await callPopbillAPI(
          "PATCH",
          `${POPBILL_CORP_NUM}/${cancelMgtKeyType}/${cancelMgtKey}`,
          token,
          POPBILL_CORP_NUM,
          { memo: cancelMemo },
          { "x-pb-message": "CANCELISSUE" }
        );
        break;
      }

      case "sendEmail": {
        // 이메일 재전송
        const { mgtKeyType: emailMgtKeyType, mgtKey: emailMgtKey, receiverEmail } = params;
        result = await callPopbillAPI(
          "POST",
          `${POPBILL_CORP_NUM}/${emailMgtKeyType}/${emailMgtKey}/Email`,
          token,
          POPBILL_CORP_NUM,
          { receiverEmail }
        );
        break;
      }

      case "sendSMS": {
        // SMS 재전송
        const { mgtKeyType: smsMgtKeyType, mgtKey: smsMgtKey, senderNum, receiverNum } = params;
        result = await callPopbillAPI(
          "POST",
          `${POPBILL_CORP_NUM}/${smsMgtKeyType}/${smsMgtKey}/SMS`,
          token,
          POPBILL_CORP_NUM,
          { senderNum, receiverNum }
        );
        break;
      }

      case "sendFAX": {
        // FAX 재전송
        const { mgtKeyType: faxMgtKeyType, mgtKey: faxMgtKey, senderNum: faxSenderNum, receiverNum: faxReceiverNum } = params;
        result = await callPopbillAPI(
          "POST",
          `${POPBILL_CORP_NUM}/${faxMgtKeyType}/${faxMgtKey}/FAX`,
          token,
          POPBILL_CORP_NUM,
          { senderNum: faxSenderNum, receiverNum: faxReceiverNum }
        );
        break;
      }

      case "search": {
        // 세금계산서 목록조회
        const { mgtKeyType: searchMgtKeyType, dType, sDate, eDate, state, taxType: searchTaxType, page, perPage } = params;
        const queryParams = new URLSearchParams({
          DType: dType || "W",
          SDate: sDate,
          EDate: eDate,
          State: state || "",
          TaxType: searchTaxType || "",
          Page: String(page || 1),
          PerPage: String(perPage || 50),
        });
        result = await callPopbillAPI(
          "GET",
          `${POPBILL_CORP_NUM}/${searchMgtKeyType}?${queryParams.toString()}`,
          token,
          POPBILL_CORP_NUM
        );
        break;
      }

      case "getPopbillURL": {
        // 팝빌 관련 URL 조회 (인증서 등록, 세금계산서 작성 등)
        const { togo } = params;
        result = await callPopbillAPI(
          "GET",
          `${POPBILL_CORP_NUM}?TG=${togo}`,
          token,
          POPBILL_CORP_NUM
        );
        break;
      }

      case "checkCertValidation": {
        // 공동인증서 유효성 확인
        result = await callPopbillAPI(
          "GET",
          `${POPBILL_CORP_NUM}/Certificate`,
          token,
          POPBILL_CORP_NUM
        );
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Popbill API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
