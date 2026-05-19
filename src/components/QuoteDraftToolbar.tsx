import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotes } from '@/contexts/QuoteContext';
import { listQuoteDrafts, type QuoteDraftRecord } from '@/services/quoteDrafts';
import { Archive, Copy, FileText, FolderOpen, Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_LABELS = {
  idle: '대기',
  saving: '저장 중',
  saved: '저장됨',
  error: '저장 오류',
  offline: '로컬 임시저장',
} as const;

const STATUS_CLASS_NAMES = {
  idle: 'border-slate-200 bg-slate-50 text-slate-600',
  saving: 'border-blue-200 bg-blue-50 text-blue-700',
  saved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-red-200 bg-red-50 text-red-700',
  offline: 'border-amber-200 bg-amber-50 text-amber-700',
} as const;

const formatSavedAt = (date: Date | null) => {
  if (!date) return '';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

const actionButtonClassName = 'h-10 min-w-[78px] gap-2 rounded-2xl px-3 text-sm font-medium';

const QuoteDraftToolbar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeDraftId,
    draftTitle,
    draftSaveStatus,
    draftLastSavedAt,
    draftError,
    setDraftTitle,
    saveDraftNow,
    createDraft,
    loadDraft,
    duplicateActiveDraft,
    archiveActiveDraft,
  } = useQuotes();
  const [drafts, setDrafts] = useState<QuoteDraftRecord[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  const hasActiveDraftInList = activeDraftId ? drafts.some((draft) => draft.id === activeDraftId) : false;
  const shouldShowLocalDraftTab = !loadingDrafts && (!activeDraftId || !hasActiveDraftInList);

  const refreshDrafts = useCallback(async () => {
    if (!user) {
      setDrafts([]);
      return;
    }
    setLoadingDrafts(true);
    try {
      setDrafts(await listQuoteDrafts('active'));
    } catch (error) {
      console.error('Failed to load quote drafts:', error);
    } finally {
      setLoadingDrafts(false);
    }
  }, [user]);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts, activeDraftId, draftSaveStatus]);

  const handleNewDraft = async () => {
    const id = await createDraft();
    if (id) {
      toast.success('새 견적 초안을 만들었습니다.');
      await refreshDrafts();
    }
  };

  const handleSave = async () => {
    const id = await saveDraftNow();
    if (id) {
      toast.success('초안이 저장되었습니다.');
      await refreshDrafts();
    }
  };

  const handleDuplicate = async () => {
    const id = await duplicateActiveDraft();
    if (id) {
      toast.success('초안을 복제했습니다.');
      await refreshDrafts();
    }
  };

  const handleArchive = async () => {
    const archived = await archiveActiveDraft();
    if (archived) {
      toast.success('초안을 보관했습니다.');
      await refreshDrafts();
    }
  };

  return (
    <Card className="mb-4 overflow-hidden border-blue-100 bg-white/85 shadow-sm print:hidden">
      <CardContent className="p-2.5 sm:p-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600">
              <FileText className="h-4 w-4" />
            </span>
            <ScrollArea className="min-w-0 flex-1">
              <div className="flex h-12 min-w-max items-end gap-1 pr-2">
                {drafts.map((draft) => {
                  const isActive = draft.id === activeDraftId;

                  if (isActive) {
                    return (
                      <div
                        key={draft.id}
                        className="flex h-11 min-w-[220px] max-w-[300px] items-center gap-2 rounded-t-2xl border border-blue-200 border-b-white bg-white px-3 text-blue-700 shadow-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <Input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          placeholder="초안 이름"
                          className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 shadow-none focus-visible:ring-0"
                        />
                        <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          {draft.items.length}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={draft.id}
                      type="button"
                      onClick={() => loadDraft(draft.id)}
                      className="flex h-10 min-w-[170px] max-w-[240px] items-center gap-2 rounded-t-2xl border border-slate-200 bg-slate-50/80 px-3 text-left text-sm font-medium text-slate-600 transition-colors hover:border-blue-100 hover:bg-white hover:text-slate-900"
                      title={draft.title}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1 truncate">{draft.title}</span>
                      <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                        {draft.items.length}
                      </span>
                    </button>
                  );
                })}
                {shouldShowLocalDraftTab && (
                  <div className="flex h-11 min-w-[220px] max-w-[300px] items-center gap-2 rounded-t-2xl border border-blue-200 border-b-white bg-white px-3 text-blue-700 shadow-sm">
                    <FileText className="h-4 w-4 shrink-0" />
                    <Input
                      value={draftTitle}
                      onChange={(event) => setDraftTitle(event.target.value)}
                      placeholder="초안 이름"
                      className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm font-semibold text-slate-900 shadow-none focus-visible:ring-0"
                    />
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleNewDraft}
                  className="mb-0.5 h-10 w-10 shrink-0 rounded-t-2xl rounded-b-lg border border-dashed border-blue-100 bg-white/70 text-blue-600 hover:bg-blue-50"
                  aria-label="새 초안"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2 xl:justify-end">
            <Badge
              variant="outline"
              className={`inline-flex h-10 min-w-[74px] shrink-0 items-center justify-center whitespace-nowrap rounded-2xl px-3 text-xs font-semibold leading-none ${STATUS_CLASS_NAMES[draftSaveStatus]}`}
            >
              {draftSaveStatus === 'saving' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {STATUS_LABELS[draftSaveStatus]}
              {draftSaveStatus === 'saved' && draftLastSavedAt ? ` ${formatSavedAt(draftLastSavedAt)}` : ''}
            </Badge>
            <Button variant="outline" size="sm" onClick={handleSave} className={actionButtonClassName}>
              <Save className="h-4 w-4 shrink-0" />
              저장
            </Button>
            <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={!activeDraftId} className={actionButtonClassName}>
              <Copy className="h-4 w-4 shrink-0" />
              복제
            </Button>
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={!activeDraftId} className={actionButtonClassName}>
              <Archive className="h-4 w-4 shrink-0" />
              보관
            </Button>
            <Button size="sm" onClick={() => navigate('/quote-drafts')} className={actionButtonClassName}>
              <FolderOpen className="h-4 w-4 shrink-0" />
              초안함
            </Button>
          </div>
        </div>
        {draftError && (
          <div className="mt-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-xs font-medium text-red-600">
            {draftError}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuoteDraftToolbar;
