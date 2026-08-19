import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const projectRoot = new URL('../', import.meta.url);
const read = (relativePath) => fs.readFileSync(new URL(relativePath, projectRoot), 'utf8');

function loadTypeScriptModule(relativePath) {
  const source = read(relativePath);
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = {
    exports: {},
    module: { exports: {} },
    require: () => {
      throw new Error(`Unexpected runtime import in ${relativePath}`);
    },
  };
  context.module.exports = context.exports;
  vm.runInNewContext(compiled, context);
  return context.module.exports;
}

const { createSerializedTaskQueue } = loadTypeScriptModule('src/utils/serializedTaskQueue.ts');
const {
  buildContractTemplateDraftStorageKey,
  buildContractTemplateEditorSnapshot,
  parseContractTemplateRecoveryDraft,
} = loadTypeScriptModule('src/utils/contractTemplateEditorDraft.ts');
const {
  buildAnonymousQuoteDraftFingerprint,
  getAnonymousQuoteDraftDecisionKey,
  userDeclinedAnonymousQuoteDraft,
} = loadTypeScriptModule('src/utils/anonymousQuoteDraft.ts');

const queue = createSerializedTaskQueue();
const events = [];
let inFlight = 0;
let maxInFlight = 0;
let releaseFirst;
const firstGate = new Promise((resolve) => { releaseFirst = resolve; });

const first = queue.enqueue(async () => {
  events.push('first:start');
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  await firstGate;
  inFlight -= 1;
  events.push('first:end');
  return 'first';
});
const second = queue.enqueue(async () => {
  events.push('second:start');
  inFlight += 1;
  maxInFlight = Math.max(maxInFlight, inFlight);
  inFlight -= 1;
  events.push('second:end');
  return 'second';
});

await Promise.resolve();
assert.deepEqual(events, ['first:start']);
releaseFirst();
assert.deepEqual(await Promise.all([first, second]), ['first', 'second']);
assert.equal(maxInFlight, 1, 'Draft saves must never overlap');
assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);

const queueAfterFailure = createSerializedTaskQueue();
await assert.rejects(queueAfterFailure.enqueue(async () => { throw new Error('save failed'); }));
assert.equal(await queueAfterFailure.enqueue(async () => 'recovered'), 'recovered');

const draftQueue = createSerializedTaskQueue();
let latestSnapshot = 'first snapshot';
let activeDraftId = null;
let createCalls = 0;
let updateCalls = 0;
let persistedSnapshot = null;
let releaseCreate;
const createGate = new Promise((resolve) => { releaseCreate = resolve; });
const createSave = draftQueue.enqueue(async () => {
  const snapshotAtStart = latestSnapshot;
  createCalls += 1;
  await createGate;
  activeDraftId = 'draft-1';
  persistedSnapshot = snapshotAtStart;
});
await Promise.resolve();
latestSnapshot = 'latest snapshot';
const updateSave = draftQueue.enqueue(async () => {
  assert.equal(activeDraftId, 'draft-1', 'The first create must publish its id before the next save starts');
  updateCalls += 1;
  persistedSnapshot = latestSnapshot;
});
releaseCreate();
await Promise.all([createSave, updateSave]);
assert.equal(createCalls, 1, 'Concurrent initial saves must create only one draft');
assert.equal(updateCalls, 1);
assert.equal(persistedSnapshot, 'latest snapshot', 'The final write must contain the newest snapshot');

const lifecycleQueue = createSerializedTaskQueue();
let persistenceGeneration = 0;
const lifecycleEvents = [];
let releaseLifecycleSave;
const lifecycleSaveGate = new Promise((resolve) => { releaseLifecycleSave = resolve; });
const initialGeneration = persistenceGeneration;
const inFlightSave = lifecycleQueue.enqueue(async () => {
  lifecycleEvents.push('save:start');
  await lifecycleSaveGate;
  lifecycleEvents.push('save:end');
});
const terminalMutation = lifecycleQueue.enqueue(async () => {
  lifecycleEvents.push('issue');
  persistenceGeneration += 1;
});
const queuedAfterTerminal = lifecycleQueue.enqueue(async () => {
  if (initialGeneration !== persistenceGeneration) {
    lifecycleEvents.push('stale-save:skipped');
    return;
  }
  lifecycleEvents.push('stale-save:ran');
});
releaseLifecycleSave();
await Promise.all([inFlightSave, terminalMutation, queuedAfterTerminal]);
assert.deepEqual(
  lifecycleEvents,
  ['save:start', 'save:end', 'issue', 'stale-save:skipped'],
  'Issue/archive must run after earlier saves and invalidate saves queued behind the terminal mutation',
);

assert.equal(
  buildContractTemplateDraftStorageKey('user-1', 'template-1'),
  'acbank_contract_template_editor_draft_v1:user-1:template-1',
);
assert.notEqual(
  buildContractTemplateDraftStorageKey('user-1', null),
  buildContractTemplateDraftStorageKey('user-2', null),
  'New-template recovery drafts must be isolated by user',
);

const editorState = {
  name: '표준 근로계약서',
  description: '설명',
  templateType: 'labor',
  payDay: 25,
  isActive: true,
  contentSource: 'saved',
  fallbackTemplateName: '',
  content: { type: 'doc', content: [{ type: 'paragraph' }] },
};
const baseline = buildContractTemplateEditorSnapshot(editorState);
assert.equal(baseline, buildContractTemplateEditorSnapshot({ ...editorState }));
assert.notEqual(baseline, buildContractTemplateEditorSnapshot({ ...editorState, payDay: 10 }));
assert.notEqual(
  baseline,
  buildContractTemplateEditorSnapshot({
    ...editorState,
    content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '변경' }] }] },
  }),
);

