
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
  { id: 'casting', name: '캐스팅 아크릴' },
  { id: 'acrylic-dye', name: '아크릴 염료' }
];

export const CASTING_QUALITIES: Quality[] = [
  {
    id: 'glossy-color',
    name: 'Clear (클리어)',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '15T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  },
  {
    id: 'satin-color',
    name: 'Bright (브라이트)',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '15T', '20T', '25T', '30T'],
    sizes: ['대3*6', '1*2', '4*8']
  },
  {
    id: 'acrylic-mirror',
    name: 'Mirror (미러)',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  },
  {
    id: 'astel-color',
    name: 'Astel (아스텔)',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['소3*6', '대3*6', '4*5', '대4*5', '소1*2', '1*2', '4*6', '4*8', '5*8']
  },
  {
    id: 'astel-mirror',
    name: 'Astel Mirror (아스텔 미러)',
    thicknesses: ['1.3T', '1.5T', '2T', '3T', '4T', '5T', '6T', '8T', '10T', '12T', '20T', '25T', '30T'],
    sizes: ['3*6', '대3*6', '4*5', '대4*5', '1*2', '4*6', '4*8', '5*5', '5*6', '5*8']
  }
];

export const SURFACE_OPTIONS = [
  { id: 'single', name: '단면' },
  { id: 'double', name: '양면' }
];
