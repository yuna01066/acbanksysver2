import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, CheckCircle2, ChevronRight, Loader2, RotateCcw, Search, Settings2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAssistantShortcuts, type AssistantShortcutItem } from '@/hooks/useAssistantShortcuts';
import { useNotifications } from '@/hooks/useNotifications';
import { toneClasses, useTodayWorkItems, type TodayWorkCategory } from '@/hooks/useTodayWorkItems';
import { cn } from '@/lib/utils';

const ASSISTANT_SHORTCUT_LIMIT = 8;
const TODAY_WORK_FILTERS: Array<{ id: 'all' | TodayWorkCategory; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'notification', label: '알림' },
  { id: 'approval', label: '승인' },
  { id: 'calendar', label: '일정' },
  { id: 'quote', label: '견적' },
  { id: 'project', label: '프로젝트' },
  { id: 'hr', label: 'HR' },
  { id: 'system', label: '시스템' },
];
const SHORTCUT_TARGET_LABELS: Record<string, string> = {
  tool: '햄찌 도구',
  route: '내부 화면',
  external: '외부 링크',
};

interface AssistantHomePanelProps {
  onSelectShortcut: (shortcut: AssistantShortcutItem) => void;
  isTransitioning: boolean;
}

const AssistantHomePanel = ({ onSelectShortcut, isTransitioning }: AssistantHomePanelProps) => {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | TodayWorkCategory>('all');
  const { notifications } = useNotifications();
  const {
    items,
    urgentCount,
    todayCount,
    categoryCounts,
    hiddenCount,
    briefing,
    dismissItem,
    resetDismissedItems,
    isLoading,
  } = useTodayWorkItems(notifications);
  const { selectedShortcuts, isLoading: shortcutsLoading, isLocalFallback } = useAssistantShortcuts();
  const filteredItems = activeFilter === 'all'
    ? items
    : items.filter((item) => item.category === activeFilter);
  const visibleItems = filteredItems.slice(0, 7);

  return (
    <>
      <div className="space-y-3 rounded-[24px] bg-white p-3 shadow-none">
        <section className="rounded-[20px] border border-[#ececec] bg-[#fafafa] p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-black text-[#111111]">오늘 우선 확인</p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#707072]">
                {briefing}
              </p>
            </div>
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#111111]" />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-[#dedede] bg-white px-3 py-2">
              <p className="text-base font-black text-[#111111]">{items.length}</p>
              <p className="text-[10px] font-semibold text-[#707072]">전체</p>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2">
              <p className="text-base font-black text-amber-700">{urgentCount}</p>
              <p className="text-[10px] font-semibold text-amber-700">긴급</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 px-3 py-2">
              <p className="text-base font-black text-blue-700">{todayCount}</p>
              <p className="text-[10px] font-semibold text-blue-700">오늘</p>
            </div>
          </div>

          <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
            {TODAY_WORK_FILTERS.map((filter) => {
              const count = filter.id === 'all' ? items.length : categoryCounts[filter.id];
              const selected = activeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={cn(
                    'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition',
                    selected
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#dedede] bg-white text-[#707072] hover:border-[#cacacb] hover:text-[#111111]',
                  )}
                >
                  {filter.label}
                  <span className={cn('ml-1', selected ? 'text-white/70' : 'text-[#9e9ea0]')}>{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-[20px] border border-[#ececec] bg-white p-3">
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center rounded-2xl bg-[#fafafa] text-xs font-semibold text-[#707072]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              오늘 할 일을 불러오는 중
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedede] bg-[#fafafa] px-4 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-emerald-500" />
              <p className="text-sm font-black text-[#111111]">
                {activeFilter === 'all' ? '지금 바로 처리할 일이 없습니다.' : '이 분류의 항목이 없습니다.'}
              </p>
              <p className="mt-1 text-xs font-medium leading-5 text-[#707072]">필요한 기능은 아래 바로가기에서 시작하세요.</p>
            </div>
          ) : (
            <div className="max-h-[310px] space-y-2 overflow-y-auto pr-1">
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  className="group grid w-full grid-cols-[auto,1fr,auto] items-center gap-2 rounded-2xl border border-[#ececec] bg-[#fafafa] p-3 text-left transition hover:border-[#cacacb] hover:bg-white"
                >
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border', toneClasses(item.tone))}>
                    {item.icon}
                  </span>
                  <button
                    type="button"
                    onClick={item.onClick}
                    className="min-w-0 text-left"
                  >
                    <span className="min-w-0">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-xs font-black text-[#111111]">{item.title}</span>
                        <Badge variant="outline" className="h-5 shrink-0 rounded-full px-1.5 text-[9px]">
                          {item.label}
                        </Badge>
                      </span>
                      <span className="mt-1 block truncate text-[11px] font-medium text-[#707072]">{item.description}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => dismissItem(item.id)}
                      className="h-7 w-7 rounded-full text-[#9e9ea0] opacity-100 transition hover:bg-white hover:text-[#111111] sm:opacity-0 sm:group-hover:opacity-100"
                      aria-label={`${item.title} 오늘 숨기기`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-[#9e9ea0] transition group-hover:text-[#111111]" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {hiddenCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetDismissedItems}
              className="mt-2 h-8 w-full rounded-full text-xs font-bold text-[#707072] hover:bg-[#fafafa] hover:text-[#111111]"
            >
              오늘 숨긴 항목 {hiddenCount}건 다시 보기
            </Button>
          )}
        </section>

        <section className="rounded-[20px] border border-[#ececec] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-black text-[#111111]">내 바로가기</p>
              <p className="text-[11px] font-semibold text-[#9e9ea0]">자주 쓰는 기능을 햄찌 첫 화면에 고정합니다.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSettingsOpen(true)}
              className="h-8 rounded-full px-2.5 text-xs font-bold"
            >
              <Settings2 className="mr-1.5 h-3.5 w-3.5" />
              설정
            </Button>
          </div>

          {shortcutsLoading ? (
            <div className="flex h-24 items-center justify-center rounded-2xl bg-[#fafafa] text-xs font-semibold text-[#707072]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              바로가기 불러오는 중
            </div>
          ) : (
            <>
              {isLocalFallback && (
                <div className="mb-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11px] font-semibold leading-4 text-amber-700">
                  DB 설정 전까지 이 브라우저의 임시 바로가기를 사용합니다.
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {selectedShortcuts.map((shortcut) => {
                  const ShortcutIcon = shortcut.icon;
                  return (
                    <button
                      key={shortcut.id}
                      type="button"
                      onClick={() => onSelectShortcut(shortcut)}
                      disabled={isTransitioning}
                      className="min-h-[86px] rounded-2xl border border-[#dedede] bg-[#fafafa] p-3 text-left transition hover:border-[#cacacb] hover:bg-white disabled:pointer-events-none disabled:opacity-60"
                    >
                      <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedede] bg-white text-[#111111]">
                        <ShortcutIcon className="h-4 w-4" />
                      </span>
                      <span className="mt-2 block truncate text-xs font-black text-[#111111]">{shortcut.label}</span>
                      <span className="mt-0.5 block line-clamp-2 text-[10px] font-semibold leading-4 text-[#707072]">
                        {shortcut.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      <AssistantShortcutSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
};

const AssistantShortcutSettingsDialog = ({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) => {
  const {
    availableShortcuts,
    shortcutIds,
    roleDefaultIds,
    isLocalFallback,
    saveShortcutOrder,
    resetToRoleDefault,
  } = useAssistantShortcuts();
  const [draftIds, setDraftIds] = useState<string[]>(shortcutIds);
  const [searchKeyword, setSearchKeyword] = useState('');
  const selectedIdSet = useMemo(() => new Set(draftIds), [draftIds]);
  const saving = saveShortcutOrder.isPending || resetToRoleDefault.isPending;
  const normalizedSearchKeyword = searchKeyword.trim().toLowerCase();
  const filteredShortcuts = useMemo(() => {
    if (!normalizedSearchKeyword) return availableShortcuts;
    return availableShortcuts.filter((shortcut) => (
      [
        shortcut.label,
        shortcut.description,
        shortcut.target,
        ...(shortcut.keywords || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearchKeyword)
    ));
  }, [availableShortcuts, normalizedSearchKeyword]);

  useEffect(() => {
    if (open) setDraftIds(shortcutIds);
  }, [open, shortcutIds]);

  const toggleShortcut = (id: string) => {
    setDraftIds((current) => (
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length >= ASSISTANT_SHORTCUT_LIMIT
          ? current
          : [...current, id]
    ));
  };

  const moveShortcut = (id: string, direction: -1 | 1) => {
    setDraftIds((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await saveShortcutOrder.mutateAsync(draftIds);
      onOpenChange(false);
    } catch {
      // Mutation already shows a toast.
    }
  };

  const handleReset = () => {
    setDraftIds(roleDefaultIds);
    resetToRoleDefault.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-[24px] border-[#dedede] bg-white p-0">
        <DialogHeader className="border-b border-[#ececec] px-5 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-base font-black text-[#111111]">햄찌 바로가기 설정</DialogTitle>
              <DialogDescription className="text-xs font-medium leading-5 text-[#707072]">
                자주 쓰는 기능을 선택하고 위아래 버튼으로 첫 화면 순서를 조정하세요.
              </DialogDescription>
            </div>
            <Badge variant="outline" className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold">
              {draftIds.length}/{ASSISTANT_SHORTCUT_LIMIT}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-3 p-4">
          {isLocalFallback && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-xs font-semibold leading-5 text-amber-700">
              Supabase migration 적용 전에는 바로가기 설정이 이 브라우저에만 임시 저장됩니다.
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9e9ea0]" />
            <Input
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="기능 이름, 화면, 키워드 검색"
              className="h-10 rounded-full border-[#dedede] bg-[#fafafa] pl-9 text-sm"
            />
          </div>

          {filteredShortcuts.length === 0 ? (
            <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-[#dedede] bg-[#fafafa] px-4 text-center">
              <Search className="mb-2 h-7 w-7 text-[#9e9ea0]" />
              <p className="text-sm font-black text-[#111111]">검색 결과가 없습니다.</p>
              <p className="mt-1 text-xs font-medium text-[#707072]">다른 키워드로 다시 검색해보세요.</p>
            </div>
          ) : filteredShortcuts.map((shortcut) => {
            const ShortcutIcon = shortcut.icon;
            const selected = selectedIdSet.has(shortcut.id);
            const orderIndex = draftIds.indexOf(shortcut.id);
            const disabledByLimit = !selected && draftIds.length >= ASSISTANT_SHORTCUT_LIMIT;
            return (
              <div
                key={shortcut.id}
                className={cn(
                  'grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-2xl border p-3',
                  selected ? 'border-[#111111] bg-[#fafafa]' : 'border-[#ececec] bg-white',
                )}
              >
                <Checkbox
                  checked={selected}
                  disabled={disabledByLimit}
                  onCheckedChange={() => toggleShortcut(shortcut.id)}
                  aria-label={`${shortcut.label} 바로가기 선택`}
                />
                <button
                  type="button"
                  disabled={disabledByLimit}
                  onClick={() => toggleShortcut(shortcut.id)}
                  className="grid min-w-0 grid-cols-[auto,1fr] items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dedede] bg-white text-[#111111]">
                    <ShortcutIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-black text-[#111111]">{shortcut.label}</span>
                      <Badge variant="outline" className="h-5 shrink-0 rounded-full px-1.5 text-[9px] font-bold">
                        {SHORTCUT_TARGET_LABELS[shortcut.target] || '기능'}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block truncate text-xs font-semibold text-[#707072]">{shortcut.description}</span>
                  </span>
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!selected || orderIndex <= 0}
                    onClick={() => moveShortcut(shortcut.id, -1)}
                    className="h-8 w-8 rounded-full"
                    aria-label={`${shortcut.label} 위로 이동`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={!selected || orderIndex < 0 || orderIndex >= draftIds.length - 1}
                    onClick={() => moveShortcut(shortcut.id, 1)}
                    className="h-8 w-8 rounded-full"
                    aria-label={`${shortcut.label} 아래로 이동`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-[#ececec] p-4 sm:justify-between sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={saving}
            className="rounded-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            기본값 복구
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || draftIds.length === 0}
            className="rounded-full bg-[#111111] text-white hover:bg-[#39393b]"
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AssistantHomePanel;
