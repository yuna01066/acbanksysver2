#!/usr/bin/env node
/**
 * 보안/린터 자동 수집 요약 리포트 생성기
 *
 * 수집 항목 (Supabase DB 린터 규칙과 동일한 관점):
 *   1. SECURITY DEFINER 함수에 anon / authenticated EXECUTE 권한이 남아있는 경우
 *      (lint 0028 / 0029)
 *   2. SECURITY DEFINER 함수의 search_path 미고정 (권한 상승 위험)
 *   3. RLS 가 켜져 있으나 정책이 없는 테이블 (lint 0008)
 *   4. public 테이블 중 RLS 미적용
 *   5. USING (true) 형태의 과도하게 개방된 정책
 *   6. SECURITY DEFINER 뷰
 *   7. anon 역할에 직접 부여된 테이블 쓰기 권한
 *
 * 출력:
 *   docs/operations/security-audit-report.md   (요약 리포트, 항상 갱신)
 *   scripts/reports/security-audit-<ts>.json   (--report 옵션 시 스냅샷 저장)
 *
 * 사용법:
 *   node scripts/security-audit-report.mjs            # 리포트 생성
 *   node scripts/security-audit-report.mjs --json      # JSON 만 stdout 출력
 *   node scripts/security-audit-report.mjs --report    # JSON 스냅샷도 저장
 *   node scripts/security-audit-report.mjs --strict     # warn 이상 존재 시 exit 1 (CI용)
 *
 * PG* 환경변수(Lovable Cloud 관리형 psql 접속 정보)가 필요합니다.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MD_PATH = resolve(ROOT, "docs/operations/security-audit-report.md");
const REPORT_DIR = resolve(__dirname, "reports");

const JSON_ONLY = process.argv.includes("--json");
const WRITE_SNAPSHOT = process.argv.includes("--report");
const STRICT = process.argv.includes("--strict");

function query(sql) {
  const out = execFileSync("psql", ["-At", "-F", "\u0001", "-c", sql], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return out
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\u0001"));
}

/** @type {{id:string,title:string,level:'error'|'warn'|'info',lint?:string,sql:string,advice:string}[]} */
const CHECKS = [
  {
    id: "definer_function_public_execute",
    title: "SECURITY DEFINER 함수에 anon 실행 권한 존재",
    level: "warn",
    lint: "0028_anon_security_definer_function_executable",
    advice:
      "공개 호출이 필요 없으면 REVOKE EXECUTE ON FUNCTION public.<fn> FROM anon; 또는 SECURITY INVOKER 로 변경",
    sql: `
      SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND has_function_privilege('anon', p.oid, 'EXECUTE')
      ORDER BY 1`,
  },
  {
    id: "definer_function_authenticated_execute",
    title: "SECURITY DEFINER 함수에 authenticated 실행 권한 존재",
    level: "warn",
    lint: "0029_authenticated_security_definer_function_executable",
    advice:
      "정책 헬퍼(has_role, is_approved_user 등)는 정상. 그 외 관리 기능 함수는 EXECUTE 권한 회수 검토",
    sql: `
      SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
      ORDER BY 1`,
  },
  {
    id: "definer_function_mutable_search_path",
    title: "SECURITY DEFINER 함수 search_path 미고정",
    level: "error",
    lint: "function_search_path_mutable",
    advice: "ALTER FUNCTION public.<fn> SET search_path = public; 적용",
    sql: `
      SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.prosecdef
        AND (p.proconfig IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
             ))
      ORDER BY 1`,
  },
  {
    id: "rls_enabled_no_policy",
    title: "RLS 활성화되었으나 정책 없음 (접근 전면 차단)",
    level: "warn",
    lint: "0008_rls_enabled_no_policy",
    advice: "필요한 SELECT/INSERT 정책 추가 또는 테이블 사용 여부 재검토",
    sql: `
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
        AND NOT EXISTS (SELECT 1 FROM pg_policy pol WHERE pol.polrelid = c.oid)
      ORDER BY 1`,
  },
  {
    id: "rls_disabled",
    title: "public 테이블에 RLS 미적용",
    level: "error",
    lint: "0013_rls_disabled_in_public",
    advice: "ALTER TABLE public.<t> ENABLE ROW LEVEL SECURITY; 후 정책 작성",
    sql: `
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
      ORDER BY 1`,
  },
  {
    id: "permissive_true_policy",
    title: "USING (true) 로 전면 개방된 정책",
    level: "warn",
    advice:
      "auth.uid() 기반 소유자 조건 또는 is_approved_user()/has_role() 조건으로 축소",
    sql: `
      SELECT tablename || ' :: ' || policyname || ' [' || cmd || ']'
      FROM pg_policies
      WHERE schemaname = 'public'
        AND (qual = 'true' OR with_check = 'true')
      ORDER BY 1`,
  },
  {
    id: "security_definer_view",
    title: "SECURITY DEFINER 뷰",
    level: "warn",
    lint: "0010_security_definer_view",
    advice: "security_invoker=on 으로 재정의하여 호출자 RLS 가 적용되게 변경",
    sql: `
      SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relkind IN ('v','m')
        AND EXISTS (
          SELECT 1 FROM unnest(coalesce(c.reloptions, '{}')) o
          WHERE o = 'security_invoker=false'
        )
      ORDER BY 1`,
  },
  {
    id: "anon_write_grants",
    title: "anon 역할에 테이블 쓰기 권한 부여",
    level: "error",
    advice: "REVOKE INSERT/UPDATE/DELETE ... FROM anon; 후 Edge Function 경유로 전환",
    sql: `
      SELECT table_name || ' :: ' || string_agg(privilege_type, ',' ORDER BY privilege_type)
      FROM information_schema.role_table_grants
      WHERE table_schema = 'public'
        AND grantee = 'anon'
        AND privilege_type IN ('INSERT','UPDATE','DELETE')
      GROUP BY table_name
      ORDER BY 1`,
  },
];

