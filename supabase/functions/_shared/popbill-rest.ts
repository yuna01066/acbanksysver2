export interface PopbillEnvironmentConfig {
  apiBaseUrl: string;
  serviceId: 'POPBILL_TEST' | 'POPBILL';
}

export interface PopbillRestRequest {
  method: 'GET' | 'POST';
  path: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
}

type PopbillMgtKeyType = 'SELL' | 'BUY' | 'TRUSTEE';

const POPBILL_ENVIRONMENTS: Readonly<Record<'test' | 'production', PopbillEnvironmentConfig>> = {
  test: {
    apiBaseUrl: 'https://popbill-test.linkhub.co.kr',
    serviceId: 'POPBILL_TEST',
  },
  production: {
    apiBaseUrl: 'https://popbill.linkhub.co.kr',
    serviceId: 'POPBILL',
  },
};

export function resolvePopbillEnvironment(value: unknown): PopbillEnvironmentConfig {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (normalized === 'test' || normalized === 'production') {
    return POPBILL_ENVIRONMENTS[normalized];
  }

  // Do not echo the supplied value: environment variables can be miswired to secrets.
  throw new Error('POPBILL_ENVIRONMENT must be explicitly set to test or production');
}

export function buildPopbillApiUrl(baseUrl: string, basePath: string, path: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const normalizedBasePath = basePath.replace(/^\/+|\/+$/g, '');
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  const resourceUrl = [normalizedBaseUrl, normalizedBasePath].filter(Boolean).join('/');
  if (!normalizedPath) return resourceUrl;
  return normalizedPath.startsWith('?')
    ? `${resourceUrl}${normalizedPath}`
    : `${resourceUrl}/${normalizedPath}`;
}

function requireMgtKeyType(value: unknown): PopbillMgtKeyType {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (normalized === 'SELL' || normalized === 'BUY' || normalized === 'TRUSTEE') {
    return normalized;
  }
  throw new Error('올바른 팝빌 문서번호 유형이 필요합니다.');
}

function requireMgtKey(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(normalized)) {
    throw new Error('팝빌 관리번호는 24자 이내의 영문, 숫자, -, _만 사용할 수 있습니다.');
  }
  return normalized;
}

function taxInvoicePath(mgtKeyType: unknown, mgtKey: unknown): string {
  return `${requireMgtKeyType(mgtKeyType)}/${requireMgtKey(mgtKey)}`;
}

export function createRegistIssueRequest(
  taxInvoice: unknown,
  memo?: unknown,
): PopbillRestRequest {
  if (!taxInvoice || typeof taxInvoice !== 'object' || Array.isArray(taxInvoice)) {
    throw new Error('발행할 세금계산서 정보가 필요합니다.');
  }

  const body: Record<string, unknown> = { ...(taxInvoice as Record<string, unknown>) };
  if (typeof memo === 'string' && memo.trim()) body.memo = memo.trim();

  return {
    method: 'POST',
    path: '',
    headers: { 'X-HTTP-Method-Override': 'ISSUE' },
    body,
  };
}

export function createGetInfoRequest(
  mgtKeyType: unknown,
  mgtKey: unknown,
): PopbillRestRequest {
  return {
    method: 'GET',
    path: taxInvoicePath(mgtKeyType, mgtKey),
  };
}

export function createCancelIssueRequest(
  mgtKeyType: unknown,
  mgtKey: unknown,
  memo?: unknown,
): PopbillRestRequest {
  const normalizedMemo = typeof memo === 'string' ? memo.trim() : '';
  return {
    method: 'POST',
    path: taxInvoicePath(mgtKeyType, mgtKey),
    headers: { 'X-HTTP-Method-Override': 'CANCELISSUE' },
    body: normalizedMemo ? { memo: normalizedMemo } : {},
  };
}

export function createSendEmailRequest(
  mgtKeyType: unknown,
  mgtKey: unknown,
  receiverEmail: unknown,
): PopbillRestRequest {
  const receiver = typeof receiverEmail === 'string' ? receiverEmail.trim() : '';
  if (!receiver) throw new Error('이메일 수신자 주소가 필요합니다.');

  return {
    method: 'POST',
    path: taxInvoicePath(mgtKeyType, mgtKey),
    headers: { 'X-HTTP-Method-Override': 'EMAIL' },
    body: { receiver },
  };
}
