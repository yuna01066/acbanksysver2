 declare module 'html2pdf.js' {
   interface Html2PdfOptions {
     margin?: number | [number, number, number, number];
     filename?: string;
     image?: {
       type?: string;
       quality?: number;
     };
     html2canvas?: {
       scale?: number;
       useCORS?: boolean;
       letterRendering?: boolean;
       logging?: boolean;
     };
     jsPDF?: {
       unit?: string;
       format?: string;
       orientation?: 'portrait' | 'landscape';
     };
     pagebreak?: {
       mode?: string[];
     };
   }
 
   interface Html2PdfInstance {
     set(options: Html2PdfOptions): Html2PdfInstance;
     from(element: HTMLElement | string): Html2PdfInstance;
     save(): Promise<void>;
     output(type: string, options?: any): Promise<void>;
     outputPdf(type: 'blob'): Promise<Blob>;
     outputPdf(type: 'datauristring'): Promise<string>;
     outputPdf(type: 'arraybuffer'): Promise<ArrayBuffer>;
   }
 
   function html2pdf(): Html2PdfInstance;
   export default html2pdf;
 }