const now = Date.parse('2026-08-19T00:00:00.000Z');
const recovery = {
  version: 1,
  identity: 'template-1',
  savedAt: '2026-08-18T23:00:00.000Z',
  state: editorState,
};
assert.equal(
  JSON.stringify(parseContractTemplateRecoveryDraft(JSON.stringify(recovery), 'template-1', now)),
  JSON.stringify(recovery),
);
assert.equal(parseContractTemplateRecoveryDraft(JSON.stringify(recovery), 'template-2', now), null);
assert.equal(
  parseContractTemplateRecoveryDraft(
    JSON.stringify({ ...recovery, savedAt: '2026-08-01T00:00:00.000Z' }),
    'template-1',
    now,
  ),
  null,
);
assert.equal(parseContractTemplateRecoveryDraft('{bad json', 'template-1', now), null);

const anonymousDraftRaw = JSON.stringify({ quotes: [{ id: 'anonymous-1' }], savedAt: '2026-08-19T00:00:00.000Z' });
const anonymousDraftFingerprint = buildAnonymousQuoteDraftFingerprint(anonymousDraftRaw);
assert.equal(
  anonymousDraftFingerprint,
  buildAnonymousQuoteDraftFingerprint(anonymousDraftRaw),
  'The same anonymous payload must retain the same decision fingerprint',
);
assert.notEqual(
  anonymousDraftFingerprint,
  buildAnonymousQuoteDraftFingerprint(JSON.stringify({ quotes: [{ id: 'anonymous-2' }] })),
  'A changed anonymous payload must require a fresh ownership decision',
);
assert.equal(
  anonymousDraftFingerprint,
  buildAnonymousQuoteDraftFingerprint(JSON.stringify({
    quotes: [{ id: 'anonymous-1' }],
    savedAt: '2026-08-20T00:00:00.000Z',
  })),
  'A timestamp-only local rewrite must not invalidate the user decision',
);
assert.equal(userDeclinedAnonymousQuoteDraft(anonymousDraftRaw, anonymousDraftFingerprint), true);
assert.equal(
  userDeclinedAnonymousQuoteDraft(JSON.stringify({ quotes: [{ id: 'anonymous-2' }] }), anonymousDraftFingerprint),
  false,
);
assert.notEqual(
  getAnonymousQuoteDraftDecisionKey('user-1'),
  getAnonymousQuoteDraftDecisionKey('user-2'),
  'Anonymous draft decisions must be isolated per signed-in user',
);

const quoteContext = read('src/contexts/QuoteContext.tsx');
assert.match(quoteContext, /createSerializedTaskQueue/);
assert.match(quoteContext, /draftSaveQueueRef\.current\.enqueue/);
assert.match(quoteContext, /activeDraftIdRef\.current = savedDraft\.id/);
assert.match(quoteContext, /const archiveActiveDraft[\s\S]*?draftSaveQueueRef\.current\.enqueue/);
assert.match(quoteContext, /const markActiveDraftIssued[\s\S]*?draftSaveQueueRef\.current\.enqueue/);
assert.match(quoteContext, /draftPersistenceGenerationRef\.current \+= 1/);
assert.match(quoteContext, /anonymousDraftResolutionRequiredRef\.current = true/);
assert.match(quoteContext, /userDeclinedAnonymousQuoteDraft/);
assert.match(quoteContext, /draftOwnerUserIdRef\.current && draftOwnerUserIdRef\.current !== user\.id/);
assert.doesNotMatch(
  quoteContext,
  /if \(localRaw && localHasContent\)[\s\S]{0,500}createQuoteDraft/,
  'Anonymous browser drafts must never be auto-created for the next login',
);

const editorDialog = read('src/components/contract/template-editor/TemplateEditorDialog.tsx');
assert.match(editorDialog, /beforeunload/);
assert.match(editorDialog, /pagehide/);
assert.match(editorDialog, /requestClose/);
assert.match(editorDialog, /isDirty/);
assert.match(editorDialog, /parseContractTemplateRecoveryDraft/);
assert.match(editorDialog, /변경사항을 저장하지 않고 나가시겠습니까/);
assert.match(editorDialog, /editorRevision, isDirty, open, persistRecoveryDraft/);
assert.match(editorDialog, /latestRecoveryPersistenceRef\.current/);
assert.match(editorDialog, /editor\.setEditable\(!saving\)/);
assert.match(editorDialog, /<fieldset[\s\S]*?disabled=\{saving\}/);

const quoteToolbar = read('src/components/QuoteDraftToolbar.tsx');
assert.match(quoteToolbar, /anonymousDraftResolutionRequired/);
assert.match(quoteToolbar, /이 계정으로 가져오기/);
assert.match(quoteToolbar, /계정과 분리해 보관/);
assert.match(quoteToolbar, /anonymousDraftAction === 'import'/);

const internalQuotePage = read('src/pages/InternalQuotePage.tsx');
assert.match(internalQuotePage, /if \(anonymousDraftResolutionRequired\)/);
assert.match(internalQuotePage, /가져올지 계정과 분리할지 먼저 선택/);

console.log('Draft serialization and contract editor recovery regression checks passed.');
