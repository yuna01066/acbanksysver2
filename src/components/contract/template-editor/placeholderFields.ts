import type { JSONContent } from '@tiptap/react';

export interface PlaceholderField {
  key: string;
  label: string;
  group: string;
}

// ─── 서식정보 플레이스홀더 (simple text placeholders) ───
export const PLACEHOLDER_GROUPS = [
  {
    id: 'company',
    label: '서식정보 플레이스홀더',
    fields: [
      { key: '회사명', label: '회사명', group: 'company' },
      { key: '회사주소', label: '회사주소', group: 'company' },
      { key: '사업자등록번호', label: '사업자 등록번호', group: 'company' },
      { key: '대표자명', label: '대표자명', group: 'company' },
      { key: '회사직인', label: '회사 직인', group: 'company' },
      { key: '구성원직인', label: '구성원 직인', group: 'company' },
      { key: '계약일', label: '계약일', group: 'company' },
    ],
  },
  {
    id: 'employee',
    label: '구성원 정보',
    fields: [
      { key: '구성원이름', label: '구성원 이름', group: 'employee' },
      { key: '생년월일', label: '생년월일', group: 'employee' },
      { key: '부서', label: '부서', group: 'employee' },
      { key: '직위', label: '직위', group: 'employee' },
      { key: '직책', label: '직책', group: 'employee' },
      { key: '입사일', label: '입사일', group: 'employee' },
      { key: '주소', label: '주소', group: 'employee' },
      { key: '전화번호', label: '전화번호', group: 'employee' },
      { key: '이메일', label: '이메일', group: 'employee' },
    ],
  },
  {
    id: 'salary',
    label: '급여 정보',
    fields: [
      { key: '연봉', label: '연봉', group: 'salary' },
      { key: '월급', label: '월급', group: 'salary' },
      { key: '기본급', label: '기본급', group: 'salary' },
      { key: '고정연장수당', label: '고정연장수당', group: 'salary' },
      { key: '고정연장시간', label: '고정연장시간', group: 'salary' },
      { key: '급여일', label: '급여일', group: 'salary' },
    ],
  },
  {
    id: 'contract',
    label: '계약 정보',
    fields: [
      { key: '계약시작일', label: '계약 시작일', group: 'contract' },
      { key: '계약종료일', label: '계약 종료일', group: 'contract' },
      { key: '수습시작일', label: '수습 시작일', group: 'contract' },
      { key: '수습종료일', label: '수습 종료일', group: 'contract' },
      { key: '수습기간', label: '수습기간', group: 'contract' },
      { key: '근무형태', label: '근무형태', group: 'contract' },
      { key: '근무요일', label: '근무요일', group: 'contract' },
    ],
  },
];

export const ALL_PLACEHOLDER_FIELDS = PLACEHOLDER_GROUPS.flatMap(g => g.fields);

// ─── 입력 필드 그룹 (complex block insertions) ───

const mention = (id: string): JSONContent => ({
  type: 'mention',
  attrs: { id, label: id },
});

const text = (t: string): JSONContent => ({ type: 'text', text: t });
const bold = (t: string): JSONContent => ({ type: 'text', text: t, marks: [{ type: 'bold' }] });

const cell = (...content: JSONContent[]): JSONContent => ({
  type: 'tableCell',
  content: [{ type: 'paragraph', content }],
});
const headerCell = (...content: JSONContent[]): JSONContent => ({
  type: 'tableHeader',
  content: [{ type: 'paragraph', content }],
});
const row = (...cells: JSONContent[]): JSONContent => ({
  type: 'tableRow',
  content: cells,
});

export interface InputFieldGroup {
  id: string;
  label: string;
  content: JSONContent;
}

