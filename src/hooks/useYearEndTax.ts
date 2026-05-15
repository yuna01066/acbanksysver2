import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { gcsUploadFile } from '@/hooks/useGcsStorage';
import { toast } from 'sonner';

export interface TaxSettlement {
  id: string;
  user_id: string;
  user_name: string;
  tax_year: number;
  total_salary: number;
  total_tax_paid: number;
  total_local_tax_paid: number;
  estimated_tax: number;
  estimated_refund: number;
  final_tax: number;
  final_refund: number;
  installment_enabled: boolean;
  installment_months: number;
  status: string;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxDependent {
  id: string;
  settlement_id: string;
  user_id: string;
  name: string;
  relationship: string;
  resident_number: string | null;
  birth_date: string | null;
  is_disabled: boolean;
  disability_type: string | null;
  is_senior: boolean;
  is_child_under6: boolean;
  is_single_parent: boolean;
  is_woman_deduction: boolean;
  has_income_limit: boolean;
  basic_deduction: boolean;
  created_at: string;
  updated_at: string;
}

export interface TaxDeductionItem {
  id: string;
  settlement_id: string;
  user_id: string;
  category: string;
  sub_category: string;
  description: string | null;
  amount: number;
  dependent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxDocument {
  id: string;
  settlement_id: string;
  user_id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  memo: string | null;
  uploaded_at: string;
}

export const TAX_YEAR = new Date().getFullYear() - 1;

export const DEDUCTION_CATEGORIES = {
  insurance: {
    label: '보험료',
    items: [
      { key: 'health_insurance', label: '건강보험료' },
      { key: 'employment_insurance', label: '고용보험료' },
      { key: 'protection_insurance', label: '보장성보험료' },
      { key: 'disabled_insurance', label: '장애인전용보험료' },
    ],
  },
  medical: {
    label: '의료비',
    items: [
      { key: 'general', label: '일반 의료비' },
      { key: 'infertility', label: '난임시술비' },
      { key: 'premature', label: '미숙아/선천성이상아' },
      { key: 'disabled', label: '장애인 의료비' },
      { key: 'senior', label: '65세 이상 의료비' },
      { key: 'self', label: '본인 의료비' },
    ],
  },
  education: {
    label: '교육비',
    items: [
      { key: 'self', label: '본인 교육비' },
      { key: 'preschool', label: '취학 전 아동' },
      { key: 'elementary_middle_high', label: '초·중·고등학교' },
      { key: 'university', label: '대학교' },
      { key: 'disabled_special', label: '장애인 특수교육비' },
      { key: 'student_loan', label: '학자금 대출 상환' },
    ],
  },
  housing: {
    label: '주택자금',
    items: [
      { key: 'housing_subscription', label: '주택청약종합저축' },
      { key: 'housing_rent_loan', label: '주택임차차입금 원리금' },
      { key: 'long_term_mortgage', label: '장기주택저당차입금 이자' },
    ],
  },
  donation: {
    label: '기부금',
    items: [
      { key: 'legal', label: '법정기부금' },
      { key: 'political', label: '정치자금기부금' },
      { key: 'religious', label: '종교단체기부금' },
      { key: 'designated', label: '지정기부금' },
    ],
  },
  credit_card: {
    label: '신용카드 등',
    items: [
      { key: 'credit_card', label: '신용카드' },
      { key: 'debit_card', label: '체크카드/직불카드' },
      { key: 'cash_receipt', label: '현금영수증' },
      { key: 'books_performance', label: '도서·공연·영화' },
      { key: 'traditional_market', label: '전통시장' },
      { key: 'public_transport', label: '대중교통' },
    ],
  },
  pension: {
    label: '연금',
    items: [
      { key: 'national_pension', label: '국민연금' },
      { key: 'personal_pension', label: '개인연금저축' },
      { key: 'pension_account', label: '연금계좌(IRP 등)' },
    ],
  },
  other: {
    label: '기타',
    items: [
      { key: 'monthly_rent', label: '월세액' },
      { key: 'small_business', label: '소기업·소상공인 공제부금' },
      { key: 'investment_partnership', label: '투자조합출자' },
    ],
  },
};

export const DOCUMENT_TYPES = [
  { key: 'hometax_pdf', label: '국세청 간소화 PDF' },
  { key: 'medical_receipt', label: '의료비 영수증' },
  { key: 'education_receipt', label: '교육비 납입증명서' },
  { key: 'donation_receipt', label: '기부금 영수증' },
  { key: 'housing_doc', label: '주택 관련 서류' },
  { key: 'disability_doc', label: '장애인증명서' },
  { key: 'other', label: '기타 증빙서류' },
];

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  not_started: { label: '미시작', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: '작성 중', color: 'bg-blue-100 text-blue-700' },
  submitted: { label: '제출 완료', color: 'bg-indigo-100 text-indigo-700' },
  review: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700' },
  revision_requested: { label: '수정 요청', color: 'bg-orange-100 text-orange-700' },
  confirmed: { label: '확정', color: 'bg-green-100 text-green-700' },
  finalized: { label: '최종 완료', color: 'bg-emerald-100 text-emerald-700' },
};

export function useYearEndTax(taxYear: number = TAX_YEAR) {
  const { user, profile } = useAuth();
  const [settlement, setSettlement] = useState<TaxSettlement | null>(null);
  const [dependents, setDependents] = useState<TaxDependent[]>([]);
  const [deductionItems, setDeductionItems] = useState<TaxDeductionItem[]>([]);
  const [documents, setDocuments] = useState<TaxDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSettlement = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('year_end_tax_settlements')
      .select('*')
      .eq('user_id', user.id)
      .eq('tax_year', taxYear)
      .maybeSingle();
    setSettlement(data as TaxSettlement | null);
    return data;
  };

