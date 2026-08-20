
import React from 'react';
import HomeLogoButton from "@/components/HomeLogoButton";
import EmbedCodeGenerator from "@/components/EmbedCodeGenerator";

const EmbedCodePage = () => {
  return (
    <div className="min-h-screen bg-gray-50 p-2">
      <div className="w-full max-w-5xl mx-auto">
        <div className="mb-4">
          <HomeLogoButton />
        </div>
        
        <EmbedCodeGenerator />

        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm font-medium">버튼형 판재 단가 계산기 위젯</p>
          <p className="mt-1 text-xs text-gray-600">
            버튼 클릭 시 계산기를 띄우는 방식의 임베드 예시·설정 값·주의사항 문서입니다.
          </p>
          <a
            href="/calculator-widget-docs"
            className="mt-2 inline-flex text-sm font-semibold text-blue-700 underline"
          >
            사용 방법 문서 보기 →
          </a>
        </div>
      </div>
    </div>

  );
};

export default EmbedCodePage;
