-- Ensure the company master account also resolves through role-based admin checks.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE lower(u.email) = 'acbank@acbank.co.kr'
ON CONFLICT (user_id, role) DO NOTHING;
