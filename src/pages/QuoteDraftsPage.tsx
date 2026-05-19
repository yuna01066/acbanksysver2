import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader, PageShell, SearchFilterBar } from '@/components/layout/PageLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useQuotes } from '@/contexts/QuoteContext';
import {
  archiveQuoteDraft,
  duplicateQuoteDraft,
  issueQuoteDrafts,
  listQuoteDrafts,
  validateDraftForIssue,
  type QuoteDraftRecord,
  type QuoteDraftStatus,
} from '@/services/quoteDrafts';
import { formatPrice } from '@/utils/priceCalculations';
import { Archive, CheckCircle2, Copy, FileText, Loader2, Plus, Search, Send, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

const STATUS_META: Record<QuoteDraftStatus, { label: string; className: string }> = {
  active: { label: '작성중', className: 'border-blue-200 bg-blue-50 text-blue-700' },
  issued: { label: '발행완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  archived: { label: '보관됨', className: 'border-slate-200 bg-slate-50 text-slate-600' },
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const QuoteDraftsPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loadDraft, createDraft } = useQuotes();
  const [drafts, setDrafts] = useState<QuoteDraftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<QuoteDraftStatus | 'all'>('active');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [issueErrors, setIssueErrors] = useState<Record<string, string>>({});

  const fetchDrafts = useCallback(async () => {
    if (!user) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setDrafts(await listQuoteDrafts(statusFilter));
    } catch (error) {
      console.error('Failed to fetch quote drafts:', error);
      toast.error('초안 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [user, statusFilter]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [statusFilter]);

  const filteredDrafts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return drafts;
    return drafts.filter((draft) => {
      const target = [
        draft.title,
        draft.recipient?.projectName,
        draft.recipient?.companyName,
        draft.recipient?.contactPerson,
      ].filter(Boolean).join(' ').toLowerCase();
      return target.includes(term);
    });
  }, [drafts, searchTerm]);

  const selectedActiveDraftIds = useMemo(() => (
    filteredDrafts
      .filter(draft => selectedIds.has(draft.id) && draft.status === 'active')
      .map(draft => draft.id)
  ), [filteredDrafts, selectedIds]);

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    if (!checked) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(filteredDrafts.filter(draft => draft.status === 'active').map(draft => draft.id)));
  };

  const handleOpen = async (draft: QuoteDraftRecord) => {
    if (draft.status !== 'active') {
      toast.info('발행완료 또는 보관된 초안은 열 수 없습니다.');
      return;
    }
    const loaded = await loadDraft(draft.id);
    if (loaded) {
      navigate(draft.items.length > 0 ? '/quotes-summary' : '/calculator?type=quote');
    }
  };

  const handleNewDraft = async () => {
    const id = await createDraft();
    if (id) {
      toast.success('새 견적 초안을 만들었습니다.');
      navigate('/calculator?type=quote');
    }
  };

  const handleDuplicate = async (draft: QuoteDraftRecord) => {
    try {
      const duplicated = await duplicateQuoteDraft(draft.id);
      toast.success('초안을 복제했습니다.');
      await fetchDrafts();
      await loadDraft(duplicated.id);
      navigate('/quotes-summary');
    } catch (error) {
      console.error('Failed to duplicate quote draft:', error);
      toast.error('초안 복제에 실패했습니다.');
    }
  };

  const handleArchive = async (draft: QuoteDraftRecord) => {
    try {
      await archiveQuoteDraft(draft.id);
      toast.success('초안을 보관했습니다.');
      await fetchDrafts();
    } catch (error) {
      console.error('Failed to archive quote draft:', error);
      toast.error('초안 보관에 실패했습니다.');
    }
  };

  const handleIssueSelected = async () => {
    if (!user || selectedActiveDraftIds.length === 0) return;
    setIssuing(true);
    setIssueErrors({});
    try {
      const results = await issueQuoteDrafts({ draftIds: selectedActiveDraftIds, userId: user.id });
      const successCount = results.filter(result => result.success).length;
      const errors = results.reduce<Record<string, string>>((acc, result) => {
        if (!result.success) acc[result.draftId] = result.error || '발행 실패';
        return acc;
      }, {});
      setIssueErrors(errors);
      if (successCount > 0) toast.success(`${successCount}건의 견적서를 발행했습니다.`);
      if (Object.keys(errors).length > 0) toast.error(`${Object.keys(errors).length}건은 확인이 필요합니다.`);
      setSelectedIds(new Set());
      await fetchDrafts();
    } finally {
      setIssuing(false);
    }
  };

  const selectedCount = selectedActiveDraftIds.length;

  return (
    <PageShell maxWidth="7xl">
      <PageHeader
        eyebrow="Quote Drafts"
        title="견적서 초안함"
        description="여러 견적서 초안을 저장해두고 필요한 건만 선택 발행합니다."
        icon={<FileText className="h-5 w-5" />}
        actions={(
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/calculator?type=quote')}>
              <ShoppingCart className="h-4 w-4" />
              계산기
            </Button>
            <Button size="sm" onClick={handleNewDraft}>
              <Plus className="h-4 w-4" />
              새 초안
            </Button>
          </>
        )}
      />

      <SearchFilterBar>
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="초안명, 프로젝트, 거래처 검색"
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as QuoteDraftStatus | 'all')}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">작성중</SelectItem>
            <SelectItem value="issued">발행완료</SelectItem>
            <SelectItem value="archived">보관됨</SelectItem>
            <SelectItem value="all">전체</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleIssueSelected} disabled={issuing || selectedCount === 0}>
          {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          선택 발행 {selectedCount > 0 ? `${selectedCount}건` : ''}
        </Button>
      </SearchFilterBar>

      <Card className="border-white/70 bg-white/85 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDrafts.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center gap-3 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-semibold text-slate-800">표시할 초안이 없습니다.</p>
                <p className="text-sm text-muted-foreground">새 초안을 만들어 견적 작업을 시작하세요.</p>
              </div>
              <Button onClick={handleNewDraft}>
                <Plus className="h-4 w-4" />
                새 초안
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedCount > 0 && selectedCount === filteredDrafts.filter(d => d.status === 'active').length}
                      onCheckedChange={(checked) => toggleAll(Boolean(checked))}
                    />
                  </TableHead>
                  <TableHead>초안</TableHead>
                  <TableHead>거래처</TableHead>
                  <TableHead>항목</TableHead>
                  <TableHead>금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>수정일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDrafts.map((draft) => {
                  const validationError = draft.status === 'active' ? validateDraftForIssue(draft) : null;
                  const issueError = issueErrors[draft.id];
                  return (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(draft.id)}
                          disabled={draft.status !== 'active'}
                          onCheckedChange={(checked) => toggleSelected(draft.id, Boolean(checked))}
                        />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-left"
                          onClick={() => handleOpen(draft)}
                        >
                          <p className="font-semibold text-slate-900 hover:text-blue-600">{draft.title}</p>
                          <p className="text-xs text-muted-foreground">{draft.recipient?.projectName || '프로젝트명 미입력'}</p>
                          {(validationError || issueError) && (
                            <p className="mt-1 text-xs text-red-600">{issueError || validationError}</p>
                          )}
                        </button>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium">{draft.recipient?.companyName || '-'}</p>
                        <p className="text-xs text-muted-foreground">{draft.recipient?.contactPerson || ''}</p>
                      </TableCell>
                      <TableCell>{draft.items.length}개</TableCell>
                      <TableCell className="font-semibold">{formatPrice(draft.total)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={STATUS_META[draft.status].className}>
                          {draft.status === 'issued' && <CheckCircle2 className="mr-1 h-3 w-3" />}
                          {STATUS_META[draft.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(draft.updated_at)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpen(draft)} disabled={draft.status !== 'active'}>
                            열기
                          </Button>
                          <Button variant="outline" size="icon" onClick={() => handleDuplicate(draft)}>
                            <Copy className="h-4 w-4" />
                          </Button>
                          {draft.status === 'active' && (
                            <Button variant="outline" size="icon" onClick={() => handleArchive(draft)}>
                              <Archive className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
};

export default QuoteDraftsPage;
