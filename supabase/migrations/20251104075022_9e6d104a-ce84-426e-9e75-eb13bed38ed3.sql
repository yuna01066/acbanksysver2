-- slot_types 테이블에 다중 선택 관련 필드 추가
ALTER TABLE slot_types
ADD COLUMN IF NOT EXISTS allow_multiple_selection boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS show_quantity_control boolean DEFAULT false;

COMMENT ON COLUMN slot_types.allow_multiple_selection IS '이 슬롯에서 여러 옵션을 동시에 선택할 수 있는지 여부';
COMMENT ON COLUMN slot_types.show_quantity_control IS '이 슬롯의 옵션들에 수량 조절 UI를 표시할지 여부';

-- 기존 slot7 이상의 슬롯들에 대해 다중 선택 활성화
UPDATE slot_types
SET allow_multiple_selection = true, show_quantity_control = true
WHERE slot_key ~ '^slot([7-9]|[1-9]\d+)$' OR slot_key IN ('additional', 'advanced_pricing');