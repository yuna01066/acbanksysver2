import html2canvas from 'html2canvas';
import { contractDocumentCss } from './contractRenderer';

const A4_WIDTH_PT = 595.28;
const A4_HEIGHT_PT = 841.89;
const PDF_MARGIN_PT = 24;

function dataUrlToBytes(dataUrl: string) {
  const base64 = dataUrl.split(',')[1] || '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function concatChunks(chunks: Array<Uint8Array>) {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function textChunk(value: string) {
  return new TextEncoder().encode(value);
}

function buildImagePdf(images: Array<{ bytes: Uint8Array; width: number; height: number }>) {
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  const write = (chunk: Uint8Array | string) => {
    chunks.push(typeof chunk === 'string' ? textChunk(chunk) : chunk);
  };
  const byteLength = () => chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const obj = (id: number, body: string | Uint8Array[], prefix = '', suffix = '') => {
    offsets[id] = byteLength();
    write(`${id} 0 obj\n${prefix}`);
    if (typeof body === 'string') {
      write(body);
    } else {
      body.forEach(write);
    }
    write(`${suffix}\nendobj\n`);
  };

  write('%PDF-1.4\n');
  const pageIds = images.map((_, idx) => 3 + idx * 3);
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`);

  images.forEach((image, idx) => {
    const pageId = 3 + idx * 3;
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const drawableWidth = A4_WIDTH_PT - PDF_MARGIN_PT * 2;
    const drawableHeight = Math.min(A4_HEIGHT_PT - PDF_MARGIN_PT * 2, drawableWidth * (image.height / image.width));
    const y = A4_HEIGHT_PT - PDF_MARGIN_PT - drawableHeight;
    const stream = `q\n${drawableWidth.toFixed(2)} 0 0 ${drawableHeight.toFixed(2)} ${PDF_MARGIN_PT} ${y.toFixed(2)} cm\n/Im${idx + 1} Do\nQ\n`;

    obj(pageId, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_WIDTH_PT} ${A4_HEIGHT_PT}] /Resources << /XObject << /Im${idx + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`);
    obj(contentId, stream, `<< /Length ${stream.length} >>\nstream\n`, 'endstream');
    obj(
      imageId,
      [image.bytes],
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`,
      '\nendstream',
    );
  });

  const xrefOffset = byteLength();
  write(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let i = 1; i < offsets.length; i += 1) {
    write(`${String(offsets[i] || 0).padStart(10, '0')} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
  return new Blob([concatChunks(chunks)], { type: 'application/pdf' });
}

async function waitForImages(container: HTMLElement) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });
  }));
}

export async function createContractPdfBlob(html: string) {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.top = '0';
  container.style.background = '#fff';
  container.innerHTML = `<style>${contractDocumentCss()}</style>${html}`;
  document.body.appendChild(container);

  try {
    await waitForImages(container);
    const documentEl = container.querySelector('.contract-document') as HTMLElement || container;
    const canvas = await html2canvas(documentEl, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const drawableWidth = A4_WIDTH_PT - PDF_MARGIN_PT * 2;
    const drawableHeight = A4_HEIGHT_PT - PDF_MARGIN_PT * 2;
    const pageHeightPx = Math.floor(canvas.width * (drawableHeight / drawableWidth));
    const images: Array<{ bytes: Uint8Array; width: number; height: number }> = [];

    for (let y = 0; y < canvas.height; y += pageHeightPx) {
      const sliceHeight = Math.min(pageHeightPx, canvas.height - y);
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = sliceHeight;
      const ctx = slice.getContext('2d');
      if (!ctx) throw new Error('PDF 캔버스를 생성할 수 없습니다.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
      images.push({
        bytes: dataUrlToBytes(slice.toDataURL('image/jpeg', 0.92)),
        width: slice.width,
        height: slice.height,
      });
    }

    return buildImagePdf(images);
  } finally {
    document.body.removeChild(container);
  }
}
