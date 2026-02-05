 import html2pdf from 'html2pdf.js';
 import { supabase } from '@/integrations/supabase/client';
 
 export interface PdfGenerationResult {
   success: boolean;
   pdfUrl?: string;
   pdfPath?: string;
   error?: string;
 }
 
 /**
  * 견적서 HTML 요소를 PDF로 변환하고 Supabase Storage에 업로드
  */
 export async function generateAndUploadQuotePdf(
   elementId: string,
   userId: string,
   quoteNumber: string,
   projectName?: string
 ): Promise<PdfGenerationResult> {
   try {
     const element = document.getElementById(elementId);
     if (!element) {
       console.error('[PDF Generator] Element not found:', elementId);
       return { success: false, error: 'PDF 생성 대상 요소를 찾을 수 없습니다.' };
     }
 
     console.log('[PDF Generator] Starting PDF generation for quote:', quoteNumber);
 
     // HTML 요소 클론 (프린트 모드로 스타일 적용)
     const clonedElement = element.cloneNode(true) as HTMLElement;
     
     // print:hidden 클래스 요소들 제거
     const hiddenElements = clonedElement.querySelectorAll('.print\\:hidden, [class*="print:hidden"]');
     hiddenElements.forEach(el => el.remove());
     
     // 임시 컨테이너에 추가
     const tempContainer = document.createElement('div');
     tempContainer.style.position = 'absolute';
     tempContainer.style.left = '-9999px';
     tempContainer.style.top = '0';
     tempContainer.style.width = '210mm'; // A4 너비
     tempContainer.style.backgroundColor = '#fff';
     tempContainer.appendChild(clonedElement);
     document.body.appendChild(tempContainer);
 
     // html2pdf 옵션 설정
     const options = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
       filename: `견적서_${quoteNumber}.pdf`,
       image: { type: 'jpeg', quality: 0.98 },
       html2canvas: { 
         scale: 2,
         useCORS: true,
         letterRendering: true,
         logging: false,
       },
       jsPDF: { 
         unit: 'mm', 
         format: 'a4', 
         orientation: 'portrait' as const
       },
       pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
     };
 
     // PDF 생성 (Blob으로)
     const pdfBlob = await html2pdf()
       .set(options)
       .from(clonedElement)
       .outputPdf('blob');
 
     // 임시 컨테이너 제거
     document.body.removeChild(tempContainer);
 
     console.log('[PDF Generator] PDF blob generated, size:', pdfBlob.size);
 
     // Supabase Storage에 업로드
     const fileName = `${quoteNumber}.pdf`;
     const filePath = `${userId}/${quoteNumber}/${fileName}`;
 
     // 기존 파일이 있으면 덮어쓰기
     const { error: uploadError } = await supabase.storage
       .from('quote-pdfs')
       .upload(filePath, pdfBlob, {
         contentType: 'application/pdf',
         upsert: true // 덮어쓰기 허용
       });
 
     if (uploadError) {
       console.error('[PDF Generator] Upload error:', uploadError);
       return { success: false, error: `PDF 업로드 실패: ${uploadError.message}` };
     }
 
     // Public URL 가져오기
     const { data: publicUrlData } = supabase.storage
       .from('quote-pdfs')
       .getPublicUrl(filePath);
 
     const pdfUrl = publicUrlData?.publicUrl;
     console.log('[PDF Generator] PDF uploaded successfully:', pdfUrl);
 
     return { 
       success: true, 
       pdfUrl,
       pdfPath: filePath
     };
   } catch (err: any) {
     console.error('[PDF Generator] Error:', err);
     return { success: false, error: err.message };
   }
 }
 
 /**
  * 견적서 PDF 첨부파일 메타데이터 생성
  */
 export function createPdfAttachmentMetadata(
   quoteNumber: string,
   pdfUrl: string,
   pdfPath: string
 ): { name: string; path: string; size: number; type: string; url: string } {
   return {
     name: `견적서_${quoteNumber}.pdf`,
     path: pdfPath,
     size: 0, // Blob 크기는 업로드 후 정확히 알 수 없으므로 0으로 설정
     type: 'quote_pdf', // 특별한 타입으로 구분
     url: pdfUrl
   };
 }