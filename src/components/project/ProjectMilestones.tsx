import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Flag, CheckCircle2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import { toast } from 'sonner';

interface Props {
  projectId: string;
}

const FIXED_STAGES = [
  { key: 'quote_issued', label: '견적 발행' },
  { key: 'invoice_issued', label: '계산서 발행' },
  { key: 'panel_ordered', label: '원판 발주' },
  { key: 'manufacturing', label: '제작 진행' },
  { key: 'completed', label: '완료' },
];

const ProjectMilestones: React.FC<Props> = ({ projectId }) => {
  const queryClient = useQueryClient();
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['project-milestones', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('display_order');
      if (error) throw error;
      return data;
    },
  });

  const initFixed = useMutation({
    mutationFn: async () => {
      const existing = milestones.filter((m: any) => m.milestone_type === 'fixed');
      if (existing.length > 0) return;
      const rows = FIXED_STAGES.map((s, i) => ({
        project_id: projectId,
        title: s.label,
        milestone_type: 'fixed',
        fixed_stage: s.key,
        display_order: i,
      }));
      const { error } = await supabase.from('project_milestones').insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      toast.success('기본 마일스톤이 생성되었습니다.');
    },
  });

  const addCustom = useMutation({
    mutationFn: async () => {
      if (!newTitle.trim()) return;
      const { error } = await supabase.from('project_milestones').insert({
        project_id: projectId,
        title: newTitle.trim(),
        target_date: newDate || null,
        milestone_type: 'custom',
        display_order: milestones.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      setNewTitle('');
      setNewDate('');
      setShowAdd(false);
      toast.success('마일스톤이 추가되었습니다.');
    },
  });

  const toggleComplete = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await supabase
        .from('project_milestones')
        .update({
          is_completed: completed,
          completed_at: completed ? new Date().toISOString() : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
    },
  });

  const deleteMilestone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_milestones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-milestones', projectId] });
      toast.success('삭제되었습니다.');
    },
  });

  const hasFixed = milestones.some((m: any) => m.milestone_type === 'fixed');
  const completedCount = milestones.filter((m: any) => m.is_completed).length;
  const progress = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress */}
      {milestones.length > 0 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 transition-all rounded-full" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">{completedCount}/{milestones.length}</span>
        </div>
      )}

      {/* Init button */}
      {!hasFixed && milestones.length === 0 && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs gap-1.5 h-8"
          onClick={() => initFixed.mutate()}
        >
          <Flag className="h-3 w-3" /> 기본 단계 마일스톤 생성
        </Button>
      )}

      {/* Milestone list */}
      <div className="space-y-1">
        {milestones.map((m: any) => (
          <div
            key={m.id}
            className={`flex items-center gap-2 p-2 rounded-md border text-xs group transition-colors ${
              m.is_completed ? 'bg-emerald-50/50 border-emerald-200/50' : 'bg-card'
            }`}
          >
            <Checkbox
              checked={m.is_completed}
              onCheckedChange={(checked) => toggleComplete.mutate({ id: m.id, completed: !!checked })}
              className="h-3.5 w-3.5"
            />
            <div className="flex-1 min-w-0">
              <span className={`text-[11px] font-medium ${m.is_completed ? 'line-through text-muted-foreground' : ''}`}>
                {m.title}
              </span>
              {m.target_date && (
                <span className="text-[9px] text-muted-foreground ml-2">
                  {format(parseISO(m.target_date), 'M/d', { locale: ko })}
                </span>
              )}
              {m.completed_at && (
                <span className="text-[9px] text-emerald-600 ml-1 flex items-center gap-0.5 inline-flex">
                  <CheckCircle2 className="h-2 w-2" />
                  {format(new Date(m.completed_at), 'M/d')}
                </span>
              )}
            </div>
            {m.milestone_type === 'custom' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-destructive"
                onClick={() => deleteMilestone.mutate(m.id)}
              >
                <Trash2 className="h-2.5 w-2.5" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Add custom */}
      {showAdd ? (
        <div className="space-y-1.5 p-2 rounded-md border bg-muted/30">
          <Input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="마일스톤 이름"
            className="h-7 text-xs"
          />
          <Input
            type="date"
            value={newDate}
            onChange={e => setNewDate(e.target.value)}
            className="h-7 text-xs"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="h-6 text-[10px] flex-1" onClick={() => addCustom.mutate()}>추가</Button>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setShowAdd(false)}>취소</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full text-xs gap-1 h-7" onClick={() => setShowAdd(true)}>
          <Plus className="h-3 w-3" /> 커스텀 마일스톤 추가
        </Button>
      )}
    </div>
  );
};

export default ProjectMilestones;
