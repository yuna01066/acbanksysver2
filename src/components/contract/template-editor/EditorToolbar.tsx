import React, { useState } from 'react';
import { Editor } from '@tiptap/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Indent, Outdent,
  Minus, Table, Type,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor | null;
}

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32];

const COLORS = [
  '#000000', '#374151', '#6b7280', '#ef4444', '#f97316', '#eab308',
  '#22c55e', '#3b82f6', '#6366f1', '#a855f7', '#ec4899', '#14b8a6',
];

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor }) => {
  if (!editor) return null;

  const ToolBtn = ({ active, onClick, children, title }: { active?: boolean; onClick: () => void; children: React.ReactNode; title: string }) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', active && 'bg-muted')}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );

  const currentFontSize = (() => {
    const attrs = editor.getAttributes('textStyle');
    if (attrs.fontSize) return parseInt(attrs.fontSize);
    return 14;
  })();

  return (
    <div className="flex items-center gap-0.5 flex-wrap border-b px-2 py-1.5 bg-muted/30">
      <ToolBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="굵게">
        <Bold className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="기울임">
        <Italic className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="밑줄">
        <Underline className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="취소선">
        <Strikethrough className="h-4 w-4" />
      </ToolBtn>

      <Separator orientation="vertical" className="h-6 mx-1" />

      {/* Font Color */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="글자 색상">
            <div className="flex flex-col items-center">
              <Type className="h-3.5 w-3.5" />
              <div
                className="h-1 w-4 rounded-sm mt-0.5"
                style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000' }}
              />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-6 gap-1">
            {COLORS.map(color => (
              <button
                key={color}
                className="h-6 w-6 rounded border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => editor.chain().focus().setColor(color).run()}
                title={color}
              />
            ))}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-1.5 h-6 text-[10px]"
            onClick={() => editor.chain().focus().unsetColor().run()}
          >
            색상 초기화
          </Button>
        </PopoverContent>
      </Popover>

      {/* Font Size */}
      <select
        className="h-8 rounded border border-input bg-background px-2 text-xs w-16"
        value={currentFontSize}
        onChange={(e) => {
          const size = e.target.value;
          editor.chain().focus().setMark('textStyle', { fontSize: `${size}px` }).run();
        }}
      >
        {FONT_SIZES.map(s => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolBtn active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()} title="왼쪽 정렬">
        <AlignLeft className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()} title="가운데 정렬">
        <AlignCenter className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()} title="오른쪽 정렬">
        <AlignRight className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()} title="양쪽 정렬">
        <AlignJustify className="h-4 w-4" />
      </ToolBtn>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="글머리 기호 목록">
        <List className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="번호 목록">
        <ListOrdered className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().sinkListItem('listItem').run()} title="들여쓰기">
        <Indent className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().liftListItem('listItem').run()} title="내어쓰기">
        <Outdent className="h-4 w-4" />
      </ToolBtn>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <ToolBtn
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        title="표 삽입"
      >
        <Table className="h-4 w-4" />
      </ToolBtn>
      <ToolBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">
        <Minus className="h-4 w-4" />
      </ToolBtn>

      <Separator orientation="vertical" className="h-6 mx-1" />

      <select
        className="h-8 rounded border border-input bg-background px-2 text-xs"
        value={
          editor.isActive('heading', { level: 1 }) ? '1' :
          editor.isActive('heading', { level: 2 }) ? '2' :
          editor.isActive('heading', { level: 3 }) ? '3' : '0'
        }
        onChange={(e) => {
          const val = Number(e.target.value);
          if (val === 0) editor.chain().focus().setParagraph().run();
          else editor.chain().focus().toggleHeading({ level: val as 1 | 2 | 3 }).run();
        }}
      >
        <option value="0">본문</option>
        <option value="1">제목 1</option>
        <option value="2">제목 2</option>
        <option value="3">제목 3</option>
      </select>
    </div>
  );
};

export default EditorToolbar;
