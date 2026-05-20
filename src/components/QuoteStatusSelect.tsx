import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logQuoteActivity } from '@/services/quoteActivity';
import {
  getQuoteStatusInfo,
  normalizeQuoteStatus,
  QUOTE_STATUSES,
  type QuoteStatusValue,
} from '@/utils/quoteStatus';

interface QuoteStatusSelectProps {
  quoteId: string;
  currentStatus?: string | null;
  projectStage?: string | null;
  quoteNumber?: string | null;
  quoteUserId?: string | null;
  disabled?: boolean;
  onStatusChanged?: (newStatus: QuoteStatusValue) => void;
}

const QuoteStatusSelect = ({
  quoteId,
  currentStatus,
  projectStage,
  quoteNumber,
  quoteUserId,
  disabled,
  onStatusChanged,
}: QuoteStatusSelectProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [pendingStatus, setPendingStatus] = useState<QuoteStatusValue | null>(null);
  const [memo, setMemo] = useState('');
  const [updating, setUpdating] = useState(false);

  const normalizedStatus = normalizeQuoteStatus(currentStatus, projectStage);
  const statusInfo = getQuoteStatusInfo(normalizedStatus);
  const pendingInfo = pendingStatus ? getQuoteStatusInfo(pendingStatus) : null;

  const handleSelect = (value: string) => {
    const nextStatus = normalizeQuoteStatus(value);
    if (nextStatus === normalizedStatus) return;
    setPendingStatus(nextStatus);
    setMemo('');
  };

  const handleConfirm = async () => {
    if (!pendingStatus || !user) return;
    setUpdating(true);

    try {
      const updatedAt = new Date().toISOString();
      const updatePayload: Record<string, unknown> = {
        quote_status: pendingStatus,
        status_updated_at: updatedAt,
      };

      if (pendingStatus === 'cancelled' && !projectStage) {
        updatePayload.project_stage = 'cancelled';
      }

      const { error } = await supabase
        .from('saved_quotes')
        .update(updatePayload as never)
        .eq('id', quoteId);

      if (error) throw error;

      const actorName = profile?.full_name || user.email || '알 수 없음';
      await logQuoteActivity({
        quoteId,
        actionType: 'status_changed',
        actorId: user.id,
        actorName,
        oldValue: normalizedStatus,
        newValue: pendingStatus,
        memo: memo.trim() || null,
        metadata: { quoteNumber },
      });

      if (quoteUserId && quoteUserId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: quoteUserId,
          type: 'quote_update',
          title: '견적 상태 변경',
          description: `견적서 ${quoteNumber || ''} 상태가 "${statusInfo.label}"에서 "${pendingInfo?.label}"(으)로 변경되었습니다.`,
          data: { quoteId, oldStatus: normalizedStatus, newStatus: pendingStatus, quoteNumber },
        });
      }

      toast.success(`${pendingInfo?.label || '상태'}(으)로 변경되었습니다.`);
      onStatusChanged?.(pendingStatus);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quoteId] });
      setPendingStatus(null);
      setMemo('');
    } catch (error) {
      console.error('[QuoteStatus] Update error:', error);
      toast.error('견적 상태 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      <div onClick={(event) => event.stopPropagation()}>
        <Select value={normalizedStatus} onValueChange={handleSelect} disabled={disabled || updating}>
          <SelectTrigger className={`h-8 min-w-[112px] border text-xs font-semibold ${statusInfo.color}`}>
            {updating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUOTE_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${status.color}`}>
                  {status.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={!!pendingStatus} onOpenChange={(open) => !open && setPendingStatus(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>견적 상태 변경</DialogTitle>
            <DialogDescription>
              {statusInfo.label}에서 {pendingInfo?.label}(으)로 변경합니다. 필요한 경우 변경 사유를 남겨주세요.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="상태 변경 메모 (선택)"
            className="min-h-[90px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingStatus(null)} disabled={updating}>
              취소
            </Button>
            <Button onClick={handleConfirm} disabled={updating}>
              {updating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              변경
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuoteStatusSelect;
