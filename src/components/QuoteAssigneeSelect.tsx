import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logQuoteActivity } from '@/services/quoteActivity';
import { refreshQuoteDashboardState } from '@/services/quoteDashboardSync';

export interface QuoteAssigneeOption {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface QuoteAssigneeSelectProps {
  quoteId: string;
  quoteNumber?: string | null;
  currentAssigneeId?: string | null;
  currentAssigneeName?: string | null;
  users: QuoteAssigneeOption[];
  disabled?: boolean;
  onAssigneeChanged?: (assigneeId: string | null, assigneeName: string | null) => void;
}

const getAssigneeName = (user: QuoteAssigneeOption | undefined | null) => (
  user?.full_name || user?.email || '담당자 미지정'
);

const QuoteAssigneeSelect = ({
  quoteId,
  quoteNumber,
  currentAssigneeId,
  currentAssigneeName,
  users,
  disabled,
  onAssigneeChanged,
}: QuoteAssigneeSelectProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const currentValue = currentAssigneeId || 'none';

  const handleChange = async (value: string) => {
    if (!user || value === currentValue) return;
    const selectedUser = value === 'none' ? null : users.find((candidate) => candidate.id === value) || null;
    const nextId = selectedUser?.id || null;
    const nextName = selectedUser ? getAssigneeName(selectedUser) : null;
    const oldName = currentAssigneeName || '미지정';

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('saved_quotes')
        .update({
          assigned_to: nextId,
          assigned_to_name: nextName,
        } as never)
        .eq('id', quoteId);

      if (error) throw error;

      await logQuoteActivity({
        quoteId,
        actionType: 'assignee_changed',
        actorId: user.id,
        actorName: profile?.full_name || user.email || '알 수 없음',
        oldValue: oldName,
        newValue: nextName || '미지정',
        metadata: { quoteNumber, assignedTo: nextId },
      });

      toast.success('견적 담당자가 변경되었습니다.');
      onAssigneeChanged?.(nextId, nextName);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quoteId] });
      await refreshQuoteDashboardState(queryClient, quoteId);
    } catch (error) {
      console.error('[QuoteAssignee] Update error:', error);
      toast.error('담당자 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Select value={currentValue} onValueChange={handleChange} disabled={disabled || updating}>
        <SelectTrigger className="h-8 min-w-[132px] text-xs">
          {updating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
          <SelectValue placeholder={currentAssigneeName || '담당자'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">미지정</SelectItem>
          {users.map((assignee) => (
            <SelectItem key={assignee.id} value={assignee.id}>
              {getAssigneeName(assignee)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default QuoteAssigneeSelect;