function run() {
  const results = [];
  for (const check of CHECKS) {
    try {
      const rows = query(check.sql).map((r) => r[0]);
      results.push({ ...check, ok: rows.length === 0, count: rows.length, items: rows });
    } catch (error) {
      results.push({
        ...check,
        ok: false,
        count: -1,
        items: [],
        error: String(error?.message ?? error).split("\n")[0],
      });
    }
  }
  return results;
}

function toMarkdown(results, generatedAt) {
  const totals = {
    error: results.filter((r) => !r.ok && r.level === "error").length,
    warn: results.filter((r) => !r.ok && r.level === "warn").length,
    info: results.filter((r) => !r.ok && r.level === "info").length,
    findings: results.reduce((sum, r) => sum + Math.max(r.count, 0), 0),
  };
  const badge = (level) => (level === "error" ? "🔴" : level === "warn" ? "🟠" : "🔵");

  const lines = [];
  lines.push("# 보안 · 린터 자동 수집 요약 리포트");
  lines.push("");
  lines.push(`- 생성 시각(UTC): ${generatedAt}`);
  lines.push(`- 생성 방법: \`npm run security:report\``);
  lines.push(
    `- 규칙 위반 항목: 🔴 ${totals.error}건 · 🟠 ${totals.warn}건 · 🔵 ${totals.info}건 (개별 대상 총 ${totals.findings}개)`
  );
  lines.push("");
  lines.push("## 요약 표");
  lines.push("");
  lines.push("| 심각도 | 점검 항목 | 대상 수 | 상태 |");
  lines.push("| --- | --- | --- | --- |");
  for (const r of results) {
    const status = r.error ? `조회 실패 (${r.error})` : r.ok ? "통과" : "조치 검토";
    lines.push(`| ${badge(r.level)} ${r.level} | ${r.title} | ${Math.max(r.count, 0)} | ${status} |`);
  }
  lines.push("");
  lines.push("## 상세");
  for (const r of results) {
    lines.push("");
    lines.push(`### ${badge(r.level)} ${r.title}`);
    if (r.lint) lines.push(`- 린터 규칙: \`${r.lint}\``);
    lines.push(`- 권장 조치: ${r.advice}`);
    if (r.error) {
      lines.push(`- 조회 실패: ${r.error}`);
      continue;
    }
    if (r.ok) {
      lines.push("- 해당 항목 없음 ✅");
      continue;
    }
    lines.push(`- 대상 ${r.count}개:`);
    for (const item of r.items.slice(0, 40)) lines.push(`  - \`${item}\``);
    if (r.items.length > 40) lines.push(`  - ...외 ${r.items.length - 40}개`);
  }
  lines.push("");
  lines.push("## 판단 기준 메모");
  lines.push("");
  lines.push(
    "- RLS 정책 헬퍼(`has_role`, `is_approved_user`, 트리거 함수)는 SECURITY DEFINER 가 정상이며 `authenticated` 실행 권한이 필요합니다."
  );
  lines.push(
    "- `search_path` 미고정 SECURITY DEFINER 함수는 예외 없이 수정 대상입니다."
  );
  lines.push(
    "- `anon` 쓰기 권한은 공개 위젯(상담/예약 접수)에서도 사용하지 않고 Edge Function 을 경유합니다."
  );
  lines.push("");
  return lines.join("\n");
}

const generatedAt = new Date().toISOString();
const results = run();
const payload = { generatedAt, results };

if (JSON_ONLY) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
} else {
  mkdirSync(dirname(MD_PATH), { recursive: true });
  writeFileSync(MD_PATH, toMarkdown(results, generatedAt), "utf8");
  console.log(`요약 리포트 생성: ${MD_PATH}`);
  for (const r of results) {
    const mark = r.error ? "ERR " : r.ok ? "PASS" : "FIND";
    console.log(`  [${mark}] ${r.level.toUpperCase().padEnd(5)} ${r.title} (${Math.max(r.count, 0)})`);
  }
}

if (WRITE_SNAPSHOT) {
  mkdirSync(REPORT_DIR, { recursive: true });
  const file = resolve(REPORT_DIR, `security-audit-${generatedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(`JSON 스냅샷 저장: ${file}`);
}

if (STRICT) {
  const blocking = results.filter((r) => !r.ok && (r.level === "error" || r.level === "warn"));
  if (blocking.length > 0) {
    console.error(`\n[strict] 조치 필요 항목 ${blocking.length}건`);
    process.exit(1);
  }
}
