import { calculateAutomaticQuoteTotals } from '@/utils/quoteAmounts';
import type { Quote } from '@/contexts/QuoteContext';
import { CASTING_QUALITIES, MATERIALS } from '@/types/calculator';
import type { UsePriceCalculationProps } from '@/hooks/usePriceCalculation';

export const isPanelQuote = (item: Pick<Quote, 'material' | 'quoteStyle'>) =>
  item.material === '아크릴 판' && (!item.quoteStyle || item.quoteStyle === 'panel');

export const quoteSpecNames = (item: Pick<Quote, 'quality' | 'specDisplay' | 'selectedColor' | 'colorType' | 'customColorName'>) => ({
  quality: item.specDisplay?.qualityName?.trim() || item.quality,
  color: item.specDisplay?.colorName?.trim() || (item.colorType?.startsWith('CUSTOM') ? item.customColorName : '') || item.selectedColor || item.colorType || '',
});

export function restorePanelCalculation(item: Quote): { inputs: UsePriceCalculationProps | null; issues: string[]; confirmation: string[] } {
  const options = item.calculationSnapshot?.selectedOptions;
  const issues: string[] = [];
  const confirmation: string[] = [];
  const quality = CASTING_QUALITIES.find(q => q.id === options?.qualityId);
  if (!isPanelQuote(item) || !options || options.materialId !== 'casting' || !quality || options.factory !== 'jangwon') {
    return { inputs: null, issues: ['등록 재질과 구조화된 계산 근거가 없습니다. 계산기에서 원판·가공 조건을 다시 확인해 주세요.'], confirmation };
  }
  const sizes = options.sizes as UsePriceCalculationProps['selectedSizes'];
  if (!Array.isArray(sizes) || !sizes.length || sizes.some(s => !s || typeof s.size !== 'string' || !s.size.trim() || !Number.isInteger(s.quantity) || s.quantity < 1 || !['단면', '양면'].includes(s.surface) || !Number.isFinite(s.colorMixingCost) || s.colorMixingCost < 0)) issues.push('원판별 규격·장수·면수·조색 조건이 누락되었습니다.');
  for (const key of ['qty', 'bevelLengthM', 'polishedEdgeLengthM', 'laserHoles']) {
    if (typeof options[key] !== 'number' || !Number.isFinite(options[key]) || Number(options[key]) < (key === 'qty' ? 1 : 0)) issues.push(`${key} 계산 조건이 없습니다.`);
  }
  for (const key of ['isComplex', 'edgeFinishing', 'bulgwang', 'tapung', 'mugwangPainting']) {
    if (typeof options[key] !== 'boolean') issues.push(`${key} 가공 여부가 없습니다.`);
  }
  if (!options.thickness || typeof options.processing !== 'string' || !options.processing) issues.push('두께 또는 가공 조건이 없습니다.');
  if (!options.additionalOptions || typeof options.additionalOptions !== 'object' || Array.isArray(options.additionalOptions) || Object.values(options.additionalOptions).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) issues.push('가공 옵션별 수량이 없습니다.');
  if (options.useDetailedBond || Number(options.corners90) > 0 || Number(options.joinLengthM) > 0 || Number(options.trayHeightMm) > 0) issues.push('현재 원판 계산기에서 복원할 수 없는 상세 접착 조건입니다. 담당자 확인이 필요합니다.');
  if (issues.length) return { inputs: null, issues, confirmation };
  if (typeof options.adhesion !== 'string') confirmation.push('과거 계산 근거에 접착 조건이 없습니다. 접착 여부를 선택해 주세요.');
  const expectedSize = sizes.map(s => `${s.size} (${s.quantity}개)`).join(', ');
  const expectedSurface = sizes.map(s => `${s.size}: ${s.surface}`).join(', ');
  if (item.quality !== quality.name || item.thickness !== options.thickness || item.size !== expectedSize || item.surface !== expectedSurface || item.processing !== options.processing || (item.selectedColor || '') !== (options.selectedColor || '')) {
    confirmation.push('표시된 사양과 저장된 계산 조건이 다릅니다. 아래 원판·가공 조건을 확인해 주세요.');
  }
  if (item.calculationSnapshot.totalPrice !== undefined && item.calculationSnapshot.totalPrice !== item.totalPrice) confirmation.push('기존 단가가 계산 근거와 다릅니다. 사양 변경 시 현재 단가로 대체되는 것을 확인해 주세요.');
  const additionalOptions = options.additionalOptions as Record<string, number>;
  const processing = [String(options.processing), ...Object.entries(additionalOptions).filter(([, n]) => n > 0).map(([id]) => id)]
    .filter((id, i, all) => id && (id !== 'raw-only' || all.length === 1)).join('|');
  return {
    issues, confirmation,
    inputs: {
      selectedFactory: 'jangwon', selectedMaterial: MATERIALS[0], selectedQuality: quality,
      selectedThickness: String(options.thickness), selectedSize: sizes[0].size,
      selectedSizes: sizes.map(s => ({ ...s })), selectedColorType: String(options.colorType || ''),
      selectedSurface: sizes[0].surface, colorMixingCost: sizes[0].colorMixingCost,
      selectedProcessing: processing, selectedAdhesion: typeof options.adhesion === 'string' ? options.adhesion : '',
      selectedAdditionalOptions: additionalOptions, qty: Number(options.qty), isComplex: Boolean(options.isComplex),
      bevelLengthM: Number(options.bevelLengthM), polishedEdgeLengthM: Number(options.polishedEdgeLengthM), laserHoles: Number(options.laserHoles),
      edgeFinishing: Boolean(options.edgeFinishing), bulgwang: Boolean(options.bulgwang), tapung: Boolean(options.tapung), mugwangPainting: Boolean(options.mugwangPainting),
    },
  };
}

const financialFields = (item: Quote) => [item.id, item.totalPrice, item.quantity];
export const hasPanelCalculationChanges = (before: Quote, after: Quote) => {
  const fields = ['factory', 'materialId', 'qualityId', 'thickness', 'sizes', 'selectedColor', 'colorType', 'processing', 'additionalOptions', 'qty', 'isComplex', 'bevelLengthM', 'polishedEdgeLengthM', 'laserHoles', 'edgeFinishing', 'bulgwang', 'tapung', 'mugwangPainting'];
  const identity = (item: Quote) => {
    const options = item.calculationSnapshot?.selectedOptions;
    return [fields.map(key => options?.[key]), options?.adhesion || 'none'];
  };
  return JSON.stringify(identity(before)) !== JSON.stringify(identity(after));
};
const specFields = (item: Quote) => [item.material, item.quality, item.thickness, item.size, item.surface, item.selectedColor, item.colorType, item.specDisplay, item.calculationSnapshot?.selectedOptions];
export const hasQuoteSpecChanges = (before: Quote[], after: Quote[]) => after.some(item => {
  const old = before.find(row => row.id === item.id);
  return old && isPanelQuote(item) && JSON.stringify(specFields(old)) !== JSON.stringify(specFields(item));
});
export const hasQuotePriceChanges = (before: Quote[], after: Quote[]) =>
  JSON.stringify(before.map(financialFields)) !== JSON.stringify(after.map(financialFields)) || hasQuoteSpecChanges(before, after);

export const calculateQuoteTotals = (items: Pick<Quote, 'totalPrice' | 'quantity'>[]) => {
  if (!items.length || items.some(item => !Number.isFinite(item.totalPrice) || item.totalPrice < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) throw new Error('품목 금액과 수량을 확인해 주세요.');
  return calculateAutomaticQuoteTotals(items);
};
