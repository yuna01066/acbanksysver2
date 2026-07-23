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
 *   node scripts/verify-quote-loss-columns.mjs --apply   # auto-apply migration on failure
 *   node scripts/verify-quote-loss-columns.mjs --json    # emit JSON report to stdout only
 *   node scripts/verify-quote-loss-columns.mjs --report  # also write scripts/reports/quote-loss-columns-<ts>.json
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE =
  "supabase/migrations/20260722073000_ensure_quote_loss_columns.sql";
const MIGRATION_PATH = resolve(__dirname, "..", MIGRATION_FILE);
const REPORT_DIR = resolve(__dirname, "reports");

const APPLY = process.argv.includes("--apply");
const JSON_ONLY = process.argv.includes("--json");
const WRITE_REPORT = process.argv.includes("--report");

const COLUMN_SQL = {
  lost_by: "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_by TEXT;",
  lost_reason_category:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_reason_category TEXT;",
  lost_reason_detail:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_reason_detail TEXT;",
  lost_competitor_name:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_competitor_name TEXT;",
  lost_price_gap:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_price_gap NUMERIC;",
  lost_follow_up_at:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_follow_up_at TIMESTAMPTZ;",
  lost_recorded_by:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;",
  lost_recorded_at:
    "ALTER TABLE public.saved_quotes ADD COLUMN IF NOT EXISTS lost_recorded_at TIMESTAMPTZ;",
};

const CONSTRAINT_SQL = {
  saved_quotes_lost_by_check: `ALTER TABLE public.saved_quotes
  ADD CONSTRAINT saved_quotes_lost_by_check
  CHECK (lost_by IS NULL OR lost_by IN ('client', 'internal', 'expired', 'system'));`,
  saved_quotes_lost_reason_category_check: `ALTER TABLE public.saved_quotes
  ADD CONSTRAINT saved_quotes_lost_reason_category_check
  CHECK (lost_reason_category IS NULL OR lost_reason_category IN (
    'price_too_high','lead_time','spec_mismatch','competitor_selected',
    'client_budget_cancelled','no_response','internal_rejected',
    'duplicate_or_test','other'
  ));`,
};

const INDEX_SQL = {
  idx_saved_quotes_lost_recorded_at: `CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_recorded_at
  ON public.saved_quotes(lost_recorded_at DESC)
  WHERE lost_recorded_at IS NOT NULL;`,
  idx_saved_quotes_lost_reason_category: `CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_reason_category
  ON public.saved_quotes(lost_reason_category)
  WHERE lost_reason_category IS NOT NULL;`,
  idx_saved_quotes_lost_recorded_by: `CREATE INDEX IF NOT EXISTS idx_saved_quotes_lost_recorded_by
  ON public.saved_quotes(lost_recorded_by)
  WHERE lost_recorded_by IS NOT NULL;`,
};

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

const EXPECTED_CONSTRAINTS = Object.keys(CONSTRAINT_SQL);
const EXPECTED_INDEXES = Object.keys(INDEX_SQL);

function log(...args) {
  if (!JSON_ONLY) console.log(...args);
}
function warn(...args) {
  if (!JSON_ONLY) console.warn(...args);
}
function err(...args) {
  if (!JSON_ONLY) console.error(...args);
}

function ensurePgEnv() {
  if (!process.env.PGHOST) {
    warn(
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
    err(`[verify-quote-loss-columns] migration file not found: ${path}`);
    process.exit(1);
  }
  log(`[verify-quote-loss-columns] applying migration: ${path}`);
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-f", path], {
    encoding: "utf8",
    stdio: JSON_ONLY ? "pipe" : "inherit",
  });
  execFileSync(
    "psql",
    ["-v", "ON_ERROR_STOP=1", "-c", "NOTIFY pgrst, 'reload schema';"],
    { encoding: "utf8", stdio: JSON_ONLY ? "pipe" : "inherit" },
  );
}

