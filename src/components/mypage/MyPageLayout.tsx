import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger';

const toneClass: Record<Tone, string> = {
  neutral: 'border-border bg-background text-foreground',
  primary: 'border-primary/20 bg-primary/5 text-primary',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300',
  warning: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300',
  danger: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300',
};

interface SectionHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export function MyPageSectionHeader({ title, description, icon, action }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-base font-semibold tracking-normal">{title}</h2>
          {description && <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  description?: string;
  icon?: React.ReactNode;
  tone?: Tone;
  onClick?: () => void;
}

export function MyPageMetricCard({
  label,
  value,
  description,
  icon,
  tone = 'neutral',
  onClick,
}: MetricCardProps) {
  const content = (
    <Card className={cn('h-full border shadow-none transition-colors', onClick && 'cursor-pointer hover:bg-accent/25')}>
      <CardContent className="flex min-h-[98px] items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-normal">{value}</p>
          {description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{description}</p>}
        </div>
        {icon && (
          <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', toneClass[tone])}>
            {icon}
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (!onClick) return content;

  return (
    <button type="button" className="block h-full w-full text-left" onClick={onClick}>
      {content}
    </button>
  );
}

interface ActionPanelProps {
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  children?: React.ReactNode;
}

export function MyPageActionPanel({ title, description, actionLabel, onAction, children }: ActionPanelProps) {
  return (
    <Card className="border shadow-none">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{title}</p>
            {description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {actionLabel && onAction && (
            <Button variant="outline" size="sm" className="shrink-0 rounded-full" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function MyPageEmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
