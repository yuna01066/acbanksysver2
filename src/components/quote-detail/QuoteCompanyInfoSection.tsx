import React, { ReactNode } from 'react';
import { QuoteRecipient } from "@/contexts/QuoteContext";
import { formatQuoteProjectTitle } from '@/utils/quoteNaming';

interface CompanyInfo {
  company_name: string;
  business_number: string;
  website: string;
  address: string;
  detail_address: string;
  business_type: string;
  industry: string;
  phone: string;
  email: string;
}

interface QuoteCompanyInfoSectionProps {
  quote: {
    project_name: string | null;
    quote_number: string;
    quote_date_display: string | null;
    valid_until: string | null;
    delivery_period: string | null;
    payment_condition: string | null;
    recipient_company: string | null;
    recipient_name: string | null;
    recipient_phone: string | null;
    recipient_email: string | null;
    recipient_address: string | null;
    desired_delivery_date: string | null;
  };
  currentDate: string;
  recipientData: QuoteRecipient;
  companyInfo: CompanyInfo;
  bankInfo: string;
}

interface InfoRowProps {
  label: string;
  children: ReactNode;
  relaxed?: boolean;
}

const InfoRow = ({ label, children, relaxed = false }: InfoRowProps) => (
  <div className="flex gap-3">
    <span className="w-20 shrink-0 font-semibold text-slate-500">{label}</span>
    <span className={`font-normal text-slate-800 ${relaxed ? 'leading-relaxed' : ''}`}>
      {children}
    </span>
  </div>
);

const QuoteCompanyInfoSection: React.FC<QuoteCompanyInfoSectionProps> = ({
  quote,
  currentDate,
  recipientData,
  companyInfo,
  bankInfo,
}) => {
  const quoteProjectTitle = formatQuoteProjectTitle({
    projectName: quote.project_name,
    companyName: quote.recipient_company,
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 quote-section">
      {/* 견적서 수신 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-950">견적서 수신</h3>
        
        <div>
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">프로젝트 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <InfoRow label="프로젝트명" relaxed>{quoteProjectTitle || '-'}</InfoRow>
            <InfoRow label="견적번호">{quote.quote_number}</InfoRow>
            <InfoRow label="견적일자">{quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</InfoRow>
            <InfoRow label="유효기간">{quote.valid_until || '-'}</InfoRow>
            <InfoRow label="납기">{quote.delivery_period || '-'}</InfoRow>
            <InfoRow label="지불 조건">{quote.payment_condition || '-'}</InfoRow>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">담당자 및 납기 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <InfoRow label="회사명">{quote.recipient_company || '-'}</InfoRow>
            <InfoRow label="담당자">{quote.recipient_name || '-'}</InfoRow>
            <InfoRow label="연락처">{quote.recipient_phone || '-'}</InfoRow>
            <InfoRow label="이메일">{quote.recipient_email || '-'}</InfoRow>
            <InfoRow label="납기 희망일">{quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '미정'}</InfoRow>
            <InfoRow label="현장 주소" relaxed>{quote.recipient_address || '-'}</InfoRow>
          </div>
        </div>
      </div>

      {/* 견적서 발신 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-950">견적서 발신</h3>
        
        <div>
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">회사 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <InfoRow label="상호">{companyInfo.company_name}</InfoRow>
            <InfoRow label="사업자번호">{companyInfo.business_number}</InfoRow>
            <InfoRow label="웹사이트">{companyInfo.website}</InfoRow>
            <InfoRow label="주소" relaxed>{companyInfo.address}{companyInfo.detail_address ? `, ${companyInfo.detail_address}` : ''}</InfoRow>
            <InfoRow label="업태">{companyInfo.business_type}</InfoRow>
            <InfoRow label="종목">{companyInfo.industry}</InfoRow>
            <InfoRow label="연락처">{companyInfo.phone}</InfoRow>
            <InfoRow label="이메일">{companyInfo.email}</InfoRow>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">담당자 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <InfoRow label="담당자">{recipientData.issuerName || '작성'}</InfoRow>
            {recipientData.issuerEmail && <InfoRow label="이메일">{recipientData.issuerEmail}</InfoRow>}
            {recipientData.issuerPhone && <InfoRow label="연락처">{recipientData.issuerPhone}</InfoRow>}
          </div>
        </div>
        
        <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <h4 className="font-bold text-blue-700 mb-1 text-[13px]">입금 계좌</h4>
          <div className="text-[14px] font-normal text-slate-800">
            {bankInfo}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCompanyInfoSection;
