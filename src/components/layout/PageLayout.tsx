import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type PageShellProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  maxWidth?: '5xl' | '6xl' | '7xl' | 'full';
};

const maxWidthClass = {
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-none',
} as const;

export function PageShell({
  children,
  className,
  contentClassName,
  maxWidth = '7xl',
}: PageShellProps) {
  return (
    <main
      className={cn(
        'min-h-screen bg-background p-4 sm:p-6',
        className
      )}
    >
      <div className={cn('mx-auto w-full space-y-6', maxWidthClass[maxWidth], contentClassName)}>
        {children}
      </div>
    </main>
  );
}

type PageHeaderProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  icon,
  actions,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('border-b border-border/80 pb-5', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          {eyebrow && (
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {eyebrow}
            </div>
          )}
          <div className="flex items-center gap-3">
            {icon && (
              <div className="glass-surface flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-primary">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-normal text-foreground sm:text-[28px]">
                {title}
              </h1>
              {description && (
                <p className="mt-1 max-w-2xl text-[13px] leading-5 tracking-normal text-muted-foreground sm:text-sm">
                  {description}
                </p>
              )}
            </div>
          </div>
          {meta && <div className="flex flex-wrap items-center gap-2 pt-1">{meta}</div>}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

type PageToolbarProps = {
  children: ReactNode;
  className?: string;
};

export function PageToolbar({ children, className }: PageToolbarProps) {
  return (
    <section
      className={cn(
        'glass-surface flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      {children}
    </section>
  );
}

export function SearchFilterBar({ children, className }: PageToolbarProps) {
  return (
    <section className={cn('glass-card p-3 sm:p-4', className)}>
      {children}
    </section>
  );
}
