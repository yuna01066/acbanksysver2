import React, { useState, useCallback, useEffect } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { X, Save, Loader2, FileText, Eye, Pencil, FileSignature, DollarSign, ChevronDown, AlertTriangle } from 'lucide-react';
import EditorToolbar from './EditorToolbar';
import PlaceholderSidebar from './PlaceholderSidebar';
import { PREBUILT_TEMPLATES } from './prebuiltTemplates';
import { SAMPLE_DATA } from './placeholderFields';
import type { ContractTemplate } from '@/hooks/useContracts';

interface TemplateEditorDialogProps {
  open: boolean;
  onClose: () => void;
  editingTemplate?: ContractTemplate & { content?: JSONContent | null };
  onSaved: () => void;
}

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [templateType, setTemplateType] = useState('labor');
  const [payDay, setPayDay] = useState(25);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('edit');
  const [showTemplates, setShowTemplates] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    if (editingTemplate) {
      setName(editingTemplate.name);
      setDescription(editingTemplate.description || '');
      setTemplateType(editingTemplate.template_type);
      setPayDay(editingTemplate.pay_day);
      setIsActive(editingTemplate.is_active);
      if (editingTemplate.content && editor) {
        editor.commands.setContent(editingTemplate.content);
      }
    } else {
      setName('');
      setDescription('');
      setTemplateType('labor');
      setPayDay(25);
      setIsActive(true);
      editor?.commands.clearContent();
      setShowTemplates(true);
    }
  }, [open, editingTemplate, editor]);

  const applyPrebuiltTemplate = useCallback((tpl: typeof PREBUILT_TEMPLATES[0]) => {
    if (!editor) return;
    editor.commands.setContent(tpl.content);
    if (!name) setName(tpl.name);
    setTemplateType(tpl.type);
    setShowTemplates(false);
    toast.success(`"${tpl.name}" 템플릿이 적용되었습니다.`);
  }, [editor, name]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error('양식 이름을 입력해주세요.'); return; }
    setSaving(true);
    try {
      const content = editor?.getJSON() || null;
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
          .update(payload as any)
          .eq('id', editingTemplate.id);
        if (error) throw error;
        toast.success('양식이 수정되었습니다.');
      } else {
        const { error } = await supabase
          .from('contract_templates')
          .insert(payload as any);
        if (error) throw error;
        toast.success('양식이 생성되었습니다.');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('저장 실패: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  // Preview: replace placeholders with sample data
  const getPreviewHtml = () => {
    if (!editor) return '';
    let html = editor.getHTML();

    // Replace mention nodes: <span data-type="mention" ... data-id="xxx">@yyy</span>
    html = html.replace(
      /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>[^<]*<\/span>/g,
      (_match, id) => {
        const value = SAMPLE_DATA[id] || id;
        return `<span style="color:#2563eb;font-weight:600;text-decoration:underline">${value}</span>`;
      }
    );

    // Also handle legacy {{placeholder}} format
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      html = html.split(`{{${key}}}`).join(`<span style="color:#2563eb;font-weight:600;text-decoration:underline">${value}</span>`);
    }

    return html;
  };

  // Check if required fields are present
  const hasRequiredFields = () => {
    if (!editor) return { hasDate: false, hasSignature: false };
    const html = editor.getHTML();
    const hasDate = html.includes('data-id="계약일"') || html.includes('{{계약일}}');
    const hasSignature = html.includes('data-id="구성원직인"') || html.includes('{{구성원직인}}') || html.includes('구성원 직인');
    return { hasDate, hasSignature };
  };

  if (!open) return null;

  const { hasDate, hasSignature } = hasRequiredFields();
  const showWarning = activeTab === 'edit' && (!hasDate || !hasSignature);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5 shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
          <span className="font-semibold text-sm">
            {editingTemplate ? '양식 수정' : '서식 추가'}
          </span>
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

        <Button onClick={handleSave} disabled={saving} size="sm" className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          저장하기
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {activeTab === 'edit' ? (
            <>
              {/* Warning banner */}
              {showWarning && (
                <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>법적 효력을 위해 {!hasDate && "'계약일'"}{!hasDate && !hasSignature && '과 '}{!hasSignature && "'구성원 직인'"} 필드를 추가하세요.</span>
                  <button onClick={() => {}} className="ml-auto text-amber-600 hover:text-amber-800">
                    <X className="h-3.5 w-3.5" />
                  </button>
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
                    <SelectTrigger className="w-[140px] h-8 text-xs">
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
                          {tpl.type === 'labor' ? '근로' : '연봉'}
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
      </div>
    </div>
  );
};

export default TemplateEditorDialog;
