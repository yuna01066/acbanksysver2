import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

type Quality = 'glossy-color' | 'satin-color' | 'astel-color' | string;

interface PricingVersion {
  id: string;
  version_name: string;
  supplier_name: string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_active: boolean;
  source_note: string | null;
}

interface PanelMaster {
  id: string;
  quality: Quality;
}

interface PanelSizeRow {
  id: string;
  panel_master_id: string;
  thickness: string;
  size_name: string;
  price: number;
  pricing_version_id: string | null;
  is_active: boolean;
}

interface OptionSurchargeRow {
  quality_id: string;
  surcharge_type: 'double_surface' | 'satin_astel' | 'bright_pigment' | string;
  size_name: string;
  cost: number;
  is_active: boolean;
}

// Allowed sizes for satin/astel — mirrors migration 20260720090000.
const ALLOWED_SATIN_ASTEL: Record<string, string[]> = {
  'satin-color': ['대3*6', '1*2', '4*8'],
  'astel-color': ['대3*6', '4*5', '대4*5', '1*2', '4*8'],
};

const THICKNESS_ORDER = [
  '1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '15T', '20T', '25T', '30T',
];
const SIZE_ORDER = [
  '소3*6', '3*6', '대3*6', '4*5', '대4*5', '소1*2', '1*2', '4*6', '4*8', '4*10', '5*6', '5*8',
];

const QUALITY_LABEL: Record<string, string> = {
  'glossy-color': 'Glossy Color (유광)',
  'satin-color': 'Satin Color (사틴)',
  'astel-color': 'Astel Color (아스텔)',
};

interface Discrepancy {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  details?: string;
}

