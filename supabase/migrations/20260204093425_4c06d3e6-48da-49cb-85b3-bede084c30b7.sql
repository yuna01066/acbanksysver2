-- Create recipients table for unified recipient management
-- This table stores all recipient/client information in one place
-- with fields that map directly to Pluuug API requirements

CREATE TABLE public.recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Basic company info
  company_name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  position TEXT DEFAULT '담당자',
  
  -- Contact info
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  
  -- Address info
  address TEXT,
  detail_address TEXT,
  
  -- Pluuug required fields
  ceo_name TEXT DEFAULT '대표자',
  business_registration_number TEXT DEFAULT '000-00-00000',
  business_type TEXT DEFAULT '서비스업',
  business_class TEXT DEFAULT '기타',
  branch_number TEXT DEFAULT '00',
  
  -- Pluuug sync status
  pluuug_client_id INTEGER,
  pluuug_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Notes/memo
  memo TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Unique constraint per user (company + contact person)
  CONSTRAINT unique_recipient_per_user UNIQUE (user_id, company_name, contact_person)
);

-- Enable RLS
ALTER TABLE public.recipients ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own recipients"
  ON public.recipients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own recipients"
  ON public.recipients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own recipients"
  ON public.recipients FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own recipients"
  ON public.recipients FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_recipients_updated_at
  BEFORE UPDATE ON public.recipients
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();