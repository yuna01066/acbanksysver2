import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { Table as TableExt } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import HorizontalRule from '@tiptap/extension-horizontal-rule';
import Mention from '@tiptap/extension-mention';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  X, Save, Loader2, FileText, Eye, Pencil, FileSignature, DollarSign, ChevronDown,
  AlertTriangle, ShieldCheck, FilePenLine, RotateCcw,
} from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import PlaceholderSidebar from './PlaceholderSidebar';
import { PREBUILT_TEMPLATES } from './prebuiltTemplates';
import { SAMPLE_DATA } from './placeholderFields';
import type { ContractTemplate } from '@/hooks/useContracts';
import { evaluateContractTemplateQuality, getManualContractPlaceholderFields } from '@/utils/contractTemplateQuality';
import { sanitizeHtml } from '@/utils/sanitizeHtml';
import {
  resolveContractTemplateContent,
  type ContractTemplateContentSource,
} from '@/utils/contractTemplateContent';
import {
  buildContractTemplateDraftStorageKey,
  buildContractTemplateEditorSnapshot,
  getContractTemplateDraftIdentity,
  parseContractTemplateRecoveryDraft,
  type ContractTemplateEditorState,
  type ContractTemplateRecoveryDraft,
} from '@/utils/contractTemplateEditorDraft';

interface TemplateEditorDialogProps {
  open: boolean;
  onClose: () => void;
  editingTemplate?: ContractTemplate & { content?: JSONContent | null };
  onSaved: () => void;
}

const getErrorMessage = (error: unknown) => (
  error instanceof Error ? error.message : String(error || '')
);

// Custom TextStyle extension to support fontSize
const CustomTextStyle = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: element => element.style.fontSize || null,
        renderHTML: attributes => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

