import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { PLACEHOLDER_GROUPS } from './placeholderFields';
import { cn } from '@/lib/utils';

interface PlaceholderSidebarProps {
  editor: Editor | null;
}

const GROUP_COLORS: Record<string, string> = {
  company: 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300',
  employee: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300',
  salary: 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300',
  contract: 'bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/40 dark:text-purple-300',
};

const PlaceholderSidebar: React.FC<PlaceholderSidebarProps> = ({ editor }) => {
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const insertPlaceholder = (key: string) => {
    if (!editor) return;
    editor.chain().focus().insertContent(key).run();
  };

  const toggle = (id: string) => setCollapsed(c => ({ ...c, [id]: !c[id] }));

  return (
    <div className="w-64 border-l bg-muted/20 flex flex-col h-full overflow-hidden">
      <div className="p-3 border-b">
        <h3 className="font-semibold text-sm mb-2">자동입력 필드</h3>
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
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {PLACEHOLDER_GROUPS.map(group => {
          const filtered = group.fields.filter(f => f.label.includes(search) || f.key.includes(search));
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
                      className={cn(
                        'w-full text-left px-2.5 py-1.5 rounded text-xs transition-colors cursor-pointer',
                        GROUP_COLORS[group.id] || 'bg-muted hover:bg-muted/80'
                      )}
                      onClick={() => insertPlaceholder(field.key)}
                      title={`클릭하여 "${field.key}" 삽입`}
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
      <div className="p-3 border-t text-[11px] text-muted-foreground">
        필드를 클릭하면 커서 위치에 삽입됩니다.
      </div>
    </div>
  );
};

export default PlaceholderSidebar;
