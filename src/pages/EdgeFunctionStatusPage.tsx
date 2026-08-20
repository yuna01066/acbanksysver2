import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Loader2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseFunctionUrl } from '@/lib/supabaseFunctions';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const STORAGE_KEY = 'edge-function-status-v1';

type FunctionGroup = '견적/판매' | '인사/급여' | '문서/스토리지' | '외부 연동';

const EDGE_FUNCTIONS: { name: string; label: string; group: FunctionGroup }[] = [
  { name: 'auto-expire-quotes', label: '견적 자동 만료', group: '견적/판매' },
  { name: 'quote-wizard', label: '견적 위저드', group: '견적/판매' },
  { name: 'simulate-tax', label: '연말정산 시뮬레이션', group: '인사/급여' },
  { name: 'calculate-salary', label: '급여 계산', group: '인사/급여' },
  { name: 'leave-promotion-check', label: '연차 촉진 점검', group: '인사/급여' },
  { name: 'overtime-detection', label: '초과근무 감지', group: '인사/급여' },
  { name: 'password-reset', label: '비밀번호 재설정', group: '인사/급여' },
  { name: 'gcs-storage', label: 'GCS 스토리지', group: '문서/스토리지' },
  { name: 'migrate-storage-to-gcs', label: 'GCS 마이그레이션', group: '문서/스토리지' },
  { name: 'google-drive', label: 'Google Drive 연동', group: '문서/스토리지' },
  { name: 'ocr-document', label: '문서 OCR', group: '문서/스토리지' },
  { name: 'extract-business-info', label: '사업자정보 추출', group: '외부 연동' },
  { name: 'notion-projects', label: 'Notion 프로젝트', group: '외부 연동' },
  { name: 'popbill-api', label: '팝빌 세금계산서', group: '외부 연동' },
];

const GROUPS: FunctionGroup[] = ['견적/판매', '인사/급여', '문서/스토리지', '외부 연동'];

type CheckState = 'ok' | 'warn' | 'fail';

interface CheckResult {
  name: string;
  status: number | null;
  state: CheckState;
  durationMs: number;
  checkedAt: string;
  detail: string;
}

function classify(status: number | null): CheckState {
  if (status === null) return 'fail';
  if (status < 400) return 'ok';
  // 401/403/405 등은 함수가 살아있고 요청만 거부한 것 → 정상 응답으로 간주
  if ([401, 403, 405, 400, 404, 422].includes(status)) return 'warn';
  return 'fail';
}

