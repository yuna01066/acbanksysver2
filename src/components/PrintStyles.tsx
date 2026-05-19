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
    const finalFileName = `${fileName}_${isInternal ? '내부용' : '고객용'}`;
    document.title = finalFileName;

    return () => {
      document.title = 'Lovable - Build for the web';
    };
  }, [quoteNumber, projectName, companyName, isInternal]);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 12mm 14mm 14mm 14mm;
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
            background: white !important;
            height: auto !important;
            overflow: visible !important;
            font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif !important;
          }

          /* 화면 레이아웃 요소 숨기기 */
          .print\\:hidden,
          [class*="print:hidden"] {
            display: none !important;
          }

          /* 최상위 래퍼 */
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
          .print-side-panel {
            display: none !important;
          }

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

          /* 견적서 메인 카드 - 인쇄 시 카드 스타일 제거 */
          .quote-main-card {
            background: white !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            overflow: visible !important;
          }

          .quote-main-card > div {
            padding: 0 !important;
          }

          /* glass-card 인쇄 시 불투명 배경으로 변환 */
          .glass-card {
            background: white !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            border-color: #d1d5db !important;
            overflow: visible !important;
          }

          /* Card shadow 제거 */
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

          /* 인쇄 잉크 절감: 넓은 진한 배경은 흰 배경과 얇은 선으로 변환 */
          .print-container .bg-gray-900,
          .print-container .bg-slate-900,
          .print-container .bg-black,
          .print-container [class*="bg-gray-900"],
          .print-container [class*="bg-slate-900"],
          .print-container [class*="bg-black"] {
            background: white !important;
            color: #0f172a !important;
            border: 1px solid #bfdbfe !important;
          }

          .print-container .text-white,
          .print-container [class*="text-white"] {
            color: #0f172a !important;
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
            margin-bottom: 12px !important;
            break-inside: avoid !important;
          }

          /* 총액 섹션 */
          .print-total {
            margin-bottom: 12px !important;
            break-inside: avoid !important;
          }

          /* 섹션 페이지 나눔 방지 */
          .quote-section {
            break-inside: avoid !important;
          }

          .quote-item-card {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          /* 화면용 스크롤/높이 제한은 PDF에서 내용 잘림을 만들 수 있어 해제 */
          .print-container [class*="max-h-"],
          .print-container [class*="overflow-y-auto"],
          .print-container [class*="overflow-auto"],
          .print-container .overflow-y-auto,
          .print-container .overflow-auto {
            max-height: none !important;
            overflow: visible !important;
          }

          /* 헤더 카드 인쇄 시 */
          .quote-header-card {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            margin-bottom: 12px !important;
          }

          .quote-header-accent {
            background: #2563eb !important;
            height: 4px !important;
          }

          /* 푸터 */
          .print-footer {
            position: fixed;
            bottom: 6mm;
            left: 14mm;
            right: 14mm;
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-top: 1px solid #ccc;
            font-size: 9px;
            color: #666;
            background: white !important;
          }
        }
      `}</style>

      {/* Print Footer */}
      <div className="print-footer hidden print:flex">
        <span>견적번호: {quoteNumber}</span>
        <span>{projectName || '프로젝트명 없음'}</span>
        <span>{isInternal ? '내부관리용' : '고객제출용'}</span>
      </div>
    </>
  );
};

export default PrintStyles;
