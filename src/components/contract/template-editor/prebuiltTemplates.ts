import type { JSONContent } from '@tiptap/react';

type Mark = { type: string; attrs?: Record<string, unknown> };

const text = (t: string, marks?: Mark[]): JSONContent => ({
  type: 'text',
  text: t,
  ...(marks ? { marks } : {}),
});

const bold = (t: string): JSONContent => text(t, [{ type: 'bold' }]);
const boldColored = (t: string, color: string): JSONContent => text(t, [{ type: 'bold' }, { type: 'textStyle', attrs: { color } }]);

const p = (...content: JSONContent[]): JSONContent => ({
  type: 'paragraph',
  content: content.length ? content : undefined,
});

const pText = (t: string): JSONContent => p(text(t));
const pBold = (t: string): JSONContent => p(bold(t));

const listItem = (...content: JSONContent[]): JSONContent => ({
  type: 'listItem',
  content: [p(...content)],
});

const bulletList = (...items: JSONContent[]): JSONContent => ({
  type: 'bulletList',
  content: items,
});

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

const ph = (label: string): JSONContent => boldColored(`{{${label}}}`, '#16a34a');

const signatureBlock = (): JSONContent[] => [
  p(),
  { type: 'paragraph', attrs: { textAlign: 'center' }, content: [ph('계약일')] },
  p(),
  p(text('(회사) '), ph('회사명'), text('  대표자 '), ph('대표자명'), text('  '), ph('회사직인')),
  p(text('(구성원) '), ph('구성원이름'), text('  (생년월일: '), ph('생년월일'), text(')  '), ph('구성원직인')),
];

const partyClause = (): JSONContent[] => [
  pBold('제1조 (당사자 및 계약의 목적)'),
  p(ph('회사명'), text(' (이하 "회사")와 '), ph('구성원이름'), text(' (이하 "구성원")은 본 계약을 체결하고, 회사의 취업규칙·인사규정·보안규정 및 관계법령을 성실히 준수하기로 한다.')),
  pText('본 계약은 근로기준법 제17조에 따른 주요 근로조건을 전자문서로 명시·교부하기 위한 문서이며, 전자서명 완료본은 서면 교부와 동일한 관리 기준으로 보존한다.'),
  p(),
];

const operationControlClause = (): JSONContent[] => [
  pBold('업무 및 근무장소 변경 기준'),
  bulletList(
    listItem(text('회사는 업무상 필요, 조직개편, 고객 대응, 사업장 운영상 사유가 있는 경우 구성원의 담당업무, 부서, 근무장소, 보고체계를 변경할 수 있다.')),
    listItem(text('이 경우 회사는 구성원의 직무역량, 생활상 불이익, 업무 연속성을 합리적으로 고려하고 필요한 범위에서 사전 설명 또는 협의를 진행한다.')),
  ),
  p(),
];

const overtimeControlClause = (): JSONContent[] => [
  pBold('초과근로 승인 및 기록'),
  bulletList(
    listItem(text('연장·야간·휴일근로는 회사의 사전 승인 또는 사후 승인된 근태기록을 기준으로 관리한다.')),
    listItem(text('실제 근로 제공이 객관적으로 확인되는 경우 회사는 관계법령에 따라 법정수당을 지급한다.')),
    listItem(text('구성원은 근로시간, 휴게시간, 외근, 재택근무, 출장 등 근태사항을 회사가 정한 시스템에 사실대로 기록하여야 한다.')),
  ),
  p(),
];

const probationClause = (): JSONContent[] => [
  pBold('수습 및 평가'),
  p(text('수습기간은 '), ph('수습기간'), text('으로 하며, 수습 시작일은 '), ph('수습시작일'), text(', 종료일은 '), ph('수습종료일'), text('로 한다.')),
  bulletList(
    listItem(text('회사는 수습기간 중 직무수행능력, 근태, 협업태도, 보안준수, 고객응대, 회사 규정 준수 여부를 평가할 수 있다.')),
    listItem(text('평가 결과 직무 적합성이 부족하거나 규정 위반이 중대한 경우 회사는 관계법령에 따라 본채용 거절 또는 계약 종료를 검토할 수 있다.')),
  ),
  p(),
];

const damageClause = (): JSONContent[] => [
  pBold('손해배상 및 금지사항'),
  bulletList(
    listItem(text('구성원이 고의 또는 중대한 과실로 회사에 실제 손해를 발생시킨 경우, 회사는 입증 가능한 손해 범위에서 민사상 배상을 청구할 수 있다.')),
    listItem(text('회사는 관계법령상 허용되지 않는 위약벌, 사전 손해배상 예정, 임금 일방상계는 적용하지 않는다.')),
  ),
  p(),
];

export interface PrebuiltTemplate {
  id: string;
  name: string;
  type: 'labor' | 'salary' | 'oath' | 'privacy' | 'custom';
  content: JSONContent;
}