function runChecks() {
  const columns = [];
  const constraints = [];
  const indexes = [];

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
    const actual = colMap.get(name) || null;
    let status = "ok";
    if (!actual) status = "missing";
    else if (actual !== expectedType) status = "type_mismatch";
    const entry = { name, expectedType, actualType: actual, status };
    if (status !== "ok") {
      entry.migration = MIGRATION_FILE;
      entry.sql = COLUMN_SQL[name];
    }
    columns.push(entry);
  }

  const conRows = psql(`
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.saved_quotes'::regclass
      AND conname IN (${EXPECTED_CONSTRAINTS.map((c) => `'${c}'`).join(",")});
  `);
  const conSet = new Set(conRows.map(([name]) => name));
  for (const name of EXPECTED_CONSTRAINTS) {
    const status = conSet.has(name) ? "ok" : "missing";
    const entry = { name, status };
    if (status !== "ok") {
      entry.migration = MIGRATION_FILE;
      entry.sql = CONSTRAINT_SQL[name];
    }
    constraints.push(entry);
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
    const status = idxSet.has(name) ? "ok" : "missing";
    const entry = { name, status };
    if (status !== "ok") {
      entry.migration = MIGRATION_FILE;
      entry.sql = INDEX_SQL[name];
    }
    indexes.push(entry);
  }

  const failures = [
    ...columns.filter((c) => c.status !== "ok").map((c) => ({
      kind: "column",
      name: c.name,
      message:
        c.status === "missing"
          ? `missing column: ${c.name} (expected ${c.expectedType})`
          : `column ${c.name} has type "${c.actualType}", expected "${c.expectedType}"`,
      migration: MIGRATION_FILE,
      sql: COLUMN_SQL[c.name],
    })),
    ...constraints.filter((c) => c.status !== "ok").map((c) => ({
      kind: "constraint",
      name: c.name,
      message: `missing CHECK constraint: ${c.name}`,
      migration: MIGRATION_FILE,
      sql: CONSTRAINT_SQL[c.name],
    })),
    ...indexes.filter((i) => i.status !== "ok").map((i) => ({
      kind: "index",
      name: i.name,
      message: `missing index: ${i.name}`,
      migration: MIGRATION_FILE,
      sql: INDEX_SQL[i.name],
    })),
  ];

  return { columns, constraints, indexes, failures };
}

function diffChecks(before, after) {
  const diff = { fixed: [], stillFailing: [], regressed: [], unchanged: [] };
  const kinds = [
    ["column", "columns"],
    ["constraint", "constraints"],
    ["index", "indexes"],
  ];
  for (const [kind, key] of kinds) {
    const beforeMap = new Map(before[key].map((x) => [x.name, x.status]));
    const afterMap = new Map(after[key].map((x) => [x.name, x.status]));
    for (const [name, afterStatus] of afterMap) {
      const beforeStatus = beforeMap.get(name);
      const entry = { kind, name, before: beforeStatus, after: afterStatus };
      if (beforeStatus !== "ok" && afterStatus === "ok") diff.fixed.push(entry);
      else if (beforeStatus === "ok" && afterStatus !== "ok") diff.regressed.push(entry);
      else if (afterStatus !== "ok") diff.stillFailing.push(entry);
      else diff.unchanged.push(entry);
    }
  }
  return diff;
}

function buildReport(before, after, applied) {
  const final = after || before;
  const ok = final.failures.length === 0;
  return {
    schemaVersion: "v3",
    generatedAt: new Date().toISOString(),
    target: { schema: "public", table: "saved_quotes" },
    migration: { file: MIGRATION_FILE, applied: Boolean(applied) },
    ok,
    summary: {
      columns: {
        expected: EXPECTED_COLUMNS.length,
        ok: final.columns.filter((c) => c.status === "ok").length,
        missing: final.columns.filter((c) => c.status === "missing").length,
        typeMismatch: final.columns.filter((c) => c.status === "type_mismatch").length,
      },
      constraints: {
        expected: EXPECTED_CONSTRAINTS.length,
        ok: final.constraints.filter((c) => c.status === "ok").length,
        missing: final.constraints.filter((c) => c.status === "missing").length,
      },
      indexes: {
        expected: EXPECTED_INDEXES.length,
        ok: final.indexes.filter((i) => i.status === "ok").length,
        missing: final.indexes.filter((i) => i.status === "missing").length,
      },
    },
    checks: final,
    beforeApply: applied ? before : null,
    applyDiff: applied && after ? diffChecks(before, after) : null,
    recommendation: ok
      ? null
      : {
        migration: MIGRATION_FILE,
        command: `psql -v ON_ERROR_STOP=1 -f ${MIGRATION_FILE}`,
        followUp: "NOTIFY pgrst, 'reload schema';",
        note: "Re-run this script with --apply to auto-apply and re-verify.",
      },
  };
}

