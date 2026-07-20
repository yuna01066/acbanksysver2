#!/usr/bin/env node
/**
 * Verify post-migration state of `panel_sizes` and satin/astel entries in
 * `panel_option_surcharges` against the expectations declared in
 * `supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql`.
 *
 * Exits with code 0 on success. On failure, writes a detailed report to
 * `scripts/reports/panel-migration-state-<timestamp>.json` and prints a
 * summary to stderr.
 *
 * Requires PG* env vars (Lovable Cloud managed psql access).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = resolve(__dirname, "reports");

// ---- Expected state (from migration 20260720090000_panel_prices_ab_buffer_2026) ----

const EXPECTED_ACTIVE_SIZES = new Set(["소3*6", "대3*6"]);
const EXPECTED_INACTIVE_SIZES = new Set(["3*6"]);
const REQUIRED_THICKNESSES = [
  "1.3T", "1.5T", "2T", "3T", "4T", "5T", "6T",
  "8T", "10T", "12T", "15T", "20T", "25T", "30T",
];

// Expected active satin/astel size lists for restricted qualities
const EXPECTED_SATIN_ACTIVE = new Set(["대3*6", "1*2", "4*8"]);
const EXPECTED_ASTEL_ACTIVE = new Set(["대3*6", "4*5", "대4*5", "1*2", "4*8"]);

// Expected surcharge cost per (quality, size)
const EXPECTED_SATIN_COSTS = {
  "대3*6": 7300,
  "1*2": 10300,
  "4*8": 14500,
};
const EXPECTED_ASTEL_COSTS = {
  "대3*6": 5200,
  "4*5": 5200,
  "대4*5": 6200,
  "1*2": 7300,
  "4*8": 10300,
};

// ---- Helpers ----

function psqlJson(sql) {
  const out = execFileSync(
    "psql",
    ["-Atq", "-c", `SELECT COALESCE(json_agg(t), '[]'::json) FROM (${sql}) t;`],
    { encoding: "utf8" },
  );
  return JSON.parse(out.trim() || "[]");
}

function writeReport(payload) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = resolve(REPORT_DIR, `panel-migration-state-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

// ---- Checks ----

const failures = [];
const warnings = [];
const evidence = {};

// 1. panel_sizes: active/inactive by size_name
const sizeRows = psqlJson(`
  SELECT thickness, size_name, is_active, price, actual_width, actual_height
  FROM public.panel_sizes
  WHERE size_name IN ('3*6', '소3*6', '대3*6')
  ORDER BY size_name, thickness
`);
evidence.panel_sizes = sizeRows;

const groupedByThickness = {};
for (const r of sizeRows) {
  groupedByThickness[r.thickness] ??= {};
  groupedByThickness[r.thickness][r.size_name] = r;
}

for (const t of REQUIRED_THICKNESSES) {
  const g = groupedByThickness[t] || {};
  for (const s of EXPECTED_ACTIVE_SIZES) {
    if (!g[s]) {
      failures.push({ check: "panel_sizes.missing_active_row", thickness: t, size_name: s });
    } else if (g[s].is_active !== true) {
      failures.push({
        check: "panel_sizes.expected_active_but_inactive",
        thickness: t, size_name: s, row: g[s],
      });
    }
  }
  for (const s of EXPECTED_INACTIVE_SIZES) {
    if (g[s] && g[s].is_active === true) {
      failures.push({
        check: "panel_sizes.legacy_size_still_active",
        thickness: t, size_name: s, row: g[s],
      });
    }
  }
}

// 2. satin-color / astel-color allowed sizes
const surchargeRows = psqlJson(`
  SELECT quality_id, size_name, cost, is_active, notes
  FROM public.panel_option_surcharges
  WHERE surcharge_type = 'satin_astel'
    AND quality_id IN ('satin-color', 'astel-color')
  ORDER BY quality_id, size_name
`);
evidence.satin_astel_surcharges = surchargeRows;

function checkQuality(qualityId, expectedActive, expectedCosts) {
  const rows = surchargeRows.filter((r) => r.quality_id === qualityId);
  const activeSizes = new Set(rows.filter((r) => r.is_active).map((r) => r.size_name));

  // Missing expected active
  for (const size of expectedActive) {
    if (!activeSizes.has(size)) {
      failures.push({
        check: "surcharge.missing_or_inactive",
        quality_id: qualityId, size_name: size,
        row: rows.find((r) => r.size_name === size) ?? null,
      });
    }
  }
  // Unexpected active
  for (const size of activeSizes) {
    if (!expectedActive.has(size)) {
      failures.push({
        check: "surcharge.unexpected_active_size",
        quality_id: qualityId, size_name: size,
        row: rows.find((r) => r.size_name === size),
      });
    }
  }
  // Cost mismatch
  for (const [size, cost] of Object.entries(expectedCosts)) {
    const row = rows.find((r) => r.size_name === size && r.is_active);
    if (row && Number(row.cost) !== cost) {
      failures.push({
        check: "surcharge.cost_mismatch",
        quality_id: qualityId, size_name: size,
        expected: cost, actual: Number(row.cost),
      });
    }
  }
}

checkQuality("satin-color", EXPECTED_SATIN_ACTIVE, EXPECTED_SATIN_COSTS);
checkQuality("astel-color", EXPECTED_ASTEL_ACTIVE, EXPECTED_ASTEL_COSTS);

// 3. Sanity: pricing version reference present
const versionRow = psqlJson(`
  SELECT id, label, is_active, effective_from
  FROM public.panel_pricing_versions
  WHERE label = 'A/B 원판 상한 2026-06-01 + 3%'
`);
evidence.pricing_version = versionRow;
if (versionRow.length === 0) {
  failures.push({ check: "pricing_version.missing", label: "A/B 원판 상한 2026-06-01 + 3%" });
} else if (!versionRow[0].is_active) {
  warnings.push({ check: "pricing_version.not_active", row: versionRow[0] });
}

// ---- Report ----

const summary = {
  status: failures.length === 0 ? "ok" : "failed",
  checked_at: new Date().toISOString(),
  counts: {
    panel_size_rows: sizeRows.length,
    satin_astel_rows: surchargeRows.length,
    failures: failures.length,
    warnings: warnings.length,
  },
};

if (failures.length === 0) {
  console.log(JSON.stringify({ ...summary, warnings }, null, 2));
  console.log("✅ panel migration state verified");
  process.exit(0);
} else {
  const reportPath = writeReport({ summary, failures, warnings, evidence });
  console.error(JSON.stringify(summary, null, 2));
  console.error(`❌ ${failures.length} failure(s). First 5:`);
  for (const f of failures.slice(0, 5)) console.error("  -", JSON.stringify(f));
  console.error(`\n📄 Full report: ${reportPath}`);
  process.exit(1);
}
