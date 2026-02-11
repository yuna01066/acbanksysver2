export interface PlaceholderField {
  key: string;
  label: string;
  group: string;
}

export const PLACEHOLDER_GROUPS = [
  {
    id: 'company',
    label: '회사 정보',
    fields: [
      { key: '{{회사명}}', label: '회사명', group: 'company' },
      { key: '{{회사주소}}', label: '회사주소', group: 'company' },
      { key: '{{사업자등록번호}}', label: '사업자 등록번호', group: 'company' },
      { key: '{{대표자명}}', label: '대표자명', group: 'company' },
      { key: '{{업태}}', label: '업태', group: 'company' },
      { key: '{{업종}}', label: '업종', group: 'company' },
      { key: '{{회사전화}}', label: '회사 전화번호', group: 'company' },
      { key: '{{회사이메일}}', label: '회사 이메일', group: 'company' },
    ],
  },
  {
    id: 'employee',
    label: '구성원 정보',
    fields: [
      { key: '{{구성원이름}}', label: '구성원 이름', group: 'employee' },
      { key: '{{생년월일}}', label: '생년월일', group: 'employee' },
      { key: '{{부서}}', label: '부서', group: 'employee' },
      { key: '{{직위}}', label: '직위', group: 'employee' },
      { key: '{{직책}}', label: '직책', group: 'employee' },
      { key: '{{입사일}}', label: '입사일', group: 'employee' },
      { key: '{{주소}}', label: '주소', group: 'employee' },
      { key: '{{전화번호}}', label: '전화번호', group: 'employee' },
      { key: '{{이메일}}', label: '이메일', group: 'employee' },
    ],
  },
  {
    id: 'salary',
    label: '급여 정보',
    fields: [
      { key: '{{연봉}}', label: '연봉', group: 'salary' },
      { key: '{{월급}}', label: '월급', group: 'salary' },
      { key: '{{기본급}}', label: '기본급', group: 'salary' },
      { key: '{{고정연장수당}}', label: '고정연장수당', group: 'salary' },
      { key: '{{고정연장시간}}', label: '고정연장시간', group: 'salary' },
      { key: '{{급여일}}', label: '급여일', group: 'salary' },
    ],
  },
  {
    id: 'contract',
    label: '계약 메타',
    fields: [
      { key: '{{계약일}}', label: '계약일', group: 'contract' },
      { key: '{{계약시작일}}', label: '계약 시작일', group: 'contract' },
      { key: '{{계약종료일}}', label: '계약 종료일', group: 'contract' },
      { key: '{{수습시작일}}', label: '수습 시작일', group: 'contract' },
      { key: '{{수습종료일}}', label: '수습 종료일', group: 'contract' },
      { key: '{{수습기간}}', label: '수습기간', group: 'contract' },
      { key: '{{근무형태}}', label: '근무형태', group: 'contract' },
      { key: '{{근무요일}}', label: '근무요일', group: 'contract' },
    ],
  },
];

export const ALL_PLACEHOLDER_FIELDS = PLACEHOLDER_GROUPS.flatMap(g => g.fields);
