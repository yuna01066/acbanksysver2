import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type SettingsRiskLevel = 'low' | 'medium' | 'high';
export type SettingsRequestStatus = 'pending' | 'approved' | 'rejected' | 'applied' | 'cancelled';
export type SettingsRequestAction = 'upsert' | 'update' | 'delete';

export interface SettingsChangeRequestInput {
  targetArea?: 'admin' | 'company';
  targetTable: string;
  targetKey: string;
  action?: SettingsRequestAction;
  riskLevel?: SettingsRiskLevel;
  changeSummary: string;
  beforeValue?: Json | null;
  afterValue?: Json | null;
}

export interface SettingsChangeRequestRecord {
  id: string;
  requested_by: string;
  requested_by_name: string | null;
  target_area: string;
  target_table: string;
  target_key: string;
  action: SettingsRequestAction;
  risk_level: SettingsRiskLevel;
  status: SettingsRequestStatus;
  change_summary: string;
  before_value: Json | null;
  after_value: Json | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function createSettingsChangeRequest({
  targetArea = 'admin',
  targetTable,
  targetKey,
  action = 'upsert',
  riskLevel = 'high',
  changeSummary,
  beforeValue = null,
  afterValue = null,
}: SettingsChangeRequestInput) {
  const { error } = await (supabase as any)
    .from('settings_change_requests')
    .insert({
      target_area: targetArea,
      target_table: targetTable,
      target_key: targetKey,
      action,
      risk_level: riskLevel,
      change_summary: changeSummary,
      before_value: beforeValue,
      after_value: afterValue,
    });

  if (error) throw error;
}

export async function listSettingsChangeRequests() {
  const { data, error } = await (supabase as any)
    .from('settings_change_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return ((data || []) as unknown) as SettingsChangeRequestRecord[];
}

export async function approveSettingsChangeRequest(id: string, reviewNote?: string) {
  const { data, error } = await (supabase as any).rpc('approve_settings_change_request', {
    _request_id: id,
    _review_note: reviewNote || null,
  });
  if (error) throw error;
  return data;
}

export async function rejectSettingsChangeRequest(id: string, reviewNote?: string) {
  const { data, error } = await (supabase as any).rpc('reject_settings_change_request', {
    _request_id: id,
    _review_note: reviewNote || null,
  });
  if (error) throw error;
  return data;
}
