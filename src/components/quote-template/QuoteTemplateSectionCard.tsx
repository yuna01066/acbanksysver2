import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, ChevronUp, ChevronDown, Plus, GripVertical } from 'lucide-react';

interface LocalItem {
  id: string;
  name: string;
  description: string;
  unit_price: number;
  quantity: number;
  unit: string;
  display_order: number;
  isNew?: boolean;
}

interface LocalSection {
  id: string;
  section_type: string;
  title: string;
  display_order: number;
  config: Record<string, any>;
  items: LocalItem[];
  isNew?: boolean;
}

interface Props {
  section: LocalSection;
  index: number;
  totalSections: number;
  onUpdate: (updates: Partial<LocalSection>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

const QuoteTemplateSectionCard: React.FC<Props> = ({
  section, index, totalSections, onUpdate, onRemove, onMoveUp, onMoveDown,
}) => {
  const [editingTitle, setEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(section.title);

  const sectionSubtotal = section.items.reduce((sum, i) => sum + i.unit_price * i.quantity, 0);

  const updateItem = (itemIndex: number, updates: Partial<LocalItem>) => {
    const newItems = section.items.map((item, i) =>
      i === itemIndex ? { ...item, ...updates } : item
    );
    onUpdate({ items: newItems });
  };

  const addItem = () => {
    onUpdate({
      items: [
        ...section.items,
        {
          id: crypto.randomUUID(),
          name: '',
          description: '',
          unit_price: 0,
          quantity: 1,
          unit: '일',
          display_order: section.items.length,
          isNew: true,
        },
      ],
    });
  };

  const removeItem = (itemIndex: number) => {
    onUpdate({ items: section.items.filter((_, i) => i !== itemIndex) });
  };

  const saveTitle = () => {
    onUpdate({ title: titleDraft });
    setEditingTitle(false);
  };

  // Divider type - simple line
  if (section.section_type === 'divider') {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="flex-1 border-t border-border" />
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveUp} disabled={index === 0}>
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMoveDown} disabled={index === totalSections - 1}>
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  // Image type
  if (section.section_type === 'image') {
    return (
      <div>
        <SectionHeader
          title={section.title}
          editingTitle={editingTitle}
          titleDraft={titleDraft}
          setEditingTitle={setEditingTitle}
          setTitleDraft={setTitleDraft}
          saveTitle={saveTitle}
          index={index}
          totalSections={totalSections}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
        <div className="border rounded-lg p-8 text-center text-muted-foreground bg-muted/30 mt-2">
          <div className="text-sm">png 또는 jpg 파일 (기본 비율 4:1)</div>
          <div className="text-xs mt-1">또는 드래그앤 드롭으로 파일을 올려주세요.</div>
        </div>
      </div>
    );
  }

  // Info type
  if (section.section_type === 'info') {
    return (
      <div>
        <SectionHeader
          title={section.title}
          editingTitle={editingTitle}
          titleDraft={titleDraft}
          setEditingTitle={setEditingTitle}
          setTitleDraft={setTitleDraft}
          saveTitle={saveTitle}
          index={index}
          totalSections={totalSections}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          onRemove={onRemove}
        />
        <div className="border rounded-lg p-4 mt-2">
          <Input
            placeholder="내용을 입력하세요."
            value={section.config.content || ''}
            onChange={e => onUpdate({ config: { ...section.config, content: e.target.value } })}
            className="text-sm"
          />
        </div>
      </div>
    );
  }

  // Items type (default) and formula
  return (
    <div>
      <SectionHeader
        title={section.title}
        editingTitle={editingTitle}
        titleDraft={titleDraft}
        setEditingTitle={setEditingTitle}
        setTitleDraft={setTitleDraft}
        saveTitle={saveTitle}
        index={index}
        totalSections={totalSections}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
        subtotal={sectionSubtotal}
        isFormula={section.section_type === 'formula'}
      />

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1 bg-foreground text-background text-xs font-medium px-3 py-2 rounded-t mt-2">
        <div className="col-span-3">항목</div>
        <div className="col-span-3">설명</div>
        {section.section_type === 'formula' ? (
          <div className="col-span-6 text-right">금액</div>
        ) : (
          <>
            <div className="col-span-2 text-right">단가</div>
            <div className="col-span-1 text-center">수량</div>
            <div className="col-span-1 text-center">단위</div>
            <div className="col-span-2 text-right">금액</div>
          </>
        )}
      </div>

      {/* Items */}
      {section.items.map((item, itemIndex) => (
        <div key={item.id} className="grid grid-cols-12 gap-1 items-center px-3 py-1.5 border-x border-b text-sm">
          <div className="col-span-3 flex items-center gap-1">
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab shrink-0" />
            <Input
              value={item.name}
              onChange={e => updateItem(itemIndex, { name: e.target.value })}
              placeholder="항목 이름"
              className="h-8 text-sm"
            />
          </div>
          <div className="col-span-3">
            <Input
              value={item.description}
              onChange={e => updateItem(itemIndex, { description: e.target.value })}
              placeholder="설명 없음"
              className="h-8 text-sm text-muted-foreground"
            />
          </div>
          {section.section_type === 'formula' ? (
            <div className="col-span-5 text-right">
              <Input
                type="number"
                value={item.unit_price}
                onChange={e => updateItem(itemIndex, { unit_price: Number(e.target.value) })}
                className="h-8 text-sm text-right"
                placeholder="₩ 0"
              />
            </div>
          ) : (
            <>
              <div className="col-span-2">
                <Input
                  type="number"
                  value={item.unit_price}
                  onChange={e => updateItem(itemIndex, { unit_price: Number(e.target.value) })}
                  className="h-8 text-sm text-right"
                  placeholder="₩ 0"
                />
              </div>
              <div className="col-span-1">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={e => updateItem(itemIndex, { quantity: Number(e.target.value) })}
                  className="h-8 text-sm text-center"
                  min={1}
                />
              </div>
              <div className="col-span-1">
                <Input
                  value={item.unit}
                  onChange={e => updateItem(itemIndex, { unit: e.target.value })}
                  className="h-8 text-sm text-center"
                />
              </div>
              <div className="col-span-1 text-right text-sm font-medium pr-1">
                ₩{(item.unit_price * item.quantity).toLocaleString()}
              </div>
            </>
          )}
          <div className="col-span-1 flex justify-end">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(itemIndex)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}

      {/* Add item */}
      <div className="flex justify-end border-x border-b rounded-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={addItem} className="text-xs gap-1">
          항목 추가하기 <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// Section header sub-component
const SectionHeader: React.FC<{
  title: string;
  editingTitle: boolean;
  titleDraft: string;
  setEditingTitle: (v: boolean) => void;
  setTitleDraft: (v: string) => void;
  saveTitle: () => void;
  index: number;
  totalSections: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  subtotal?: number;
  isFormula?: boolean;
}> = ({
  title, editingTitle, titleDraft, setEditingTitle, setTitleDraft, saveTitle,
  index, totalSections, onMoveUp, onMoveDown, onRemove, subtotal, isFormula,
}) => (
  <div className="flex items-center gap-2">
    <span className="w-1 h-5 bg-foreground rounded-full" />
    {editingTitle ? (
      <Input
        value={titleDraft}
        onChange={e => setTitleDraft(e.target.value)}
        onBlur={saveTitle}
        onKeyDown={e => e.key === 'Enter' && saveTitle()}
        className="h-7 w-40 text-sm font-semibold"
        autoFocus
      />
    ) : (
      <span className="font-semibold text-sm cursor-pointer" onClick={() => { setTitleDraft(title); setEditingTitle(true); }}>
        {title}
      </span>
    )}
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setTitleDraft(title); setEditingTitle(true); }}>
      <Pencil className="h-3 w-3" />
    </Button>
    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={onRemove}>
      <Trash2 className="h-3 w-3" />
    </Button>
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={index === 0}>
      <ChevronUp className="h-3 w-3" />
    </Button>
    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={index === totalSections - 1}>
      <ChevronDown className="h-3 w-3" />
    </Button>
    {subtotal !== undefined && (
      <Badge variant="outline" className="text-xs ml-1">₩{subtotal.toLocaleString()}</Badge>
    )}
    {isFormula && <Badge variant="secondary" className="text-[10px]">수식</Badge>}
  </div>
);

export default QuoteTemplateSectionCard;
