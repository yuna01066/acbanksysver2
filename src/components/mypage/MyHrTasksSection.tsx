import React from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { CheckCircle2, ChevronRight, GraduationCap, Loader2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmployeeHrTask, useEmployeeHrTasks } from '@/hooks/useHrSelfService';
import { MyPageEmptyState, MyPageSectionHeader } from '@/components/mypage/MyPageLayout';

const taskTypeLabels: Record<string, string> = {
  onboarding: '온보딩',
  training: '교육',
  document: '서류',
  policy: '정책 확인',
  general: '일반',
};

const statusLabels: Record<string, { label: string; className: string }> = {
  pending: { label: '대기', className: 'bg-muted text-muted-foreground' },
  in_progress: { label: '진행중', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  completed: { label: '완료', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  cancelled: { label: '취소', className: 'bg-muted text-muted-foreground' },
};

const getErrorMessage = (error: unknown) => error instanceof Error ? error.message : '';

function TaskCard({ task, onComplete, onReopen }: {
  task: EmployeeHrTask;
  onComplete: (task: EmployeeHrTask) => void;
  onReopen: (task: EmployeeHrTask) => void;
}) {
  const navigate = useNavigate();
  const status = statusLabels[task.status] || statusLabels.pending;
  const linkedPath = typeof task.linked_resource?.path === 'string' ? task.linked_resource.path : null;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{taskTypeLabels[task.task_type] || task.task_type}</Badge>
            <Badge className={status.className}>{status.label}</Badge>
            {task.due_date && (
              <span className="text-xs text-muted-foreground">
                마감 {format(new Date(task.due_date), 'yyyy.MM.dd', { locale: ko })}
              </span>
            )}
          </div>
          <p className="text-base font-semibold">{task.title}</p>
          {task.description && (
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-muted-foreground">{task.description}</p>
          )}
          {task.completed_at && (
            <p className="mt-2 text-xs text-muted-foreground">
              완료일 {format(new Date(task.completed_at), 'yyyy.MM.dd HH:mm', { locale: ko })}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {linkedPath && (
            <Button variant="outline" size="sm" onClick={() => navigate(linkedPath)}>
              연결 화면
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
          {task.status === 'completed' ? (
            <Button variant="ghost" size="sm" onClick={() => onReopen(task)}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              다시 열기
            </Button>
          ) : (
            <Button size="sm" onClick={() => onComplete(task)}>
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              완료
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const MyHrTasksSection: React.FC = () => {
  const { data: tasks = [], isLoading, updateTaskStatus } = useEmployeeHrTasks();
  const activeTasks = tasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled');
  const completedTasks = tasks.filter((task) => task.status === 'completed');

  const completeTask = async (task: EmployeeHrTask) => {
    try {
      await updateTaskStatus.mutateAsync({ taskId: task.id, status: 'completed' });
      toast.success('과제를 완료 처리했습니다.');
    } catch (error: unknown) {
      toast.error('처리 실패: ' + getErrorMessage(error));
    }
  };

  const reopenTask = async (task: EmployeeHrTask) => {
    try {
      await updateTaskStatus.mutateAsync({ taskId: task.id, status: 'pending' });
      toast.success('과제를 다시 대기 상태로 변경했습니다.');
    } catch (error: unknown) {
      toast.error('처리 실패: ' + getErrorMessage(error));
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <MyPageSectionHeader
        title="교육·온보딩"
        description="관리자가 배정한 온보딩, 교육, 문서 제출, 정책 확인 과제를 처리합니다."
        icon={<GraduationCap className="h-4 w-4" />}
      />

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList className="h-auto rounded-xl bg-muted/70 p-1">
          <TabsTrigger value="active">진행 중 {activeTasks.length}</TabsTrigger>
          <TabsTrigger value="completed">완료 {completedTasks.length}</TabsTrigger>
        </TabsList>
        <TabsContent value="active" className="space-y-3">
          {activeTasks.length === 0 ? (
            <MyPageEmptyState title="진행 중인 교육·온보딩 과제가 없습니다." description="새 과제가 배정되면 이곳에서 처리할 수 있습니다." />
          ) : (
            activeTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={completeTask} onReopen={reopenTask} />
            ))
          )}
        </TabsContent>
        <TabsContent value="completed" className="space-y-3">
          {completedTasks.length === 0 ? (
            <MyPageEmptyState title="완료된 과제가 없습니다." description="완료한 과제는 이 탭에 보관됩니다." />
          ) : (
            completedTasks.map((task) => (
              <TaskCard key={task.id} task={task} onComplete={completeTask} onReopen={reopenTask} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MyHrTasksSection;
