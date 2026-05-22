-- 견적 마법사 전체 페이지는 관리자용 보조 화면으로 제한한다.
-- 일반 직원은 햄찌 위젯 안에서 견적 마법사를 사용한다.

INSERT INTO public.page_role_access (page_key, min_role)
VALUES ('/quote-wizard', 'admin')
ON CONFLICT (page_key) DO UPDATE
SET min_role = 'admin',
    updated_at = now();
