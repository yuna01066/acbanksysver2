import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface CustomField {
  label: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'tags';
  value: string | number | boolean | string[];
}

const FIELD_TYPES = [
  { value: 'text', label: '텍스트 (String)' },
  { value: 'number', label: '숫자 (Number)' },
  { value: 'date', label: '날짜 (Date)' },
  { value: 'boolean', label: '토글 (Boolean)' },
  { value: 'tags', label: '태그 리스트 (Tags)' },
] as const;

const defaultValue = (type: CustomField['type']): CustomField['value'] => {
  switch (type) {
    case 'text': return '';
    case 'number': return 0;
    case 'date': return '';
    case 'boolean': return false;
    case 'tags': return [];
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

  const handleAdd = () => {
    if (!fieldType || !fieldLabel.trim()) return;
    onAdd({ label: fieldLabel.trim(), type: fieldType, value: defaultValue(fieldType) });
    setFieldType('');
    setFieldLabel('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="text-base">커스텀 필드 추가</DialogTitle>
          <p className="text-sm text-muted-foreground">추가할 필드 정보를 입력하세요.</p>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-xs">데이터 타입 <span className="text-destructive">*</span></Label>
            <Select value={fieldType} onValueChange={(v) => setFieldType(v as CustomField['type'])}>
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
            <Input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="필드 이름을 입력하세요.."
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
          </div>
          <Button className="w-full" onClick={handleAdd} disabled={!fieldType || !fieldLabel.trim()}>추가하기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
