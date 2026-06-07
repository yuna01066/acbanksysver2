import React, { useEffect } from 'react';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PayStatement } from '@/hooks/useHrSelfService';
import PayStatementPreview from '@/components/payroll/PayStatementPreview';

interface MyPayStatementDetailDialogProps {
  statement: PayStatement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordEvent?: (statementId: string, eventType: 'viewed' | 'downloaded') => void;
}

const MyPayStatementDetailDialog: React.FC<MyPayStatementDetailDialogProps> = ({
  statement,
  open,
  onOpenChange,
  onRecordEvent,
}) => {
  useEffect(() => {
    if (open && statement) {
      onRecordEvent?.(statement.id, 'viewed');
    }
  }, [open, statement, onRecordEvent]);

  const handlePrint = () => {
    if (statement) onRecordEvent?.(statement.id, 'downloaded');
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-white p-0">
        <DialogHeader className="sticky top-0 z-10 border-b bg-white px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DialogTitle>급여명세 상세</DialogTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
              <Printer className="h-4 w-4" />
              PDF/인쇄
            </Button>
          </div>
        </DialogHeader>
        <div className="p-5">
          {statement && <PayStatementPreview statement={statement} />}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MyPayStatementDetailDialog;
