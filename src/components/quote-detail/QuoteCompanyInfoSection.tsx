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
      <div className="bg-[hsl(145,45%,92%)] rounded-lg border border-[hsl(145,35%,80%)] p-5 space-y-3">
        <h3 className="text-[17px] font-bold text-black border-b-2 border-[hsl(145,40%,60%)] pb-2">견적서 수신</h3>
        
        <div>
          <h4 className="font-bold text-black mb-2 text-[14px]">프로젝트 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">프로젝트명</span><span className="font-semibold text-black">{quote.project_name || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적번호</span><span className="font-semibold text-black">{quote.quote_number}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">견적일자</span><span className="font-semibold text-black">{quote.quote_date_display ? new Date(quote.quote_date_display).toLocaleDateString('ko-KR') : currentDate}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">유효기간</span><span className="font-semibold text-black">{quote.valid_until || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">납기</span><span className="font-semibold text-black">{quote.delivery_period || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">지불 조건</span><span className="font-semibold text-black">{quote.payment_condition || '-'}</span></div>
          </div>
        </div>

        <div className="pt-2 border-t border-[hsl(145,20%,85%)]">
          <h4 className="font-bold text-black mb-2 text-[14px]">담당자 및 납기 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">회사명</span><span className="font-semibold text-black">{quote.recipient_company || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold text-black">{quote.recipient_name || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">{quote.recipient_phone || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">{quote.recipient_email || '-'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">납기 희망일</span><span className="font-semibold text-black">{quote.desired_delivery_date ? new Date(quote.desired_delivery_date).toLocaleDateString('ko-KR') : '미정'}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">현장 주소</span><span className="font-semibold text-black">{quote.recipient_address || '-'}</span></div>
          </div>
        </div>
      </div>

      {/* 견적서 발신 */}
      <div className="bg-[hsl(215,50%,92%)] rounded-lg border border-[hsl(215,40%,80%)] p-5 space-y-3">
        <h3 className="text-[17px] font-bold text-black border-b-2 border-[hsl(215,45%,60%)] pb-2">견적서 발신</h3>
        
        <div>
          <h4 className="font-bold text-black mb-2 text-[14px]">회사 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">상호</span><span className="font-semibold text-black">{companyInfo.company_name}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">사업자번호</span><span className="font-semibold text-black">{companyInfo.business_number}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">웹사이트</span><span className="font-semibold text-black">{companyInfo.website}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">주소</span><span className="font-semibold text-black leading-relaxed">{companyInfo.address}{companyInfo.detail_address ? `, ${companyInfo.detail_address}` : ''}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">업태</span><span className="font-semibold text-black">{companyInfo.business_type}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">종목</span><span className="font-semibold text-black">{companyInfo.industry}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">{companyInfo.phone}</span></div>
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">{companyInfo.email}</span></div>
          </div>
        </div>

        <div className="pt-2 border-t border-[hsl(215,25%,85%)]">
          <h4 className="font-bold text-black mb-2 text-[14px]">담당자 정보</h4>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex"><span className="text-gray-600 w-20 shrink-0">담당자</span><span className="font-semibold text-black">{recipientData.issuerName || '작성'}</span></div>
            {recipientData.issuerEmail && <div className="flex"><span className="text-gray-600 w-20 shrink-0">이메일</span><span className="font-semibold text-black">{recipientData.issuerEmail}</span></div>}
            {recipientData.issuerPhone && <div className="flex"><span className="text-gray-600 w-20 shrink-0">연락처</span><span className="font-semibold text-black">{recipientData.issuerPhone}</span></div>}
          </div>
        </div>
        
        <div className="mt-3 p-3 bg-[hsl(210,60%,90%)] rounded-lg border border-[hsl(210,50%,78%)]">
          <h4 className="font-bold text-[hsl(215,60%,22%)] mb-1 text-[13px]">입금 계좌</h4>
          <div className="text-[14px] font-bold text-[hsl(215,60%,18%)]">
            {bankInfo}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteCompanyInfoSection;
