import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';

interface Props {
  open: boolean;
  actionType: 'check_in' | 'check_out';
  onConfirm: (memo: string) => void;
  onCancel: () => void;
}

const LocationConfirmDialog: React.FC<Props> = ({ open, actionType, onConfirm, onCancel }) => {
  const [memo, setMemo] = useState('');

  const handleConfirm = () => {
    onConfirm(memo);
    setMemo('');
  };

  const handleCancel = () => {
    onCancel();
    setMemo('');
  };

  const actionLabel = actionType === 'check_in' ? '출근' : '퇴근';

  return (
    <AlertDialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-destructive" />
            근무지 외 {actionLabel} 확인
          </AlertDialogTitle>
          <AlertDialogDescription>
            근무지가 아닌 곳에서 {actionLabel}을 신청하겠습니까?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">사유 입력</Label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder={`근무지 외 ${actionLabel} 사유를 입력하세요`}
              rows={3}
            />
          </div>
        </div>

        <AlertDialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            아니오 (취소)
          </Button>
          <Button onClick={handleConfirm} disabled={!memo.trim()}>
            예 ({actionLabel} 등록)
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default LocationConfirmDialog;
