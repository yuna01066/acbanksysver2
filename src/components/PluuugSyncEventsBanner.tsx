import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Cloud, CloudOff, Trash2, Unlink, X, RefreshCw, AlertTriangle, Edit } from 'lucide-react';
import { PluuugSyncEvent, usePluuugSyncEvents } from '@/hooks/usePluuugSyncEvents';

interface Props {
  onQuoteDeleted?: () => void;
}

export default function PluuugSyncEventsBanner({ onQuoteDeleted }: Props) {
  const { events, loading, resolveEvent, triggerManualSync } = usePluuugSyncEvents();
  const [actionEventId, setActionEventId] = useState<string | null>(null);

  if (events.length === 0) {
    return null;
  }

  const handleResolve = async (eventId: string, action: 'delete_local' | 'unlink' | 'dismiss') => {
    await resolveEvent(eventId, action);
    if (action === 'delete_local') {
      onQuoteDeleted?.();
    }
    setActionEventId(null);
  };

  return (
    <Card className="mb-6 border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-amber-800 dark:text-amber-300">
            Pluuug 변경사항 감지 ({events.length}건)
          </h3>
          <Button
            size="sm"
            variant="ghost"
            onClick={triggerManualSync}
            disabled={loading}
            className="ml-auto"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            다시 확인
          </Button>
        </div>

        <div className="space-y-2">
          {events.map((event) => (
            <SyncEventItem
              key={event.id}
              event={event}
              loading={loading}
              onResolve={handleResolve}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SyncEventItem({
  event,
  loading,
  onResolve,
}: {
  event: PluuugSyncEvent;
  loading: boolean;
  onResolve: (id: string, action: 'delete_local' | 'unlink' | 'dismiss') => void;
}) {
  const quoteNumber = event.details?.quote_number || event.pluuug_estimate_id;
  const isDeleted = event.event_type === 'deleted';

  return (
    <div className="flex items-center justify-between p-3 bg-background rounded-lg border">
      <div className="flex items-center gap-3">
        {isDeleted ? (
          <CloudOff className="w-5 h-5 text-destructive" />
        ) : (
          <Edit className="w-5 h-5 text-amber-600" />
        )}
        <div>
          <p className="text-sm font-medium">
            견적번호: {quoteNumber}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDeleted
              ? 'Pluuug에서 삭제됨'
              : 'Pluuug에서 수정됨'}
          </p>
        </div>
        <Badge variant={isDeleted ? 'destructive' : 'secondary'}>
          {isDeleted ? '삭제됨' : '수정됨'}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        {isDeleted ? (
          <>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" disabled={loading}>
                  <Trash2 className="w-3 h-3 mr-1" />
                  로컬도 삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>로컬 견적서 삭제</AlertDialogTitle>
                  <AlertDialogDescription>
                    견적번호 {quoteNumber}을(를) 로컬에서도 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onResolve(event.id, 'delete_local')}>
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              size="sm"
              variant="outline"
              disabled={loading}
              onClick={() => onResolve(event.id, 'unlink')}
            >
              <Unlink className="w-3 h-3 mr-1" />
              연결 해제
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => onResolve(event.id, 'unlink')}
          >
            <Unlink className="w-3 h-3 mr-1" />
            연결 해제 후 재동기화
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          disabled={loading}
          onClick={() => onResolve(event.id, 'dismiss')}
        >
          <X className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