export const INPUT_FIELD_GROUPS: InputFieldGroup[] = [
  {
    id: 'contract_signature',
    label: '계약서용 서명란',
    content: {
      type: 'table',
      content: [
        row(
          cell(mention('계약일')),
          cell(text('회사명(A)')),
          cell(mention('회사명')),
          cell(text('생년월일(B)')),
          cell(mention('생년월일')),
        ),
        row(
          cell(),
          cell(text('직위 / 성명(A)')),
          cell(text('대표 / '), mention('대표자명')),
          cell(text('성명(B)')),
          cell(mention('구성원이름')),
        ),
        row(
          cell(),
          cell(text('서명(인)')),
          cell(mention('회사직인')),
          cell(text('서명(인)')),
          cell(mention('구성원직인')),
        ),
      ],
    },
  },
  {
    id: 'oath_signature',
    label: '서약서용 서명란',
    content: {
      type: 'table',
      content: [
        row(
          cell(text('작성일')),
          cell(mention('계약일')),
        ),
        row(
          cell(text('소속 / 직위')),
          cell(mention('부서'), text(' / '), mention('직위')),
        ),
        row(
          cell(text('성명')),
          cell(mention('구성원이름'), text(' (서명)')),
        ),
      ],
    },
  },
  {
    id: 'work_hours_table',
    label: '근로일별 근로시간표',
    content: {
      type: 'table',
      content: [
        row(
          headerCell(bold('구분')),
          headerCell(bold('월')),
          headerCell(bold('화')),
          headerCell(bold('수')),
          headerCell(bold('목')),
          headerCell(bold('금')),
          headerCell(bold('합계')),
        ),
        row(
          cell(text('시업')),
          cell(text('09:00')),
          cell(text('09:00')),
          cell(text('09:00')),
          cell(text('09:00')),
          cell(text('09:00')),
          cell(),
        ),
        row(
          cell(text('종업')),
          cell(text('18:00')),
          cell(text('18:00')),
          cell(text('18:00')),
          cell(text('18:00')),
          cell(text('18:00')),
          cell(),
        ),
        row(
          cell(text('휴게')),
          cell(text('1시간')),
          cell(text('1시간')),
          cell(text('1시간')),
          cell(text('1시간')),
          cell(text('1시간')),
          cell(),
        ),
        row(
          cell(bold('근로시간')),
          cell(text('8시간')),
          cell(text('8시간')),
          cell(text('8시간')),
          cell(text('8시간')),
          cell(text('8시간')),
          cell(bold('40시간')),
        ),
      ],
    },
  },
  {
    id: 'wage_table_comprehensive',
    label: '임금·수당표 (포괄)',
    content: {
      type: 'table',
      content: [
        row(headerCell(bold('구분')), headerCell(bold('금액')), headerCell(bold('고정초과근무수당'))),
        row(
          cell(text('월 지급액')),
          cell(mention('월급')),
          cell(text('계약 기준: '), mention('고정연장시간'), text('시간')),
        ),
        row(
          cell(text('기본급 (주휴수당포함)')),
          cell(mention('기본급')),
          cell(),
        ),
        row(
          cell(text('고정초과근무수당')),
          cell(mention('고정연장수당')),
          cell(text('고정초과근무 상세')),
        ),
      ],
    },
  },
  {
    id: 'wage_table_standard',
    label: '임금·수당표 (통상)',
    content: {
      type: 'table',
      content: [
        row(headerCell(bold('구분')), headerCell(bold('금액')), headerCell(bold('비고'))),
        row(cell(text('월 지급액')), cell(mention('월급')), cell()),
        row(cell(text('기본급')), cell(mention('기본급')), cell(text('주휴수당 포함'))),
      ],
    },
  },
  {
    id: 'salary_table_comprehensive',
    label: '임금표 (포괄)',
    content: {
      type: 'table',
      content: [
        row(headerCell(bold('항목')), headerCell(bold('금액'))),
        row(cell(text('연봉')), cell(mention('연봉'))),
        row(cell(text('월 지급액')), cell(mention('월급'))),
        row(cell(text('기본급')), cell(mention('기본급'))),
        row(cell(text('고정연장수당')), cell(mention('고정연장수당'))),
      ],
    },
  },
  {
    id: 'salary_table_standard',
    label: '임금표 (통상)',
    content: {
      type: 'table',
      content: [
        row(headerCell(bold('항목')), headerCell(bold('금액'))),
        row(cell(text('연봉')), cell(mention('연봉'))),
        row(cell(text('월 지급액')), cell(mention('월급'))),
        row(cell(text('기본급')), cell(mention('기본급'))),
      ],
    },
  },
  {
    id: 'allowance_table',
    label: '수당표',
    content: {
      type: 'table',
      content: [
        row(headerCell(bold('수당 항목')), headerCell(bold('금액')), headerCell(bold('비고'))),
        row(cell(text('고정연장수당')), cell(mention('고정연장수당')), cell(mention('고정연장시간'), text('시간 기준'))),
        row(cell(text('기타 수당')), cell(), cell()),
      ],
    },
  },
];

// Sample data for preview
export const SAMPLE_DATA: Record<string, string> = {
  '회사명': '주식회사 아크뱅크',
  '회사주소': '서울특별시 강남구 테헤란로 123',
  '사업자등록번호': '123-45-67890',
  '대표자명': '홍길동',
  '업태': '서비스업',
  '업종': '소프트웨어 개발',
  '회사전화': '02-1234-5678',
  '회사이메일': 'info@arcbank.co.kr',
  '회사직인': '[회사 직인]',
  '구성원직인': '[구성원 직인]',
  '구성원이름': '김철수',
  '생년월일': '1990-01-15',
  '부서': '개발팀',
  '직위': '대리',
  '직책': '프론트엔드 개발자',
  '입사일': '2024-03-01',
  '주소': '서울특별시 서초구 반포대로 456',
  '전화번호': '010-1234-5678',
  '이메일': 'chulsoo@email.com',
  '연봉': '48,000,000',
  '월급': '4,000,000',
  '기본급': '3,500,000',
  '고정연장수당': '500,000',
  '고정연장시간': '20',
  '급여일': '25',
  '계약일': '2024-03-01',
  '계약시작일': '2024-03-01',
  '계약종료일': '2025-02-28',
  '수습시작일': '2024-03-01',
  '수습종료일': '2024-05-31',
  '수습기간': '3개월',
  '근무형태': '고정 근무제',
  '근무요일': '월,화,수,목,금요일',
};
