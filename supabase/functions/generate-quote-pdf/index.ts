import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

// 한글 및 비-ASCII 문자를 안전하게 처리하는 함수
function sanitizeForPdf(text: string | null | undefined): string {
  if (!text) return '-';
  // 한글 및 비-ASCII 문자를 유니코드 이스케이프로 변환하거나 제거
  // 여기서는 한글을 괄호로 감싼 로마자 표기로 대체하거나 그냥 유지
  // pdf-lib의 WinAnsi 인코딩은 0x00-0xFF 범위만 지원
  // 한글이 포함된 경우 그냥 표시하지 않고 placeholder 사용
  const hasNonAscii = /[^\x00-\x7F]/.test(text);
  if (hasNonAscii) {
    // 한글이 포함된 텍스트는 영문 placeholder로 대체
    // 또는 ASCII 문자만 추출
    const asciiOnly = text.replace(/[^\x00-\x7F]/g, '');
    return asciiOnly.trim() || '(Korean text)';
  }
  return text;
}
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers":
     "authorization, x-client-info, apikey, content-type",
 };
 
 interface QuoteData {
   quoteNumber: string;
   projectName: string | null;
   companyName: string | null;
   quoteDate: string;
   validUntil: string | null;
   deliveryPeriod: string | null;
   paymentCondition: string | null;
   recipientName: string | null;
   recipientPhone: string | null;
   recipientEmail: string | null;
   recipientAddress: string | null;
   issuerName: string | null;
   issuerPhone: string | null;
   issuerEmail: string | null;
   items: any[];
   subtotal: number;
   tax: number;
   total: number;
   isInternal: boolean;
 }
 
const formatPrice = (price: number) => {
  return `${Math.round(price).toLocaleString('en-US')} KRW`;
};

