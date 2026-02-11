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
  pluuug_client_id: number | null;
  pluuug_synced_at: string | null;
  memo: string | null;
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
}

export interface PluuugClientData {
  companyName: string;
  inCharge: string;
  contact: string;
  email: string;
  position: string;
  content: string;
  status: { id: number };
  ceoName: string;
  businessRegistrationNumber: string;
  companyAddress: string;
  companyDetailAddress: string;
  businessType: string;
  businessClass: string;
  branchNumber: string;
  fieldSet: { field: { id: number }; value: string }[];
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
          // Unique constraint violation - recipient already exists
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

  const markAsSyncedToPluuug = useCallback(async (
    id: string,
    pluuugClientId: number
  ): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('recipients')
      .update({
        pluuug_client_id: pluuugClientId,
        pluuug_synced_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Pluuug 동기화 상태 업데이트 에러:', error);
      return false;
    }

    return true;
  }, [user]);

  // Convert recipient to Pluuug client data format
  const toPluuugClientData = useCallback((
    recipient: Recipient,
    statusId: number
  ): PluuugClientData => {
    const email = recipient.email && recipient.email.includes('@')
      ? recipient.email
      : `${recipient.company_name.replace(/\s/g, '').toLowerCase()}@example.com`;

    return {
      companyName: recipient.company_name || '미지정',
      inCharge: recipient.contact_person || '담당자',
      contact: recipient.phone || '010-0000-0000',
      email,
      position: recipient.position || '담당자',
      content: recipient.memo || (recipient.address ? `주소: ${recipient.address}` : '정보 없음'),
      status: { id: statusId },
      ceoName: recipient.ceo_name || recipient.contact_person || '대표자',
      businessRegistrationNumber: recipient.business_registration_number || '000-00-00000',
      companyAddress: recipient.address || '미지정',
      companyDetailAddress: recipient.detail_address || '미지정',
      businessType: recipient.business_type || '서비스업',
      businessClass: recipient.business_class || '기타',
      branchNumber: recipient.branch_number || '00',
      fieldSet: [{ field: { id: 1 }, value: '기본값' }],
    };
  }, []);

  // Migrate existing recipients from saved_quotes
  const migrateFromSavedQuotes = useCallback(async (): Promise<number> => {
    if (!user) return 0;

    setLoading(true);
    try {
      // Fetch unique recipients from saved_quotes
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

      // Deduplicate
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

  // Clear Pluuug sync status for a recipient (when client was deleted from Pluuug)
  const clearPluuugSyncStatus = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    const { error } = await supabase
      .from('recipients')
      .update({
        pluuug_client_id: null,
        pluuug_synced_at: null,
      })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('Pluuug 동기화 상태 초기화 에러:', error);
      return false;
    }

    return true;
  }, [user]);

  // Get all synced recipients (those with pluuug_client_id)
  const getSyncedRecipients = useCallback((): Recipient[] => {
    return recipients.filter(r => r.pluuug_client_id !== null);
  }, [recipients]);

  return {
    recipients,
    loading,
    fetchRecipients,
    getRecipient,
    findRecipient,
    createRecipient,
    updateRecipient,
    deleteRecipient,
    markAsSyncedToPluuug,
    clearPluuugSyncStatus,
    getSyncedRecipients,
    toPluuugClientData,
    migrateFromSavedQuotes,
  };
}
