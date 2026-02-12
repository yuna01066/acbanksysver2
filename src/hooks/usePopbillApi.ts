import { supabase } from '@/integrations/supabase/client';

async function callPopbill(action: string, params: Record<string, any> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('로그인이 필요합니다.');

  const res = await supabase.functions.invoke('popbill-api', {
    body: { action, ...params },
  });

  if (res.error) throw new Error(res.error.message);
  if (!res.data?.success) throw new Error(res.data?.error || 'API 호출 실패');
  return res.data.data;
}

export function usePopbillApi() {
  return {
    /** 토큰 확인 */
    getToken: () => callPopbill('getToken'),

    /** 즉시발행 */
    registIssue: (taxInvoice: any, memo?: string) =>
      callPopbill('registIssue', { taxInvoice, memo }),

    /** 임시저장 */
    register: (taxInvoice: any) =>
      callPopbill('register', { taxInvoice }),

    /** 발행 */
    issue: (mgtKeyType: string, mgtKey: string, memo?: string) =>
      callPopbill('issue', { mgtKeyType, mgtKey, memo }),

    /** 상태조회 */
    getInfo: (mgtKeyType: string, mgtKey: string) =>
      callPopbill('getInfo', { mgtKeyType, mgtKey }),

    /** 상세조회 */
    getDetailInfo: (mgtKeyType: string, mgtKey: string) =>
      callPopbill('getDetailInfo', { mgtKeyType, mgtKey }),

    /** 발행취소 */
    cancelIssue: (mgtKeyType: string, mgtKey: string, memo?: string) =>
      callPopbill('cancelIssue', { mgtKeyType, mgtKey, memo }),

    /** 이메일 재전송 */
    sendEmail: (mgtKeyType: string, mgtKey: string, receiverEmail: string) =>
      callPopbill('sendEmail', { mgtKeyType, mgtKey, receiverEmail }),

    /** 목록검색 */
    search: (params: {
      mgtKeyType: string;
      sDate: string;
      eDate: string;
      dType?: string;
      state?: string;
      taxType?: string;
      page?: number;
      perPage?: number;
    }) => callPopbill('search', params),

    /** 사업자등록상태 조회 */
    checkCorpNum: (checkCorpNum: string) =>
      callPopbill('checkCorpNum', { checkCorpNum }),

    /** 사업자등록상태 대량조회 */
    checkCorpNums: (corpNums: string[]) =>
      callPopbill('checkCorpNums', { corpNums }),

    /** 팝빌 URL 조회 */
    getPopbillURL: (togo: string) =>
      callPopbill('getPopbillURL', { togo }),

    /** 공동인증서 유효성 확인 */
    checkCertValidation: () =>
      callPopbill('checkCertValidation'),
  };
}
