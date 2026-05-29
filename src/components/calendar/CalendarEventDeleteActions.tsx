import { useState } from 'react';
import { Ban, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useDeleteCalendarEvent } from '@/hooks/useInternalCalendar';
import type { CalendarDeleteMode, InternalCalendarEvent } from '@/types/internalCalendar';

interface CalendarEventDeleteActionsProps {
  event: InternalCalendarEvent | null;
  variant?: 'detail' | 'dialog';
  disabled?: boolean;
  onDeleted?: (mode: CalendarDeleteMode, eventId: string) => void;
}

const HARD_DELETE_CONFIRM_TEXT = '삭제';

const CalendarEventDeleteActions = ({
  event,
  variant = 'detail',
  disabled = false,
  onDeleted,
}: CalendarEventDeleteActionsProps) => {
  const deleteEvent = useDeleteCalendarEvent();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [hardDeleteOpen, setHardDeleteOpen] = useState(false);
  const [hardDeleteConfirm, setHardDeleteConfirm] = useState('');
  const [activeMode, setActiveMode] = useState<CalendarDeleteMode | null>(null);

  if (!event?.can_edit) {
    return null;
  }

  const busy = disabled || deleteEvent.isPending;
  const isCanceling = activeMode === 'cancel' && deleteEvent.isPending;
  const isHardDeleting = activeMode === 'hard_delete' && deleteEvent.isPending;
  const isDetailVariant = variant === 'detail';

  const handleDelete = async (mode: CalendarDeleteMode) => {
    setActiveMode(mode);
    try {
      await deleteEvent.mutateAsync({ id: event.id, mode });
      toast.success(mode === 'cancel' ? '일정을 취소 처리했습니다.' : '일정을 완전히 삭제했습니다.');
      setCancelOpen(false);
      setHardDeleteOpen(false);
      setHardDeleteConfirm('');
      onDeleted?.(mode, event.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '일정 삭제 처리에 실패했습니다.');
    } finally {
      setActiveMode(null);
    }
  };

  return (
    <div className={cn(isDetailVariant ? 'grid gap-2' : 'flex flex-wrap gap-2')}>
      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          className={cn('h-9 rounded-full border-[#cacacb]', isDetailVariant && 'w-full')}
          onClick={() => setCancelOpen(true)}
        >
          {isCanceling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
          취소 처리
        </Button>
        <AlertDialogContent className="rounded-2xl border-[#d8d8d8]">
          <AlertDialogHeader>
            <AlertDialogTitle>일정을 취소 처리할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              일정 행은 보존하고 상태만 취소로 변경합니다. 회의실 예약 시간은 다시 사용할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-sm font-semibold text-[#111111]">
            {event.title}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-[#cacacb]">닫기</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="rounded-full bg-[#111111] text-white hover:bg-[#39393b]"
              onClick={(actionEvent) => {
                actionEvent.preventDefault();
                void handleDelete('cancel');
              }}
            >
              {isCanceling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              취소 처리
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={hardDeleteOpen} onOpenChange={setHardDeleteOpen}>
        <Button
          type="button"
          variant="destructive"
          disabled={busy}
          className={cn('h-9 rounded-full', isDetailVariant && 'w-full')}
          onClick={() => setHardDeleteOpen(true)}
        >
          {isHardDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
          완전 삭제
        </Button>
        <AlertDialogContent className="rounded-2xl border-[#d8d8d8]">
          <AlertDialogHeader>
            <AlertDialogTitle>일정을 완전히 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              참석자, 회의실 연결과 일정 기록을 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] p-3 text-sm font-semibold text-[#111111]">
              {event.title}
            </div>
            <Input
              value={hardDeleteConfirm}
              onChange={(inputEvent) => setHardDeleteConfirm(inputEvent.target.value)}
              placeholder={`"${HARD_DELETE_CONFIRM_TEXT}" 입력`}
              className="h-10 rounded-full border-[#d8d8d8]"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full border-[#cacacb]">닫기</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy || hardDeleteConfirm.trim() !== HARD_DELETE_CONFIRM_TEXT}
              className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(actionEvent) => {
                actionEvent.preventDefault();
                void handleDelete('hard_delete');
              }}
            >
              {isHardDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              완전 삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarEventDeleteActions;
