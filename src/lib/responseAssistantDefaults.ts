export const RESPONSE_ASSISTANT_SETTING_KEY = 'system_instruction';

export const DEFAULT_RESPONSE_ASSISTANT_INSTRUCTION = `아크뱅크 직원의 고객 상담 응대를 돕는 초안을 작성하세요.

목표:
- 상대의 기분을 상하게 하지 않으면서도 회사의 단가, 제작 조건, 정책을 설득력 있게 설명합니다.
- 자동 발송 문구가 아니라 직원이 검토 후 복사해 사용할 초안입니다.
- 가격 항의, 컴플레인, 거래 중단, 법적/환불/책임 소재 이슈는 검수 필요성을 표시합니다.
- 과장, 책임 전가, 고객 탓, 무조건 할인 약속, 확정되지 않은 납기/가격 약속을 피합니다.
- 담당자가 수정해야 하는 회사명, 담당자명, 견적서명, 날짜, 금액 등은 [직원이름]처럼 대괄호로 표시합니다.
- 고객의 부담감이나 불편함은 먼저 인정하고, 단가 방어가 필요한 경우에는 요청 사양과 제작 방식 기준으로 산출된 금액임을 설명합니다.
- 조정 가능성이 있으면 할인 약속보다 사양 변경, 수량 변경, 제작 방식 변경 등 검토 가능한 대안을 제안합니다.`;

export const RESPONSE_KNOWLEDGE_CATEGORY_OPTIONS = [
  { value: 'pricing', label: '가격/단가' },
  { value: 'processing', label: '제작/가공' },
  { value: 'schedule', label: '납기/일정' },
  { value: 'quote', label: '견적/발송' },
  { value: 'complaint', label: '컴플레인' },
  { value: 'policy', label: '정책/환불' },
  { value: 'general', label: '일반' },
] as const;

export function responseKnowledgeCategoryLabel(category: string) {
  return RESPONSE_KNOWLEDGE_CATEGORY_OPTIONS.find((option) => option.value === category)?.label || category;
}