function printHumanSummary(report) {
  const { summary, checks, migration, ok, recommendation, applyDiff } = report;
  log("");
  log("=== saved_quotes quote-loss columns report ===");
  log(`  status     : ${ok ? "✅ OK" : "❌ FAIL"}`);
  log(`  generated  : ${report.generatedAt}`);
  log(`  migration  : ${migration.file}${migration.applied ? " (applied this run)" : ""}`);
  log(
    `  columns    : ${summary.columns.ok}/${summary.columns.expected} ok, ` +
      `${summary.columns.missing} missing, ${summary.columns.typeMismatch} type mismatch`,
  );
  log(
    `  constraints: ${summary.constraints.ok}/${summary.constraints.expected} ok, ` +
      `${summary.constraints.missing} missing`,
  );
  log(
    `  indexes    : ${summary.indexes.ok}/${summary.indexes.expected} ok, ` +
      `${summary.indexes.missing} missing`,
  );

  if (!ok) {
    log("\n  Missing items:");
    for (const f of checks.failures) {
      log(`    - [${f.kind}] ${f.message}`);
      log(`        migration: ${f.migration}`);
      const sqlLines = String(f.sql || "").split("\n");
      log(`        sql      : ${sqlLines[0]}`);
      for (const line of sqlLines.slice(1)) log(`                   ${line}`);
    }
    if (recommendation) {
      log("\n  Recommended migration:");
      log(`    file  : ${recommendation.migration}`);
      log(`    apply : ${recommendation.command}`);
      log(`    then  : ${recommendation.followUp}`);
      log(`    tip   : ${recommendation.note}`);
    }
  }

  if (applyDiff) {
    log("\n  === Apply diff (before → after) ===");
    log(
      `    fixed        : ${applyDiff.fixed.length}` +
        `   still failing: ${applyDiff.stillFailing.length}` +
        `   regressed: ${applyDiff.regressed.length}`,
    );
    for (const d of applyDiff.fixed) {
      log(`    ✅ [${d.kind}] ${d.name}: ${d.before} → ${d.after}`);
    }
    for (const d of applyDiff.stillFailing) {
      log(`    ❌ [${d.kind}] ${d.name}: ${d.before} → ${d.after}`);
    }
    for (const d of applyDiff.regressed) {
      log(`    ⚠️  [${d.kind}] ${d.name}: ${d.before} → ${d.after}`);
    }
  }
  log("");
}

function writeReportFile(report) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const ts = report.generatedAt.replace(/[:.]/g, "-");
  const path = resolve(REPORT_DIR, `quote-loss-columns-${ts}.json`);
  writeFileSync(path, JSON.stringify(report, null, 2));
  log(`  report file: ${path}`);
  return path;
}

// --- main ---
const before = runChecks();
let after = null;
let applied = false;

if (before.failures.length > 0 && APPLY) {
  warn(
    `[verify-quote-loss-columns] ${before.failures.length} issue(s) detected — attempting auto-apply...`,
  );
  for (const f of before.failures) warn(`  - [${f.kind}] ${f.message} (${f.migration})`);
  try {
    applyMigrationFile(MIGRATION_PATH);
    applied = true;
  } catch (e) {
    err("[verify-quote-loss-columns] migration apply failed:");
    err(e?.message || e);
    const report = buildReport(before, before, false);
    if (WRITE_REPORT) writeReportFile(report);
    if (JSON_ONLY) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
    else printHumanSummary(report);
    process.exit(1);
  }
  after = runChecks();
}

const report = buildReport(before, after, applied);

if (WRITE_REPORT) writeReportFile(report);
if (JSON_ONLY) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
else printHumanSummary(report);

process.exit(report.ok ? 0 : 1);