async function generateQuotePdf(data: QuoteData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  let page = pdfDoc.addPage([595, 842]); // A4 size
  const { width, height } = page.getSize();
  
  let y = height - 50;
  const leftMargin = 50;
  const rightMargin = width - 50;
  
  // Header background
  page.drawRectangle({
    x: leftMargin,
    y: y - 60,
    width: rightMargin - leftMargin,
    height: 70,
    color: rgb(0.118, 0.161, 0.231), // #1e293b
  });
  
  // Title
  const titleText = data.isInternal ? 'ARCBANK Quote [Internal]' : 'ARCBANK Quote [Customer]';
  page.drawText(titleText, {
    x: leftMargin + 15,
    y: y - 25,
    size: 18,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  // Quote number
  page.drawText(`No: ${data.quoteNumber}`, {
    x: leftMargin + 15,
    y: y - 45,
    size: 10,
    font: font,
    color: rgb(0.58, 0.64, 0.72),
  });
  
  // Date
  const dateText = new Date(data.quoteDate).toLocaleDateString('en-US');
  page.drawText(dateText, {
    x: rightMargin - 100,
    y: y - 35,
    size: 10,
    font: font,
    color: rgb(0.58, 0.64, 0.72),
  });
  
  y -= 90;
  
  // Project Info Section
  page.drawText('Project Information', {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;
  
  const projectInfo = [
    `Project: ${sanitizeForPdf(data.projectName)}`,
    `Company: ${sanitizeForPdf(data.companyName)}`,
    `Valid Until: ${sanitizeForPdf(data.validUntil)}`,
    `Delivery: ${sanitizeForPdf(data.deliveryPeriod)}`,
    `Payment: ${sanitizeForPdf(data.paymentCondition)}`,
  ];
  
  for (const info of projectInfo) {
    page.drawText(info, {
      x: leftMargin + 10,
      y,
      size: 9,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 14;
  }
  
  y -= 10;
  
  // Recipient Info
  page.drawText('Recipient', {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;
  
  const recipientInfo = [
    `Name: ${sanitizeForPdf(data.recipientName)}`,
    `Phone: ${data.recipientPhone || '-'}`,
    `Email: ${data.recipientEmail || '-'}`,
  ];
  
  for (const info of recipientInfo) {
    page.drawText(info, {
      x: leftMargin + 10,
      y,
      size: 9,
      font: font,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 14;
  }
  
  y -= 15;
  
  // Items Section
  page.drawText(`Items (${data.items.length})`, {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 5;
  
  // Draw line
  page.drawLine({
    start: { x: leftMargin, y },
    end: { x: rightMargin, y },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 15;
  
  // Items
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    // Check if we need a new page
    if (y < 150) {
      page = pdfDoc.addPage([595, 842]);
      y = height - 50;
    }
    
    // Item box background
    page.drawRectangle({
      x: leftMargin,
      y: y - 45,
      width: rightMargin - leftMargin,
      height: 50,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    });
    
    // Item title
    const itemTitle = `#${i + 1} ${sanitizeForPdf(item.material)} ${sanitizeForPdf(item.quality)} ${item.thickness || ''}`.trim();
    page.drawText(itemTitle, {
      x: leftMargin + 10,
      y: y - 15,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Item price
    const itemPrice = formatPrice(item.totalPrice * (item.quantity || 1));
    page.drawText(itemPrice, {
      x: rightMargin - 100,
      y: y - 15,
      size: 10,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });
    
    // Item details
    const itemDetails = `Size: ${sanitizeForPdf(item.size || item.selectedSize)} | Surface: ${sanitizeForPdf(item.surface)} | Qty: ${item.quantity || 1}`;
    page.drawText(itemDetails, {
      x: leftMargin + 10,
      y: y - 32,
      size: 8,
      font: font,
      color: rgb(0.5, 0.5, 0.5),
    });
    
    y -= 60;
  }
  
  // Check if we need a new page for summary
  if (y < 200) {
    page = pdfDoc.addPage([595, 842]);
    y = height - 50;
  }
  
  y -= 20;
  
  // Summary Section
  page.drawText('Summary', {
    x: leftMargin,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.2),
  });
  y -= 20;
  
  // Summary box
  page.drawRectangle({
    x: leftMargin,
    y: y - 50,
    width: rightMargin - leftMargin,
    height: 55,
    color: rgb(0.97, 0.98, 0.99),
    borderColor: rgb(0.9, 0.9, 0.9),
    borderWidth: 1,
  });
  
  page.drawText(`Subtotal: ${formatPrice(data.subtotal)}`, {
    x: leftMargin + 10,
    y: y - 15,
    size: 9,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  
  page.drawText(`Tax (10%): ${formatPrice(data.tax)}`, {
    x: leftMargin + 10,
    y: y - 30,
    size: 9,
    font: font,
    color: rgb(0.3, 0.3, 0.3),
  });
  
  y -= 70;
  
  // Total box
  page.drawRectangle({
    x: leftMargin,
    y: y - 35,
    width: rightMargin - leftMargin,
    height: 40,
    color: rgb(0.118, 0.161, 0.231),
  });
  
  page.drawText('Total (VAT included)', {
    x: leftMargin + 15,
    y: y - 22,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(formatPrice(data.total), {
    x: rightMargin - 120,
    y: y - 22,
    size: 14,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  y -= 60;
  
  // Issuer Info
  page.drawText('Issuer: ARCBANK Co., Ltd.', {
    x: leftMargin,
    y,
    size: 10,
    font: boldFont,
    color: rgb(0.3, 0.3, 0.3),
  });
  y -= 14;
  
  page.drawText(`Business No: 299-87-02991 | Contact: ${sanitizeForPdf(data.issuerName)} | Tel: ${data.issuerPhone || '070-7666-9828'}`, {
    x: leftMargin,
    y,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 14;
  
  page.drawText(`Email: ${data.issuerEmail || 'acbank@acbank.co.kr'}`, {
    x: leftMargin,
    y,
    size: 8,
    font: font,
    color: rgb(0.5, 0.5, 0.5),
  });
  y -= 20;
  
  // Bank info
  page.drawText('Bank: Shinhan 140-014-544315 (ARCBANK Co., Ltd.)', {
    x: leftMargin,
    y,
    size: 9,
    font: boldFont,
    color: rgb(0.12, 0.25, 0.47),
  });
  
  // Footer note
  y -= 30;
  page.drawRectangle({
    x: leftMargin,
    y: y - 40,
    width: rightMargin - leftMargin,
    height: 45,
    color: rgb(1, 0.99, 0.91),
    borderColor: rgb(0.99, 0.94, 0.54),
    borderWidth: 1,
  });
  
  page.drawText('Note: Quote valid for 14 days. Shipping and VAT are separate.', {
    x: leftMargin + 10,
    y: y - 20,
    size: 8,
    font: font,
    color: rgb(0.52, 0.3, 0.05),
  });
  
  const pdfBytes = await pdfDoc.save();
  return pdfBytes;
 }
 
 Deno.serve(async (req) => {
   // CORS preflight
   if (req.method === "OPTIONS") {
     return new Response("ok", { headers: corsHeaders });
   }
 
   try {
     const supabaseClient = createClient(
       Deno.env.get("SUPABASE_URL") ?? "",
       Deno.env.get("SUPABASE_ANON_KEY") ?? "",
       {
         global: {
           headers: { Authorization: req.headers.get("Authorization") ?? "" },
         },
       }
     );
 
     // 인증 확인
     const authHeader = req.headers.get("Authorization");
     if (!authHeader?.startsWith("Bearer ")) {
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const token = authHeader.replace("Bearer ", "");
     const { data: claims, error: authError } = await supabaseClient.auth.getUser(token);
     
     if (authError || !claims?.user) {
       return new Response(
         JSON.stringify({ error: "Unauthorized" }),
         { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const { quoteData, inquiryId } = await req.json();
 
     if (!quoteData || !inquiryId) {
       return new Response(
         JSON.stringify({ error: "Missing quoteData or inquiryId" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     console.log(`[Generate PDF] Generating PDFs for inquiry ${inquiryId}`);
 
    // 고객용 PDF 생성
    const customerPdfBytes = await generateQuotePdf({ ...quoteData, isInternal: false });
    const customerPdfBase64 = btoa(String.fromCharCode(...customerPdfBytes));
    
    // 내부용 PDF 생성
    const internalPdfBytes = await generateQuotePdf({ ...quoteData, isInternal: true });
    const internalPdfBase64 = btoa(String.fromCharCode(...internalPdfBytes));
 
     const fileNameBase = [quoteData.quoteNumber, quoteData.projectName, quoteData.companyName]
       .filter(Boolean)
       .join('-')
       .replace(/[/\\?%*:|"<>]/g, '_')
       .replace(/[^\x00-\x7F]/g, ''); // 한글 제거

     // 파일명이 비어있으면 기본 파일명 사용
     const safeFileNameBase = fileNameBase.trim() || quoteData.quoteNumber || 'quote';
 
     // Pluuug API를 통해 파일 업로드
     const results = {
       customer: null as any,
       internal: null as any,
       errors: [] as string[],
     };
 
     // 고객용 HTML 파일 업로드
     try {
       const customerResult = await supabaseClient.functions.invoke('pluuug-api', {
         body: {
           action: 'inquiry.file.upload',
           inquiryId: inquiryId,
          fileName: `${safeFileNameBase}_customer.pdf`,
          fileContent: customerPdfBase64,
          mimeType: 'application/pdf',
         }
       });
 
       if (customerResult.error) {
         console.error('[Generate PDF] Customer file upload error:', customerResult.error);
        results.errors.push(`고객용 PDF 업로드 실패: ${customerResult.error.message}`);
       } else if (customerResult.data?.error) {
         console.error('[Generate PDF] Customer file upload API error:', customerResult.data.error);
        results.errors.push(`고객용 PDF 업로드 실패: ${customerResult.data.error}`);
       } else {
         results.customer = customerResult.data;
        console.log('[Generate PDF] Customer PDF uploaded successfully');
       }
     } catch (err: any) {
       console.error('[Generate PDF] Customer file upload exception:', err);
      results.errors.push(`고객용 PDF 업로드 실패: ${err.message}`);
     }
 
    // 내부용 PDF 파일 업로드
     try {
       const internalResult = await supabaseClient.functions.invoke('pluuug-api', {
         body: {
           action: 'inquiry.file.upload',
           inquiryId: inquiryId,
          fileName: `${safeFileNameBase}_internal.pdf`,
          fileContent: internalPdfBase64,
          mimeType: 'application/pdf',
         }
       });
 
       if (internalResult.error) {
         console.error('[Generate PDF] Internal file upload error:', internalResult.error);
        results.errors.push(`내부용 PDF 업로드 실패: ${internalResult.error.message}`);
       } else if (internalResult.data?.error) {
         console.error('[Generate PDF] Internal file upload API error:', internalResult.data.error);
        results.errors.push(`내부용 PDF 업로드 실패: ${internalResult.data.error}`);
       } else {
         results.internal = internalResult.data;
        console.log('[Generate PDF] Internal PDF uploaded successfully');
       }
     } catch (err: any) {
       console.error('[Generate PDF] Internal file upload exception:', err);
      results.errors.push(`내부용 PDF 업로드 실패: ${err.message}`);
     }
 
     const success = results.customer || results.internal;
 
     return new Response(
       JSON.stringify({
         success,
         customer: results.customer,
         internal: results.internal,
         errors: results.errors,
       }),
       { status: success ? 200 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error: unknown) {
     console.error("[Generate PDF] Error:", error);
     const errorMessage = error instanceof Error ? error.message : "Unknown error";
     return new Response(
       JSON.stringify({ error: errorMessage }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });