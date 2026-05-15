import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { getQuoteStyleProfile, type QuoteStyleType } from '@/utils/quoteStyle';

interface QuoteStyleBannerProps {
  styleType: QuoteStyleType;
  itemCount?: number;
  extraMeta?: Array<{
    label: string;
    value: React.ReactNode;
  }>;
  className?: string;
}

const QuoteStyleBanner: React.FC<QuoteStyleBannerProps> = ({
  styleType,
  itemCount,
  extraMeta = [],
  className,
}) => {
  const profile = getQuoteStyleProfile(styleType);
  const meta = [
    { label: '견적 기준', value: profile.basisLabel },
    typeof itemCount === 'number' ? { label: '항목', value: `${itemCount.toLocaleString()}개` } : null,
    ...extraMeta,
  ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>;

  return (
    <section className={cn('quote-section mb-6 rounded-lg border p-4', profile.panelClassName, className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn('font-semibold', profile.badgeClassName)}>
              {profile.label}
            </Badge>
            {profile.chips.map((chip) => (
              <span key={chip} className="rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                {chip}
              </span>
            ))}
          </div>
          <h2 className="text-[17px] font-bold text-slate-950">{profile.title}</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{profile.description}</p>
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-[240px]">
          {meta.map((item) => (
            <div key={item.label} className="rounded-md border border-white/70 bg-white/90 px-3 py-2">
              <dt className="text-[11px] font-semibold text-slate-500">{item.label}</dt>
              <dd className="mt-0.5 text-[12px] font-bold text-slate-950">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};

export default QuoteStyleBanner;
