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

const laserFullOption: ProcessingOptionData = {
  option_id: 'laser-full',
  name: '레이저 전체 재단',
  option_type: 'processing',
  category: 'full',
  multiplier: 1.8,
  base_cost: 150_000,
  pricing_method: 'panel_multiplier',
  rate: 150_000,
  is_active: true,
};

const mugipo45PerMeterOption: ProcessingOptionData = {
  option_id: '45-mugipo',
  name: '무기포 45도 접착',
  option_type: 'adhesion',
  category: 'adhesion',
  pricing_method: 'per_meter',
  unit: 'm',
  rate: 10_000,
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
    '4*8',
    '단면',
    undefined,
    'laser-full',
    0,
    { processingOptionsData: [laserFullOption] }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 313_080);
  assert.equal(
    result.breakdown.find(item => item.label.includes('레이저 전체 재단'))?.price,
    222_480,
    'panel_multiplier options must preserve base_cost as an additive setup fee'
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
      adhesion: 'bond-mugipo-45',
      adhesionBasis: 'sheet_based',
      bondProductType: 'flat',
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 289_920);
  assert.equal(
    result.lineItems.filter(item => item.code === 'adhesion-mugipo-45').length,
    1,
    'sheet-based mugipo adhesion must be charged once'
  );
  assert.equal(result.warnings.length, 0, 'sheet-based mugipo adhesion should not ask for join length');
}

{
  const canonical = calculatePrice(
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
      adhesionBasis: 'sheet_based',
      bondProductType: 'flat',
    }
  );

  const legacy = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    undefined,
    0,
    {
      adhesion: 'bond-mugipo-45',
      adhesionBasis: 'sheet_based',
      bondProductType: 'flat',
    }
  );

  assert.equal(canonical.totalPrice, legacy.totalPrice, 'legacy and canonical 45 mugipo ids must match');
}

{
  const result = calculatePrice(
    'casting',
    'glossy-color',
    '5T',
    '4*8',
    '단면',
    undefined,
    '45-mugipo',
    0,
    {
      joinLengthM: 4.2,
      adhesionBasis: 'product_based',
      processingOptionsData: [mugipo45PerMeterOption],
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 132_600);
  assert.equal(
    result.lineItems.find(item => item.code === 'option-45-mugipo')?.source,
    'adhesion',
    'DB per-meter adhesion option must stay in the adhesion source'
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
    '45-mugipo',
    0,
    {
      joinLengthM: 4.2,
      adhesionBasis: 'sheet_based',
      processingOptionsData: [mugipo45PerMeterOption],
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 289_920);
  assert.equal(
    result.lineItems.find(item => item.code === 'adhesion-mugipo-45')?.source,
    'adhesion',
    'sheet-based mugipo adhesion should use panel multiplier instead of per-meter pricing'
  );
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
