import React, { useMemo, useState } from 'react';
import type { JSONContent } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Plus, FileText, Pencil, Trash2, Loader2, FileSignature, DollarSign, ShieldCheck, FilePenLine, Search } from 'lucide-react';
import { type ContractTemplate } from '@/hooks/useContracts';
import TemplateEditorDialog from './template-editor/TemplateEditorDialog';
import { evaluateContractTemplateQuality } from '@/utils/contractTemplateQuality';
import { resolveContractTemplateContent } from '@/utils/contractTemplateContent';

type ContractTemplateWithContent = ContractTemplate & { content?: JSONContent | null };

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
);

const TEMPLATE_TYPES: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  labor: {
    label: '근로계약서',
    icon: <FileSignature className="h-5 w-5" />,
    color: 'text-[#111111] bg-white border border-[#e5e5e5]',
  },
  salary: {
    label: '연봉계약서',
    icon: <DollarSign className="h-5 w-5" />,
    color: 'text-[#111111] bg-white border border-[#e5e5e5]',
  },
  oath: {
    label: '서약서',
    icon: <ShieldCheck className="h-5 w-5" />,
    color: 'text-[#111111] bg-white border border-[#e5e5e5]',
  },
  privacy: {
    label: '동의서',
    icon: <FileSignature className="h-5 w-5" />,
    color: 'text-[#111111] bg-white border border-[#e5e5e5]',
  },
  custom: {
    label: '자유양식',
    icon: <FilePenLine className="h-5 w-5" />,
    color: 'text-[#111111] bg-white border border-[#e5e5e5]',
  },
};

const TYPE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'labor', label: '근로' },
  { value: 'salary', label: '연봉' },
  { value: 'oath', label: '서약' },
  { value: 'privacy', label: '개인정보' },
  { value: 'custom', label: '자유양식' },
];

const formatTemplateDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
};

