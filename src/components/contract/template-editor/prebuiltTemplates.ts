import type { JSONContent } from '@tiptap/react';

const text = (t: string, marks?: any[]): JSONContent => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
});

const bold = (t: string): JSONContent => text(t, [{ type: 'bold' }]);
const colored = (t: string, color: string): JSONContent => text(t, [{ type: 'textStyle', attrs: { color } }]);
const boldColored = (t: string, color: string): JSONContent => text(t, [{ type: 'bold' }, { type: 'textStyle', attrs: { color } }]);

const p = (...content: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  content: content.length ? content : undefined,
});

const pText = (t: string): JSONContent => p(text(t));
const pBold = (t: string): JSONContent => p(bold(t));

const heading = (t: string, level: number, align?: string): JSONContent => ({
  type: 'heading',
  attrs: { level, ...(align ? { textAlign: align } : {}) },
  content: [bold(t)],
});

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

const table = (...rows: JSONContent[]): JSONContent => ({
  type: 'table',
  content: rows,
});

// placeholder styled as green badge
const ph = (label: string): JSONContent => boldColored(`{{${label}}}`, '#16a34a');

export interface PrebuiltTemplate {
  id: string;
  name: string;
  type: 'labor' | 'salary';
  content: JSONContent;
}

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    id: 'labor-regular-comprehensive',
    name: '근로계약서 (정규직 선택적근무 포괄임금)',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (정규직 선택적근무 포괄임금)', 1, 'center'),
        p(),

        // 제1조
        pBold('제1조 (당사자)'),
        p(ph('회사명'), text(' (이하 \'A\')와(과) '), ph('구성원이름'), text(' (이하 \'B\')은(는) 다음과 같이 근로계약을 체결하고, 이를 성실히 이행하기로 합의하며 서명 날인한다.')),
        p(),

        // 제2조
        pBold('제2조 (근로계약기간)'),
        pText('계약기간은 '),
        p(ph('계약시작일'), text(' 부터 기간의 정함이 없는 근로계약으로 한다.')),
        p(),

        // 제3조
        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('\'B\'의 담당 업무는 '), ph('직위'), text(' 및 \'A\'가 지정하는 업무를 하며, 근무장소는 '), ph('회사주소'), text(' 이다. 단, \'A\'는 경영상 필요에 따라 담당업무 및 근무장소를 변경할 수 있으며, \'B\'는 이에 동의한다.')),
        p(),

        // 제4조
        pBold('제4조 (근로시간 및 휴게시간)'),
        p(text('① 근로시간은 '), ph('근무형태'), text('를 운영하는 것을 원칙으로 하며, 필수 근로시간은 10:00~16:00으로 정한다.')),
        p(text('② \'B\'의 근로시간은 '), ph('근무요일'), text(' 간 1일 평균 8시간으로 산정하되, 선택적 근로시간대에 따라 근로일별 근로시간을 조절할 수 있다.')),
        pText('③ \'B\'의 휴게시간은 12:00~13:00으로 하되, 업무상 필요한 경우 이를 변경할 수 있으며, \'B\'는 이에 따른다.'),
        pText('④ \'A\'는 근로시간 외 업무상 필요한 연장·야간·휴일 근로를 요청할 수 있으며, \'B\'는 특별한 사정이 없는 한 이에 동의하여 근로를 제공한다.'),
        p(),

        // 제5조
        pBold('제5조 (근무일, 휴일 및 휴가)'),
        p(text('① 근로일은 '), ph('근무요일'), text('로 한다.')),
        pText('② 주휴일은 일요일로 한다.'),
        pText('③ \'A\'는 \'B\'가 1주간 소정근로를 개근한 때에는 제2항의 주휴일을 유급으로 부여한다.'),
        pText('④ \'A\'는 제2항의 주휴일 외에 근로기준법 제55조제2항의 공휴일을 유급휴일로 부여한다.'),
        p(),

        // 제6조 (임금)
        pBold('제6조 (임금)'),
        p(text('① \'B\'의 급여 지급기준 은 '), ph('연봉'), text(', 월 지급액은 '), ph('월급'), text('원으로 하며, 임금의 구성항목은 다음 표와 같다.')),

        // 임금 테이블
        table(
          row(headerCell(bold('구분')), headerCell(bold('금액')), headerCell(bold('고정초과근무수당'))),
          row(
            cell(text('월 지급액')),
            cell(ph('월급')),
            cell(text('계약 기준: '), ph('고정연장시간'), text('시간'))
          ),
          row(
            cell(text('기본급 (주휴수당포함)')),
            cell(ph('기본급')),
            cell()
          ),
          row(
            cell(text('고정초과근무수당')),
            cell(ph('고정연장수당')),
            cell(text('고정초과근무 상세'))
          ),
          row(
            cell(text('계약 수당 포함')),
            cell(text('기타 수당')),
            cell()
          ),
        ),
        p(),
        pText('② \'A\'는 \'B\'에게 임금 지급 시 소득세, 사회보험 등 관계법령에 따른 금액을 원천징수를 한 후 그 차액을 지급한다.'),
        p(text('③ 급여는 매월 1일부터 말일까지 산정하여 '), ph('급여일'), text('에 \'B\'명의의 계좌로 지급한다. '), colored('단, 신규 입사자의 입사 당월의 임금은 일할계산하여 다음 정기 급여일에 합산하여 지급할 수 있다.', '#dc2626')),
        pText('④ 상기 급여에 고정초과근무수당이 가산되어 포함되어 있음을 확인하며, 상기와 같이 지급됨을 동의한다.'),
        p(),

        // 제7조
        pBold('제7조 (연차유급휴가)'),
        pText('연차유급휴가는 \'근로기준법\'의 정함에 따르며, 그 외 사항은 \'취업규칙\'등에 의한다.'),
        p(),

        // 제8조
        pBold('제8조 (손해배상)'),
        pText('① \'B\'가 고의 또는 중대한 과실로 \'A\'에게 손해를 끼친 경우 그 손해를 배상하여야 한다.'),
        pText('② \'A\'는 \'B\'의 근로 중 발생한 재해에 대해 산업재해보상보험법에 따라 보상한다.'),
        p(),

        // 제9조
        pBold('제9조 (수습기간)'),
        p(text('수습기간: '), ph('수습기간'), text(' ('), ph('수습시작일'), text(' ~ '), ph('수습종료일'), text(')')),
        pText('수습기간 중의 임금은 본 계약의 임금과 동일하게 적용한다.'),
        p(),

        // 제10조
        pBold('제10조 (기타)'),
        pText('① 본 계약에 명시되지 않은 사항은 근로기준법, 취업규칙 및 관계법령에 따른다.'),
        pText('② \'B\'는 재직 중 알게 된 회사의 영업비밀을 외부에 누설하지 않는다.'),
        pText('③ 본 계약서는 2부를 작성하여 \'A\'와 \'B\'가 각 1부씩 보관한다.'),
        p(),
        p(),

        // 서명란
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('(사업주) '), ph('회사명'), text('  대표이사 '), ph('대표자명'), text('  (인)')),
        p(text('(근로자) '), ph('구성원이름'), text('  (생년월일: '), ph('생년월일'), text(')  (인)')),
      ],
    },
  },
  {
    id: 'labor-regular-standard',
    name: '근로계약서 (정규직 시차근무 통상임금)',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (정규직 시차근무 통상임금)', 1, 'center'),
        p(),

        pBold('제1조 (당사자)'),
        p(ph('회사명'), text(' (이하 \'A\')와(과) '), ph('구성원이름'), text(' (이하 \'B\')은(는) 다음과 같이 근로계약을 체결하고, 이를 성실히 이행하기로 합의하며 서명 날인한다.')),
        p(),

        pBold('제2조 (근로계약기간)'),
        p(text('계약기간은 '), ph('계약시작일'), text(' 부터 기간의 정함이 없는 근로계약으로 한다.')),
        p(),

        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('\'B\'의 담당 업무는 '), ph('직위'), text(' 및 \'A\'가 지정하는 업무를 하며, 근무장소는 '), ph('회사주소'), text(' 이다.')),
        p(),

        pBold('제4조 (근로시간 및 휴게시간)'),
        pText('① 1일 소정근로시간은 8시간, 1주 소정근로시간은 40시간으로 한다.'),
        pText('② 시업시각: 09:00 / 종업시각: 18:00 (시차근무제에 따라 조정 가능)'),
        pText('③ 휴게시간: 12:00~13:00'),
        p(),

        pBold('제5조 (근무일, 휴일 및 휴가)'),
        p(text('① 근로일은 '), ph('근무요일'), text('로 한다.')),
        pText('② 주휴일은 일요일로 한다.'),
        p(),

        pBold('제6조 (임금)'),
        p(text('① 연봉: '), ph('연봉'), text('원')),
        p(text('② 월급: '), ph('월급'), text('원 (통상임금 기준)')),
        p(text('③ 기본급: '), ph('기본급'), text('원')),
        p(text('④ 임금은 매월 '), ph('급여일'), text('일에 근로자 명의의 예금통장에 입금하여 지급한다.')),
        pText('⑤ 연장·야간·휴일 근로수당은 근로기준법에 따라 별도 산정하여 지급한다.'),
        p(),

        pBold('제7조 (수습기간)'),
        p(text('수습기간: '), ph('수습기간'), text(' ('), ph('수습시작일'), text(' ~ '), ph('수습종료일'), text(')')),
        p(),

        pBold('제8조 (연차유급휴가)'),
        pText('연차유급휴가는 근로기준법에서 정하는 바에 따라 부여한다.'),
        p(),

        pBold('제9조 (손해배상)'),
        pText('\'B\'가 고의 또는 중대한 과실로 \'A\'에게 손해를 끼친 경우 그 손해를 배상하여야 한다.'),
        p(),

        pBold('제10조 (기타)'),
        pText('본 계약에 명시되지 않은 사항은 근로기준법 및 관계법령에 따른다.'),
        p(),
        p(),

        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('(사업주) '), ph('회사명'), text('  대표이사 '), ph('대표자명'), text('  (인)')),
        p(text('(근로자) '), ph('구성원이름'), text('  (생년월일: '), ph('생년월일'), text(')  (인)')),
      ],
    },
  },
  {
    id: 'labor-contract-shift',
    name: '근로계약서 (계약직 교대근무 시급제 통상임금)',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (계약직 교대근무 통상임금)', 1, 'center'),
        p(),

        pBold('제1조 (당사자)'),
        p(ph('회사명'), text(' (이하 \'A\')와(과) '), ph('구성원이름'), text(' (이하 \'B\')은(는) 다음과 같이 근로계약을 체결한다.')),
        p(),

        pBold('제2조 (근로계약기간)'),
        p(text('계약기간: '), ph('계약시작일'), text(' ~ '), ph('계약종료일')),
        p(),

        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('업무: '), ph('직위'), text(' / 근무장소: '), ph('회사주소')),
        p(),

        pBold('제4조 (근로시간)'),
        pText('교대근무제를 적용하며, 주 소정근로시간은 40시간 이내로 한다.'),
        p(text('근무형태: '), ph('근무형태')),
        p(text('근무요일: '), ph('근무요일')),
        p(),

        pBold('제5조 (임금)'),
        p(text('시급: 최저임금법 기준 이상')),
        p(text('월 환산급: '), ph('월급'), text('원')),
        p(text('임금은 매월 '), ph('급여일'), text('일에 지급한다.')),
        p(),

        pBold('제6조 (기타)'),
        pText('본 계약에 명시되지 않은 사항은 근로기준법에 따른다.'),
        p(),
        p(),

        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('(사업주) '), ph('회사명'), text('  대표이사 '), ph('대표자명'), text('  (인)')),
        p(text('(근로자) '), ph('구성원이름'), text('  (인)')),
      ],
    },
  },
  {
    id: 'salary-annual',
    name: '연봉계약서',
    type: 'salary',
    content: {
      type: 'doc',
      content: [
        heading('연 봉 계 약 서', 1, 'center'),
        p(),

        p(ph('회사명'), text(' (이하 "회사")과 '), ph('구성원이름'), text(' (이하 "직원")은 다음과 같이 연봉계약을 체결한다.')),
        p(),

        pBold('제1조 (계약기간)'),
        p(text('본 연봉계약의 적용기간은 '), ph('계약시작일'), text(' 부터 '), ph('계약종료일'), text(' 까지로 한다.')),
        p(),

        pBold('제2조 (연봉)'),
        p(text('직원의 연봉은 금 '), ph('연봉'), text('원 (월 '), ph('월급'), text('원)으로 정한다.')),
        p(),

        pBold('제3조 (임금 구성)'),
        table(
          row(headerCell(bold('구분')), headerCell(bold('금액')), headerCell(bold('비고'))),
          row(cell(text('기본급')), cell(ph('기본급')), cell(text('주휴수당 포함'))),
          row(cell(text('고정연장수당')), cell(ph('고정연장수당')), cell(ph('고정연장시간'), text('시간 분'))),
          row(cell(bold('월 합계')), cell(ph('월급')), cell()),
        ),
        p(),

        pBold('제4조 (지급방법)'),
        p(text('연봉은 12개월로 균등 분할하여 매월 '), ph('급여일'), text('일에 지급한다.')),
        pText('소득세, 4대보험료 등 법정 공제를 원천징수 후 지급한다.'),
        p(),

        pBold('제5조 (기타)'),
        pText('본 계약에 명시되지 않은 사항은 회사 규정 및 관계법령에 따른다.'),
        p(),
        p(),

        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('(회사) '), ph('회사명'), text('  대표이사 '), ph('대표자명'), text('  (인)')),
        p(text('(직원) '), ph('구성원이름'), text('  (인)')),
      ],
    },
  },
  {
    id: 'nda',
    name: '비밀 유지 서약서',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('비 밀 유 지 서 약 서', 1, 'center'),
        p(),
        p(text('본인 '), ph('구성원이름'), text('은(는) '), ph('회사명'), text('(이하 "회사")에 입사함에 있어 다음 사항을 서약합니다.')),
        p(),
        pBold('제1조 (비밀유지 의무)'),
        pText('본인은 재직 중 또는 퇴직 후에도 업무상 알게 된 회사의 경영, 영업, 기술상의 비밀 및 고객정보를 제3자에게 누설하거나 외부에 공개하지 않겠습니다.'),
        p(),
        pBold('제2조 (자료 반납)'),
        pText('본인은 퇴직 시 회사의 모든 자료, 문서, 전자데이터 등을 즉시 반납하겠습니다.'),
        p(),
        pBold('제3조 (손해배상)'),
        pText('위 서약 사항을 위반하여 회사에 손해를 끼친 경우 민·형사상의 책임을 지겠습니다.'),
        p(),
        p(),
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('서약인: '), ph('구성원이름'), text('  (인)')),
        p(text('소속: '), ph('부서')),
        p(text('직위: '), ph('직위')),
      ],
    },
  },
  {
    id: 'non-compete',
    name: '경업 금지 서약서',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('경 업 금 지 서 약 서', 1, 'center'),
        p(),
        p(text('본인 '), ph('구성원이름'), text('은(는) '), ph('회사명'), text('(이하 "회사") 퇴직 후 다음 사항을 준수할 것을 서약합니다.')),
        p(),
        pBold('제1조 (경업금지 범위)'),
        pText('본인은 퇴직일로부터 1년간 회사와 동종 또는 유사한 업종에 취업하거나 사업을 영위하지 않겠습니다.'),
        p(),
        pBold('제2조 (위반 시 조치)'),
        pText('위 서약 사항을 위반한 경우 회사가 입은 손해에 대해 배상하겠습니다.'),
        p(),
        p(),
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('서약인: '), ph('구성원이름'), text('  (인)')),
      ],
    },
  },
  {
    id: 'privacy-consent',
    name: '개인 정보 이용 동의서',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('개인정보 수집·이용 동의서', 1, 'center'),
        p(),
        p(ph('회사명'), text('(이하 "회사")은 다음과 같이 개인정보를 수집·이용하고자 합니다.')),
        p(),
        pBold('1. 수집 항목'),
        pText('성명, 생년월일, 연락처, 주소, 학력, 경력사항, 가족관계, 주민등록번호 등'),
        p(),
        pBold('2. 수집·이용 목적'),
        pText('인사관리, 급여관리, 4대보험 가입, 연말정산, 퇴직금 산정 등'),
        p(),
        pBold('3. 보유 및 이용 기간'),
        pText('고용관계 종료 시까지 (단, 관계법령에 따라 보존이 필요한 경우 해당 기간까지)'),
        p(),
        pText('본인은 위 내용을 충분히 이해하였으며, 개인정보 수집·이용에 동의합니다.'),
        p(),
        { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
        p(),
        p(text('동의인: '), ph('구성원이름'), text('  (인)')),
      ],
    },
  },
];
