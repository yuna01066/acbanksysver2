import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Trash2 } from 'lucide-react';
import type { CutItem } from '@/hooks/useYieldCalculator';

interface Preset {
  id: string;
  name: string;
  cut_items: any;
  created_at: string;
}

interface SavePresetDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export const SavePresetDialog: React.FC<SavePresetDialogProps> = ({ open, onClose, onSave }) => {
  const [name, setName] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    setName('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>프리셋 저장</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Label>프리셋 이름</Label>
          <Input placeholder="예: 300x200 기본 세트" value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={!name.trim()}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface LoadPresetDialogProps {
  open: boolean;
  onClose: () => void;
  presets: Preset[];
  onLoad: (cutItems: CutItem[]) => void;
  onDelete: (id: string) => void;
}

export const LoadPresetDialog: React.FC<LoadPresetDialogProps> = ({ open, onClose, presets, onLoad, onDelete }) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>프리셋 불러오기</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {presets.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">저장된 프리셋이 없습니다.</p>
          ) : (
            presets.map(preset => {
              const items = preset.cut_items as CutItem[];
              const summary = items.map((it, i) => `${it.width}×${it.height} (${it.quantity}개)`).join(', ');
              return (
                <div key={preset.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                  <button className="flex-1 text-left" onClick={() => { onLoad(items); onClose(); }}>
                    <div className="font-medium text-sm">{preset.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{summary}</div>
                  </button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(preset.id)} className="p-1 h-8 w-8 text-destructive hover:text-destructive shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
