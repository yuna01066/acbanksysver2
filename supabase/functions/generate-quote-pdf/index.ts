 import { createClient } from "npm:@supabase/supabase-js@2";
 
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
 
 function generateQuotePdfHtml(data: QuoteData): string {
   const formatPrice = (price: number) => `₩${Math.round(price).toLocaleString('ko-KR')}`;
   const currentDate = new Date(data.quoteDate).toLocaleDateString('ko-KR', {
     year: 'numeric',
     month: 'long',
     day: 'numeric'
   });
 
   const itemsHtml = data.items.map((item: any, index: number) => {
     const breakdown = (item.breakdown || [])
       .filter((b: any) => b.price > 0)
       .map((b: any) => `<div style="font-size: 11px; color: #666; margin-left: 12px;">- ${b.label}: ${formatPrice(b.price)}</div>`)
       .join('');
     
     return `
       <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; background: #fafafa;">
         <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
           <div style="font-weight: bold; color: #1f2937;">#${index + 1} ${item.material || ''} ${item.quality || ''} ${item.thickness || ''}</div>
           <div style="font-weight: bold; color: #1f2937;">${formatPrice(item.totalPrice * (item.quantity || 1))}</div>
         </div>
         <div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">
           사이즈: ${item.size || item.selectedSize || '-'} | 면수: ${item.surface || '-'} | 수량: ${item.quantity || 1}개
         </div>
         ${breakdown}
       </div>
     `;
   }).join('');
 
   const internalBadge = data.isInternal 
     ? '<span style="background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-left: 12px;">내부용</span>'
     : '<span style="background: #3b82f6; color: white; padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-left: 12px;">고객용</span>';
 
   return `
     <!DOCTYPE html>
     <html>
     <head>
       <meta charset="utf-8">
       <title>${data.quoteNumber} - ${data.projectName || '견적서'}</title>
       <style>
         * { margin: 0; padding: 0; box-sizing: border-box; }
         body { font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif; font-size: 14px; color: #333; padding: 40px; }
         .header { background: linear-gradient(135deg, #1e293b, #334155); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
         .header-title { font-size: 24px; font-weight: bold; margin-bottom: 4px; }
         .header-subtitle { font-size: 14px; color: #94a3b8; }
         .header-info { text-align: right; }
         .section { margin-bottom: 24px; }
         .section-title { font-size: 16px; font-weight: bold; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 16px; }
         .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
         .info-box { background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
         .info-box h4 { font-size: 14px; font-weight: bold; color: #475569; margin-bottom: 12px; }
         .info-row { font-size: 13px; margin-bottom: 6px; }
         .info-row strong { color: #374151; }
         .total-box { background: #1e293b; color: white; padding: 20px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; }
         .total-label { font-size: 18px; font-weight: bold; }
         .total-amount { font-size: 28px; font-weight: bold; }
         .summary-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
         .footer { margin-top: 24px; padding: 16px; background: #fefce8; border: 1px solid #fef08a; border-radius: 8px; font-size: 12px; color: #854d0e; }
       </style>
     </head>
     <body>
       <div class="header">
         <div style="display: flex; justify-content: space-between; align-items: flex-start;">
           <div>
             <div class="header-title">아크뱅크 견적서 ${internalBadge}</div>
             <div class="header-subtitle">Panel Material Quotation</div>
           </div>
           <div class="header-info">
             <div style="font-size: 13px; color: #94a3b8; margin-bottom: 4px;">${currentDate}</div>
             <div style="font-size: 16px; font-weight: bold;">견적번호: ${data.quoteNumber}</div>
           </div>
         </div>
       </div>
 
       <div class="info-grid">
         <div class="info-box">
           <h4>📋 프로젝트 정보</h4>
           <div class="info-row"><strong>프로젝트명:</strong> ${data.projectName || '-'}</div>
           <div class="info-row"><strong>유효기간:</strong> ${data.validUntil || '-'}</div>
           <div class="info-row"><strong>납기:</strong> ${data.deliveryPeriod || '-'}</div>
           <div class="info-row"><strong>결제조건:</strong> ${data.paymentCondition || '-'}</div>
         </div>
         <div class="info-box">
           <h4>👤 수신자 정보</h4>
           <div class="info-row"><strong>회사명:</strong> ${data.companyName || '-'}</div>
           <div class="info-row"><strong>담당자:</strong> ${data.recipientName || '-'}</div>
           <div class="info-row"><strong>연락처:</strong> ${data.recipientPhone || '-'}</div>
           <div class="info-row"><strong>이메일:</strong> ${data.recipientEmail || '-'}</div>
         </div>
       </div>
 
       <div class="section" style="margin-top: 24px;">
         <div class="section-title">📦 견적 항목 (${data.items.length}개)</div>
         ${itemsHtml}
       </div>
 
       <div class="section">
         <div class="section-title">💰 금액 요약</div>
         <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
           <div class="summary-row">
             <span>공급가액</span>
             <span style="font-weight: bold;">${formatPrice(data.subtotal)}</span>
           </div>
           <div class="summary-row">
             <span>부가세 (10%)</span>
             <span style="font-weight: bold;">${formatPrice(data.tax)}</span>
           </div>
         </div>
       </div>
 
       <div class="total-box">
         <div class="total-label">총 합계 (VAT 포함)</div>
         <div class="total-amount">${formatPrice(data.total)}</div>
       </div>
 
       <div class="info-grid" style="margin-top: 24px;">
         <div class="info-box">
           <h4>🏢 발신자 정보</h4>
           <div class="info-row"><strong>상호:</strong> (주)아크뱅크</div>
           <div class="info-row"><strong>사업자번호:</strong> 299-87-02991</div>
           <div class="info-row"><strong>담당자:</strong> ${data.issuerName || '-'}</div>
           <div class="info-row"><strong>연락처:</strong> ${data.issuerPhone || '070-7666-9828'}</div>
           <div class="info-row"><strong>이메일:</strong> ${data.issuerEmail || 'acbank@acbank.co.kr'}</div>
         </div>
         <div class="info-box">
           <h4>💳 입금 계좌</h4>
           <div class="info-row" style="font-size: 15px; font-weight: bold; color: #1e40af;">
             신한은행 140-014-544315
           </div>
           <div class="info-row" style="font-weight: bold;">(주)아크뱅크</div>
         </div>
       </div>
 
       <div class="footer">
         <strong>⚠️ 주의사항</strong>
         <ul style="margin-top: 8px; margin-left: 20px;">
           <li>본 견적서의 유효기간은 발행일로부터 14일입니다.</li>
           <li>운송비 및 부가세는 별도입니다.</li>
           <li>정확한 견적을 위해서는 별도 문의를 통해 확인해주시기 바랍니다.</li>
         </ul>
       </div>
     </body>
     </html>
   `;
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
 
     // 고객용 PDF HTML 생성
     const customerHtml = generateQuotePdfHtml({ ...quoteData, isInternal: false });
     
     // 내부용 PDF HTML 생성
     const internalHtml = generateQuotePdfHtml({ ...quoteData, isInternal: true });
 
     // HTML to PDF 변환을 위한 base64 인코딩
     const encoder = new TextEncoder();
     const customerHtmlBase64 = btoa(String.fromCharCode(...encoder.encode(customerHtml)));
     const internalHtmlBase64 = btoa(String.fromCharCode(...encoder.encode(internalHtml)));
 
     const fileNameBase = [quoteData.quoteNumber, quoteData.projectName, quoteData.companyName]
       .filter(Boolean)
       .join('-')
       .replace(/[/\\?%*:|"<>]/g, '_');
 
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
           fileName: `${fileNameBase}_고객용.html`,
           fileContent: customerHtmlBase64,
           mimeType: 'text/html',
         }
       });
 
       if (customerResult.error) {
         console.error('[Generate PDF] Customer file upload error:', customerResult.error);
         results.errors.push(`고객용 파일 업로드 실패: ${customerResult.error.message}`);
       } else if (customerResult.data?.error) {
         console.error('[Generate PDF] Customer file upload API error:', customerResult.data.error);
         results.errors.push(`고객용 파일 업로드 실패: ${customerResult.data.error}`);
       } else {
         results.customer = customerResult.data;
         console.log('[Generate PDF] Customer file uploaded successfully');
       }
     } catch (err: any) {
       console.error('[Generate PDF] Customer file upload exception:', err);
       results.errors.push(`고객용 파일 업로드 실패: ${err.message}`);
     }
 
     // 내부용 HTML 파일 업로드
     try {
       const internalResult = await supabaseClient.functions.invoke('pluuug-api', {
         body: {
           action: 'inquiry.file.upload',
           inquiryId: inquiryId,
           fileName: `${fileNameBase}_내부용.html`,
           fileContent: internalHtmlBase64,
           mimeType: 'text/html',
         }
       });
 
       if (internalResult.error) {
         console.error('[Generate PDF] Internal file upload error:', internalResult.error);
         results.errors.push(`내부용 파일 업로드 실패: ${internalResult.error.message}`);
       } else if (internalResult.data?.error) {
         console.error('[Generate PDF] Internal file upload API error:', internalResult.data.error);
         results.errors.push(`내부용 파일 업로드 실패: ${internalResult.data.error}`);
       } else {
         results.internal = internalResult.data;
         console.log('[Generate PDF] Internal file uploaded successfully');
       }
     } catch (err: any) {
       console.error('[Generate PDF] Internal file upload exception:', err);
       results.errors.push(`내부용 파일 업로드 실패: ${err.message}`);
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