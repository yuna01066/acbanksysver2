// Isolated UI fixture: the preview script replaces the Supabase module entirely.
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EditableQuoteItem from '../src/components/EditableQuoteItem';
import CustomerQuoteCard from '../src/components/CustomerQuoteCard';
import type { Quote } from '../src/contexts/QuoteContext';
import { calculateQuoteTotals, hasQuotePriceChanges, hasQuoteSpecChanges } from '../src/utils/issuedQuoteRevision';
import { usePriceCalculation } from '../src/hooks/usePriceCalculation';
import { CASTING_QUALITIES, MATERIALS } from '../src/types/calculator';

const sizes = [{ size: '4*8 (1220*2440)', quantity: 2, surface: '양면', colorMixingCost: 30000 }];
const original: Quote = { id: 'isolated-item', itemTitle: '격리 테스트 견적', factory: 'jangwon', material: '아크릴 판', quality: 'Clear (클리어)', thickness: '5T',
  size: '4*8 (1220*2440) (2개)', surface: '4*8 (1220*2440): 양면', selectedColor: 'AC-A001', colorType: '', selectedColorHex: '#ffffff',
  processing: 'raw-only', processingName: '원판 단독 구매', colorMixingCost: 30000, totalPrice: 120000, quantity: 3, breakdown: [{ label: '이전 단가', price: 120000 }], createdAt: new Date(),
  calculationSnapshot: { schemaVersion: 2, capturedAt: '2026-01-01', totalPrice: 120000, breakdown: [{ label: '이전 단가', price: 120000 }],
    selectedOptions: { factory: 'jangwon', materialId: 'casting', qualityId: 'glossy-color', qualityName: 'Clear (클리어)', thickness: '5T', sizes,
      colorId: 'color-glossy-color-1', selectedColor: 'AC-A001', colorType: '', processing: 'raw-only', adhesion: 'none', additionalOptions: {}, qty: 7,
      bevelLengthM: 0, polishedEdgeLengthM: 0, laserHoles: 0, isComplex: false, edgeFinishing: false, bulgwang: false, tapung: false, mugwangPainting: false } },
};
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
function Preview() {
  const [item, setItem] = useState(original);
  const [reason, setReason] = useState('');
  const [saved, setSaved] = useState<Quote | null>(null);
  const [failure, setFailure] = useState(false);
  const specChanged = hasQuoteSpecChanges([original], [item]);
  const currentTotal = hasQuotePriceChanges([original], [item]) ? calculateQuoteTotals([item]).total : 350000;
  const options = item.calculationSnapshot.selectedOptions;
  const reference = usePriceCalculation({ selectedFactory: 'jangwon', selectedMaterial: MATERIALS[0], selectedQuality: CASTING_QUALITIES.find(q => q.id === options.qualityId),
    selectedThickness: String(options.thickness), selectedSize: sizes[0].size, selectedSizes: options.sizes as typeof sizes, selectedColorType: String(options.colorType || ''),
    selectedSurface: '양면', colorMixingCost: 0, selectedProcessing: 'raw-only', selectedAdhesion: 'none', selectedAdditionalOptions: {}, qty: 7 });
  return <main className="mx-auto max-w-4xl space-y-4 p-4">
    <h1>격리된 견적 사양 편집 검증</h1><p>운영 DB·고객 정보 사용 없음. 저장은 화면 메모리에만 수행됩니다.</p>
    <button className="rounded border p-3" onClick={() => { setFailure(!failure); document.body.dataset.failPrices = String(!failure); void client.invalidateQueries(); }}>단가 조회 실패 {failure ? '해제' : '재현'}</button>
    <p data-testid="total">총액 {currentTotal.toLocaleString()}원 · 수동 조정 {specChanged ? '해제' : '유지'}</p>
    <p data-testid="equality">계산기 단가 {reference.priceInfo.totalPrice.toLocaleString()}원 · 변경 품목 단가 {item.totalPrice.toLocaleString()}원</p>
    <button className="rounded border p-3 disabled:opacity-40" disabled={!!reason} onClick={() => setSaved(structuredClone(item))}>수정 저장</button>
    <p role="status">{reason || (saved ? '테스트 저장 완료' : '저장 가능')}</p>
    <EditableQuoteItem item={item} original={original} index={0} onUpdate={(_, next) => setItem(next as Quote)} onSpecStatus={(_, text) => setReason(text)} onRemove={() => {}} />
    {saved && <CustomerQuoteCard quote={saved} index={0} onRemove={() => {}} onUpdateQuantity={() => {}} readOnly isCustomerView />}
  </main>;
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><MemoryRouter><Preview /></MemoryRouter></QueryClientProvider>);
