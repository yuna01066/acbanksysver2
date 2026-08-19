import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  TaxInvoiceSyncRequiredError,
  createPopbillMgtKey,
  isKnownPopbillStateCode,
  mapPopbillStateCode,
  mergeTaxInvoiceRows,
  runTrackedTaxInvoiceCancellation,
  runTrackedTaxInvoiceIssue,
} from '../src/services/taxInvoiceReliability';
import { normalizePhoneNumber } from '../supabase/functions/_shared/phone.ts';
import {
  buildPopbillApiUrl,
  createCancelIssueRequest,
  createGetInfoRequest,
  createRegistIssueRequest,
  createSendEmailRequest,
  resolvePopbillEnvironment,
} from '../supabase/functions/_shared/popbill-rest.ts';

const issueCallOrder: string[] = [];
const issueResult = await runTrackedTaxInvoiceIssue({
  managementKey: 'LV-ISSUE-1',
  createTrackingRecord: async () => {
    issueCallOrder.push('create');
    return { id: 'invoice-1' };
  },
  issueExternal: async () => {
    issueCallOrder.push('external');
    return { ntsConfirmNum: 'NTS-1' };
  },
  markIssued: async () => {
    issueCallOrder.push('issued');
  },
  markSyncRequired: async () => {
    issueCallOrder.push('required');
  },
});
assert.deepEqual(issueCallOrder, ['create', 'external', 'issued']);
assert.equal(issueResult.ntsConfirmNum, 'NTS-1');

let externalIssueCalls = 0;
await assert.rejects(
  runTrackedTaxInvoiceIssue({
    managementKey: 'LV-ISSUE-2',
    createTrackingRecord: async () => {
      throw new Error('tracking insert failed');
    },
    issueExternal: async () => {
      externalIssueCalls += 1;
      return {};
    },
    markIssued: async () => undefined,
    markSyncRequired: async () => undefined,
  }),
  /tracking insert failed/,
);
assert.equal(externalIssueCalls, 0, 'Popbill must not be called before durable tracking exists');

const recoveryCalls: string[] = [];
await assert.rejects(
  runTrackedTaxInvoiceIssue({
    managementKey: 'LV-ISSUE-3',
    createTrackingRecord: async () => ({ id: 'invoice-3' }),
    issueExternal: async () => ({ ntsConfirmNum: 'NTS-3' }),
    markIssued: async () => {
      throw new Error('database unavailable');
    },
    markSyncRequired: async (message) => {
      assert.match(message, /database unavailable/);
      recoveryCalls.push('required');
    },
  }),
  (error: unknown) => {
    assert.ok(error instanceof TaxInvoiceSyncRequiredError);
    assert.equal(error.operation, 'issue');
    assert.equal(error.managementKey, 'LV-ISSUE-3');
    assert.equal(error.externalSucceeded, true);
    return true;
  },
);
assert.deepEqual(recoveryCalls, ['required']);

let externalCancelCalls = 0;
await assert.rejects(
  runTrackedTaxInvoiceCancellation({
    managementKey: 'LV-CANCEL-1',
    markCancellationPending: async () => {
      throw new Error('pending update failed');
    },
    cancelExternal: async () => {
      externalCancelCalls += 1;
    },
    markCancelled: async () => undefined,
    markSyncRequired: async () => undefined,
  }),
  /pending update failed/,
);
assert.equal(externalCancelCalls, 0, 'Popbill cancellation must wait for durable pending state');

const cancelRecoveryCalls: string[] = [];
await assert.rejects(
  runTrackedTaxInvoiceCancellation({
    managementKey: 'LV-CANCEL-2',
    markCancellationPending: async () => undefined,
    cancelExternal: async () => ({ code: 1 }),
    markCancelled: async () => {
      throw new Error('cancel state update failed');
    },
    markSyncRequired: async (message) => {
      assert.match(message, /cancel state update failed/);
      cancelRecoveryCalls.push('required');
    },
  }),
  (error: unknown) => {
    assert.ok(error instanceof TaxInvoiceSyncRequiredError);
    assert.equal(error.operation, 'cancel');
    assert.equal(error.externalSucceeded, true);
    return true;
  },
);
assert.deepEqual(cancelRecoveryCalls, ['required']);

assert.equal(mapPopbillStateCode('100', 'issued'), 'draft');
assert.equal(mapPopbillStateCode('300', 'draft'), 'issued');
assert.equal(mapPopbillStateCode('301', 'issued'), 'sent_to_nts');
assert.equal(mapPopbillStateCode('302', 'issued'), 'sent_to_nts');
assert.equal(mapPopbillStateCode('303', 'issued'), 'sent_to_nts');
assert.equal(mapPopbillStateCode('304', 'issued'), 'nts_accepted');
assert.equal(mapPopbillStateCode('305', 'issued'), 'failed');
assert.equal(mapPopbillStateCode('600', 'issued'), 'cancelled');
assert.equal(mapPopbillStateCode('999', 'issued'), 'issued');
assert.equal(isKnownPopbillStateCode('304'), true);
assert.equal(isKnownPopbillStateCode('600'), true);
assert.equal(isKnownPopbillStateCode('999'), false);

