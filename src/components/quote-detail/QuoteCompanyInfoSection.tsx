import React from 'react';
import { QuoteRecipient } from "@/contexts/QuoteContext";

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

const QuoteCompanyInfoSection: React.FC<QuoteCompanyInfoSectionProps> = ({
  quote,
  currentDate,
  recipientData,
  companyInfo,
  bankInfo,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6 quote-section">
      {/* 견적서 수신 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-950">견적서 수신</h3>
        
        <div>
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">프로젝트 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">프로젝트명</span><span className="font-semibold text-slate-950">{quote.project_name || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">견적번호</span><span className="font-semibold text-slate-950">{quote.quote_number}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">견적일자</span><span className="font-semibold text-slate-950">{quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">유효기간</span><span className="font-semibold text-slate-950">{quote.valid_until || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">납기</span><span className="font-semibold text-slate-950">{quote.delivery_period || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">지불 조건</span><span className="font-semibold text-slate-950">{quote.payment_condition || '-'}</span></div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">담당자 및 납기 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">회사명</span><span className="font-semibold text-slate-950">{quote.recipient_company || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">담당자</span><span className="font-semibold text-slate-950">{quote.recipient_name || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">연락처</span><span className="font-semibold text-slate-950">{quote.recipient_phone || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">이메일</span><span className="font-semibold text-slate-950">{quote.recipient_email || '-'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">납기 희망일</span><span className="font-semibold text-slate-950">{quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '미정'}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">현장 주소</span><span className="font-semibold text-slate-950">{quote.recipient_address || '-'}</span></div>
          </div>
        </div>
      </div>

      {/* 견적서 발신 */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <h3 className="border-b border-slate-200 pb-2 text-[15px] font-bold text-slate-950">견적서 발신</h3>
        
        <div>
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">회사 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">상호</span><span className="font-semibold text-slate-950">{companyInfo.company_name}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">사업자번호</span><span className="font-semibold text-slate-950">{companyInfo.business_number}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">웹사이트</span><span className="font-semibold text-slate-950">{companyInfo.website}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">주소</span><span className="font-semibold text-slate-950 leading-relaxed">{companyInfo.address}{companyInfo.detail_address ? `, ${companyInfo.detail_address}` : ''}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">업태</span><span className="font-semibold text-slate-950">{companyInfo.business_type}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">종목</span><span className="font-semibold text-slate-950">{companyInfo.industry}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">연락처</span><span className="font-semibold text-slate-950">{companyInfo.phone}</span></div>
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">이메일</span><span className="font-semibold text-slate-950">{companyInfo.email}</span></div>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <h4 className="font-bold text-slate-950 mb-2 text-[14px]">담당자 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-slate-500 w-20 shrink-0">담당자</span><span className="font-semibold text-slate-950">{recipientData.issuerName || '작성'}</span></div>
            {recipientData.issuerEmail && <div className="flex"><span className="text-slate-500 w-20 shrink-0">이메일</span><span className="font-semibold text-slate-950">{recipientData.issuerEmail}</span></div>}
            {recipientData.issuerPhone && <div className="flex"><span className="text-slate-500 w-20 shrink-0">연락처</span><span className="font-semibold text-slate-950">{recipientData.issuerPhone}</span></div>}
          </div>
        </div>
        
        <div className="mt-3 p-3 rounded-lg border border-blue-200 bg-blue-50/50">
          <h4 className="font-bold text-blue-700 mb-1 text-[13px]">입금 계좌</h4>
          <div className="text-[14px] font-bold text-slate-950">
            {bankInfo}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCompanyInfoSection;