export default function PanelPricingImpactPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<PricingVersion[]>([]);
  const [masters, setMasters] = useState<PanelMaster[]>([]);
  const [sizes, setSizes] = useState<PanelSizeRow[]>([]);
  const [surcharges, setSurcharges] = useState<OptionSurchargeRow[]>([]);
  const [quality, setQuality] = useState<Quality>('glossy-color');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      toast.error('관리자만 접근할 수 있습니다.');
      navigate('/');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [v, m, s, o] = await Promise.all([
        (supabase as any)
          .from('panel_pricing_versions')
          .select('id, version_name, supplier_name, effective_from, effective_to, is_active, source_note')
          .order('effective_from', { ascending: false }),
        (supabase as any).from('panel_masters').select('id, quality'),
        (supabase as any)
          .from('panel_sizes')
          .select('id, panel_master_id, thickness, size_name, price, pricing_version_id, is_active'),
        (supabase as any)
          .from('panel_option_surcharges')
          .select('quality_id, surcharge_type, size_name, cost, is_active'),
      ]);
      if (v.error) throw v.error;
      if (m.error) throw m.error;
      if (s.error) throw s.error;
      if (o.error) throw o.error;
      setVersions(v.data ?? []);
      setMasters(m.data ?? []);
      setSizes(s.data ?? []);
      setSurcharges(o.data ?? []);
    } catch (e) {
      console.error(e);
      toast.error('가격 데이터를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeVersion = useMemo(() => versions.find(v => v.is_active) ?? null, [versions]);
  const activeVersionCount = versions.filter(v => v.is_active).length;

  const mastersByQuality = useMemo(() => {
    const map = new Map<string, string>();
    masters.forEach(m => map.set(m.quality, m.id));
    return map;
  }, [masters]);

  // ---- Discrepancies ------------------------------------------------------
  const discrepancies = useMemo<Discrepancy[]>(() => {
    const out: Discrepancy[] = [];

    if (activeVersionCount === 0) {
      out.push({ id: 'no-active-version', severity: 'critical', category: '버전',
        message: '활성화된 가격 버전이 없습니다.' });
    } else if (activeVersionCount > 1) {
      out.push({ id: 'multi-active-version', severity: 'critical', category: '버전',
        message: `활성 가격 버전이 ${activeVersionCount}개입니다. 정확히 1개여야 합니다.` });
    }

    // Legacy 3*6 still active
    const legacyActiveSizes = sizes.filter(s => s.size_name === '3*6' && s.is_active);
    if (legacyActiveSizes.length > 0) {
      out.push({ id: 'legacy-36-active', severity: 'critical', category: '레거시 3*6',
        message: `레거시 '3*6' 원판 사이즈 ${legacyActiveSizes.length}행이 여전히 활성 상태입니다.`,
        details: '2026-06-01 이후 소3*6 / 대3*6만 사용되어야 합니다.' });
    }
    const legacyActiveSurcharges = surcharges.filter(x => x.size_name === '3*6' && x.is_active);
    if (legacyActiveSurcharges.length > 0) {
      out.push({ id: 'legacy-36-surcharge-active', severity: 'critical', category: '레거시 3*6',
        message: `레거시 '3*6' 옵션 서차지 ${legacyActiveSurcharges.length}행이 활성 상태입니다.` });
    }

    // 100-KRW buffer rounding invariant
    const notRoundedPrices = sizes.filter(s => s.is_active && s.price % 100 !== 0);
    if (notRoundedPrices.length > 0) {
      out.push({ id: 'buffer-rounding-panels', severity: 'warning', category: '3% 버퍼',
        message: `100원 단위가 아닌 활성 원판 가격 ${notRoundedPrices.length}건.`,
        details: notRoundedPrices.slice(0, 3).map(p => `${p.thickness} ${p.size_name}=${p.price.toLocaleString()}`).join(', ') });
    }
    const notRoundedSur = surcharges.filter(x => x.is_active && x.cost % 100 !== 0);
    if (notRoundedSur.length > 0) {
      out.push({ id: 'buffer-rounding-surcharges', severity: 'warning', category: '3% 버퍼',
        message: `100원 단위가 아닌 활성 서차지 ${notRoundedSur.length}건.` });
    }

    // Glossy replacement 3*6 sizes must be active
    const glossyId = mastersByQuality.get('glossy-color');
    if (glossyId) {
      for (const req of ['소3*6', '대3*6']) {
        const rows = sizes.filter(s => s.panel_master_id === glossyId && s.size_name === req && s.is_active);
        if (rows.length === 0) {
          out.push({ id: `glossy-missing-${req}`, severity: 'critical', category: 'AB 대체 사이즈',
            message: `glossy-color에 '${req}' 활성 원판이 없습니다.` });
        }
      }
    }

    // Satin/Astel size restriction
    for (const q of ['satin-color', 'astel-color']) {
      const mid = mastersByQuality.get(q);
      if (!mid) continue;
      const allowed = ALLOWED_SATIN_ASTEL[q] ?? [];
      const bad = sizes.filter(s => s.panel_master_id === mid && s.is_active && !allowed.includes(s.size_name));
      if (bad.length > 0) {
        const uniq = Array.from(new Set(bad.map(b => b.size_name)));
        out.push({ id: `${q}-out-of-allowed`, severity: 'warning', category: '생산 규격 제한',
          message: `${QUALITY_LABEL[q]}의 허용 외 사이즈가 활성 상태입니다.`,
          details: `허용: ${allowed.join(', ')} / 발견: ${uniq.join(', ')}` });
      }
    }

    if (out.length === 0) {
      out.push({ id: 'ok', severity: 'info', category: '정상',
        message: '검출된 불일치가 없습니다. 가격 데이터가 AB+3% 규칙과 일치합니다.' });
    }
    return out;
  }, [sizes, surcharges, mastersByQuality, activeVersionCount]);

  // ---- Impact pivot (thickness × size) -----------------------------------
  const currentMasterId = mastersByQuality.get(quality);
  const filteredSizes = useMemo(
    () => sizes.filter(s => s.panel_master_id === currentMasterId),
    [sizes, currentMasterId],
  );
  const usedThicknesses = useMemo(() => {
    const set = new Set(filteredSizes.map(s => s.thickness));
    const ordered = THICKNESS_ORDER.filter(t => set.has(t));
    const extras = [...set].filter(t => !THICKNESS_ORDER.includes(t)).sort();
    return [...ordered, ...extras];
  }, [filteredSizes]);
  const usedSizes = useMemo(() => {
    const set = new Set(filteredSizes.map(s => s.size_name));
    const ordered = SIZE_ORDER.filter(s => set.has(s));
    const extras = [...set].filter(s => !SIZE_ORDER.includes(s)).sort();
    return [...ordered, ...extras];
  }, [filteredSizes]);
  const priceLookup = useMemo(() => {
    const map = new Map<string, PanelSizeRow>();
    filteredSizes.forEach(s => map.set(`${s.thickness}|${s.size_name}`, s));
    return map;
  }, [filteredSizes]);

  const activeRows = filteredSizes.filter(s => s.is_active);
  const activeMax = activeRows.reduce((m, r) => Math.max(m, r.price), 0);
  const activeMin = activeRows.reduce((m, r) => Math.min(m, r.price), Number.MAX_SAFE_INTEGER);

  const priceHeatColor = (price: number) => {
    if (!activeMax || activeMax === activeMin) return 'bg-muted/40';
    const t = (price - activeMin) / (activeMax - activeMin);
    if (t > 0.75) return 'bg-red-500/15 text-red-700 dark:text-red-300';
    if (t > 0.5) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
    if (t > 0.25) return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
  };

  // ---- Surcharge summary --------------------------------------------------
  const surchargeGroups = useMemo(() => {
    const groups = new Map<string, OptionSurchargeRow[]>();
    surcharges.forEach(s => {
      const k = `${s.quality_id}|${s.surcharge_type}`;
      const arr = groups.get(k) ?? [];
      arr.push(s);
      groups.set(k, arr);
    });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [surcharges]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin-settings')}>
            <ArrowLeft className="mr-1 h-4 w-4" /> 관리자 설정
          </Button>
          <h1 className="text-xl font-semibold">AB+버퍼 가격 영향 대시보드</h1>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="mr-1 h-4 w-4" /> 새로고침
        </Button>
      </div>

      {/* Active version card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">활성 가격 버전</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {activeVersion ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="default">{activeVersion.version_name}</Badge>
                {activeVersion.supplier_name && (
                  <Badge variant="secondary">{activeVersion.supplier_name}</Badge>
                )}
                <span className="text-muted-foreground">
                  적용 시작 {activeVersion.effective_from ?? '-'}
                </span>
              </div>
              {activeVersion.source_note && (
                <p className="text-muted-foreground">{activeVersion.source_note}</p>
              )}
            </>
          ) : (
            <p className="text-destructive">활성화된 가격 버전이 없습니다.</p>
          )}
          <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
            <Stat label="활성 원판 행" value={sizes.filter(s => s.is_active).length} />
            <Stat label="활성 서차지 행" value={surcharges.filter(s => s.is_active).length} />
            <Stat label="레거시 3*6 활성" value={sizes.filter(s => s.size_name === '3*6' && s.is_active).length}
              tone={sizes.some(s => s.size_name === '3*6' && s.is_active) ? 'bad' : 'ok'} />
            <Stat label="가격 버전 수" value={versions.length} />
          </div>
        </CardContent>
      </Card>

      {/* Discrepancies */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> 불일치 감지
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {discrepancies.map(d => (
            <div
              key={d.id}
              className={
                'flex items-start gap-2 rounded-md border p-3 text-sm ' +
                (d.severity === 'critical' ? 'border-destructive/40 bg-destructive/5'
                  : d.severity === 'warning' ? 'border-amber-500/40 bg-amber-500/5'
                  : 'border-emerald-500/40 bg-emerald-500/5')
              }
            >
              {d.severity === 'info' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              ) : d.severity === 'warning' ? (
                <Info className="mt-0.5 h-4 w-4 text-amber-600" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{d.category}</Badge>
                  <span className="font-medium">{d.message}</span>
                </div>
                {d.details && <p className="mt-1 text-muted-foreground">{d.details}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Pivot */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">사이즈 × 두께 가격 영향</CardTitle>
            <Select value={quality} onValueChange={v => setQuality(v as Quality)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['glossy-color', 'satin-color', 'astel-color'].map(q => (
                  <SelectItem key={q} value={q} disabled={!mastersByQuality.get(q)}>
                    {QUALITY_LABEL[q] ?? q}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {usedThicknesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">데이터 없음</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background">두께 \ 사이즈</TableHead>
                    {usedSizes.map(s => (
                      <TableHead key={s} className="text-right whitespace-nowrap">{s}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usedThicknesses.map(t => (
                    <TableRow key={t}>
                      <TableCell className="sticky left-0 bg-background font-medium">{t}</TableCell>
                      {usedSizes.map(s => {
                        const row = priceLookup.get(`${t}|${s}`);
                        if (!row) return <TableCell key={s} className="text-right text-muted-foreground">—</TableCell>;
                        const active = row.is_active;
                        return (
                          <TableCell
                            key={s}
                            className={
                              'text-right font-mono text-xs whitespace-nowrap ' +
                              (active ? priceHeatColor(row.price) : 'bg-muted/20 text-muted-foreground line-through')
                            }
                            title={active ? '활성' : '비활성'}
                          >
                            {row.price.toLocaleString()}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-2 text-xs text-muted-foreground">
                취소선 = 비활성. 색상은 활성 가격의 상대적 크기(녹색→적색).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Surcharges */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">옵션 서차지 (양면 / 사틴·아스텔 / 브라이트)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {surchargeGroups.map(([key, rows]) => {
            const [qid, type] = key.split('|');
            const activeCount = rows.filter(r => r.is_active).length;
            return (
              <div key={key}>
                <div className="mb-1 flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{qid}</Badge>
                  <Badge variant="outline">{type}</Badge>
                  <span className="text-xs text-muted-foreground">활성 {activeCount} / 전체 {rows.length}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {rows
                    .slice()
                    .sort((a, b) => a.size_name.localeCompare(b.size_name))
                    .map(r => (
                      <span
                        key={`${key}-${r.size_name}`}
                        className={
                          'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-mono ' +
                          (r.is_active
                            ? 'border-emerald-500/40 bg-emerald-500/5'
                            : 'border-muted bg-muted/20 text-muted-foreground line-through')
                        }
                      >
                        {r.size_name}: {r.cost.toLocaleString()}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'ok' | 'bad' }) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          'text-lg font-semibold ' +
          (tone === 'bad' && Number(value) > 0 ? 'text-destructive' :
            tone === 'ok' ? 'text-emerald-600' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}