const mergedRows = mergeTaxInvoiceRows(
  [
    { id: 'visible-1', created_at: '2026-08-03T00:00:00.000Z', sync_status: 'synced' },
    { id: 'duplicate-1', created_at: '2026-08-02T00:00:00.000Z', sync_status: 'synced' },
  ],
  [
    { id: 'outside-filter-1', created_at: '2026-07-01T00:00:00.000Z', sync_status: 'required' },
    { id: 'duplicate-1', created_at: '2026-08-02T00:00:00.000Z', sync_status: 'pending' },
  ],
);
assert.deepEqual(mergedRows.map(row => row.id), ['visible-1', 'duplicate-1', 'outside-filter-1']);
assert.equal(
  mergedRows.find(row => row.id === 'duplicate-1')?.sync_status,
  'pending',
  'The unfiltered recovery query must replace a stale filtered row',
);

const firstKey = createPopbillMgtKey(1_723_000_000_000, 'ABC12345');
const secondKey = createPopbillMgtKey(1_723_000_000_000, 'XYZ98765');
assert.notEqual(firstKey, secondKey);
assert.match(firstKey, /^[A-Z0-9_-]{1,24}$/);
assert.ok(firstKey.length <= 24);

assert.equal(normalizePhoneNumber('010-1234-5678'), '01012345678');
assert.equal(normalizePhoneNumber('010 1234 5678'), '01012345678');
assert.equal(normalizePhoneNumber('+82 (0)10-1234-5678'), '8201012345678');
assert.equal(normalizePhoneNumber(null), '');

