import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PluuugApiResult<T = any> {
  data?: T;
  error?: string;
  status: number;
}

export interface PluuugClient {
  id: number;
  status: {
    id: number;
    title: string;
  };
  companyName: string;
  inCharge: string;
  position?: string;
  contact?: string;
  email?: string;
  content?: string;
  createdAt?: string;
  updatedAt?: string;
  // 상세 정보 필드
  ceoName?: string;
  businessRegistrationNumber?: string;
  companyAddress?: string;
  companyDetailAddress?: string;
  businessType?: string;
  businessClass?: string;
  branchNumber?: string;
  fieldSet?: { field: { id: number }; value: string }[];
}

export interface PluuugEstimate {
  id: number;
  title: string;
  status?: {
    id: number;
    title: string;
  };
  client?: PluuugClient;
  totalAmount?: number;
  items?: any[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PluuugContract {
  id: number;
  title: string;
  client?: PluuugClient;
  category?: {
    id: number;
    title: string;
  };
  amount?: number;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PluuugSettlement {
  id: number;
  title: string;
  type?: {
    id: number;
    title: string;
  };
  amount?: number;
  settledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PluuugEstimateItemClassification {
  id: number;
  title: string;
}

export interface PluuugEstimateItem {
  id: number;
  title: string;
  description?: string;
  unit: string;
  unitCost: string;
  image?: string;
  classification: PluuugEstimateItemClassification;
}

export function usePluuugApi() {
  const [loading, setLoading] = useState(false);

  const callApi = useCallback(async <T = any>(
    action: string,
    params: Record<string, any> = {}
  ): Promise<PluuugApiResult<T>> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pluuug-api', {
        body: { action, ...params }
      });

      if (error) {
        console.error('[Pluuug API] Invoke error:', error);
        toast.error(`Pluuug API 오류: ${error.message}`);
        return { error: error.message, status: 500 };
      }

      if (data?.error) {
        console.error('[Pluuug API] API error:', data.error);
        toast.error(`Pluuug API 오류: ${data.error}`);
        return data;
      }

      return data;
    } catch (err: any) {
      console.error('[Pluuug API] Error:', err);
      toast.error(`Pluuug API 오류: ${err.message}`);
      return { error: err.message, status: 500 };
    } finally {
      setLoading(false);
    }
  }, []);

  // ==================== 고객 (Client) ====================
  const getClients = useCallback(() => callApi<PluuugClient[]>('client.list'), [callApi]);
  const getClientStatuses = useCallback(() => callApi('client.status.list'), [callApi]);
  const getClient = useCallback((id: number) => callApi<PluuugClient>('client.get', { id }), [callApi]);
  const createClient = useCallback((data: Partial<PluuugClient>) => callApi<PluuugClient>('client.create', { data }), [callApi]);
  const updateClient = useCallback((id: number, data: Partial<PluuugClient>) => callApi<PluuugClient>('client.update', { id, data }), [callApi]);
  const deleteClient = useCallback((id: number) => callApi('client.delete', { id }), [callApi]);

  // ==================== 견적서 (Estimate) ====================
  const getEstimates = useCallback(() => callApi<PluuugEstimate[]>('estimate.list'), [callApi]);
  const getEstimateStatuses = useCallback(() => callApi('estimate.status.list'), [callApi]);
  const getEstimate = useCallback((id: number) => callApi<PluuugEstimate>('estimate.get', { id }), [callApi]);
  const createEstimate = useCallback((data: any) => callApi<PluuugEstimate>('estimate.create', { data }), [callApi]);
  const updateEstimate = useCallback((id: number, data: any) => callApi<PluuugEstimate>('estimate.update', { id, data }), [callApi]);
  const deleteEstimate = useCallback((id: number) => callApi('estimate.delete', { id }), [callApi]);
  
  // ==================== 견적서 항목 템플릿 (Estimate Item) ====================
  const getEstimateItems = useCallback(() => callApi<{ count: number; next: string | null; previous: string | null; results: any[] }>('estimate.item.list'), [callApi]);
  const getEstimateItemClassifications = useCallback(() => callApi<{ count: number; results: any[] }>('estimate.item.classification.list'), [callApi]);
  const getEstimateItem = useCallback((id: number) => callApi('estimate.item.get', { id }), [callApi]);
  const createEstimateItem = useCallback((data: any) => callApi('estimate.item.create', { data }), [callApi]);
  const updateEstimateItem = useCallback((id: number, data: any) => callApi('estimate.item.update', { id, data }), [callApi]);
  const deleteEstimateItem = useCallback((id: number) => callApi('estimate.item.delete', { id }), [callApi]);

  // ==================== 계약 (Contract) ====================
  const getContracts = useCallback(() => callApi<PluuugContract[]>('contract.list'), [callApi]);
  const getContractCategories = useCallback(() => callApi('contract.category.list'), [callApi]);
  const getContract = useCallback((id: number) => callApi<PluuugContract>('contract.get', { id }), [callApi]);
  const createContract = useCallback((data: any) => callApi<PluuugContract>('contract.create', { data }), [callApi]);
  const updateContract = useCallback((id: number, data: any) => callApi<PluuugContract>('contract.update', { id, data }), [callApi]);
  const deleteContract = useCallback((id: number) => callApi('contract.delete', { id }), [callApi]);

  // ==================== 정산 (Settlement) ====================
  const getSettlements = useCallback(() => callApi<PluuugSettlement[]>('settlement.list'), [callApi]);
  const getSettlementTypes = useCallback(() => callApi('settlement.type.list'), [callApi]);
  const getSettlement = useCallback((id: number) => callApi<PluuugSettlement>('settlement.get', { id }), [callApi]);
  const createSettlement = useCallback((data: any) => callApi<PluuugSettlement>('settlement.create', { data }), [callApi]);
  const updateSettlement = useCallback((id: number, data: any) => callApi<PluuugSettlement>('settlement.update', { id, data }), [callApi]);
  const deleteSettlement = useCallback((id: number) => callApi('settlement.delete', { id }), [callApi]);

  // ==================== 의뢰 파일 (Inquiry File) ====================
  const getInquiryFiles = useCallback((id: number) => callApi('inquiry.file.list', { id }), [callApi]);
  const uploadInquiryFile = useCallback((inquiryId: number, fileName: string, fileContent: string, mimeType: string) => 
    callApi('inquiry.file.upload', { inquiryId, fileName, fileContent, mimeType }), [callApi]);
  const deleteInquiryFile = useCallback((inquiryId: number, fileId: number) => 
    callApi('inquiry.file.delete', { inquiryId, fileId }), [callApi]);

  return {
    loading,
    callApi,
    // 고객
    getClients,
    getClientStatuses,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    // 견적서
    getEstimates,
    getEstimateStatuses,
    getEstimate,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    // 견적서 항목 템플릿
    getEstimateItems,
    getEstimateItemClassifications,
    getEstimateItem,
    createEstimateItem,
    updateEstimateItem,
    deleteEstimateItem,
    // 계약
    getContracts,
    getContractCategories,
    getContract,
    createContract,
    updateContract,
    deleteContract,
    // 정산
    getSettlements,
    getSettlementTypes,
    getSettlement,
    createSettlement,
    updateSettlement,
    deleteSettlement,
    // 의뢰 파일
    getInquiryFiles,
    uploadInquiryFile,
    deleteInquiryFile,
  };
}
