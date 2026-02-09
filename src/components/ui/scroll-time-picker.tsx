import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScrollTimePickerProps {
  value: string; // "HH:mm" format
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 10, 20, 30, 40, 50];

const ScrollColumn: React.FC<{
  items: number[];
  selected: number;
  onSelect: (val: number) => void;
  formatFn?: (val: number) => string;
}> = ({ items, selected, onSelect, formatFn }) => {
  const ref = useRef<HTMLDivElement>(null);
  const itemHeight = 36;

  useEffect(() => {
    if (ref.current) {
      const idx = items.indexOf(selected);
      if (idx >= 0) {
        ref.current.scrollTop = idx * itemHeight - (ref.current.clientHeight / 2 - itemHeight / 2);
      }
    }
  }, [selected, items]);

  return (
    <div
      ref={ref}
      className="h-[216px] overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 scrollbar-track-transparent snap-y snap-mandatory"
      style={{ scrollBehavior: 'smooth' }}
    >
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onSelect(item)}
          className={cn(
            'w-full h-9 flex items-center justify-center text-sm font-medium snap-center transition-colors rounded-md',
            selected === item
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          )}
        >
          {formatFn ? formatFn(item) : String(item).padStart(2, '0')}
        </button>
      ))}
    </div>
  );
};

const ScrollTimePicker: React.FC<ScrollTimePickerProps> = ({
  value,
  onChange,
  className,
  placeholder = '시간 선택',
}) => {
  const [open, setOpen] = useState(false);

  const [hour, minute] = value
    ? value.split(':').map(Number)
    : [9, 0];

  const handleHourSelect = (h: number) => {
    const m = value ? Number(value.split(':')[1]) : 0;
    // Snap minute to nearest 10
    const snapped = MINUTES.reduce((prev, curr) => Math.abs(curr - m) < Math.abs(prev - m) ? curr : prev);
    onChange(`${String(h).padStart(2, '0')}:${String(snapped).padStart(2, '0')}`);
  };

  const handleMinuteSelect = (m: number) => {
    const h = value ? Number(value.split(':')[0]) : 9;
    onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal gap-2',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <Clock className="h-3.5 w-3.5" />
          {value || placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2 text-center">
            {value ? `${value}` : placeholder}
          </div>
          <div className="flex gap-1">
            {/* Hours */}
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground text-center mb-1 font-medium">시</div>
              <ScrollColumn
                items={HOURS}
                selected={hour}
                onSelect={handleHourSelect}
                formatFn={(v) => String(v).padStart(2, '0')}
              />
            </div>
            {/* Divider */}
            <div className="flex items-center px-0.5 text-muted-foreground font-bold pt-5">:</div>
            {/* Minutes */}
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground text-center mb-1 font-medium">분</div>
              <ScrollColumn
                items={MINUTES}
                selected={MINUTES.reduce((prev, curr) => Math.abs(curr - minute) < Math.abs(prev - minute) ? curr : prev)}
                onSelect={handleMinuteSelect}
                formatFn={(v) => String(v).padStart(2, '0')}
              />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full mt-2 h-8 text-xs"
            onClick={() => setOpen(false)}
          >
            확인
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ScrollTimePicker;
