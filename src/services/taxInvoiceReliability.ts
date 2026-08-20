export type TaxInvoiceOperation = 'issue' | 'cancel';

export type TaxInvoiceSyncStatus = 'synced' | 'pending' | 'required';

type TrackingRecord = { id: string };

interface TrackedIssueOptions<TResult> {
  managementKey: string;
  createTrackingRecord: () => Promise<TrackingRecord>;
  issueExternal: () => Promise<TResult>;
  markIssued: (result: TResult) => Promise<void>;
  markSyncRequired: (message: string, externalSucceeded: boolean) => Promise<void>;
}

interface TrackedCancellationOptions<TResult> {
  managementKey: string;
  markCancellationPending: () => Promise<void>;
  cancelExternal: () => Promise<TResult>;
  markCancelled: (result: TResult) => Promise<void>;
  markSyncRequired: (message: string, externalSucceeded: boolean) => Promise<void>;
}

export class TaxInvoiceSyncRequiredError extends Error {
  readonly operation: TaxInvoiceOperation;
  readonly managementKey: string;
  readonly externalSucceeded: boolean;

  constructor(
    operation: TaxInvoiceOperation,
    managementKey: string,
    externalSucceeded: boolean,
    cause: unknown,
  ) {
    const action = operation === 'issue' ? '발행' : '발행취소';
    const result = externalSucceeded ? '팝빌 처리는 완료됐지만' : '팝빌 처리 결과를 확정할 수 없어';
    super(`${action}: ${result} 내부 상태 동기화가 필요합니다. 관리번호 ${managementKey}`);
    (this as { cause?: unknown }).cause = cause;
    this.name = 'TaxInvoiceSyncRequiredError';
    this.operation = operation;
    this.managementKey = managementKey;
    this.externalSucceeded = externalSucceeded;
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 500);
  if (typeof error === 'string' && error) return error.slice(0, 500);
  return '알 수 없는 처리 오류';
}

async function bestEffortMarkSyncRequired(
  markSyncRequired: (message: string, externalSucceeded: boolean) => Promise<void>,
  error: unknown,
  externalSucceeded: boolean,
): Promise<void> {
  try {
    await markSyncRequired(errorMessage(error), externalSucceeded);
  } catch {
    // The durable pending marker written before the external call remains the
    // recovery signal when this secondary write also fails.
  }
}

export async function runTrackedTaxInvoiceIssue<TResult>({
  managementKey,
  createTrackingRecord,
  issueExternal,
  markIssued,
  markSyncRequired,
}: TrackedIssueOptions<TResult>): Promise<TResult> {
  // Never call Popbill until a durable row exists with this management key.
  await createTrackingRecord();

  let result: TResult;
  try {
    result = await issueExternal();
  } catch (error) {
    await bestEffortMarkSyncRequired(markSyncRequired, error, false);
    throw new TaxInvoiceSyncRequiredError('issue', managementKey, false, error);
  }

  try {
    await markIssued(result);
  } catch (error) {
    await bestEffortMarkSyncRequired(markSyncRequired, error, true);
    throw new TaxInvoiceSyncRequiredError('issue', managementKey, true, error);
  }

  return result;
}

export async function runTrackedTaxInvoiceCancellation<TResult>({
  managementKey,
  markCancellationPending,
  cancelExternal,
  markCancelled,
  markSyncRequired,
}: TrackedCancellationOptions<TResult>): Promise<TResult> {
  // Persist the pending cancellation first so a reload cannot expose another
  // cancel action while the external result is unknown.
  await markCancellationPending();

  let result: TResult;
  try {
    result = await cancelExternal();
  } catch (error) {
    await bestEffortMarkSyncRequired(markSyncRequired, error, false);
    throw new TaxInvoiceSyncRequiredError('cancel', managementKey, false, error);
  }

  try {
    await markCancelled(result);
  } catch (error) {
    await bestEffortMarkSyncRequired(markSyncRequired, error, true);
    throw new TaxInvoiceSyncRequiredError('cancel', managementKey, true, error);
  }

  return result;
}

export function createPopbillMgtKey(
  now = Date.now(),
  randomPart = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36),
): string {
  const timestamp = Math.max(0, Math.trunc(now)).toString(36).toUpperCase();
  const random = randomPart.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 8);
  return `LV-${timestamp}-${random || '00000000'}`.slice(0, 24);
}

const KNOWN_POPBILL_STATE_CODES = new Set([
  '100', '200', '300', '301', '302', '303', '304', '305', '400', '500', '600',
]);

export function isKnownPopbillStateCode(stateCode: string | number): boolean {
  return KNOWN_POPBILL_STATE_CODES.has(String(stateCode));
}

export function mapPopbillStateCode(stateCode: string | number, currentStatus: string): string {
  switch (String(stateCode)) {
    case '100':
    case '200':
      return 'draft';
    case '300':
      return 'issued';
    case '301':
    case '302':
    case '303':
      return 'sent_to_nts';
    case '304':
      return 'nts_accepted';
    case '305':
    case '400':
      return 'failed';
    case '500':
    case '600':
      return 'cancelled';
    default:
      return currentStatus;
  }
}

export function requiresTaxInvoiceSync(syncStatus: unknown): boolean {
  return syncStatus === 'pending' || syncStatus === 'required';
}

export function mergeTaxInvoiceRows<T extends { id: string; created_at?: string | null }>(
  filteredRows: readonly T[],
  unresolvedRows: readonly T[],
): T[] {
  const rowsById = new Map<string, T>();

  for (const row of filteredRows) rowsById.set(row.id, row);
  // The unfiltered recovery query is the authoritative copy when the same row
  // is also present in the month/status-filtered result.
  for (const row of unresolvedRows) rowsById.set(row.id, row);

  return [...rowsById.values()].sort((left, right) => {
    const leftCreatedAt = left.created_at ? Date.parse(left.created_at) : 0;
    const rightCreatedAt = right.created_at ? Date.parse(right.created_at) : 0;
    return (Number.isNaN(rightCreatedAt) ? 0 : rightCreatedAt)
      - (Number.isNaN(leftCreatedAt) ? 0 : leftCreatedAt);
  });
}
