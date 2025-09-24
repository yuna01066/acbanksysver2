
export interface Material {
  id: string;
  name: string;
}

export interface Quality {
  id: string;
  name: string;
  thicknesses: string[];
  sizes: string[];
}

export interface CalculatorStep {
  step: number;
  title: string;
  selectedValue: string;
}

export const MATERIALS: Material[] = [
  { id: 'casting', name: '캐스팅' },
  { id: 'acrylic-mirror', name: '아크릴 미러' }
];

export const CASTING_QUALITIES: Quality[] = [
  {
    id: 'glossy-color',
    name: '유광 색상판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  },
  {
    id: 'astel-color',
    name: '아스텔 색상판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['소3*6', '대3*6', '4*5', '대4*5', '소1*2', '1*2', '4*6', '4*8', '5*8']
  },
  {
    id: 'satin-color',
    name: '사틴 색상판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['대3*6', '1*2', '4*8']
  },
  {
    id: 'glossy-standard',
    name: '유광 보급판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  },
  {
    id: 'astel-standard',
    name: '아스텔 보급판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['소3*6', '대3*6', '4*5', '대4*5', '소1*2', '1*2', '4*6', '4*8', '5*8']
  },
  {
    id: 'matte-standard',
    name: '사틴 보급판',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  }
];

export const SURFACE_OPTIONS = [
  { id: 'single', name: '단면' },
  { id: 'double', name: '양면' }
];
