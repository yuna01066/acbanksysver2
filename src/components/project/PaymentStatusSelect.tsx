import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const PAYMENT_STATUSES = [
  { value: 'unpaid', label: '미입금', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  { value: 'deposit_paid', label: '계약금 입금', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'interim_paid', label: '중도금 입금', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'fully_paid', label: '입금', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
] as const;

export type PaymentStatusValue = typeof PAYMENT_STATUSES[number]['value'];

export function getPaymentStatusInfo(value: string) {
  return PAYMENT_STATUSES.find(s => s.value === value) || PAYMENT_STATUSES[0];
}

interface Props {
  projectId: string;
  currentStatus: string;
}

const PaymentStatusSelect: React.FC<Props> = ({ projectId, currentStatus }) => {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);

  const handleChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ payment_status: newStatus } as any)
        .eq('id', projectId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['project-detail', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      const info = getPaymentStatusInfo(newStatus);
      toast.success(`${info.label}(으)로 변경되었습니다.`);
    } catch {
      toast.error('입금 상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const status = getPaymentStatusInfo(currentStatus);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={currentStatus} onValueChange={handleChange} disabled={updating}>
        <SelectTrigger className={`h-7 text-xs font-medium border-0 ${status.color} w-auto min-w-[100px] px-2`}>
          {updating && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${s.color}`}>
                {s.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default PaymentStatusSelect;
