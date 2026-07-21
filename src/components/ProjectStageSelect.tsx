import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { logStageChange } from '@/hooks/useQuoteStageHistory';
import { triggerDailyHamzzi } from '@/lib/hamzziEvents';
import { refreshQuoteDashboardState } from '@/services/quoteDashboardSync';
import { recordQuoteLostReason } from '@/services/quoteLossReason';
import QuoteLostReasonDialog, { type QuoteLostReasonFormValue } from '@/components/quote/QuoteLostReasonDialog';
import {
  getStageInfo,
  normalizeProjectStage,
  projectStageToLegacyQuoteStatus,
  QUOTE_PROJECT_STAGES,
  type ProjectStageValue,
} from '@/utils/quoteWorkflow';
import { canRecordQuoteLostReason, getQuoteLostReasonLabel } from '@/utils/quoteLossReason';

export const PROJECT_STAGES = QUOTE_PROJECT_STAGES;
export { getStageInfo };
export type { ProjectStageValue };

interface ProjectStageSelectProps {
  quoteId: string;
  currentStage: string;
  quoteNumber?: string;
  quoteTitle?: string;
  quoteRecipient?: string | null;
  quoteTotal?: number | null;
  quoteStatus?: string | null;
  projectId?: string | null;
  quoteUserId?: string;
  onStageChanged?: (newStage: string) => void;
  onLostReasonRecorded?: (payload: Record<string, unknown>) => void;
}

const ProjectStageSelect = ({
  quoteId,
  currentStage,
  quoteNumber,
  quoteTitle,
  quoteRecipient,
  quoteTotal,
  quoteStatus,
  projectId,
  quoteUserId,
  onStageChanged,
  onLostReasonRecorded,
}: ProjectStageSelectProps) => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const { logActivity } = useActivityLog();
  const normalizedCurrentStage = normalizeProjectStage(currentStage, quoteStatus);

  const handleStageChange = async (newStage: string) => {
    if (newStage === normalizedCurrentStage) return;
    if (newStage === 'cancelled') {
      if (!canRecordQuoteLostReason(normalizedCurrentStage, quoteStatus, projectId)) {
        toast.error('수주 이후 단계 또는 프로젝트 연결 견적은 이 화면에서 수주 실패 처리할 수 없습니다.');
        return;
      }
      setLossDialogOpen(true);
      return;
    }
    setUpdating(true);

    try {
      // 1. Update local DB
      const { error } = await supabase
        .from('saved_quotes')
        .update({
          project_stage: newStage,
          quote_status: projectStageToLegacyQuoteStatus(newStage),
          status_updated_at: new Date().toISOString(),
        } as never)
        .eq('id', quoteId);

      if (error) throw error;

      // Send notification to the quote owner
      const oldStageInfo = getStageInfo(normalizedCurrentStage);
      const newStageInfo = getStageInfo(newStage);
      const targetUserId = quoteUserId || user?.id;
      if (targetUserId && targetUserId !== user?.id) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'quote_update',
          title: '견적서 상태 변경',
          description: `견적서 ${quoteNumber || ''} 상태가 "${oldStageInfo.label}"에서 "${newStageInfo.label}"(으)로 변경되었습니다.`,
          data: { quoteId, oldStage: normalizedCurrentStage, newStage, quoteNumber },
        });
      }


      const stageInfo = getStageInfo(newStage);
      toast.success(`${stageInfo.label}(으)로 변경되었습니다.`);
      logActivity('stage_changed', quoteId, quoteNumber || quoteId, { oldStage: normalizedCurrentStage, newStage, newStageLabel: stageInfo.label });

      // Log stage change history
      const userName = profile?.full_name || user?.email || '알 수 없음';
      if (user) {
        logStageChange(quoteId, normalizedCurrentStage, newStage, user.id, userName);
      }

      if (newStage === 'delivered') {
        triggerDailyHamzzi(`delivery-complete:${quoteId}`, 'delivery_complete', {
          message: '납기 완료 처리됐습니다.',
          description: quoteNumber ? `견적 ${quoteNumber}` : undefined,
          durationMs: 3400,
        });
      }

      await refreshQuoteDashboardState(queryClient, quoteId);
      onStageChanged?.(newStage);
    } catch (err: any) {
      console.error('[Stage] Update error:', err);
      toast.error('단계 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const handleLostReasonSubmit = async (value: QuoteLostReasonFormValue) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    setUpdating(true);
    try {
      const actorName = profile?.full_name || user.email || '알 수 없음';
      const result = await recordQuoteLostReason({
        quoteId,
        quoteNumber,
        projectStage: normalizedCurrentStage,
        quoteStatus,
        projectId,
        lostBy: value.lostBy,
        reasonCategory: value.reasonCategory,
        detail: value.detail,
        actorId: user.id,
        actorName,
      });

      const oldStageInfo = getStageInfo(normalizedCurrentStage);
      const targetUserId = quoteUserId || user.id;
      if (targetUserId && targetUserId !== user.id) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'quote_update',
          title: '견적서 수주 실패 처리',
          description: `견적서 ${quoteNumber || ''} 상태가 "${oldStageInfo.label}"에서 "수주 실패/취소"(으)로 변경되었습니다.`,
          data: {
            quoteId,
            oldStage: normalizedCurrentStage,
            newStage: 'cancelled',
            quoteNumber,
            reasonCategory: value.reasonCategory,
          },
        });
      }

      logActivity('stage_changed', quoteId, quoteNumber || quoteId, {
        oldStage: normalizedCurrentStage,
        newStage: 'cancelled',
        newStageLabel: '수주 실패/취소',
        reasonCategory: value.reasonCategory,
      });

      const userName = profile?.full_name || user.email || '알 수 없음';
      logStageChange(quoteId, normalizedCurrentStage, 'cancelled', user.id, userName);

      await refreshQuoteDashboardState(queryClient, quoteId);
      queryClient.invalidateQueries({ queryKey: ['quote-activity-history', quoteId] });
      queryClient.invalidateQueries({ queryKey: ['quote-statistics'] });
      toast.success(`수주 실패 처리되었습니다. 원인: ${getQuoteLostReasonLabel(value.reasonCategory)}`);
      setLossDialogOpen(false);
      onStageChanged?.('cancelled');
      onLostReasonRecorded?.(result);
    } catch (err: any) {
      console.error('[Stage] Quote loss record error:', err);
      toast.error(err?.message || '수주 실패 처리에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const stage = getStageInfo(normalizedCurrentStage);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={normalizedCurrentStage} onValueChange={handleStageChange} disabled={updating}>
        <SelectTrigger className={`h-7 text-xs font-medium border ${stage.color} w-auto min-w-[100px] px-2`}>
          {updating ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : null}
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PROJECT_STAGES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${s.color}`}>
                {s.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <QuoteLostReasonDialog
        open={lossDialogOpen}
        onOpenChange={setLossDialogOpen}
        submitting={updating}
        quote={{
          quoteNumber,
          title: quoteTitle,
          recipient: quoteRecipient,
          total: quoteTotal,
        }}
        onSubmit={handleLostReasonSubmit}
      />
    </div>
  );
};

export default ProjectStageSelect;
