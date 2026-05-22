import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { JSONContent } from '@tiptap/react';

export interface ContractTemplate {
  id: string;
  name: string;
  template_type: string;
  description: string | null;
  is_active: boolean;
  pay_day: number;
  content?: JSONContent | null;
  created_at?: string;
  updated_at?: string;
}

export interface EmploymentContract {
  id: string;
  template_id: string | null;
  user_id: string;
  user_name: string;
  status: string;
  contract_type: string;
  contract_date: string;
  birth_date: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  probation_period: string;
  probation_start_date: string | null;
  probation_end_date: string | null;
  probation_salary_rate: number;
  position: string | null;
  department: string | null;
  work_type: string;
  work_days: string;
  annual_salary: number | null;
  monthly_salary: number | null;
  base_pay: number | null;
  fixed_overtime_pay: number | null;
  fixed_overtime_hours: number | null;
  other_allowances: any[];
  pay_day: number;
  wage_start_date: string | null;
  wage_basis: string | null;
  comprehensive_wage_type: string | null;
  comprehensive_wage_basis: string | null;
  comprehensive_wage_hours: number | null;
  requested_by: string | null;
  requested_at: string | null;
  opened_at?: string | null;
  signed_at: string | null;
  rejected_at?: string | null;
  rejected_reason?: string | null;
  signed_by_name?: string | null;
  template_snapshot?: any | null;
  rendered_html?: string | null;
  signed_rendered_html?: string | null;
  signature_storage_path?: string | null;
  company_seal_included?: boolean;
  company_seal_storage_path?: string | null;
  signed_pdf_storage_path?: string | null;
  signed_pdf_document_file_id?: string | null;
  content_sha256?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const useContractTemplates = () => {
  const [templates, setTemplates] = useState<ContractTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('created_at')
      .then(({ data }) => {
        if (data) setTemplates(data as ContractTemplate[]);
        setLoading(false);
      });
  }, []);

  return { templates, loading };
};

export const useEmploymentContracts = () => {
  const [contracts, setContracts] = useState<EmploymentContract[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContracts = useCallback(async () => {
    const { data } = await supabase
      .from('employment_contracts')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setContracts(data as EmploymentContract[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const createContract = async (contract: Partial<EmploymentContract>) => {
    const { data, error } = await supabase.from('employment_contracts').insert(contract as any).select('*').single();
    if (error) throw error;
    await fetchContracts();
    return data as EmploymentContract;
  };

  const updateContract = async (id: string, updates: Partial<EmploymentContract>) => {
    const { error } = await supabase.from('employment_contracts').update(updates as any).eq('id', id);
    if (error) throw error;
    await fetchContracts();
  };

  const deleteContract = async (id: string) => {
    const { error } = await supabase.from('employment_contracts').delete().eq('id', id);
    if (error) throw error;
    await fetchContracts();
  };

  const bulkCreate = async (contracts: Partial<EmploymentContract>[]) => {
    const { data, error } = await supabase.from('employment_contracts').insert(contracts as any[]).select('*');
    if (error) throw error;
    await fetchContracts();
    return (data || []) as EmploymentContract[];
  };

  return { contracts, loading, createContract, updateContract, deleteContract, bulkCreate, refresh: fetchContracts };
};