const ContractTemplateSettings: React.FC = () => {
  const { templates, loading, refresh } = useContractTemplatesWithRefresh();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContractTemplateWithContent | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ContractTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return templates.filter((template) => {
      if (typeFilter !== 'all' && template.template_type !== typeFilter) return false;
      if (!query) return true;
      return [
        template.name,
        template.description,
        TEMPLATE_TYPES[template.template_type]?.label,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [searchQuery, templates, typeFilter]);

  const openCreate = () => {
    setEditingTemplate(undefined);
    setEditorOpen(true);
  };

  const openEdit = (t: ContractTemplateWithContent) => {
    setEditingTemplate(t);
    setEditorOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('contract_templates')
        .delete()
        .eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('양식이 삭제되었습니다.');
      setDeleteTarget(null);
      refresh();
    } catch (error: unknown) {
      toast.error('삭제 실패: ' + getErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleActive = async (t: ContractTemplate) => {
    const { error } = await supabase
      .from('contract_templates')
      .update({ is_active: !t.is_active })
      .eq('id', t.id);
    if (error) {
      toast.error('상태 변경 실패');
    } else {
      toast.success(t.is_active ? '비활성화되었습니다.' : '활성화되었습니다.');
      refresh();
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-lg">계약서 양식 관리</h3>
          <p className="text-sm text-muted-foreground">전자계약 양식을 생성하고 관리합니다.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5 rounded-full bg-[#111111] text-white hover:bg-[#2a2a2a]">
          <Plus className="h-4 w-4" /> 새 양식 만들기
        </Button>
      </div>

      <div className="rounded-lg border border-[#e5e5e5] bg-[#fafafa] px-3 py-2 text-sm text-[#707072]">
        기존 발송 계약은 발송 당시 스냅샷과 PDF 기준으로 보존되며, 여기서 양식을 수정해도 기존 계약 내용에는 영향이 없습니다.
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-[#e5e5e5] bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto">
          {TYPE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              type="button"
              variant={typeFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              className={`shrink-0 rounded-full ${typeFilter === filter.value ? 'bg-[#111111] text-white hover:bg-[#2a2a2a]' : ''}`}
              onClick={() => setTypeFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
        <div className="relative w-full lg:w-80">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#707072]" />
          <Input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="양식명, 유형, 설명 검색"
            className="h-9 rounded-full pl-9"
          />
        </div>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#cacacb] bg-white py-12 text-center text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">등록된 계약서 양식이 없습니다.</p>
          <p className="text-xs mt-1">새 양식을 만들어 계약서를 작성해보세요.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#cacacb] bg-white">
          <div className="hidden grid-cols-[minmax(260px,1fr)_120px_110px_140px_90px_120px_120px] gap-3 border-b border-[#cacacb] bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#707072] lg:grid">
            <span>양식명</span>
            <span>유형</span>
            <span>활성</span>
            <span>품질</span>
            <span>급여일</span>
            <span>최근 수정</span>
            <span className="text-right">작업</span>
          </div>
          {filteredTemplates.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-[#707072]">검색 결과가 없습니다.</div>
          ) : filteredTemplates.map(t => {
            const typeInfo = TEMPLATE_TYPES[t.template_type] || TEMPLATE_TYPES.labor;
            const resolvedContent = resolveContractTemplateContent(t);
            const quality = evaluateContractTemplateQuality(resolvedContent.content, { templateType: t.template_type });
            return (
              <div key={t.id} className={`grid gap-3 border-b border-[#e5e5e5] px-4 py-3 last:border-0 lg:grid-cols-[minmax(260px,1fr)_120px_110px_140px_90px_120px_120px] lg:items-center ${!t.is_active ? 'bg-[#fafafa] opacity-70' : 'bg-white'}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${typeInfo.color}`}>
                      {typeInfo.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      {t.description && <p className="mt-1 truncate text-xs text-muted-foreground">{t.description}</p>}
                    </div>
                  </div>
                  {!quality.ok && <p className="mt-2 text-xs text-red-700">누락: {quality.missing.join(', ')}</p>}
                  {quality.warnings.length > 0 && <p className="mt-1 text-xs text-amber-700">확인: {quality.warnings.join(' / ')}</p>}
                </div>
                <Badge variant="outline" className="w-fit rounded-full text-xs">{typeInfo.label}</Badge>
                <div className="flex items-center gap-2">
                  <Switch checked={t.is_active} onCheckedChange={() => handleToggleActive(t)} />
                  <span className="text-xs text-[#707072]">{t.is_active ? '활성' : '비활성'}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge
                    variant="outline"
                    className={`rounded-full text-[11px] ${
                      resolvedContent.source === 'saved'
                        ? 'border-slate-200 text-slate-700'
                        : resolvedContent.source === 'prebuilt_fallback'
                          ? 'border-blue-200 text-blue-700'
                          : 'border-red-200 text-red-700'
                    }`}
                  >
                    {resolvedContent.source === 'saved'
                      ? '저장된 본문'
                      : resolvedContent.source === 'prebuilt_fallback'
                        ? '기본 양식 사용 중'
                        : '본문 없음'}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`rounded-full text-[11px] ${quality.ok ? 'border-emerald-200 text-emerald-700' : 'border-red-200 text-red-700'}`}
                  >
                    {quality.ok ? '필수필드 충족' : '필수필드 부족'}
                  </Badge>
                  {quality.warnings.length > 0 && (
                    <Badge variant="outline" className="rounded-full border-amber-200 text-[11px] text-amber-700">
                      검토 필요
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-[#707072]">{t.pay_day}일</span>
                <span className="text-sm text-[#707072]">{formatTemplateDate(t.updated_at || t.created_at)}</span>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => openEdit(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-destructive" onClick={() => setDeleteTarget(t)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Template Editor */}
      <TemplateEditorDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editingTemplate={editingTemplate}
        onSaved={refresh}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>양식을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" 양식이 영구적으로 삭제됩니다. 이 양식으로 생성된 기존 계약서에는 영향을 주지 않습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Extended hook that includes refresh and returns all templates (not just active)
function useContractTemplatesWithRefresh() {
  const [templates, setTemplates] = React.useState<ContractTemplateWithContent[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetch = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contract_templates')
      .select('*')
      .order('created_at');
    if (data) setTemplates(data as ContractTemplateWithContent[]);
    setLoading(false);
  }, []);

  React.useEffect(() => { fetch(); }, [fetch]);

  return { templates, loading, refresh: fetch };
}

export default ContractTemplateSettings;
