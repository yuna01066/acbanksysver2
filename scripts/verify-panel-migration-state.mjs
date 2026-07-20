#!/usr/bin/env node
/**
 * Verify post-migration state of `panel_sizes` and `panel_option_surcharges`
 * against the seed VALUES declared in
 * `supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql`.
 *
 * Coverage:
 *   - panel_sizes:
 *       • active/inactive per size (소3*6, 대3*6 active; legacy 3*6 inactive)
 *       • **price matches AB+3% buffer seed for every (thickness, size)**
 *       • 100 KRW rounding invariant on every active row
 *   - panel_option_surcharges (global):
 *       • **cost matches seed for every (surcharge_type, size_name)**
 *       • 100 KRW rounding invariant
 *   - panel_option_surcharges (satin-color / astel-color):
 *       • allowed-size activation matches production constraint
 *       • cost matches per-quality seed
 *   - pricing_version present + active
 *
 * Exits 0 on success. On failure writes JSON evidence to
 * `scripts/reports/panel-migration-state-<ts>.json` and prints remedy actions.
 *
 * Requires PG* env vars (Lovable Cloud managed psql access).
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_DIR = resolve(__dirname, "reports");
const MIGRATION_PATH = resolve(
  __dirname,
  "..",
  "supabase/migrations/20260720090000_panel_prices_ab_buffer_2026.sql",
);
const VERSION_NAME = "A/B 원판 상한 2026-06-01 + 3%";

// ---- Static expectations (structural, not price) ----

const EXPECTED_ACTIVE_SIZES = new Set(["소3*6", "대3*6"]);
const EXPECTED_INACTIVE_SIZES = new Set(["3*6"]);
const REQUIRED_THICKNESSES = [
  "1.3T", "1.5T", "2T", "3T", "4T", "5T", "6T",
  "8T", "10T", "12T", "15T", "20T", "25T", "30T",
];

const EXPECTED_SATIN_ACTIVE = new Set(["대3*6", "1*2", "4*8"]);
const EXPECTED_ASTEL_ACTIVE = new Set(["대3*6", "4*5", "대4*5", "1*2", "4*8"]);

// ---- Parse seed VALUES from migration SQL ----

const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

/** Extract text between `seed(...) AS (\n  VALUES` and the closing `)\n` before next `INSERT INTO`. */
function extractSeedBlock(header) {
  const start = migrationSql.indexOf(header);
  if (start === -1) throw new Error(`Seed block not found: ${header}`);
  const valuesIdx = migrationSql.indexOf("VALUES", start);
  const insertIdx = migrationSql.indexOf("INSERT INTO", valuesIdx);
  return migrationSql.slice(valuesIdx + "VALUES".length, insertIdx);
}

