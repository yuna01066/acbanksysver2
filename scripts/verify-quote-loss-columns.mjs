#!/usr/bin/env node
/**
 * Verify that `saved_quotes` has the quote-loss analysis columns applied by
 * `supabase/migrations/20260722073000_ensure_quote_loss_columns.sql`.
 *
 * Checks:
 *   - All 8 `lost_*` columns exist with expected data types
 *   - CHECK constraints `saved_quotes_lost_by_check` and
 *     `saved_quotes_lost_reason_category_check` exist
 *   - Partial indexes for `lost_recorded_at`, `lost_reason_category`,
 *     `lost_recorded_by` exist
 *
 * Exits 0 on success, 1 on any missing item. Requires PG* env vars
 * (Lovable Cloud managed psql access, or a local Postgres with the migration
 * applied).
 *
 * Usage:
 *   node scripts/verify-quote-loss-columns.mjs
 */
import { execFileSync } from "node:child_process";

const EXPECTED_COLUMNS = [
  ["lost_by", "text"],
  ["lost_reason_category", "text"],
  ["lost_reason_detail", "text"],
  ["lost_competitor_name", "text"],
  ["lost_price_gap", "numeric"],
  ["lost_follow_up_at", "timestamp with time zone"],
  ["lost_recorded_by", "uuid"],
  ["lost_recorded_at", "timestamp with time zone"],
];

const EXPECTED_CONSTRAINTS = [
  "saved_quotes_lost_by_check",
  "saved_quotes_lost_reason_category_check",
];

const EXPECTED_INDEXES = [
  "idx_saved_quotes_lost_recorded_at",
  "idx_saved_quotes_lost_reason_category",
  "idx_saved_quotes_lost_recorded_by",
];

const REMEDY =
  "Apply supabase/migrations/20260722073000_ensure_quote_loss_columns.sql, " +
  "then run: NOTIFY pgrst, 'reload schema';";

function psql(sql) {
  if (!process.env.PGHOST) {
    console.error(
      "[verify-quote-loss-columns] PGHOST is not set. Run inside a session " +
        "with managed Supabase psql access, or export PG* env vars locally.",
    );
    process.exit(2);
  }
  const out = execFileSync(
    "psql",
    ["-At", "-F", "\t", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8" },
  );
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

const failures = [];

// 1. Columns
const colRows = psql(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'saved_quotes'
    AND column_name LIKE 'lost_%'
  ORDER BY column_name;
`);
const colMap = new Map(colRows.map(([name, type]) => [name, type]));
for (const [name, expectedType] of EXPECTED_COLUMNS) {
  const actual = colMap.get(name);
  if (!actual) {
    failures.push(`missing column: ${name} (expected ${expectedType})`);
  } else if (actual !== expectedType) {
    failures.push(
      `column ${name} has type "${actual}", expected "${expectedType}"`,
    );
  }
}

// 2. CHECK constraints
const conRows = psql(`
  SELECT conname
  FROM pg_constraint
  WHERE conrelid = 'public.saved_quotes'::regclass
    AND conname IN (${EXPECTED_CONSTRAINTS.map((c) => `'${c}'`).join(",")});
`);
const conSet = new Set(conRows.map(([name]) => name));
for (const name of EXPECTED_CONSTRAINTS) {
  if (!conSet.has(name)) failures.push(`missing CHECK constraint: ${name}`);
}

// 3. Indexes
const idxRows = psql(`
  SELECT indexname
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'saved_quotes'
    AND indexname IN (${EXPECTED_INDEXES.map((i) => `'${i}'`).join(",")});
`);
const idxSet = new Set(idxRows.map(([name]) => name));
for (const name of EXPECTED_INDEXES) {
  if (!idxSet.has(name)) failures.push(`missing index: ${name}`);
}

if (failures.length > 0) {
  console.error("❌ saved_quotes quote-loss columns verification FAILED:");
  for (const f of failures) console.error(`  - ${f}`);
  console.error(`\nRemedy: ${REMEDY}`);
  process.exit(1);
}

console.log(
  "✅ saved_quotes quote-loss columns verified: " +
    `${EXPECTED_COLUMNS.length} columns, ${EXPECTED_CONSTRAINTS.length} checks, ` +
    `${EXPECTED_INDEXES.length} indexes present.`,
);
