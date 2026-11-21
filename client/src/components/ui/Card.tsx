import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={`card ${className}`}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  icon: Icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/70 px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {Icon ? (
          <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Icon size={18} />
          </span>
        ) : null}
        <div>
          <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-ink-500">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}

export function LoadingBlock({ label = 'Loading live data' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-ink-500">
      <Loader2 className="animate-spin text-brand-600" size={18} />
      {label}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-red-50 text-critical">
        <AlertTriangle size={20} />
      </span>
      <div>
        <p className="text-sm font-semibold text-ink-900">Live data unavailable</p>
        <p className="mx-auto mt-1 max-w-md text-[13px] text-ink-500">{message}</p>
      </div>
      {onRetry ? (
        <button type="button" className="btn-secondary" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-full bg-ink-100 text-ink-500">
        <Inbox size={20} />
      </span>
      <p className="text-sm font-semibold text-ink-900">{title}</p>
      <p className="max-w-sm text-[13px] text-ink-500">{description}</p>
    </div>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
  className = '',
}: {
  value: number;
  tone?: 'brand' | 'danger' | 'warning' | 'success';
  className?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-brand-600',
    danger: 'bg-critical',
    warning: 'bg-medium',
    success: 'bg-stable',
  };
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-100 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${tones[tone]}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
