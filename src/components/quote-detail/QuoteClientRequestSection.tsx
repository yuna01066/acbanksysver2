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
  if (!recipientMemo && !(attachments && attachments.length > 0)) return null;

  return (
    <div className="mb-6 space-y-5">
      <div className="bg-[hsl(30,50%,92%)] border border-[hsl(30,40%,78%)] rounded-lg p-5 quote-section">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[hsl(30,35%,75%)]">
          <FileText className="w-5 h-5 text-black" />
          <h3 className="text-[17px] font-bold text-black">클라이언트 요청사항</h3>
        </div>
        
        {recipientMemo && (
          <div className="mb-4">
            <h4 className="font-bold text-black mb-2 text-[14px]">요청 내용</h4>
            <p className="text-[13px] text-black whitespace-pre-wrap leading-relaxed bg-white p-3 rounded-lg border border-[hsl(30,25%,88%)]">
              {recipientMemo}
            </p>
          </div>
        )}
        
        {viewMode !== 'customer' && attachments && attachments.length > 0 && (
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
