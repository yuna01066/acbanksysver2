import React, { useEffect } from 'react';
import { formatQuotePrintFileName, formatQuoteProjectTitle } from '@/utils/quoteNaming';

interface PrintStylesProps {
  quoteNumber: string;
  projectName?: string | null;
  companyName?: string | null;
  isInternal?: boolean;
}

const PrintStyles: React.FC<PrintStylesProps> = ({ quoteNumber, projectName, companyName, isInternal = true }) => {
  const projectTitle = formatQuoteProjectTitle({ projectName, companyName, fallbackTitle: '프로젝트명 없음' });

  useEffect(() => {
    document.title = formatQuotePrintFileName({ quoteNumber, projectName, companyName });

    return () => {
      document.title = 'Lovable - Build for the web';
    };
  }, [quoteNumber, projectName, companyName]);

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 9mm 10mm 14mm 10mm;
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
            width: 100% !important;
            min-width: 0 !important;
            height: auto !important;
            overflow: visible !important;
            font-family: 'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, sans-serif !important;
            font-size: 11px !important;
            line-height: 1.32 !important;
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
            max-width: 190mm !important;
            width: 190mm !important;
            margin: 0 auto !important;
            padding: 0 !important;
            flex: none !important;
            font-size: 11px !important;
            line-height: 1.32 !important;
          }

          .print-container * {
            letter-spacing: 0 !important;
          }

          .print-container h1,
          .print-container .text-3xl,
          .print-container .text-4xl {
            font-size: 18px !important;
            line-height: 1.18 !important;
          }

          .print-container h2,
          .print-container .text-2xl,
          .print-container .text-xl {
            font-size: 15px !important;
            line-height: 1.22 !important;
          }

          .print-container h3,
          .print-container .text-lg {
            font-size: 13px !important;
            line-height: 1.25 !important;
          }

          .print-container .text-base {
            font-size: 12px !important;
          }

          .print-container .text-sm {
            font-size: 10.5px !important;
          }

          .print-container .text-xs,
          .print-container [class*="text-[11px]"],
          .print-container [class*="text-[10px]"] {
            font-size: 9px !important;
          }

          .print-container .p-8 {
            padding: 12px !important;
          }

          .print-container .p-6 {
            padding: 10px !important;
          }

          .print-container .p-4,
          .print-container .p-3 {
            padding: 7px !important;
          }

          .print-container .px-6,
          .print-container .px-4 {
            padding-left: 8px !important;
            padding-right: 8px !important;
          }

          .print-container .py-3,
          .print-container .py-2 {
            padding-top: 5px !important;
            padding-bottom: 5px !important;
          }

          .print-container .mb-8,
          .print-container .mb-6 {
            margin-bottom: 10px !important;
          }

          .print-container .mb-4,
          .print-container .mb-3 {
            margin-bottom: 6px !important;
          }

          .print-container .mt-8,
          .print-container .mt-6 {
            margin-top: 10px !important;
          }

          .print-container .gap-8,
          .print-container .gap-6 {
            gap: 10px !important;
          }

          .print-container .gap-4,
          .print-container .gap-3 {
            gap: 6px !important;
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
            margin-bottom: 8px !important;
            break-inside: avoid !important;
          }

          /* 총액 섹션 */
          .print-total {
            margin-bottom: 8px !important;
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
            margin-bottom: 8px !important;
          }

          .quote-header-accent {
            background: #2563eb !important;
            height: 3px !important;
          }

          .quote-item-card {
            margin-bottom: 8px !important;
          }

          .quote-item-card [class*="CardHeader"],
          .quote-item-card [class*="CardContent"] {
            padding: 7px !important;
          }

          .print-container img {
            max-width: 100% !important;
            height: auto !important;
          }

          .print-container .min-w-\\[210px\\],
          .print-container [class*="min-w-[210px]"],
          .print-container [class*="min-w-[220px]"] {
            min-width: 150px !important;
          }

          .print-container .rounded-xl,
          .print-container .rounded-lg {
            border-radius: 6px !important;
          }

          /* 푸터 */
          .print-footer {
            position: fixed;
            bottom: 5mm;
            left: 10mm;
            right: 10mm;
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            padding: 4px 0;
            border-top: 1px solid #ccc;
            font-size: 8px;
            color: #666;
            background: white !important;
          }
        }
      `}</style>

      {/* Print Footer */}
      <div className="print-footer hidden print:flex">
        <span>견적번호: {quoteNumber}</span>
        <span>{projectTitle}</span>
        <span>{isInternal ? '내부관리용' : '고객제출용'}</span>
      </div>
    </>
  );
};

export default PrintStyles;
