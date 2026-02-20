import React, { useEffect } from 'react';

interface PrintStylesProps {
  quoteNumber: string;
  projectName?: string | null;
  companyName?: string | null;
  isInternal?: boolean;
}

const PrintStyles: React.FC<PrintStylesProps> = ({ quoteNumber, projectName, companyName, isInternal = true }) => {
  // PDF 파일명 설정 + body 클래스로 고객용/내부용 구분
  useEffect(() => {
    const parts = [quoteNumber, projectName, companyName].filter(Boolean);
    const fileName = parts.length > 0 ? parts.join('-') : '견적서';
    const finalFileName = isInternal ? `${fileName}_내부용` : fileName;
    document.title = finalFileName;

    // body에 클래스 추가하여 CSS로 제어
    if (!isInternal) {
      document.body.classList.add('customer-print-mode');
    } else {
      document.body.classList.remove('customer-print-mode');
    }

    return () => {
      document.body.classList.remove('customer-print-mode');
    };
  }, [quoteNumber, projectName, companyName, isInternal]);

  return (
    <>
      <style>{`
        /* 고객용 모드: 화면 + 인쇄 모두에서 내부 전용 섹션 숨김 */
        body.customer-print-mode .customer-internal-only {
          display: none !important;
        }

        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm 20mm 15mm;
            background-color: white;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          html, body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            font-size: 8pt;
            background-color: white !important;
          }
          
          .print-container {
            max-width: none;
            margin: 0;
            padding: 0;
            page-break-after: auto;
            background-color: white !important;
          }
          
          /* 페이지 외부 배경만 흰색으로 */
          .min-h-screen {
            background-color: white !important;
          }
          
          /* 고객용 모드: 인쇄 시 내부 전용 섹션 숨김 (이중 보장) */
          body.customer-print-mode .customer-internal-only {
            display: none !important;
          }
          
          /* 견적 요약 섹션 크기 조정 */
          .print-summary {
            padding: 8px !important;
            margin-bottom: 12px !important;
          }
          
          .print-summary > div {
            padding: 10px !important;
          }
          
          .print-summary h2 {
            font-size: 10pt !important;
            margin-bottom: 6px !important;
            padding-bottom: 4px !important;
          }
          
          .print-summary .grid {
            gap: 6px !important;
            grid-template-columns: repeat(3, 1fr) !important;
          }
          
          .print-summary .bg-gray-50 {
            padding: 6px !important;
          }
          
          .print-summary .text-xs {
            font-size: 6pt !important;
          }
          
          .print-summary .text-sm {
            font-size: 7pt !important;
          }
          
          .print-summary .text-2xl {
            font-size: 12pt !important;
          }
          
          .print-summary .text-base {
            font-size: 8pt !important;
          }
          
          /* 총 견적 금액 섹션 크기 조정 */
          .print-total {
            padding: 8px !important;
            margin-bottom: 12px !important;
          }
          
          .print-total > div {
            padding: 10px !important;
          }
          
          .print-total h2 {
            font-size: 10pt !important;
            margin-bottom: 6px !important;
            padding-bottom: 4px !important;
          }
          
          .print-total .bg-gray-50 {
            padding: 8px !important;
          }
          
          .print-total .text-sm {
            font-size: 7pt !important;
          }
          
          .print-total .text-lg {
            font-size: 9pt !important;
          }
          
          .print-total .text-base {
            font-size: 8pt !important;
          }
          
          .print-total .text-2xl, .print-total .text-xl {
            font-size: 11pt !important;
          }
          
          .print-total .text-xs {
            font-size: 6pt !important;
          }
          
          /* 2열 레이아웃 유지 */
          .grid.grid-cols-1.md\\:grid-cols-2 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 1.5rem !important;
          }
          
          /* 푸터 스타일 */
          .print-footer {
            position: fixed;
            bottom: 10mm;
            left: 15mm;
            right: 15mm;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            border-top: 1px solid #ccc;
            font-size: 8pt;
            color: #666;
            background-color: white !important;
          }
          
          .print-footer::after {
            counter-increment: page;
            content: "Page " counter(page);
          }
        }
      `}</style>
      
      {/* Print Footer */}
      <div className="print-footer hidden print:flex">
        <span>견적번호: {quoteNumber}</span>
        <span>{projectName || '프로젝트명 없음'}</span>
        <span></span>
      </div>
    </>
  );
};

export default PrintStyles;
