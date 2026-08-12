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
  /setCurrentPage\(1\);\s*\}, \[debouncedSearchTerm, dateFilter, stageFilter, userFilter, lostReasonFilter, sortBy\]\);/,
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