  const initSettlement = async () => {
    if (!user || !profile) return null;
    const { data, error } = await supabase
      .from('year_end_tax_settlements')
      .insert({
        user_id: user.id,
        user_name: profile.full_name,
        tax_year: taxYear,
        status: 'in_progress',
      })
      .select()
      .single();
    if (error) {
      toast.error('연말정산을 시작할 수 없습니다.');
      return null;
    }
    setSettlement(data as TaxSettlement);
    return data as TaxSettlement;
  };

  const updateSettlement = async (updates: Partial<TaxSettlement>) => {
    if (!settlement) return;
    const { error } = await supabase
      .from('year_end_tax_settlements')
      .update(updates)
      .eq('id', settlement.id);
    if (error) {
      toast.error('저장에 실패했습니다.');
      return;
    }
    await fetchSettlement();
  };

  const fetchDependents = async (settlementId: string) => {
    const { data } = await supabase
      .from('tax_dependents')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('created_at');
    setDependents((data as TaxDependent[]) || []);
  };

  const addDependent = async (dep: Omit<TaxDependent, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('tax_dependents').insert(dep);
    if (error) {
      toast.error('부양가족 추가 실패');
      return;
    }
    toast.success('부양가족이 추가되었습니다.');
    if (settlement) await fetchDependents(settlement.id);
  };

  const updateDependent = async (id: string, updates: Partial<TaxDependent>) => {
    const { error } = await supabase.from('tax_dependents').update(updates).eq('id', id);
    if (error) {
      toast.error('수정 실패');
      return;
    }
    if (settlement) await fetchDependents(settlement.id);
  };

  const deleteDependent = async (id: string) => {
    const { error } = await supabase.from('tax_dependents').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
      return;
    }
    toast.success('삭제되었습니다.');
    if (settlement) await fetchDependents(settlement.id);
  };

  const fetchDeductionItems = async (settlementId: string) => {
    const { data } = await supabase
      .from('tax_deduction_items')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('category, sub_category');
    setDeductionItems((data as TaxDeductionItem[]) || []);
  };

  const addDeductionItem = async (item: Omit<TaxDeductionItem, 'id' | 'created_at' | 'updated_at'>) => {
    const { error } = await supabase.from('tax_deduction_items').insert(item);
    if (error) {
      toast.error('공제항목 추가 실패');
      return;
    }
    if (settlement) await fetchDeductionItems(settlement.id);
  };

  const updateDeductionItem = async (id: string, updates: Partial<TaxDeductionItem>) => {
    const { error } = await supabase.from('tax_deduction_items').update(updates).eq('id', id);
    if (error) {
      toast.error('수정 실패');
      return;
    }
    if (settlement) await fetchDeductionItems(settlement.id);
  };

  const deleteDeductionItem = async (id: string) => {
    const { error } = await supabase.from('tax_deduction_items').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
      return;
    }
    if (settlement) await fetchDeductionItems(settlement.id);
  };

  const fetchDocuments = async (settlementId: string) => {
    const { data } = await supabase
      .from('tax_documents')
      .select('*')
      .eq('settlement_id', settlementId)
      .order('uploaded_at', { ascending: false });
    setDocuments((data as TaxDocument[]) || []);
  };

  const uploadDocument = async (
    file: File,
    documentType: string,
    memo?: string,
  ) => {
    if (!user || !settlement) return;
    try {
      const prefix = `tax-documents/${user.id}/${settlement.id}`;
      const { gcsPath } = await gcsUploadFile(file, prefix);

      const { error } = await supabase.from('tax_documents').insert({
        settlement_id: settlement.id,
        user_id: user.id,
        document_type: documentType,
        file_name: file.name,
        file_url: gcsPath,
        file_size: file.size,
        mime_type: file.type,
        memo,
      });
      if (error) {
        toast.error('서류 등록 실패');
        return;
      }
      toast.success('서류가 업로드되었습니다.');
      await fetchDocuments(settlement.id);
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('파일 업로드 실패');
    }
  };

  const deleteDocument = async (id: string) => {
    const { error } = await supabase.from('tax_documents').delete().eq('id', id);
    if (error) {
      toast.error('삭제 실패');
      return;
    }
    toast.success('삭제되었습니다.');
    if (settlement) await fetchDocuments(settlement.id);
  };

  const submitSettlement = async () => {
    if (!settlement) return;
    await updateSettlement({ status: 'submitted', submitted_at: new Date().toISOString() } as any);
    toast.success('연말정산 자료가 제출되었습니다.');
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const s = await fetchSettlement();
      if (s) {
        await Promise.all([
          fetchDependents(s.id),
          fetchDeductionItems(s.id),
          fetchDocuments(s.id),
        ]);
      }
      setLoading(false);
    };
    if (user) load();
  }, [user, taxYear]);

  return {
    settlement,
    dependents,
    deductionItems,
    documents,
    loading,
    initSettlement,
    updateSettlement,
    addDependent,
    updateDependent,
    deleteDependent,
    addDeductionItem,
    updateDeductionItem,
    deleteDeductionItem,
    uploadDocument,
    deleteDocument,
    submitSettlement,
    fetchSettlement,
    fetchDependents,
    fetchDeductionItems,
    fetchDocuments,
  };
}
