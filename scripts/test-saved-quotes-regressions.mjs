import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const projectRoot = new URL('../', import.meta.url);
const savedQuotesPath = new URL('src/pages/SavedQuotesPage.tsx', projectRoot);
const emptyStatePath = new URL('src/components/quote/QuoteEmptyState.tsx', projectRoot);

function loadExportedFunctions(fileUrl, names) {
  const source = fs.readFileSync(fileUrl, 'utf8');
  const sourceFile = ts.createSourceFile(
    fileUrl.pathname,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const selected = sourceFile.statements.filter((statement) => (
    ts.isFunctionDeclaration(statement)
    && statement.name
    && names.includes(statement.name.text)
  ));

  assert.equal(
    selected.length,
    names.length,
    `Expected exported regression helpers: ${names.join(', ')}`,
  );

  const snippet = selected.map((statement) => statement.getText(sourceFile)).join('\n');
  const compiled = ts.transpileModule(snippet, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const context = { exports: {} };
  vm.runInNewContext(compiled, context);
  return context.exports;
}

const savedQuotesSource = fs.readFileSync(savedQuotesPath, 'utf8');
const emptyStateSource = fs.readFileSync(emptyStatePath, 'utf8');

const {
  buildSavedQuoteSearchFilter,
  getQuoteDateRange,
  getSavedQuoteSort,
  getPageAfterQuoteDeletion,
} = loadExportedFunctions(savedQuotesPath, [
  'buildSavedQuoteSearchFilter',
  'getQuoteDateRange',
  'getSavedQuoteSort',
  'getPageAfterQuoteDeletion',
]);

assert.deepEqual(
  { ...getSavedQuoteSort('amount-asc') },
  { column: 'total', ascending: true },
);
assert.deepEqual(
  { ...getSavedQuoteSort('number-desc') },
  { column: 'quote_number', ascending: false },
);
assert.deepEqual(
  { ...getQuoteDateRange('2026-08-12') },
  { from: '2026-08-11T15:00:00.000Z', to: '2026-08-12T15:00:00.000Z' },
);
assert.equal(getQuoteDateRange(''), null);
assert.equal(getPageAfterQuoteDeletion(2, 51, 50), 1);
assert.equal(getPageAfterQuoteDeletion(3, 151, 50), 3);

const searchFilter = buildSavedQuoteSearchFilter('AC 은행', ['user-1']);
assert.match(searchFilter, /project_name\.ilike\.\*AC 은행\*/);
assert.match(searchFilter, /lost_reason_detail\.ilike\.\*AC 은행\*/);
assert.match(searchFilter, /assigned_to_name\.ilike\.\*AC 은행\*/);
assert.match(searchFilter, /user_id\.in\.\(user-1\)/);
assert.equal(buildSavedQuoteSearchFilter('   ', []), null);
assert.match(buildSavedQuoteSearchFilter('AC,%_은행', []), /project_name\.ilike\.\*AC 은행\*/);
assert.match(buildSavedQuoteSearchFilter('AC*은행', []), /project_name\.ilike\.\*AC 은행\*/);

for (const amount of ['1000000', '1,000,000', '₩1,000,000', '1,000,000원', ' ₩ 1,000,000 원 ']) {
  assert.match(buildSavedQuoteSearchFilter(amount, []), /(?:^|,)total\.eq\.1000000(?:,|$)/);
}
assert.match(buildSavedQuoteSearchFilter('0원', []), /total\.eq\.0(?:,|$)/);
assert.match(buildSavedQuoteSearchFilter('1000000', []), /quote_number\.ilike\.\*1000000\*/);
for (const term of ['AC1000000', '1,00,000', '-1000', '1e6', '1000.5', '9007199254740992', '1000),total.gt.0']) {
  assert.doesNotMatch(buildSavedQuoteSearchFilter(term, []), /(?:^|,)total\./);
}

assert.doesNotMatch(savedQuotesSource, /debouncedSearchTerm|setTimeout\(/);
assert.match(savedQuotesSource, /onSubmit=\{/);
assert.match(savedQuotesSource, /setAppliedSearchTerm\(searchTerm\.trim\(\)\)/);
assert.match(savedQuotesSource, /fetchMatchingProfileIds\(appliedSearchTerm\)/);
assert.match(savedQuotesSource, /buildSavedQuoteSearchFilter\(appliedSearchTerm, matchingProfileIds\)/);
assert.match(savedQuotesSource, /nativeEvent\.isComposing/);
assert.match(savedQuotesSource, /keyCode === 229/);
assert.match(savedQuotesSource, /type="submit"/);
assert.match(savedQuotesSource, /setSearchTerm\(''\);\s*setAppliedSearchTerm\(''\);/);
assert.doesNotMatch(savedQuotesSource, /if \(loading\) \{\s*return/);
assert.match(savedQuotesSource, /activeFilterCount > 0 \? '검색 결과가 없습니다\.'/);

// Run the actual form/key handlers without a browser or a live database.
function loadSearchHandler(name, context) {
  const tree = ts.createSourceFile('page.tsx', savedQuotesSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expression;
  function visit(node) {
    if (ts.isJsxAttribute(node) && node.name.text === name && ts.isJsxExpression(node.initializer)) {
      expression = node.initializer.expression.getText(tree);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.ok(expression, `Missing search handler: ${name}`);
  return vm.runInNewContext(`(${expression})`, context);
}
for (const [loading, appliedSearchTerm, currentPage, expected] of [
  [false, '', 2, [['page', 1], ['search', 'AC 은행']]],
  [false, 'AC 은행', 2, [['page', 1], ['search', 'AC 은행']]],
  [false, 'AC 은행', 1, [['fetch']]],
  [true, '', 1, []],
]) {
  const calls = [];
  let prevented = false;
  loadSearchHandler('onSubmit', {
    loading, appliedSearchTerm, currentPage, searchTerm: ' AC 은행 ',
    setCurrentPage: value => calls.push(['page', value]),
    setAppliedSearchTerm: value => calls.push(['search', value]),
    fetchQuotes: () => calls.push(['fetch']),
  })({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(calls, expected);
}
for (const [key, isComposing, keyCode, expected] of [
  ['Enter', true, 13, true],
  ['Enter', false, 229, true],
  ['Enter', false, 13, false],
  ['a', true, 65, false],
]) {
  let prevented = false;
  loadSearchHandler('onKeyDown', {})({
    key, keyCode, nativeEvent: { isComposing }, preventDefault: () => { prevented = true; },
  });
  assert.equal(prevented, expected);
}

assert.match(savedQuotesSource, /select\('\*', \{ count: 'exact' \}\)/);
assert.match(savedQuotesSource, /dataQuery = dataQuery\.gte\('quote_date'/);
assert.match(savedQuotesSource, /dataQuery = dataQuery\.in\('project_stage'/);
assert.match(savedQuotesSource, /dataQuery = dataQuery\.not\('lost_recorded_at', 'is', null\)/);
assert.match(savedQuotesSource, /dataQuery\.is\('lost_reason_category', null\)/);
assert.match(savedQuotesSource, /dataQuery\.eq\('lost_reason_category', lostReasonFilter\)/);
assert.match(savedQuotesSource, /\.order\(sort\.column, \{ ascending: sort\.ascending \}\)/);
assert.match(savedQuotesSource, /\.range\(from, to\)/);
assert.match(savedQuotesSource, /fetchRequestIdRef\.current !== requestId/);
assert.match(savedQuotesSource, /setLoading\(true\)/);
assert.match(
  savedQuotesSource,
  /setCurrentPage\(1\);\s*\}, \[appliedSearchTerm, dateFilter, stageFilter, userFilter, lostReasonFilter, sortBy\]\);/,
);
assert.doesNotMatch(savedQuotesSource, /const filterQuotes =/);
assert.doesNotMatch(
  savedQuotesSource,
  /!searchTerm && !dateFilter && totalCount > ITEMS_PER_PAGE/,
);

const { canNavigateToPreviousScreen } = loadExportedFunctions(emptyStatePath, [
  'canNavigateToPreviousScreen',
]);
assert.equal(canNavigateToPreviousScreen(undefined), false);
assert.equal(canNavigateToPreviousScreen({ idx: 0 }), false);
assert.equal(canNavigateToPreviousScreen({ idx: 1 }), true);
assert.match(emptyStateSource, /onBackToCalculator\(\)/);

console.log('Saved quote regression checks passed.');