const TemplateEditorDialog: React.FC<TemplateEditorDialogProps> = ({
  open, onClose, editingTemplate, onSaved,
}) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('labor');
  const [payDay, setPayDay] = useState(25);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [showTemplates, setShowTemplates] = useState(false);
  const [contentSource, setContentSource] = useState<ContractTemplateContentSource>('empty');
  const [fallbackTemplateName, setFallbackTemplateName] = useState('');
  const [reloadDefaultOpen, setReloadDefaultOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<ContractTemplateRecoveryDraft | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [editorRevision, setEditorRevision] = useState(0);
  const initialSnapshotRef = useRef('');
  const isInitializingRef = useRef(false);
  const latestRecoveryPersistenceRef = useRef<{
    hasUnsavedChanges: () => boolean;
    persist: () => boolean;
  }>({ hasUnsavedChanges: () => false, persist: () => false });

  const draftIdentity = getContractTemplateDraftIdentity(editingTemplate?.id);
  const draftStorageKey = useMemo(
    () => buildContractTemplateDraftStorageKey(user?.id, editingTemplate?.id),
    [editingTemplate?.id, user?.id],
  );
  const removeLocalRecoveryDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(draftStorageKey);
    } catch (error) {
      console.warn('Failed to remove contract template recovery draft:', error);
    }
  }, [draftStorageKey]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ horizontalRule: false }),
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TableExt.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Placeholder.configure({ placeholder: '서식의 내용을 입력해 주세요.' }),
      CustomTextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      HorizontalRule,
      Mention.configure({
        HTMLAttributes: {
          class: 'placeholder-mention',
        },
        renderText({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          items: () => [],
          render: () => ({
            onStart: () => {},
            onUpdate: () => {},
            onExit: () => {},
            onKeyDown: () => false,
          }),
        },
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[500px] px-8 py-6',
      },
    },
  });

  const buildCurrentEditorState = useCallback((): ContractTemplateEditorState => ({
    name,
    description,
    templateType,
    payDay,
    isActive,
    contentSource,
    fallbackTemplateName,
    content: editor?.getJSON() || null,
  }), [
    contentSource,
    description,
    editor,
    fallbackTemplateName,
    isActive,
    name,
    payDay,
    templateType,
  ]);

  const persistRecoveryDraft = useCallback(() => {
    if (typeof window === 'undefined' || !editor) return false;
    const payload: ContractTemplateRecoveryDraft = {
      version: 1,
      identity: draftIdentity,
      savedAt: new Date().toISOString(),
      state: buildCurrentEditorState(),
    };
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.warn('Failed to persist contract template recovery draft:', error);
      return false;
    }
  }, [buildCurrentEditorState, draftIdentity, draftStorageKey, editor]);

  const hasUnsavedEditorChanges = useCallback(() => {
    if (!editor) return false;
    return buildContractTemplateEditorSnapshot(buildCurrentEditorState()) !== initialSnapshotRef.current;
  }, [buildCurrentEditorState, editor]);

  // Keep the unmount/SPA-navigation cleanup independent from render timing.
  // The latest callbacks read current React fields and the current Tiptap JSON.
  latestRecoveryPersistenceRef.current = {
    hasUnsavedChanges: hasUnsavedEditorChanges,
    persist: persistRecoveryDraft,
  };

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!saving);
  }, [editor, saving]);

  useEffect(() => {
    if (!open || !editor) return;

    isInitializingRef.current = true;
    const resolvedContent = editingTemplate
      ? resolveContractTemplateContent(editingTemplate)
      : null;
    const initialState = {
      name: editingTemplate?.name || '',
      description: editingTemplate?.description || '',
      templateType: editingTemplate?.template_type || 'labor',
      payDay: editingTemplate?.pay_day ?? 25,
      isActive: editingTemplate?.is_active ?? true,
      contentSource: resolvedContent?.source || 'empty',
      fallbackTemplateName: resolvedContent?.prebuiltTemplateName || '',
    } satisfies Omit<ContractTemplateEditorState, 'content'>;

    setName(initialState.name);
    setDescription(initialState.description);
    setTemplateType(initialState.templateType);
    setPayDay(initialState.payDay);
    setIsActive(initialState.isActive);
    setContentSource(initialState.contentSource);
    setFallbackTemplateName(initialState.fallbackTemplateName);
    setShowTemplates(!editingTemplate);
    setActiveTab('edit');
    setReloadDefaultOpen(false);
    setCloseConfirmOpen(false);

    if (resolvedContent?.content) {
      editor.commands.setContent(resolvedContent.content);
    } else {
      editor.commands.clearContent();
    }

    initialSnapshotRef.current = buildContractTemplateEditorSnapshot({
      ...initialState,
      content: editor.getJSON(),
    });
    setIsDirty(false);

    let rawRecoveryDraft: string | null = null;
    try {
      rawRecoveryDraft = window.localStorage.getItem(draftStorageKey);
    } catch (error) {
      console.warn('Failed to read contract template recovery draft:', error);
    }
    const parsedRecoveryDraft = parseContractTemplateRecoveryDraft(
      rawRecoveryDraft,
      draftIdentity,
    );
    setRecoveryDraft(parsedRecoveryDraft);
    if (rawRecoveryDraft && !parsedRecoveryDraft) {
      removeLocalRecoveryDraft();
    }

    queueMicrotask(() => {
      isInitializingRef.current = false;
    });
  }, [draftIdentity, draftStorageKey, editingTemplate, editor, open, removeLocalRecoveryDraft]);

  useEffect(() => {
    if (!editor) return;
    const handleEditorUpdate = () => {
      if (!isInitializingRef.current) {
        setEditorRevision(revision => revision + 1);
      }
    };
    editor.on('update', handleEditorUpdate);
    return () => {
      editor.off('update', handleEditorUpdate);
    };
  }, [editor]);

  useEffect(() => {
    if (!open || !editor || isInitializingRef.current) return;
    const currentSnapshot = buildContractTemplateEditorSnapshot(buildCurrentEditorState());
    setIsDirty(currentSnapshot !== initialSnapshotRef.current);
  }, [buildCurrentEditorState, editor, editorRevision, open]);

  useEffect(() => {
    if (!open || !editor || !isDirty || recoveryDraft) return;
    const timer = window.setTimeout(persistRecoveryDraft, 400);
    return () => window.clearTimeout(timer);
  }, [editor, editorRevision, isDirty, open, persistRecoveryDraft, recoveryDraft]);

  useEffect(() => {
    if (!open) return;
    return () => {
      const latest = latestRecoveryPersistenceRef.current;
      if (latest.hasUnsavedChanges()) latest.persist();
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isDirty) return;

    const saveOnPageHide = () => persistRecoveryDraft();
    const saveOnVisibilityChange = () => {
      if (document.visibilityState === 'hidden') persistRecoveryDraft();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      persistRecoveryDraft();
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('pagehide', saveOnPageHide);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', saveOnVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', saveOnPageHide);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', saveOnVisibilityChange);
    };
  }, [isDirty, open, persistRecoveryDraft]);

  const requestClose = useCallback(() => {
    if (saving) return;
    if (isDirty) {
      setCloseConfirmOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose, saving]);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape'
        || closeConfirmOpen
        || reloadDefaultOpen
        || Boolean(recoveryDraft)
      ) return;
      event.preventDefault();
      requestClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [closeConfirmOpen, open, recoveryDraft, reloadDefaultOpen, requestClose]);

  const leaveWithRecovery = useCallback(() => {
    if (!persistRecoveryDraft()) {
      toast.error('변경사항을 임시 보관하지 못했습니다. 저장 후 다시 시도해주세요.');
      return;
    }
    setCloseConfirmOpen(false);
    onClose();
  }, [onClose, persistRecoveryDraft]);

  const discardRecoveryDraft = useCallback(() => {
    removeLocalRecoveryDraft();
    setRecoveryDraft(null);
  }, [removeLocalRecoveryDraft]);

  const restoreRecoveryDraft = useCallback(() => {
    if (!editor || !recoveryDraft) return;
    const recovered = recoveryDraft.state;
    isInitializingRef.current = true;
    setName(recovered.name);
    setDescription(recovered.description);
    setTemplateType(recovered.templateType);
    setPayDay(recovered.payDay);
    setIsActive(recovered.isActive);
    setContentSource(recovered.contentSource);
    setFallbackTemplateName(recovered.fallbackTemplateName);
    if (recovered.content) {
      editor.commands.setContent(recovered.content as JSONContent);
    } else {
      editor.commands.clearContent();
    }
    setRecoveryDraft(null);
    setIsDirty(true);
    setEditorRevision(revision => revision + 1);
    queueMicrotask(() => {
      isInitializingRef.current = false;
    });
  }, [editor, recoveryDraft]);

  const applyPrebuiltTemplate = useCallback((tpl: typeof PREBUILT_TEMPLATES[0]) => {
    if (!editor) return;
    editor.commands.setContent(tpl.content);
    if (!name) setName(tpl.name);
    setTemplateType(tpl.type);
    setContentSource('prebuilt_fallback');
    setFallbackTemplateName(tpl.name);
    setShowTemplates(false);
    toast.success(`"${tpl.name}" 템플릿이 적용되었습니다.`);
  }, [editor, name]);

  const reloadDefaultTemplate = useCallback(() => {
    if (!editor) return;
    const resolvedContent = resolveContractTemplateContent({ template_type: templateType, name });
    if (!resolvedContent.content) {
      toast.error('이 유형에 적용할 기본 양식이 없습니다.');
      setReloadDefaultOpen(false);
      return;
    }
    editor.commands.setContent(resolvedContent.content);
    setContentSource('prebuilt_fallback');
    setFallbackTemplateName(resolvedContent.prebuiltTemplateName || '');
    setShowTemplates(false);
    setReloadDefaultOpen(false);
    toast.success('기본 양식을 다시 불러왔습니다.');
  }, [editor, name, templateType]);

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim()) { toast.error('양식 이름을 입력해주세요.'); return; }
    const editorState = buildCurrentEditorState();
    const content = editorState.content as JSONContent | null;
    const quality = evaluateContractTemplateQuality(content, { templateType });
    if (!quality.ok) {
      toast.error(`필수 필드를 추가해주세요: ${quality.missing.join(', ')}`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        template_type: templateType,
        description: description.trim() || null,
        pay_day: payDay,
        is_active: isActive,
        content,
      };

      if (editingTemplate) {
        const { error } = await supabase
          .from('contract_templates')
          .update(payload as never)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('양식이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert(payload as never);
        if (error) throw error;
        toast.success('양식이 생성되었습니다.');
      }
      initialSnapshotRef.current = buildContractTemplateEditorSnapshot(editorState);
      removeLocalRecoveryDraft();
      setRecoveryDraft(null);
      setIsDirty(false);
      onSaved();
      onClose();
    } catch (error: unknown) {
      toast.error('저장 실패: ' + getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const manualPlaceholderFields = useMemo(
    () => getManualContractPlaceholderFields(editor?.getJSON() || null),
    [editor?.state.doc],
  );

  // Preview: replace placeholders with sample data
  const getPreviewHtml = () => {
    if (!editor) return '';
    let html = editor.getHTML();

    // Replace mention nodes: <span data-type="mention" ... data-id="xxx">@yyy</span>
    html = html.replace(
      /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>[^<]*<\/span>/g,
      (_match, id) => {
        const manualField = manualPlaceholderFields.find((field) => field.key === id);
        const value = SAMPLE_DATA[id] || (manualField ? `[직접입력: ${manualField.label}]` : id);
        return `<span style="color:#2563eb;font-weight:600;text-decoration:underline">${value}</span>`;
      }
    );

    // Also handle legacy {{placeholder}} format
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      html = html.split(`{{${key}}}`).join(`<span style="color:#2563eb;font-weight:600;text-decoration:underline">${value}</span>`);
    }
    manualPlaceholderFields.forEach((field) => {
      html = html.split(`{{${field.key}}}`).join(`<span style="color:#7c3aed;font-weight:600;text-decoration:underline">[직접입력: ${field.label}]</span>`);
    });

    return sanitizeHtml(html);
  };

  if (!open) return null;

  const quality = evaluateContractTemplateQuality(editor?.getJSON() || null, { templateType });
  const showWarning = activeTab === 'edit' && !quality.ok;
  const showQualityNotes = activeTab === 'edit' && (quality.missing.length > 0 || quality.warnings.length > 0);
  const showFallbackNotice = Boolean(editingTemplate) && contentSource === 'prebuilt_fallback';
  const sourceLabel = contentSource === 'saved'
    ? '저장된 본문'
    : contentSource === 'prebuilt_fallback'
      ? '기본 양식에서 복구'
      : '본문 없음';

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={requestClose}
            disabled={saving}
            aria-label="계약서 양식 편집기 닫기"
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">
            {editingTemplate ? '양식 수정' : '서식 추가'}
          </span>
          {editingTemplate && (
            <Badge variant="outline" className="text-[11px]">
              {sourceLabel}
            </Badge>
          )}
          {isDirty && (
            <Badge variant="outline" className="border-amber-200 text-[11px] text-amber-700">
              저장되지 않은 변경사항
            </Badge>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="edit" className="text-xs gap-1.5 h-7 px-3">
              <Pencil className="h-3 w-3" /> 서식 편집
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs gap-1.5 h-7 px-3">
              <Eye className="h-3 w-3" /> 미리보기
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          {editingTemplate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full"
              onClick={() => setReloadDefaultOpen(true)}
              disabled={saving}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              기본 양식 다시 불러오기
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setActiveTab('preview')}
            disabled={saving}
          >
            <Eye className="h-3.5 w-3.5" />
            신규 발송 미리보기
          </Button>
          <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            저장하기
          </Button>
        </div>
      </div>

      {/* Body */}
      <fieldset
        disabled={saving}
        aria-busy={saving}
        className="m-0 flex min-w-0 flex-1 overflow-hidden border-0 p-0"
      >
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'edit' ? (
            <>
              {showFallbackNotice && (
                <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span>
                    저장된 본문이 없어 {fallbackTemplateName ? `"${fallbackTemplateName}"` : '기본 양식'}을 불러왔습니다.
                    저장하면 이 내용이 양식에 저장됩니다.
                  </span>
                </div>
              )}

              <div className="mx-6 mt-3 rounded-lg border border-[#e5e5e5] bg-white px-4 py-2.5 text-sm text-[#3f3f46]">
                <div className="flex flex-wrap items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="font-medium text-[#111111]">적용 범위</span>
                  <span>저장 후 신규 발송부터 적용됩니다. 이미 발송·서명된 계약서는 저장된 스냅샷과 PDF가 유지됩니다.</span>
                </div>
              </div>

              {/* Warning banner */}
              {showQualityNotes && (
                <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {showWarning
                      ? `발송 가능한 양식으로 저장하려면 필수 필드를 추가하세요: ${quality.missing.join(', ')}`
                      : quality.warnings.join(' / ')}
                  </span>
                  <button onClick={() => {}} className="ml-auto text-amber-600 hover:text-amber-800">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {manualPlaceholderFields.length > 0 && (
                <div className="mx-6 mt-3 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm text-violet-800">
                  <div className="flex items-start gap-2">
                    <FilePenLine className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="space-y-1">
                      <p className="font-medium">직접 입력 필드 {manualPlaceholderFields.length}개가 있습니다.</p>
                      <p className="text-xs leading-relaxed">
                        {manualPlaceholderFields.map((field) => field.label).join(', ')} 값은 계약 작성 화면에서 직원별로 입력해야 발송할 수 있습니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Meta fields */}
              <div className="border-b px-6 py-3 space-y-3 bg-muted/10 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Input
                      placeholder="서식 이름을 입력하세요"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="text-lg font-semibold border-none shadow-none px-0 h-auto focus-visible:ring-0"
                    />
                  </div>
                  <Select value={templateType} onValueChange={setTemplateType}>
                    <SelectTrigger className="w-[150px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="labor">
                        <span className="flex items-center gap-1.5">
                          <FileSignature className="h-3.5 w-3.5 text-blue-600" /> 근로계약서
                        </span>
                      </SelectItem>
                      <SelectItem value="salary">
                        <span className="flex items-center gap-1.5">
                          <DollarSign className="h-3.5 w-3.5 text-green-600" /> 연봉계약서
                        </span>
                      </SelectItem>
                      <SelectItem value="oath">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5 text-amber-600" /> 서약서
                        </span>
                      </SelectItem>
                      <SelectItem value="privacy">
                        <span className="flex items-center gap-1.5">
                          <FileSignature className="h-3.5 w-3.5 text-purple-600" /> 동의서
                        </span>
                      </SelectItem>
                      <SelectItem value="custom">
                        <span className="flex items-center gap-1.5">
                          <FilePenLine className="h-3.5 w-3.5 text-slate-600" /> 자유양식
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={String(payDay)} onValueChange={v => setPayDay(Number(v))}>
                    <SelectTrigger className="w-[120px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 5, 10, 15, 20, 25].map(d => (
                        <SelectItem key={d} value={String(d)}>급여일 {d}일</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">활성</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>
                <Textarea
                  placeholder="계약서식에 대한 설명을 입력해 주세요."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={1}
                  className="resize-none text-sm border-none shadow-none px-0 focus-visible:ring-0 min-h-0"
                />
              </div>

              {/* Prebuilt templates toggle */}
              <div className="border-b px-6 py-2 shrink-0">
                <button
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setShowTemplates(!showTemplates)}
                >
                  <FileText className="h-3.5 w-3.5" />
                  서식 템플릿
                  <ChevronDown className={`h-3 w-3 transition-transform ${showTemplates ? 'rotate-180' : ''}`} />
                </button>
                {showTemplates && (
                  <div className="mt-2 space-y-1 pb-1">
                    <p className="text-[11px] text-muted-foreground mb-2">
                      템플릿을 선택하고 회사에 맞게 수정해서 사용하세요.
                    </p>
                    {PREBUILT_TEMPLATES.map(tpl => (
                      <button
                        key={tpl.id}
                        className="flex items-center gap-2 w-full px-3 py-2 rounded hover:bg-muted text-left text-sm transition-colors"
                        onClick={() => applyPrebuiltTemplate(tpl)}
                      >
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        {tpl.name}
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {tpl.type === 'labor' ? '근로' : tpl.type === 'salary' ? '연봉' : tpl.type === 'privacy' ? '동의' : '서약'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Editor toolbar */}
              <EditorToolbar editor={editor} />

              {/* Editor body */}
              <ScrollArea className="flex-1">
                <div className="max-w-4xl mx-auto">
                  <EditorContent editor={editor} />
                </div>
              </ScrollArea>
            </>
          ) : (
            /* Preview mode */
            <ScrollArea className="flex-1">
              <div className="max-w-4xl mx-auto px-8 py-6">
                <div className="mb-4 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">미리보기</Badge>
                  <span className="text-xs text-muted-foreground">자동입력 필드가 샘플 데이터로 표시됩니다.</span>
                </div>
                <div
                  className="prose prose-sm max-w-none border rounded-lg p-8 bg-white dark:bg-zinc-950 shadow-sm"
                  dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
                />
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Placeholder sidebar - only show in edit mode */}
        {activeTab === 'edit' && <PlaceholderSidebar editor={editor} />}
      </fieldset>

      <AlertDialog open={reloadDefaultOpen} onOpenChange={setReloadDefaultOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>기본 양식을 다시 불러오시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              현재 편집 중인 본문이 기본 양식 내용으로 교체됩니다. 저장 전 변경 내용은 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={reloadDefaultTemplate}>
              불러오기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(recoveryDraft)} onOpenChange={() => {}}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이전 편집 내용을 복구하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              {recoveryDraft
                ? `${new Date(recoveryDraft.savedAt).toLocaleString('ko-KR')}에 이 브라우저에 임시 보관된 변경사항이 있습니다.`
                : '이 브라우저에 임시 보관된 변경사항이 있습니다.'}
              {' '}복구하지 않으면 현재 저장된 양식으로 편집을 시작합니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardRecoveryDraft}>복구하지 않음</AlertDialogCancel>
            <AlertDialogAction onClick={restoreRecoveryDraft}>복구하기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closeConfirmOpen} onOpenChange={setCloseConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>변경사항을 저장하지 않고 나가시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              저장되지 않은 변경사항은 이 브라우저에 7일간 임시 보관됩니다. 다음에 같은 양식을 열면 복구할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>계속 편집</AlertDialogCancel>
            <AlertDialogAction onClick={leaveWithRecovery}>임시 보관 후 나가기</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TemplateEditorDialog;
