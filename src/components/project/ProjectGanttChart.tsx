import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, format, parseISO, addDays, isAfter, isBefore, startOfDay, max as dateMax, min as dateMin } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface Props {
  projectId: string;
}

const STAGE_LABELS: Record<string, string> = {
  quote_issued: '견적 발행',
  invoice_issued: '계산서 발행',
  in_progress: '진행중',
  panel_ordered: '원판발주',
  manufacturing: '제작중',
  completed: '제작완료',
};

const STAGE_COLORS: Record<string, string> = {
  quote_issued: 'bg-blue-400',
  invoice_issued: 'bg-purple-400',
  in_progress: 'bg-yellow-400',
  panel_ordered: 'bg-orange-400',
  manufacturing: 'bg-cyan-400',
  completed: 'bg-emerald-400',
};

const ProjectGanttChart: React.FC<Props> = ({ projectId }) => {
  const { data: milestones = [] } = useQuery({
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

  const { data: project } = useQuery({
    queryKey: ['project-gantt-info', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('created_at, status')
        .eq('id', projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: linkedQuotes = [] } = useQuery({
    queryKey: ['project-gantt-quotes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_quotes')
        .select('id, quote_number, project_name, project_stage, quote_date, desired_delivery_date')
        .eq('project_id', projectId)
        .order('quote_date');
      if (error) throw error;
      return data;
    },
  });

  if (!project) return null;

  // Build timeline items
  type TimelineItem = {
    id: string;
    label: string;
    startDate: Date;
    endDate: Date;
    color: string;
    type: 'quote' | 'milestone';
    completed?: boolean;
  };

  const items: TimelineItem[] = [];

  linkedQuotes.forEach((q: any) => {
    const start = q.quote_date ? startOfDay(parseISO(q.quote_date)) : startOfDay(new Date(project.created_at));
    const end = q.desired_delivery_date ? startOfDay(parseISO(q.desired_delivery_date)) : addDays(start, 30);
    items.push({
      id: q.id,
      label: q.project_name || `견적 ${q.quote_number}`,
      startDate: start,
      endDate: isAfter(end, start) ? end : addDays(start, 7),
      color: STAGE_COLORS[q.project_stage] || 'bg-primary',
      type: 'quote',
      completed: q.project_stage === 'completed',
    });
  });

  milestones.forEach((m: any) => {
    if (m.target_date) {
      const d = startOfDay(parseISO(m.target_date));
      items.push({
        id: m.id,
        label: m.title,
        startDate: d,
        endDate: d,
        color: m.is_completed ? 'bg-emerald-400' : 'bg-amber-400',
        type: 'milestone',
        completed: m.is_completed,
      });
    }
  });

  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        타임라인에 표시할 항목이 없습니다. 견적서를 연결하거나 마일스톤을 추가하세요.
      </div>
    );
  }

  // Calculate range
  const allDates = items.flatMap(i => [i.startDate, i.endDate]);
  const today = startOfDay(new Date());
  allDates.push(today);
  const rangeStart = allDates.reduce((a, b) => (isBefore(a, b) ? a : b));
  const rangeEnd = allDates.reduce((a, b) => (isAfter(a, b) ? a : b));
  const totalDays = Math.max(differenceInDays(rangeEnd, rangeStart), 7);
  const paddedStart = addDays(rangeStart, -2);
  const paddedTotal = totalDays + 4;

  const getPosition = (date: Date) => {
    const days = differenceInDays(date, paddedStart);
    return Math.max(0, Math.min(100, (days / paddedTotal) * 100));
  };

  // Month markers
  const months: { label: string; pos: number }[] = [];
  let cursor = new Date(paddedStart);
  cursor.setDate(1);
  if (isBefore(cursor, paddedStart)) cursor = addDays(cursor, 32);
  cursor.setDate(1);
  while (isBefore(cursor, addDays(paddedStart, paddedTotal))) {
    months.push({ label: format(cursor, 'M월', { locale: ko }), pos: getPosition(cursor) });
    cursor = addDays(cursor, 32);
    cursor.setDate(1);
  }

  const todayPos = getPosition(today);

  return (
    <div className="space-y-1">
      {/* Month labels */}
      <div className="relative h-5 text-[9px] text-muted-foreground">
        {months.map((m, i) => (
          <span key={i} className="absolute top-0 font-medium" style={{ left: `${m.pos}%` }}>
            {m.label}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        {/* Today line */}
        <div
          className="absolute top-0 bottom-0 w-px bg-destructive/50 z-10"
          style={{ left: `${todayPos}%` }}
        >
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[8px] text-destructive font-medium whitespace-nowrap">
            오늘
          </span>
        </div>

        {items.map((item) => {
          const left = getPosition(item.startDate);
          const right = getPosition(item.endDate);
          const width = Math.max(right - left, 0.5);

          return (
            <div key={item.id} className="flex items-center gap-2 h-7">
              <span className="text-[10px] w-[100px] truncate shrink-0 text-right pr-1">{item.label}</span>
              <div className="flex-1 relative h-4">
                {item.type === 'milestone' ? (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 border-2 border-background"
                    style={{ left: `${left}%` }}
                  >
                    <div className={`w-full h-full ${item.color} ${item.completed ? 'opacity-60' : ''}`} />
                  </div>
                ) : (
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 h-3 rounded-full ${item.color} ${item.completed ? 'opacity-50' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%`, minWidth: '4px' }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> 마일스톤
        </span>
        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-primary" /> 견적
        </span>
      </div>
    </div>
  );
};

export default ProjectGanttChart;
