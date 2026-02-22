-- Add quote default text fields to company_info table
ALTER TABLE public.company_info
  ADD COLUMN IF NOT EXISTS quote_bank_info text DEFAULT '신한은행 140-014-544315 (주)아크뱅크',
  ADD COLUMN IF NOT EXISTS quote_notes text DEFAULT '- 견적서의 유효기간은 발행일로부터 14일 입니다.\n- 운송비 및 부가세는 별도 입니다.',
  ADD COLUMN IF NOT EXISTS quote_consultation text DEFAULT '안녕하세요\n견적 문의해 주셔서 감사합니다.\n상세한 제작 요구사항이 있으시면 담당자에게 연락 부탁드립니다.',
  ADD COLUMN IF NOT EXISTS quote_contact_phone text DEFAULT '070-7537-3680',
  ADD COLUMN IF NOT EXISTS quote_contact_email text DEFAULT 'acbank@acbank.co.kr',
  ADD COLUMN IF NOT EXISTS quote_contact_message text DEFAULT '견적 관련 문의사항이나 주문을 원하시면 아래 연락처로 문의해주세요.';
