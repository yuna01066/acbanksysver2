import React from 'react';
import { FileText } from "lucide-react";
import QuoteAttachments from "@/components/QuoteAttachments";

interface QuoteClientRequestSectionProps {
  recipientMemo: string | null;
  attachments: any[];
  viewMode: 'internal' | 'customer';
  quoteId?: string;
}

const QuoteClientRequestSection: React.FC<QuoteClientRequestSectionProps> = ({
  recipientMemo,
  attachments,
  viewMode,
  quoteId,
}) => {
  const showAttachments = viewMode !== 'customer' && attachments && attachments.length > 0;

  if (!recipientMemo && !showAttachments) return null;

  return (
    <div className="mb-6 space-y-5">
      <div className="bg-white border border-slate-200 rounded-lg p-5 quote-section">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="text-[15px] font-bold text-slate-950">클라이언트 요청사항</h3>
        </div>
        
        {recipientMemo && (
          <div className="mb-4">
            <h4 className="font-bold text-slate-950 mb-2 text-[14px]">요청 내용</h4>
            <p className="text-[13px] text-slate-800 whitespace-pre-wrap leading-relaxed bg-slate-50/70 p-3 rounded-lg border border-slate-200">
              {recipientMemo}
            </p>
          </div>
        )}
        
        {showAttachments && (
          <QuoteAttachments
            attachments={attachments}
            onAttachmentsChange={() => {}}
            readOnly={true}
            quoteId={quoteId}
          />
        )}
      </div>
    </div>
  );
};

export default QuoteClientRequestSection;
