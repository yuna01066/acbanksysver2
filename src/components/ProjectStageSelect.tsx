import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

export const PROJECT_STAGES = [
  { value: 'quote_issued', label: '견적 발행', pluuugStatusId: 120348, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  { value: 'invoice_issued', label: '계산서 발행', pluuugStatusId: 120349, color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { value: 'in_progress', label: '진행중', pluuugStatusId: 120343, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  { value: 'panel_ordered', label: '원판발주', pluuugStatusId: 120345, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { value: 'manufacturing', label: '제작중', pluuugStatusId: 120344, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  { value: 'completed', label: '제작완료', pluuugStatusId: 120346, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { value: 'cancelled', label: '취소된 프로젝트', pluuugStatusId: 120347, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
] as const;

export type ProjectStageValue = typeof PROJECT_STAGES[number]['value'];

export function getStageInfo(value: string) {
  return PROJECT_STAGES.find(s => s.value === value) || PROJECT_STAGES[0];
}

interface ProjectStageSelectProps {
  quoteId: string;
  currentStage: string;
  quoteNumber?: string;
  quoteUserId?: string;
  pluuugEstimateId: string | null;
  pluuugSynced: boolean | null;
  onStageChanged?: (newStage: string) => void;
}

const ProjectStageSelect = ({
  quoteId,
  currentStage,
  quoteNumber,
  quoteUserId,
  pluuugEstimateId,
  pluuugSynced,
  onStageChanged,
}: ProjectStageSelectProps) => {
  const { user } = useAuth();
  const [updating, setUpdating] = useState(false);

  const handleStageChange = async (newStage: string) => {
    if (newStage === currentStage) return;
    setUpdating(true);

    try {
      // 1. Update local DB
      const { error } = await supabase
        .from('saved_quotes')
        .update({ project_stage: newStage })
        .eq('id', quoteId);

      if (error) throw error;

      // Send notification to the quote owner
      const oldStageInfo = getStageInfo(currentStage);
      const newStageInfo = getStageInfo(newStage);
      const targetUserId = quoteUserId || user?.id;
      if (targetUserId && targetUserId !== user?.id) {
        await supabase.from('notifications').insert({
          user_id: targetUserId,
          type: 'quote_update',
          title: '견적서 상태 변경',
          description: `견적서 ${quoteNumber || ''} 상태가 "${oldStageInfo.label}"에서 "${newStageInfo.label}"(으)로 변경되었습니다.`,
          data: { quoteId, oldStage: currentStage, newStage, quoteNumber },
        });
      }

      // 2. Sync to Pluuug if connected
      if (pluuugSynced && pluuugEstimateId) {
        const stageInfo = getStageInfo(newStage);
        const { data, error: syncError } = await supabase.functions.invoke('pluuug-api', {
          body: {
            action: 'inquiry.update',
            inquiryId: pluuugEstimateId,
            data: {
              status: { id: stageInfo.pluuugStatusId },
            },
          },
        });

        if (syncError) {
          console.error('[Stage Sync] Pluuug sync error:', syncError);
          toast.warning(`단계가 변경되었지만 Pluuug 동기화에 실패했습니다.`);
        } else if (data?.error) {
          console.error('[Stage Sync] Pluuug API error:', data.error);
          toast.warning(`단계가 변경되었지만 Pluuug 동기화에 실패했습니다: ${data.error}`);
        } else {
          toast.success(`${stageInfo.label}(으)로 변경 완료 (Pluuug 동기화됨)`);
          onStageChanged?.(newStage);
          return;
        }
      }

      const stageInfo = getStageInfo(newStage);
      toast.success(`${stageInfo.label}(으)로 변경되었습니다.`);
      onStageChanged?.(newStage);
    } catch (err: any) {
      console.error('[Stage] Update error:', err);
      toast.error('단계 변경에 실패했습니다.');
    } finally {
      setUpdating(false);
    }
  };

  const stage = getStageInfo(currentStage);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select value={currentStage} onValueChange={handleStageChange} disabled={updating}>
        <SelectTrigger className={`h-7 text-xs font-medium border-0 ${stage.color} w-auto min-w-[100px] px-2`}>
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
