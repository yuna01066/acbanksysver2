import assert from 'node:assert/strict';
import {
  calculatePrice,
  type AdhesionConfigData,
  type ProcessingOptionData,
} from '../src/utils/priceCalculations';

const originalLog = console.log;
console.log = () => {};

const commonAdhesionConfig: AdhesionConfigData = {
  setupFee: 50_000,
  bondRatePerM: 15_000,
  kVolume: 0.15,
  laborPremium90: 1.12,
  cornerFinishFee: 4_000,
  thinTrayMaxHeightMm: 60,
};

const rawOnlyOption: ProcessingOptionData = {
  option_id: 'raw-only',
  name: '원판 단독 구매',
  option_type: 'processing',
  category: 'raw',
  multiplier: 1.8,
  pricing_method: 'panel_multiplier',
  is_active: true,
};

const edgeOption: ProcessingOptionData = {
  option_id: 'edgeFinishing',
  name: '엣지 경면 마감',
  option_type: 'additional',
  category: 'additional',
  multiplier: 0.5,
  pricing_method: 'panel_rate',
  is_active: true,
};

const inRange = (value: number, min: number, max: number, message: string) => {
  assert.ok(
    value >= min && value <= max,
    `${message}: expected ${min} <= ${value} <= ${max}`
  );
};

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '양면',
    undefined,
    'raw-only',
    0,
    { processingOptionsData: [rawOnlyOption] }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 169_560);
  assert.equal(result.lineItems.some(item => item.source === 'processing'), true);
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '5*5',
    '단면'
  );

  assert.equal(result.status, 'blocked');
  assert.equal(result.totalPrice, 0);
  assert.match(result.blockedReasons[0], /단가 미등록/);
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    'edgeFinishing',
    0,
    {
      edgeFinishing: true,
      selectedAdditionalOptions: { edgeFinishing: 1 },
      processingOptionsData: [edgeOption],
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 135_900);
  assert.equal(
    result.lineItems.filter(item => item.code === 'option-edgeFinishing').length,
    1,
    'edgeFinishing must not be charged twice'
  );
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    undefined,
    0,
    {
      adhesion: '45-mugipo',
      qty: 1,
      joinLengthM: 4.2,
      corners90: 8,
      bondProductType: 'box',
      adhesionConfig: commonAdhesionConfig,
    }
  );

  assert.equal(result.status, 'calculable');
  inRange(result.totalPrice, 285_000, 315_000, '350mm box should stay near the 300k reference');
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    undefined,
    0,
    {
      adhesion: '45-mugipo',
      qty: 1,
      useDetailedBond: true,
      joinLengthM: 7.2,
      corners90: 8,
      bondProductType: 'box',
      adhesionConfig: commonAdhesionConfig,
    }
  );

  assert.equal(result.status, 'needs_review');
  inRange(result.totalPrice, 430_000, 520_000, '600mm box should stay near the 480k reference');
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    undefined,
    0,
    {
      adhesion: '45-mugipo',
      qty: 1,
      useDetailedBond: true,
      joinLengthM: 9.6,
      corners90: 8,
      bondProductType: 'box',
      adhesionConfig: commonAdhesionConfig,
    }
  );

  assert.equal(result.status, 'blocked');
  assert.match(result.blockedReasons[0], /5T 대형 6면체 박스/);
}

console.log = originalLog;
console.log('pricing engine regression tests passed');