async function checkFunction(name: string): Promise<CheckResult> {
  const startedAt = performance.now();
  try {
    const response = await fetch(getSupabaseFunctionUrl(name), {
      method: 'OPTIONS',
      headers: { 'x-health-check': '1' },
    });
    const durationMs = Math.round(performance.now() - startedAt);
    return {
      name,
      status: response.status,
      state: classify(response.status),
      durationMs,
      checkedAt: new Date().toISOString(),
      detail: response.statusText || `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      name,
      status: null,
      state: 'fail',
      durationMs: Math.round(performance.now() - startedAt),
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : '요청 실패',
    };
  }
}

const STATE_META: Record<CheckState, { label: string; icon: React.ElementType; className: string }> = {
  ok: { label: '정상', icon: CheckCircle2, className: 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400' },
  warn: { label: '응답함(요청 거부)', icon: AlertTriangle, className: 'border-amber-500/40 text-amber-600 dark:text-amber-400' },
  fail: { label: '실패', icon: XCircle, className: 'border-destructive/40 text-destructive' },
};

export default function EdgeFunctionStatusPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [results, setResults] = useState<Record<string, CheckResult>>({});
  const [running, setRunning] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { results: Record<string, CheckResult>; lastRunAt: string | null };
        setResults(parsed.results || {});
        setLastRunAt(parsed.lastRunAt || null);
      }
    } catch { /* ignore */ }
  }, []);

  const persist = useCallback((next: Record<string, CheckResult>, runAt: string | null) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ results: next, lastRunAt: runAt }));
    } catch { /* ignore */ }
  }, []);

  const runChecks = useCallback(async (names: string[]) => {
    setRunning((prev) => Array.from(new Set([...prev, ...names])));
    const settled = await Promise.all(names.map((name) => checkFunction(name)));
    const runAt = new Date().toISOString();
    setResults((prev) => {
      const next = { ...prev };
      settled.forEach((r) => { next[r.name] = r; });
      persist(next, runAt);
      return next;
    });
    setLastRunAt(runAt);
    setRunning((prev) => prev.filter((n) => !names.includes(n)));
    const failed = settled.filter((r) => r.state === 'fail').length;
    if (names.length > 1) {
      if (failed > 0) toast.error(`${names.length}개 검증 완료 · 실패 ${failed}건`);
      else toast.success(`${names.length}개 Edge Function 검증 완료`);
    }
  }, [persist]);

  const summary = useMemo(() => {
    const list = EDGE_FUNCTIONS.map((f) => results[f.name]).filter(Boolean) as CheckResult[];
    return {
      checked: list.length,
      ok: list.filter((r) => r.state === 'ok').length,
      warn: list.filter((r) => r.state === 'warn').length,
      fail: list.filter((r) => r.state === 'fail').length,
      avgMs: list.length ? Math.round(list.reduce((sum, r) => sum + r.durationMs, 0) / list.length) : 0,
    };
  }, [results]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return EDGE_FUNCTIONS;
    return EDGE_FUNCTIONS.filter((f) => f.name.toLowerCase().includes(q) || f.label.toLowerCase().includes(q));
  }, [search]);

  const allRunning = running.length > 0;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="mr-1 h-4 w-4" /> 홈
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Edge Function 상태 대시보드</h1>
              <p className="text-xs text-muted-foreground">
                {lastRunAt
                  ? `마지막 전체 검증: ${new Date(lastRunAt).toLocaleString('ko-KR')} (${formatDistanceToNow(new Date(lastRunAt), { addSuffix: true, locale: ko })})`
                  : '아직 검증 기록이 없습니다.'}
              </p>
            </div>
          </div>
          <Button size="sm" onClick={() => runChecks(EDGE_FUNCTIONS.map((f) => f.name))} disabled={allRunning}>
            {allRunning ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
            전체 검증 실행
          </Button>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { label: '대상 함수', value: `${EDGE_FUNCTIONS.length}개` },
            { label: '검증됨', value: `${summary.checked}개` },
            { label: '정상', value: `${summary.ok}건` },
            { label: '응답함(거부)', value: `${summary.warn}건` },
            { label: '실패', value: `${summary.fail}건` },
          ].map((item) => (
            <Card key={item.label} className="shadow-none">
              <CardContent className="p-4">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-semibold">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mb-4 flex items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="함수명 또는 기능명 검색"
              className="pl-9"
            />
          </div>
          {summary.avgMs > 0 && (
            <span className="text-xs text-muted-foreground">평균 응답 {summary.avgMs}ms</span>
          )}
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => {
            const items = filtered.filter((f) => f.group === group);
            if (!items.length) return null;
            return (
              <Card key={group} className="shadow-none">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">{group}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-0">
                  {items.map((fn) => {
                    const result = results[fn.name];
                    const meta = result ? STATE_META[result.state] : null;
                    const Icon = meta?.icon;
                    const isRunning = running.includes(fn.name);
                    return (
                      <div
                        key={fn.name}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{fn.label}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">{fn.name}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {result ? (
                            <>
                              <Badge variant="outline" className={meta?.className}>
                                {Icon && <Icon className="mr-1 h-3 w-3" />}
                                {meta?.label}
                              </Badge>
                              <Badge variant="secondary" className="font-mono text-[11px]">
                                {result.status ?? 'ERR'}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">{result.durationMs}ms</span>
                              <span className="text-[11px] text-muted-foreground">
                                {formatDistanceToNow(new Date(result.checkedAt), { addSuffix: true, locale: ko })}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">검증 기록 없음</span>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => runChecks([fn.name])} disabled={isRunning}>
                            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
          검증은 각 함수 엔드포인트에 부작용 없는 OPTIONS(preflight) 요청을 보내 응답 코드와 응답 시간을 측정합니다.
          401/403/405 등은 함수가 정상 동작하며 요청만 거부한 상태로 표시됩니다.
        </p>
      </div>
    </div>
  );
}
