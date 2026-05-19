import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    <Card className="mb-4 border-blue-100 bg-white/80 shadow-sm print:hidden">
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-3 md:flex-row md:items-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600">
              <FileText className="h-4 w-4" />
            </span>
            견적 초안
          </div>
          <Input
            value={draftTitle}
            onChange={(event) => setDraftTitle(event.target.value)}
            placeholder="초안 이름"
            className="h-9 min-w-[180px] md:max-w-xs"
          />
          <Select
            value={activeDraftId || '__none'}
            onValueChange={(value) => {
              if (value !== '__none') loadDraft(value);
            }}
          >
            <SelectTrigger className="h-9 min-w-[220px] md:w-[260px]">
              <SelectValue placeholder="초안 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none" disabled>
                {loadingDrafts ? '초안 불러오는 중...' : '초안 선택'}
              </SelectItem>
              {drafts.map((draft) => (
                <SelectItem key={draft.id} value={draft.id}>
                  {draft.title} · {draft.items.length}개
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="outline" className={STATUS_CLASS_NAMES[draftSaveStatus]}>
            {draftSaveStatus === 'saving' && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {STATUS_LABELS[draftSaveStatus]}
            {draftSaveStatus === 'saved' && draftLastSavedAt ? ` ${formatSavedAt(draftLastSavedAt)}` : ''}
          </Badge>
          {draftError && <span className="text-xs text-red-600">{draftError}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleNewDraft}>
            <Plus className="h-4 w-4" />
            새 초안
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave}>
            <Save className="h-4 w-4" />
            저장
          </Button>
          <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={!activeDraftId}>
            <Copy className="h-4 w-4" />
            복제
          </Button>
          <Button variant="outline" size="sm" onClick={handleArchive} disabled={!activeDraftId}>
            <Archive className="h-4 w-4" />
            보관
          </Button>
          <Button size="sm" onClick={() => navigate('/quote-drafts')}>
            <FolderOpen className="h-4 w-4" />
            초안함
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuoteDraftToolbar;
