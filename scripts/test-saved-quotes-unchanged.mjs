// Verification: existing (pre-migration) saved quotes must not have their
// stored amounts changed by the AB+3% pricing migration (20260720090000).
//
// Rules asserted:
//   1. No pre-migration saved_quotes row has been touched (updated_at) after
//      the migration timestamp — i.e. the pricing migration did not mutate
//      any previously saved quote.
//   2. Every pre-migration quote still has non-null `total`/`subtotal` and
//      `total >= subtotal` (basic integrity — snapshots weren't zeroed out).
//   3. Fingerprint (count + sum of totals) of pre-migration quotes is
//      printed so future runs can diff against it if needed.
//
// Runs against the managed Supabase DB via psql (PG* env vars).

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

if (!process.env.PGHOST) {
  console.error('SKIP: PGHOST not set. Requires Lovable Cloud managed psql access.');
  process.exit(2);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = join(__dirname, 'baselines', 'saved-quotes-fingerprint.json');
const UPDATE_BASELINE = process.argv.includes('--update-baseline');

// Migration was applied at 2026-07-20 ~12:39 UTC. Use a conservative cutoff:
// anything created strictly before the migration day (Asia/Seoul) is
// considered "pre-migration" and must remain untouched.
const MIGRATION_CUTOFF = '2026-07-20 00:00:00+09';
const MIGRATION_APPLIED_AT = '2026-07-20 12:00:00+00';

const psqlJson = (sql) => {
  const out = execFileSync(
    'psql',
    ['-Atqc', `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t`],
    { encoding: 'utf8' },
  );
  return JSON.parse(out.trim() || '[]');
};

// --- 1. No pre-migration quote touched after migration ---------------------
const touchedAfter = psqlJson(`
  SELECT id, quote_number, created_at, updated_at, total
  FROM public.saved_quotes
  WHERE created_at < TIMESTAMPTZ '${MIGRATION_CUTOFF}'
    AND updated_at > TIMESTAMPTZ '${MIGRATION_APPLIED_AT}'
`);
assert.equal(
  touchedAfter.length, 0,
  `Pre-migration saved_quotes must not be modified after the pricing migration. `
  + `Found ${touchedAfter.length} rows:\n${JSON.stringify(touchedAfter.slice(0, 5), null, 2)}`,
);

// --- 2. Basic integrity of stored snapshots --------------------------------
const broken = psqlJson(`
  SELECT id, quote_number, subtotal, total
  FROM public.saved_quotes
  WHERE created_at < TIMESTAMPTZ '${MIGRATION_CUTOFF}'
    AND (
      total IS NULL
      OR subtotal IS NULL
      OR total < 0
      OR subtotal < 0
      OR total < subtotal
    )
`);
assert.equal(
  broken.length, 0,
  `Pre-migration saved_quotes must retain valid snapshots. Broken rows:\n`
  + JSON.stringify(broken.slice(0, 5), null, 2),
);

// --- 3. Fingerprint --------------------------------------------------------
const [fingerprint] = psqlJson(`
  SELECT
    count(*)::int AS pre_migration_count,
    COALESCE(sum(total), 0)::bigint AS pre_migration_total_sum,
    COALESCE(sum(subtotal), 0)::bigint AS pre_migration_subtotal_sum,
    max(updated_at) AS max_updated_at
  FROM public.saved_quotes
  WHERE created_at < TIMESTAMPTZ '${MIGRATION_CUTOFF}'
`);

console.log('Existing saved-quote preservation check: PASSED');
console.log(`  - pre-migration quote count:       ${fingerprint.pre_migration_count}`);
console.log(`  - pre-migration Σ total (KRW):    ${fingerprint.pre_migration_total_sum}`);
console.log(`  - pre-migration Σ subtotal (KRW): ${fingerprint.pre_migration_subtotal_sum}`);
console.log(`  - latest pre-migration updated_at: ${fingerprint.max_updated_at}`);
console.log(`  - post-migration touches of pre-migration rows: 0`);

// --- 4. Baseline drift check ----------------------------------------------
// Regularly catches unintended mutations to historical snapshots even when no
// new migration ran (e.g. an ad-hoc SQL patch or a buggy backfill).
const current = {
  preMigrationCount: fingerprint.pre_migration_count,
  preMigrationTotalSum: Number(fingerprint.pre_migration_total_sum),
  preMigrationSubtotalSum: Number(fingerprint.pre_migration_subtotal_sum),
};

if (UPDATE_BASELINE) {
  const next = {
    _comment: 'Baseline fingerprint of pre-migration saved_quotes. Regenerate with `--update-baseline` only after an intentional data change.',
    cutoff: MIGRATION_CUTOFF,
    capturedAt: new Date().toISOString(),
    ...current,
  };
  writeFileSync(BASELINE_PATH, JSON.stringify(next, null, 2) + '\n');
  console.log(`\nBaseline updated at ${BASELINE_PATH}`);
} else if (existsSync(BASELINE_PATH)) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const drift = [];
  for (const k of ['preMigrationCount', 'preMigrationTotalSum', 'preMigrationSubtotalSum']) {
    if (baseline[k] !== current[k]) {
      drift.push(`  ${k}: baseline=${baseline[k]} current=${current[k]} Δ=${current[k] - baseline[k]}`);
    }
  }
  if (drift.length) {
    console.error('\nBaseline DRIFT detected in pre-migration saved_quotes fingerprint:');
    console.error(drift.join('\n'));
    console.error(`\nIf this change is intentional, re-run with --update-baseline.`);
    console.error(`Baseline file: ${BASELINE_PATH}`);
    process.exit(1);
  }
  console.log(`  - baseline drift: none (matches ${BASELINE_PATH})`);
} else {
  console.warn(`\nWARN: no baseline at ${BASELINE_PATH}. Run with --update-baseline to create one.`);
}