/** Parse rows like `('a', 'b', 123, 'note')` into arrays of strings/numbers. */
function parseTuples(block) {
  const rows = [];
  const rx = /\(([^()]*)\)/g;
  let m;
  while ((m = rx.exec(block)) !== null) {
    const parts = [];
    let cur = "";
    let inStr = false;
    for (let i = 0; i < m[1].length; i++) {
      const ch = m[1][i];
      if (ch === "'") {
        if (inStr && m[1][i + 1] === "'") { cur += "'"; i++; continue; }
        inStr = !inStr;
        continue;
      }
      if (ch === "," && !inStr) { parts.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    parts.push(cur.trim());
    rows.push(parts.map((p) => (/^-?\d+(\.\d+)?$/.test(p) ? Number(p) : p)));
  }
  return rows;
}

// panel_sizes seed: (thickness, size_name, actual_width, actual_height, price)
const panelSizesSeed = parseTuples(
  extractSeedBlock("seed(thickness, size_name, actual_width, actual_height, price)"),
).map(([thickness, size_name, actual_width, actual_height, price]) => ({
  thickness, size_name, actual_width, actual_height, price,
}));

// global surcharges seed: (surcharge_type, size_name, cost, notes)
const globalSurchargeSeed = parseTuples(
  extractSeedBlock("seed(surcharge_type, size_name, cost, notes)"),
).map(([surcharge_type, size_name, cost /*, notes*/]) => ({
  surcharge_type, size_name, cost,
}));

// per-quality satin/astel seed: (quality_id, surcharge_type, size_name, cost, notes)
const qualitySurchargeSeed = parseTuples(
  extractSeedBlock("seed(quality_id, surcharge_type, size_name, cost, notes)"),
).map(([quality_id, surcharge_type, size_name, cost /*, notes*/]) => ({
  quality_id, surcharge_type, size_name, cost,
}));

// Derived indices for O(1) expected-price lookup
const EXPECTED_PRICE_BY_KEY = new Map(
  panelSizesSeed.map((r) => [`${r.thickness}||${r.size_name}`, r.price]),
);
const EXPECTED_GLOBAL_COST_BY_KEY = new Map(
  globalSurchargeSeed.map((r) => [`${r.surcharge_type}||${r.size_name}`, r.cost]),
);
const EXPECTED_QUALITY_COST_BY_KEY = new Map(
  qualitySurchargeSeed.map((r) => [`${r.quality_id}||${r.size_name}`, r.cost]),
);

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

const failures = [];
const warnings = [];
const evidence = {
  seed_counts: {
    panel_sizes: panelSizesSeed.length,
    global_surcharges: globalSurchargeSeed.length,
    quality_surcharges: qualitySurchargeSeed.length,
  },
};

// ---- 1. panel_sizes: activation + price ----

const sizeRows = psqlJson(`
  SELECT ps.thickness, ps.size_name, ps.is_active, ps.price::int AS price,
         ps.actual_width, ps.actual_height, pm.name AS panel_master_name
  FROM public.panel_sizes ps
  JOIN public.panel_masters pm ON pm.id = ps.panel_master_id
  JOIN public.panel_pricing_versions v ON v.id = ps.pricing_version_id
  WHERE v.version_name = '${VERSION_NAME}'
  ORDER BY pm.name, ps.size_name, ps.thickness
`);
evidence.panel_sizes = sizeRows;

// (a) activation checks per (master, thickness)
const groupedByMaster = {};
for (const r of sizeRows) {
  const key = `${r.panel_master_name}||${r.thickness}`;
  groupedByMaster[key] ??= { master: r.panel_master_name, thickness: r.thickness, sizes: {} };
  groupedByMaster[key].sizes[r.size_name] = r;
}
for (const { master, thickness, sizes } of Object.values(groupedByMaster)) {
  for (const s of EXPECTED_ACTIVE_SIZES) {
    if (!sizes[s]) {
      failures.push({ check: "panel_sizes.missing_active_row", panel_master: master, thickness, size_name: s });
    } else if (sizes[s].is_active !== true) {
      failures.push({ check: "panel_sizes.expected_active_but_inactive", panel_master: master, thickness, size_name: s, row: sizes[s] });
    }
  }
  for (const s of EXPECTED_INACTIVE_SIZES) {
    if (sizes[s]?.is_active === true) {
      failures.push({ check: "panel_sizes.legacy_size_still_active", panel_master: master, thickness, size_name: s, row: sizes[s] });
    }
  }
}

// (b) price check vs seed for EVERY seeded (thickness, size)
for (const seed of panelSizesSeed) {
  const key = `${seed.thickness}||${seed.size_name}`;
  const matches = sizeRows.filter((r) => r.thickness === seed.thickness && r.size_name === seed.size_name);
  if (matches.length === 0) {
    failures.push({ check: "panel_sizes.seed_row_missing_in_db", ...seed });
    continue;
  }
  for (const r of matches) {
    if (Number(r.price) !== seed.price) {
      failures.push({
        check: "panel_sizes.price_mismatch",
        panel_master: r.panel_master_name,
        thickness: seed.thickness,
        size_name: seed.size_name,
        expected_price: seed.price,
        actual_price: Number(r.price),
        delta: Number(r.price) - seed.price,
      });
    }
  }
  void key;
}

// (c) 100 KRW rounding invariant on every active row
for (const r of sizeRows) {
  if (r.is_active && Number(r.price) % 100 !== 0) {
    failures.push({
      check: "panel_sizes.price_not_rounded_to_100",
      panel_master: r.panel_master_name,
      thickness: r.thickness, size_name: r.size_name, price: Number(r.price),
    });
  }
}

// (d) required thicknesses seeded
const seenThicknesses = new Set(sizeRows.map((r) => r.thickness));
for (const t of REQUIRED_THICKNESSES) {
  if (!seenThicknesses.has(t)) warnings.push({ check: "panel_sizes.thickness_not_seeded", thickness: t });
}

// ---- 2. panel_option_surcharges (global) ----

const globalSurcharges = psqlJson(`
  SELECT quality_id, surcharge_type, size_name, cost::int AS cost, is_active
  FROM public.panel_option_surcharges
  WHERE quality_id = 'global'
  ORDER BY surcharge_type, size_name
`);
evidence.global_surcharges = globalSurcharges;

for (const seed of globalSurchargeSeed) {
  const row = globalSurcharges.find(
    (r) => r.surcharge_type === seed.surcharge_type && r.size_name === seed.size_name,
  );
  if (!row) {
    failures.push({ check: "global_surcharge.missing", ...seed });
    continue;
  }
  // Legacy size `3*6` is force-deactivated by the migration's final step (line 407),
  // so expect inactive for that size only. All other seeded sizes must be active.
  const expectedActive = seed.size_name !== "3*6";
  if (expectedActive && !row.is_active) {
    failures.push({ check: "global_surcharge.inactive", ...seed, row });
  } else if (!expectedActive && row.is_active) {
    failures.push({ check: "global_surcharge.legacy_still_active", ...seed, row });
  }
  if (Number(row.cost) !== seed.cost) {
    failures.push({
      check: "global_surcharge.cost_mismatch",
      surcharge_type: seed.surcharge_type,
      size_name: seed.size_name,
      expected: seed.cost,
      actual: Number(row.cost),
      delta: Number(row.cost) - seed.cost,
    });
  }
  if (Number(row.cost) % 100 !== 0) {
    failures.push({
      check: "global_surcharge.cost_not_rounded_to_100",
      surcharge_type: seed.surcharge_type, size_name: seed.size_name, cost: Number(row.cost),
    });
  }
}

// ---- 3. satin-color / astel-color surcharges ----

const qualitySurcharges = psqlJson(`
  SELECT quality_id, size_name, cost::int AS cost, is_active, notes
  FROM public.panel_option_surcharges
  WHERE surcharge_type = 'satin_astel'
    AND quality_id IN ('satin-color', 'astel-color')
  ORDER BY quality_id, size_name
`);
evidence.satin_astel_surcharges = qualitySurcharges;

function checkQuality(qualityId, expectedActive) {
  const rows = qualitySurcharges.filter((r) => r.quality_id === qualityId);
  const activeSizes = new Set(rows.filter((r) => r.is_active).map((r) => r.size_name));
  for (const size of expectedActive) {
    if (!activeSizes.has(size)) {
      failures.push({
        check: "quality_surcharge.missing_or_inactive",
        quality_id: qualityId, size_name: size,
        row: rows.find((r) => r.size_name === size) ?? null,
      });
    }
  }
  for (const size of activeSizes) {
    if (!expectedActive.has(size)) {
      failures.push({
        check: "quality_surcharge.unexpected_active_size",
        quality_id: qualityId, size_name: size,
        row: rows.find((r) => r.size_name === size),
      });
    }
  }
  // Per-quality seed price check
  for (const seed of qualitySurchargeSeed.filter((s) => s.quality_id === qualityId)) {
    const row = rows.find((r) => r.size_name === seed.size_name && r.is_active);
    if (row && Number(row.cost) !== seed.cost) {
      failures.push({
        check: "quality_surcharge.cost_mismatch",
        quality_id: qualityId, size_name: seed.size_name,
        expected: seed.cost, actual: Number(row.cost),
        delta: Number(row.cost) - seed.cost,
      });
    }
    if (row && Number(row.cost) % 100 !== 0) {
      failures.push({
        check: "quality_surcharge.cost_not_rounded_to_100",
        quality_id: qualityId, size_name: seed.size_name, cost: Number(row.cost),
      });
    }
  }
}

checkQuality("satin-color", EXPECTED_SATIN_ACTIVE);
checkQuality("astel-color", EXPECTED_ASTEL_ACTIVE);

// ---- 4. pricing version ----

const versionRow = psqlJson(`
  SELECT id, version_name, is_active, effective_from
  FROM public.panel_pricing_versions
  WHERE version_name = '${VERSION_NAME}'
`);
evidence.pricing_version = versionRow;
if (versionRow.length === 0) {
  failures.push({ check: "pricing_version.missing", label: VERSION_NAME });
} else if (!versionRow[0].is_active) {
  warnings.push({ check: "pricing_version.not_active", row: versionRow[0] });
}

// ---- Report ----

const summary = {
  status: failures.length === 0 ? "ok" : "failed",
  checked_at: new Date().toISOString(),
  counts: {
    seed_panel_sizes: panelSizesSeed.length,
    seed_global_surcharges: globalSurchargeSeed.length,
    seed_quality_surcharges: qualitySurchargeSeed.length,
    db_panel_size_rows: sizeRows.length,
    db_global_surcharge_rows: globalSurcharges.length,
    db_satin_astel_rows: qualitySurcharges.length,
    failures: failures.length,
    warnings: warnings.length,
  },
};

if (failures.length === 0) {
  console.log(JSON.stringify({ ...summary, warnings }, null, 2));
  console.log("✅ panel migration state verified (activation + AB+3% buffer prices)");
  process.exit(0);
} else {
  const reportPath = writeReport({ summary, failures, warnings, evidence });

  const REMEDY = {
    "panel_sizes.missing_active_row":              "seed 미삽입. migration 재실행 필요 (idempotent).",
    "panel_sizes.expected_active_but_inactive":    "is_active 갱신 실패. migration 재실행 필요.",
    "panel_sizes.legacy_size_still_active":        "레거시 3*6 비활성화 누락. migration 재실행 필요.",
    "panel_sizes.seed_row_missing_in_db":          "seed 행이 DB에 반영되지 않음. migration 재실행 필요.",
    "panel_sizes.price_mismatch":                  "가격이 AB+3% 버퍼 seed와 불일치. 수동 수정 흔적 조사 후 롤백/재적용.",
    "panel_sizes.price_not_rounded_to_100":        "100원 단위 반올림 불변식 위반. seed 수정 또는 롤백 필요.",
    "global_surcharge.missing":                    "global 서차지 seed 미삽입. migration 재실행 필요.",
    "global_surcharge.inactive":                   "global 서차지 비활성. migration 재실행 필요.",
    "global_surcharge.cost_mismatch":              "global 서차지 금액 불일치. 수동 UPDATE 흔적 조사 후 롤백/재적용.",
    "global_surcharge.cost_not_rounded_to_100":    "100원 단위 반올림 불변식 위반.",
    "quality_surcharge.missing_or_inactive":       "satin/astel 서차지 seed 실패. migration 재실행 필요.",
    "quality_surcharge.unexpected_active_size":    "허용 사이즈 외 활성 행 존재. 수동 UPDATE 흔적 조사 후 재실행.",
    "quality_surcharge.cost_mismatch":             "서차지 금액 불일치. 수동 수정 흔적. 롤백 후 재적용 검토.",
    "quality_surcharge.cost_not_rounded_to_100":   "100원 단위 반올림 불변식 위반.",
    "pricing_version.missing":                     "새 pricing version 자체가 없음. migration 전체 재실행 필요.",
  };
  const categories = [...new Set(failures.map((f) => f.check))];

  console.error(JSON.stringify(summary, null, 2));
  console.error(`\n❌ ${failures.length} failure(s) across ${categories.length} categor(y/ies).`);
  console.error("\nFirst 5 failures:");
  for (const f of failures.slice(0, 5)) console.error("  -", JSON.stringify(f));

  console.error("\n⚠️  Recommended actions:");
  for (const cat of categories) {
    console.error(`  • [${cat}] ${REMEDY[cat] ?? "원인 조사 후 재실행 검토."}`);
  }

  console.error(`\n📄 Full report: ${reportPath}`);
  console.error("📘 Runbook:     docs/operations/panel-migration-rollback-runbook.md");
  console.error("🔁 Retry:       bun run verify:panel-migration (after re-applying migration)");
  console.error("↩️  Rollback:    see runbook §2 (신규 version 비활성 + 이전 version 재활성)\n");
  process.exit(1);
}
