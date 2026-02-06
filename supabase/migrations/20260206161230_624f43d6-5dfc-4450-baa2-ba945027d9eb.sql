
-- 1. profiles 테이블에 is_approved 컬럼 추가
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- 2. 기존 사용자들은 모두 승인 상태로 설정
UPDATE public.profiles SET is_approved = true;

-- 3. 기존 'user' 역할을 'employee'로 마이그레이션
UPDATE public.user_roles SET role = 'employee' WHERE role = 'user';

-- 4. handle_new_user 함수 업데이트: 새 가입자는 is_approved=false, role=employee
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_approved)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    false
  );
  
  -- Assign default 'employee' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'employee');
  
  RETURN NEW;
END;
$function$;
