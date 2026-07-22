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
 * Exits 0 on success, 1 on any missing item (or on apply failure).
 * Requires PG* env vars (Lovable Cloud managed psql access, or a local
 * Postgres with the migration applied).
 *
 * Usage:
 *   node scripts/verify-quote-loss-columns.mjs
 *   node scripts/verify-quote-loss-columns.mjs --apply   # auto-apply migration on failure and re-verify
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = resolve(
  __dirname,
  "..",
  "supabase/migrations/20260722073000_ensure_quote_loss_columns.sql",
);

const APPLY = process.argv.includes("--apply");

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
  "then run: NOTIFY pgrst, 'reload schema';  " +
  "(or re-run this script with --apply to auto-apply)";

function ensurePgEnv() {
  if (!process.env.PGHOST) {
    console.warn(
      "[verify-quote-loss-columns] PGHOST is not set — skipping DB verification. " +
        "Export PG* env vars (or configure Lovable Cloud managed psql access) to run this check.",
    );
    process.exit(process.env.CI_STRICT_DB_VERIFY === "1" ? 2 : 0);
  }
}

function psql(sql) {
  ensurePgEnv();
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

function applyMigrationFile(path) {
  ensurePgEnv();
  if (!existsSync(path)) {
    console.error(`[verify-quote-loss-columns] migration file not found: ${path}`);
    process.exit(1);
  }
  console.log(`[verify-quote-loss-columns] applying migration: ${path}`);
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", path], {
    encoding: "utf8",
    stdio: "inherit",
  });
  // Force a schema reload in case the migration file omitted the NOTIFY.
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-c", "NOTIFY pgrst, 'reload schema';"], {
    encoding: "utf8",
    stdio: "inherit",
  });
}

function runChecks() {
  const failures = [];

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
    if (!actual) failures.push(`missing column: ${name} (expected ${expectedType})`);
    else if (actual !== expectedType) {
      failures.push(`column ${name} has type "${actual}", expected "${expectedType}"`);
    }
  }

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

  return failures;
}

let failures = runChecks();

if (failures.length > 0 && APPLY) {
  console.warn(
    `[verify-quote-loss-columns] ${failures.length} issue(s) detected — attempting auto-apply...`,
  );
  for (const f of failures) console.warn(`  - ${f}`);
  try {
    applyMigrationFile(MIGRATION_PATH);
  } catch (err) {
    console.error("[verify-quote-loss-columns] migration apply failed:");
    console.error(err?.message || err);
    process.exit(1);
  }
  failures = runChecks();
  if (failures.length === 0) {
    console.log(
      "✅ saved_quotes quote-loss columns verified after --apply: " +
        `${EXPECTED_COLUMNS.length} columns, ${EXPECTED_CONSTRAINTS.length} checks, ` +
        `${EXPECTED_INDEXES.length} indexes present.`,
    );
    process.exit(0);
  }
  console.error("❌ verification still failing after --apply:");
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
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
