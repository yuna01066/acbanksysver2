import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Quote } from '@/contexts/QuoteContext';
import { CASTING_QUALITIES, DEFAULT_COLOR_MIXING_COST } from '@/types/calculator';
import { usePriceCalculation } from '@/hooks/usePriceCalculation';
import { quoteSpecNames, restorePanelCalculation } from '@/utils/issuedQuoteRevision';
import { formatPrice } from '@/utils/priceCalculations';
import QualitySelection from './QualitySelection';
import ColorSelection from './ColorSelection';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface Props {
  original: Quote;
  onChange: (patch: Partial<Quote> | null, blockingReason: string) => void;
  onRecover: () => void;
}

export default function IssuedQuoteSpecEditor({ original, onChange, onRecover }: Props) {
  const restored = useMemo(() => restorePanelCalculation(original), [original]);
  if (!restored.inputs) return <div className="space-y-3 rounded-lg border p-4">
    <p role="alert">{restored.issues.join(' ')}</p>
    <p className="text-sm text-muted-foreground">기존 금액은 그대로 유지됩니다. 부족한 조건을 확인하기 전에는 사양을 재계산하지 않습니다.</p>
    <Button variant="outline" onClick={onRecover}>계산 조건 다시 확인</Button>
  </div>;
  return <SpecForm original={original} restored={restored} onChange={onChange} />;
}

