import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

export type AttendanceCorrection = Database['public']['Tables']['attendance_correction_requests']['Row'] & {
  attendance_before?: unknown;
  attendance_after?: unknown;
};

// Local RPC boundary until deployment regenerates the Supabase database types.
async function correctionRpc(name: string, args: Record<string, unknown>) {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data;
}

export const submitAttendanceCorrection = (input: {
  date: string; requestType: string; checkIn: string | null; checkOut: string | null; reason: string;
}) => correctionRpc('submit_attendance_correction', {
  _date: input.date, _request_type: input.requestType, _check_in: input.checkIn,
  _check_out: input.checkOut, _reason: input.reason.trim(),
});

export const cancelAttendanceCorrection = (id: string) =>
  correctionRpc('cancel_attendance_correction', { _request_id: id });

export const reviewAttendanceCorrection = (
  request: AttendanceCorrection, decision: 'handled' | 'rejected', note: string,
  record: { id: string; updated_at: string | null } | null,
) => correctionRpc('review_attendance_correction', {
  _request_id: request.id, _decision: decision, _note: note.trim(),
  _expected_request_updated_at: request.updated_at,
  _expected_record_id: record?.id || null, _expected_record_updated_at: record?.updated_at || null,
});
