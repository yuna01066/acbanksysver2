import React from 'react';
import businessRegistration from "@/assets/arcbank-business-registration.jpg";
import bankAccount from "@/assets/arcbank-bank-account.jpg";

const QuoteDocumentsSection: React.FC = () => {
  return (
    <div className="mb-6 quote-section">
      <h3 className="text-[17px] font-bold mb-4 text-black">첨부 서류</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-bold text-black mb-3 text-center text-[13px]">사업자등록증</h4>
          <div className="flex justify-center">
            <img 
              src={businessRegistration} 
              alt="아크뱅크 사업자등록증" 
              className="w-full max-w-[380px] h-auto border border-gray-200 rounded"
              style={{ aspectRatio: '148/210' }}
            />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-bold text-black mb-3 text-center text-[13px]">통장사본</h4>
          <div className="flex justify-center">
            <img 
              src={bankAccount} 
              alt="아크뱅크 통장사본" 
              className="w-full max-w-[380px] h-auto border border-gray-200 rounded"
              style={{ aspectRatio: '148/210' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuoteDocumentsSection;
