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
    typeof itemCount === 'number' ? { label: '항목', value: `${itemCount.toLocaleString()}개` } : null,
    ...extraMeta,
  ].filter(Boolean) as Array<{ label: string; value: React.ReactNode }>;

  return (
    <section className={cn('quote-section mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn('font-semibold', profile.badgeClassName)}>
            {profile.label}
          </Badge>
          <span className="text-[12px] font-medium text-slate-600">{profile.basisLabel}</span>
        </div>

        {meta.length > 0 && (
          <dl className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-[180px]">
            {meta.map((item) => (
              <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2">
                <dt className="text-[11px] font-semibold text-slate-500">{item.label}</dt>
                <dd className="mt-0.5 text-[12px] font-bold text-slate-950">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};

export default QuoteStyleBanner;
