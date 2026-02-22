import React, { useEffect } from 'react';

interface PrintStylesProps {
  quoteNumber: string;
  projectName?: string | null;
  companyName?: string | null;
  isInternal?: boolean;
}

const PrintStyles: React.FC<PrintStylesProps> = ({ quoteNumber, projectName, companyName, isInternal = true }) => {
  useEffect(() => {
    const parts = [quoteNumber, projectName, companyName].filter(Boolean);
    const fileName = parts.length > 0 ? parts.join('-') : '견적서';
    const finalFileName = isInternal ? `${fileName}_내부용` : fileName;
    document.title = finalFileName;
  }, [quoteNumber, projectName, companyName, isInternal]);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm 15mm 15mm;
          }

          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            box-sizing: border-box !important;
          }

          html, body {
            margin: 0 !important;
            padding: 0 !important;
            font-size: 8pt !important;
            background: white !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* 화면 레이아웃 요소 숨기기 */
          .print\\:hidden,
          [class*="print:hidden"] {
            display: none !important;
          }

          /* 최상위 래퍼: block 레이아웃으로 변환 */
          .print-layout-wrapper {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
            min-height: auto !important;
          }

          /* flex 컨테이너를 block으로 */
          .print-flex-container {
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
            gap: 0 !important;
          }

          /* 우측 사이드 패널 숨기기 */
          .print-flex-container > div:last-child {
            display: none !important;
          }

          /* 메인 콘텐츠 컨테이너 */
          .print-container {
            display: block !important;
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            flex: none !important;
          }

          /* glass-card 인쇄 시 불투명 배경으로 변환 */
          .glass-card {
            background: white !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-color: #e5e7eb !important;
            overflow: visible !important;
          }

          /* Card shadow/border 제거 및 overflow 허용 */
          .print-container .shadow-lg,
          .print-container .shadow-sm,
          .print-container .shadow-md {
            box-shadow: none !important;
          }

          .print-container .rounded-xl,
          .print-container .rounded-lg,
          .print-container .rounded {
            overflow: visible !important;
          }

          /* CardContent padding 축소 */
          .print-container .p-8 {
            padding: 16px !important;
          }

          /* 2열 grid 유지 */
          .grid.grid-cols-1.md\\:grid-cols-2 {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
          }

          .grid.grid-cols-1.md\\:grid-cols-3 {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 8px !important;
          }

          /* 견적 요약 */
          .print-summary {
            padding: 6px !important;
            margin-bottom: 10px !important;
          }

          /* 우측 사이드 패널 숨기기 (명시적 클래스) */
          .print-side-panel {
            display: none !important;
          }

          /* 총액 섹션 */
          .print-total {
            padding: 6px !important;
            margin-bottom: 10px !important;
          }

          /* 푸터 */
          .print-footer {
            position: fixed;
            bottom: 8mm;
            left: 15mm;
            right: 15mm;
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-top: 1px solid #ccc;
            font-size: 7pt;
            color: #666;
            background: white !important;
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
