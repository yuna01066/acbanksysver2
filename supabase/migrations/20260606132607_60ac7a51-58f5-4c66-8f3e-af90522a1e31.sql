REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved_user(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO service_role;