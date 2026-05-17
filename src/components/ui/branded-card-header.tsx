import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BrandedCardHeaderProps {
  title: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
  iconClassName?: string;
  iconWrapClassName?: string;
}

export function BrandedCardHeader({
  title,
  icon: Icon,
  meta,
  subtitle,
  actions,
  className,
  titleClassName,
  iconClassName,
  iconWrapClassName,
}: BrandedCardHeaderProps) {
  return (
    <div className={cn('flex min-h-10 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span
            className={cn(
              'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/10 text-primary',
              iconWrapClassName,
            )}
          >
            <Icon className={cn('h-4 w-4', iconClassName)} />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3
              className={cn(
                'min-w-0 truncate text-[15px] font-semibold leading-6 text-foreground sm:text-base',
                titleClassName,
              )}
            >
              {title}
            </h3>
            {meta && <div className="shrink-0">{meta}</div>}
          </div>
          {subtitle && (
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          {actions}
        </div>
      )}
    </div>
  );
}