assert.deepEqual(resolvePopbillEnvironment('test'), {
  apiBaseUrl: 'https://popbill-test.linkhub.co.kr',
  serviceId: 'POPBILL_TEST',
});
assert.deepEqual(resolvePopbillEnvironment('production'), {
  apiBaseUrl: 'https://popbill.linkhub.co.kr',
  serviceId: 'POPBILL',
});
assert.throws(() => resolvePopbillEnvironment(undefined), /POPBILL_ENVIRONMENT/);
assert.throws(() => resolvePopbillEnvironment('prod'), /POPBILL_ENVIRONMENT/);
assert.doesNotMatch(
  (() => {
    try {
      resolvePopbillEnvironment('do-not-leak-this-value');
      return '';
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  })(),
  /do-not-leak-this-value/,
);

assert.equal(
  buildPopbillApiUrl('https://popbill.linkhub.co.kr', 'Taxinvoice', ''),
  'https://popbill.linkhub.co.kr/Taxinvoice',
);
assert.equal(
  buildPopbillApiUrl('https://popbill.linkhub.co.kr/', '/Taxinvoice/', '/SELL/LV-1'),
  'https://popbill.linkhub.co.kr/Taxinvoice/SELL/LV-1',
);
assert.equal(
  buildPopbillApiUrl('https://popbill.linkhub.co.kr', 'Taxinvoice', '?TG=SBOX'),
  'https://popbill.linkhub.co.kr/Taxinvoice?TG=SBOX',
);

const registIssueRequest = createRegistIssueRequest(
  { issueType: '정발행', invoicerMgtKey: 'LV-ISSUE-REST-1' },
  '발행 메모',
);
assert.deepEqual(registIssueRequest, {
  method: 'POST',
  path: '',
  headers: { 'X-HTTP-Method-Override': 'ISSUE' },
  body: {
    issueType: '정발행',
    invoicerMgtKey: 'LV-ISSUE-REST-1',
    memo: '발행 메모',
  },
});

assert.deepEqual(createGetInfoRequest('SELL', 'LV-INFO-1'), {
  method: 'GET',
  path: 'SELL/LV-INFO-1',
});

assert.deepEqual(createCancelIssueRequest('SELL', 'LV-CANCEL-REST-1', '취소 메모'), {
  method: 'POST',
  path: 'SELL/LV-CANCEL-REST-1',
  headers: { 'X-HTTP-Method-Override': 'CANCELISSUE' },
  body: { memo: '취소 메모' },
});
assert.deepEqual(createSendEmailRequest('SELL', 'LV-EMAIL-1', ' tax@example.com '), {
  method: 'POST',
  path: 'SELL/LV-EMAIL-1',
  headers: { 'X-HTTP-Method-Override': 'EMAIL' },
  body: { receiver: 'tax@example.com' },
});
assert.throws(() => createGetInfoRequest('INVALID', 'LV-1'), /문서번호 유형/);
assert.throws(() => createGetInfoRequest('SELL', '../escape'), /관리번호/);

const passwordResetSource = await readFile(
  path.join(process.cwd(), 'supabase/functions/password-reset/index.ts'),
  'utf8',
);
assert.match(passwordResetSource, /import \{ normalizePhoneNumber \} from '\.\.\/_shared\/phone\.ts'/);
assert.match(
  passwordResetSource,
  /const storedPhone = normalizePhoneNumber\(profile\.phone\);[\s\S]*?const submittedPhone = normalizePhoneNumber\(phone\);[\s\S]*?!storedPhone \|\| storedPhone !== submittedPhone/,
);
assert.doesNotMatch(passwordResetSource, /profile\.phone !== phone\.trim\(\)/);

const taxInvoicePageSource = await readFile(
  path.join(process.cwd(), 'src/pages/TaxInvoicesPage.tsx'),
  'utf8',
);
assert.match(taxInvoicePageSource, /runTrackedTaxInvoiceIssue\(\{/);
assert.match(taxInvoicePageSource, /runTrackedTaxInvoiceCancellation\(\{/);
assert.match(taxInvoicePageSource, /sync_status: 'pending'/);
assert.match(taxInvoicePageSource, /mapPopbillStateCode\(stateCode, inv\.status\)/);
assert.match(taxInvoicePageSource, /\.in\('sync_status', \['pending', 'required'\]\)/);
assert.match(taxInvoicePageSource, /mergeTaxInvoiceRows\(filteredInvoices, unresolvedOperations\)/);
assert.match(
  taxInvoicePageSource,
  /form\.invoiceDirection !== 'sales' \|\| form\.issueType !== 'normal'/,
);
assert.match(taxInvoicePageSource, /const canStartIssue = unresolvedOperationsReady && !hasUnresolvedOperations/);
assert.match(taxInvoicePageSource, /disabled=\{!canStartIssue\}/);
assert.match(taxInvoicePageSource, /Promise\.all\(\[refetchInvoices\(\), refetchUnresolvedOperations\(\)\]\)/);
assert.match(taxInvoicePageSource, /매입 세금계산서는 팝빌 수취 내역 조회 전용입니다/);
assert.doesNotMatch(taxInvoicePageSource, /if \(stateCode\.startsWith\('3'\)\)/);

const taxInvoiceDialogSource = await readFile(
  path.join(process.cwd(), 'src/components/tax-invoice/TaxInvoiceCreateDialog.tsx'),
  'utf8',
);
assert.match(taxInvoiceDialogSource, /매출 정발행만 지원합니다/);
assert.doesNotMatch(taxInvoiceDialogSource, /<SelectItem value="purchase">/);
assert.doesNotMatch(taxInvoiceDialogSource, /<SelectItem value="reverse">/);

const popbillFunctionSource = await readFile(
  path.join(process.cwd(), 'supabase/functions/popbill-api/index.ts'),
  'utf8',
);
assert.match(popbillFunctionSource, /Deno\.env\.get\("POPBILL_ENVIRONMENT"\)/);
assert.match(popbillFunctionSource, /createRegistIssueRequest\(taxInvoice, memo\)/);
assert.match(popbillFunctionSource, /createGetInfoRequest\(infoMgtKeyType, infoMgtKey\)/);
assert.match(popbillFunctionSource, /createCancelIssueRequest\(cancelMgtKeyType, cancelMgtKey, cancelMemo\)/);
assert.match(popbillFunctionSource, /createSendEmailRequest\(emailMgtKeyType, emailMgtKey, receiverEmail\)/);
assert.match(popbillFunctionSource, /supabase\.rpc\("is_company_master"\)/);
assert.doesNotMatch(popbillFunctionSource, /_role: "moderator"/);
assert.doesNotMatch(popbillFunctionSource, /const IS_TEST = true/);
assert.doesNotMatch(popbillFunctionSource, /"x-pb-message"/i);

const reliabilityMigrationSource = await readFile(
  path.join(process.cwd(), 'supabase/migrations/20260819113000_tax_invoice_operation_reliability.sql'),
  'utf8',
);
assert.match(reliabilityMigrationSource, /ADD COLUMN IF NOT EXISTS sync_status/);
assert.match(reliabilityMigrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS tax_invoices_popbill_mgt_key_unique_idx/);
assert.match(reliabilityMigrationSource, /DROP POLICY IF EXISTS "Moderators can manage all tax invoices"/);
assert.match(reliabilityMigrationSource, /CREATE POLICY "Moderators can view all tax invoices"[\s\S]*?FOR SELECT/);
assert.match(reliabilityMigrationSource, /DROP POLICY IF EXISTS "Users can create their own tax invoices"/);
assert.match(reliabilityMigrationSource, /DROP POLICY IF EXISTS "Users can update their own draft tax invoices"/);
assert.match(reliabilityMigrationSource, /CREATE POLICY "Company master can manage all tax invoices"[\s\S]*?FOR ALL/);

console.log('Tax invoice reliability and phone normalization regressions passed.');