function SpecForm({ original, restored, onChange }: Omit<Props, 'onRecover'> & { restored: ReturnType<typeof restorePanelCalculation> }) {
  const base = restored.inputs!;
  const [inputs, setInputs] = useState(base);
  const [color, setColor] = useState({ id: String(original.calculationSnapshot?.selectedOptions?.colorId || ''), acCode: original.selectedColor || '', hexCode: original.selectedColorHex || '', colorTypeLabel: base.selectedColorType });
  const [display, setDisplay] = useState(original.specDisplay || { qualityName: '', colorName: '' });
  const [colorReady, setColorReady] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [touched, setTouched] = useState(false);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;
  const calculation = usePriceCalculation(inputs);
  const version = useQuery({ queryKey: ['issued-spec-pricing-version'], queryFn: async () => {
    const { data, error } = await supabase.from('panel_pricing_versions').select('id,version_name,supplier_name,effective_from').eq('is_active', true).order('effective_from', { ascending: false }).limit(1).single();
    if (error) throw error;
    return data;
  }});
  const restoredSpec = inputs.selectedQuality.id === base.selectedQuality.id && inputs.selectedThickness === base.selectedThickness
    && color.acCode === (original.selectedColor || '') && JSON.stringify(inputs.selectedSizes) === JSON.stringify(base.selectedSizes)
    && (display.qualityName || '') === (original.specDisplay?.qualityName || '') && (display.colorName || '') === (original.specDisplay?.colorName || '');
  const changed = touched && !restoredSpec;
  const sizesValid = inputs.selectedSizes.every(s => calculation.getAvailableSizes().includes(s.size) && Number.isInteger(s.quantity) && s.quantity > 0 && Number.isFinite(s.colorMixingCost) && s.colorMixingCost >= 0);
  const reason = !changed ? '' : calculation.error || version.error ? '단가표 조회에 실패했습니다. 연결을 확인한 후 다시 열어 주세요.'
    : calculation.isLoading || version.isFetching ? '현재 단가표로 계산 중입니다.'
    : !colorReady || !color.id ? '가격 계산에 사용할 등록 컬러를 선택해 주세요.'
    : !inputs.selectedQuality.thicknesses.includes(inputs.selectedThickness) || !sizesValid ? '현재 재질의 두께·규격과 새 조색비를 확인해 주세요.'
    : !inputs.selectedAdhesion || (restored.confirmation.length > 0 && !confirmed) ? '기존 원판·가공·접착 조건을 확인해 주세요.'
    : !calculation.isReady || !version.data ? '계산에 필요한 단가 정보가 없습니다.'
    : calculation.priceInfo.status === 'blocked' || calculation.priceInfo.totalPrice <= 0 ? calculation.priceInfo.blockedReasons.join(' ') || '계산할 수 없는 사양입니다.'
    : calculation.priceInfo.status === 'needs_review' && !reviewed ? '계산 경고를 검토하고 확인해 주세요.' : '';
  const candidate = useMemo<Partial<Quote> | null>(() => {
    if (!changed || reason) return null;
    const price = calculation.priceInfo;
    const capturedAt = new Date().toISOString();
    const selectedOptions = { ...original.calculationSnapshot.selectedOptions, qualityId: inputs.selectedQuality.id, qualityName: inputs.selectedQuality.name,
      thickness: inputs.selectedThickness, sizes: inputs.selectedSizes, adhesion: inputs.selectedAdhesion,
      colorId: color.id, selectedColor: color.acCode, selectedColorHex: color.hexCode, colorType: color.colorTypeLabel,
      customColorName: '', customOpacity: '', specDisplay: display, reviewAcknowledged: reviewed, sourceConditionsConfirmed: confirmed,
    };
    return { quality: inputs.selectedQuality.name, thickness: inputs.selectedThickness,
      size: inputs.selectedSizes.map(s => `${s.size} (${s.quantity}개)`).join(', '),
      surface: inputs.selectedSizes.map(s => `${s.size}: ${s.surface}`).join(', '),
      selectedColor: color.acCode, selectedColorHex: color.hexCode, colorType: color.colorTypeLabel, customColorName: '', customOpacity: '',
      colorMixingCost: inputs.selectedSizes.reduce((sum, s) => sum + s.colorMixingCost, 0), specDisplay: display,
      totalPrice: price.totalPrice, breakdown: price.breakdown, pricingVersionId: version.data.id, pricingVersionName: version.data.version_name,
      calculationSnapshot: { ...original.calculationSnapshot, schemaVersion: 3, capturedAt, selectedOptions,
        pricingVersion: { id: version.data.id, versionName: version.data.version_name, supplierName: version.data.supplier_name, effectiveFrom: version.data.effective_from },
        totalPrice: price.totalPrice, breakdown: price.breakdown, calculationStatus: price.status, calculationWarnings: price.warnings,
        calculationBlockedReasons: price.blockedReasons, calculationLineItems: price.lineItems, snapshotVersion: price.snapshotVersion, formulaDocVersion: price.formulaDocVersion,
      },
    };
  }, [changed, reason, calculation.priceInfo, inputs, color, display, reviewed, confirmed, version.data, original]);
  useEffect(() => { changeRef.current(candidate, reason); }, [candidate, reason]);
  const update = (patch: Partial<typeof inputs>) => { setTouched(true); setReviewed(false); setInputs(prev => ({ ...prev, ...patch })); };
  const reset = () => { setInputs(base); setColor({ id: String(original.calculationSnapshot.selectedOptions.colorId || ''), acCode: original.selectedColor || '', hexCode: original.selectedColorHex || '', colorTypeLabel: base.selectedColorType }); setDisplay(original.specDisplay || { qualityName: '', colorName: '' }); setTouched(false); setReviewed(false); };
  const prefix = `spec-${original.id}`;
  return <section className="space-y-4 rounded-lg border bg-background p-4" aria-label="재질·컬러 변경">
    <p className="text-sm text-muted-foreground">변경 품목만 현재 단가로 계산합니다. 재질·컬러 변경 시 조색비는 기존 계산기의 기본 40,000원으로 재설정되며 아래에서 확인·수정할 수 있습니다. 실제 저장은 상단의 ‘수정 저장’을 누를 때 수행됩니다.</p>
    <QualitySelection qualities={CASTING_QUALITIES} selectedQuality={inputs.selectedQuality} selectedFactory="jangwon" onQualitySelect={quality => {
      update({ selectedQuality: quality, selectedSizes: inputs.selectedSizes.map(s => ({ ...s, colorMixingCost: DEFAULT_COLOR_MIXING_COST })) });
      setColor({ id: '', acCode: '', hexCode: '', colorTypeLabel: '' }); setColorReady(false);
    }} />
    <ColorSelection registeredOnly selectedQuality={inputs.selectedQuality} selectedColor={color.acCode} onAvailabilityChange={setColorReady} onColorSelect={(id, info) => {
      if (!info) return;
      const isOriginal = inputs.selectedQuality.id === base.selectedQuality.id && info.acCode === original.selectedColor;
      setColor({ id, acCode: info.acCode, hexCode: info.hexCode, colorTypeLabel: info.colorTypeLabel || '' });
      update({ selectedColorType: info.colorTypeLabel || '', selectedSizes: inputs.selectedSizes.map((s, i) => ({ ...s, colorMixingCost: isOriginal ? base.selectedSizes[i]?.colorMixingCost : DEFAULT_COLOR_MIXING_COST })) });
    }} />
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={`${prefix}-quality-name`}>견적서 표시 재질명 (선택)</Label><Input id={`${prefix}-quality-name`} className="text-base sm:text-sm" maxLength={200} value={display.qualityName || ''} placeholder={inputs.selectedQuality.name} onChange={e => { setTouched(true); setDisplay({ ...display, qualityName: e.target.value }); }} /></div>
      <div><Label htmlFor={`${prefix}-color-name`}>견적서 표시 컬러명 (선택)</Label><Input id={`${prefix}-color-name`} className="text-base sm:text-sm" maxLength={200} value={display.colorName || ''} placeholder={color.acCode} onChange={e => { setTouched(true); setDisplay({ ...display, colorName: e.target.value }); }} /></div>
    </div>
    <p className="text-sm">가격 계산 기준: {inputs.selectedQuality.name} / {color.acCode || '등록 컬러 선택 필요'}</p>
    <Label htmlFor={`${prefix}-thickness`}>두께</Label>
    <select id={`${prefix}-thickness`} className="h-11 w-full rounded-md border bg-background px-3" value={inputs.selectedThickness} onChange={e => update({ selectedThickness: e.target.value })}>
      {!inputs.selectedQuality.thicknesses.includes(inputs.selectedThickness) && <option value={inputs.selectedThickness}>{inputs.selectedThickness} (재선택 필요)</option>}
      {inputs.selectedQuality.thicknesses.map(t => <option key={t}>{t}</option>)}
    </select>
    {inputs.selectedSizes.map((size, index) => <fieldset key={index} className="space-y-2 border-t pt-3">
      <legend className="text-sm font-medium">원판 {index + 1}: {size.quantity}장 · {size.surface}</legend>
      <Label htmlFor={`${prefix}-size-${index}`}>원판 규격</Label>
      <select id={`${prefix}-size-${index}`} className="h-11 w-full rounded-md border bg-background px-3" value={size.size} onChange={e => update({ selectedSizes: inputs.selectedSizes.map((s, i) => i === index ? { ...s, size: e.target.value } : s) })}>
        {!calculation.getAvailableSizes().includes(size.size) && <option value={size.size}>{size.size} (재선택 필요)</option>}
        {calculation.getAvailableSizes().map(s => <option key={s}>{s}</option>)}
      </select>
      <Label htmlFor={`${prefix}-mix-${index}`}>새 사양 조색비 (원판당, 0원 포함 직접 확인)</Label>
      <Input id={`${prefix}-mix-${index}`} className="text-base sm:text-sm" type="number" min={0} value={size.colorMixingCost ?? ''} placeholder="기존 계산기 기본 40,000원 · 변경 사양 확인 후 입력" onChange={e => update({ selectedSizes: inputs.selectedSizes.map((s, i) => i === index ? { ...s, colorMixingCost: e.target.value === '' ? undefined : Number(e.target.value) } : s) })} />
    </fieldset>)}
    <p className="text-sm">보존되는 가공: {original.processingName} · 제품 수량 {base.qty} · 추가 옵션 {JSON.stringify(base.selectedAdditionalOptions)} · 경면 {base.polishedEdgeLengthM}m</p>
    <Label htmlFor={`${prefix}-adhesion`}>접착 조건 확인</Label>
    <select id={`${prefix}-adhesion`} className="h-11 w-full rounded-md border bg-background px-3" value={inputs.selectedAdhesion} onChange={e => update({ selectedAdhesion: e.target.value })}>
      <option value="">선택 필요</option>
      {['none', 'bond-normal', 'bond-mugipo-auto', 'bond-mugipo-45', 'bond-mugipo-90', '45-normal', '45-mugipo', '90-normal', '90-mugipo'].map(a => <option key={a} value={a}>{a === 'none' ? '별도 접착 없음 (가공 옵션에 포함된 접착은 유지)' : a}</option>)}
    </select>
    {restored.confirmation.length > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />{restored.confirmation.join(' ')} 위 조건을 확인했습니다.</label>}
    {changed && calculation.priceInfo.warnings.length > 0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />{calculation.priceInfo.warnings.join(' ')} 경고를 검토했습니다.</label>}
    <div aria-live="polite" className="space-y-1 text-sm tabular-nums">
      <p>변경 전: {quoteSpecNames(original).quality} / {quoteSpecNames(original).color} · {formatPrice(original.totalPrice)}</p>
      {candidate && <p>변경 후: {display.qualityName || inputs.selectedQuality.name} / {display.colorName || color.acCode} · {formatPrice(candidate.totalPrice)} (증감 {formatPrice(candidate.totalPrice - original.totalPrice)})</p>}
      {reason && <p role="status" className="text-destructive">{reason} 저장할 수 없습니다.</p>}
    </div>
    <Button variant="outline" onClick={reset}>원래 사양·금액으로 복원</Button>
  </section>;
}
