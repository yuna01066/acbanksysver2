import React from 'react';
import { QuoteRecipient } from "@/contexts/QuoteContext";

interface QuoteContactSectionProps {
  contactMessage: string;
  contactPhone: string;
  contactEmail: string;
  recipientData: QuoteRecipient;
}

const QuoteContactSection: React.FC<QuoteContactSectionProps> = ({
  contactMessage,
  contactPhone,
  contactEmail,
  recipientData,
}) => {
  return (
    <div className="mb-6 p-5 bg-white border border-slate-200 rounded-lg quote-section">
      <h4 className="font-bold text-slate-950 mb-3 text-[14px]">문의 및 주문</h4>
      <div className="text-[13px] space-y-2">
        <p className="text-slate-800">{contactMessage}</p>
        
        {recipientData.issuerName && (
          <div className="bg-slate-50/70 p-3 rounded-lg border border-slate-200">
            <p className="font-bold text-slate-500 mb-1.5 text-[12px] uppercase tracking-wider">담당자</p>
            <div className="space-y-1 text-[13px] font-semibold text-slate-950">
              <p>👤 {recipientData.issuerName}</p>
              {recipientData.issuerPhone && <p>📞 {recipientData.issuerPhone}</p>}
              {recipientData.issuerEmail && <p>📧 {recipientData.issuerEmail}</p>}
            </div>
          </div>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <p className="font-semibold bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-200 text-slate-950 text-[13px]">📞 대표전화: {contactPhone}</p>
          <p className="font-semibold bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-200 text-slate-950 text-[13px]">📧 대표이메일: {contactEmail}</p>
        </div>
      </div>
    </div>
  );
};

export default QuoteContactSection;
