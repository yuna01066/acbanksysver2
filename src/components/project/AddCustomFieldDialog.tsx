import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface CustomField {
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'tags' | 'single_select' | 'multi_select';
  value: string | number | boolean | string[];
  options?: string[];
  filterable?: boolean;
}

const FIELD_TYPES = [
  { value: 'text', label: '텍스트 (String)' },
  { value: 'number', label: '숫자 (Number)' },
  { value: 'date', label: '날짜 (Date)' },
  { value: 'boolean', label: '토글 (Boolean)' },
  { value: 'tags', label: '태그 리스트 (Tags)' },
  { value: 'single_select', label: '단수선택 (Single Select)' },
  { value: 'multi_select', label: '복수선택 (Multi Select)' },
] as const;

const FILTERABLE_TYPES: CustomField['type'][] = ['boolean', 'date', 'single_select', 'multi_select'];

export const defaultValue = (type: CustomField['type']): CustomField['value'] => {
  switch (type) {
    case 'text': return '';
    case 'number': return 0;
    case 'date': return '';
    case 'boolean': return false;
    case 'tags': return [];
    case 'single_select': return '';
    case 'multi_select': return [];
  }
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (field: CustomField) => void;
}

export const AddCustomFieldDialog: React.FC<Props> = ({ open, onOpenChange, onAdd }) => {
  const [fieldType, setFieldType] = useState<CustomField['type'] | ''>('');
  const [fieldLabel, setFieldLabel] = useState('');
  const [filterable, setFilterable] = useState(false);
  const [selectOptions, setSelectOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');

  const isSelectType = fieldType === 'single_select' || fieldType === 'multi_select';
  const canFilter = fieldType && FILTERABLE_TYPES.includes(fieldType as CustomField['type']);

  const handleAdd = () => {
    if (!fieldType || !fieldLabel.trim()) return;
    if (isSelectType && selectOptions.length < 2) return;
    onAdd({
      label: fieldLabel.trim(),
      type: fieldType as CustomField['type'],
      value: defaultValue(fieldType as CustomField['type']),
      ...(isSelectType ? { options: selectOptions } : {}),
      ...(filterable ? { filterable: true } : {}),
    });
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setFieldType('');
    setFieldLabel('');
    setFilterable(false);
    setSelectOptions([]);
    setOptionInput('');
  };

  const addOption = () => {
    const val = optionInput.trim();
    if (val && !selectOptions.includes(val)) {
      setSelectOptions([...selectOptions, val]);
      setOptionInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base">커스텀 필드 추가</DialogTitle>
          <p className="text-sm text-muted-foreground">추가할 필드 정보를 입력하세요.</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 타입 <span className="text-destructive">*</span></Label>
            <Select value={fieldType} onValueChange={(v) => { setFieldType(v as CustomField['type']); setFilterable(false); setSelectOptions([]); }}>
              <SelectTrigger><SelectValue placeholder="입력할 정보타입을 선택하세요." /></SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">필드 이름 <span className="text-destructive">*</span></Label>
            <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="필드 이름을 입력하세요."
              onKeyDown={(e) => { if (e.key === 'Enter' && !isSelectType) handleAdd(); }} />
          </div>

          {/* Select Options */}
          {isSelectType && (
            <div className="space-y-1.5">
              <Label className="text-xs">선택 항목 <span className="text-destructive">*</span> <span className="text-muted-foreground">(최소 2개)</span></Label>
              <div className="flex flex-wrap gap-1 min-h-[24px]">
                {selectOptions.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-[11px] gap-0.5 pr-0.5 h-5">
                    {opt}
                    <button onClick={() => setSelectOptions(selectOptions.filter((_, idx) => idx !== i))} className="ml-0.5 hover:bg-muted rounded-full p-0.5">
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input value={optionInput} onChange={(e) => setOptionInput(e.target.value)} placeholder="항목 입력 후 Enter"
                  className="text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={!optionInput.trim()}>추가</Button>
              </div>
            </div>
          )}

          {/* Filterable */}
          {canFilter && (
            <div className="flex items-center gap-2">
              <Checkbox id="filterable" checked={filterable} onCheckedChange={(v) => setFilterable(!!v)} />
              <Label htmlFor="filterable" className="text-xs cursor-pointer">필터 사용하기</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    토글, 날짜, 단수선택, 복수선택은 필터 사용이 가능해요.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          <Button className="w-full" onClick={handleAdd}
            disabled={!fieldType || !fieldLabel.trim() || (isSelectType && selectOptions.length < 2)}>
            추가하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