export const PREBUILT_TEMPLATES: PrebuiltTemplate[] = [
  {
    id: 'labor-regular-standard-2026',
    name: '2026 정규직 근로계약서 - 통상임금형',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (2026 정규직 통상임금형)', 1, 'center'),
        p(),
        ...partyClause(),
        pBold('제2조 (근로계약기간)'),
        p(ph('계약시작일'), text('부터 기간의 정함이 없는 근로계약으로 한다.')),
        p(),
        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('구성원의 담당업무는 '), ph('직위'), text(' 및 회사가 지정하는 관련 업무로 하며, 근무장소는 '), ph('회사주소'), text(' 또는 회사가 승인한 장소로 한다.')),
        ...operationControlClause(),
        pBold('제4조 (근로시간 및 휴게시간)'),
        bulletList(
          listItem(text('근무형태는 '), ph('근무형태'), text(', 근무일은 '), ph('근무요일'), text('로 한다.')),
          listItem(text('1일 소정근로시간은 8시간, 1주 소정근로시간은 40시간을 기준으로 한다.')),
          listItem(text('휴게시간은 근로시간 도중 1시간을 부여하며, 부서 운영상 필요한 경우 회사가 정한 범위에서 조정할 수 있다.')),
        ),
        ...overtimeControlClause(),
        pBold('제5조 (임금)'),
        p(text('연봉은 '), ph('연봉'), text('원, 월 지급액은 '), ph('월급'), text('원으로 하며, 기본급은 '), ph('기본급'), text('원으로 한다.')),
        table(
          row(headerCell(bold('항목')), headerCell(bold('금액')), headerCell(bold('기준'))),
          row(cell(text('월 지급액')), cell(ph('월급')), cell(text('월 소정근로 및 법정 주휴 포함'))),
          row(cell(text('기본급')), cell(ph('기본급')), cell(text('통상임금 산정 기준'))),
          row(cell(text('초과근로수당')), cell(text('실제 발생분 별도 산정')), cell(text('사전승인·근태기록 기준'))),
        ),
        bulletList(
          listItem(text('임금은 매월 1일부터 말일까지 산정하여 매월 '), ph('급여일'), text('일에 구성원 명의 계좌로 지급한다.')),
          listItem(text('소득세, 지방소득세, 4대보험료 등 법정 공제액은 원천징수한다.')),
          listItem(text('2026년 최저임금은 시간급 10,320원이며, 본 계약 및 실제 지급액은 최저임금법상 최저임금 이상이 되도록 운영한다.')),
        ),
        p(),
        ...probationClause(),
        pBold('제7조 (휴일 및 휴가)'),
        bulletList(
          listItem(text('주휴일, 관공서 공휴일, 연차유급휴가는 근로기준법 및 회사 취업규칙에 따른다.')),
          listItem(text('연차 사용은 업무공백, 고객 대응, 팀 운영상 필요를 고려하여 회사의 절차에 따라 신청·승인한다.')),
        ),
        p(),
        pBold('제8조 (보안, 겸업 및 이해상충)'),
        bulletList(
          listItem(text('구성원은 재직 중 회사의 고객정보, 견적, 단가, 제작도면, 거래처, 영업전략, 내부 시스템 정보를 외부에 제공하거나 사적으로 이용할 수 없다.')),
          listItem(text('겸업, 외부 프로젝트, 이해상충 가능 활동은 사전에 회사에 고지하고 승인을 받아야 한다.')),
        ),
        p(),
        ...damageClause(),
        pBold('제10조 (기타)'),
        pText('본 계약에 정하지 않은 사항은 근로기준법, 최저임금법, 취업규칙, 회사 규정 및 관계법령에 따른다.'),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'labor-regular-comprehensive-2026',
    name: '2026 정규직 근로계약서 - 포괄임금 선택형',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (2026 포괄임금 선택형)', 1, 'center'),
        p(),
        ...partyClause(),
        pBold('제2조 (근로계약기간)'),
        p(ph('계약시작일'), text('부터 기간의 정함이 없는 근로계약으로 한다.')),
        p(),
        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('구성원의 담당업무는 '), ph('직위'), text(' 및 회사가 지정하는 관련 업무로 하며, 근무장소는 '), ph('회사주소'), text(' 또는 회사가 승인한 장소로 한다.')),
        ...operationControlClause(),
        pBold('제4조 (근로시간, 휴게시간 및 근태기록)'),
        bulletList(
          listItem(text('근무형태는 '), ph('근무형태'), text(', 근무일은 '), ph('근무요일'), text('로 하며, 원칙적으로 매주 월요일부터 금요일까지 근무한다.')),
          listItem(text('1일 근로시간은 09:00부터 18:00까지, 휴게시간은 12:00부터 13:00까지로 한다.')),
          listItem(text('소정근로시간은 1일 8시간, 1주 40시간으로 한다.')),
          listItem(text('회사는 업무상 필요, 고객 납기, 제작 일정, 사업장 운영상 사유가 있는 경우 관계법령상 허용되는 범위에서 연장근로, 휴일근로, 야간근로를 요청할 수 있다.')),
          listItem(text('구성원은 본 계약 체결로 위 범위 내 초과근로 운영에 사전 동의하되, 실제 근로시간은 회사 승인 및 근태기록 기준으로 관리한다.')),
          listItem(text('구성원은 회사가 정한 방식으로 실제 출퇴근, 휴게, 외근, 재택근무, 출장, 초과근로 시간을 사실대로 기록하여야 한다.')),
        ),
        ...overtimeControlClause(),
        pBold('제5조 (임금 및 고정초과근무수당)'),
        pText('임금은 기본임금과 법정 제수당 중 약정 고정초과근무수당을 포함한 포괄임금 구조로 하며, 임금 구성과 산정 기준은 아래 표와 같다.'),
        table(
          row(headerCell(bold('항목')), headerCell(bold('금액')), headerCell(bold('산정 기준'))),
          row(cell(text('급여 형태')), cell(ph('급여형태')), cell(text('연봉·월급·시급 중 발송 시 선택한 기준'))),
          row(cell(text('시급 기준액')), cell(ph('시급'), text('원')), cell(text('2026년 최저임금 이상'))),
          row(cell(text('기본급')), cell(ph('기본급')), cell(text('월 소정근로 및 법정 주휴 포함'))),
          row(cell(text('고정연장수당')), cell(ph('고정연장수당')), cell(ph('고정연장시간'), text('시간 기준'))),
          row(cell(bold('월 지급액')), cell(ph('월급')), cell(text('법정 공제 전 금액'))),
        ),
        bulletList(
          listItem(text('고정연장수당은 월 '), ph('고정연장시간'), text('시간의 연장·야간·휴일근로 가능성을 고려하여 산정한 포괄임금 항목이다.')),
          listItem(text('고정연장시간을 초과한 초과분 별도 지급은 실제 근태기록, 회사 승인 내역, 객관적으로 확인되는 근로 제공 사실을 기준으로 관계법령에 따라 처리한다.')),
          listItem(text('임금은 매월 1일부터 말일까지 산정하여 매월 '), ph('급여일'), text('일에 구성원 명의 계좌로 지급한다.')),
          listItem(text('소득세, 지방소득세, 4대보험료 등 법정 공제액은 원천징수한다.')),
          listItem(text('임금은 무노동 무임금을 원칙으로 하며, 결근·무급휴무 등 근로 제공이 없는 기간은 관계법령과 취업규칙에 따라 해당 기간의 임금을 공제할 수 있다.')),
          listItem(text('2026년 최저임금은 시간급 10,320원이며, 고정초과근무수당을 제외한 최저임금 산입 가능 임금도 최저임금 이상이 되도록 운영한다.')),
        ),
        p(),
        ...probationClause(),
        pBold('제7조 (휴일, 휴가 및 대체운영)'),
        bulletList(
          listItem(text('주휴일, 관공서 공휴일, 연차유급휴가는 근로기준법 및 회사 취업규칙에 따른다.')),
          listItem(text('부여된 연차유급휴가일 외의 휴무는 별도 유급 처리 합의가 없는 한 무급 휴무일로 한다.')),
          listItem(text('연차휴가 사용은 원칙적으로 최소 1주일 전 소속 부서의 장 또는 회사가 정한 승인권자에게 신청하여 승인을 받아야 한다.')),
          listItem(text('회사는 업무공백, 고객 대응, 팀 운영상 필요를 고려하여 관계법령상 허용되는 범위에서 휴가 시기를 조정할 수 있다.')),
          listItem(text('특별한 사정이 없는 경우 하계휴가는 회사와 구성원의 상호 합의에 따라 연차유급휴가일에 포함하여 사용할 수 있다.')),
          listItem(text('연차유급휴가 및 사용 촉진에 관한 그 밖의 사항은 근로기준법, 취업규칙 및 회사 규정에 따른다.')),
        ),
        p(),
        pBold('제8조 (퇴직, 인수인계 및 계약해지)'),
        bulletList(
          listItem(text('구성원이 퇴직하고자 하는 경우 퇴직 예정일 14일 전까지 사직서를 제출하고, 후임자 또는 회사가 지정한 담당자가 업무를 인수인계받을 수 있도록 성실히 협조한다.')),
          listItem(text('회사는 사직원 승인, 정당한 사유 없는 통상 7일 이상 무단결근, 계속 3일 이상 무단결근, 고의 또는 중대한 과실로 인한 손실 초래 시 근로계약 해지를 검토할 수 있다.')),
          listItem(text('근무태도 또는 품행이 불량하여 개선의 여지가 부족한 경우, 회사의 기구 축소·제도 개편 등 경영상 사유가 있는 경우, 기타 취업규칙상 해지 사유가 있는 경우에도 관계법령과 취업규칙상 절차에 따른다.')),
          listItem(text('업무평가 점수가 3분기 이상 B 이하인 경우에는 직무수행능력 개선 필요 사유로 보아 교육, 개선기회, 소명 절차 및 취업규칙상 절차를 거쳐 계약해지 또는 배치전환을 검토할 수 있다.')),
        ),
        p(),
        pBold('제9조 (비밀유지, 보안, 겸업 및 이해상충)'),
        bulletList(
          listItem(text('구성원은 재직 중 및 퇴직 후 회사의 기술정보, 경영상 정보, 고객정보, 상담내용, 견적, 단가, 제작도면, 거래처, 영업전략, 내부 시스템, 계정, 인사·급여정보, 미공개 프로젝트 정보를 외부에 제공하거나 사적으로 이용할 수 없다.')),
          listItem(text('비밀정보에는 무기포 접합기술, 합지판 제작기술, 회사 고유 약품·기계설비 운용정보 등 회사가 독자적으로 보유하거나 관리하는 기술 및 운영정보가 포함된다.')),
          listItem(text('고객·거래처 정보를 무단 활용, 반출, 유출하거나 동종업계 등 외부 업무에서 회사 비밀정보를 사용·공개한 경우 비밀유지의무 위반으로 보며, 회사는 관계법령에 따라 민·형사상 책임을 물을 수 있다.')),
          listItem(text('겸업, 외부 프로젝트, 이해상충 가능 활동은 사전에 회사에 고지하고 승인을 받아야 한다.')),
          listItem(text('동종업계 취업 사실만으로 비밀유지의무 위반으로 보지는 않으며, 회사 비밀정보 또는 거래처 정보의 사용·유출 여부를 기준으로 판단한다.')),
        ),
        p(),
        ...damageClause(),
        pBold('제11조 (기타)'),
        bulletList(
          listItem(text('구성원은 본 계약의 포괄임금 구성, 고정연장시간, 고정연장수당 및 초과분 별도 지급 기준에 관한 설명을 듣고 동의한다.')),
          listItem(text('본 조항은 관계법령상 인정되는 구성원의 권리를 제한하거나 법정수당 청구권을 사전에 포기하게 하는 의미로 해석하지 않는다.')),
          listItem(text('본 계약에 정하지 않은 사항은 근로기준법, 최저임금법, 취업규칙, 회사 규정 및 관계법령에 따른다.')),
          listItem(text('회사는 본 근로계약 체결과 동시에 본 계약서 사본을 구성원에게 전자문서 또는 서면으로 교부한다.')),
        ),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'labor-fixed-term-2026',
    name: '2026 기간제 근로계약서',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (2026 기간제)', 1, 'center'),
        p(),
        ...partyClause(),
        pBold('제2조 (계약기간 및 갱신)'),
        p(text('계약기간은 '), ph('계약시작일'), text('부터 '), ph('계약종료일'), text('까지로 한다. 계약기간 만료 시 근로관계는 별도 통지 없이 종료된다.')),
        bulletList(
          listItem(text('계약 갱신 여부는 업무량, 프로젝트 지속 여부, 경영상 필요를 고려하여 회사가 판단한다.')),
          listItem(text('직무수행능력, 근태, 협업태도, 규정 준수 여부를 종합적으로 검토한다.')),
          listItem(text('본 계약만으로 갱신 기대권 또는 자동갱신이 보장되는 것은 아니다.')),
        ),
        p(),
        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('구성원의 담당업무는 '), ph('직위'), text(' 및 회사가 지정하는 관련 업무로 하며, 근무장소는 '), ph('회사주소'), text(' 또는 회사가 승인한 장소로 한다.')),
        ...operationControlClause(),
        pBold('제4조 (근로시간 및 휴게시간)'),
        p(text('근무형태는 '), ph('근무형태'), text(', 근무일은 '), ph('근무요일'), text('로 하며, 1주 소정근로시간은 40시간을 기준으로 한다.')),
        ...overtimeControlClause(),
        pBold('제5조 (임금)'),
        bulletList(
          listItem(text('연봉은 '), ph('연봉'), text('원, 월 지급액은 '), ph('월급'), text('원, 기본급은 '), ph('기본급'), text('원으로 한다.')),
          listItem(text('임금은 매월 '), ph('급여일'), text('일에 지급한다.')),
          listItem(text('2026년 최저임금 시간급 10,320원 이상이 되도록 임금을 산정한다.')),
          listItem(text('소득세, 지방소득세, 4대보험료 등 법정 공제액은 원천징수한다.')),
        ),
        p(),
        ...probationClause(),
        pBold('제7조 (휴일 및 휴가)'),
        pText('휴일과 연차유급휴가는 근로기준법 및 회사 취업규칙에 따른다.'),
        p(),
        pBold('제8조 (보안 및 자료반납)'),
        bulletList(
          listItem(text('구성원은 계약기간 중 및 종료 후 회사 정보와 고객정보를 보호하여야 한다.')),
          listItem(text('계약 종료 시 회사 자료, 계정, 장비, 저장매체를 즉시 반납하고 사본을 삭제하여야 한다.')),
        ),
        p(),
        ...damageClause(),
        pBold('제10조 (기타)'),
        pText('본 계약에 정하지 않은 사항은 근로기준법, 기간제 및 단시간근로자 보호 등에 관한 법률, 취업규칙, 회사 규정 및 관계법령에 따른다.'),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'labor-fixed-term-3month-comprehensive-2026',
    name: '2026 계약직 근로계약서 - 3개월 갱신·포괄임금형',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (2026 계약직 3개월 갱신·포괄임금형)', 1, 'center'),
        p(),
        ...partyClause(),
        pBold('제2조 (계약기간, 갱신 및 정규직 전환 검토)'),
        bulletList(
          listItem(text('계약기간은 '), ph('계약시작일'), text('부터 '), ph('계약종료일'), text('까지 3개월로 한다.')),
          listItem(text('계약기간 만료 시 근로관계는 별도 합의가 없는 한 종료된다.')),
          listItem(text('회사는 업무량, 프로젝트 지속 여부, 경영상 필요, 직무수행능력, 근태, 협업태도, 보안준수, 고객응대, 회사 규정 준수 여부를 종합적으로 평가하여 1회에 한해 추가 3개월 계약 갱신을 검토할 수 있다.')),
          listItem(text('본 계약만으로 갱신 기대권 또는 자동갱신이 보장되는 것은 아니다.')),
          listItem(text('총 계약기간 종료 전 회사는 성과, 직무 적합성, 조직 필요성, 경영상황을 기준으로 정규직 전환 가능성을 검토할 수 있다.')),
          listItem(text('정규직 전환은 회사의 별도 승인과 서면 또는 전자문서 합의가 있을 때 확정된다.')),
        ),
        p(),
        pBold('제3조 (담당업무 및 근무장소)'),
        p(text('구성원의 담당업무는 '), ph('직위'), text(' 및 회사가 지정하는 관련 업무로 하며, 근무장소는 '), ph('회사주소'), text(' 또는 회사가 승인한 장소로 한다.')),
        ...operationControlClause(),
        pBold('제4조 (근로시간, 휴게시간 및 근태기록)'),
        bulletList(
          listItem(text('근무형태는 '), ph('근무형태'), text(', 근무일은 '), ph('근무요일'), text('로 하며, 원칙적으로 매주 월요일부터 금요일까지 근무한다.')),
          listItem(text('1일 근로시간은 09:00부터 18:00까지, 휴게시간은 12:00부터 13:00까지로 한다.')),
          listItem(text('소정근로시간은 1일 8시간, 1주 40시간으로 한다.')),
          listItem(text('회사는 업무상 필요, 고객 납기, 제작 일정, 사업장 운영상 사유가 있는 경우 관계법령상 허용되는 범위에서 연장근로, 휴일근로, 야간근로를 요청할 수 있다.')),
          listItem(text('구성원은 본 계약 체결로 위 범위 내 초과근로 운영에 사전 동의하되, 실제 근로시간은 회사 승인 및 근태기록 기준으로 관리한다.')),
          listItem(text('구성원은 출퇴근, 휴게, 외근, 재택근무, 출장, 초과근로 등 근태사항을 회사 시스템에 사실대로 기록하여야 한다.')),
        ),
        p(),
        pBold('제5조 (임금, 포괄임금 및 최저임금)'),
        pText('임금은 기본임금과 법정 제수당 중 약정 고정초과근무수당을 포함한 포괄임금 구조로 하며, 임금 구성과 산정 기준은 아래 표와 같다.'),
        table(
          row(headerCell(bold('항목')), headerCell(bold('금액')), headerCell(bold('산정 기준'))),
          row(cell(text('급여 형태')), cell(ph('급여형태')), cell(text('연봉·월급·시급 중 발송 시 선택한 기준'))),
          row(cell(text('시급 기준액')), cell(ph('시급'), text('원')), cell(text('2026년 최저임금 이상'))),
          row(cell(text('기본급')), cell(ph('기본급')), cell(text('월 소정근로 및 법정 주휴 포함'))),
          row(cell(text('고정초과근무수당')), cell(ph('고정연장수당')), cell(ph('고정연장시간'), text('시간 기준'))),
          row(cell(bold('월 지급액')), cell(ph('월급')), cell(text('법정 공제 전 금액'))),
        ),
        bulletList(
          listItem(text('고정초과근무수당은 월 '), ph('고정연장시간'), text('시간 범위의 연장·야간·휴일근로 가능성을 고려하여 산정한 포괄임금 항목이다.')),
          listItem(text('회사는 고정초과근무수당 범위 내 근로에 대하여 별도 야간근로수당 항목을 중복 지급하지 않는다.')),
          listItem(text('고정연장시간을 초과한 초과분 별도 지급은 실제 근태기록, 회사 승인 내역, 객관적으로 확인되는 근로 제공 사실을 기준으로 관계법령에 따라 정산한다.')),
          listItem(text('고정초과근무수당이 관계법령상 법정수당에 미달하는 경우에도 같은 기준으로 정산한다.')),
          listItem(text('임금은 매월 1일부터 말일까지 산정하여 매월 '), ph('급여일'), text('일에 구성원 명의 계좌로 지급한다.')),
          listItem(text('소득세, 지방소득세, 4대보험료 등 법정 공제액은 원천징수한다.')),
          listItem(text('임금은 무노동 무임금을 원칙으로 하며, 결근·무급휴무 등 근로 제공이 없는 기간은 관계법령과 취업규칙에 따라 해당 기간의 임금을 공제할 수 있다.')),
          listItem(text('2026년 최저임금은 시간급 10,320원이며, 본 계약의 기본급 및 최저임금 산입 가능 임금은 최저임금법상 기준 이상이 되도록 운영한다.')),
        ),
        p(),
        pBold('제6조 (4대보험 및 법정 공제)'),
        bulletList(
          listItem(text('회사는 국민연금, 건강보험, 고용보험, 산재보험 등 4대보험을 관계법령상 가입 요건에 따라 적용한다.')),
          listItem(text('근로자 부담 보험료, 소득세, 지방소득세 등 법정 공제액은 급여 지급 시 공제한다.')),
        ),
        p(),
        pBold('제7조 (평가, 갱신 판단 및 계약 종료)'),
        bulletList(
          listItem(text('회사는 계약기간 중 직무수행능력, 업무품질, 납기 준수, 근태, 협업태도, 보안준수, 고객응대, 회사 규정 준수 여부를 평가할 수 있다.')),
          listItem(text('평가 결과는 계약 갱신, 정규직 전환 검토, 업무 배치, 교육 필요성 판단에 활용될 수 있다.')),
          listItem(text('업무평가 점수가 3분기 이상 B 이하인 경우에는 직무수행능력 개선 필요 사유로 보아 교육, 개선기회, 소명 절차 및 취업규칙상 절차를 거쳐 계약 갱신 거절, 계약해지 또는 배치전환을 검토할 수 있다.')),
          listItem(text('계약기간 만료, 갱신 거절, 정규직 전환 미승인, 업무 종료, 경영상 필요 감소 등으로 계약이 종료되는 경우 회사와 구성원은 자료·장비·계정 반납 및 인수인계를 성실히 이행한다.')),
        ),
        p(),
        pBold('제8조 (퇴직, 인수인계 및 계약해지)'),
        bulletList(
          listItem(text('구성원이 퇴직하고자 하는 경우 퇴직 예정일 14일 전까지 사직서를 제출하고, 후임자 또는 회사가 지정한 담당자가 업무를 인수인계받을 수 있도록 성실히 협조한다.')),
          listItem(text('회사는 사직원 승인, 정당한 사유 없는 통상 7일 이상 무단결근, 계속 3일 이상 무단결근, 고의 또는 중대한 과실로 인한 손실 초래 시 근로계약 해지를 검토할 수 있다.')),
          listItem(text('근무태도 또는 품행이 불량하여 개선의 여지가 부족한 경우, 회사의 기구 축소·제도 개편 등 경영상 사유가 있는 경우, 기타 취업규칙상 해지 사유가 있는 경우에도 관계법령과 취업규칙상 절차에 따른다.')),
        ),
        p(),
        pBold('제9조 (휴일 및 휴가)'),
        bulletList(
          listItem(text('주휴일, 관공서 공휴일, 연차유급휴가는 근로기준법, 기간제 및 단시간근로자 보호 등에 관한 법률, 회사 취업규칙에 따른다.')),
          listItem(text('부여된 연차유급휴가일 외의 휴무는 별도 유급 처리 합의가 없는 한 무급 휴무일로 한다.')),
          listItem(text('연차휴가 사용은 원칙적으로 최소 1주일 전 소속 부서의 장 또는 회사가 정한 승인권자에게 신청하여 승인을 받아야 한다.')),
          listItem(text('회사는 업무공백, 고객 대응, 팀 운영상 필요를 고려하여 관계법령상 허용되는 범위에서 휴가 시기를 조정할 수 있다.')),
          listItem(text('특별한 사정이 없는 경우 하계휴가는 회사와 구성원의 상호 합의에 따라 연차유급휴가일에 포함하여 사용할 수 있다.')),
          listItem(text('연차유급휴가 및 사용 촉진에 관한 그 밖의 사항은 근로기준법, 취업규칙 및 회사 규정에 따른다.')),
        ),
        p(),
        pBold('제10조 (비밀유지, 보안 및 자료반납)'),
        bulletList(
          listItem(text('구성원은 재직 중 및 계약 종료 후 회사의 기술정보, 경영상 정보, 고객정보, 상담내용, 견적, 단가, 제작도면, 거래처, 영업전략, 내부 시스템, 계정, 인사·급여정보, 미공개 프로젝트 정보를 외부에 제공하거나 사적으로 이용할 수 없다.')),
          listItem(text('비밀정보에는 무기포 접합기술, 합지판 제작기술, 회사 고유 약품·기계설비 운용정보 등 회사가 독자적으로 보유하거나 관리하는 기술 및 운영정보가 포함된다.')),
          listItem(text('고객·거래처 정보를 무단 활용, 반출, 유출하거나 동종업계 등 외부 업무에서 회사 비밀정보를 사용·공개한 경우 비밀유지의무 위반으로 보며, 회사는 관계법령에 따라 민·형사상 책임을 물을 수 있다.')),
          listItem(text('계약 종료, 업무 변경, 회사 요청 시 회사 자료, 계정, 장비, 파일, 저장매체, 사본을 즉시 반납하고 개인 기기 또는 개인 계정에 저장된 회사 자료를 삭제하여야 한다.')),
          listItem(text('회사는 반납 및 삭제 여부 확인을 위한 합리적 절차를 요구할 수 있다.')),
        ),
        p(),
        pBold('제11조 (겸업, 이해상충 및 업무충실)'),
        bulletList(
          listItem(text('구성원은 재직 중 회사의 사전 승인 없이 회사 업무와 경쟁하거나 이해상충이 발생할 수 있는 외부 근로, 용역, 자문, 사업, 고객·거래처와의 개인 거래를 하지 않는다.')),
          listItem(text('동종업계 취업 사실만으로 비밀유지의무 위반으로 보지는 않으며, 회사 비밀정보 또는 거래처 정보의 사용·유출 여부를 기준으로 판단한다.')),
        ),
        p(),
        ...damageClause(),
        pBold('제12조 (기타)'),
        bulletList(
          listItem(text('구성원은 본 계약의 포괄임금 구성, 고정연장시간, 고정연장수당 및 초과분 별도 지급 기준에 관한 설명을 듣고 동의한다.')),
          listItem(text('본 조항은 관계법령상 인정되는 구성원의 권리를 제한하거나 법정수당 청구권을 사전에 포기하게 하는 의미로 해석하지 않는다.')),
          listItem(text('본 계약에 정하지 않은 사항은 근로기준법, 최저임금법, 기간제 및 단시간근로자 보호 등에 관한 법률, 취업규칙, 회사 규정 및 관계법령에 따른다.')),
          listItem(text('회사는 본 근로계약 체결과 동시에 본 계약서 사본을 구성원에게 전자문서 또는 서면으로 교부한다.')),
        ),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'labor-part-time-hourly-2026',
    name: '2026 단시간·시급제 근로계약서',
    type: 'labor',
    content: {
      type: 'doc',
      content: [
        heading('근 로 계 약 서 (2026 단시간·시급제)', 1, 'center'),
        p(),
        ...partyClause(),
        pBold('제2조 (계약기간)'),
        p(text('계약기간은 '), ph('계약시작일'), text('부터 '), ph('계약종료일'), text('까지로 한다. 계약 종료일이 없는 경우 기간의 정함이 없는 근로계약으로 본다.')),
        p(),
        pBold('제3조 (업무 및 근무장소)'),
        p(text('담당업무는 '), ph('직위'), text(' 및 회사가 지정하는 관련 업무로 하며, 근무장소는 '), ph('회사주소'), text(' 또는 회사가 승인한 장소로 한다.')),
        ...operationControlClause(),
        pBold('제4조 (근로일, 근로시간 및 휴게시간)'),
        bulletList(
          listItem(text('근무형태는 '), ph('근무형태'), text(', 근무일은 '), ph('근무요일'), text('로 한다.')),
          listItem(text('구체적인 근무시간표는 회사가 사전에 고지한 스케줄 또는 별도 근무표에 따른다.')),
          listItem(text('회사는 업무량, 고객 예약, 생산 일정에 따라 관계법령상 허용되는 범위에서 근무일·근무시간을 조정할 수 있다.')),
          listItem(text('구성원은 확정된 스케줄을 준수하여야 한다.')),
        ),
        ...overtimeControlClause(),
        pBold('제5조 (임금 및 최저임금)'),
        bulletList(
          listItem(text('시급은 '), ph('시급'), text('원으로 하며, 2026년 최저임금 시간급 10,320원 이상으로 정한다.')),
          listItem(text('월 지급액은 실제 근로시간, 주휴수당 발생 여부, 법정수당을 기준으로 산정한다.')),
          listItem(text('관리상 월 환산 기준금액은 '), ph('월급'), text('원, 기본급 기준금액은 '), ph('기본급'), text('원으로 기록한다.')),
          listItem(text('임금은 매월 '), ph('급여일'), text('일에 지급한다.')),
          listItem(text('단시간근로자의 주휴수당, 연차유급휴가, 초과근로수당은 실제 소정근로시간과 관계법령에 따라 산정한다.')),
        ),
        p(),
        ...probationClause(),
        pBold('제7조 (근태 및 결근)'),
        bulletList(
          listItem(text('지각, 조퇴, 결근, 스케줄 변경은 회사가 정한 절차에 따라 사전 보고하여야 한다.')),
          listItem(text('무단결근 또는 반복적 스케줄 미준수는 평가 및 계약 갱신 판단에 반영될 수 있다.')),
        ),
        p(),
        pBold('제8조 (보안 및 자료반납)'),
        pText('구성원은 업무 중 알게 된 고객정보, 견적, 단가, 도면, 거래처 정보를 승인 없이 이용하거나 외부에 제공할 수 없다.'),
        p(),
        ...damageClause(),
        pBold('제10조 (기타)'),
        pText('본 계약에 정하지 않은 사항은 근로기준법, 기간제 및 단시간근로자 보호 등에 관한 법률, 취업규칙, 회사 규정 및 관계법령에 따른다.'),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'salary-annual-2026',
    name: '2026 연봉계약서',
    type: 'salary',
    content: {
      type: 'doc',
      content: [
        heading('연 봉 계 약 서 (2026)', 1, 'center'),
        p(),
        p(ph('회사명'), text(' (이하 "회사")와 '), ph('구성원이름'), text(' (이하 "구성원")은 다음과 같이 연봉계약을 체결한다.')),
        pText('본 연봉계약은 근로계약의 임금 조건을 구체화하는 문서이며, 근로시간, 휴일, 휴가, 복무 등은 별도 근로계약서와 취업규칙에 따른다.'),
        p(),
        pBold('제1조 (적용기간)'),
        p(text('연봉 적용기간은 '), ph('계약시작일'), text('부터 '), ph('계약종료일'), text('까지로 한다.')),
        p(text('근무일은 '), ph('근무요일'), text('로 하며, 구체적인 근로시간·휴게시간·휴일은 근로계약서와 취업규칙에 따른다.')),
        p(),
        pBold('제2조 (연봉 및 임금 구성)'),
        p(text('구성원의 연봉은 금 '), ph('연봉'), text('원, 월 지급액은 금 '), ph('월급'), text('원으로 한다.')),
        table(
          row(headerCell(bold('항목')), headerCell(bold('금액')), headerCell(bold('비고'))),
          row(cell(text('기본급')), cell(ph('기본급')), cell(text('통상임금 산정 기준'))),
          row(cell(text('고정연장수당')), cell(ph('고정연장수당')), cell(ph('고정연장시간'), text('시간 기준, 적용 시'))),
          row(cell(bold('월 지급액')), cell(ph('월급')), cell(text('법정 공제 전'))),
        ),
        bulletList(
          listItem(text('임금은 매월 '), ph('급여일'), text('일에 구성원 명의 계좌로 지급한다.')),
          listItem(text('소득세, 지방소득세, 4대보험료 등 법정 공제액은 원천징수한다.')),
          listItem(text('포괄임금 또는 고정연장수당을 적용하는 경우에도 고정연장시간을 초과한 초과분 별도 지급은 실제 근태기록과 회사 승인 내역을 기준으로 관계법령에 따라 처리한다.')),
          listItem(text('2026년 최저임금은 시간급 10,320원이며, 본 연봉계약은 최저임금법상 기준 이상이 되도록 운영한다.')),
        ),
        p(),
        pBold('제3조 (연봉 조정 및 평가)'),
        bulletList(
          listItem(text('연봉 조정은 회사의 경영상황, 직무가치, 개인 성과, 근태, 협업태도, 보안 및 규정 준수 여부, 시장임금 수준을 종합적으로 고려한다.')),
          listItem(text('연봉 조정은 회사가 정한 절차에 따르며, 별도 서면 또는 전자문서 합의로 확정한다.')),
        ),
        p(),
        pBold('제4조 (비밀유지 및 임금정보 관리)'),
        pText('구성원은 본인의 임금정보를 법령상 권리 행사 목적 외에 회사의 영업상 이익을 침해하는 방식으로 외부에 공개하거나 활용하지 않는다. 회사는 임금정보를 개인정보 및 인사정보로 관리한다.'),
        p(),
        pBold('제5조 (기타)'),
        pText('본 계약에 정하지 않은 사항은 근로계약서, 취업규칙, 회사 규정 및 관계법령에 따른다.'),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'oath-nda-trade-secret-2026',
    name: '2026 비밀유지·영업비밀 보호 서약서',
    type: 'oath',
    content: {
      type: 'doc',
      content: [
        heading('비 밀 유 지 및 영 업 비 밀 보 호 서 약 서', 1, 'center'),
        p(),
        p(ph('구성원이름'), text('은(는) '), ph('회사명'), text('의 구성원으로서 다음 사항을 확인하고 서약한다.')),
        p(),
        pBold('제1조 (보호대상 정보)'),
        bulletList(
          listItem(text('고객정보, 상담내용, 견적서, 제작도면, 가공·시공 방법')),
          listItem(text('단가, 마진, 거래처, 매입처, 영업전략')),
          listItem(text('내부 시스템, 계정, 인사·급여정보, 미공개 프로젝트')),
          listItem(text('그 밖에 회사가 비밀로 관리하는 모든 정보')),
        ),
        p(),
        pBold('제2조 (사용 제한)'),
        bulletList(
          listItem(text('보호대상 정보는 회사 업무 수행 목적 외에 사용하지 않는다.')),
          listItem(text('회사의 사전 서면 승인 없이 복제, 반출, 전송, 게시, 제3자 제공, 개인 저장공간 업로드를 하지 않는다.')),
        ),
        p(),
        pBold('제3조 (퇴직 후 의무)'),
        pText('본 서약은 재직 중뿐 아니라 퇴직 후에도 유효하다. 본인은 퇴직 또는 업무 종료 시 회사 자료와 사본을 즉시 반납·삭제하고, 회사의 확인 요청에 협조한다.'),
        p(),
        pBold('제4조 (위반 시 조치)'),
        bulletList(
          listItem(text('본인이 고의 또는 중대한 과실로 본 서약을 위반하여 회사에 실제 손해가 발생한 경우 회사는 법적 조치를 청구할 수 있다.')),
          listItem(text('조치 범위는 입증 가능한 손해배상, 침해금지, 자료반환 등으로 한다.')),
        ),
        p(),
        pBold('회사 확인'),
        p(ph('회사명'), text(' 대표자 '), ph('대표자명'), text('은 본 서약 내용을 설명하고 전자문서로 교부한다.')),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'oath-non-compete-conflict-2026',
    name: '2026 경업·겸업·이해상충 서약서',
    type: 'oath',
    content: {
      type: 'doc',
      content: [
        heading('경 업·겸 업 및 이 해 상 충 방 지 서 약 서', 1, 'center'),
        p(),
        p(ph('구성원이름'), text('은(는) '), ph('회사명'), text('의 영업상 이익과 고객 신뢰 보호를 위해 다음 사항을 서약한다.')),
        p(),
        pBold('제1조 (재직 중 겸업 및 이해상충)'),
        bulletList(
          listItem(text('본인은 재직 중 회사의 사전 승인 없이 회사 업무와 경쟁하는 외부 근로, 용역, 자문, 사업을 하지 않는다.')),
          listItem(text('이해상충이 발생할 수 있는 지분 참여, 고객·거래처와의 개인 거래도 사전 승인 없이 하지 않는다.')),
        ),
        p(),
        pBold('제2조 (퇴직 후 경업 제한)'),
        bulletList(
          listItem(text('퇴직 후 경업 제한은 회사의 영업비밀, 고객관계, 핵심 단가·도면·제작정보를 실질적으로 침해할 우려가 있는 업무에 한하여 적용한다.')),
          listItem(text('제한 기간은 퇴직일로부터 1년 이내로 한다.')),
          listItem(text('지역은 회사의 실제 영업권역으로 한정한다.')),
          listItem(text('업무범위는 재직 중 담당하거나 접근 권한이 있었던 업무와 실질적으로 동일·유사한 업무로 한정한다.')),
          listItem(text('본 조항은 근로자의 직업선택 자유를 과도하게 제한하지 않는 범위에서 해석한다.')),
          listItem(text('구체적 적용 여부는 직무, 접근 정보, 회사의 보호 필요성, 대가 제공 여부, 퇴직 경위 등을 종합적으로 고려한다.')),
        ),
        p(),
        pBold('제3조 (고객·거래처 유인 금지)'),
        bulletList(
          listItem(text('재직 중 취득한 고객, 거래처, 견적, 단가, 프로젝트 정보를 개인 또는 제3자의 이익을 위해 사용하지 않는다.')),
          listItem(text('회사 고객 또는 거래처를 유인하거나 거래 전환을 권유하지 않는다.')),
        ),
        p(),
        pBold('제4조 (위반 시 조치)'),
        bulletList(
          listItem(text('본 서약 위반으로 회사에 실제 손해가 발생한 경우 회사는 법적 조치를 청구할 수 있다.')),
          listItem(text('조치 범위는 입증 가능한 손해배상, 침해금지, 자료반환 등으로 한다.')),
        ),
        p(),
        pBold('회사 확인'),
        p(ph('회사명'), text(' 대표자 '), ph('대표자명'), text('은 본 서약 내용을 설명하고 전자문서로 교부한다.')),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'privacy-hr-econtract-2026',
    name: '2026 개인정보 수집·이용 및 전자계약 증적 동의서',
    type: 'privacy',
    content: {
      type: 'doc',
      content: [
        heading('개인정보 수집·이용 및 전자계약 증적 동의서', 1, 'center'),
        p(),
        p(ph('회사명'), text(' 대표자 '), ph('대표자명'), text('은(는) 인사·급여·전자계약 처리를 위해 아래와 같이 개인정보를 수집·이용한다.')),
        p(),
        table(
          row(headerCell(bold('구분')), headerCell(bold('수집 항목')), headerCell(bold('이용 목적')), headerCell(bold('보유 기간'))),
          row(cell(text('인사관리')), cell(text('성명, 생년월일, 주소, 연락처, 이메일, 부서, 직위, 경력, 자격')), cell(text('채용, 배치, 평가, 복무, 교육, 증명서 발급')), cell(text('재직 기간 및 관계법령상 보존기간'))),
          row(cell(text('급여·4대보험')), cell(text('주민등록번호 등 법령상 필요한 고유식별정보, 계좌, 급여정보')), cell(text('급여지급, 원천징수, 4대보험, 연말정산, 퇴직정산')), cell(text('관계법령상 보존기간'))),
          row(cell(text('전자계약 증적')), cell(text('전자서명 이미지, 성명 확인값, IP, 브라우저, 열람·서명·거절 시각, PDF 해시')), cell(text('계약 체결 증명, 위변조 방지, 분쟁 대응, 문서 보관')), cell(text('계약 종료 후 분쟁시효 및 법정 보존기간'))),
        ),
        p(),
        pBold('동의 및 고지'),
        bulletList(
          listItem(text('본인은 위 내용을 확인하였으며, 회사가 인사·급여·전자계약 운영에 필요한 범위에서 개인정보를 처리하는 것에 동의한다.')),
          listItem(text('법령상 의무 처리를 위한 정보 제공을 거부할 경우 근로계약 체결 또는 급여·보험 처리가 제한될 수 있다.')),
          listItem(text('회사는 개인정보를 목적 외로 이용하지 않는다.')),
          listItem(text('회사는 법령상 근거 또는 본인의 별도 동의 없이 개인정보를 제3자에게 제공하지 않는다.')),
        ),
        ...signatureBlock(),
      ],
    },
  },
  {
    id: 'oath-assets-account-return-2026',
    name: '2026 장비·계정·자료 반납 서약서',
    type: 'oath',
    content: {
      type: 'doc',
      content: [
        heading('장 비·계 정·자 료 반 납 서 약 서', 1, 'center'),
        p(),
        p(ph('구성원이름'), text('은(는) '), ph('회사명'), text('의 장비, 계정, 문서 및 전자자료를 다음 기준에 따라 관리·반납할 것을 서약한다.')),
        p(),
        pBold('제1조 (관리 대상)'),
        bulletList(
          listItem(text('노트북, 휴대전화, 저장매체, 출입카드, 법인카드')),
          listItem(text('공구, 샘플, 견적서, 제작도면, 고객 DB, 거래처 목록')),
          listItem(text('계정, 메신저, 이메일, 클라우드, 내부 시스템 접근권한')),
          listItem(text('회사가 지급하거나 접근을 허용한 모든 자료')),
        ),
        p(),
        pBold('제2조 (사용 및 보관 의무)'),
        bulletList(
          listItem(text('관리 대상은 회사 업무 목적에 한하여 사용한다.')),
          listItem(text('분실·훼손·무단반출·개인 저장공간 복제·제3자 공유를 하지 않는다.')),
          listItem(text('보안사고 또는 분실이 발생한 경우 즉시 회사에 보고한다.')),
        ),
        p(),
        pBold('제3조 (퇴직·전보·업무종료 시 반납)'),
        bulletList(
          listItem(text('퇴직, 전보, 휴직, 프로젝트 종료 또는 회사 요청 시 관리 대상을 즉시 반납한다.')),
          listItem(text('개인 기기 또는 개인 계정에 저장된 회사 자료와 사본을 삭제한다.')),
          listItem(text('회사는 반납 및 삭제 여부를 확인하기 위한 합리적 절차를 요구할 수 있다.')),
        ),
        p(),
        pBold('제4조 (계정 회수 및 접근 차단)'),
        pText('본인은 회사가 업무상 필요 또는 보안상 필요에 따라 계정 권한을 변경, 회수, 차단, 로그 확인할 수 있음을 확인한다.'),
        p(),
        pBold('제5조 (위반 시 조치)'),
        bulletList(
          listItem(text('본 서약 위반으로 회사에 실제 손해가 발생한 경우 회사는 법적 조치를 청구할 수 있다.')),
          listItem(text('회사는 고의 또는 중대한 과실과 손해 범위를 입증하여 손해배상, 자료반환, 침해금지 등을 청구한다.')),
        ),
        p(),
        pBold('회사 확인'),
        p(ph('회사명'), text(' 대표자 '), ph('대표자명'), text('은 본 서약 내용을 설명하고 전자문서로 교부한다.')),
        ...signatureBlock(),
      ],
    },
  },
];
