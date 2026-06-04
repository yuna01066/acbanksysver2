import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { useActivityLog } from '@/hooks/useActivityLog';
import { logStageChange } from '@/hooks/useQuoteStageHistory';
import { triggerDailyHamzzi } from '@/lib/hamzziEvents';
import {
  getStageInfo,
  normalizeProjectStage,
  projectStageToLegacyQuoteStatus,
  QUOTE_PROJECT_STAGES,
  type ProjectStageValue,
} from '@/utils/quoteWorkflow';

export const PROJECT_STAGES = QUOTE_PROJECT_STAGES;
export { getStageInfo };
export type { ProjectStageValue };

interface ProjectStageSelectProps {
  quoteId: string;
  currentStage: string;
  quoteNumber?: string;
  quoteUserId?: string;
  onStageChanged?: (newStage: string) => void;
}

const ProjectStageSelect = ({
  quoteId,
  currentStage,
  quoteNumber,
  quoteUserId,
  onStageChanged,
}: ProjectStageSelectProps) => {
  const { user, profile } = useAuth();
  const [updating, setUpdating] = useState(false);
  const { logActivity } = useActivityLog();
  const normalizedCurrentStage = normalizeProjectStage(currentStage);

  const handleStageChange = async (newStage: string) => {
    if (newStage === normalizedCurrentStage) return;
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

      onStageChanged?.(newStage);
    } catch (err: any) {
      console.error('[Stage] Update error:', err);
      toast.error('단계 변경에 실패했습니다.');
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
    </div>
  );
};

export default ProjectStageSelect;
