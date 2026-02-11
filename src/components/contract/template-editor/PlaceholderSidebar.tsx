import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronRight, Plus, HelpCircle, X } from 'lucide-react';
import { PLACEHOLDER_GROUPS, INPUT_FIELD_GROUPS } from './placeholderFields';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface PlaceholderSidebarProps {
  editor: Editor | null;
}

const PlaceholderSidebar: React.FC<PlaceholderSidebarProps> = ({ editor }) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [customFields, setCustomFields] = useState<{ id: string; label: string }[]>([]);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customFieldName, setCustomFieldName] = useState('');

  const insertMention = (id: string, label: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent({
      type: 'mention',
      attrs: { id, label },
    }).run();
  };

  const insertFieldGroup = (content: any) => {
    if (!editor) return;
    editor.chain().focus().insertContent(content).run();
  };

  const addCustomField = () => {
    const name = customFieldName.trim();
    if (!name) return;
    const id = `custom_${name}`;
    if (customFields.some(f => f.id === id)) return;
    setCustomFields([...customFields, { id, label: name }]);
    setCustomFieldName('');
    setShowAddCustom(false);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter(f => f.id !== id));
  };

  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  const matchesSearch = (label: string) => !search || label.includes(search);

  return (
    <div className="w-64 border-l bg-muted/20 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="font-semibold text-sm">자동입력 필드</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs max-w-[200px]">
                필드를 클릭하면 커서 위치에 삽입됩니다. 계약서 발행 시 실제 데이터로 자동 치환됩니다.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="검색"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 커스텀 필드 Section */}
        <div className="p-2 border-b">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">커스텀 필드</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-xs max-w-[180px]">
                    사용자 정의 필드를 추가하여 계약서에 삽입할 수 있습니다.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowAddCustom(true)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {/* + 추가 Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs gap-1 mt-1"
            onClick={() => setShowAddCustom(true)}
          >
            <Plus className="h-3 w-3" /> 추가
          </Button>

          {/* Custom field items */}
          {customFields.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {customFields.filter(f => matchesSearch(f.label)).map(field => (
                <div key={field.id} className="flex items-center gap-1 group">
                  <button
                    className="flex-1 text-left px-2.5 py-1.5 rounded text-xs bg-violet-100 text-violet-700 hover:bg-violet-200 dark:bg-violet-900/40 dark:text-violet-300 transition-colors"
                    onClick={() => insertMention(field.id, field.label)}
                  >
                    {field.label}
                  </button>
                  <button
                    onClick={() => removeCustomField(field.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 입력 필드 그룹 Section */}
        <div className="p-2 border-b">
          <button
            className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded"
            onClick={() => toggle('input_groups')}
          >
            {collapsed['input_groups'] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            입력 필드 그룹
          </button>
          {!collapsed['input_groups'] && (
            <div className="ml-2 space-y-0.5 mt-1">
              {INPUT_FIELD_GROUPS.filter(g => matchesSearch(g.label)).map(group => (
                <button
                  key={group.id}
                  className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 transition-colors"
                  onClick={() => insertFieldGroup(group.content)}
                  title={`클릭하여 "${group.label}" 삽입`}
                >
                  {group.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 서식정보 플레이스홀더 Sections */}
        <div className="p-2 space-y-1">
          {PLACEHOLDER_GROUPS.map(group => {
            const filtered = group.fields.filter(f => matchesSearch(f.label));
            if (filtered.length === 0) return null;
            const isCollapsed = collapsed[group.id];
            return (
              <div key={group.id}>
                <button
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded"
                  onClick={() => toggle(group.id)}
                >
                  {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {group.label}
                  <Badge variant="secondary" className="ml-auto text-[10px] h-4 px-1">{filtered.length}</Badge>
                </button>
                {!isCollapsed && (
                  <div className="ml-2 space-y-0.5">
                    {filtered.map(field => (
                      <button
                        key={field.key}
                        className="w-full text-left px-2.5 py-1.5 rounded text-xs bg-muted hover:bg-muted/80 transition-colors"
                        onClick={() => insertMention(field.key, field.label)}
                        title={`클릭하여 "@${field.label}" 삽입`}
                      >
                        {field.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 border-t text-[11px] text-muted-foreground">
        필드를 클릭하면 커서 위치에 삽입됩니다.
      </div>

      {/* Add Custom Field Dialog */}
      <Dialog open={showAddCustom} onOpenChange={setShowAddCustom}>
        <DialogContent className="sm:max-w-[340px]">
          <DialogHeader>
            <DialogTitle className="text-sm">커스텀 필드 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs">필드 이름</Label>
              <Input
                value={customFieldName}
                onChange={e => setCustomFieldName(e.target.value)}
                placeholder="예: 프로젝트명, 계약금액"
                className="text-sm"
                onKeyDown={e => { if (e.key === 'Enter') addCustomField(); }}
              />
            </div>
            <Button className="w-full" size="sm" onClick={addCustomField} disabled={!customFieldName.trim()}>
              추가하기
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlaceholderSidebar;
