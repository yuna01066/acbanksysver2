import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface Recipient {
  id: string;
  user_id: string;
  company_name: string;
  business_name: string | null;
  contact_person: string;
  position: string;
  phone: string;
  email: string;
  address: string | null;
  detail_address: string | null;
  ceo_name: string;
  business_registration_number: string;
  business_type: string;
  business_class: string;
  branch_number: string;
  accounting_contact_person: string | null;
  accounting_position: string | null;
  accounting_phone: string | null;
  accounting_email: string | null;
  memo: string | null;
  business_document_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecipientInput {
  company_name: string;
  business_name?: string;
  contact_person: string;
  position?: string;
  phone: string;
  email: string;
  address?: string;
  detail_address?: string;
  ceo_name?: string;
  business_registration_number?: string;
  business_type?: string;
  business_class?: string;
  branch_number?: string;
  accounting_contact_person?: string;
  accounting_position?: string;
  accounting_phone?: string;
  accounting_email?: string;
  memo?: string;
  business_document_url?: string;
}

export function useRecipients() {
  const { user } = useAuth();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecipients = useCallback(async () => {
    if (!user) return [];

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('recipients')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('담당자 조회 에러:', error);
        return [];
      }

      setRecipients(data || []);
      return data || [];
    } catch (err) {
      console.error('담당자 조회 에러:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getRecipient = useCallback(async (id: string): Promise<Recipient | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('담당자 조회 에러:', error);
      return null;
    }

    return data;
  }, [user]);

  const findRecipient = useCallback(async (
    companyName: string,
    contactPerson: string
  ): Promise<Recipient | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('recipients')
      .select('*')
      .eq('user_id', user.id)
      .eq('company_name', companyName)
      .eq('contact_person', contactPerson)
      .maybeSingle();

    if (error) {
      console.error('담당자 조회 에러:', error);
      return null;
    }

    return data;
  }, [user]);

  const createRecipient = useCallback(async (input: RecipientInput): Promise<Recipient | null> => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('recipients')
        .insert({
          user_id: user.id,
          company_name: input.company_name,
          business_name: input.business_name || null,
          contact_person: input.contact_person,
          position: input.position || '담당자',
          phone: input.phone,
          email: input.email,
          address: input.address || null,
          detail_address: input.detail_address || null,
          ceo_name: input.ceo_name || input.contact_person || '대표자',
          business_registration_number: input.business_registration_number || '000-00-00000',
          business_type: input.business_type || '서비스업',
          business_class: input.business_class || '기타',
          branch_number: input.branch_number || '00',
          accounting_contact_person: input.accounting_contact_person || null,
          accounting_position: input.accounting_position || null,
          accounting_phone: input.accounting_phone || null,
          accounting_email: input.accounting_email || null,
          memo: input.memo || null,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return await findRecipient(input.company_name, input.contact_person);
        }
        console.error('담당자 생성 에러:', error);
        toast.error('담당자 생성에 실패했습니다.');
        return null;
      }

      return data;
    } catch (err) {
      console.error('담당자 생성 에러:', err);
      toast.error('담당자 생성에 실패했습니다.');
      return null;
    }
  }, [user, findRecipient]);

  const updateRecipient = useCallback(async (
    id: string,
    updates: Partial<RecipientInput>
  ): Promise<Recipient | null> => {
    if (!user) return null;

    const { data, error } = await supabase
      .from('recipients')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) {
      console.error('담당자 수정 에러:', error);
      toast.error('담당자 수정에 실패했습니다.');
      return null;
    }

    return data;
  }, [user]);

  const deleteRecipient = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('recipients')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('담당자 삭제 에러:', error);
      toast.error('담당자 삭제에 실패했습니다.');
      return false;
    }

    toast.success('담당자가 삭제되었습니다.');
    return true;
  }, [user]);

  const migrateFromSavedQuotes = useCallback(async (): Promise<number> => {
    if (!user) return 0;

    setLoading(true);
    try {
      const { data: quotes, error: quotesError } = await supabase
        .from('saved_quotes')
        .select('recipient_company, recipient_name, recipient_phone, recipient_email, recipient_address')
        .eq('user_id', user.id)
        .not('recipient_company', 'is', null)
        .not('recipient_name', 'is', null);

      if (quotesError || !quotes) {
        console.error('견적서 조회 에러:', quotesError);
        return 0;
      }

      const uniqueMap = new Map<string, RecipientInput>();
      quotes.forEach((q) => {
        const key = `${q.recipient_company}-${q.recipient_name}`;
        if (!uniqueMap.has(key) && q.recipient_company && q.recipient_name) {
          uniqueMap.set(key, {
            company_name: q.recipient_company,
            contact_person: q.recipient_name,
            phone: q.recipient_phone || '010-0000-0000',
            email: q.recipient_email || `${q.recipient_company.replace(/\s/g, '').toLowerCase()}@example.com`,
            address: q.recipient_address || undefined,
          });
        }
      });

      let migratedCount = 0;
      for (const input of uniqueMap.values()) {
        const existing = await findRecipient(input.company_name, input.contact_person);
        if (!existing) {
          const created = await createRecipient(input);
          if (created) migratedCount++;
        }
      }

      if (migratedCount > 0) {
        await fetchRecipients();
      }

      return migratedCount;
    } finally {
      setLoading(false);
    }
  }, [user, findRecipient, createRecipient, fetchRecipients]);

  return {
    recipients,
    loading,
    fetchRecipients,
    getRecipient,
    findRecipient,
    createRecipient,
    updateRecipient,
    deleteRecipient,
    migrateFromSavedQuotes,
  };
}
