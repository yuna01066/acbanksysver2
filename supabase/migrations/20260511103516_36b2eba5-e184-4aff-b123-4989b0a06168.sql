DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
CREATE POLICY "Admins can manage all roles"
ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.saved_quotes
  ADD CONSTRAINT saved_quotes_recipient_name_len CHECK (recipient_name IS NULL OR char_length(recipient_name) <= 100),
  ADD CONSTRAINT saved_quotes_recipient_company_len CHECK (recipient_company IS NULL OR char_length(recipient_company) <= 150),
  ADD CONSTRAINT saved_quotes_recipient_phone_len CHECK (recipient_phone IS NULL OR char_length(recipient_phone) <= 30),
  ADD CONSTRAINT saved_quotes_recipient_email_len CHECK (recipient_email IS NULL OR char_length(recipient_email) <= 255),
  ADD CONSTRAINT saved_quotes_recipient_address_len CHECK (recipient_address IS NULL OR char_length(recipient_address) <= 500),
  ADD CONSTRAINT saved_quotes_recipient_memo_len CHECK (recipient_memo IS NULL OR char_length(recipient_memo) <= 2000),
  ADD CONSTRAINT saved_quotes_issuer_name_len CHECK (issuer_name IS NULL OR char_length(issuer_name) <= 100),
  ADD CONSTRAINT saved_quotes_issuer_email_len CHECK (issuer_email IS NULL OR char_length(issuer_email) <= 255),
  ADD CONSTRAINT saved_quotes_issuer_phone_len CHECK (issuer_phone IS NULL OR char_length(issuer_phone) <= 30),
  ADD CONSTRAINT saved_quotes_issuer_department_len CHECK (issuer_department IS NULL OR char_length(issuer_department) <= 100),
  ADD CONSTRAINT saved_quotes_issuer_position_len CHECK (issuer_position IS NULL OR char_length(issuer_position) <= 100);