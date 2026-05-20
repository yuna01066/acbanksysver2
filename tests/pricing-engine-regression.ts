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

const bulgwangOption: ProcessingOptionData = {
  option_id: 'bulgwang',
  name: '불광 후가공',
  option_type: 'additional',
  category: 'additional',
  multiplier: 0.5,
  pricing_method: 'per_meter',
  unit: 'polished_edge_m',
  rate: 14_200,
  requires_review: true,
  is_active: true,
};

const mirrorHardCoatingOption: ProcessingOptionData = {
  option_id: 'mirrorHardCoating',
  name: '미러 증착용 하드코팅',
  option_type: 'additional',
  category: 'additional',
  pricing_method: 'per_unit',
  unit: 'panel',
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
  assert.equal(result.snapshotVersion, 'pricing-engine-v2-core-260520');
  assert.equal(result.formulaDocVersion, 260520);
  assert.equal(result.totalPrice, 187_780);
  assert.equal(
    result.breakdown.find(item => item.label.includes('전체 레이저 재단'))?.price,
    97_180,
    'known laser profiles must use formula v2: sheet cost x 1.3 + fixed labor'
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
    'complex-cutting',
    0,
    { processingOptionsData: [] }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 187_780);
  assert.equal(
    result.breakdown.find(item => item.label.includes('복합 재단'))?.price,
    97_180,
    'complex cutting must use formula v2: sheet cost x 1.3 + 70,000'
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
      polishedEdgeLengthM: 2,
      processingOptionsData: [edgeOption],
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 119_000);
  assert.equal(
    result.lineItems.filter(item => item.code === 'option-edgeFinishing').length,
    1,
    'edgeFinishing must not be charged twice'
  );
  assert.equal(
    result.lineItems.find(item => item.code === 'option-edgeFinishing')?.source,
    'post_processing',
    'edge finishing must be classified separately from mirror deposition'
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
    'bulgwang',
    0,
    {
      selectedAdditionalOptions: { bulgwang: 1 },
      polishedEdgeLengthM: 2,
      processingOptionsData: [bulgwangOption],
    }
  );

  assert.equal(result.status, 'needs_review');
  assert.equal(result.totalPrice, 175_800);
  assert.equal(
    result.lineItems.find(item => item.code === 'option-bulgwang')?.source,
    'post_processing',
    'bulgwang must be post-processing, not mirror deposition'
  );
}

{
  const result = calculatePrice(
    'casting',
    'acrylic-mirror',
    '5T',
    '4*8',
    '단면',
    undefined,
    'mirrorHardCoating',
    0,
    {
      selectedAdditionalOptions: { mirrorHardCoating: 1 },
      selectedPanelSizesForOptions: [{ size: '4*8', quantity: 2 }],
      processingOptionsData: [mirrorHardCoatingOption],
      panelSizesData: [{ size_name: '4*8', thickness: '5T', price: 100_000, is_active: true }],
    }
  );

  assert.equal(result.status, 'calculable');
  assert.equal(result.totalPrice, 700_000);
  assert.equal(
    result.lineItems.find(item => item.code === 'option-mirrorHardCoating')?.source,
    'mirror',
    'mirror hard coating must be classified as mirror option'
  );
}

{
  const result = calculatePrice(
    'casting',
    'acrylic-mirror',
    '5T',
    '5*6',
    '단면',
    undefined,
    'mirrorHardCoating',
    0,
    {
      selectedAdditionalOptions: { mirrorHardCoating: 1 },
      selectedPanelSizesForOptions: [{ size: '5*6', quantity: 1 }],
      processingOptionsData: [mirrorHardCoatingOption],
      panelSizesData: [{ size_name: '5*6', thickness: '5T', price: 100_000, is_active: true }],
    }
  );

  assert.equal(result.status, 'needs_review');
  assert.equal(result.totalPrice, 100_000);
  assert.match(result.warnings.join(' '), /3\*6\/4\*8/);
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
