import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
}

type StrokeSize = 'fine' | 'regular' | 'bold';

type SignaturePoint = {
  x: number;
  y: number;
  pressure: number;
};

const STROKE_WIDTHS: Record<StrokeSize, number> = {
  fine: 2,
  regular: 3,
  bold: 4.2,
};

const STROKE_OPTIONS: Array<{ value: StrokeSize; label: string; previewHeight: string }> = [
  { value: 'fine', label: '얇은 선', previewHeight: 'h-0.5' },
  { value: 'regular', label: '보통 선', previewHeight: 'h-1' },
  { value: 'bold', label: '굵은 선', previewHeight: 'h-1.5' },
];

const midpoint = (a: SignaturePoint, b: SignaturePoint) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  pressure: (a.pressure + b.pressure) / 2,
});

const SignaturePad: React.FC<SignaturePadProps> = ({ onChange }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasStrokeRef = useRef(false);
  const lastPointRef = useRef<SignaturePoint | null>(null);
  const lastMidpointRef = useRef<SignaturePoint | null>(null);
  const strokeWidthRef = useRef(STROKE_WIDTHS.regular);
  const [empty, setEmpty] = useState(true);
  const [strokeSize, setStrokeSize] = useState<StrokeSize>('regular');

  const configureContext = (ctx: CanvasRenderingContext2D) => {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidthRef.current;
    ctx.strokeStyle = '#111827';
    ctx.fillStyle = '#111827';
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const previousImage = hasStrokeRef.current ? canvas.toDataURL('image/png') : null;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    configureContext(ctx);

    if (previousImage) {
      const image = new Image();
      image.onload = () => ctx.drawImage(image, 0, 0, rect.width, rect.height);
      image.src = previousImage;
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    strokeWidthRef.current = STROKE_WIDTHS[strokeSize];
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) configureContext(ctx);
  }, [strokeSize]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure > 0 ? event.pressure : 0.55,
    };
  };

  const emit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL('image/png'));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    event.preventDefault();
    drawingRef.current = true;
    hasStrokeRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const p = point(event);
    lastPointRef.current = p;
    lastMidpointRef.current = p;
    const dotRadius = Math.max(1.2, strokeWidthRef.current * (0.35 + p.pressure * 0.25));
    ctx.beginPath();
    ctx.arc(p.x, p.y, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    setEmpty(false);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    event.preventDefault();
    const current = point(event);
    const previous = lastPointRef.current;
    if (!previous) {
      lastPointRef.current = current;
      lastMidpointRef.current = current;
      return;
    }

    const mid = midpoint(previous, current);
    const start = lastMidpointRef.current || previous;
    ctx.lineWidth = strokeWidthRef.current * (0.82 + mid.pressure * 0.28);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.quadraticCurveTo(previous.x, previous.y, mid.x, mid.y);
    ctx.stroke();
    lastPointRef.current = current;
    lastMidpointRef.current = mid;
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    drawingRef.current = false;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    lastPointRef.current = null;
    lastMidpointRef.current = null;
    setTimeout(emit, 0);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    hasStrokeRef.current = false;
    lastPointRef.current = null;
    lastMidpointRef.current = null;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="h-52 rounded-lg border border-input bg-white p-2 shadow-inner sm:h-60">
        <canvas
          ref={canvasRef}
          aria-label="손서명 입력 영역"
          className="h-full w-full cursor-crosshair touch-none rounded-md bg-[linear-gradient(to_bottom,transparent_72%,rgba(148,163,184,0.25)_72%,rgba(148,163,184,0.25)_73%,transparent_73%)]"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-muted-foreground">
          마우스·터치·펜으로 크게 서명해 주세요. 휴대폰에서는 가로 방향이 더 안정적입니다.
        </p>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border bg-background p-1" aria-label="서명 선 굵기">
            {STROKE_OPTIONS.map(option => (
              <button
                key={option.value}
                type="button"
                title={option.label}
                aria-label={option.label}
                onClick={() => setStrokeSize(option.value)}
                className={`flex h-7 w-8 items-center justify-center rounded-full transition-colors ${
                  strokeSize === option.value ? 'bg-foreground text-background' : 'text-foreground hover:bg-muted'
                }`}
              >
                <span className={`block w-4 rounded-full ${option.previewHeight} ${strokeSize === option.value ? 'bg-background' : 'bg-foreground'}`} />
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={clear} disabled={empty}>
            <Eraser className="h-3.5 w-3.5" />
            다시 쓰기
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
